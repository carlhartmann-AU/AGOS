// lib/triple-whale/kpis.ts
// Read path: aggregate cached daily rows into KPIs for the requested window.
// No Triple Whale API calls here — pure cache reads.

import type { SupabaseClient } from '@supabase/supabase-js'

export type WindowKey = '24h' | '7d' | '30d' | 'mtd'

export interface KPIResult {
  window: WindowKey
  range: { start: string; end: string } // YYYY-MM-DD, inclusive
  revenue: number
  orders: number
  aov: number
  new_customers: number
  returning_customers: number
  // Trend series for sparklines — one entry per day in range
  daily: Array<{
    date: string
    revenue: number
    orders: number
  }>
  // Freshness metadata
  last_synced_at: string | null
  days_cached: number
  days_expected: number
}

/**
 * Resolve a window key to a [start, end] date range.
 * All dates in UTC YYYY-MM-DD format.
 */
export function resolveWindow(window: WindowKey, now = new Date()): { start: string; end: string; expectedDays: number } {
  const end = toYMD(now)

  switch (window) {
    case '24h': {
      // Just today
      return { start: end, end, expectedDays: 1 }
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
 * Get KPIs for a brand + window, reading from tw_daily_summary cache.
 * Returns instantly (single indexed query + in-memory aggregation).
 */
export async function getKPIs(
  supabase: SupabaseClient,
  brandId: string,
  window: WindowKey
): Promise<KPIResult> {
  const { start, end, expectedDays } = resolveWindow(window)

  // Fetch rows in range
  const { data: rows, error } = await supabase
    .from('tw_daily_summary')
    .select('date, revenue, orders, aov, new_customers, returning_customers')
    .eq('brand_id', brandId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true })

  if (error) throw new Error(`Failed to read cache: ${error.message}`)

  const daily = (rows ?? []).map(r => ({
    date: r.date,
    revenue: Number(r.revenue ?? 0),
    orders: Number(r.orders ?? 0),
  }))

  // Aggregate over the window
  const revenue = daily.reduce((s, r) => s + r.revenue, 0)
  const orders = daily.reduce((s, r) => s + r.orders, 0)
  const aov = orders > 0 ? revenue / orders : 0
  const new_customers = (rows ?? []).reduce((s, r) => s + Number(r.new_customers ?? 0), 0)
  const returning_customers = (rows ?? []).reduce((s, r) => s + Number(r.returning_customers ?? 0), 0)

  // Read latest sync timestamp from helper view
  const { data: syncRow } = await supabase
    .from('tw_latest_sync')
    .select('completed_at, started_at, status')
    .eq('brand_id', brandId)
    .maybeSingle()

  return {
    window,
    range: { start, end },
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
