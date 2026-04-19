// lib/triple-whale/sync.ts
// Write path: fetch from Triple Whale and upsert into tw_daily_summary.
// Used by: daily cron, manual refresh button, cold-start backfill.

import type { SupabaseClient } from '@supabase/supabase-js'
import { fetchMultipleDays, type TWDailyMetrics } from './client'

export type SyncTrigger = 'cron' | 'manual' | 'backfill' | 'cold_start'

export interface SyncOptions {
  supabase: SupabaseClient
  brandId: string
  apiKey: string
  shopDomain: string
  triggeredBy: SyncTrigger
  /**
   * Number of days to sync, ending today.
   * - 1 = today only (default, for daily cron)
   * - 7, 30 = backfill windows
   */
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
 * 2. Fetch N days from Triple Whale in parallel (capped concurrency)
 * 3. Upsert successful rows into tw_daily_summary (brand_id, date unique)
 * 4. Update tw_sync_log row (completed)
 */
export async function syncTripleWhale(opts: SyncOptions): Promise<SyncResult> {
  const { supabase, brandId, apiKey, shopDomain, triggeredBy, days = 1 } = opts
  const startedAt = Date.now()

  // 1. Build list of dates to sync (today back N days)
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < days; i++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }

  // 2. Start sync log row
  const { data: logRow, error: logErr } = await supabase
    .from('tw_sync_log')
    .insert({
      brand_id: brandId,
      triggered_by: triggeredBy,
      status: 'failed', // Overwrite on success
      days_synced: 0,
    })
    .select('id')
    .single()

  if (logErr) {
    // Log creation failed — not fatal, but we lose the audit row
    console.error('Failed to create sync log:', logErr)
  }
  const syncLogId = logRow?.id as string | undefined

  // 3. Fetch from Triple Whale in parallel
  const results = await fetchMultipleDays(
    { apiKey, shopDomain },
    dates,
    3 // concurrency
  )

  const successful: TWDailyMetrics[] = []
  const errors: Array<{ date: string; error: string }> = []

  for (const r of results) {
    if (r.metrics) successful.push(r.metrics)
    else if (r.error) errors.push({ date: r.date, error: r.error })
  }

  // 4. Upsert successful metrics
  if (successful.length > 0) {
    const rows = successful.map(m => ({
      brand_id: brandId,
      date: m.date,
      revenue: m.revenue,
      orders: m.orders,
      aov: m.aov,
      new_customers: m.new_customers,
      returning_customers: m.returning_customers,
      raw_response: m.raw_response ?? null,
      synced_at: new Date().toISOString(),
    }))

    const { error: upsertErr } = await supabase
      .from('tw_daily_summary')
      .upsert(rows, { onConflict: 'brand_id,date' })

    if (upsertErr) {
      // Upsert failed — this is a write-path failure, mark all as errors
      for (const m of successful) {
        errors.push({ date: m.date, error: `Upsert failed: ${upsertErr.message}` })
      }
      successful.length = 0
    }
  }

  // 5. Determine overall status
  const duration_ms = Date.now() - startedAt
  let status: SyncResult['status']
  if (errors.length === 0 && successful.length > 0) status = 'success'
  else if (successful.length > 0) status = 'partial'
  else status = 'failed'

  // 6. Update sync log
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
