import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { handleCustomerInquiry } from '@/lib/agents/cs/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brandId = searchParams.get('brand_id') ?? 'plasmaide'
  const status = searchParams.get('status')
  const priority = searchParams.get('priority')
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)
  const supabase = createAdminClient()

  let query = supabase
    .from('cs_tickets')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (status) query = query.eq('status', status)
  if (priority) query = query.eq('priority', priority)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  return NextResponse.json({ tickets: data ?? [], count: data?.length ?? 0 }, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      brand_id?: string
      customer_name?: string
      customer_email?: string
      subject: string
      message: string
      channel?: string
    }
    if (!body.subject || !body.message) {
      return NextResponse.json({ error: 'subject and message required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    const supabase = createAdminClient()
    const result = await handleCustomerInquiry(supabase, body.brand_id ?? 'plasmaide', {
      customer_name: body.customer_name,
      customer_email: body.customer_email,
      subject: body.subject,
      message: body.message,
      channel: body.channel,
    })
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[cs/tickets POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json() as {
      ticket_id: string
      status?: string
      resolution_notes?: string
      escalated_to?: string
    }
    if (!body.ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })

    const supabase = createAdminClient()
    const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (body.status !== undefined) update.status = body.status
    if (body.resolution_notes !== undefined) update.resolution_notes = body.resolution_notes
    if (body.escalated_to !== undefined) update.escalated_to = body.escalated_to
    if (body.status === 'resolved') update.resolved_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('cs_tickets')
      .update(update)
      .eq('id', body.ticket_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
    return NextResponse.json({ ok: true, ticket: data }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
