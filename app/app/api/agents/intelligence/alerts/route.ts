// app/api/agents/intelligence/alerts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const brandId = req.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'
    const acknowledgedParam = req.nextUrl.searchParams.get('acknowledged')
    const supabase = createAdminClient()

    let query = supabase
      .from('intelligence_alerts')
      .select('*')
      .eq('brand_id', brandId)
      .order('created_at', { ascending: false })

    if (acknowledgedParam === 'false') {
      query = query.eq('acknowledged', false)
    } else if (acknowledgedParam === 'true') {
      query = query.eq('acknowledged', true)
    }

    const { data, error } = await query
    if (error) throw error

    return NextResponse.json({ ok: true, alerts: data ?? [] }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { alert_id?: string; acknowledged_by?: string }
    if (!body.alert_id) {
      return NextResponse.json({ ok: false, error: 'alert_id required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('intelligence_alerts')
      .update({
        acknowledged: true,
        acknowledged_by: body.acknowledged_by ?? null,
        acknowledged_at: new Date().toISOString(),
      })
      .eq('id', body.alert_id)

    if (error) throw error

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
