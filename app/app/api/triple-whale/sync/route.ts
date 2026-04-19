// app/api/triple-whale/sync/route.ts
// POST /api/triple-whale/sync — manual refresh triggered from KPIDashboard.
// Reads TW credentials from brand_settings.integrations, runs sync, updates cache.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTripleWhale, type SyncTrigger } from '@/lib/triple-whale/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest) {
  // Reachable via: (a) valid user session [middleware enforces], or
  // (b) Authorization: Bearer <CRON_SECRET> [middleware early-returns].
  const authHeader = req.headers.get('authorization')
  const isAuthorised = authHeader === `Bearer ${process.env.CRON_SECRET}`

  if (!isAuthorised) {
    // Request came via a user session — middleware already validated it.
  }

  try {
    const body = await req.json() as { brand_id?: string; days?: number; triggered_by?: SyncTrigger }
    const { brand_id, days = 1, triggered_by = 'manual' } = body

    if (!brand_id) {
      return NextResponse.json({ error: 'brand_id required' }, { status: 400 })
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

    const result = await syncTripleWhale({
      supabase,
      brandId: settings.id, // UUID PK, used as tw_daily_summary.brand_id FK
      apiKey,
      shopDomain,
      triggeredBy: triggered_by,
      days,
    })

    return NextResponse.json(result, { status: result.success ? 200 : 207 })
  } catch (err) {
    console.error('[tw-sync] error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Sync failed' },
      { status: 500 }
    )
  }
}
