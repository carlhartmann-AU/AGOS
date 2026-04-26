// lib/kpi/commerce-metrics.ts
// Unified commerce KPI interface that reads from whichever integration
// is active for the 'commerce_data' data role for a given brand.

import type { SupabaseClient } from '@supabase/supabase-js'
import { getKPIs, resolveWindow, type WindowKey, type KPIResult } from '@/lib/triple-whale/kpis'
import { getDataSource } from '@/lib/integrations/data-source'
import { fetchFXRates, convertAmount } from '@/lib/triple-whale/fx'

export interface CommerceKPIResult extends KPIResult {
  source: 'shopify' | 'triple_whale'
}

// Financial statuses that count as revenue (both upper and lowercase)
const PAID_STATUSES = ['paid', 'partially_paid', 'PAID', 'PARTIALLY_PAID']

/**
 * Resolves the active commerce_data source for the brand and returns
 * unified KPI metrics. Falls back to Triple Whale if Shopify is not active.
 */
export async function getCommerceKPIs(
  supabase: SupabaseClient,
  brandId: string,
  window: WindowKey,
  displayCurrency: string,
): Promise<CommerceKPIResult> {
  const dataSource = await getDataSource(brandId, 'commerce_data')

  if (dataSource?.integration_slug === 'shopify') {
    return getMetricsFromShopify(supabase, brandId, window, displayCurrency)
  }

  // Default to Triple Whale
  const kpis = await getKPIs(supabase, brandId, window, displayCurrency)
  return { ...kpis, source: 'triple_whale' }
}

async function getMetricsFromShopify(
  supabase: SupabaseClient,
  brandId: string,
  window: WindowKey,
  displayCurrency: string,
): Promise<CommerceKPIResult> {
  const { start, end, expectedDays } = resolveWindow(window)
  const endWithTime = end + 'T23:59:59Z'

  // Fetch paid orders in the period
  const { data: orders, error: ordersError } = await supabase
    .from('orders')
    .select('order_created_at, total_price, currency, customer_id')
    .eq('brand_id', brandId)
    .in('financial_status', PAID_STATUSES)
    .gte('order_created_at', start)
    .lte('order_created_at', endWithTime)
    .order('order_created_at', { ascending: true })

  if (ordersError) throw new Error(`Orders query failed: ${ordersError.message}`)

  console.log(`[kpi/shopify] ${brandId} window=${window} start=${start} end=${endWithTime} rows=${orders?.length ?? 0}`)

  // Group by date to build daily breakdown
  const dayMap = new Map<string, { revenue: number; orders: number; currency: string }>()
  for (const o of orders ?? []) {
    const date = (o.order_created_at as string).slice(0, 10)
    const existing = dayMap.get(date) ?? { revenue: 0, orders: 0, currency: o.currency ?? displayCurrency }
    existing.revenue += Number(o.total_price ?? 0)
    existing.orders += 1
    dayMap.set(date, existing)
  }

  const rawDaily = Array.from(dayMap.entries()).map(([date, d]) => ({
    date,
    revenue: Math.round(d.revenue * 100) / 100,
    orders: d.orders,
    source_currency: d.currency,
  }))

  // FX conversion: convert each day's revenue from source currency to displayCurrency
  const uniqueSourceCurrencies = Array.from(new Set(rawDaily.map(d => d.source_currency)))
  const fxMap = new Map<string, Record<string, number>>()
  const today = new Date().toISOString().slice(0, 10)
  await Promise.all(uniqueSourceCurrencies.map(async src => {
    if (src === displayCurrency) {
      fxMap.set(src, { [displayCurrency]: 1 })
    } else {
      try {
        const fx = await fetchFXRates(src, today, [displayCurrency])
        fxMap.set(src, fx.rates)
      } catch {
        fxMap.set(src, {}) // graceful degradation — returns native amount on FX failure
      }
    }
  }))

  const daily = rawDaily.map(d => ({
    ...d,
    revenue: Math.round(convertAmount(d.revenue, d.source_currency, displayCurrency, fxMap.get(d.source_currency) ?? {}) * 100) / 100,
  }))

  const revenue = daily.reduce((s, d) => s + d.revenue, 0)
  const ordersTotal = daily.reduce((s, d) => s + d.orders, 0)
  const aov = ordersTotal > 0 ? revenue / ordersTotal : 0

  // New customers: first order falls within the period
  const { count: newCustomers } = await supabase
    .from('customers')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .gte('first_order_at', start)
    .lte('first_order_at', endWithTime)

  // Returning customers: ordered in period but had prior orders
  const uniqueCustomerIds = new Set(
    (orders ?? []).filter(o => o.customer_id).map(o => o.customer_id as string)
  )
  const returningCustomers = Math.max(0, uniqueCustomerIds.size - (newCustomers ?? 0))

  // Last sync: most recent synced_at from orders
  const { data: latestOrder } = await supabase
    .from('orders')
    .select('synced_at')
    .eq('brand_id', brandId)
    .order('synced_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return {
    window,
    range: { start, end },
    display_currency: displayCurrency,
    revenue: Math.round(revenue * 100) / 100,
    orders: ordersTotal,
    aov: Math.round(aov * 100) / 100,
    new_customers: newCustomers ?? 0,
    returning_customers: returningCustomers,
    daily,
    last_synced_at: latestOrder?.synced_at ?? null,
    days_cached: daily.length,
    days_expected: expectedDays,
    source: 'shopify',
  }
}
