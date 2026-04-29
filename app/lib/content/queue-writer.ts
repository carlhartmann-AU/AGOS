// lib/content/queue-writer.ts
// CANONICAL write path for content_queue INSERTs.
// All three callers MUST use this helper — direct inserts in route files are banned.
//
// Callers:
//   1. app/app/api/content/generate/route.ts   (source: 'user_generation', runComplianceSync: false)
//   2. app/app/api/agents/content-strategy/route.ts (source: 'agent_strategy', runComplianceSync: true)
//   3. app/app/api/cron/generate-content/route.ts   (source: 'cron', runComplianceSync: false)

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
  runComplianceSync: boolean
  hero_image_url?: string | null
  hero_image_status?: string | null
  hero_image_file_id?: string | null
}): Promise<{
  content_id: string
  compliance_result: { status: string; notes?: string[] }
}> {
  const {
    brand_id, content_type, content, platform, audience, source, actor, runComplianceSync,
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

  // Compliance
  const complianceUrl = `${getInternalBaseUrl()}/api/agents/compliance/check`
  const complianceBody = JSON.stringify({ content_id })

  if (runComplianceSync) {
    try {
      const res = await fetch(complianceUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: complianceBody,
      })
      const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
      const result = json.result as Record<string, unknown> | undefined
      const status = (result?.overall_status as string) ?? 'pending'
      return { content_id, compliance_result: { status } }
    } catch (compErr) {
      console.error('[queue-writer] sync compliance check failed:', compErr)
      return { content_id, compliance_result: { status: 'pending', notes: ['compliance_check_failed'] } }
    }
  } else {
    fetch(complianceUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: complianceBody,
    }).catch((err) => console.error('[queue-writer] async compliance trigger failed:', err))

    return { content_id, compliance_result: { status: 'pending', notes: [] } }
  }
}
