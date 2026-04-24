'use client'

import { useEffect, useState, useCallback } from 'react'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'

interface AgentConfig {
  agent_key: string
  display_name: string
  description: string | null
  enabled: boolean
  llm_provider: string
  llm_model: string
  cron_schedule: string | null
  available_in_plan: boolean
}

interface AgentsResponse {
  agents: AgentConfig[]
  plan: { slug: string; name: string } | null
}

const LLM_MODELS = [
  { value: 'claude-sonnet-4-6-20250415', label: 'Claude Sonnet 4.6 (recommended)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (faster, lower cost)' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7 (most capable)' },
]

function Toggle({
  checked, onChange, disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void; disabled?: boolean
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full
                  transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1
                  disabled:opacity-40 disabled:cursor-not-allowed
                  ${checked ? 'bg-gray-900' : 'bg-gray-200'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function formatCron(cron: string | null): string {
  if (!cron) return 'Manual / on-demand'
  const presets: Record<string, string> = {
    '0 22 * * 0': 'Weekly (Sun 8am AEST)',
    '0 23 * * 0': 'Weekly (Sun 9am AEST)',
    '0 22 * * *': 'Daily (8am AEST)',
  }
  return presets[cron] ?? cron
}

export default function AgentsSettingsPage() {
  const { activeBrand } = useBrand()
  const [data, setData] = useState<AgentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<Record<string, boolean>>({})

  const fetchAgents = useCallback(async () => {
    if (!activeBrand) return
    setLoading(true)
    try {
      const res = await fetch(`/api/agent-config?brand_id=${activeBrand.brand_id}`)
      if (res.ok) setData(await res.json() as AgentsResponse)
    } finally {
      setLoading(false)
    }
  }, [activeBrand?.brand_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  async function patchAgent(agentKey: string, update: Partial<AgentConfig>) {
    if (!activeBrand) return
    setSaving(s => ({ ...s, [agentKey]: true }))
    try {
      await fetch(`/api/agent-config/${agentKey}?brand_id=${activeBrand.brand_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      setData(d => d ? {
        ...d,
        agents: d.agents.map(a => a.agent_key === agentKey ? { ...a, ...update } : a),
      } : d)
    } finally {
      setSaving(s => ({ ...s, [agentKey]: false }))
    }
  }

  if (!activeBrand) {
    return (
      <div className="p-6">
        <PageHeader title="Agents" description="Configure AI agents for your brand." />
        <div className="mt-6 bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
          Select a brand to configure agents.
        </div>
      </div>
    )
  }

  const planName = data?.plan?.name ?? 'Enterprise'

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Agents"
        description={`Configure AI agents. Plan: ${planName}`}
      />

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-40 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(data?.agents ?? []).map(agent => {
            const locked = !agent.available_in_plan
            const isSaving = saving[agent.agent_key]

            return (
              <div
                key={agent.agent_key}
                className={`bg-white rounded-lg border overflow-hidden transition-opacity ${locked ? 'border-gray-100 opacity-60' : 'border-gray-200'}`}
              >
                <div className="px-5 py-4">
                  {/* Header row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{agent.display_name}</span>
                        {locked && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                            Upgrade to unlock
                          </span>
                        )}
                      </div>
                      {agent.description && (
                        <p className="text-xs text-gray-400 mt-1 leading-relaxed">{agent.description}</p>
                      )}
                    </div>
                    <div className="flex-shrink-0 mt-0.5">
                      {isSaving ? (
                        <div className="w-9 h-5 bg-gray-100 rounded-full animate-pulse" />
                      ) : (
                        <Toggle
                          checked={agent.enabled}
                          onChange={v => patchAgent(agent.agent_key, { enabled: v })}
                          disabled={locked}
                        />
                      )}
                    </div>
                  </div>

                  {/* LLM model */}
                  <div className="mt-4">
                    <label className="block text-xs text-gray-500 mb-1">LLM Model</label>
                    <select
                      value={agent.llm_model}
                      onChange={e => patchAgent(agent.agent_key, { llm_model: e.target.value })}
                      disabled={locked}
                      className="block w-full rounded-md border border-gray-200 px-3 py-1.5 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50 disabled:text-gray-400"
                    >
                      {LLM_MODELS.map(m => (
                        <option key={m.value} value={m.value}>{m.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Schedule */}
                  <div className="mt-2 flex items-center gap-1.5">
                    <svg className="w-3 h-3 text-gray-300 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-xs text-gray-400">{formatCron(agent.cron_schedule)}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
