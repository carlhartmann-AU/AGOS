import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { runCFOAnalysis } from '@/lib/agents/cfo/engine'
import { getAgentConfig } from '@/lib/llm/provider'

export const maxDuration = 60

/**
 * POST /api/agents/cfo/report
 * Body: { brand_id, window_start?, window_end?, triggered_by? }
 * Runs CFO analysis and persists a new report.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const brand_id: string = body.brand_id
  const triggered_by: string = body.triggered_by ?? 'manual'

  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const today = new Date()
  const fyStart = new Date(today.getFullYear(), 6, 1) // Jul 1 (AU FY)
  if (today < fyStart) fyStart.setFullYear(fyStart.getFullYear() - 1)

  const window_start: string = body.window_start ?? fyStart.toISOString().slice(0, 10)
  const window_end: string = body.window_end ?? today.toISOString().slice(0, 10)

  const supabase = createAdminClient()

  const agentCfg = await getAgentConfig(brand_id, 'cfo')
  if (!agentCfg.enabled) {
    return NextResponse.json(
      { disabled: true, message: `Agent cfo disabled for brand ${brand_id}` },
      { status: 200, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  try {
    const report = await runCFOAnalysis(supabase, brand_id, window_start, window_end, triggered_by, agentCfg.model)
    return NextResponse.json(report, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[POST /api/agents/cfo/report]', err)
    return NextResponse.json({ error: 'CFO analysis failed', detail: String(err) }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

/**
 * GET /api/agents/cfo/report?brand_id=&limit=1
 * Returns the most recent CFO report(s) for a brand.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brand_id = searchParams.get('brand_id')
  const limit = parseInt(searchParams.get('limit') ?? '1', 10)

  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('cfo_reports')
    .select('*')
    .eq('brand_id', brand_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(limit === 1 ? (data?.[0] ?? null) : data, { headers: { 'Cache-Control': 'no-store' } })
}
