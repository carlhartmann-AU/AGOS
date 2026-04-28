'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { useBrand } from '@/context/BrandContext'
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


const COMPLIANCE_CHIP: Record<string, string> = {
  passed:   'ok',
  warnings: 'warn',
  escalated:'esc',
  blocked:  'bad',
}

const COMPLIANCE_LABEL: Record<string, string> = {
  passed: 'PASSED', warnings: 'WARNINGS', escalated: 'ESCALATED', blocked: 'BLOCKED',
}

const ALERT_SEVERITY_CLASS: Record<string, string> = {
  info:     'ok',
  warning:  'warn',
  critical: 'bad',
}

const PRIORITY_CHIP: Record<string, string> = {
  high:   'bad',
  medium: 'warn',
  low:    'accent',
}

function ComplianceStatusBadge({ status, createdAt }: { status: string | null | undefined; createdAt?: string }) {
  const isRecent = !!createdAt && (Date.now() - new Date(createdAt).getTime()) < 60_000
  if (!status) {
    return (
      <span className="chip mono" style={{ color: isRecent ? 'var(--accent)' : 'var(--ink-5)' }}>
        {isRecent ? 'Checking…' : '—'}
      </span>
    )
  }
  return (
    <span className={`chip mono ${COMPLIANCE_CHIP[status] ?? ''}`}>
      <span className="dot" />
      {COMPLIANCE_LABEL[status] ?? status.toUpperCase()}
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

function StatCell({ label, value, sub, loading, color }: {
  label: string; value: string; sub?: string; loading?: boolean; color?: string
}) {
  return (
    <div className="stat-cell">
      <div className="stat-label">{label}</div>
      {loading ? (
        <div className="skel" style={{ height: 20, width: 60, marginTop: 4 }} />
      ) : (
        <div className="stat-value tnum" style={color ? { color } : undefined}>{value}</div>
      )}
      {sub && !loading && <div className="stat-sub">{sub}</div>}
    </div>
  )
}

function SectionLabel({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="section-head">
      <h2 style={{ margin: 0, fontSize: 13, fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase', color: 'var(--ink-3)' }}>{children}</h2>
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
    <div className="card">
      <div className="card-head">
        <h3>Active alerts</h3>
        {alerts.length > 0 && (
          <span className="chip mono">{alerts.length}</span>
        )}
      </div>
      {loading ? (
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[1, 2].map(i => <div key={i} className="skel" style={{ height: 40 }} />)}
        </div>
      ) : alerts.length === 0 ? (
        <div className="empty">
          <div className="glyph">✓</div>
          <div className="h">No active alerts</div>
          <p>All systems running normally.</p>
        </div>
      ) : (
        <div>
          {alerts.map(alert => (
            <div key={alert.id} className="alert-row">
              <div className={`bar ${ALERT_SEVERITY_CLASS[alert.severity] ?? 'ok'}`} />
              <div style={{ minWidth: 0 }}>
                <div className="title">{alert.title}</div>
                <div className="meta">
                  <span className="mono">{alert.alert_type}</span>
                  <span>·</span>
                  <span className="mono">{fmtDate(alert.created_at)}</span>
                </div>
              </div>
              <div className="actions">
                <button
                  onClick={() => acknowledge(alert.id)}
                  disabled={acking === alert.id}
                  className="btn ghost"
                  style={{ opacity: acking === alert.id ? 0.4 : 1 }}
                >
                  {acking === alert.id ? '…' : 'Ack'}
                </button>
              </div>
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
            className="btn primary"
            style={{ opacity: generating ? 0.6 : 1 }}
          >
            {generating ? 'Generating…' : 'Generate report'}
          </button>
        }
      >
        Intelligence
      </SectionLabel>

      {genError && (
        <div className="err-banner" style={{ marginBottom: 12 }}>
          {genError}
        </div>
      )}

      {loadingReport ? (
        <div className="card card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="skel" style={{ height: 14, width: '33%' }} />
          <div className="skel" style={{ height: 12 }} />
          <div className="skel" style={{ height: 12, width: '80%' }} />
        </div>
      ) : !report ? (
        <div className="card">
          <div className="empty">
            <div className="glyph">◎</div>
            <div className="h">No reports yet</div>
            <p>Click &ldquo;Generate report&rdquo; to analyse your data.</p>
          </div>
        </div>
      ) : (
        <div className="card">
          {/* Header */}
          <div className="card-head">
            <h3>Report · {fmtDate(report.window_start)} – {fmtDate(report.window_end)}</h3>
            <span className="intel-meta">
              {new Date(report.created_at).toLocaleString('en-AU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {report.duration_ms > 0 && ` · ${(report.duration_ms / 1000).toFixed(1)}s`}
              {report.estimated_cost_usd > 0 && ` · $${report.estimated_cost_usd.toFixed(4)}`}
            </span>
          </div>

          {/* Narrative */}
          <div className="intel-narrative" style={{ margin: 14, borderRadius: 6 }}>
            {report.narrator_enabled && report.narrative ? (
              <p>{report.narrative}</p>
            ) : (
              <p style={{ fontStyle: 'italic', color: 'var(--ink-4)' }}>
                {report.narrative === 'Insufficient data for analysis.'
                  ? 'Insufficient data for analysis.'
                  : 'AI narrative not generated — no API key configured or narrator skipped.'}
              </p>
            )}
          </div>

          {/* Recommendations */}
          {report.recommendations.length > 0 && (
            <div style={{ padding: '0 14px 14px' }}>
              <div className="stat-label" style={{ marginBottom: 8 }}>Recommendations</div>
              {report.recommendations.map((rec, i) => (
                <div key={i} className="intel-rec">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span className={`chip mono ${PRIORITY_CHIP[rec.priority] ?? ''}`}>
                      {rec.priority.toUpperCase()}
                    </span>
                    <span className="mono" style={{ fontSize: 10, color: 'var(--ink-4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{rec.category ?? ''}</span>
                  </div>
                  <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--ink)', marginBottom: 2 }}>{rec.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--ink-3)', marginBottom: 4 }}>{rec.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontFamily: 'Geist Mono, monospace' }}>→ {rec.suggested_action}</div>
                </div>
              ))}
            </div>
          )}

          {/* Anomalies */}
          {report.anomalies.length > 0 && (
            <div style={{ padding: '0 14px 14px' }}>
              <div className="stat-label" style={{ marginBottom: 8 }}>Anomalies detected</div>
              {report.anomalies.map((a, i) => (
                <div key={i} className="alert-row" style={{ border: '1px solid var(--line)', borderRadius: 6, marginBottom: 6 }}>
                  <div className={`bar ${ALERT_SEVERITY_CLASS[a.severity] ?? 'ok'}`} />
                  <div>
                    <div className="title">{a.title}</div>
                    <div className="meta">{a.description}</div>
                  </div>
                </div>
              ))}
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
    <div className="page">
      {/* Page header */}
      <div className="page-head">
        <div>
          <h1 className="page-title">Mission control</h1>
          <div className="page-sub">Plasmaide · Growth telemetry across Shopify, DotDigital, Triple Whale, Xero and Gorgias.</div>
        </div>
      </div>

      {error && (
        <div className="err-banner">
          Failed to load metrics: {error}
        </div>
      )}

      {/* ── Row 1: Store Performance ──────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-head">
          <h2>Store performance</h2>
        </div>
        <KPIDashboard brandId={brandId} />
      </div>

      {/* ── Row 2: Content Pipeline ───────────────────────────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div className="section-head">
          <h2>Content pipeline <span className="desc">· last 30 days</span></h2>
          <Link href="/approvals" className="btn ghost">View all</Link>
        </div>
        <div className="stat-row mb-12">
          <StatCell label="Generated"     value={content ? fmtInt(content.total) : '—'}              sub="all time"                    loading={loading} />
          <StatCell label="Pending review" value={content ? fmtInt(content.pending) : '—'}            sub="awaiting approval"           loading={loading} color="var(--warn)" />
          <StatCell label="Published"     value={content ? fmtInt(content.published) : '—'}           sub="live on store"               loading={loading} color="var(--ok)" />
          <StatCell label="Approval rate" value={content ? `${content.approvalRate}%` : '—'}          sub="approved + published / total" loading={loading} />
        </div>
      </div>

      {/* ── Row 3: Recent content + Active alerts ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="card-head">
            <h3>Recent content</h3>
            <Link href="/approvals" className="btn ghost" style={{ fontSize: 11 }}>View all →</Link>
          </div>
          {loading ? (
            <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3].map((i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="skel" style={{ height: 16, flex: 1 }} />
                  <div className="skel" style={{ height: 16, width: 60 }} />
                </div>
              ))}
            </div>
          ) : recent.length === 0 ? (
            <div className="empty">
              <div className="glyph">✎</div>
              <div className="h">No content yet</div>
              <p><Link href="/content-studio" style={{ color: 'var(--accent)' }}>Generate some →</Link></p>
            </div>
          ) : (
            <div className="list">
              {recent.map((item) => (
                <Link
                  key={item.id}
                  href="/approvals"
                  style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto auto', gap: 10, alignItems: 'center', padding: 'var(--cell-pad)', borderBottom: '1px solid var(--line-2)', cursor: 'pointer', transition: 'background 120ms' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--panel-2)' }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                >
                  <span className="type-ico">{item.content_type[0].toUpperCase()}</span>
                  <div style={{ minWidth: 0 }}>
                    <div className="title" style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.title ?? `${item.content_type.replace('_', ' ')} content`}
                    </div>
                    <div className="sub mono">{item.content_type.replace('_', ' ')} · {new Date(item.created_at).toLocaleDateString()}</div>
                  </div>
                  <ComplianceStatusBadge status={item.compliance_status} createdAt={item.created_at} />
                  <span className="chip mono">{item.status.replace('_', ' ')}</span>
                </Link>
              ))}
            </div>
          )}
        </div>

        <ActiveAlerts brandId={brandId} />
      </div>

      {/* ── Row 4: Intelligence ───────────────────────────────────────────── */}
      <IntelligenceSection brandId={brandId} />
    </div>
  )
}
