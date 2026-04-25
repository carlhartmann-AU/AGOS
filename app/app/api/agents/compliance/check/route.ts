// app/api/agents/compliance/check/route.ts
// POST /api/agents/compliance/check — runs compliance on a content_queue item.
// This is a THIN adapter. All real logic lives in lib/agents/compliance/engine.ts.

import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

import { runCompliance, calculateResultCost } from '@/lib/agents/compliance/engine'
import { getAgentConfig } from '@/lib/llm/provider'
import type {
  ComplianceCheckRequest,
  ComplianceCheckResponse,
  ComplianceConfig,
  ContentItem,
  RulePack,
} from '@/types/compliance'

// Force dynamic — we use service role key, don't want any caching
export const dynamic = 'force-dynamic'
export const maxDuration = 60 // seconds — requires Vercel Pro for > 10

function admin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  )
}

// Default config applied when brand hasn't configured compliance yet.
// Opt-in: disabled by default so turning it on is an explicit choice.
const DEFAULT_CONFIG: ComplianceConfig = {
  enabled: false,
  rule_packs: [],
  custom_rules: [],
  severity_actions: {
    minor: 'auto_fix',
    major: 'escalate',
    critical: 'block',
  },
}

export async function POST(req: NextRequest): Promise<NextResponse<ComplianceCheckResponse>> {
  try {
    const body = (await req.json()) as ComplianceCheckRequest
    if (!body.content_id) {
      return NextResponse.json(
        { success: false, error: 'content_id required' },
        { status: 400 }
      )
    }

    const supabase = admin()

    // 1. Load content
    const { data: contentRow, error: contentErr } = await supabase
      .from('content_queue')
      .select('id, brand_id, content, content_type, compliance_status')
      .eq('id', body.content_id)
      .single()

    if (contentErr || !contentRow) {
      return NextResponse.json(
        { success: false, error: `Content not found: ${contentErr?.message}` },
        { status: 404 }
      )
    }

    // Check agent_config — respect enabled flag and model override
    const agentCfg = await getAgentConfig(contentRow.brand_id, 'compliance')
    if (!agentCfg.enabled) {
      return NextResponse.json(
        { success: false, disabled: true, message: `Agent compliance disabled for brand ${contentRow.brand_id}` },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    // Skip if already checked and not forced
    if (!body.force && contentRow.compliance_status && contentRow.compliance_status !== 'pending') {
      return NextResponse.json(
        { success: false, error: `Already checked (status: ${contentRow.compliance_status}). Pass force=true to re-run.` },
        { status: 409 }
      )
    }

    // 2. Load brand compliance config + brand profile
    const { data: brandRow, error: brandErr } = await supabase
      .from('brand_settings')
      .select('id, compliance, brand_profile')
      .eq('brand_id', contentRow.brand_id)
      .single()

    if (brandErr || !brandRow) {
      return NextResponse.json(
        { success: false, error: `Brand not found: ${brandErr?.message}` },
        { status: 404 }
      )
    }

    const brandCompliance = (brandRow.compliance ?? {}) as Partial<ComplianceConfig>
    const config: ComplianceConfig = {
      ...DEFAULT_CONFIG,
      ...brandCompliance,
      llm_config: {
        fast: brandCompliance.llm_config?.fast ?? 'claude-haiku-4-5-20251001',
        accurate: agentCfg.model,
        premium: brandCompliance.llm_config?.premium ?? 'claude-opus-4-7',
      },
    }

    // 3. Build rule pack fetcher — caches across the request
    const packCache = new Map<string, RulePack | null>()
    const getRulePack = async (packId: string): Promise<RulePack | null> => {
      if (packCache.has(packId)) return packCache.get(packId)!
      const { data } = await supabase
        .from('rule_packs')
        .select('*')
        .eq('id', packId)
        .eq('is_active', true)
        .maybeSingle()
      const pack = data as RulePack | null
      packCache.set(packId, pack)
      return pack
    }

    // 4. Run the engine
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
    const result = await runCompliance(
      contentRow.content as ContentItem,
      config,
      {
        anthropic,
        getRulePack,
        brandProfile: (brandRow.brand_profile ?? {}) as Record<string, unknown>,
      },
      { content_id: contentRow.id, brand_id: contentRow.brand_id, content_type: contentRow.content_type as string }
    )

    // 5. Persist audit trail
    const estimated_cost_usd = calculateResultCost(result)

    const { data: checkRow, error: insertErr } = await supabase
      .from('compliance_checks')
      .insert({
        content_id: result.content_id,
        brand_id: result.brand_id,
        overall_status: result.overall_status,
        auto_fixes_applied: result.auto_fixes_applied,
        content_modified: result.content_modified,
        minor_count: result.issues_by_severity.minor,
        major_count: result.issues_by_severity.major,
        critical_count: result.issues_by_severity.critical,
        rule_results: result.rule_results,
        input_content: contentRow.content,
        output_content: result.content_modified ? result.final_content : null,
        tokens_input: result.total_tokens.input,
        tokens_output: result.total_tokens.output,
        duration_ms: result.duration_ms,
        estimated_cost_usd,
        rule_packs_used: config.rule_packs,
        triggered_by: body.force ? 'retry' : 'system',
      })
      .select('id')
      .single()

    if (insertErr) {
      console.error('Failed to log compliance check:', insertErr)
      // Don't fail the request — audit failure shouldn't block workflow
    }

    // 6. Update content_queue with latest check + possibly patched content
    const updates: Record<string, unknown> = {
      compliance_status: result.overall_status,
      latest_compliance_check_id: checkRow?.id ?? null,
    }
    if (result.content_modified && result.final_content) {
      updates.content = result.final_content
    }

    const { error: updateErr } = await supabase
      .from('content_queue')
      .update(updates)
      .eq('id', result.content_id)

    if (updateErr) {
      console.error('Failed to update content_queue:', updateErr)
    }

    return NextResponse.json({ success: true, result })
  } catch (err) {
    console.error('Compliance check error:', err)
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
