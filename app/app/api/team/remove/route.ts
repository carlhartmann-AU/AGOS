import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, brand_id')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
  }

  const { member_id } = await request.json().catch(() => ({})) as { member_id: string }
  if (!member_id) return NextResponse.json({ error: 'Missing member_id' }, { status: 400 })

  if (member_id === user.id) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('id', member_id)
    .eq('brand_id', callerProfile.brand_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Also revoke auth access via admin client
  const admin = createAdminClient()
  await admin.auth.admin.deleteUser(member_id).catch(() => null)

  return NextResponse.json({ ok: true })
}
