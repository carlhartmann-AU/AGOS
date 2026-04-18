import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { checkUserLimit } from '@/lib/plan-limits'
import type { UserRole } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify the calling user is an admin for this brand
  const { data: callerProfile } = await supabase
    .from('profiles')
    .select('role, brand_id')
    .eq('id', user.id)
    .single()

  if (callerProfile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 })
  }

  const { email, role } = await request.json().catch(() => ({})) as { email: string; role: UserRole }
  const brand_id = callerProfile.brand_id

  if (!email || !role) {
    return NextResponse.json({ error: 'Missing email or role' }, { status: 400 })
  }

  if (!['admin', 'approver', 'viewer'].includes(role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
  }

  // Check user limit
  const limit = await checkUserLimit(brand_id)
  if (!limit.allowed) {
    return NextResponse.json({
      error: `User limit reached for your plan (${limit.current}/${limit.limit}). Upgrade to add more team members.`,
    }, { status: 403 })
  }

  // Send invite via Supabase Admin API
  const admin = createAdminClient()
  const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { brand_id, role },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? ''}/reset-password`,
  })

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  // Pre-create the profile row so admins can see the pending member
  if (inviteData.user) {
    await admin.from('profiles').upsert({
      id: inviteData.user.id,
      email,
      brand_id,
      role,
      invited_by: user.id,
    }, { onConflict: 'id' })
  }

  return NextResponse.json({ ok: true })
}
