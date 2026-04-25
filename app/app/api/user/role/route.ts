import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ role: 'viewer' }, { headers: { 'Cache-Control': 'no-store' } })

  // Admin client bypasses recursive RLS on the profiles table
  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return NextResponse.json({ role: data?.role ?? 'viewer' }, { headers: { 'Cache-Control': 'no-store' } })
}
