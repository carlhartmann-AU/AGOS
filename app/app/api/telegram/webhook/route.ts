import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runCOOChatSync } from '@/lib/agents/coo/engine'
import { sendTelegramMessage } from '@/lib/agents/coo/telegram'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  // Validate secret token
  const secret = req.headers.get('x-telegram-bot-api-secret-token')
  if (secret !== process.env.TELEGRAM_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const message = (body.message as Record<string, unknown> | undefined)
  if (!message) return NextResponse.json({ ok: true })

  const chatId = (message.chat as Record<string, unknown> | undefined)?.id as number | undefined
  const text = message.text as string | undefined

  if (!chatId || !text) return NextResponse.json({ ok: true })

  const supabase = createAdminClient()

  // Check subscriber exists (security gate)
  const { data: subscriber } = await supabase
    .from('coo_telegram_subscribers')
    .select('brand_id, user_role')
    .eq('telegram_chat_id', chatId)
    .maybeSingle()

  if (!subscriber) {
    // Unknown user — silently ignore
    return NextResponse.json({ ok: true })
  }

  const brandId = subscriber.brand_id

  // Find or create conversation for this Telegram chat
  let { data: conv } = await supabase
    .from('coo_conversations')
    .select('id')
    .eq('brand_id', brandId)
    .eq('channel', 'telegram')
    .eq('telegram_chat_id', chatId)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conv) {
    const { data: newConv } = await supabase
      .from('coo_conversations')
      .insert({ brand_id: brandId, channel: 'telegram', telegram_chat_id: chatId })
      .select('id')
      .single()
    conv = newConv
  }

  if (!conv?.id) return NextResponse.json({ ok: true })

  try {
    // Send typing indicator
    const token = process.env.TELEGRAM_BOT_TOKEN
    if (token) {
      await fetch(`https://api.telegram.org/bot${token}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, action: 'typing' }),
      })
    }

    const { text: response } = await runCOOChatSync(supabase, brandId, conv.id, text)

    // Strip card blocks from Telegram message (not rendered there)
    const cleanedResponse = response.replace(/<<<CARDS>>>[\s\S]*?<<<END_CARDS>>>/g, '').trim()

    // Telegram limit is 4096 chars — split if needed
    const chunks: string[] = []
    for (let i = 0; i < cleanedResponse.length; i += 4000) {
      chunks.push(cleanedResponse.slice(i, i + 4000))
    }

    for (const chunk of chunks) {
      await sendTelegramMessage(chatId, chunk)
    }
  } catch (err) {
    console.error('[telegram/webhook] engine error:', err)
    await sendTelegramMessage(chatId, 'Sorry, I encountered an error. Please try again.')
  }

  return NextResponse.json({ ok: true })
}
