import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brand_id, api_key } = await request.json().catch(() => ({})) as { brand_id?: string; api_key?: string }

  // If no key passed in body, try reading from brand_settings
  let key = api_key?.trim()
  if (!key && brand_id) {
    const admin = createAdminClient()
    const { data: settings } = await admin
      .from('brand_settings')
      .select('integrations')
      .eq('brand_id', brand_id)
      .single()
    const integ = settings?.integrations as Record<string, Record<string, string | null>> | null
    key = integ?.triple_whale?.api_key ?? undefined
  }

  if (!key) return NextResponse.json({ error: 'No API key configured' }, { status: 400 })

  // Triple Whale summary endpoint
  const res = await fetch('https://api.triplewhale.com/api/v2/tw-metrics/get-metrics-by-day', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
    },
    body: JSON.stringify({
      shopUrl: brand_id === 'plasmaide' ? 'plasmaide.myshopify.com' : '',
      start: new Date(Date.now() - 86400000).toISOString().split('T')[0],
      end: new Date().toISOString().split('T')[0],
    }),
  })

  if (res.status === 401 || res.status === 403) {
    return NextResponse.json({ ok: false, error: 'Invalid API key' })
  }
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `Triple Whale API error: ${res.status}` })
  }

  return NextResponse.json({ ok: true })
}
