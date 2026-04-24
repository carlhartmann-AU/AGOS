import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({})) as { brand_id?: string; shop_domain?: string }
  const { brand_id, shop_domain } = body

  if (!brand_id || !shop_domain) {
    return NextResponse.json({ error: 'brand_id and shop_domain are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  // Soft delete: clear token and mark disconnected (preserves sync history)
  const { error } = await supabase
    .from('shopify_connections')
    .update({
      access_token: '',
      sync_status: 'disconnected',
      updated_at: new Date().toISOString(),
    })
    .eq('brand_id', brand_id)
    .eq('shop_domain', shop_domain)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
