// app/api/cron/intelligence-weekly/route.ts
// Vercel Cron — runs weekly at 22:00 UTC on Sunday.
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runIntelligence } from '@/lib/agents/intelligence/engine'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createAdminClient()

  // Find all brands with compliance enabled (used as proxy for AGOS-enabled brands)
  const { data: allSettings, error } = await supabase
    .from('brand_settings')
    .select('brand_id, compliance')

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  type Row = { brand_id: string; compliance: Record<string, unknown> | null }
  const brands = ((allSettings ?? []) as Row[]).filter(row => {
    const c = row.compliance as Record<string, unknown> | null
    return c?.enabled === true
  })

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6)
  const windowStart = start.toISOString().slice(0, 10)
  const windowEnd = end.toISOString().slice(0, 10)

  const results = await Promise.allSettled(
    brands.map(row => runIntelligence(supabase, row.brand_id, windowStart, windowEnd, 'cron'))
  )

  const summary = results.map((r, i) => ({
    brand_id: brands[i].brand_id,
    outcome: r.status === 'fulfilled' ? 'ok' : 'error',
    error: r.status === 'rejected' ? String(r.reason) : undefined,
  }))

  return NextResponse.json({ ran: brands.length, window: { windowStart, windowEnd }, results: summary })
}
