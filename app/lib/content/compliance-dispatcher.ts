// Compliance dispatcher — single write path for compliance
// posture per content_queue row. Enforces QA contracts 1-4
// (coverage, no-silent-skip, audit trail, retroactive
// liveness). Audit action vocabulary in AUDIT_ACTIONS export.

import { createAdminClient } from '@/lib/supabase/admin'
import type { ContentType, BrandContentConfig } from '@/lib/config/types'

export const AUDIT_ACTIONS = {
  CHECK_STARTED:         'compliance_check_started',
  CHECK_COMPLETED:       'compliance_check_completed',
  CHECK_SKIPPED:         'compliance_check_skipped',
  CHECK_ERRORED:         'compliance_check_errored',
  RETROACTIVE_STARTED:   'compliance_retroactive_started',
  RETROACTIVE_COMPLETED: 'compliance_retroactive_completed',
} as const

export type ComplianceStatus =
  | 'passed'
  | 'passed_with_warnings'
  | 'warnings'             // legacy engine value; dispatcher normalises to passed_with_warnings
  | 'escalated'            // engine escalation requiring human review
  | 'blocked'
  | 'skipped'              // legacy pre-dispatcher skip
  | 'errored'
  | 'skipped_by_config'
  | 'skipped_by_error'
  | 'pending'
  | 'pending_async'
  | 'legacy_unverified'
  | 'pending_retroactive'

export type DispatchMode = 'sync' | 'async' | 'retroactive'

export interface DispatchInput {
  contentId: string
  brandId: string
  contentType: ContentType
  // content payload passed for future async/retroactive modes; sync mode passes only content_id
  content: object
  contentConfig: BrandContentConfig
  mode?: DispatchMode
}

export interface DispatchResult {
  compliance_status: ComplianceStatus
  compliance_check_id: string | null  // null in sync mode — route writes it directly to content_queue
  compliance_result: object | null
  duration_ms: number
}

class NotYetImplementedError extends Error {
  constructor(feature: string) {
    super(`Not yet implemented: ${feature}`)
    this.name = 'NotYetImplementedError'
  }
}

function getInternalBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`
  return 'http://localhost:3000'
}

function mapEngineStatus(engineStatus: string): ComplianceStatus {
  switch (engineStatus) {
    case 'passed':    return 'passed'
    case 'warnings':  return 'passed_with_warnings'
    case 'escalated': return 'escalated'
    case 'blocked':
    case 'fail':      return 'blocked'
    case 'error':     return 'errored'
    default:          return 'errored'
  }
}

async function writeAuditLog(
  supabase: ReturnType<typeof createAdminClient>,
  brandId: string,
  action: string,
  inputSummary: string,
  outputSummary: string,
  status: 'success' | 'error',
): Promise<void> {
  try {
    await supabase.from('audit_log').insert({
      brand_id: brandId,
      agent: 'compliance_dispatcher',
      action,
      tokens_in: 0,
      tokens_out: 0,
      status,
      input_summary: inputSummary.slice(0, 500),
      output_summary: outputSummary.slice(0, 500),
    })
  } catch {
    // Audit failure must never block compliance posture determination
  }
}

async function dispatchSync(input: DispatchInput): Promise<DispatchResult> {
  const started = Date.now()
  const supabase = createAdminClient()
  const { contentId, brandId, contentType, contentConfig } = input

  // Check brand_content_config.compliance_gating before hitting agent_config
  if (contentConfig.compliance_gating === 'never_block') {
    await writeAuditLog(
      supabase, brandId,
      AUDIT_ACTIONS.CHECK_SKIPPED,
      JSON.stringify({
        content_id: contentId,
        content_type: contentType,
        reason: 'config',
        config_path: 'brand_content_config.compliance_gating',
        value: 'never_block',
      }),
      'skipped — compliance_gating=never_block',
      'success',
    )
    return {
      compliance_status: 'skipped_by_config',
      compliance_check_id: null,
      compliance_result: null,
      duration_ms: Date.now() - started,
    }
  }

  // Check agent_config.enabled — a missing row defaults to enabled (getAgentConfig behaviour)
  const { data: agentRow } = await supabase
    .from('agent_config')
    .select('enabled')
    .eq('brand_id', brandId)
    .eq('agent_key', 'compliance')
    .maybeSingle()

  if (agentRow !== null && agentRow.enabled === false) {
    await writeAuditLog(
      supabase, brandId,
      AUDIT_ACTIONS.CHECK_SKIPPED,
      JSON.stringify({
        content_id: contentId,
        content_type: contentType,
        reason: 'config',
        config_path: 'agent_config.enabled',
        value: false,
      }),
      'skipped — agent_config.enabled=false',
      'success',
    )
    return {
      compliance_status: 'skipped_by_config',
      compliance_check_id: null,
      compliance_result: null,
      duration_ms: Date.now() - started,
    }
  }

  // Dispatch to compliance agent
  await writeAuditLog(
    supabase, brandId,
    AUDIT_ACTIONS.CHECK_STARTED,
    JSON.stringify({ content_id: contentId, content_type: contentType, dispatcher_mode: 'sync' }),
    'dispatching to compliance agent',
    'success',
  )

  try {
    const url = `${getInternalBaseUrl()}/api/agents/compliance/check`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: contentId }),
    })

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
    const duration_ms = Date.now() - started

    // Route returned disabled — agent was disabled between our check and the fetch
    if (json.disabled) {
      await writeAuditLog(
        supabase, brandId,
        AUDIT_ACTIONS.CHECK_SKIPPED,
        JSON.stringify({ content_id: contentId, content_type: contentType, reason: 'config', config_path: 'agent_config.enabled' }),
        'skipped — compliance route returned disabled',
        'success',
      )
      return { compliance_status: 'skipped_by_config', compliance_check_id: null, compliance_result: null, duration_ms }
    }

    if (!res.ok) {
      throw new Error(`compliance HTTP ${res.status}: ${String(json.error ?? 'unknown')}`)
    }

    const result = json.result as Record<string, unknown> | undefined
    const engineStatus = (result?.overall_status as string) ?? 'errored'
    const compliance_status = mapEngineStatus(engineStatus)

    await writeAuditLog(
      supabase, brandId,
      AUDIT_ACTIONS.CHECK_COMPLETED,
      JSON.stringify({ content_id: contentId, content_type: contentType }),
      JSON.stringify({ status: compliance_status, duration_ms }),
      'success',
    )

    return { compliance_status, compliance_check_id: null, compliance_result: result ?? null, duration_ms }
  } catch (err) {
    const duration_ms = Date.now() - started
    const errorMessage = err instanceof Error ? err.message : String(err)
    const isRecoverable = /rate[\s_]?limit|timeout|5\d\d/i.test(errorMessage)
    const classification = isRecoverable ? 'recoverable' : 'permanent'

    await writeAuditLog(
      supabase, brandId,
      AUDIT_ACTIONS.CHECK_ERRORED,
      JSON.stringify({ content_id: contentId, content_type: contentType }),
      JSON.stringify({ error_message: errorMessage.slice(0, 200), classification, duration_ms }),
      'error',
    )

    return { compliance_status: 'skipped_by_error', compliance_check_id: null, compliance_result: null, duration_ms }
  }
}

export async function dispatchCompliance(input: DispatchInput): Promise<DispatchResult> {
  const mode = input.mode ?? 'sync'
  switch (mode) {
    case 'sync':
      return dispatchSync(input)
    case 'async':
      throw new NotYetImplementedError('compliance dispatch mode: async (wires in Prompt 2)')
    case 'retroactive':
      throw new NotYetImplementedError('compliance dispatch mode: retroactive (wires in Prompt 3)')
  }
}
