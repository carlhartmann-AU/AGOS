import { NextRequest, NextResponse } from 'next/server'
import { generateTicketResponse } from '@/lib/agents/cs/engine'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { ticket_id: string }
    if (!body.ticket_id) return NextResponse.json({ error: 'ticket_id required' }, { status: 400 })

    const supabase = createAdminClient()
    const result = await generateTicketResponse(supabase, body.ticket_id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cs/respond]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
