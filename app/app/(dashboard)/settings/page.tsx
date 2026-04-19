'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'
import type { Brand, BrandSettings, BrandSettingsRow, ContentSchedule, IntegrationsConfig, Profile, UserRole } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TIMEZONES = [
  'Australia/Brisbane', 'Australia/Sydney', 'Australia/Melbourne',
  'Australia/Adelaide', 'Australia/Perth', 'Pacific/Auckland',
  'Europe/London', 'Europe/Berlin', 'Europe/Paris',
  'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'UTC',
]

const CONTENT_TYPE_OPTIONS = [
  { id: 'blog', label: 'Blog' },
  { id: 'email', label: 'Email' },
  { id: 'social_caption', label: 'Social Caption' },
  { id: 'landing_page', label: 'Landing Page' },
]

const ANTHROPIC_MODELS = [
  { value: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6 (recommended)' },
  { value: 'claude-opus-4-7', label: 'Claude Opus 4.7' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
]

const PLAN_LABELS = { starter: 'Starter', growth: 'Growth', scale: 'Scale', enterprise: 'Enterprise' }
const PLAN_COLORS = {
  starter: 'bg-gray-100 text-gray-700',
  growth: 'bg-blue-100 text-blue-700',
  scale: 'bg-purple-100 text-purple-700',
  enterprise: 'bg-indigo-100 text-indigo-700',
}
const STATUS_COLORS: Record<string, string> = {
  trialing: 'bg-yellow-100 text-yellow-700',
  active: 'bg-green-100 text-green-700',
  past_due: 'bg-red-100 text-red-700',
  canceled: 'bg-gray-100 text-gray-500',
  unpaid: 'bg-red-100 text-red-700',
}

const PLAN_FEATURES: Record<string, { gens: string; users: string; types: string; extras: string[] }> = {
  starter: { gens: '50/mo', users: '1', types: 'Blog, Email', extras: [] },
  growth: { gens: '200/mo', users: '3', types: 'All types', extras: ['Shopify publish', 'Auto-approve'] },
  scale: { gens: 'Unlimited', users: '10', types: 'All types', extras: ['All integrations', 'Shopify publish', 'Auto-approve'] },
  enterprise: { gens: 'Unlimited', users: 'Unlimited', types: 'All types', extras: ['All integrations', 'Priority support', 'Custom onboarding'] },
}

const TABS = [
  { id: 'brand',     label: 'Brand Profile' },
  { id: 'schedule',  label: 'Content Schedule' },
  { id: 'ai',        label: 'AI Model' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'thresholds', label: 'Alert Thresholds' },
  { id: 'reporting', label: 'Reporting' },
  { id: 'coo',       label: 'COO Channels' },
  { id: 'team',      label: 'Team', adminOnly: true },
  { id: 'billing',   label: 'Billing', adminOnly: true },
] as const

type TabId = typeof TABS[number]['id']
type SaveState = 'idle' | 'saving' | 'saved' | 'error'
type SectionSave = { state: SaveState; error: string | null }

// ─── Form state types ─────────────────────────────────────────────────────────

type BrandForm = { name: string; industry: string; logo_url: string }

type ThresholdsForm = { min_roas: string; max_cac: string; spend_anomaly_pct: string }

type ScheduleForm = { report_day: string; report_time: string; report_timezone: string; alert_email: string }

type CooForm = { slack_channel: string; coo_channel_slack: boolean; coo_channel_artifact: boolean }

type AIForm = { llm_provider: string; llm_model: string; llm_api_key: string }

type IntegForm = {
  shopify_store_url: string
  shopify_blog_id: string
  shopify_access_token: string
  dotdigital_endpoint: string
  n8n_webhook_base: string
  triple_whale_api_key: string
  triple_whale_shop_domain: string
}

// ─── Primitive UI helpers ─────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium text-gray-700 mb-1">{children}</label>
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-gray-400">{children}</p>
}

function Badge({ children, className }: { children: React.ReactNode; className: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${className}`}>{children}</span>
}

function TextInput({
  value, onChange, placeholder, type = 'text', disabled,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; disabled?: boolean
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900
                 placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-900
                 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-400 transition"
    />
  )
}

function NumberInput({
  value, onChange, min, max, step = 1, disabled,
}: {
  value: string; onChange: (v: string) => void; min?: number; max?: number; step?: number; disabled?: boolean
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min} max={max} step={step} disabled={disabled}
      className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900
                 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                 disabled:bg-gray-50 disabled:text-gray-400 transition"
    />
  )
}

function SelectInput({
  value, onChange, options, disabled,
}: {
  value: string; onChange: (v: string) => void; options: string[] | { value: string; label: string }[]; disabled?: boolean
}) {
  const normalised = options.map((o) => typeof o === 'string' ? { value: o, label: o } : o)
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900
                 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                 disabled:bg-gray-50 disabled:text-gray-400 transition bg-white"
    >
      {normalised.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({
  checked, onChange, label, description, disabled,
}: {
  checked: boolean; onChange: (v: boolean) => void; label: string; description?: string; disabled?: boolean
}) {
  return (
    <div className="flex items-start gap-3">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative mt-0.5 inline-flex h-5 w-9 flex-shrink-0 items-center rounded-full
                    transition-colors focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-1
                    disabled:opacity-40
                    ${checked ? 'bg-gray-900' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

function SaveButton({ save, onClick, disabled: extraDisabled }: { save: SectionSave; onClick: () => void; disabled?: boolean }) {
  const { state } = save
  const styles: Record<SaveState, string> = {
    idle:   'bg-gray-900 text-white hover:bg-gray-700',
    saving: 'bg-gray-400 text-white cursor-not-allowed',
    saved:  'bg-green-600 text-white',
    error:  'bg-red-600 text-white hover:bg-red-700',
  }
  const labels: Record<SaveState, string> = {
    idle: 'Save changes', saving: 'Saving…', saved: '✓ Saved', error: 'Error — try again',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'saving' || extraDisabled}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${styles[state]} ${extraDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {labels[state]}
    </button>
  )
}

function Section({
  title, description, save, onSave, children, readOnly, footer,
}: {
  title: string; description: string; save: SectionSave; onSave: () => void
  children: React.ReactNode; readOnly?: boolean; footer?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
      <div className="px-5 py-5 space-y-5">{children}</div>
      <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-4">
        <span className="text-xs text-red-500 min-h-[1rem]">
          {save.state === 'error' ? save.error : ''}
        </span>
        <div className="flex items-center gap-3">
          {footer}
          {!readOnly && <SaveButton save={save} onClick={onSave} />}
          {readOnly && <span className="text-xs text-gray-400">Read-only</span>}
        </div>
      </div>
    </div>
  )
}

function ConnectedBadge({ connected }: { connected: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded ${connected ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-green-500' : 'bg-gray-400'}`} />
      {connected ? 'Connected' : 'Not connected'}
    </span>
  )
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const CONFIG_DEFAULTS: BrandSettings = {
  min_roas: '2.0', max_cac: '40', spend_anomaly_pct: '20',
  report_day: 'Monday', report_time: '08:00', report_timezone: 'Australia/Brisbane',
  alert_email: '', slack_channel: '', coo_channel_slack: 'true', coo_channel_artifact: 'true',
  shopify_store: '', email_platform: '', shopify_markets: '', base_locale: '',
  cs_platform: '', refund_threshold_aud: '', b2b_daily_outreach_limit: '',
}

const DEFAULT_SCHEDULE: ContentSchedule = {
  enabled: false, frequency: 'daily', time: '08:00', timezone: 'Australia/Sydney',
  content_types: ['blog'], topics_queue: [], auto_approve: false,
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const { activeBrand } = useBrand()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<TabId>('brand')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [userRole, setUserRole] = useState<UserRole>('viewer')

  // Brand Profile
  const [brandForm, setBrandForm] = useState<BrandForm>({ name: '', industry: '', logo_url: '' })
  const [brandSave, setBrandSave] = useState<SectionSave>({ state: 'idle', error: null })

  // Alert Thresholds
  const [thresholdsForm, setThresholdsForm] = useState<ThresholdsForm>({ min_roas: '2.0', max_cac: '40', spend_anomaly_pct: '20' })
  const [thresholdsSave, setThresholdsSave] = useState<SectionSave>({ state: 'idle', error: null })

  // Reporting Schedule
  const [reportForm, setReportForm] = useState<ScheduleForm>({ report_day: 'Monday', report_time: '08:00', report_timezone: 'Australia/Brisbane', alert_email: '' })
  const [reportSave, setReportSave] = useState<SectionSave>({ state: 'idle', error: null })

  // COO Channels
  const [cooForm, setCooForm] = useState<CooForm>({ slack_channel: '', coo_channel_slack: true, coo_channel_artifact: true })
  const [cooSave, setCooSave] = useState<SectionSave>({ state: 'idle', error: null })

  // Content Schedule
  const [contentSchedule, setContentSchedule] = useState<ContentSchedule>(DEFAULT_SCHEDULE)
  const [scheduleSave, setScheduleSave] = useState<SectionSave>({ state: 'idle', error: null })
  const [newTopic, setNewTopic] = useState('')
  const [generateNowState, setGenerateNowState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')

  // AI Model
  const [aiForm, setAiForm] = useState<AIForm>({ llm_provider: 'anthropic', llm_model: 'claude-sonnet-4-6', llm_api_key: '' })
  const [aiSave, setAiSave] = useState<SectionSave>({ state: 'idle', error: null })
  const [testingAI, setTestingAI] = useState(false)
  const [aiTestResult, setAiTestResult] = useState<'ok' | 'fail' | null>(null)

  // Integrations
  const [integForm, setIntegForm] = useState<IntegForm>({ shopify_store_url: '', shopify_blog_id: '', shopify_access_token: '', dotdigital_endpoint: '', n8n_webhook_base: '', triple_whale_api_key: '', triple_whale_shop_domain: '' })
  const [twTestState, setTwTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [integSave, setIntegSave] = useState<SectionSave>({ state: 'idle', error: null })

  // Team
  const [teamMembers, setTeamMembers] = useState<Profile[]>([])
  const [teamLoading, setTeamLoading] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<UserRole>('viewer')
  const [inviteState, setInviteState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [inviteError, setInviteError] = useState('')

  // Billing
  const [brandSettings, setBrandSettings] = useState<BrandSettingsRow | null>(null)

  const saveTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // ── Load all data on brand change ─────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!activeBrand) { setLoading(false); return }
    const brandId = activeBrand.brand_id

    setLoading(true)
    setFetchError(null)
    saveTimers.current.forEach(clearTimeout)
    saveTimers.current = []

    // Reset save states
    for (const fn of [setBrandSave, setThresholdsSave, setReportSave, setCooSave, setScheduleSave, setAiSave, setIntegSave]) {
      fn({ state: 'idle', error: null })
    }

    const [brandRes, configRes, settingsRes, roleRes] = await Promise.all([
      supabase.from('brands').select('*').eq('brand_id', brandId).single(),
      supabase.from('brand_config').select('key, value').eq('brand_id', brandId),
      supabase.from('brand_settings').select('*').eq('brand_id', brandId).single(),
      fetch('/api/user/role').then((r) => r.json() as Promise<{ role: string }>),
    ])

    if (brandRes.error) { setFetchError(`Failed to load brand: ${brandRes.error.message}`); setLoading(false); return }

    const b = brandRes.data as Brand
    setBrandForm({ name: b.name ?? '', industry: b.industry ?? '', logo_url: b.logo_url ?? '' })

    // Config key-value
    const cfg: Record<string, string> = {}
    for (const row of configRes.data ?? []) { if (row.value !== null) cfg[row.key] = row.value }
    const get = (k: keyof BrandSettings) => cfg[k] ?? CONFIG_DEFAULTS[k]

    setThresholdsForm({ min_roas: get('min_roas'), max_cac: get('max_cac'), spend_anomaly_pct: get('spend_anomaly_pct') })
    setReportForm({ report_day: get('report_day'), report_time: get('report_time'), report_timezone: get('report_timezone'), alert_email: get('alert_email') })
    setCooForm({ slack_channel: get('slack_channel'), coo_channel_slack: get('coo_channel_slack') !== 'false', coo_channel_artifact: get('coo_channel_artifact') !== 'false' })

    // brand_settings JSONB
    if (settingsRes.data) {
      const s = settingsRes.data as BrandSettingsRow
      setBrandSettings(s)
      setContentSchedule({ ...DEFAULT_SCHEDULE, ...(s.content_schedule ?? {}) })
      setAiForm({ llm_provider: s.llm_provider ?? 'anthropic', llm_model: s.llm_model ?? 'claude-sonnet-4-6', llm_api_key: '' })
      const integ = s.integrations ?? {} as IntegrationsConfig
      const twInteg = integ?.triple_whale as Record<string, string | boolean | null> | undefined
      setIntegForm({
        shopify_store_url: (integ?.shopify?.store_url as string | null) ?? '',
        shopify_blog_id: (integ?.shopify?.blog_id as string | null) ?? '',
        shopify_access_token: '',  // never prefill tokens
        dotdigital_endpoint: (integ?.dotdigital?.endpoint as string | null) ?? '',
        n8n_webhook_base: (integ?.n8n_webhook_base as string | null) ?? '',
        triple_whale_api_key: '',  // never prefill tokens
        triple_whale_shop_domain: (twInteg?.shop_domain as string | null) ?? '',
      })
      setTwTestState(twInteg?.api_key ? 'ok' : 'idle')
    }

    setUserRole((roleRes?.role as UserRole | undefined) ?? 'viewer')
    setLoading(false)
  }, [activeBrand?.brand_id]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadData()
    return () => { saveTimers.current.forEach(clearTimeout) }
  }, [loadData])

  // Load team members when team tab selected
  useEffect(() => {
    if (activeTab !== 'team' || !activeBrand) return
    setTeamLoading(true)
    supabase.from('profiles').select('*').eq('brand_id', activeBrand.brand_id).order('created_at').then(({ data }) => {
      setTeamMembers((data as Profile[]) ?? [])
      setTeamLoading(false)
    })
  }, [activeTab, activeBrand?.brand_id]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Save helpers ──────────────────────────────────────────────────────────

  function afterSave(setSave: (s: SectionSave) => void, error: string | null) {
    if (error) {
      setSave({ state: 'error', error })
    } else {
      setSave({ state: 'saved', error: null })
      const t = setTimeout(() => setSave({ state: 'idle', error: null }), 2000)
      saveTimers.current.push(t)
    }
  }

  async function upsertConfig(kvs: Record<string, string>) {
    if (!activeBrand) throw new Error('No active brand')
    const rows = Object.entries(kvs).map(([key, value]) => ({ brand_id: activeBrand.brand_id, key, value }))
    const { error } = await supabase.from('brand_config').upsert(rows, { onConflict: 'brand_id,key' })
    if (error) throw error
  }

  async function upsertBrandSettings(update: Partial<BrandSettingsRow>) {
    if (!activeBrand) throw new Error('No active brand')
    const { error } = await supabase
      .from('brand_settings')
      .upsert({ brand_id: activeBrand.brand_id, ...update }, { onConflict: 'brand_id' })
    if (error) throw error
  }

  async function saveBrandProfile() {
    if (!activeBrand) return
    setBrandSave({ state: 'saving', error: null })
    const { error } = await supabase.from('brands').update({
      name: brandForm.name.trim(),
      industry: brandForm.industry.trim() || null,
      logo_url: brandForm.logo_url.trim() || null,
    }).eq('brand_id', activeBrand.brand_id)
    afterSave(setBrandSave, error?.message ?? null)
  }

  async function saveThresholds() {
    setThresholdsSave({ state: 'saving', error: null })
    try {
      await upsertConfig({ min_roas: thresholdsForm.min_roas, max_cac: thresholdsForm.max_cac, spend_anomaly_pct: thresholdsForm.spend_anomaly_pct })
      afterSave(setThresholdsSave, null)
    } catch (e) { afterSave(setThresholdsSave, e instanceof Error ? e.message : 'Save failed') }
  }

  async function saveReporting() {
    setReportSave({ state: 'saving', error: null })
    try {
      await upsertConfig({ report_day: reportForm.report_day, report_time: reportForm.report_time, report_timezone: reportForm.report_timezone, alert_email: reportForm.alert_email })
      afterSave(setReportSave, null)
    } catch (e) { afterSave(setReportSave, e instanceof Error ? e.message : 'Save failed') }
  }

  async function saveCoo() {
    setCooSave({ state: 'saving', error: null })
    try {
      await upsertConfig({ slack_channel: cooForm.slack_channel, coo_channel_slack: String(cooForm.coo_channel_slack), coo_channel_artifact: String(cooForm.coo_channel_artifact) })
      afterSave(setCooSave, null)
    } catch (e) { afterSave(setCooSave, e instanceof Error ? e.message : 'Save failed') }
  }

  async function saveContentSchedule() {
    setScheduleSave({ state: 'saving', error: null })
    try {
      await upsertBrandSettings({ content_schedule: contentSchedule } as Partial<BrandSettingsRow>)
      afterSave(setScheduleSave, null)
    } catch (e) { afterSave(setScheduleSave, e instanceof Error ? e.message : 'Save failed') }
  }

  async function saveAIModel() {
    setAiSave({ state: 'saving', error: null })
    try {
      const update: Record<string, string> = { llm_provider: aiForm.llm_provider, llm_model: aiForm.llm_model }
      if (aiForm.llm_api_key.trim()) update.llm_api_key_encrypted = aiForm.llm_api_key.trim()
      await upsertBrandSettings(update as Partial<BrandSettingsRow>)
      setAiForm((f) => ({ ...f, llm_api_key: '' }))
      afterSave(setAiSave, null)
    } catch (e) { afterSave(setAiSave, e instanceof Error ? e.message : 'Save failed') }
  }

  async function saveIntegrations() {
    setIntegSave({ state: 'saving', error: null })
    try {
      // Read existing integrations first so we don't wipe stored tokens when fields are blank
      const existing = (brandSettings?.integrations ?? {}) as Record<string, Record<string, string | boolean | null> | string | null>
      const existingShopify = existing.shopify as Record<string, string | boolean | null> | undefined
      const existingTw = existing.triple_whale as Record<string, string | boolean | null> | undefined

      const integrations = {
        shopify: {
          connected: !!(integForm.shopify_store_url && integForm.shopify_blog_id),
          store_url: integForm.shopify_store_url || (existingShopify?.store_url ?? null),
          blog_id: integForm.shopify_blog_id || (existingShopify?.blog_id ?? null),
          // Only update token if a new one was entered; otherwise keep existing
          access_token: integForm.shopify_access_token.trim() || (existingShopify?.access_token ?? null),
        },
        dotdigital: { connected: !!integForm.dotdigital_endpoint, endpoint: integForm.dotdigital_endpoint || null },
        gorgias: { connected: false },
        triple_whale: {
          connected: twTestState === 'ok',
          api_key: integForm.triple_whale_api_key.trim() || (existingTw?.api_key ?? null),
          shop_domain: integForm.triple_whale_shop_domain.trim() || (existingTw?.shop_domain as string | null) || 'plasmaide-uk.myshopify.com',
        },
        n8n_webhook_base: integForm.n8n_webhook_base || null,
      }
      await upsertBrandSettings({ integrations } as Partial<BrandSettingsRow>)
      if (integForm.n8n_webhook_base) await upsertConfig({ n8n_webhook_base: integForm.n8n_webhook_base })
      // Clear sensitive fields after save
      setIntegForm((f) => ({ ...f, shopify_access_token: '', triple_whale_api_key: '' }))
      afterSave(setIntegSave, null)
    } catch (e) { afterSave(setIntegSave, e instanceof Error ? e.message : 'Save failed') }
  }

  async function handleTestTripleWhale() {
    setTwTestState('testing')
    const res = await fetch('/api/integrations/triple-whale/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ brand_id: activeBrand?.brand_id, api_key: integForm.triple_whale_api_key.trim() || undefined }),
    })
    const data = await res.json()
    setTwTestState(data.ok ? 'ok' : 'fail')
  }

  async function handleGenerateNow() {
    if (!activeBrand) return
    setGenerateNowState('loading')
    try {
      const res = await fetch(`/api/cron/generate-content?force=1&brand_id=${activeBrand.brand_id}`, { method: 'GET' })
      const data = await res.json()
      setGenerateNowState(data.ok ? 'done' : 'error')
    } catch { setGenerateNowState('error') }
    setTimeout(() => setGenerateNowState('idle'), 3000)
  }

  async function handleTestAI() {
    setTestingAI(true)
    setAiTestResult(null)
    try {
      const key = aiForm.llm_api_key.trim() || brandSettings?.llm_api_key_encrypted || process.env.NEXT_PUBLIC_TEST_KEY
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key ?? '', 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: aiForm.llm_model, max_tokens: 10, messages: [{ role: 'user', content: 'Say "ok"' }] }),
      })
      setAiTestResult(res.ok ? 'ok' : 'fail')
    } catch { setAiTestResult('fail') }
    setTestingAI(false)
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setInviteState('sending')
    setInviteError('')
    const res = await fetch('/api/team/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
    })
    const data = await res.json()
    if (!res.ok) { setInviteState('error'); setInviteError(data.error ?? 'Failed to send invite'); return }
    setInviteState('sent')
    setInviteEmail('')
    setTimeout(() => { setInviteState('idle'); loadData() }, 2000)
  }

  async function handleRoleChange(memberId: string, role: UserRole) {
    await fetch('/api/team/update-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, role }),
    })
    setTeamMembers((m) => m.map((p) => p.id === memberId ? { ...p, role } : p))
  }

  async function handleRemoveMember(memberId: string) {
    if (!confirm('Remove this team member? They will lose access immediately.')) return
    await fetch('/api/team/remove', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId }),
    })
    setTeamMembers((m) => m.filter((p) => p.id !== memberId))
  }

  const isReadOnly = userRole !== 'admin'
  const isAdmin = userRole === 'admin'

  // ── Render ────────────────────────────────────────────────────────────────

  if (!activeBrand) {
    return (
      <div className="p-6">
        <PageHeader title="Settings" description="Brand configuration, integrations, and schedule." />
        <div className="mt-6 bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
          Select a brand to view settings.
        </div>
      </div>
    )
  }

  const visibleTabs = TABS.filter((t) => !('adminOnly' in t && t.adminOnly) || isAdmin)

  return (
    <div className="p-6">
      <PageHeader title="Settings" description="Brand configuration, integrations, and schedule." />

      {/* Tabs */}
      <div className="mt-6 border-b border-gray-200 overflow-x-auto">
        <nav className="-mb-px flex gap-6 min-w-max">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Fetch error */}
      {fetchError && (
        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {fetchError}
        </div>
      )}

      {/* Read-only notice for non-admins */}
      {isReadOnly && (
        <div className="mt-4 px-4 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          You have {userRole} access — settings are read-only.
        </div>
      )}

      <div className="mt-6 max-w-2xl space-y-6">

        {/* ── Brand Profile ───────────────────────────────────────────────── */}
        {activeTab === 'brand' && (
          loading ? <SkeletonSection /> : (
            <Section title="Brand Profile" description="Core identity used across the dashboard and in agent context." save={brandSave} onSave={saveBrandProfile} readOnly={isReadOnly}>
              <div>
                <Label>Brand name</Label>
                <TextInput value={brandForm.name} onChange={(v) => setBrandForm((f) => ({ ...f, name: v }))} placeholder="Plasmaide" disabled={isReadOnly} />
              </div>
              <div>
                <Label>Industry</Label>
                <TextInput value={brandForm.industry} onChange={(v) => setBrandForm((f) => ({ ...f, industry: v }))} placeholder="Supplements" disabled={isReadOnly} />
                <Hint>Used as context for agent prompts.</Hint>
              </div>
              <div>
                <Label>Logo URL</Label>
                <TextInput value={brandForm.logo_url} onChange={(v) => setBrandForm((f) => ({ ...f, logo_url: v }))} placeholder="https://..." type="url" disabled={isReadOnly} />
                <Hint>Publicly accessible image URL.</Hint>
              </div>
              <div>
                <Label>Brand ID</Label>
                <TextInput value={activeBrand.brand_id} onChange={() => {}} disabled />
                <Hint>Read-only. Primary key across all tables.</Hint>
              </div>
            </Section>
          )
        )}

        {/* ── Content Schedule ────────────────────────────────────────────── */}
        {activeTab === 'schedule' && (
          loading ? <SkeletonSection /> : (
            <Section
              title="Content Schedule"
              description="Auto-generate content on a recurring schedule via Vercel Cron."
              save={scheduleSave}
              onSave={saveContentSchedule}
              readOnly={isReadOnly}
              footer={
                <button
                  type="button"
                  onClick={handleGenerateNow}
                  disabled={generateNowState === 'loading'}
                  className="px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {generateNowState === 'loading' ? 'Generating…' : generateNowState === 'done' ? '✓ Done' : generateNowState === 'error' ? 'Error' : 'Generate now'}
                </button>
              }
            >
              <Toggle
                checked={contentSchedule.enabled}
                onChange={(v) => setContentSchedule((s) => ({ ...s, enabled: v }))}
                label="Enable scheduled generation"
                description="The Vercel cron job runs hourly and generates content when it's time."
                disabled={isReadOnly}
              />

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Frequency</Label>
                  <SelectInput
                    value={contentSchedule.frequency}
                    onChange={(v) => setContentSchedule((s) => ({ ...s, frequency: v as ContentSchedule['frequency'] }))}
                    options={[
                      { value: 'daily', label: 'Daily' },
                      { value: 'weekdays', label: 'Weekdays only' },
                      { value: 'weekly', label: 'Weekly (Monday)' },
                    ]}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label>Time</Label>
                  <TextInput type="time" value={contentSchedule.time} onChange={(v) => setContentSchedule((s) => ({ ...s, time: v }))} disabled={isReadOnly} />
                </div>
              </div>

              <div>
                <Label>Timezone</Label>
                <SelectInput value={contentSchedule.timezone} onChange={(v) => setContentSchedule((s) => ({ ...s, timezone: v }))} options={TIMEZONES} disabled={isReadOnly} />
              </div>

              <div>
                <Label>Content types to generate</Label>
                <div className="mt-2 flex flex-wrap gap-3">
                  {CONTENT_TYPE_OPTIONS.map((opt) => (
                    <label key={opt.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={contentSchedule.content_types.includes(opt.id as never)}
                        onChange={(e) => {
                          const types = e.target.checked
                            ? [...contentSchedule.content_types, opt.id as never]
                            : contentSchedule.content_types.filter((t) => t !== opt.id)
                          setContentSchedule((s) => ({ ...s, content_types: types }))
                        }}
                        disabled={isReadOnly}
                        className="rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <Label>Topics queue</Label>
                <div className="space-y-2">
                  {contentSchedule.topics_queue.map((topic, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="flex-1 text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded px-3 py-1.5">{topic}</span>
                      {!isReadOnly && (
                        <button type="button" onClick={() => setContentSchedule((s) => ({ ...s, topics_queue: s.topics_queue.filter((_, j) => j !== i) }))}
                          className="text-gray-400 hover:text-red-500 transition-colors text-xs px-2 py-1">Remove</button>
                      )}
                    </div>
                  ))}
                  {!isReadOnly && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newTopic}
                        onChange={(e) => setNewTopic(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTopic.trim()) {
                            setContentSchedule((s) => ({ ...s, topics_queue: [...s.topics_queue, newTopic.trim()] }))
                            setNewTopic('')
                          }
                        }}
                        placeholder="Add topic and press Enter…"
                        className="flex-1 rounded-md border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      />
                      <button
                        type="button"
                        onClick={() => { if (newTopic.trim()) { setContentSchedule((s) => ({ ...s, topics_queue: [...s.topics_queue, newTopic.trim()] })); setNewTopic('') } }}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >Add</button>
                    </div>
                  )}
                </div>
                <Hint>The cron job cycles through these topics. Leave empty to use a default topic.</Hint>
              </div>

              <Toggle
                checked={contentSchedule.auto_approve}
                onChange={(v) => setContentSchedule((s) => ({ ...s, auto_approve: v }))}
                label="Auto-approve generated content"
                description="Skips the approval queue and inserts as 'approved'. Use with caution."
                disabled={isReadOnly}
              />
            </Section>
          )
        )}

        {/* ── AI Model ────────────────────────────────────────────────────── */}
        {activeTab === 'ai' && (
          loading ? <SkeletonSection /> : (
            <Section title="AI Model" description="Which LLM to use for content generation." save={aiSave} onSave={saveAIModel} readOnly={isReadOnly}
              footer={
                <div className="flex items-center gap-2">
                  {aiTestResult === 'ok' && <span className="text-xs text-green-600">✓ Connection OK</span>}
                  {aiTestResult === 'fail' && <span className="text-xs text-red-500">Connection failed</span>}
                  <button type="button" onClick={handleTestAI} disabled={testingAI}
                    className="px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors">
                    {testingAI ? 'Testing…' : 'Test connection'}
                  </button>
                </div>
              }
            >
              <div>
                <Label>Provider</Label>
                <SelectInput
                  value={aiForm.llm_provider}
                  onChange={(v) => setAiForm((f) => ({ ...f, llm_provider: v }))}
                  options={[
                    { value: 'anthropic', label: 'Anthropic (Claude)' },
                    { value: 'openai', label: 'OpenAI — coming soon' },
                    { value: 'google', label: 'Google Gemini — coming soon' },
                  ]}
                  disabled={isReadOnly}
                />
                {aiForm.llm_provider !== 'anthropic' && (
                  <p className="mt-1.5 text-xs text-amber-600">Only Anthropic is supported in this version.</p>
                )}
              </div>

              {aiForm.llm_provider === 'anthropic' && (
                <div>
                  <Label>Model</Label>
                  <SelectInput value={aiForm.llm_model} onChange={(v) => setAiForm((f) => ({ ...f, llm_model: v }))} options={ANTHROPIC_MODELS} disabled={isReadOnly} />
                </div>
              )}

              <div>
                <Label>API key</Label>
                <TextInput
                  type="password"
                  value={aiForm.llm_api_key}
                  onChange={(v) => setAiForm((f) => ({ ...f, llm_api_key: v }))}
                  placeholder={brandSettings?.llm_api_key_encrypted ? '••••••••••••••••' : 'sk-ant-…'}
                  disabled={isReadOnly}
                />
                <Hint>Leave blank to use the system key (ANTHROPIC_API_KEY env var). Stored encrypted.</Hint>
              </div>
            </Section>
          )
        )}

        {/* ── Integrations ────────────────────────────────────────────────── */}
        {activeTab === 'integrations' && (
          loading ? <SkeletonSection /> : (
            <Section title="Integrations" description="Platform connections for publishing and automation." save={integSave} onSave={saveIntegrations} readOnly={isReadOnly}>

              {/* Shopify */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">Shopify</h4>
                  <ConnectedBadge connected={!!(brandSettings?.integrations?.shopify?.connected)} />
                </div>
                <div>
                  <Label>Store URL</Label>
                  <TextInput value={integForm.shopify_store_url} onChange={(v) => setIntegForm((f) => ({ ...f, shopify_store_url: v }))} placeholder="yourstore.myshopify.com" disabled={isReadOnly} />
                </div>
                <div>
                  <Label>Blog ID</Label>
                  <TextInput value={integForm.shopify_blog_id} onChange={(v) => setIntegForm((f) => ({ ...f, shopify_blog_id: v }))} placeholder="94553112861" disabled={isReadOnly} />
                  <Hint>Find in Shopify Admin → Online Store → Blog Posts → URL.</Hint>
                </div>
                <div>
                  <Label>Admin API access token</Label>
                  <TextInput
                    type="password"
                    value={integForm.shopify_access_token}
                    onChange={(v) => setIntegForm((f) => ({ ...f, shopify_access_token: v }))}
                    placeholder={(brandSettings?.integrations as unknown as Record<string, Record<string, string | null>> | null)?.shopify?.access_token ? '••••••••••••••••' : 'shpat_…'}
                    disabled={isReadOnly}
                  />
                  <Hint>Required for dashboard revenue metrics. Shopify Admin → Settings → Apps and sales channels → Develop apps → your app → API credentials.</Hint>
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">DotDigital</h4>
                  <ConnectedBadge connected={!!(brandSettings?.integrations?.dotdigital?.connected)} />
                </div>
                <div>
                  <Label>API endpoint</Label>
                  <TextInput value={integForm.dotdigital_endpoint} onChange={(v) => setIntegForm((f) => ({ ...f, dotdigital_endpoint: v }))} placeholder="https://r3-api.dotdigital.com" disabled={isReadOnly} />
                </div>
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <h4 className="text-sm font-medium text-gray-900">n8n</h4>
                <div>
                  <Label>Webhook base URL</Label>
                  <TextInput value={integForm.n8n_webhook_base} onChange={(v) => setIntegForm((f) => ({ ...f, n8n_webhook_base: v }))} placeholder="https://plasmaide.app.n8n.cloud/webhook/" disabled={isReadOnly} />
                  <Hint>Base URL used to construct all n8n webhook URLs. Credentials are stored in n8n — not here.</Hint>
                </div>
              </div>

              {/* Triple Whale */}
              <div className="border-t border-gray-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-medium text-gray-900">Triple Whale</h4>
                  <ConnectedBadge connected={twTestState === 'ok'} />
                </div>
                <div>
                  <Label>API key</Label>
                  <TextInput
                    type="password"
                    value={integForm.triple_whale_api_key}
                    onChange={(v) => { setIntegForm((f) => ({ ...f, triple_whale_api_key: v })); setTwTestState('idle') }}
                    placeholder={(brandSettings?.integrations as unknown as Record<string, Record<string, string | null>> | null)?.triple_whale?.api_key ? '••••••••••••••••' : 'tw_…'}
                    disabled={isReadOnly}
                  />
                </div>
                <div>
                  <Label>Shop domain</Label>
                  <TextInput
                    value={integForm.triple_whale_shop_domain}
                    onChange={(v) => setIntegForm((f) => ({ ...f, triple_whale_shop_domain: v }))}
                    placeholder="plasmaide-uk.myshopify.com"
                    disabled={isReadOnly}
                  />
                </div>
                {!isReadOnly && (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={handleTestTripleWhale}
                      disabled={twTestState === 'testing'}
                      className="px-3 py-2 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                    >
                      {twTestState === 'testing' ? 'Testing…' : 'Test connection'}
                    </button>
                    {twTestState === 'ok' && <span className="text-xs text-green-600">✓ Connected</span>}
                    {twTestState === 'fail' && <span className="text-xs text-red-500">Connection failed — check your API key</span>}
                  </div>
                )}
              </div>

              {/* Gorgias */}
              <div className="border-t border-gray-100 pt-4">
                <div className="flex items-center justify-between py-2">
                  <div>
                    <span className="text-sm font-medium text-gray-900">Gorgias</span>
                    <span className="ml-2 text-xs text-gray-400">Coming soon — Phase 3</span>
                  </div>
                  <ConnectedBadge connected={false} />
                </div>
              </div>
            </Section>
          )
        )}

        {/* ── Alert Thresholds ────────────────────────────────────────────── */}
        {activeTab === 'thresholds' && (
          loading ? <SkeletonSection /> : (
            <Section title="Alert Thresholds" description="The CFO and Intelligence agents monitor these. Breaches trigger a COO alert." save={thresholdsSave} onSave={saveThresholds} readOnly={isReadOnly}>
              <div>
                <Label>Minimum ROAS</Label>
                <div className="flex items-center gap-2">
                  <NumberInput value={thresholdsForm.min_roas} onChange={(v) => setThresholdsForm((f) => ({ ...f, min_roas: v }))} min={0} step={0.1} disabled={isReadOnly} />
                  <span className="text-sm text-gray-400 whitespace-nowrap">× return</span>
                </div>
                <Hint>Campaign ROAS below this triggers a COO alert. Default: 2.0</Hint>
              </div>
              <div>
                <Label>Maximum CAC</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">$</span>
                  <NumberInput value={thresholdsForm.max_cac} onChange={(v) => setThresholdsForm((f) => ({ ...f, max_cac: v }))} min={0} step={1} disabled={isReadOnly} />
                  <span className="text-sm text-gray-400 whitespace-nowrap">AUD</span>
                </div>
                <Hint>CAC above this triggers a COO alert. Default: $40 AUD</Hint>
              </div>
              <div>
                <Label>Spend anomaly threshold</Label>
                <div className="flex items-center gap-2">
                  <NumberInput value={thresholdsForm.spend_anomaly_pct} onChange={(v) => setThresholdsForm((f) => ({ ...f, spend_anomaly_pct: v }))} min={1} max={100} step={1} disabled={isReadOnly} />
                  <span className="text-sm text-gray-400 whitespace-nowrap">% above 7-day average</span>
                </div>
                <Hint>Ad spend exceeding this % triggers a COO alert. Default: 20%</Hint>
              </div>
            </Section>
          )
        )}

        {/* ── Reporting Schedule ──────────────────────────────────────────── */}
        {activeTab === 'reporting' && (
          loading ? <SkeletonSection /> : (
            <Section title="Reporting Schedule" description="When the COO Agent sends the weekly executive report." save={reportSave} onSave={saveReporting} readOnly={isReadOnly}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Report day</Label>
                  <SelectInput value={reportForm.report_day} onChange={(v) => setReportForm((f) => ({ ...f, report_day: v }))} options={DAYS} disabled={isReadOnly} />
                </div>
                <div>
                  <Label>Report time</Label>
                  <TextInput type="time" value={reportForm.report_time} onChange={(v) => setReportForm((f) => ({ ...f, report_time: v }))} disabled={isReadOnly} />
                </div>
              </div>
              <div>
                <Label>Timezone</Label>
                <SelectInput value={reportForm.report_timezone} onChange={(v) => setReportForm((f) => ({ ...f, report_timezone: v }))} options={TIMEZONES} disabled={isReadOnly} />
                <Hint>All report times run in this timezone.</Hint>
              </div>
              <div>
                <Label>Alert email</Label>
                <TextInput type="email" value={reportForm.alert_email} onChange={(v) => setReportForm((f) => ({ ...f, alert_email: v }))} placeholder="you@brand.com" disabled={isReadOnly} />
                <Hint>Receives escalation alerts and the weekly COO report.</Hint>
              </div>
            </Section>
          )
        )}

        {/* ── COO Channels ────────────────────────────────────────────────── */}
        {activeTab === 'coo' && (
          loading ? <SkeletonSection /> : (
            <Section title="COO Channels" description="Where the COO Agent sends alerts, reports, and approval requests." save={cooSave} onSave={saveCoo} readOnly={isReadOnly}>
              <Toggle checked={cooForm.coo_channel_artifact} onChange={(v) => setCooForm((f) => ({ ...f, coo_channel_artifact: v }))} label="Dashboard (Artifact)" description="Approval queues and alerts appear in this dashboard. Recommended: always on." disabled={isReadOnly} />
              <Toggle checked={cooForm.coo_channel_slack} onChange={(v) => setCooForm((f) => ({ ...f, coo_channel_slack: v }))} label="Slack" description="COO Agent posts alerts and weekly reports to the Slack channel." disabled={isReadOnly} />
              {cooForm.coo_channel_slack && (
                <div>
                  <Label>Slack channel</Label>
                  <TextInput value={cooForm.slack_channel} onChange={(v) => setCooForm((f) => ({ ...f, slack_channel: v }))} placeholder="#plasmaide-coo" disabled={isReadOnly} />
                  <Hint>Include the # prefix. Slack credential is configured in n8n.</Hint>
                </div>
              )}
              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">Gmail (Phase 4+) and WhatsApp (Phase 5+) channels coming.</p>
              </div>
            </Section>
          )
        )}

        {/* ── Team ────────────────────────────────────────────────────────── */}
        {activeTab === 'team' && isAdmin && (
          <div className="space-y-6">
            {/* Team list */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Team members</h3>
                <p className="text-xs text-gray-400 mt-0.5">Manage access for {activeBrand.brand_id}.</p>
              </div>
              <div className="divide-y divide-gray-100">
                {teamLoading ? (
                  <div className="px-5 py-4 animate-pulse space-y-3">
                    {[1, 2].map((i) => <div key={i} className="h-8 bg-gray-100 rounded" />)}
                  </div>
                ) : teamMembers.length === 0 ? (
                  <p className="px-5 py-4 text-sm text-gray-400">No team members found.</p>
                ) : (
                  teamMembers.map((member) => (
                    <div key={member.id} className="px-5 py-3 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{member.email}</p>
                        <p className="text-xs text-gray-400">{new Date(member.created_at).toLocaleDateString()}</p>
                      </div>
                      <select
                        value={member.role}
                        onChange={(e) => handleRoleChange(member.id, e.target.value as UserRole)}
                        className="text-xs border border-gray-200 rounded px-2 py-1 bg-white text-gray-700"
                      >
                        <option value="admin">Admin</option>
                        <option value="approver">Approver</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.id)}
                        className="text-xs text-red-400 hover:text-red-600 px-2 py-1 transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Invite */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Invite team member</h3>
                <p className="text-xs text-gray-400 mt-0.5">They will receive an email invite and be assigned to this brand.</p>
              </div>
              <form onSubmit={handleInvite} className="px-5 py-5 space-y-4">
                {inviteState === 'error' && (
                  <div className="px-3 py-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">{inviteError}</div>
                )}
                {inviteState === 'sent' && (
                  <div className="px-3 py-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">✓ Invite sent.</div>
                )}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>Email</Label>
                    <TextInput type="email" value={inviteEmail} onChange={setInviteEmail} placeholder="teammate@brand.com" />
                  </div>
                  <div>
                    <Label>Role</Label>
                    <SelectInput
                      value={inviteRole}
                      onChange={(v) => setInviteRole(v as UserRole)}
                      options={[{ value: 'admin', label: 'Admin' }, { value: 'approver', label: 'Approver' }, { value: 'viewer', label: 'Viewer' }]}
                    />
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={inviteState === 'sending' || !inviteEmail}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 disabled:opacity-50 transition-colors"
                >
                  {inviteState === 'sending' ? 'Sending…' : 'Send invite'}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ── Billing ─────────────────────────────────────────────────────── */}
        {activeTab === 'billing' && isAdmin && brandSettings && (
          <div className="space-y-6">
            {/* Current plan */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Current plan</h3>
              </div>
              <div className="px-5 py-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Badge className={PLAN_COLORS[brandSettings.plan]}>{PLAN_LABELS[brandSettings.plan]}</Badge>
                  <Badge className={STATUS_COLORS[brandSettings.subscription_status] ?? 'bg-gray-100 text-gray-500'}>
                    {brandSettings.subscription_status.replace('_', ' ')}
                  </Badge>
                  {brandSettings.trial_ends_at && brandSettings.subscription_status === 'trialing' && (
                    <span className="text-xs text-gray-400">
                      Trial ends {new Date(brandSettings.trial_ends_at).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Usage */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm text-gray-600">Content generations this month</span>
                    <span className="text-sm font-medium text-gray-900">
                      {brandSettings.generations_this_month} / {PLAN_FEATURES[brandSettings.plan].gens}
                    </span>
                  </div>
                  {PLAN_FEATURES[brandSettings.plan].gens !== 'Unlimited' && (
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className="bg-gray-900 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(100, (brandSettings.generations_this_month / ({ starter: 50, growth: 200 } as Record<string, number>)[brandSettings.plan]) * 100)}%`
                        }}
                      />
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => window.location.href = '/settings?billing=upgrade'}
                  className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-md hover:bg-gray-700 transition-colors"
                >
                  Upgrade plan
                </button>
              </div>
            </div>

            {/* Plan comparison */}
            <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-900">Plan comparison</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="px-5 py-3 text-left font-medium text-gray-500 text-xs w-32">Feature</th>
                      {Object.entries(PLAN_LABELS).map(([key, label]) => (
                        <th key={key} className={`px-4 py-3 text-center font-medium text-xs ${key === brandSettings.plan ? 'text-gray-900' : 'text-gray-400'}`}>
                          {label}{key === brandSettings.plan ? ' ✓' : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { label: 'Generations/mo', key: 'gens' },
                      { label: 'Users', key: 'users' },
                      { label: 'Content types', key: 'types' },
                    ].map((row) => (
                      <tr key={row.key}>
                        <td className="px-5 py-2.5 text-xs text-gray-500">{row.label}</td>
                        {Object.keys(PLAN_FEATURES).map((plan) => (
                          <td key={plan} className="px-4 py-2.5 text-xs text-center text-gray-700">{PLAN_FEATURES[plan][row.key as keyof typeof PLAN_FEATURES[string]]}</td>
                        ))}
                      </tr>
                    ))}
                    <tr>
                      <td className="px-5 py-2.5 text-xs text-gray-500">Extras</td>
                      {Object.keys(PLAN_FEATURES).map((plan) => (
                        <td key={plan} className="px-4 py-2.5 text-xs text-center text-gray-700">
                          {PLAN_FEATURES[plan].extras.length === 0 ? '—' : PLAN_FEATURES[plan].extras.join(', ')}
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

function SkeletonSection() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 px-5 py-5 space-y-5">
      {[1, 2, 3].map((i) => (
        <div key={i} className="space-y-1.5 animate-pulse">
          <div className="h-3.5 bg-gray-100 rounded w-24" />
          <div className="h-9 bg-gray-100 rounded w-full" />
        </div>
      ))}
    </div>
  )
}
