import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncProducts } from '@/lib/shopify/sync-products'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  // Allow either CRON_SECRET bearer token or authenticated session
  const authHeader = req.headers.get('authorization')
  const hasCronSecret = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!hasCronSecret) {
    // Fall back to session auth
    const supabaseUser = createClient()
    const { data: { user } } = await supabaseUser.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  const body = await req.json().catch(() => ({})) as { brand_id?: string }
  const brand_id = body.brand_id ?? 'plasmaide'

  const supabase = createAdminClient()

  const { data: conn, error: connError } = await supabase
    .from('shopify_connections')
    .select('shop_domain, access_token, sync_status')
    .eq('brand_id', brand_id)
    .neq('sync_status', 'disconnected')
    .neq('access_token', '')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (connError) return NextResponse.json({ error: connError.message }, { status: 500 })
  if (!conn) return NextResponse.json({ error: 'No active Shopify connection for this brand' }, { status: 404 })

  if (conn.sync_status === 'syncing') {
    return NextResponse.json({ error: 'Sync already in progress' }, { status: 409 })
  }

  try {
    const result = await syncProducts(supabase, brand_id, conn.shop_domain, conn.access_token)
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[shopify/sync-products] error:', message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
