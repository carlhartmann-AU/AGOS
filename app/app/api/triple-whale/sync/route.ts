// app/api/triple-whale/sync/route.ts
// POST /api/triple-whale/sync — manual refresh triggered from KPIDashboard.
// Reads TW credentials from brand_settings.integrations, runs sync, updates cache.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTripleWhale, type SyncTrigger } from '@/lib/triple-whale/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_DAYS = 15

function buildDates(
  days?: number,
  start_date?: string,
  end_date?: string,
): string[] | { error: string } {
  if (start_date !== undefined || end_date !== undefined) {
    if (!start_date || !end_date) return { error: 'Both start_date and end_date are required' }
    if (!DATE_RE.test(start_date) || !DATE_RE.test(end_date)) return { error: 'start_date and end_date must be YYYY-MM-DD' }
    if (end_date < start_date) return { error: 'end_date must be >= start_date' }
    const dates: string[] = []
    const cur = new Date(start_date + 'T00:00:00Z')
    const end = new Date(end_date + 'T00:00:00Z')
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setUTCDate(cur.getUTCDate() + 1)
    }
    if (dates.length > MAX_DAYS) return { error: `Range exceeds ${MAX_DAYS}-day safety cap (got ${dates.length} days)` }
    return dates
  }
  const n = Math.min(days ?? 1, MAX_DAYS)
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < n; i++) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  return dates
}

export async function POST(req: NextRequest) {
  // Reachable via: (a) valid user session [middleware enforces], or
  // (b) Authorization: Bearer <CRON_SECRET> [middleware early-returns].
  const authHeader = req.headers.get('authorization')
  const isAuthorised = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isAuthorised) {
    // Request came via a user session — middleware already validated it.
  }

  try {
    const body = await req.json() as {
      brand_id?: string
      triggered_by?: SyncTrigger
      days?: number
      start_date?: string
      end_date?: string
    }
    const { brand_id, triggered_by = 'manual', days, start_date, end_date } = body

    if (!brand_id) {
      return NextResponse.json({ error: 'brand_id required' }, { status: 400 })
    }

    const dates = buildDates(days, start_date, end_date)
    if ('error' in dates) {
      return NextResponse.json({ error: dates.error }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Look up brand settings — credentials live in integrations JSONB
    const { data: settings, error: settingsErr } = await supabase
      .from('brand_settings')
      .select('id, integrations')
      .eq('brand_id', brand_id)
      .single()

    if (settingsErr || !settings) {
      return NextResponse.json({ error: 'Brand not found' }, { status: 404 })
    }

    const integ = settings.integrations as Record<string, Record<string, string | null> | null> | null
    const twConfig = integ?.triple_whale as Record<string, string | null> | undefined
    const apiKey = twConfig?.api_key ?? null
    const shopDomain = twConfig?.shop_domain ?? null

    if (!apiKey || !shopDomain) {
      return NextResponse.json({ error: 'Triple Whale credentials not configured' }, { status: 422 })
    }

    console.log('[tw-sync] invoking sync:', {
      brandId: brand_id,
      shopDomain,
      apiKeyPrefix: apiKey.slice(0, 8) + '…',
      dates,
      triggeredBy: triggered_by,
    })

    const result = await syncTripleWhale({
      supabase,
      brandId: brand_id,
      apiKey,
      shopDomain,
      triggeredBy: triggered_by,
      dates,
    })

    const httpStatus = result.status === 'failed' ? 500 : 200
    return NextResponse.json(result, { status: httpStatus })
  } catch (err) {
    console.error('[tw-sync] unhandled exception:', err instanceof Error ? err.stack : err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
