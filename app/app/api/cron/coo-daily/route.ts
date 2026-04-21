import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { sendTelegramMessage } from '@/lib/agents/coo/telegram'

export const dynamic = 'force-dynamic'

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null || !isFinite(n)) return '–'
  return n.toLocaleString('en-AU', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function delta(current: number, prior: number): string {
  if (!prior) return ''
  const pct = ((current - prior) / prior) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(1)}%`
}

export async function GET(req: NextRequest) {
  // Auth: CRON_SECRET bearer
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()
  const brandId = 'plasmaide'

  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  const yesterdayStr = yesterday.toISOString().slice(0, 10)

  const prevDay = new Date(yesterday)
  prevDay.setDate(yesterday.getDate() - 7)
  const prevDayStr = prevDay.toISOString().slice(0, 10)

  // 1. Yesterday's revenue
  const [{ data: todayRows }, { data: priorRows }] = await Promise.all([
    supabase
      .from('tw_daily_summary')
      .select('revenue, orders, aov, ad_spend, roas')
      .eq('brand_id', brandId)
      .eq('date', yesterdayStr),
    supabase
      .from('tw_daily_summary')
      .select('revenue, orders, aov, ad_spend, roas')
      .eq('brand_id', brandId)
      .eq('date', prevDayStr),
  ])

  const revenue = Number(todayRows?.[0]?.revenue ?? 0)
  const orders = Number(todayRows?.[0]?.orders ?? 0)
  const aov = Number(todayRows?.[0]?.aov ?? 0)
  const roas = Number(todayRows?.[0]?.roas ?? 0)
  const priorRevenue = Number(priorRows?.[0]?.revenue ?? 0)

  // 2. Pending content
  const { count: pendingContent } = await supabase
    .from('content_queue')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)
    .eq('status', 'pending_review')

  // 3. Active alerts
  const { data: intReport } = await supabase
    .from('intelligence_reports')
    .select('anomalies')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const anomalyCount = Array.isArray(intReport?.anomalies) ? intReport.anomalies.length : 0

  // 4. Cash position from latest CFO report
  const { data: cfoReport } = await supabase
    .from('cfo_reports')
    .select('cash_forecast')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  const cashPos = (cfoReport?.cash_forecast as { opening_cash?: number } | null)?.opening_cash ?? null

  // 5. Build message
  const dateLabel = yesterday.toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })
  const revDelta = delta(revenue, priorRevenue)

  const message = [
    `📊 *AGOS Daily Digest — Plasmaide*`,
    `${dateLabel}`,
    ``,
    `💰 Revenue: A$${fmt(revenue)} ${revDelta ? `(${revDelta} WoW)` : ''}`,
    `📦 Orders: ${fmt(orders)}`,
    `💵 AOV: A$${fmt(aov, 2)}`,
    `📈 ROAS: ${roas > 0 ? `${fmt(roas, 2)}x` : '–'}`,
    ``,
    `📋 Content pending review: ${pendingContent ?? 0}`,
    `⚠️ Active alerts: ${anomalyCount}`,
    cashPos != null ? `💳 Cash position: A$${fmt(cashPos)}` : null,
    ``,
    `—`,
    `_Reply with any question to dig deeper._`,
  ].filter(l => l !== null).join('\n')

  // 6. Send to subscribers with daily_digest=true
  const { data: subscribers } = await supabase
    .from('coo_telegram_subscribers')
    .select('telegram_chat_id')
    .eq('brand_id', brandId)
    .eq('daily_digest', true)

  if (!subscribers?.length) {
    return NextResponse.json({ ok: true, sent: 0, message: 'No Telegram subscribers with daily digest enabled.' })
  }

  const results = await Promise.allSettled(
    subscribers.map(s => sendTelegramMessage(s.telegram_chat_id, message)),
  )
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length

  return NextResponse.json({ ok: true, sent, date: yesterdayStr })
}
