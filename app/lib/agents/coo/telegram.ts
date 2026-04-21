import type { SupabaseClient } from '@supabase/supabase-js'

const TELEGRAM_API = 'https://api.telegram.org'

export async function sendTelegramMessage(chatId: number, text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false

  try {
    const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
      }),
    })
    return res.ok
  } catch {
    return false
  }
}

export async function broadcastAlert(
  supabase: SupabaseClient,
  brandId: string,
  alert: { severity: 'info' | 'warning' | 'critical'; title: string; description: string },
): Promise<void> {
  const { data: subscribers } = await supabase
    .from('coo_telegram_subscribers')
    .select('telegram_chat_id')
    .eq('brand_id', brandId)
    .eq('alerts_enabled', true)

  if (!subscribers?.length) return

  const icon = alert.severity === 'critical' ? '🚨' : alert.severity === 'warning' ? '⚠️' : 'ℹ️'
  const message = `${icon} *${alert.title}*\n\n${alert.description}`

  await Promise.allSettled(
    subscribers.map(s => sendTelegramMessage(s.telegram_chat_id, message)),
  )
}
