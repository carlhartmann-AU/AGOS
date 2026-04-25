import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncProducts } from '@/lib/shopify/sync-products'
import { syncCustomers } from '@/lib/shopify/sync-customers'
import { syncOrders } from '@/lib/shopify/sync-orders'
import { getAgentConfig } from '@/lib/llm/provider'

export const maxDuration = 60

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  const { data: brands, error } = await supabase
    .from('brands')
    .select('brand_id')
    .eq('status', 'active')

  if (error || !brands?.length) {
    return NextResponse.json({ error: error?.message ?? 'No active brands' }, { status: 500 })
  }

  const results: Array<{ brand_id: string; status: string; products_synced?: number; customers_synced?: number; orders_synced?: number; error?: string }> = []

  for (const brand of brands) {
    const { data: conn } = await supabase
      .from('shopify_connections')
      .select('shop_domain, access_token')
      .eq('brand_id', brand.brand_id)
      .neq('sync_status', 'disconnected')
      .neq('access_token', '')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    const agentCfg = await getAgentConfig(brand.brand_id, 'shopify_sync')
    if (!agentCfg.enabled) {
      console.log(`Agent shopify_sync disabled for brand ${brand.brand_id}, skipping cron.`)
      results.push({ brand_id: brand.brand_id, status: 'disabled' })
      continue
    }

    if (!conn) {
      results.push({ brand_id: brand.brand_id, status: 'skipped' })
      continue
    }

    try {
      const [productResult, customerResult, orderResult] = await Promise.allSettled([
        syncProducts(supabase, brand.brand_id, conn.shop_domain, conn.access_token),
        syncCustomers(supabase, brand.brand_id, conn.shop_domain, conn.access_token),
        syncOrders(supabase, brand.brand_id, conn.shop_domain, conn.access_token),
      ])
      results.push({
        brand_id: brand.brand_id,
        status: 'ok',
        products_synced: productResult.status === 'fulfilled' ? productResult.value.products_synced : undefined,
        customers_synced: customerResult.status === 'fulfilled' ? customerResult.value.customers_synced : undefined,
        orders_synced: orderResult.status === 'fulfilled' ? orderResult.value.orders_synced : undefined,
      })
    } catch (err) {
      console.error(`[shopify-product-sync] ${brand.brand_id} failed:`, err)
      results.push({ brand_id: brand.brand_id, status: 'error', error: String(err) })
    }
  }

  return NextResponse.json({ ran_at: new Date().toISOString(), results })
}
