'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'
import type { ContentType, ContentQueueStatus } from '@/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ContentMetrics = {
  total: number
  pending: number
  published: number
  approvalRate: number
}

type ShopifyMetrics = {
  revenue_today: number
  orders_today: number
  aov: number
  revenue_30d: number
  no_token?: boolean
  error?: string
}

type QueueItem = {
  id: string
  content_type: ContentType
  status: ContentQueueStatus
  created_at: string
  content: { title?: string; subject?: string; caption?: string }
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

function fmt(n: number, prefix = '') {
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}k`
  return `${prefix}${n.toLocaleString('en-AU', { minimumFractionDigits: n % 1 !== 0 ? 2 : 0, maximumFractionDigits: 2 })}`
}

function KpiCard({
  label, value, sub, loading,
}: {
  label: string; value: string; sub?: string; loading?: boolean
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      {loading ? (
        <div className="mt-2 h-7 w-20 bg-gray-100 rounded animate-pulse" />
      ) : (
        <p className="mt-1 text-2xl font-semibold text-gray-900">{value}</p>
      )}
      {sub && !loading && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{children}</p>
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { activeBrand } = useBrand()
  const supabase = createClient()

  const [contentMetrics, setContentMetrics] = useState<ContentMetrics | null>(null)
  const [shopifyMetrics, setShopifyMetrics] = useState<ShopifyMetrics | null>(null)
  const [queueItems, setQueueItems] = useState<QueueItem[]>([])
  const [contentLoading, setContentLoading] = useState(true)
  const [shopifyLoading, setShopifyLoading] = useState(true)

  const brandId = activeBrand?.brand_id ?? 'plasmaide'

  // ── Fetch content metrics ─────────────────────────────────────────────────

  useEffect(() => {
    setContentLoading(true)

    Promise.all([
      supabase.from('content_queue').select('status', { count: 'exact' }).eq('brand_id', brandId),
      supabase.from('content_queue').select('status', { count: 'exact' }).eq('brand_id', brandId).eq('status', 'pending'),
      supabase.from('content_queue').select('status', { count: 'exact' }).eq('brand_id', brandId).eq('status', 'published'),
      supabase.from('content_queue').select('status', { count: 'exact' }).eq('brand_id', brandId).in('status', ['approved', 'published']),
      supabase.from('content_queue')
        .select('id, content_type, status, created_at, content')
        .eq('brand_id', brandId)
        .order('created_at', { ascending: false })
        .limit(5),
    ]).then(([total, pending, published, approvedOrPub, recent]) => {
      const totalN = total.count ?? 0
      const pendingN = pending.count ?? 0
      const publishedN = published.count ?? 0
      const approvedN = approvedOrPub.count ?? 0
      const rate = totalN > 0 ? Math.round((approvedN / totalN) * 100) : 0

      setContentMetrics({ total: totalN, pending: pendingN, published: publishedN, approvalRate: rate })
      setQueueItems((recent.data as QueueItem[]) ?? [])
      setContentLoading(false)
    })
  }, [brandId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Fetch Shopify metrics ─────────────────────────────────────────────────

  useEffect(() => {
    setShopifyLoading(true)
    fetch(`/api/dashboard/shopify-metrics?brand_id=${brandId}`)
      .then((r) => r.json())
      .then((d) => { setShopifyMetrics(d); setShopifyLoading(false) })
      .catch(() => { setShopifyMetrics({ revenue_today: 0, orders_today: 0, aov: 0, revenue_30d: 0, error: 'Fetch failed' }); setShopifyLoading(false) })
  }, [brandId])

  const shopifyConnected = shopifyMetrics && !shopifyMetrics.no_token && !shopifyMetrics.error

  function getTitle(item: QueueItem) {
    const c = item.content
    return c?.title ?? c?.subject ?? c?.caption?.slice(0, 60) ?? `${item.content_type} content`
  }

  return (
    <div className="p-6 space-y-8">
      <PageHeader title="Dashboard" description="Content pipeline and store performance." />

      {/* ── Row 1: Content Pipeline ───────────────────────────────────────── */}
      <div>
        <SectionLabel>Content Pipeline</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            label="Generated"
            value={contentMetrics ? String(contentMetrics.total) : '—'}
            sub="all time"
            loading={contentLoading}
          />
          <KpiCard
            label="Pending Review"
            value={contentMetrics ? String(contentMetrics.pending) : '—'}
            sub="awaiting approval"
            loading={contentLoading}
          />
          <KpiCard
            label="Published"
            value={contentMetrics ? String(contentMetrics.published) : '—'}
            sub="live on store"
            loading={contentLoading}
          />
          <KpiCard
            label="Approval Rate"
            value={contentMetrics ? `${contentMetrics.approvalRate}%` : '—'}
            sub="approved + published / total"
            loading={contentLoading}
          />
        </div>
      </div>

      {/* ── Row 2: Store Performance ──────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <SectionLabel>Store Performance</SectionLabel>
          {shopifyMetrics?.no_token && (
            <Link
              href="/settings?tab=integrations"
              className="text-xs text-indigo-600 hover:text-indigo-500 font-medium"
            >
              Connect Shopify →
            </Link>
          )}
          {shopifyMetrics?.error && !shopifyMetrics.no_token && (
            <span className="text-xs text-red-500">{shopifyMetrics.error}</span>
          )}
        </div>

        {shopifyMetrics?.no_token ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500 mb-2">Shopify not connected</p>
            <p className="text-xs text-gray-400 mb-4">Add your store URL and access token in Settings → Integrations to see revenue data.</p>
            <Link
              href="/settings"
              className="inline-block px-4 py-2 bg-gray-900 text-white text-sm rounded-md hover:bg-gray-700 transition-colors"
            >
              Connect Shopify
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Revenue (today)"
              value={shopifyConnected ? fmt(shopifyMetrics!.revenue_today, '$') : '—'}
              sub="AUD incl. tax"
              loading={shopifyLoading}
            />
            <KpiCard
              label="Orders (today)"
              value={shopifyConnected ? String(shopifyMetrics!.orders_today) : '—'}
              loading={shopifyLoading}
            />
            <KpiCard
              label="AOV (today)"
              value={shopifyConnected && shopifyMetrics!.orders_today > 0 ? fmt(shopifyMetrics!.aov, '$') : '—'}
              sub="avg order value"
              loading={shopifyLoading}
            />
            <KpiCard
              label="Revenue (30d)"
              value={shopifyConnected ? fmt(shopifyMetrics!.revenue_30d, '$') : '—'}
              sub="rolling 30 days"
              loading={shopifyLoading}
            />
          </div>
        )}
      </div>

      {/* ── Content Queue ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-900">Recent content</h3>
            <Link href="/approvals/web-designer" className="text-xs text-indigo-600 hover:text-indigo-500">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-gray-50">
            {contentLoading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-4 bg-gray-100 rounded flex-1" />
                    <div className="h-4 bg-gray-100 rounded w-16" />
                  </div>
                ))}
              </div>
            ) : queueItems.length === 0 ? (
              <p className="px-5 py-6 text-sm text-gray-400 text-center">
                No content yet.{' '}
                <Link href="/content-studio" className="text-indigo-600 hover:text-indigo-500">Generate some →</Link>
              </p>
            ) : (
              queueItems.map((item) => (
                <Link
                  key={item.id}
                  href="/approvals/web-designer"
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                      {getTitle(item)}
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
