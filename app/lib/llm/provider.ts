import { createAdminClient } from '@/lib/supabase/admin'

export interface LLMConfig {
  provider: string
  model: string
  temperature?: number
  maxTokens?: number
}

const DEFAULT_CONFIG: LLMConfig = {
  provider: 'anthropic',
  model: 'claude-sonnet-4-6',
}

export async function getLLMConfig(brandId: string, agentKey: string): Promise<LLMConfig> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('agent_config')
      .select('llm_provider, llm_model, llm_config, enabled')
      .eq('brand_id', brandId)
      .eq('agent_key', agentKey)
      .maybeSingle()

    if (!data || !data.enabled) return DEFAULT_CONFIG

    const extra = (data.llm_config as Record<string, number> | null) ?? {}

    return {
      provider: data.llm_provider ?? DEFAULT_CONFIG.provider,
      model: data.llm_model ?? DEFAULT_CONFIG.model,
      temperature: extra.temperature,
      maxTokens: extra.max_tokens,
    }
  } catch {
    return DEFAULT_CONFIG
  }
}

export async function getAgentConfig(
  brandId: string,
  agentKey: string,
): Promise<{ enabled: boolean; model: string }> {
  try {
    const supabase = createAdminClient()
    const { data } = await supabase
      .from('agent_config')
      .select('enabled, llm_model')
      .eq('brand_id', brandId)
      .eq('agent_key', agentKey)
      .maybeSingle()

    if (!data) {
      console.warn(`[llm/provider] No agent_config for ${brandId}/${agentKey} — using defaults`)
      return { enabled: true, model: DEFAULT_CONFIG.model }
    }

    return {
      enabled: data.enabled ?? true,
      model: data.llm_model ?? DEFAULT_CONFIG.model,
    }
  } catch {
    return { enabled: true, model: DEFAULT_CONFIG.model }
  }
}
