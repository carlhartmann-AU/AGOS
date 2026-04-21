import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = req.nextUrl.searchParams.get('brand_id')
  if (!brandId) return NextResponse.json({ error: 'brand_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify caller is an admin for this brand
  const { data: caller } = await admin
    .from('profiles')
    .select('role, brand_id')
    .eq('id', user.id)
    .single()

  if (caller?.role !== 'admin' || caller?.brand_id !== brandId) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('profiles')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ members: data ?? [] })
}
