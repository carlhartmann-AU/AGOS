// lib/triple-whale/kpis.ts
// Read path: aggregate cached daily rows into KPIs + convert to display currency.

import type { SupabaseClient } from '@supabase/supabase-js'
import { convertAmount } from './fx'

export type WindowKey = '24h' | '7d' | '30d' | 'mtd'

export interface KPIResult {
  window: WindowKey
  range: { start: string; end: string }
  display_currency: string
  revenue: number
  orders: number
  aov: number
  new_customers: number
  returning_customers: number
  daily: Array<{
    date: string
    revenue: number
    orders: number
    source_currency: string
  }>
  last_synced_at: string | null
  days_cached: number
  days_expected: number
}

/**
 * Resolve a window key to a [start, end] date range.
 */
export function resolveWindow(window: WindowKey, now = new Date()): { start: string; end: string; expectedDays: number } {
  const end = toYMD(now)

  switch (window) {
    case '24h': {
      const yesterday = toYMD(daysAgo(now, 1))
      return { start: yesterday, end: yesterday, expectedDays: 1 }
    }
    case '7d': {
      const start = toYMD(daysAgo(now, 6))
      return { start, end, expectedDays: 7 }
    }
    case '30d': {
      const start = toYMD(daysAgo(now, 29))
      return { start, end, expectedDays: 30 }
    }
    case 'mtd': {
      const mtdStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      const start = toYMD(mtdStart)
      const expectedDays = Math.floor((now.getTime() - mtdStart.getTime()) / 86400000) + 1
      return { start, end, expectedDays }
    }
  }
}

function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function daysAgo(from: Date, n: number): Date {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() - n)
  return d
}

/**
 * Get KPIs for a brand + window, converting to the requested display currency.
 *
 * Historical integrity: each day's revenue is converted using THAT day's FX rate,
 * not today's rate. Preserves the actual GBP→AUD value at time of sale.
 */
export async function getKPIs(
  supabase: SupabaseClient,
  brandId: string,
  window: WindowKey,
  displayCurrency: string
): Promise<KPIResult> {
  const { start, end, expectedDays } = resolveWindow(window)

  type SummaryRow = {
    date: string
    revenue: number | null
    orders: number | null
    aov: number | null
    new_customers: number | null
    returning_customers: number | null
    source_currency: string | null
    fx_rates: Record<string, number> | null
  }

  const { data: rows, error } = await supabase.rpc('get_daily_summary', {
    p_brand_id: brandId,
    p_start: start,
    p_end: end,
  }) as { data: SummaryRow[] | null; error: { message: string } | null }

  if (error) throw new Error(`Failed to read cache: ${error.message}`)

  // Convert each day's revenue to display currency using that day's FX rate
  const daily = (rows ?? []).map(r => {
    const sourceCurrency = r.source_currency ?? 'GBP'
    const rates = (typeof r.fx_rates === 'string' ? JSON.parse(r.fx_rates) : r.fx_rates ?? {}) as Record<string, number>
    const convertedRevenue = convertAmount(Number(r.revenue ?? 0), sourceCurrency, displayCurrency, rates)
    return {
      date: r.date,
      revenue: convertedRevenue,
      orders: Number(r.orders ?? 0),
      source_currency: sourceCurrency,
    }
  })

  // Aggregate
  const revenue = daily.reduce((s, r) => s + r.revenue, 0)
  const orders = daily.reduce((s, r) => s + r.orders, 0)
  const aov = orders > 0 ? revenue / orders : 0
  const new_customers = (rows ?? []).reduce((s, r) => s + Number(r.new_customers ?? 0), 0)
  const returning_customers = (rows ?? []).reduce((s, r) => s + Number(r.returning_customers ?? 0), 0)

  // Latest sync timestamp
  const { data: syncRow } = await supabase
    .from('tw_sync_log')
    .select('completed_at, started_at, status')
    .eq('brand_id', brandId)
    .eq('status', 'success')
    .order('completed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    window,
    range: { start, end },
    display_currency: displayCurrency,
    revenue,
    orders,
    aov,
    new_customers,
    returning_customers,
    daily,
    last_synced_at: syncRow?.completed_at ?? syncRow?.started_at ?? null,
    days_cached: daily.length,
    days_expected: expectedDays,
  }
}
