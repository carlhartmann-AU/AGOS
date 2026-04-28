import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateOutreachCopy } from '@/lib/agents/b2b/engine'
import { getAgentConfig } from '@/lib/llm/provider'

export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { prospect_id: string; channel: 'email' | 'linkedin' }
    if (!body.prospect_id || !body.channel) {
      return NextResponse.json({ error: 'prospect_id and channel required' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
    }
    const supabase = createAdminClient()

    const { data: prospect } = await supabase
      .from('b2b_prospects')
      .select('brand_id')
      .eq('id', body.prospect_id)
      .maybeSingle()
    const brandId = prospect?.brand_id ?? 'plasmaide'

    const agentCfg = await getAgentConfig(brandId, 'b2b_outreach')
    if (!agentCfg.enabled) {
      return NextResponse.json(
        { disabled: true, message: `Agent b2b_outreach disabled for brand ${brandId}` },
        { status: 200, headers: { 'Cache-Control': 'no-store' } },
      )
    }

    const result = await generateOutreachCopy(supabase, body.prospect_id, body.channel, agentCfg.model)
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } })
  } catch (err) {
    console.error('[b2b/outreach]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500, headers: { 'Cache-Control': 'no-store' } })
  }
}
