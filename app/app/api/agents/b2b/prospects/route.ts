import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brandId = searchParams.get('brand_id') ?? 'plasmaide'
  const status = searchParams.get('status')
  const country = searchParams.get('country')
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)
  const supabase = createAdminClient()

  let query = supabase
    .from('b2b_prospects')
    .select('*')
    .eq('brand_id', brandId)
    .order('score', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (country) query = query.eq('country', country)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ prospects: data ?? [], count: data?.length ?? 0 })
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      prospect_id: string
      status?: string
      notes?: string
      score?: number
      decision_maker_email?: string
    }
    if (!body.prospect_id) return NextResponse.json({ error: 'prospect_id required' }, { status: 400 })

    const supabase = createAdminClient()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status !== undefined) update.status = body.status
    if (body.notes !== undefined) update.notes = body.notes
    if (body.score !== undefined) update.score = body.score
    if (body.decision_maker_email !== undefined) update.decision_maker_email = body.decision_maker_email

    const { data, error } = await supabase
      .from('b2b_prospects')
      .update(update)
      .eq('id', body.prospect_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, prospect: data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
