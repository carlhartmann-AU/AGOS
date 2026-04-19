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
  dates: string[]  // YYYY-MM-DD, any order — caller builds the list
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
  const { supabase, brandId, apiKey, shopDomain, triggeredBy, dates } = opts
  const startedAt = Date.now()

  // 1. Log start
  const { data: logRow, error: logErr } = await supabase
    .from('tw_sync_log')
    .insert({
      brand_id: brandId,
      triggered_by: triggeredBy,
      status: 'failed',
      days_synced: 0,
    })
    .select('id')
    .single()

  if (logErr) {
    console.error('[tw-sync] tw_sync_log INSERT failed — this is the likely 500 cause:', {
      code: logErr.code,
      message: logErr.message,
      details: logErr.details,
      hint: logErr.hint,
      brandId,
      triggeredBy,
    })
  }

  const syncLogId = logRow?.id as string | undefined
  console.log('[tw-sync] sync started', { syncLogId, brandId, triggeredBy, dates })

  // 3. Fetch TW metrics in parallel
  const twResults = await fetchMultipleDays({ apiKey, shopDomain }, dates, 3)

  const successful: TWDailyMetrics[] = []
  const errors: Array<{ date: string; error: string }> = []
  for (const r of twResults) {
    if (r.metrics) {
      console.log(`[tw-sync] TW fetch ok ${r.date}: revenue=${r.metrics.revenue} orders=${r.metrics.orders} currency=${r.metrics.source_currency}`)
      successful.push(r.metrics)
    } else if (r.error) {
      console.error(`[tw-sync] TW fetch failed ${r.date}:`, r.error)
      errors.push({ date: r.date, error: r.error })
    }
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
      shop_domain: shopDomain,           // NOT NULL, no default — must include
      date: m.date,
      revenue: m.revenue,
      orders: m.orders,
      aov: m.aov,
      new_customers: m.new_customers,
      returning_customers: m.returning_customers,
      new_customer_orders: m.new_customers,       // legacy column alias
      returning_customer_orders: m.returning_customers, // legacy column alias
      source_currency: m.source_currency,
      fx_rates: fxByKey.get(`${m.source_currency}|${m.date}`) ?? {},
      raw_response: m.raw_response ?? null,
      synced_at: new Date().toISOString(),
    }))

    console.log('[tw-sync] upserting rows:', rows.map(r => ({ date: r.date, shop_domain: r.shop_domain, brand_id: r.brand_id })))

    const { error: upsertErr } = await supabase
      .from('tw_daily_summary')
      .upsert(rows, { onConflict: 'brand_id,date' })

    if (upsertErr) {
      console.error('[tw-sync] tw_daily_summary upsert failed:', {
        code: upsertErr.code,
        message: upsertErr.message,
        details: upsertErr.details,
        hint: upsertErr.hint,
        rows_attempted: rows.length,
        sample_row: rows[0],
      })
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

  const result = {
    success: status === 'success',
    status,
    days_synced: successful.length,
    days_requested: dates.length,
    errors,
    duration_ms,
    sync_log_id: syncLogId,
  }
  console.log('[tw-sync] sync complete:', result)
  return result
}
