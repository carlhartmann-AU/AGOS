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

  // Find all brands with intelligence agent enabled in agent_config
  const { data: enabledAgents, error } = await supabase
    .from('agent_config')
    .select('brand_id, llm_model')
    .eq('agent_key', 'intelligence')
    .eq('enabled', true)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const brands = enabledAgents ?? []

  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6)
  const windowStart = start.toISOString().slice(0, 10)
  const windowEnd = end.toISOString().slice(0, 10)

  const results = await Promise.allSettled(
    brands.map(row => runIntelligence(supabase, row.brand_id, windowStart, windowEnd, 'cron', row.llm_model ?? undefined))
  )

  const summary = results.map((r, i) => ({
    brand_id: brands[i].brand_id,
    outcome: r.status === 'fulfilled' ? 'ok' : 'error',
    error: r.status === 'rejected' ? String(r.reason) : undefined,
  }))

  return NextResponse.json({ ran: brands.length, window: { windowStart, windowEnd }, results: summary })
}
