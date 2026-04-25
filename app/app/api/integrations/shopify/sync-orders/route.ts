// POST /api/integrations/shopify/sync-orders
// Syncs customers then orders from Shopify for a brand.
// Auth: CRON_SECRET bearer token OR authenticated session.

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncCustomers } from '@/lib/shopify/sync-customers'
import { syncOrders } from '@/lib/shopify/sync-orders'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Auth: CRON_SECRET bearer or session
  const auth = req.headers.get('authorization')
  const isCron = auth === `Bearer ${process.env.CRON_SECRET}`

  if (!isCron) {
    // Fall back to session auth
    const { createClient } = await import('@/lib/supabase/server')
    const supabaseSsr = createClient()
    const { data: { user } } = await supabaseSsr.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
    }
  }

  const body = await req.json().catch(() => ({})) as { brand_id?: string }
  const brandId = body.brand_id ?? 'plasmaide'

  const supabase = createAdminClient()

  // Fetch active Shopify connection
  const { data: conn } = await supabase
    .from('shopify_connections')
    .select('shop_domain, access_token')
    .eq('brand_id', brandId)
    .neq('sync_status', 'disconnected')
    .neq('access_token', '')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json(
      { error: 'No active Shopify connection for this brand' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    // Customers first — orders reference them
    const customerResult = await syncCustomers(supabase, brandId, conn.shop_domain, conn.access_token)
    const orderResult = await syncOrders(supabase, brandId, conn.shop_domain, conn.access_token)

    return NextResponse.json(
      {
        ok: true,
        brand_id: brandId,
        customers_synced: customerResult.customers_synced,
        orders_synced: orderResult.orders_synced,
        is_full_backfill: orderResult.is_full_backfill,
      },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err) {
    console.error('[sync-orders]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
