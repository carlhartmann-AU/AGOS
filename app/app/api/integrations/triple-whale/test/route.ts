import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { brand_id, api_key } = await request.json().catch(() => ({})) as { brand_id?: string; api_key?: string }

  // Use passed key or fall back to stored key
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

  if (!key) return NextResponse.json({ ok: false, error: 'No API key provided' }, { status: 400 })

  const res = await fetch('https://api.triplewhale.com/api/v2/users/api-keys/me', {
    method: 'GET',
    headers: { 'x-api-key': key },
  })

  if (res.status === 401 || res.status === 403) {
    return NextResponse.json({ ok: false, error: 'Invalid API key' })
  }
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: `Triple Whale API error: ${res.status}` })
  }

  const data = await res.json().catch(() => ({})) as { name?: string; email?: string }
  return NextResponse.json({ ok: true, name: data.name, email: data.email })
}
