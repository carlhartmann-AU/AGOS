import type { SupabaseClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import type {
  UnitEconomics, BudgetVsActual, BudgetLine,
  CashForecast, MarginAlert, CFOReport, CFORecommendation,
} from './types'
import { getCurrentFiscalYear } from '@/lib/utils/fiscal-year'
import type { FYConfig } from '@/types'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function n(v: unknown): number | null {
  const x = Number(v)
  return isFinite(x) ? x : null
}

function safeDiv(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null
  return a / b
}

const PRICING: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00 },
  'claude-sonnet-4-6':         { input: 3.00, output: 15.00 },
}

// ─── Data gathering ───────────────────────────────────────────────────────────

type PLRow = { period: string; data: Record<string, number> }
type CFRow = { period: string; data: Record<string, number> }

async function loadSnapshots(
  supabase: SupabaseClient,
  brandId: string,
  fiscalYear: string,
  types: string[],
): Promise<Record<string, unknown[]>> {
  const { data, error } = await supabase
    .from('financial_snapshots')
    .select('report_type, period, snapshot_date, data')
    .eq('brand_id', brandId)
    .eq('fiscal_year', fiscalYear)
    .in('report_type', types)
    .order('snapshot_date', { ascending: true })

  if (error) {
    console.error('[cfo/engine] loadSnapshots error:', error)
    return Object.fromEntries(types.map(t => [t, []]))
  }

  const grouped: Record<string, unknown[]> = Object.fromEntries(types.map(t => [t, []]))
  for (const row of (data ?? [])) grouped[row.report_type]?.push(row)
  return grouped
}

async function loadBudgets(
  supabase: SupabaseClient,
  brandId: string,
  fiscalYear: string,
): Promise<Record<string, number>> {
  const { data, error } = await supabase
    .from('financial_budgets')
    .select('metric, target')
    .eq('brand_id', brandId)
    .eq('fiscal_year', fiscalYear)

  if (error || !data) return {}
  return Object.fromEntries(data.map(r => [r.metric, Number(r.target)]))
}

async function loadDrivers(
  supabase: SupabaseClient,
  brandId: string,
): Promise<Record<string, { value: number }>> {
  const { data } = await supabase
    .from('financial_snapshots')
    .select('data')
    .eq('brand_id', brandId)
    .eq('report_type', 'drivers')
    .single()

  return (data?.data as Record<string, { value: number }>) ?? {}
}

// ─── Unit economics ───────────────────────────────────────────────────────────

function computeUnitEconomics(
  plRows: PLRow[],
  drivers: Record<string, { value: number }>,
): UnitEconomics {
  const notes: string[] = []

  // Actuals from model
  const adSpend = plRows.reduce((s, r) => s + (r.data.performance_marketing ?? 0), 0)
  const revenue = plRows.reduce((s, r) => s + (r.data.total_revenue ?? 0), 0)
  const grossProfit = plRows.reduce((s, r) => s + (r.data.gross_profit ?? 0), 0)
  const grossMarginPct = revenue > 0 ? grossProfit / revenue : null

  // Drivers
  const aovDriver = n(drivers['DTC Average Order Value (AOV)']?.value) ?? 126
  const cacDriver = n(drivers['DTC Customer Acquisition Cost (CAC)']?.value) ?? 40
  const subSplit = n(drivers['Subscription Split (% of New Customers)']?.value) ?? 0.4
  const churnRate = n(drivers['Monthly Subscription Churn Rate']?.value) ?? 0.1
  const repeatRate = n(drivers['One-off Repeat Purchase Rate (monthly)']?.value) ?? 0.05

  // New customers estimate: ad_spend / cac_driver
  const newCustomers = cacDriver > 0 ? adSpend / cacDriver : null
  const cac = safeDiv(adSpend || null, newCustomers)

  // LTV = AOV * weighted_avg_orders * gross_margin
  // Sub customers: avg orders = 1/churn; One-off: avg orders = 1 + repeat/(1-repeat)
  const subOrders = churnRate > 0 ? 1 / churnRate : 10
  const oneOffOrders = repeatRate < 1 ? 1 + repeatRate / (1 - repeatRate) : 2
  const avgOrders = subSplit * subOrders + (1 - subSplit) * oneOffOrders
  const ltv = grossMarginPct != null
    ? aovDriver * avgOrders * grossMarginPct
    : aovDriver * avgOrders * 0.65

  const ltvCacRatio = safeDiv(ltv, cac)
  const paybackMonths = cac != null && grossMarginPct != null && grossMarginPct > 0
    ? cac / (aovDriver * grossMarginPct)
    : null
  const roas = safeDiv(revenue || null, adSpend || null)

  if (plRows.length < 3) notes.push('Unit economics based on limited months of data')
  if (adSpend === 0) notes.push('No performance marketing spend in model for this period')

  // Health assessment
  let health: UnitEconomics['health'] = 'healthy'
  if (ltvCacRatio != null && ltvCacRatio < 2) health = 'critical'
  else if (ltvCacRatio != null && ltvCacRatio < 3) health = 'warning'
  else if (roas != null && roas < 2 && health === 'healthy') health = 'warning'

  return {
    cac: cac ?? (adSpend > 0 ? cacDriver : null),
    ltv,
    ltv_cac_ratio: ltvCacRatio,
    aov: aovDriver,
    payback_months: paybackMonths,
    roas,
    gross_margin_pct: grossMarginPct,
    ad_spend: adSpend > 0 ? adSpend : null,
    revenue: revenue > 0 ? revenue : null,
    health,
    notes,
  }
}

// ─── Budget vs actual ─────────────────────────────────────────────────────────

const BUDGET_LABELS: Record<string, string> = {
  revenue:          'Revenue',
  gross_profit:     'Gross Profit',
  gross_margin_pct: 'Gross Margin %',
  ebitda:           'EBITDA',
  net_income:       'Net Income',
  ad_spend:         'Ad Spend',
  closing_cash:     'Closing Cash',
}

function computeBudgetVsActual(
  fiscalYear: string,
  plRows: PLRow[],
  cfRows: CFRow[],
  budgets: Record<string, number>,
): BudgetVsActual {
  const actual: Record<string, number | null> = {
    revenue:          plRows.reduce((s, r) => s + (r.data.total_revenue ?? 0), 0) || null,
    gross_profit:     plRows.reduce((s, r) => s + (r.data.gross_profit ?? 0), 0) || null,
    gross_margin_pct: plRows.length > 0
      ? plRows[plRows.length - 1].data.gross_margin_pct ?? null
      : null,
    ebitda:           plRows.reduce((s, r) => s + (r.data.ebitda ?? 0), 0) || null,
    net_income:       plRows.reduce((s, r) => s + (r.data.net_income ?? 0), 0) || null,
    ad_spend:         plRows.reduce((s, r) => s + (r.data.performance_marketing ?? 0), 0) || null,
    closing_cash:     cfRows.length > 0
      ? cfRows[cfRows.length - 1].data.closing_cash ?? null
      : null,
  }

  const lines: BudgetLine[] = Object.keys(BUDGET_LABELS).map(metric => {
    const target = budgets[metric] ?? null
    const act = actual[metric] ?? null

    let variance: number | null = null
    let variance_pct: number | null = null
    let status: BudgetLine['status'] = 'no_data'

    if (target != null && act != null) {
      variance = act - target
      variance_pct = target !== 0 ? (variance / Math.abs(target)) * 100 : null
      const isExpense = metric === 'ad_spend'
      const positive = isExpense ? variance <= 0 : variance >= 0
      if (variance_pct != null && Math.abs(variance_pct) <= 5) status = 'on_track'
      else status = positive ? 'ahead' : 'behind'
    } else if (target == null) {
      status = 'no_data'
    }

    return {
      metric,
      label: BUDGET_LABELS[metric],
      target: target ?? 0,
      actual: act,
      variance,
      variance_pct,
      status,
    }
  })

  const revLine = lines.find(l => l.metric === 'revenue')
  const ytdRevenuePct = revLine?.actual != null && revLine.target > 0
    ? (revLine.actual / revLine.target) * 100
    : null

  return { fiscal_year: fiscalYear, lines, ytd_revenue_pct: ytdRevenuePct }
}

// ─── Cash forecast ────────────────────────────────────────────────────────────

function computeCashForecast(cfRows: CFRow[], drivers: Record<string, { value: number }>): CashForecast {
  if (cfRows.length === 0) {
    return {
      latest_closing_cash: n(drivers['Opening Cash Balance']?.value),
      month_label: null,
      avg_monthly_net: null,
      runway_months: null,
      trend: 'unknown',
    }
  }

  const last = cfRows[cfRows.length - 1]
  // Use net_income as proxy since model cash fields are 0 (opening balance issue)
  const monthlyNets = cfRows.map(r => {
    const op = r.data.net_cash_operating ?? 0
    const inv = r.data.net_cash_investing ?? 0
    const fin = r.data.net_cash_financing ?? 0
    const net = op + inv + fin
    // Fall back to net_income if all cash fields are 0
    return net !== 0 ? net : (r.data.net_income ?? 0)
  })

  const avgMonthlyNet = monthlyNets.reduce((s, v) => s + v, 0) / monthlyNets.length

  // Estimate cash position: opening balance + cumulative net flows
  const openingCash = n(drivers['Opening Cash Balance']?.value) ?? 100000
  const cumulative = monthlyNets.reduce((s, v) => s + v, openingCash)
  const latestCash = cumulative

  const runwayMonths = avgMonthlyNet < 0 && latestCash > 0
    ? Math.round(latestCash / Math.abs(avgMonthlyNet))
    : null

  const recentTrend = monthlyNets.length >= 3
    ? monthlyNets.slice(-3)
    : monthlyNets

  let trend: CashForecast['trend'] = 'stable'
  if (recentTrend.length >= 2) {
    const first = recentTrend[0]
    const lastV = recentTrend[recentTrend.length - 1]
    if (lastV > first * 1.1) trend = 'improving'
    else if (lastV < first * 0.9) trend = 'declining'
  }

  return {
    latest_closing_cash: latestCash,
    month_label: last.period,
    avg_monthly_net: avgMonthlyNet,
    runway_months: runwayMonths,
    trend,
  }
}

// ─── Margin alerts ────────────────────────────────────────────────────────────

function computeMarginAlerts(
  ue: UnitEconomics,
  bva: BudgetVsActual,
  cash: CashForecast,
): MarginAlert[] {
  const alerts: MarginAlert[] = []

  if (ue.gross_margin_pct != null && ue.gross_margin_pct < 0.55) {
    alerts.push({
      type: 'low_gross_margin',
      severity: ue.gross_margin_pct < 0.45 ? 'high' : 'medium',
      title: 'Gross Margin Below Threshold',
      description: `Gross margin at ${(ue.gross_margin_pct * 100).toFixed(1)}% vs 55% target`,
      value: ue.gross_margin_pct * 100,
      threshold: 55,
    })
  }

  if (ue.ltv_cac_ratio != null && ue.ltv_cac_ratio < 3) {
    alerts.push({
      type: 'low_ltv_cac',
      severity: ue.ltv_cac_ratio < 2 ? 'high' : 'medium',
      title: 'LTV:CAC Below 3x',
      description: `LTV:CAC ratio at ${ue.ltv_cac_ratio.toFixed(1)}x — sustainable growth requires 3x+`,
      value: ue.ltv_cac_ratio,
      threshold: 3,
    })
  }

  if (ue.roas != null && ue.roas < 2) {
    alerts.push({
      type: 'low_roas',
      severity: ue.roas < 1 ? 'high' : 'medium',
      title: 'ROAS Below 2x',
      description: `Return on ad spend at ${ue.roas.toFixed(1)}x — minimum viable ROAS is 2x`,
      value: ue.roas,
      threshold: 2,
    })
  }

  if (cash.runway_months != null && cash.runway_months < 6) {
    alerts.push({
      type: 'low_runway',
      severity: cash.runway_months < 3 ? 'high' : 'medium',
      title: 'Cash Runway Warning',
      description: `Estimated ${cash.runway_months} months cash runway at current burn rate`,
      value: cash.runway_months,
      threshold: 6,
    })
  }

  const revLine = bva.lines.find(l => l.metric === 'revenue')
  if (revLine?.status === 'behind' && revLine.variance_pct != null && revLine.variance_pct < -15) {
    alerts.push({
      type: 'revenue_behind_budget',
      severity: revLine.variance_pct < -25 ? 'high' : 'medium',
      title: 'Revenue Behind Budget',
      description: `Revenue ${revLine.variance_pct.toFixed(1)}% behind FY budget target`,
      value: revLine.variance_pct,
      threshold: -15,
    })
  }

  return alerts.sort((a, b) => {
    const ord = { high: 0, medium: 1, low: 2 }
    return ord[a.severity] - ord[b.severity]
  })
}

// ─── Narrator ─────────────────────────────────────────────────────────────────

async function runNarrator(
  ue: UnitEconomics,
  bva: BudgetVsActual,
  cash: CashForecast,
  alerts: MarginAlert[],
): Promise<{
  narrative: string
  recommendations: CFORecommendation[]
  tokens: { input: number; output: number }
  cost_usd: number
  model_used: string
}> {
  const model = 'claude-sonnet-4-6'
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  const prompt = `You are CFO Analyst for a DTC supplement brand. Analyse the financial metrics below and produce a concise executive summary.

UNIT ECONOMICS:
${JSON.stringify(ue, null, 2)}

BUDGET VS ACTUAL:
${JSON.stringify(bva, null, 2)}

CASH FORECAST:
${JSON.stringify(cash, null, 2)}

ALERTS:
${JSON.stringify(alerts, null, 2)}

Respond ONLY with valid JSON — no markdown, no commentary:
{
  "narrative": "<3-4 sentence executive summary with actual numbers>",
  "recommendations": [
    {
      "priority": "high|medium|low",
      "category": "unit_economics|cash|budget|margin|operations",
      "title": "<short title>",
      "description": "<1-2 sentences referencing specific data>",
      "suggested_action": "<concrete next action>"
    }
  ]
}
Rules: 3-5 recommendations ordered by priority. Reference specific figures.`

  const response = await anthropic.messages.create({
    model,
    max_tokens: 1500,
    messages: [{ role: 'user', content: prompt }],
  })

  const textBlock = response.content.find(b => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text from narrator')

  const cleaned = textBlock.text.replace(/```json|```/g, '').trim()
  const match = cleaned.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse CFO narrator response')

  const parsed = JSON.parse(match[0])
  const tokens = { input: response.usage.input_tokens, output: response.usage.output_tokens }
  const p = PRICING[model]
  const cost_usd = p
    ? (tokens.input / 1_000_000) * p.input + (tokens.output / 1_000_000) * p.output
    : 0

  return {
    narrative: typeof parsed.narrative === 'string' ? parsed.narrative : '',
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    tokens,
    cost_usd,
    model_used: model,
  }
}

// ─── Main engine ──────────────────────────────────────────────────────────────

export async function runCFOAnalysis(
  supabase: SupabaseClient,
  brandId: string,
  windowStart: string,
  windowEnd: string,
  triggeredBy: string,
): Promise<CFOReport> {
  // 1. Load fy_config
  const { data: bsRow } = await supabase
    .from('brand_settings')
    .select('fy_config')
    .eq('brand_id', brandId)
    .single()

  const fyConfig: FYConfig = (bsRow?.fy_config as FYConfig) ?? { type: 'au', start_month: 7, start_day: 1, end_month: 6, end_day: 30 }
  const fiscalYear = getCurrentFiscalYear(fyConfig)

  // 2. Load data in parallel
  const [snapshots, budgets, drivers] = await Promise.all([
    loadSnapshots(supabase, brandId, fiscalYear, ['pl_monthly', 'cf_monthly']),
    loadBudgets(supabase, brandId, fiscalYear),
    loadDrivers(supabase, brandId),
  ])

  // Filter snapshots to window
  const plRows = (snapshots['pl_monthly'] as PLRow[]).filter(r => {
    return r.period >= windowStart.slice(0, 7).replace('-', '') || true // include all FY rows
  })
  const cfRows = snapshots['cf_monthly'] as CFRow[]

  // 3. Compute analytics
  const unitEconomics = computeUnitEconomics(plRows, drivers)
  const budgetVsActual = computeBudgetVsActual(fiscalYear, plRows, cfRows, budgets)
  const cashForecast = computeCashForecast(cfRows, drivers)
  const marginAlerts = computeMarginAlerts(unitEconomics, budgetVsActual, cashForecast)

  // 4. Optional narrator
  let narrative: string | null = null
  let recommendations: CFORecommendation[] = []
  let tokensUsed = 0
  let costUsd = 0
  let modelUsed: string | null = null

  if (process.env.ANTHROPIC_API_KEY && plRows.length > 0) {
    try {
      const narResult = await runNarrator(unitEconomics, budgetVsActual, cashForecast, marginAlerts)
      narrative = narResult.narrative
      recommendations = narResult.recommendations
      tokensUsed = narResult.tokens.input + narResult.tokens.output
      costUsd = narResult.cost_usd
      modelUsed = narResult.model_used
    } catch (err) {
      console.error('[cfo/engine] narrator failed, continuing data-only:', err)
    }
  }

  // 5. Persist
  const { data: inserted } = await supabase
    .from('cfo_reports')
    .insert({
      brand_id: brandId,
      fiscal_year: fiscalYear,
      window_start: windowStart,
      window_end: windowEnd,
      triggered_by: triggeredBy,
      unit_economics: unitEconomics,
      budget_vs_actual: budgetVsActual,
      cash_forecast: cashForecast,
      margin_alerts: marginAlerts,
      narrative,
      recommendations,
      tokens_used: tokensUsed,
      cost_usd: costUsd,
      model_used: modelUsed,
    })
    .select('id, created_at')
    .single()

  return {
    id: inserted?.id,
    brand_id: brandId,
    fiscal_year: fiscalYear,
    window_start: windowStart,
    window_end: windowEnd,
    triggered_by: triggeredBy,
    unit_economics: unitEconomics,
    budget_vs_actual: budgetVsActual,
    cash_forecast: cashForecast,
    margin_alerts: marginAlerts,
    narrative,
    recommendations,
    tokens_used: tokensUsed,
    cost_usd: costUsd,
    model_used: modelUsed,
    created_at: inserted?.created_at,
  }
}
