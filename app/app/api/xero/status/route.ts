import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const brand_id = req.nextUrl.searchParams.get('brand_id')
  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const configured = !!(process.env.XERO_CLIENT_ID && process.env.XERO_CLIENT_SECRET)

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('xero_connections')
    .select('xero_tenant_id, xero_tenant_name, xero_tenant_type, status, connected_at, last_sync, token_expires_at')
    .eq('brand_id', brand_id)
    .eq('status', 'connected')
    .order('connected_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })

  return NextResponse.json({
    configured,
    connected: !!(data && data.length > 0),
    tenants: data ?? [],
  }, { headers: { 'Cache-Control': 'no-store' } })
}
