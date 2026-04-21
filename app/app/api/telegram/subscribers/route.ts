import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { brand_id = 'plasmaide', telegram_chat_id, telegram_username, user_role = 'owner' } = body

  if (!telegram_chat_id) {
    return NextResponse.json({ error: 'telegram_chat_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('coo_telegram_subscribers')
    .upsert(
      { brand_id, telegram_chat_id, telegram_username: telegram_username ?? null, user_role },
      { onConflict: 'telegram_chat_id' },
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, subscriber: data })
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { id, alerts_enabled, daily_digest } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const update: Record<string, unknown> = {}
  if (alerts_enabled !== undefined) update.alerts_enabled = alerts_enabled
  if (daily_digest !== undefined) update.daily_digest = daily_digest

  const { error } = await supabase.from('coo_telegram_subscribers').update(update).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { id } = body
  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

  const supabase = createAdminClient()
  const { error } = await supabase.from('coo_telegram_subscribers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
