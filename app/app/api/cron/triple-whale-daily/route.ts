// app/api/cron/triple-whale-daily/route.ts
// Vercel Cron — runs daily at 22:00 UTC (08:00 AEST; does not auto-adjust for DST — see vercel.json).
// Syncs today's Triple Whale metrics for every active brand that has TW configured.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncTripleWhale } from '@/lib/triple-whale/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Fetch all brand_settings rows that have TW credentials
  const { data: allSettings, error } = await supabase
    .from('brand_settings')
    .select('id, brand_id, integrations')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = { id: string; brand_id: string; integrations: unknown }
  const configured = (allSettings as Row[] ?? []).filter(row => {
    const integ = row.integrations as Record<string, Record<string, string | null> | null> | null
    const tw = integ?.triple_whale as Record<string, string | null> | undefined
    return tw?.api_key && tw?.shop_domain
  })

  const today = new Date().toISOString().slice(0, 10)

  const results = await Promise.allSettled(
    configured.map(row => {
      const integ = row.integrations as Record<string, Record<string, string | null> | null>
      const tw = integ.triple_whale as Record<string, string>
      return syncTripleWhale({
        supabase,
        brandId: row.brand_id,
        apiKey: tw.api_key,
        shopDomain: tw.shop_domain,
        triggeredBy: 'cron',
        dates: [today],
      })
    })
  )

  const summary = results.map((r, i) => ({
    brand_settings_id: configured[i].id,
    outcome: r.status === 'fulfilled' ? r.value.status : 'error',
    error: r.status === 'rejected' ? String(r.reason) : undefined,
  }))

  return NextResponse.json({ synced: configured.length, results: summary })
}
