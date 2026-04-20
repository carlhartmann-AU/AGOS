// lib/agents/intelligence/gatherers/compliance.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ComplianceSummary } from '../types'
import type { RuleResult } from '@/types/compliance'

type CheckRow = {
  overall_status: string
  rule_results: RuleResult[]
  auto_fixes_applied: number
  tokens_input: number
  tokens_output: number
  estimated_cost_usd: number
  created_at: string
}

function shiftWindow(start: string, end: string): { start: string; end: string } {
  const s = new Date(start)
  const e = new Date(end)
  const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1
  const ps = new Date(s); ps.setDate(ps.getDate() - days)
  const pe = new Date(e); pe.setDate(pe.getDate() - days)
  return {
    start: ps.toISOString().slice(0, 10),
    end: pe.toISOString().slice(0, 10),
  }
}

async function fetchChecks(supabase: SupabaseClient, brandId: string, start: string, end: string): Promise<CheckRow[]> {
  const { data, error } = await supabase
    .from('compliance_checks')
    .select('overall_status, rule_results, auto_fixes_applied, tokens_input, tokens_output, estimated_cost_usd, created_at')
    .eq('brand_id', brandId)
    .gte('created_at', start)
    .lt('created_at', `${end}T23:59:59.999Z`)

  if (error) throw new Error(`compliance gatherer: ${error.message}`)
  return (data ?? []) as CheckRow[]
}

function passRate(rows: CheckRow[]): number {
  if (rows.length === 0) return 0
  const passed = rows.filter(r => r.overall_status === 'passed' || r.overall_status === 'warnings').length
  return Math.round((passed / rows.length) * 100 * 10) / 10
}

export async function gatherCompliance(
  supabase: SupabaseClient,
  brandId: string,
  windowStart: string,
  windowEnd: string
): Promise<ComplianceSummary> {
  const prior = shiftWindow(windowStart, windowEnd)
  const [rows, priorRows] = await Promise.all([
    fetchChecks(supabase, brandId, windowStart, windowEnd),
    fetchChecks(supabase, brandId, prior.start, prior.end),
  ])

  let pass_count = 0, warnings_count = 0, escalated_count = 0, blocked_count = 0
  let auto_fixes_applied = 0
  let tokens_input = 0, tokens_output = 0, total_cost_usd = 0

  const ruleCounts: Record<string, { rule_name: string; count: number; severity: string }> = {}

  for (const row of rows) {
    if (row.overall_status === 'passed') pass_count++
    else if (row.overall_status === 'warnings') warnings_count++
    else if (row.overall_status === 'escalated') escalated_count++
    else if (row.overall_status === 'blocked') blocked_count++

    auto_fixes_applied += row.auto_fixes_applied ?? 0
    tokens_input += row.tokens_input ?? 0
    tokens_output += row.tokens_output ?? 0
    total_cost_usd += Number(row.estimated_cost_usd ?? 0)

    for (const rr of (row.rule_results ?? []) as RuleResult[]) {
      if (!rr.passed) {
        const entry = ruleCounts[rr.rule_id] ?? { rule_name: rr.rule_name, count: 0, severity: rr.severity }
        entry.count++
        ruleCounts[rr.rule_id] = entry
      }
    }
  }

  const prior_pass_rate = passRate(priorRows)
  const current_pass_rate = passRate(rows)

  const top_triggered_rules = Object.entries(ruleCounts)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([rule_id, v]) => ({ rule_id, rule_name: v.rule_name, trigger_count: v.count, severity: v.severity }))

  return {
    period: { start: windowStart, end: windowEnd },
    total_checks: rows.length,
    pass_count,
    warnings_count,
    escalated_count,
    blocked_count,
    auto_fixes_applied,
    pass_rate: current_pass_rate,
    total_tokens: { input: tokens_input, output: tokens_output },
    total_cost_usd: Math.round(total_cost_usd * 1_000_000) / 1_000_000,
    top_triggered_rules,
    prior_pass_rate,
    pass_rate_delta: Math.round((current_pass_rate - prior_pass_rate) * 10) / 10,
  }
}
