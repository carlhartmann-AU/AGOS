import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// ─── Types ────────────────────────────────────────────────────────────────────

type TwMetric = { id: string; values: { current: number } }

type TwSummaryResponse = { metrics: TwMetric[] }

type TwMobyResponse = {
  responses?: Array<{
    answer?: {
      aov?: number[]
      new_customer_orders?: number[]
      returning_customer_orders?: number[]
    }
  }>
}

type ContentStatusRow = { status: string; count: string }

type QueueRow = {
  id: string
  content_type: string
  status: string
  created_at: string
  title: string | null
  compliance_status: string | null
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function dateStr(d: Date) {
  return d.toISOString().split('T')[0]
}

function daysAgo(n: number) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return dateStr(d)
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const brandId = request.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'
  const admin = createAdminClient()

  // ── Load brand settings ──────────────────────────────────────────────────

  const { data: settings } = await admin
    .from('brand_settings')
    .select('integrations')
    .eq('brand_id', brandId)
    .single()

  const integ = settings?.integrations as Record<string, Record<string, string | boolean | null> | string | null> | null
  const twConfig = integ?.triple_whale as Record<string, string | null> | undefined
  const apiKey = twConfig?.api_key ?? null
  const shopDomain = twConfig?.shop_domain ?? 'plasmaide-uk.myshopify.com'

  // ── Supabase content metrics (always) ────────────────────────────────────

  const [statusRows, recentRows] = await Promise.all([
    admin.rpc('content_status_counts', { p_brand_id: brandId }).then(async ({ data, error }) => {
      // Fallback if RPC not deployed: manual group-by
      if (error) {
        const { data: rows } = await admin
          .from('content_queue')
          .select('status')
          .eq('brand_id', brandId)
        const counts: Record<string, number> = {}
        for (const r of rows ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1
        return Object.entries(counts).map(([status, count]) => ({ status, count: String(count) }))
      }
      return (data as ContentStatusRow[]) ?? []
    }),

    admin
      .from('content_queue')
      .select('id, content_type, status, created_at, content, compliance_status')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(5),
  ])

  // Parse content counts
  const counts: Record<string, number> = {}
  for (const r of statusRows as ContentStatusRow[]) counts[r.status] = Number(r.count)
  const total = Object.values(counts).reduce((s, n) => s + n, 0)
  const pending = counts['pending'] ?? 0
  const published = counts['published'] ?? 0
  const approvedAndPub = (counts['approved'] ?? 0) + published
  const approvalRate = total > 0 ? Math.round((approvedAndPub / total) * 100) : 0

  const recentItems = (recentRows.data ?? []).map((r) => {
    const c = r.content as Record<string, unknown>
    return {
      id: r.id,
      content_type: r.content_type,
      status: r.status,
      created_at: r.created_at,
      title: (c?.title ?? c?.subject ?? c?.caption ?? null) as string | null,
      compliance_status: (r.compliance_status as string | null) ?? null,
    } as QueueRow
  })

  const contentMetrics = { total, pending, published, approvalRate }

  // ── Triple Whale (only if configured) ───────────────────────────────────

  if (!apiKey) {
    return NextResponse.json({
      tw: null,
      tw_no_key: true,
      content: contentMetrics,
      recent: recentItems,
    })
  }

  const twHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
  }

  const start = daysAgo(7)
  const end = dateStr(new Date())

  const [summaryRes, mobyRes] = await Promise.allSettled([
    fetch('https://api.triplewhale.com/api/v2/summary-page/get-data', {
      method: 'POST',
      headers: twHeaders,
      body: JSON.stringify({
        shopDomain,
        period: { start, end },
        todayHour: new Date().getHours() + 1,
      }),
    }),
    fetch('https://api.triplewhale.com/api/v2/orcabase/api/moby', {
      method: 'POST',
      headers: twHeaders,
      body: JSON.stringify({
        shopId: shopDomain,
        question: 'What is my AOV, new customer orders, and returning customer orders?',
      }),
    }),
  ])

  // Parse summary
  let revenue7d: number | null = null
  let orders7d: number | null = null
  if (summaryRes.status === 'fulfilled' && summaryRes.value.ok) {
    const summaryData: TwSummaryResponse = await summaryRes.value.json().catch(() => ({ metrics: [] }))
    const metrics = summaryData.metrics ?? []
    revenue7d = metrics.find((m) => m.id === 'sales')?.values?.current ?? null
    orders7d = metrics.find((m) => m.id === 'orders')?.values?.current ?? null
  }

  // Parse moby
  let aov: number | null = null
  let newCustomers: number | null = null
  if (mobyRes.status === 'fulfilled' && mobyRes.value.ok) {
    const mobyData: TwMobyResponse = await mobyRes.value.json().catch(() => ({}))
    const answer = mobyData.responses?.[0]?.answer
    aov = answer?.aov?.[0] ?? null
    newCustomers = answer?.new_customer_orders?.[0] ?? null
  }

  return NextResponse.json({
    tw: { revenue7d, orders7d, aov, newCustomers, shopDomain, period: { start, end } },
    tw_no_key: false,
    content: contentMetrics,
    recent: recentItems,
  })
}
