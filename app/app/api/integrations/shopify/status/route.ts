import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const brand_id = req.nextUrl.searchParams.get('brand_id')
  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 })
  }

  const configured = !!(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('shopify_connections')
    .select('shop_domain, shop_name, sync_status, sync_error, connected_at, last_sync_at')
    .eq('brand_id', brand_id)
    .neq('sync_status', 'disconnected')
    .neq('access_token', '')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    configured,
    connected: !!data,
    connection: data ?? null,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
