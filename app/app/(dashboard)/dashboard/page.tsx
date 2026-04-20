'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'
import KPIDashboard from '@/components/dashboard/KPIDashboard'
import type { ContentQueueStatus } from '@/types'
import type { Recommendation, Anomaly } from '@/lib/agents/intelligence/types'

// ─── Types ────────────────────────────────────────────────────────────────────

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
  compliance_status: string | null
}

type MetricsResponse = {
  content: ContentMetrics
  recent: QueueItem[]
}

type Alert = {
  id: string
  alert_type: string
  severity: 'info' | 'warning' | 'critical'
  title: string
  description: string
  created_at: string
  acknowledged: boolean
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

const COMPLIANCE_BADGE: Record<string, string> = {
  passed:   'bg-green-100 text-green-700',
  warnings: 'bg-amber-100 text-amber-700',
  escalated:'bg-orange-100 text-orange-700',
  blocked:  'bg-red-100 text-red-700',
}

const COMPLIANCE_LABEL: Record<string, string> = {
  passed: 'Passed', warnings: 'Warnings', escalated: 'Escalated', blocked: 'Blocked',
}

const ALERT_SEVERITY_STYLES: Record<string, string> = {
  info:     'bg-blue-50 border-blue-200 text-blue-700',
  warning:  'bg-amber-50 border-amber-200 text-amber-700',
  critical: 'bg-red-50 border-red-200 text-red-700',
}

const PRIORITY_BADGE: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low:    'bg-gray-100 text-gray-600',
}

function ComplianceStatusBadge({ status }: { status: string | null | undefined }) {
  const label = status ? (COMPLIANCE_LABEL[status] ?? 'Checking…') : 'Checking…'
  const style = status ? (COMPLIANCE_BADGE[status] ?? 'bg-gray-100 text-gray-500') : 'bg-gray-100 text-gray-400'
  return (
    <span className={`flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded ${style}`}>
      {label}
    </span>
  )
}

function fmtInt(n: number | null) {
  if (n === null || n === undefined) return '—'
  return n.toLocaleString('en-AU')
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
}

function KpiCard({ label, value, sub, loading }: {
  label: string; value: string; sub?: string; loading?: boolean
}) {
  return (
    <div className="rounded-lg p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {loading ? (
        <div className="mt-2.5 h-7 w-24 rounded animate-pulse" style={{ background: 'var(--border)' }} />
      ) : (
        <p className="mt-1.5 text-2xl font-semibold" style={{ color: 'var(--text)' }}>{value}</p>
      )}
      {sub && !loading && <p className="mt-0.5 text-xs" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{children}</p>
      {action}
    </div>
  )
}

// ─── Active alerts panel ──────────────────────────────────────────────────────

function ActiveAlerts({ brandId }: { brandId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [acking, setAcking] = useState<string | null>(null)

  const fetchAlerts = useCallback(() => {
    setLoading(true)
    fetch(`/api/agents/intelligence/alerts?brand_id=${brandId}&acknowledged=false`)
      .then(r => r.json())
      .then(d => { setAlerts(d.alerts ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [brandId])

  useEffect(() => { fetchAlerts() }, [fetchAlerts])

  async function acknowledge(alertId: string) {
    setAcking(alertId)
    await fetch('/api/agents/intelligence/alerts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ alert_id: alertId }),
    })
    setAlerts(prev => prev.filter(a => a.id !== alertId))
    setAcking(null)
  }

  return (
    <div className="rounded-lg p-5" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <h3 className="text-sm font-medium mb-3" style={{ color: 'var(--text)' }}>Active alerts</h3>
      {loading ? (
        <div className="space-y-2">
          {[1, 2].map(i => <div key={i} className="h-10 rounded animate-pulse" style={{ background: 'var(--border-subtle)' }} />)}
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No active alerts</p>
      ) : (
        <div className="space-y-2">
          {alerts.map(alert => (
            <div key={alert.id} className={`flex items-start justify-between gap-3 px-3 py-2.5 rounded-lg border text-xs ${ALERT_SEVERITY_STYLES[alert.severity] ?? 'bg-gray-50 border-gray-200 text-gray-700'}`}>
              <div className="min-w-0">
                <p className="font-semibold">{alert.title}</p>
                <p className="mt-0.5 opacity-80 line-clamp-2">{alert.description}</p>
              </div>
              <button
                onClick={() => acknowledge(alert.id)}
                disabled={acking === alert.id}
                className="flex-shrink-0 text-xs px-2 py-1 rounded bg-white/60 hover:bg-white border border-current opacity-70 hover:opacity-100 transition-opacity disabled:opacity-40"
              >
                {acking === alert.id ? '…' : 'Ack'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Intelligence section ─────────────────────────────────────────────────────

type ReportRow = {
  id: string
  window_start: string
  window_end: string
  narrative: string | null
  narrator_enabled: boolean
  recommendations: Recommendation[]
  anomalies: Anomaly[]
  duration_ms: number
  estimated_cost_usd: number
  model_used: string | null
  created_at: string
}

function IntelligenceSection({ brandId }: { brandId: string }) {
  const [report, setReport] = useState<ReportRow | null>(null)
  const [loadingReport, setLoadingReport] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [genError, setGenError] = useState<string | null>(null)

  const fetchReport = useCallback(() => {
    setLoadingReport(true)
    fetch(`/api/agents/intelligence/report?brand_id=${brandId}`)
      .then(r => r.json())
      .then(d => { setReport(d.report ?? null); setLoadingReport(false) })
      .catch(() => setLoadingReport(false))
  }, [brandId])

  useEffect(() => { fetchReport() }, [fetchReport])

  async function generateReport() {
    setGenerating(true)
    setGenError(null)
    try {
      const r = await fetch('/api/agents/intelligence/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error ?? 'Unknown error')
      fetchReport()
    } catch (err) {
      setGenError(err instanceof Error ? err.message : 'Failed to generate report')
    } finally {
      setGenerating(false)
    }
  }

  return (
    <div>
      <SectionLabel
        action={
          <button
            onClick={generateReport}
            disabled={generating}
            className="text-xs font-medium px-3 py-1.5 rounded disabled:opacity-50 transition-colors"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >
            {generating ? 'Generating…' : 'Generate report'}
          </button>
        }
      >
        Intelligence
      </SectionLabel>

      {genError && (
        <div className="mb-3 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
          {genError}
        </div>
      )}

      {loadingReport ? (
        <div className="rounded-lg p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="h-4 rounded w-1/3 animate-pulse" style={{ background: 'var(--border)' }} />
          <div className="h-3 rounded animate-pulse" style={{ background: 'var(--border)' }} />
          <div className="h-3 rounded w-5/6 animate-pulse" style={{ background: 'var(--border)' }} />
        </div>
      ) : !report ? (
        <div className="rounded-lg px-5 py-10 text-center text-sm" style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
          No reports yet. Click &ldquo;Generate report&rdquo; to analyse your data.
        </div>
      ) : (
        <div className="rounded-lg divide-y" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderColor: 'var(--border)' }}>
          {/* Header */}
          <div className="px-5 py-3 flex items-center justify-between">
            <p className="text-xs font-medium text-gray-700">
              Report for {fmtDate(report.window_start)} – {fmtDate(report.window_end)}
            </p>
            <p className="text-xs text-gray-400">
              {new Date(report.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {report.duration_ms > 0 && ` · ${(report.duration_ms / 1000).toFixed(1)}s`}
              {report.estimated_cost_usd > 0 && ` · $${report.estimated_cost_usd.toFixed(4)}`}
            </p>
          </div>

          {/* Narrative */}
          <div className="px-5 py-4">
            {report.narrator_enabled && report.narrative ? (
              <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{report.narrative}</p>
            ) : (
              <p className="text-sm italic" style={{ color: 'var(--text-muted)' }}>
                {report.narrative === 'Insufficient data for analysis.'
                  ? 'Insufficient data for analysis.'
                  : 'AI narrative not generated — no API key configured or narrator skipped.'}
              </p>
            )}
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Recommendations</p>
              <div className="space-y-2">
                {report.recommendations.map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg" style={{ background: 'var(--bg)' }}>
                    <span className={`flex-shrink-0 text-xs font-medium px-1.5 py-0.5 rounded capitalize ${PRIORITY_BADGE[rec.priority] ?? 'bg-gray-100 text-gray-600'}`}>
                      {rec.priority}
                    </span>
                    <div>
                      <p className="text-xs font-semibold" style={{ color: 'var(--text)' }}>{rec.title}</p>
                      <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{rec.description}</p>
                      <p className="text-xs mt-1 text-indigo-600">→ {rec.suggested_action}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Anomalies */}
          {report.anomalies.length > 0 && (
            <div className="px-5 py-4">
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>Anomalies detected</p>
              <div className="space-y-1.5">
                {report.anomalies.map((a, i) => (
                  <div key={i} className={`px-3 py-2 rounded-lg border text-xs ${ALERT_SEVERITY_STYLES[a.severity] ?? 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                    <p className="font-semibold">{a.title}</p>
                    <p className="mt-0.5 opacity-80">{a.description}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
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

      {/* ── Row 1: Store Performance ──────────────────────────────────────── */}
      <div>
        <SectionLabel>Store Performance</SectionLabel>
        <KPIDashboard brandId={brandId} />
      </div>

      {/* ── Row 2: Content Pipeline ───────────────────────────────────────── */}
      <div>
        <SectionLabel>Content Pipeline</SectionLabel>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Generated" value={content ? fmtInt(content.total) : '—'} sub="all time" loading={loading} />
          <KpiCard label="Pending Review" value={content ? fmtInt(content.pending) : '—'} sub="awaiting approval" loading={loading} />
          <KpiCard label="Published" value={content ? fmtInt(content.published) : '—'} sub="live on store" loading={loading} />
          <KpiCard label="Approval Rate" value={content ? `${content.approvalRate}%` : '—'} sub="approved + published / total" loading={loading} />
        </div>
      </div>

      {/* ── Row 3: Recent content + Active alerts ─────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <h3 className="text-sm font-medium" style={{ color: 'var(--text)' }}>Recent content</h3>
            <Link href="/approvals/web-designer" className="text-xs text-indigo-600 hover:text-indigo-500">
              View all →
            </Link>
          </div>
          <div>
            {loading ? (
              <div className="p-5 space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 animate-pulse">
                    <div className="h-4 rounded flex-1" style={{ background: 'var(--border)' }} />
                    <div className="h-4 rounded w-16" style={{ background: 'var(--border)' }} />
                  </div>
                ))}
              </div>
            ) : recent.length === 0 ? (
              <p className="px-5 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                No content yet.{' '}
                <Link href="/content-studio" className="text-indigo-600 hover:text-indigo-500">Generate some →</Link>
              </p>
            ) : (
              recent.map((item) => (
                <Link
                  key={item.id}
                  href="/approvals/web-designer"
                  className="flex items-center gap-3 px-5 py-3 transition-colors group"
                  style={{ borderTop: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate transition-colors group-hover:text-indigo-600" style={{ color: 'var(--text)' }}>
                      {item.title ?? `${item.content_type.replace('_', ' ')} content`}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                      {item.content_type.replace('_', ' ')} · {new Date(item.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <ComplianceStatusBadge status={item.compliance_status} />
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${STATUS_STYLES[item.status] ?? 'bg-gray-100 text-gray-600'}`}>
                      {item.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        <ActiveAlerts brandId={brandId} />
      </div>

      {/* ── Row 4: Intelligence ───────────────────────────────────────────── */}
      <IntelligenceSection brandId={brandId} />
    </div>
  )
}
