import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { runCFOAnalysis } from '@/lib/agents/cfo/engine'

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
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 })
  }

  const today = new Date()
  const fyStart = new Date(today.getFullYear(), 6, 1) // Jul 1 (AU FY)
  if (today < fyStart) fyStart.setFullYear(fyStart.getFullYear() - 1)

  const window_start: string = body.window_start ?? fyStart.toISOString().slice(0, 10)
  const window_end: string = body.window_end ?? today.toISOString().slice(0, 10)

  const supabase = await createClient()

  try {
    const report = await runCFOAnalysis(supabase, brand_id, window_start, window_end, triggered_by)
    return NextResponse.json(report)
  } catch (err) {
    console.error('[POST /api/agents/cfo/report]', err)
    return NextResponse.json({ error: 'CFO analysis failed', detail: String(err) }, { status: 500 })
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
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('cfo_reports')
    .select('*')
    .eq('brand_id', brand_id)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(limit === 1 ? (data?.[0] ?? null) : data)
}
