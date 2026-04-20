// lib/agents/intelligence/gatherers/revenue.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { RevenueSummary } from '../types'

type DailyRow = {
  date: string
  revenue: number
  orders: number
  aov: number
  new_customers: number
  returning_customers: number
  source_currency: string
  fx_rates: Record<string, number> | null
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

function convertRevenue(revenue: number, sourceCurrency: string, displayCurrency: string, fxRates: Record<string, number> | null): number {
  if (!fxRates || sourceCurrency === displayCurrency) return revenue
  const rate = fxRates[displayCurrency.toUpperCase()]
  return rate ? revenue * rate : revenue
}

function pctChange(current: number, prior: number): number {
  if (prior === 0) return 0
  return Math.round(((current - prior) / prior) * 100 * 10) / 10
}

function summarise(rows: DailyRow[], displayCurrency: string): {
  total_revenue: number; total_orders: number; avg_aov: number
  new_customers: number; returning_customers: number
  daily: RevenueSummary['daily']
  best_day: RevenueSummary['best_day']
  worst_day: RevenueSummary['worst_day']
} {
  if (rows.length === 0) {
    return {
      total_revenue: 0, total_orders: 0, avg_aov: 0,
      new_customers: 0, returning_customers: 0,
      daily: [],
      best_day: { date: '', revenue: 0, orders: 0 },
      worst_day: { date: '', revenue: 0, orders: 0 },
    }
  }

  let total_revenue = 0, total_orders = 0, new_customers = 0, returning_customers = 0
  const daily: RevenueSummary['daily'] = []

  for (const r of rows) {
    const rev = convertRevenue(Number(r.revenue), r.source_currency ?? 'GBP', displayCurrency, r.fx_rates)
    total_revenue += rev
    total_orders += r.orders
    new_customers += r.new_customers ?? 0
    returning_customers += r.returning_customers ?? 0
    daily.push({
      date: r.date,
      revenue: Math.round(rev * 100) / 100,
      orders: r.orders,
      aov: total_orders > 0 ? Math.round((rev / (r.orders || 1)) * 100) / 100 : 0,
      new_customers: r.new_customers ?? 0,
    })
  }

  const avg_aov = total_orders > 0 ? Math.round((total_revenue / total_orders) * 100) / 100 : 0

  const withRevenue = daily.filter(d => d.revenue > 0)
  const best_day = withRevenue.length > 0
    ? withRevenue.reduce((a, b) => a.revenue >= b.revenue ? a : b)
    : daily[0] ?? { date: '', revenue: 0, orders: 0 }
  const worst_day = withRevenue.length > 0
    ? withRevenue.reduce((a, b) => a.revenue <= b.revenue ? a : b)
    : daily[0] ?? { date: '', revenue: 0, orders: 0 }

  return { total_revenue: Math.round(total_revenue * 100) / 100, total_orders, avg_aov, new_customers, returning_customers, daily, best_day, worst_day }
}

export async function gatherRevenue(
  supabase: SupabaseClient,
  brandId: string,
  windowStart: string,
  windowEnd: string
): Promise<RevenueSummary> {
  // Get display currency
  const { data: settings } = await supabase
    .from('brand_settings')
    .select('display_currency')
    .eq('brand_id', brandId)
    .single()
  const displayCurrency: string = (settings?.display_currency as string | null) ?? 'GBP'

  const prior = shiftWindow(windowStart, windowEnd)

  // Fetch current + prior windows in parallel
  const [currentRes, priorRes] = await Promise.all([
    supabase.rpc('get_daily_summary', { p_brand_id: brandId, p_start: windowStart, p_end: windowEnd }),
    supabase.rpc('get_daily_summary', { p_brand_id: brandId, p_start: prior.start, p_end: prior.end }),
  ])

  const currentRows = (currentRes.data ?? []) as DailyRow[]
  const priorRows = (priorRes.data ?? []) as DailyRow[]

  const current = summarise(currentRows, displayCurrency)
  const priorSummary = summarise(priorRows, displayCurrency)

  return {
    period: { start: windowStart, end: windowEnd },
    display_currency: displayCurrency,
    total_revenue: current.total_revenue,
    total_orders: current.total_orders,
    avg_aov: current.avg_aov,
    new_customers: current.new_customers,
    returning_customers: current.returning_customers,
    prior_revenue: priorSummary.total_revenue,
    prior_orders: priorSummary.total_orders,
    prior_aov: priorSummary.avg_aov,
    revenue_wow_pct: pctChange(current.total_revenue, priorSummary.total_revenue),
    orders_wow_pct: pctChange(current.total_orders, priorSummary.total_orders),
    aov_wow_pct: pctChange(current.avg_aov, priorSummary.avg_aov),
    daily: current.daily,
    best_day: current.best_day,
    worst_day: current.worst_day,
  }
}
