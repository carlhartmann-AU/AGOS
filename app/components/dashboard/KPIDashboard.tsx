// components/dashboard/KPIDashboard.tsx
'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import type { KPIResult, WindowKey } from '@/lib/triple-whale/kpis'

interface Props {
  brandId: string
}

const WINDOW_OPTIONS: Array<{ key: WindowKey; label: string }> = [
  { key: '24h', label: '24 hours' },
  { key: '7d',  label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'mtd', label: 'Month to date' },
]

export default function KPIDashboard({ brandId }: Props) {
  const [window, setWindow] = useState<WindowKey>('24h')
  const [kpis, setKpis] = useState<KPIResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const fetchKPIs = useCallback(async (w: WindowKey) => {
    const res = await fetch(`/api/kpis?brand_id=${brandId}&window=${w}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(`KPI fetch failed: ${res.status}`)
    return (await res.json()) as KPIResult
  }, [brandId])

  // Initial load + window change
  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchKPIs(window)
      .then(data => {
        setKpis(data)
        setLoading(false)
      })
      .catch(err => {
        setError(err.message)
        setLoading(false)
      })
  }, [window, fetchKPIs])

  const handleRefresh = async () => {
    setRefreshing(true)
    setError(null)
    try {
      // Trigger sync (fetches today's data from TW and writes to cache)
      const syncRes = await fetch('/api/triple-whale/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, days: 1, triggered_by: 'manual' }),
      })

      if (!syncRes.ok && syncRes.status !== 200) {
        const err = await syncRes.json()
        throw new Error(err.error ?? 'Sync failed')
      }

      // Re-read KPIs from cache
      const fresh = await fetchKPIs(window)
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

  return (
    <div className="space-y-4">
      {/* Controls row: window toggle + freshness + refresh */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-1">
          {WINDOW_OPTIONS.map(opt => (
            <button
              key={opt.key}
              onClick={() => setWindow(opt.key)}
              className={`px-3 py-1.5 text-sm font-medium rounded-md transition ${
                window === opt.key
                  ? 'bg-gray-900 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <FreshnessPill
            label={lastSyncedLabel}
            refreshing={refreshing}
            stale={isStale}
            error={!!error}
          />
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshIcon spinning={refreshing} />
            Refresh
          </button>
        </div>
      </div>

      {/* Stale warning banner */}
      {isStale && !refreshing && (
        <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
          Data is over 48 hours old. Daily sync may have failed — try refreshing manually.
        </div>
      )}

      {/* Partial cache warning (e.g. selected 30d but only have 5 days cached) */}
      {hasPartialCache && !isStale && (
        <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2 text-sm text-blue-800">
          Showing {kpis!.days_cached} of {kpis!.days_expected} days. Older data is being backfilled.
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* KPI tiles */}
      {loading && !kpis ? (
        <KPIGridSkeleton />
      ) : kpis ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <KPITile label="Revenue" value={formatCurrency(kpis.revenue)} />
          <KPITile label="Orders" value={kpis.orders.toLocaleString()} />
          <KPITile label="AOV" value={formatCurrency(kpis.aov)} />
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
  let tone = 'text-gray-500 bg-gray-50 border-gray-200'
  if (refreshing) tone = 'text-blue-700 bg-blue-50 border-blue-200'
  else if (error) tone = 'text-red-700 bg-red-50 border-red-200'
  else if (stale) tone = 'text-amber-700 bg-amber-50 border-amber-200'

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border ${tone}`}>
      {refreshing && <Spinner />}
      {refreshing ? 'Syncing…' : label}
    </span>
  )
}

function KPITile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-gray-900">{value}</div>
    </div>
  )
}

function KPIGridSkeleton() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map(i => (
        <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="h-3 w-16 bg-gray-200 rounded animate-pulse" />
          <div className="mt-2 h-7 w-24 bg-gray-200 rounded animate-pulse" />
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

function formatCurrency(n: number): string {
  // TODO: pull currency from brand_settings; default GBP given Plasmaide-UK store
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
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
