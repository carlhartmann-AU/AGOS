// lib/agents/intelligence/gatherers/content.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ContentSummary } from '../types'

type ContentRow = {
  content_type: string
  status: string
  compliance_status: string | null
  created_at: string
  approved_at: string | null
  published_at: string | null
}

const APPROVED_STATUSES = new Set(['approved', 'published', 'publish_pending'])

export async function gatherContent(
  supabase: SupabaseClient,
  brandId: string,
  windowStart: string,
  windowEnd: string
): Promise<ContentSummary> {
  const { data: rows, error } = await supabase
    .from('content_queue')
    .select('content_type, status, compliance_status, created_at, approved_at, published_at')
    .eq('brand_id', brandId)
    .gte('created_at', windowStart)
    .lt('created_at', `${windowEnd}T23:59:59.999Z`)

  if (error) throw new Error(`content gatherer: ${error.message}`)

  const items = (rows ?? []) as ContentRow[]

  const total_generated = items.length
  let total_approved = 0, total_rejected = 0, total_published = 0
  let compliance_passed = 0, compliance_escalated = 0, compliance_blocked = 0
  let approve_time_sum = 0, approve_time_count = 0

  const byType: Record<string, { count: number; approved: number; published: number }> = {}

  for (const item of items) {
    const bt = byType[item.content_type] ?? { count: 0, approved: 0, published: 0 }
    bt.count++

    if (APPROVED_STATUSES.has(item.status)) { total_approved++; bt.approved++ }
    if (item.status === 'rejected') total_rejected++
    if (item.status === 'published') { total_published++; bt.published++ }

    if (item.compliance_status === 'passed' || item.compliance_status === 'warnings') compliance_passed++
    if (item.compliance_status === 'escalated') compliance_escalated++
    if (item.compliance_status === 'blocked') compliance_blocked++

    if (item.approved_at && item.created_at) {
      const diff = (new Date(item.approved_at).getTime() - new Date(item.created_at).getTime()) / 3_600_000
      if (diff >= 0) { approve_time_sum += diff; approve_time_count++ }
    }

    byType[item.content_type] = bt
  }

  const approval_denom = total_approved + total_rejected
  const approval_rate = approval_denom > 0 ? Math.round((total_approved / approval_denom) * 100 * 10) / 10 : 0
  const publish_rate = total_approved > 0 ? Math.round((total_published / total_approved) * 100 * 10) / 10 : 0
  const avg_time_to_approve_hours = approve_time_count > 0 ? Math.round((approve_time_sum / approve_time_count) * 10) / 10 : 0
  const compliance_total = compliance_passed + compliance_escalated + compliance_blocked
  const compliance_pass_rate = compliance_total > 0 ? Math.round((compliance_passed / compliance_total) * 100 * 10) / 10 : 0

  return {
    period: { start: windowStart, end: windowEnd },
    total_generated,
    total_approved,
    total_rejected,
    total_published,
    approval_rate,
    publish_rate,
    avg_time_to_approve_hours,
    by_type: Object.entries(byType).map(([content_type, v]) => ({ content_type, ...v })),
    compliance_pass_rate,
    compliance_escalated,
    compliance_blocked,
  }
}
