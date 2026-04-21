import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { revokeConnection } from '@/lib/integrations/xero/auth'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { brand_id, xero_tenant_id } = body

  if (!brand_id || !xero_tenant_id) {
    return NextResponse.json({ error: 'brand_id and xero_tenant_id are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data: conn } = await supabase
    .from('xero_connections')
    .select('access_token, id')
    .eq('brand_id', brand_id)
    .eq('xero_tenant_id', xero_tenant_id)
    .single()

  // Attempt to revoke at Xero — best effort, don't fail if this errors
  if (conn?.access_token && conn?.id) {
    try {
      await revokeConnection(conn.access_token, conn.id)
    } catch {
      // Xero revoke failed — still mark as disconnected locally
    }
  }

  // Clear tokens and mark disconnected
  const { error } = await supabase
    .from('xero_connections')
    .update({
      status: 'disconnected',
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('brand_id', brand_id)
    .eq('xero_tenant_id', xero_tenant_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
