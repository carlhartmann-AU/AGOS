// components/dashboard/KPIDashboard.tsx
'use client'

import { useCallback, useEffect, useRef, useState, useTransition } from 'react'
import type { KPIResult, WindowKey } from '@/lib/triple-whale/kpis'

interface Props {
  brandId: string
  /** Optional: initial currency override. Falls back to brand_settings.display_currency. */
  initialCurrency?: string
}

type Currency = 'AUD' | 'USD' | 'GBP' | 'EUR'

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string }> = [
  { key: '24h', label: '24 hours' },
  { key: '7d',  label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'mtd', label: 'Month to date' },
]

const CURRENCY_OPTIONS: Currency[] = ['AUD', 'USD', 'GBP', 'EUR']
const CURRENCY_STORAGE_KEY = 'agos.dashboard.currency'

// Safe localStorage helpers (SSR-safe; no-op server-side)
function getSavedCurrency(): string | null {
  if (typeof globalThis === 'undefined' || typeof (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage === 'undefined') {
    return null
  }
  try {
    return globalThis.localStorage.getItem(CURRENCY_STORAGE_KEY)
  } catch {
    return null
  }
}

function setSavedCurrency(value: string) {
  if (typeof globalThis === 'undefined' || typeof (globalThis as typeof globalThis & { localStorage?: Storage }).localStorage === 'undefined') {
    return
  }
  try {
    globalThis.localStorage.setItem(CURRENCY_STORAGE_KEY, value)
  } catch {
    /* ignore quota/permission errors */
  }
}

export default function KPIDashboard({ brandId, initialCurrency }: Props) {
  const [selectedWindow, setSelectedWindow] = useState<WindowKey>('24h')
  const [currency, setCurrency] = useState<Currency | undefined>(() => {
    const saved = getSavedCurrency()
    if (saved && CURRENCY_OPTIONS.includes(saved as Currency)) return saved as Currency
    return initialCurrency as Currency | undefined
  })
  // currencyRef is always in sync with currency state; used by effects/callbacks to
  // avoid stale closures without adding currency to every dependency array.
  const currencyRef = useRef(currency)

  const [kpis, setKpis] = useState<KPIResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Single fetch-and-set function used by all triggers (effect, currency click, refresh).
  const loadKPIs = useCallback(async (w: WindowKey, c: Currency | undefined) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ brand_id: brandId, window: w })
      if (c) params.set('currency', c)
      const res = await fetch(`/api/kpis?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`KPI fetch failed: ${res.status}`)
      const data = (await res.json()) as KPIResult
      setKpis(data)
      // First load only: if no currency was pre-selected, adopt the brand default from
      // the API response. Update ref + state without triggering a second fetch
      // (currency is intentionally absent from the useEffect dependency array below).
      if (!c && data.display_currency && CURRENCY_OPTIONS.includes(data.display_currency as Currency)) {
        const brandDefault = data.display_currency as Currency
        currencyRef.current = brandDefault
        setCurrency(brandDefault)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Load failed')
    } finally {
      setLoading(false)
    }
  }, [brandId])

  // Re-fetch when the time window changes. Currency changes are handled explicitly
  // in handleCurrencyChange — keeping currency out of deps prevents a double-fetch
  // on first load when setCurrency is called after the brand default is returned.
  useEffect(() => {
    loadKPIs(selectedWindow, currencyRef.current)
  }, [selectedWindow, loadKPIs])

  const handleCurrencyChange = (c: Currency) => {
    currencyRef.current = c
    setCurrency(c)
    setSavedCurrency(c)
    // Explicit re-fetch with the new currency — server does the conversion.
    loadKPIs(selectedWindow, c)
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      const syncRes = await fetch('/api/triple-whale/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, days: 1, triggered_by: 'manual' }),
      })
      if (!syncRes.ok) {
        const errBody = await syncRes.json().catch(() => ({})) as { error?: string }
        throw new Error(errBody.error ?? 'Sync failed')
      }
      const params = new URLSearchParams({ brand_id: brandId, window: selectedWindow })
      if (currencyRef.current) params.set('currency', currencyRef.current)
      const res = await fetch(`/api/kpis?${params.toString()}`, { cache: 'no-store' })
      if (!res.ok) throw new Error(`KPI fetch failed: ${res.status}`)
      const fresh = (await res.json()) as KPIResult
      startTransition(() => setKpis(fresh))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Refresh failed')
    } finally {
      setRefreshing(false)
    }
  }

  const lastSyncedLabel = formatLastSynced(kpis?.last_synced_at)
  const isStale = kpis?.last_synced_at ? hoursSince(kpis.last_synced_at) > 48 : false
  const hasPartialCache = kpis ? kpis.days_cached < kpis.days_expected : false
  const displayCurrency = kpis?.display_currency ?? currency ?? 'USD'

  return (
    <div className="space-y-4">
      {/* Controls row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="seg">
            {WINDOW_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setSelectedWindow(opt.key)}
                className={selectedWindow === opt.key ? 'on' : ''}
              >
                {opt.key.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="seg">
            {CURRENCY_OPTIONS.map(c => (
              <button
                key={c}
                onClick={() => handleCurrencyChange(c)}
                className={currency === c ? 'on' : ''}
                title={`Display in ${c}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <FreshnessPill label={lastSyncedLabel} refreshing={refreshing} stale={isStale} error={!!error} />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="btn"
            style={{ opacity: refreshing ? 0.6 : 1 }}
          >
            <RefreshIcon spinning={refreshing} />
            {refreshing ? 'Syncing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {isStale && !refreshing && (
        <div className="err-banner" style={{ background: 'var(--warn-bg)', color: 'var(--warn)', borderColor: 'color-mix(in srgb, var(--warn) 25%, transparent)', marginBottom: 12 }}>
          Data is over 48 hours old. Daily sync may have failed — try refreshing manually.
        </div>
      )}

      {hasPartialCache && !isStale && (
        <div style={{ padding: '8px 12px', background: 'var(--accent-bg)', border: '1px solid var(--accent-line)', borderRadius: 6, fontSize: 12, color: 'var(--accent)', marginBottom: 12 }}>
          Showing {kpis!.days_cached} of {kpis!.days_expected} days. Older data is being backfilled.
        </div>
      )}

      {error && (
        <div className="err-banner" style={{ marginBottom: 12 }}>
          {error}
        </div>
      )}

      {loading && !kpis ? (
        <KPIGridSkeleton />
      ) : kpis ? (
        <div className="kpi-grid">
          <KPITile label="Revenue" value={formatCurrency(kpis.revenue, displayCurrency)} />
          <KPITile label="Orders" value={kpis.orders.toLocaleString()} />
          <KPITile label="AOV" value={formatCurrency(kpis.aov, displayCurrency)} />
          <KPITile label="New Customers" value={kpis.new_customers.toLocaleString()} />
        </div>
      ) : null}
    </div>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

function FreshnessPill({ label, refreshing, stale, error }: {
  label: string
  refreshing: boolean
  stale: boolean
  error: boolean
}) {
  let chipClass = ''
  if (error) chipClass = 'bad'
  else if (stale) chipClass = 'warn'
  else chipClass = 'ok'

  return (
    <span className={`chip ${chipClass}`}>
      <span className="dot" />
      {refreshing && <Spinner />}
      {refreshing ? 'Syncing…' : label}
    </span>
  )
}

function KPITile({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-tile">
      <div className="kpi-label">{label}</div>
      <div className="kpi-value tnum">{value}</div>
    </div>
  )
}

function KPIGridSkeleton() {
  return (
    <div className="kpi-grid">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="kpi-tile">
          <div className="kpi-label">
            <div className="skel" style={{ height: 10, width: 60 }} />
          </div>
          <div className="kpi-value" style={{ marginTop: 8 }}>
            <div className="skel" style={{ height: 24, width: 100 }} />
          </div>
        </div>
      ))}
    </div>
  )
}

function Spinner() {
  return (
    <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
      <path d="M12 2 A10 10 0 0 1 22 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg className={`w-4 h-4 ${spinning ? 'animate-spin' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12a9 9 0 1 1-3-6.7L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

// ============================================================================
// Formatting helpers
// ============================================================================

const CURRENCY_LOCALES: Record<Currency, string> = {
  AUD: 'en-AU',
  USD: 'en-US',
  GBP: 'en-GB',
  EUR: 'en-IE', // en-IE reads naturally for EUR without forcing German/French conventions
}

function formatCurrency(n: number, currency: string): string {
  const locale = CURRENCY_LOCALES[currency as Currency] ?? 'en-US'
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n)
}

function formatLastSynced(iso: string | null | undefined): string {
  if (!iso) return 'Never synced'
  const hours = hoursSince(iso)
  if (hours < 1) {
    const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
    return minutes <= 1 ? 'Just now' : `${minutes}m ago`
  }
  if (hours < 24) return `${Math.floor(hours)}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function hoursSince(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}
