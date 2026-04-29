// lib/content/queue-writer.ts
// CANONICAL write path for content_queue INSERTs.
// All callers MUST use this helper — direct inserts in route files are banned.
// Compliance is always-synchronous, always-awaited. runComplianceSync is removed.
//
// Callers:
//   1. app/app/api/content/generate/route.ts   (source: 'user_generation')
//   2. app/app/api/agents/content-strategy/route.ts (source: 'agent_strategy')
//   3. app/app/api/cron/generate-content/route.ts   (source: 'cron')

import { createAdminClient } from '@/lib/supabase/admin'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function getInternalBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

export async function writeContentToQueue(input: {
  brand_id: string
  content_type: string
  content: Record<string, unknown>
  platform: string | null
  audience: string | null
  source: 'user_generation' | 'agent_strategy' | 'cron'
  actor?: string
  hero_image_url?: string | null
  hero_image_status?: string | null
  hero_image_file_id?: string | null
}): Promise<{
  content_id: string
  compliance_result: { status: string; notes?: string[]; error?: string }
}> {
  const {
    brand_id, content_type, content, platform, audience, source, actor,
    hero_image_url = null, hero_image_status = null, hero_image_file_id = null,
  } = input

  // Guard: brand_id must be a TEXT slug, never a UUID
  if (UUID_PATTERN.test(brand_id)) {
    throw new Error(
      `writeContentToQueue: brand_id must be a TEXT slug (e.g. 'plasmaide'), not a UUID. Got: ${brand_id}`
    )
  }

  const supabase = createAdminClient()

  // INSERT — audience always written (even null) to prevent column drift
  const { data, error } = await supabase
    .from('content_queue')
    .insert({
      brand_id,
      content_type,
      status: 'pending',
      platform,
      content,
      compliance_result: { status: 'pending', notes: [] },
      audience,
      hero_image_url,
      hero_image_status,
      hero_image_file_id,
    })
    .select('id')
    .single()

  if (error) throw new Error(`writeContentToQueue: INSERT failed — ${error.message}`)
  if (!data) throw new Error('writeContentToQueue: INSERT returned no row')

  const content_id = data.id as string

  // Audit log — non-throwing: observability only
  const actorStr = actor ?? (source === 'cron' ? 'system' : source === 'agent_strategy' ? 'agent' : 'user')
  try {
    await supabase.from('audit_log').insert({
      brand_id,
      agent: 'content_studio',
      action: 'content_created',
      tokens_in: 0,
      tokens_out: 0,
      status: 'success',
      input_summary: `source=${source} content_type=${content_type} platform=${platform} actor=${actorStr}`.slice(0, 500),
      output_summary: `content_id=${content_id}`.slice(0, 500),
    })
  } catch (auditErr) {
    console.warn('[queue-writer] audit_log write failed (non-fatal):', auditErr)
  }

  // Compliance — always synchronous, always awaited.
  // Fire-and-forget was killed: Vercel terminates serverless functions before
  // orphaned TCP connections complete, so async compliance never ran in practice.
  const complianceUrl = `${getInternalBaseUrl()}/api/agents/compliance/check`
  try {
    const res = await fetch(complianceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id }),
    })

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>

    // Agent disabled for this brand — not an error, just skip
    if (json.disabled) {
      return { content_id, compliance_result: { status: 'skipped' } }
    }

    if (!res.ok) {
      throw new Error(`compliance HTTP ${res.status}: ${String(json.error ?? 'unknown')}`)
    }

    const result = json.result as Record<string, unknown> | undefined
    const status = (result?.overall_status as string) ?? 'pending'
    return { content_id, compliance_result: { status } }
  } catch (compErr) {
    const errMsg = compErr instanceof Error ? compErr.message : String(compErr)
    console.error('[queue-writer] compliance check failed:', { brand_id, content_id, error: errMsg })

    // Compliance route never ran — write errored state directly
    const { error: updateErr } = await supabase
      .from('content_queue')
      .update({ compliance_status: 'errored' })
      .eq('id', content_id)
    if (updateErr) {
      console.error('[queue-writer] failed to persist errored compliance_status:', updateErr.message)
    }

    return { content_id, compliance_result: { status: 'errored', error: errMsg } }
  }
}
