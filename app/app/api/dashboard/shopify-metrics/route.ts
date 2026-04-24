import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

type ShopifyOrder = {
  total_price: string
  created_at: string
}

type ShopifyOrdersResponse = {
  orders: ShopifyOrder[]
}

function todayRange() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = request.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'

  // Read credentials from shopify_connections (OAuth token), not legacy brand_settings JSONB
  const admin = createAdminClient()
  const { data: conn } = await admin
    .from('shopify_connections')
    .select('shop_domain, access_token')
    .eq('brand_id', brandId)
    .neq('sync_status', 'disconnected')
    .neq('access_token', '')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ no_token: true })
  }

  const since30d = daysAgo(30)
  const shopifyBase = `https://${conn.shop_domain}/admin/api/2026-04`

  const res = await fetch(
    `${shopifyBase}/orders.json?status=any&created_at_min=${since30d}&limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': conn.access_token,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 },
    }
  )

  if (!res.ok) {
    const errText = await res.text()
    return NextResponse.json({ error: `Shopify API error: ${res.status}`, detail: errText }, { status: 502 })
  }

  const data: ShopifyOrdersResponse = await res.json()
  const orders = data.orders ?? []

  const todayStart = todayRange()
  const todayOrders = orders.filter((o) => o.created_at >= todayStart)

  const revenueToday = todayOrders.reduce((sum, o) => sum + parseFloat(o.total_price), 0)
  const revenue30d = orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0)
  const ordersToday = todayOrders.length
  const aov = ordersToday > 0 ? revenueToday / ordersToday : 0

  return NextResponse.json({
    revenue_today: revenueToday,
    orders_today: ordersToday,
    aov,
    revenue_30d: revenue30d,
  })
}
