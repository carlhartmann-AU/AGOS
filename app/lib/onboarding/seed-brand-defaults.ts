// Canonical brand-onboarding seed. Called from:
//   - Tier 2 Item 7 onboarding checklist UI (when shipped)
//   - One-off scripts when Carl hand-provisions a brand
// The defaults here propagate to every new brand. Changing
// them changes future-brand behaviour. Existing brands are
// not touched (ON CONFLICT DO NOTHING).

import { createAdminClient } from '@/lib/supabase/admin'

// Mirrors the plasmaide agent_config row set.
// compliance MUST always be true — regulatory posture.
// b2b_outreach and customer_service are opt-in: both require
// per-brand setup (escalation paths, Gorgias inbox config) before use.
const AGENT_DEFAULTS: Array<{ agent_key: string; display_name: string; enabled: boolean }> = [
  { agent_key: 'compliance',       display_name: 'Compliance Agent',      enabled: true  },
  { agent_key: 'content',          display_name: 'Content Studio',         enabled: true  },
  { agent_key: 'intelligence',     display_name: 'Intelligence Agent',     enabled: true  },
  { agent_key: 'review_harvester', display_name: 'Review Harvester',       enabled: true  },
  { agent_key: 'coo',              display_name: 'COO Agent',              enabled: true  },
  { agent_key: 'cfo',              display_name: 'CFO Agent',              enabled: true  },
  { agent_key: 'b2b_outreach',     display_name: 'B2B Outreach Agent',     enabled: false },
  { agent_key: 'customer_service', display_name: 'Customer Service Agent', enabled: false },
]

// All four content types get a 'manual' placeholder so the UI surfaces
// "not connected" rather than silently dispatching nowhere.
const CONTENT_TYPE_DEFAULTS: Array<{ content_type: string; platform_label: string }> = [
  { content_type: 'blog',         platform_label: 'Blog (configure destination)'         },
  { content_type: 'email',        platform_label: 'Email (configure destination)'        },
  { content_type: 'landing_page', platform_label: 'Landing Page (configure destination)' },
  { content_type: 'social_post',  platform_label: 'Social Post (configure destination)'  },
]

export async function seedBrandDefaults(brandId: string): Promise<{
  agent_config_rows_inserted: number
  brand_content_config_rows_inserted: number
}> {
  const supabase = createAdminClient()
  let agentInserted = 0
  let configInserted = 0

  for (const agent of AGENT_DEFAULTS) {
    const { data: existing } = await supabase
      .from('agent_config')
      .select('id')
      .eq('brand_id', brandId)
      .eq('agent_key', agent.agent_key)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase.from('agent_config').insert({
        brand_id: brandId,
        agent_key: agent.agent_key,
        display_name: agent.display_name,
        enabled: agent.enabled,
        settings: {},
      })
      if (!error) agentInserted++
    }
  }

  for (const ct of CONTENT_TYPE_DEFAULTS) {
    const { data: existing } = await supabase
      .from('brand_content_config')
      .select('id')
      .eq('brand_id', brandId)
      .eq('content_type', ct.content_type)
      .eq('is_active', true)
      .maybeSingle()

    if (!existing) {
      const { error } = await supabase.from('brand_content_config').insert({
        brand_id: brandId,
        content_type: ct.content_type,
        destination_platform: 'manual',
        platform_label: ct.platform_label,
        platform_config: {},
        hitl_required: true,
        compliance_gating: 'block_on_critical',
        is_active: true,
      })
      if (!error) configInserted++
    }
  }

  return {
    agent_config_rows_inserted: agentInserted,
    brand_content_config_rows_inserted: configInserted,
  }
}
