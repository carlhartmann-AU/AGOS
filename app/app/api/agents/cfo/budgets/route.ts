import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/agents/cfo/budgets?brand_id=&fiscal_year=FY26
 */
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brand_id = searchParams.get('brand_id')
  const fiscal_year = searchParams.get('fiscal_year')

  if (!brand_id) {
    return NextResponse.json({ error: 'brand_id is required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  let query = supabase
    .from('financial_budgets')
    .select('*')
    .eq('brand_id', brand_id)
    .order('fiscal_year', { ascending: false })

  if (fiscal_year) query = query.eq('fiscal_year', fiscal_year)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data)
}

/**
 * POST /api/agents/cfo/budgets
 * Body: { brand_id, fiscal_year, metric, target }
 * Upserts a single budget line.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { brand_id, fiscal_year, metric, target } = body

  if (!brand_id || !fiscal_year || !metric || target == null) {
    return NextResponse.json({ error: 'brand_id, fiscal_year, metric, target are required' }, { status: 400 })
  }

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('financial_budgets')
    .upsert({ brand_id, fiscal_year, metric, target, updated_at: new Date().toISOString() }, {
      onConflict: 'brand_id,fiscal_year,metric',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

/**
 * PATCH /api/agents/cfo/budgets
 * Body: { brand_id, fiscal_year, updates: Record<metric, target> }
 * Batch upsert multiple budget lines.
 */
export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const { brand_id, fiscal_year, updates } = body

  if (!brand_id || !fiscal_year || !updates || typeof updates !== 'object') {
    return NextResponse.json({ error: 'brand_id, fiscal_year, updates (object) are required' }, { status: 400 })
  }

  const supabase = createAdminClient()
  const now = new Date().toISOString()

  const rows = Object.entries(updates as Record<string, number>).map(([metric, target]) => ({
    brand_id,
    fiscal_year,
    metric,
    target,
    updated_at: now,
  }))

  const { data, error } = await supabase
    .from('financial_budgets')
    .upsert(rows, { onConflict: 'brand_id,fiscal_year,metric' })
    .select()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
