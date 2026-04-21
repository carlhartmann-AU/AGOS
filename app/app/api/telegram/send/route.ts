import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramMessage, broadcastAlert } from '@/lib/agents/coo/telegram'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Auth: CRON_SECRET bearer only
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))
  const { brand_id = 'plasmaide', message, severity, chat_id } = body

  if (!message) return NextResponse.json({ error: 'message is required' }, { status: 400 })

  const supabase = createAdminClient()

  if (chat_id) {
    // Send to specific chat
    const ok = await sendTelegramMessage(chat_id, message)
    return NextResponse.json({ ok })
  }

  if (severity) {
    // Broadcast as alert
    await broadcastAlert(supabase, brand_id, {
      severity: severity as 'info' | 'warning' | 'critical',
      title: 'AGOS Alert',
      description: message,
    })
    return NextResponse.json({ ok: true })
  }

  // Broadcast plain message to all subscribers
  const { data: subscribers } = await supabase
    .from('coo_telegram_subscribers')
    .select('telegram_chat_id')
    .eq('brand_id', brand_id)
    .eq('alerts_enabled', true)

  if (!subscribers?.length) return NextResponse.json({ ok: true, sent: 0 })

  const results = await Promise.allSettled(
    subscribers.map(s => sendTelegramMessage(s.telegram_chat_id, message)),
  )
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length

  return NextResponse.json({ ok: true, sent })
}

export async function GET(req: NextRequest) {
  // Status endpoint — no auth (used by settings UI)
  const brandId = req.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'
  const configured = !!process.env.TELEGRAM_BOT_TOKEN

  const supabase = createAdminClient()
  const { data: subscribers } = await supabase
    .from('coo_telegram_subscribers')
    .select('id, telegram_chat_id, telegram_username, user_role, alerts_enabled, daily_digest, created_at')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: true })

  return NextResponse.json({ configured, subscribers: subscribers ?? [] })
}
