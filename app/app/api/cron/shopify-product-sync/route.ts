import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncProducts } from '@/lib/shopify/sync-products'

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

  const results: Array<{ brand_id: string; status: string; products_synced?: number; error?: string }> = []

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

    if (!conn) {
      results.push({ brand_id: brand.brand_id, status: 'skipped' })
      continue
    }

    try {
      const result = await syncProducts(supabase, brand.brand_id, conn.shop_domain, conn.access_token)
      results.push({ brand_id: brand.brand_id, status: 'ok', products_synced: result.products_synced })
    } catch (err) {
      console.error(`[shopify-product-sync] ${brand.brand_id} failed:`, err)
      results.push({ brand_id: brand.brand_id, status: 'error', error: String(err) })
    }
  }

  return NextResponse.json({ ran_at: new Date().toISOString(), results })
}
