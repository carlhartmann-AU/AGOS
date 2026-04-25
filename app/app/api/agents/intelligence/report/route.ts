// app/api/agents/intelligence/report/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runIntelligence } from '@/lib/agents/intelligence/engine'
import { getAgentConfig } from '@/lib/llm/provider'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

function defaultWindow(): { start: string; end: string } {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 6)
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { brand_id?: string; window_start?: string; window_end?: string }
    const brandId = body.brand_id ?? 'plasmaide'
    const { start, end } = defaultWindow()
    const windowStart = body.window_start ?? start
    const windowEnd = body.window_end ?? end

    const supabase = createAdminClient()

    const agentCfg = await getAgentConfig(brandId, 'intelligence')
    if (!agentCfg.enabled) {
      return NextResponse.json(
        { ok: false, disabled: true, message: `Agent intelligence disabled for brand ${brandId}` },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const report = await runIntelligence(supabase, brandId, windowStart, windowEnd, 'manual', agentCfg.model)

    return NextResponse.json({ ok: true, report }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[intelligence/report] POST error:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function GET(req: NextRequest) {
  try {
    const brandId = req.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('intelligence_reports')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error

    return NextResponse.json({ ok: true, report: data ?? null }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[intelligence/report] GET error:', err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
