'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'
import type { ContentQueueStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type TwMetrics = {
  revenue7d: number | null
  orders7d: number | null
  aov: number | null
  newCustomers: number | null
  shopDomain: string
  period: { start: string; end: string }
}

type ContentMetrics = {
  total: number
  pending: number
  published: number
  approvalRate: number
}

type QueueItem = {
  id: string
  content_type: string
  status: ContentQueueStatus
  created_at: string
  title: string | null
}

type MetricsResponse = {
  tw: TwMetrics | null
  tw_no_key: boolean
  content: ContentMetrics
  recent: QueueItem[]
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

const STATUS_STYLES: Partial<Record<ContentQueueStatus, string>> = {
  pending:          'bg-yellow-100 text-yellow-700',
  compliance_check: 'bg-blue-100 text-blue-700',
  compliance_fail:  'bg-red-100 text-red-700',
  escalated:        'bg-orange-100 text-orange-700',
  approved:         'bg-green-100 text-green-700',
  rejected:         'bg-red-100 text-red-600',
  publish_pending:  'bg-purple-100 text-purple-700',
  published:        'bg-green-100 text-green-800',
  failed:           'bg-red-100 text-red-700',
}

function fmt(n: number | null, prefix = '', fallback = '—') {
  if (n === null || n === undefined) return fallback
  if (n >= 1_000_000) return `${prefix}${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}k`
  return `${prefix}${n.toLocaleString('en-AU', { minimumFractionDigits: n % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}`
}

function fmtInt(n: number | null) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-AU')
}

function KpiCard({ label, value, sub, loading }: {
  label: string; value: string; sub?: string; loading?: boolean
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-24 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      )}
      {sub && !loading && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{children}</p>
      {action}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeBrand } = useBrand()
  const [data, setData] = useState<MetricsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const brandId = activeBrand?.brand_id ?? 'plasmaide'

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/dashboard/metrics?brand_id=${brandId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json() as Promise<MetricsResponse>
      })
      .then((d) => { setData(d); setLoading(false) })
      .catch((e) => { setError(e.message); setLoading(false) })
  }, [brandId])

  const tw = data?.tw
  const content = data?.content
  const recent = data?.recent ?? []

  return (
    <div className="p-6 space-y-8">
      <PageHeader title="Dashboard" description="Store performance and content pipeline." />

      {error && (
        <div className="px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          Failed to load metrics: {error}
        </div>
      )}

      {/* ── Row 1: Store Performance (Triple Whale) ───────────────────────── */}
      <div>
        <SectionLabel
          action={
            data?.tw_no_key ? (
              <Link href="/settings" className="text-xs text-indigo-600 hover:text-indigo-500 font-medium">
                Connect Triple Whale →
              </Link>
            ) : tw ? (
              <span className="text-xs text-gray-400">{tw.period.start} → {tw.period.end}</span>
            ) : null
          }
        >
          Store Performance
        </SectionLabel>

        {data?.tw_no_key ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500 mb-1">Triple Whale not connected</p>
            <p className="text-xs text-gray-400 mb-4">
              Add your Triple Whale API key and shop domain in Settings → Integrations.
            </p>
            <Link
              href="/settings"
              className="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
            >
              Go to Settings
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Revenue (7d)"
              value={fmt(tw?.revenue7d ?? null, '$')}
              sub="Triple Whale · all attribution"
              loading={loading}
            />
            <KpiCard
              label="Orders (7d)"
              value={fmtInt(tw?.orders7d ?? null)}
              sub="all channels"
              loading={loading}
            />
            <KpiCard
              label="AOV"
              value={fmt(tw?.aov ?? null, '$')}
              sub="avg order value"
              loading={loading}
            />
            <KpiCard
              label="New Customers"
              value={fmtInt(tw?.newCustomers ?? null)}
              sub="7-day window"
              loading={loading}
            />
          </div>
        )}
      </div>

      {/* ── Row 2: Content Pipeline (Supabase) ───────────────────────────── */}
      <div>
        <SectionLabel>Content Pipeline</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Generated"
            value={content ? fmtInt(content.total) : '—'}
            sub="all time"
            loading={loading}
          />
          <KpiCard
            label="Pending Review"
            value={content ? fmtInt(content.pending) : '—'}
            sub="awaiting approval"
            loading={loading}
          />
          <KpiCard
            label="Published"
            value={content ? fmtInt(content.published) : '—'}
            sub="live on store"
            loading={loading}
          />
          <KpiCard
            label="Approval Rate"
            value={content ? `${content.approvalRate}%` : '—'}
            sub="approved + published / total"
            loading={loading}
          />
        </div>
      </div>

      {/* ── Content Queue + Alerts ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Recent content</h3>
            <Link href="/approvals/web-designer" className="text-xs text-indigo-600 hover:text-indigo-500">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded flex-1" />
                    <div className="h-4 bg-gray-100 rounded w-16" />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">
                No content yet.{' '}
                <Link href="/content-studio" className="text-indigo-600 hover:text-indigo-500">
                  Generate some →
                </Link>
              </p>
            ) : (
              recent.map((item) => (
                <Link
                  key={item.id}
                  href="/approvals/web-designer"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                      {item.title ?? `${item.content_type.replace('_', ' ')} content`}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.content_type.replace('_', ' ')} · {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                    {item.status.replace('_', ' ')}
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h3 className="text-sm font-medium text-gray-900 mb-3">Active alerts</h3>
          <p className="text-sm text-gray-400">No alerts — Phase 4+</p>
        </div>
      </div>
    </div>
  )
}
