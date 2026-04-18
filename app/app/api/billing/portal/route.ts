import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createBillingPortalSession } from '@/lib/stripe'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brand_id } = await request.json().catch(() => ({}))
  if (!brand_id) return NextResponse.json({ error: 'Missing brand_id' }, { status: 400 })

  const { data: settings } = await supabase
    .from('brand_settings')
    .select('stripe_customer_id')
    .eq('brand_id', brand_id)
    .single()

  if (!settings?.stripe_customer_id) {
    return NextResponse.json({ url: '/settings?billing=upgrade' })
  }

  const { url } = await createBillingPortalSession(settings.stripe_customer_id)
  return NextResponse.json({ url })
}
