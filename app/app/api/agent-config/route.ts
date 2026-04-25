import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const brand_id = req.nextUrl.searchParams.get('brand_id') ?? 'plasmaide'

  const supabase = createAdminClient()

  // Fetch agent configs and brand's plan in parallel
  const [{ data: agents, error: agentsError }, { data: brand }] = await Promise.all([
    supabase
      .from('agent_config')
      .select('agent_key, display_name, description, enabled, llm_provider, llm_model, cron_schedule, settings')
      .eq('brand_id', brand_id)
      .order('display_name'),
    supabase
      .from('brands')
      .select('plan_id')
      .eq('brand_id', brand_id)
      .maybeSingle(),
  ])

  if (agentsError) return NextResponse.json({ error: agentsError.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } })

  // Fetch plan + allowed agents
  let planInfo: { slug: string; name: string } | null = null
  let allowedAgentKeys: Set<string> = new Set()

  if (brand?.plan_id) {
    const [{ data: plan }, { data: planAgents }] = await Promise.all([
      supabase.from('plans').select('slug, name').eq('id', brand.plan_id).maybeSingle(),
      supabase.from('plan_agents').select('agent_key').eq('plan_id', brand.plan_id),
    ])
    if (plan) planInfo = plan
    if (planAgents) allowedAgentKeys = new Set(planAgents.map(a => a.agent_key))
  } else {
    // No plan set — enterprise by default (platform owner)
    const { data: plan } = await supabase.from('plans').select('id, slug, name').eq('slug', 'enterprise').maybeSingle()
    if (plan) {
      planInfo = { slug: plan.slug, name: plan.name }
      const { data: planAgents } = await supabase.from('plan_agents').select('agent_key').eq('plan_id', plan.id)
      if (planAgents) allowedAgentKeys = new Set(planAgents.map(a => a.agent_key))
    }
  }

  const enriched = (agents ?? []).map(a => ({
    ...a,
    available_in_plan: allowedAgentKeys.size === 0 ? true : allowedAgentKeys.has(a.agent_key),
  }))

  return NextResponse.json({ agents: enriched, plan: planInfo }, { headers: { 'Cache-Control': 'no-store' } })
}
