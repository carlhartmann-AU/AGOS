import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { agentKey: string } },
) {
  const brand_id = req.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'
  const { agentKey } = params

  const body = await req.json().catch(() => ({})) as {
    enabled?: boolean
    llm_model?: string
    llm_provider?: string
    settings?: Record<string, unknown>
  }

  const supabase = createAdminClient()

  // Verify agent is available in the brand's plan
  const { data: brand } = await supabase
    .from('brands')
    .select('plan_id')
    .eq('brand_id', brand_id)
    .maybeSingle()

  if (brand?.plan_id) {
    const { data: planAgent } = await supabase
      .from('plan_agents')
      .select('id')
      .eq('plan_id', brand.plan_id)
      .eq('agent_key', agentKey)
      .maybeSingle()

    if (!planAgent) {
      return NextResponse.json({ error: 'This agent is not available on your current plan' }, { status: 403 })
    }
  }

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.enabled !== undefined) update.enabled = body.enabled
  if (body.llm_model) update.llm_model = body.llm_model
  if (body.llm_provider) update.llm_provider = body.llm_provider
  if (body.settings) update.settings = body.settings

  const { error } = await supabase
    .from('agent_config')
    .update(update)
    .eq('brand_id', brand_id)
    .eq('agent_key', agentKey)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
