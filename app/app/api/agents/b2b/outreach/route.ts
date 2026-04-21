import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateOutreachCopy } from '@/lib/agents/b2b/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prospect_id: string; channel: 'email' | 'linkedin' }
    if (!body.prospect_id || !body.channel) {
      return NextResponse.json({ error: 'prospect_id and channel required' }, { status: 400 })
    }
    const supabase = createAdminClient()
    const result = await generateOutreachCopy(supabase, body.prospect_id, body.channel)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[b2b/outreach]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
