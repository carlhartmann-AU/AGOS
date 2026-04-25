import { NextRequest, NextResponse } from 'next/server'
import { generateTicketResponse } from '@/lib/agents/cs/engine'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAgentConfig } from '@/lib/llm/provider'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ticket_id: string }
    if (!body.ticket_id) {
      return NextResponse.json({ error: 'ticket_id required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }

    const supabase = createAdminClient()

    const { data: ticket } = await supabase
      .from('cs_tickets')
      .select('brand_id')
      .eq('id', body.ticket_id)
      .maybeSingle()
    const brandId = ticket?.brand_id ?? 'plasmaide'

    const agentCfg = await getAgentConfig(brandId, 'customer_service')
    if (!agentCfg.enabled) {
      return NextResponse.json(
        { disabled: true, message: `Agent customer_service disabled for brand ${brandId}` },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const result = await generateTicketResponse(supabase, body.ticket_id, agentCfg.model)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[cs/respond]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
