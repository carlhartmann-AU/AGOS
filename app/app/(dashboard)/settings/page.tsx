'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'
import type { Brand, BrandSettings } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

const TIMEZONES = [
  'Australia/Brisbane',
  'Australia/Sydney',
  'Australia/Melbourne',
  'Australia/Adelaide',
  'Australia/Perth',
  'Pacific/Auckland',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Paris',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'UTC',
]

const TABS = [
  { id: 'brand',      label: 'Brand Profile' },
  { id: 'thresholds', label: 'Alert Thresholds' },
  { id: 'schedule',   label: 'Reporting Schedule' },
  { id: 'coo',        label: 'COO Channels' },
] as const

type TabId = typeof TABS[number]['id']
type SaveState = 'idle' | 'saving' | 'saved' | 'error'

// ─── Form state types ─────────────────────────────────────────────────────────

type BrandForm = {
  name: string
  industry: string
  logo_url: string
}

type ThresholdsForm = {
  min_roas: string
  max_cac: string
  spend_anomaly_pct: string
}

type ScheduleForm = {
  report_day: string
  report_time: string
  report_timezone: string
  alert_email: string
}

type CooForm = {
  slack_channel: string
  coo_channel_slack: boolean
  coo_channel_artifact: boolean
}

type SectionSave = { state: SaveState; error: string | null }

// ─── Primitive UI helpers ─────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {children}
    </label>
  )
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs text-gray-400">{children}</p>
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = 'text',
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  type?: string
  disabled?: boolean
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
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900
                 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                 disabled:bg-gray-50 disabled:text-gray-400 transition"
    />
  )
}

function SelectInput({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  options: string[] | { value: string; label: string }[]
  disabled?: boolean
}) {
  const normalised = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o
  )
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled}
      className="block w-full rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-900
                 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent
                 disabled:bg-gray-50 disabled:text-gray-400 transition bg-white"
    >
      {normalised.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
  description?: string
  disabled?: boolean
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
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow
                      transition-transform
                      ${checked ? 'translate-x-5' : 'translate-x-0.5'}`}
        />
      </button>
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
    </div>
  )
}

function SaveButton({
  save,
  onClick,
}: {
  save: SectionSave
  onClick: () => void
}) {
  const { state } = save
  const styles: Record<SaveState, string> = {
    idle:   'bg-gray-900 text-white hover:bg-gray-700',
    saving: 'bg-gray-400 text-white cursor-not-allowed',
    saved:  'bg-green-600 text-white',
    error:  'bg-red-600 text-white hover:bg-red-700',
  }
  const labels: Record<SaveState, string> = {
    idle:   'Save changes',
    saving: 'Saving…',
    saved:  '✓ Saved',
    error:  'Error — try again',
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={state === 'saving'}
      className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${styles[state]}`}
    >
      {labels[state]}
    </button>
  )
}

// Section shell — header + scrollable body + footer with save
function Section({
  title,
  description,
  save,
  onSave,
  children,
}: {
  title: string
  description: string
  save: SectionSave
  onSave: () => void
  children: React.ReactNode
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
        <SaveButton save={save} onClick={onSave} />
      </div>
    </div>
  )
}

// Skeleton for loading state — mirrors a generic form field
function FieldSkeleton() {
  return (
    <div className="space-y-1.5 animate-pulse">
      <div className="h-3.5 bg-gray-100 rounded w-24" />
      <div className="h-9 bg-gray-100 rounded w-full" />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

const DEFAULTS: BrandSettings = {
  min_roas: '2.0',
  max_cac: '40',
  spend_anomaly_pct: '20',
  report_day: 'Monday',
  report_time: '08:00',
  report_timezone: 'Australia/Brisbane',
  alert_email: '',
  slack_channel: '',
  coo_channel_slack: 'true',
  coo_channel_artifact: 'true',
  shopify_store: '',
  email_platform: '',
  shopify_markets: '',
  base_locale: '',
  cs_platform: '',
  refund_threshold_aud: '',
  b2b_daily_outreach_limit: '',
}

export default function SettingsPage() {
  const { activeBrand } = useBrand()
  const supabase = createClient()

  const [activeTab, setActiveTab] = useState<TabId>('brand')
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Form state — one object per section
  const [brandForm, setBrandForm] = useState<BrandForm>({ name: '', industry: '', logo_url: '' })
  const [thresholdsForm, setThresholdsForm] = useState<ThresholdsForm>({
    min_roas: DEFAULTS.min_roas,
    max_cac: DEFAULTS.max_cac,
    spend_anomaly_pct: DEFAULTS.spend_anomaly_pct,
  })
  const [scheduleForm, setScheduleForm] = useState<ScheduleForm>({
    report_day: DEFAULTS.report_day,
    report_time: DEFAULTS.report_time,
    report_timezone: DEFAULTS.report_timezone,
    alert_email: DEFAULTS.alert_email,
  })
  const [cooForm, setCooForm] = useState<CooForm>({
    slack_channel: DEFAULTS.slack_channel,
    coo_channel_slack: true,
    coo_channel_artifact: true,
  })

  // Per-section save state
  const [brandSave, setBrandSave] = useState<SectionSave>({ state: 'idle', error: null })
  const [thresholdsSave, setThresholdsSave] = useState<SectionSave>({ state: 'idle', error: null })
  const [scheduleSave, setScheduleSave] = useState<SectionSave>({ state: 'idle', error: null })
  const [cooSave, setCooSave] = useState<SectionSave>({ state: 'idle', error: null })

  // Stable ref for timers so we can clear on unmount / brand change
  const saveTimers = useRef<ReturnType<typeof setTimeout>[]>([])

  // ── Data loading ──────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeBrand) {
      setLoading(false)
      return
    }

    const brandId = activeBrand.brand_id
    setLoading(true)
    setFetchError(null)

    // Clear any pending "saved → idle" timers
    saveTimers.current.forEach(clearTimeout)
    saveTimers.current = []

    // Reset all save states when brand changes
    setBrandSave({ state: 'idle', error: null })
    setThresholdsSave({ state: 'idle', error: null })
    setScheduleSave({ state: 'idle', error: null })
    setCooSave({ state: 'idle', error: null })

    Promise.all([
      supabase.from('brands').select('*').eq('brand_id', brandId).single(),
      supabase.from('brand_config').select('key, value').eq('brand_id', brandId),
    ]).then(([brandResult, configResult]) => {
      if (brandResult.error) {
        setFetchError(`Failed to load brand: ${brandResult.error.message}`)
        setLoading(false)
        return
      }
      if (configResult.error) {
        setFetchError(`Failed to load config: ${configResult.error.message}`)
        setLoading(false)
        return
      }

      const b = brandResult.data as Brand
      setBrandForm({
        name: b.name ?? '',
        industry: b.industry ?? '',
        logo_url: b.logo_url ?? '',
      })

      // Convert rows to a lookup — missing keys fall back to DEFAULTS
      const cfg: Record<string, string> = {}
      for (const row of configResult.data ?? []) {
        if (row.value !== null) cfg[row.key] = row.value
      }
      const get = (k: keyof BrandSettings) => cfg[k] ?? DEFAULTS[k]

      setThresholdsForm({
        min_roas: get('min_roas'),
        max_cac: get('max_cac'),
        spend_anomaly_pct: get('spend_anomaly_pct'),
      })
      setScheduleForm({
        report_day: get('report_day'),
        report_time: get('report_time'),
        report_timezone: get('report_timezone'),
        alert_email: get('alert_email'),
      })
      setCooForm({
        slack_channel: get('slack_channel'),
        coo_channel_slack: get('coo_channel_slack') !== 'false',
        coo_channel_artifact: get('coo_channel_artifact') !== 'false',
      })

      setLoading(false)
    })

    return () => {
      saveTimers.current.forEach(clearTimeout)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.brand_id])

  // ── Save helpers ──────────────────────────────────────────────────────────

  function afterSave(
    setSave: (s: SectionSave) => void,
    error: string | null,
  ) {
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
    const rows = Object.entries(kvs).map(([key, value]) => ({
      brand_id: activeBrand.brand_id,
      key,
      value,
    }))
    const { error } = await supabase
      .from('brand_config')
      .upsert(rows, { onConflict: 'brand_id,key' })
    if (error) throw error
  }

  async function saveBrandProfile() {
    if (!activeBrand) return
    setBrandSave({ state: 'saving', error: null })
    const { error } = await supabase
      .from('brands')
      .update({
        name: brandForm.name.trim(),
        industry: brandForm.industry.trim() || null,
        logo_url: brandForm.logo_url.trim() || null,
      })
      .eq('brand_id', activeBrand.brand_id)
    afterSave(setBrandSave, error?.message ?? null)
  }

  async function saveThresholds() {
    setThresholdsSave({ state: 'saving', error: null })
    try {
      await upsertConfig({
        min_roas: thresholdsForm.min_roas,
        max_cac: thresholdsForm.max_cac,
        spend_anomaly_pct: thresholdsForm.spend_anomaly_pct,
      })
      afterSave(setThresholdsSave, null)
    } catch (err) {
      afterSave(setThresholdsSave, err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function saveSchedule() {
    setScheduleSave({ state: 'saving', error: null })
    try {
      await upsertConfig({
        report_day: scheduleForm.report_day,
        report_time: scheduleForm.report_time,
        report_timezone: scheduleForm.report_timezone,
        alert_email: scheduleForm.alert_email,
      })
      afterSave(setScheduleSave, null)
    } catch (err) {
      afterSave(setScheduleSave, err instanceof Error ? err.message : 'Save failed')
    }
  }

  async function saveCoo() {
    setCooSave({ state: 'saving', error: null })
    try {
      await upsertConfig({
        slack_channel: cooForm.slack_channel,
        coo_channel_slack: String(cooForm.coo_channel_slack),
        coo_channel_artifact: String(cooForm.coo_channel_artifact),
      })
      afterSave(setCooSave, null)
    } catch (err) {
      afterSave(setCooSave, err instanceof Error ? err.message : 'Save failed')
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!activeBrand) {
    return (
      <div className="p-6">
        <PageHeader title="Settings" description="Brand configuration, integrations, and thresholds." />
        <div className="mt-6 bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
          Select a brand to view settings.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Settings"
        description="Brand configuration, integrations, and thresholds."
      />

      {/* Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="-mb-px flex gap-6">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? 'border-gray-900 text-gray-900'
                  : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-300'
                }`}
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
          {fetchError.includes('does not exist') && (
            <span className="block mt-1 text-xs">
              Run <code className="bg-red-100 px-1 rounded">supabase/migrations/001_brand_config.sql</code> in the Supabase SQL editor first.
            </span>
          )}
        </div>
      )}

      {/* Tab content */}
      <div className="mt-6 max-w-2xl">

        {/* ── Brand Profile ───────────────────────────────────────────────── */}
        {activeTab === 'brand' && (
          loading ? (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-5 space-y-5">
              <FieldSkeleton /><FieldSkeleton /><FieldSkeleton />
            </div>
          ) : (
            <Section
              title="Brand Profile"
              description="Core identity shown across the dashboard and used in agent context."
              save={brandSave}
              onSave={saveBrandProfile}
            >
              <div>
                <Label>Brand name</Label>
                <TextInput
                  value={brandForm.name}
                  onChange={(v) => setBrandForm((f) => ({ ...f, name: v }))}
                  placeholder="Plasmaide"
                />
              </div>

              <div>
                <Label>Industry</Label>
                <TextInput
                  value={brandForm.industry}
                  onChange={(v) => setBrandForm((f) => ({ ...f, industry: v }))}
                  placeholder="Supplements"
                />
                <Hint>Used as context for agent prompts.</Hint>
              </div>

              <div>
                <Label>Logo URL</Label>
                <TextInput
                  value={brandForm.logo_url}
                  onChange={(v) => setBrandForm((f) => ({ ...f, logo_url: v }))}
                  placeholder="https://..."
                  type="url"
                />
                <Hint>Publicly accessible image URL. Shown in the dashboard header.</Hint>
              </div>

              <div>
                <Label>Brand ID</Label>
                <TextInput value={activeBrand.brand_id} onChange={() => {}} disabled />
                <Hint>Read-only. Used as the primary key across all tables.</Hint>
              </div>
            </Section>
          )
        )}

        {/* ── Alert Thresholds ────────────────────────────────────────────── */}
        {activeTab === 'thresholds' && (
          loading ? (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-5 space-y-5">
              <FieldSkeleton /><FieldSkeleton /><FieldSkeleton />
            </div>
          ) : (
            <Section
              title="Alert Thresholds"
              description="The CFO and Intelligence agents monitor these thresholds. Breaches trigger a COO alert."
              save={thresholdsSave}
              onSave={saveThresholds}
            >
              <div>
                <Label>Minimum ROAS</Label>
                <div className="flex items-center gap-2">
                  <NumberInput
                    value={thresholdsForm.min_roas}
                    onChange={(v) => setThresholdsForm((f) => ({ ...f, min_roas: v }))}
                    min={0}
                    step={0.1}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">× return</span>
                </div>
                <Hint>
                  Campaign ROAS below this value triggers a COO alert. Default: 2.0
                </Hint>
              </div>

              <div>
                <Label>Maximum CAC</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-400">$</span>
                  <NumberInput
                    value={thresholdsForm.max_cac}
                    onChange={(v) => setThresholdsForm((f) => ({ ...f, max_cac: v }))}
                    min={0}
                    step={1}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">AUD</span>
                </div>
                <Hint>
                  Customer acquisition cost above this triggers a COO alert. Default: $40 AUD
                </Hint>
              </div>

              <div>
                <Label>Spend anomaly threshold</Label>
                <div className="flex items-center gap-2">
                  <NumberInput
                    value={thresholdsForm.spend_anomaly_pct}
                    onChange={(v) => setThresholdsForm((f) => ({ ...f, spend_anomaly_pct: v }))}
                    min={1}
                    max={100}
                    step={1}
                  />
                  <span className="text-sm text-gray-400 whitespace-nowrap">% above 7-day average</span>
                </div>
                <Hint>
                  Ad spend exceeding this % above the rolling 7-day average triggers a COO alert. Default: 20%
                </Hint>
              </div>
            </Section>
          )
        )}

        {/* ── Reporting Schedule ──────────────────────────────────────────── */}
        {activeTab === 'schedule' && (
          loading ? (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-5 space-y-5">
              <FieldSkeleton /><FieldSkeleton /><FieldSkeleton /><FieldSkeleton />
            </div>
          ) : (
            <Section
              title="Reporting Schedule"
              description="When the COO Agent sends the weekly executive report."
              save={scheduleSave}
              onSave={saveSchedule}
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Report day</Label>
                  <SelectInput
                    value={scheduleForm.report_day}
                    onChange={(v) => setScheduleForm((f) => ({ ...f, report_day: v }))}
                    options={DAYS}
                  />
                </div>
                <div>
                  <Label>Report time</Label>
                  <TextInput
                    type="time"
                    value={scheduleForm.report_time}
                    onChange={(v) => setScheduleForm((f) => ({ ...f, report_time: v }))}
                  />
                </div>
              </div>

              <div>
                <Label>Timezone</Label>
                <SelectInput
                  value={scheduleForm.report_timezone}
                  onChange={(v) => setScheduleForm((f) => ({ ...f, report_timezone: v }))}
                  options={TIMEZONES}
                />
                <Hint>All report times and threshold checks run in this timezone.</Hint>
              </div>

              <div>
                <Label>Alert email</Label>
                <TextInput
                  type="email"
                  value={scheduleForm.alert_email}
                  onChange={(v) => setScheduleForm((f) => ({ ...f, alert_email: v }))}
                  placeholder="you@brand.com"
                />
                <Hint>Receives escalation alerts and the weekly COO report.</Hint>
              </div>
            </Section>
          )
        )}

        {/* ── COO Channels ────────────────────────────────────────────────── */}
        {activeTab === 'coo' && (
          loading ? (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-5 space-y-5">
              <FieldSkeleton /><FieldSkeleton /><FieldSkeleton />
            </div>
          ) : (
            <Section
              title="COO Channels"
              description="Where the COO Agent sends alerts, reports, and approval requests."
              save={cooSave}
              onSave={saveCoo}
            >
              <Toggle
                checked={cooForm.coo_channel_artifact}
                onChange={(v) => setCooForm((f) => ({ ...f, coo_channel_artifact: v }))}
                label="Dashboard (Artifact)"
                description="Approval queues and alerts appear in this dashboard. Recommended: always on."
              />

              <Toggle
                checked={cooForm.coo_channel_slack}
                onChange={(v) => setCooForm((f) => ({ ...f, coo_channel_slack: v }))}
                label="Slack"
                description="COO Agent posts alerts and weekly reports to the configured Slack channel."
              />

              {cooForm.coo_channel_slack && (
                <div>
                  <Label>Slack channel</Label>
                  <TextInput
                    value={cooForm.slack_channel}
                    onChange={(v) => setCooForm((f) => ({ ...f, slack_channel: v }))}
                    placeholder="#plasmaide-coo"
                  />
                  <Hint>
                    Must include the # prefix. The Slack credential is configured in n8n — not stored here.
                  </Hint>
                </div>
              )}

              <div className="pt-2 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  Gmail and WhatsApp channels are available in Phase 4+ and Phase 5+ respectively.
                </p>
              </div>
            </Section>
          )
        )}

      </div>
    </div>
  )
}
