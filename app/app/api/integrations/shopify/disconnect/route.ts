import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { brand_id?: string; shop_domain?: string }
  const { brand_id, shop_domain } = body

  if (!brand_id || !shop_domain) {
    return NextResponse.json({ error: 'brand_id and shop_domain are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const now = new Date().toISOString()

  // Soft delete: clear token and mark disconnected (preserves sync history)
  const { error } = await supabase
    .from('shopify_connections')
    .update({
      access_token: '',
      sync_status: 'disconnected',
      updated_at: now,
    })
    .eq('brand_id', brand_id)
    .eq('shop_domain', shop_domain)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync status to brand_integrations so the UI reflects the disconnected state
  await supabase
    .from('brand_integrations')
    .update({ status: 'disconnected', updated_at: now })
    .eq('brand_id', brand_id)
    .eq('integration_slug', 'shopify')

  return NextResponse.json({ ok: true })
}
