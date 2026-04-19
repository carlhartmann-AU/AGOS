// lib/triple-whale/sync.ts
// Write path: fetch from Triple Whale + Frankfurter FX → upsert into tw_daily_summary.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMultipleDays, type TWDailyMetrics } from './client'
import { fetchFXRates } from './fx'

export type SyncTrigger = 'cron' | 'manual' | 'backfill' | 'cold_start'

export interface SyncOptions {
  supabase: SupabaseClient
  brandId: string
  apiKey: string
  shopDomain: string
  triggeredBy: SyncTrigger
  days?: number
}

export interface SyncResult {
  success: boolean
  status: 'success' | 'partial' | 'failed'
  days_synced: number
  days_requested: number
  errors: Array<{ date: string; error: string }>
  duration_ms: number
  sync_log_id?: string
}

/**
 * Run a Triple Whale sync.
 *
 * Flow:
 * 1. Create tw_sync_log row (started)
 * 2. Build list of N days back from today
 * 3. Fetch TW metrics for all days in parallel (capped concurrency)
 * 4. Fetch FX rates for each unique date+currency combo (parallel, one-shot per date)
 * 5. Upsert successful rows into tw_daily_summary with fx_rates attached
 * 6. Update tw_sync_log row (completed)
 */
export async function syncTripleWhale(opts: SyncOptions): Promise<SyncResult> {
  const { supabase, brandId, apiKey, shopDomain, triggeredBy, days = 1 } = opts
  const startedAt = Date.now()

  // 1. Build list of dates (today back N days)
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }

  // 2. Log start
  const { data: logRow } = await supabase
    .from('tw_sync_log')
    .insert({
      brand_id: brandId,
      triggered_by: triggeredBy,
      status: 'failed',
      days_synced: 0,
    })
    .select('id')
    .single()

  const syncLogId = logRow?.id as string | undefined

  // 3. Fetch TW metrics in parallel
  const twResults = await fetchMultipleDays({ apiKey, shopDomain }, dates, 3)

  const successful: TWDailyMetrics[] = []
  const errors: Array<{ date: string; error: string }> = []
  for (const r of twResults) {
    if (r.metrics) successful.push(r.metrics)
    else if (r.error) errors.push({ date: r.date, error: r.error })
  }

  // 4. Fetch FX rates for each successful day (based on source_currency)
  // Group by source_currency to minimise API calls when all days share currency
  const uniquePairs = new Set(successful.map(m => `${m.source_currency}|${m.date}`))
  const fxByKey = new Map<string, Record<string, number>>()

  await Promise.all(
    Array.from(uniquePairs).map(async (key) => {
      const [currency, date] = key.split('|')
      try {
        const fx = await fetchFXRates(currency, date)
        fxByKey.set(key, fx.rates)
      } catch (err) {
        // FX failure is non-fatal — we can still store the metric row without rates.
        // The UI will fall back to source currency display.
        errors.push({
          date,
          error: `FX fetch failed for ${currency}: ${err instanceof Error ? err.message : String(err)}`,
        })
        fxByKey.set(key, {})
      }
    })
  )

  // 5. Upsert with FX rates attached
  if (successful.length > 0) {
    const rows = successful.map(m => ({
      brand_id: brandId,
      date: m.date,
      revenue: m.revenue,
      orders: m.orders,
      aov: m.aov,
      new_customers: m.new_customers,
      returning_customers: m.returning_customers,
      source_currency: m.source_currency,
      fx_rates: fxByKey.get(`${m.source_currency}|${m.date}`) ?? {},
      raw_response: m.raw_response ?? null,
      synced_at: new Date().toISOString(),
    }))

    const { error: upsertErr } = await supabase
      .from('tw_daily_summary')
      .upsert(rows, { onConflict: 'brand_id,date' })

    if (upsertErr) {
      for (const m of successful) {
        errors.push({ date: m.date, error: `Upsert failed: ${upsertErr.message}` })
      }
      successful.length = 0
    }
  }

  // 6. Determine status
  const duration_ms = Date.now() - startedAt
  let status: SyncResult['status']
  if (errors.length === 0 && successful.length > 0) status = 'success'
  else if (successful.length > 0) status = 'partial'
  else status = 'failed'

  // 7. Update log
  if (syncLogId) {
    await supabase
      .from('tw_sync_log')
      .update({
        status,
        days_synced: successful.length,
        errors: errors.length > 0 ? errors : null,
        duration_ms,
        completed_at: new Date().toISOString(),
      })
      .eq('id', syncLogId)
  }

  return {
    success: status === 'success',
    status,
    days_synced: successful.length,
    days_requested: days,
    errors,
    duration_ms,
    sync_log_id: syncLogId,
  }
}
