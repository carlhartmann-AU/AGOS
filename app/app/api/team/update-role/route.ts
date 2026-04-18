import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { UserRole } from '@/types'

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

  const { member_id, role } = await request.json().catch(() => ({})) as { member_id: string; role: UserRole }

  if (!member_id || !role) return NextResponse.json({ error: 'Missing member_id or role' }, { status: 400 })
  if (!['admin', 'approver', 'viewer'].includes(role)) return NextResponse.json({ error: 'Invalid role' }, { status: 400 })

  // Prevent admin from downgrading themselves
  if (member_id === user.id && role !== 'admin') {
    return NextResponse.json({ error: 'Cannot change your own admin role' }, { status: 400 })
  }

  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', member_id)
    .eq('brand_id', callerProfile.brand_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
