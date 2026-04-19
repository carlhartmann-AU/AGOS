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

  const admin = createAdminClient()
  const { data: settings } = await admin
    .from('brand_settings')
    .select('integrations')
    .eq('brand_id', brandId)
    .single()

  const integ = settings?.integrations as Record<string, Record<string, string | boolean | null>> | null
  const storeUrl = integ?.shopify?.store_url as string | null
  const accessToken = integ?.shopify?.access_token as string | null

  if (!storeUrl || !accessToken) {
    return NextResponse.json({ no_token: true })
  }

  // Fetch last 30 days of orders (Shopify limit 250/page — enough for most stores)
  const since30d = daysAgo(30)
  const shopifyBase = `https://${storeUrl}/admin/api/2025-01`

  const res = await fetch(
    `${shopifyBase}/orders.json?status=any&created_at_min=${since30d}&limit=250`,
    {
      headers: {
        'X-Shopify-Access-Token': accessToken,
        'Content-Type': 'application/json',
      },
      next: { revalidate: 300 }, // cache 5 min
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
