import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { brand_id?: string; shop_domain?: string }
  const { brand_id, shop_domain } = body

  if (!brand_id || !shop_domain) {
    return NextResponse.json({ error: 'brand_id and shop_domain are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // Soft delete: clear token and mark disconnected (preserves sync history).
  // .select('id') forces PostgREST to return the updated rows so we can detect
  // a 0-rows-matched update, which otherwise returns { error: null } and is
  // indistinguishable from a successful write.
  const { data: shopifyData, error: shopifyError } = await supabase
    .from('shopify_connections')
    .update({
      access_token: '',
      sync_status: 'disconnected',
      updated_at: now,
    })
    .eq('brand_id', brand_id)
    .eq('shop_domain', shop_domain)
    .select('id')

  if (shopifyError) {
    return NextResponse.json(
      { error: shopifyError.message },
      { status: 500 },
    )
  }

  if (!shopifyData || shopifyData.length === 0) {
    return NextResponse.json(
      {
        error: 'No matching Shopify connection found',
        brand_id,
        shop_domain,
      },
      { status: 404 },
    )
  }

  const shopifyRowsUpdated = shopifyData.length

  // Sync status to brand_integrations so the UI reflects the disconnected state.
  // brand_integrations may not have a row for connections that predate this
  // tracking layer — missing row here is not fatal. shopify_connections is the
  // source of truth for isConnected.
  const { data: integrationsData, error: integrationsError } = await supabase
    .from('brand_integrations')
    .update({ status: 'disconnected', updated_at: now })
    .eq('brand_id', brand_id)
    .eq('integration_slug', 'shopify')
    .select('id')

  if (integrationsError) {
    console.error(
      '[shopify/disconnect] brand_integrations sync failed:',
      integrationsError,
    )
  }

  const integrationsRowsUpdated = integrationsData?.length ?? 0

  return NextResponse.json({
    ok: true,
    shopify_rows_updated: shopifyRowsUpdated,
    brand_integrations_rows_updated: integrationsRowsUpdated,
  })
}
