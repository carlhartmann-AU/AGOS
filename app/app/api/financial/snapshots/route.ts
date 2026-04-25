import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/financial/snapshots
 *
 * Query params:
 *   brand_id    required
 *   fy          optional  e.g. 'FY26'  — filters by fiscal_year
 *   report_type optional  e.g. 'pl_monthly','annual_summary' — comma-separated
 *
 * Returns: FinancialSnapshot[]
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brand_id    = searchParams.get('brand_id')
  const fy          = searchParams.get('fy')
  const report_type = searchParams.get('report_type')

  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const supabase = await createClient()

  let query = supabase
    .from('financial_snapshots')
    .select('*')
    .eq('brand_id', brand_id)
    .order('snapshot_date', { ascending: true })

  if (fy) {
    query = query.eq('fiscal_year', fy)
  }

  if (report_type) {
    const types = report_type.split(',').map((t) => t.trim())
    query = types.length === 1
      ? query.eq('report_type', types[0])
      : query.in('report_type', types)
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }

  return NextResponse.json(data, { headers: { 'Cache-Control': 'no-store' } })
}
