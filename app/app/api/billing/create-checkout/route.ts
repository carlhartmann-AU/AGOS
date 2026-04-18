import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createCheckoutSession } from '@/lib/stripe'
import type { Plan } from '@/types'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const { plan, brand_id } = body as { plan: Plan; brand_id: string }

  if (!plan || !brand_id) {
    return NextResponse.json({ error: 'Missing plan or brand_id' }, { status: 400 })
  }

  const { data: settings } = await supabase
    .from('brand_settings')
    .select('stripe_customer_id')
    .eq('brand_id', brand_id)
    .single()

  const { url } = await createCheckoutSession(brand_id, plan, settings?.stripe_customer_id ?? undefined)
  return NextResponse.json({ url })
}
