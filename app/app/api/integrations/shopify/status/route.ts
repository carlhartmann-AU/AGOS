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

  // Fetch access_token into the select so we can confirm it's non-empty server-side,
  // matching the positive-filter pattern used by the Xero status route.
  const { data, error } = await supabase
    .from('shopify_connections')
    .select('shop_domain, shop_name, sync_status, sync_error, connected_at, last_sync_at, access_token')
    .eq('brand_id', brand_id)
    .neq('sync_status', 'disconnected')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // A row is only "connected" if it exists and has a non-empty access token.
  // Checking in JS avoids the PostgREST empty-string neq edge case.
  const isConnected = !!(data && data.access_token)

  // Strip the token from the client response — never send credentials to the browser.
  const connection = isConnected
    ? {
        shop_domain: data!.shop_domain,
        shop_name: data!.shop_name,
        sync_status: data!.sync_status,
        sync_error: data!.sync_error,
        connected_at: data!.connected_at,
        last_sync_at: data!.last_sync_at,
      }
    : null

  return NextResponse.json(
    { configured, connected: isConnected, connection },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
