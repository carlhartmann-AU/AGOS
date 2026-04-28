'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ContentQueueItem } from '@/types'
import type { RuleResult } from '@/types/compliance'

const CONTENT_TYPE_LABELS: Record<string, string> = {
  email: 'Email',
  blog: 'Blog Post',
  social_caption: 'Social',
  ad: 'Ad',
  landing_page: 'Landing Page',
  b2b_email: 'B2B Email',
  cs_response: 'CS Response',
  review_response: 'Review Response',
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

// ─── Compliance status badge (new engine) ─────────────────────────────────────

const COMPLIANCE_STATUS_STYLES: Record<string, string> = {
  passed:   'bg-green-50 text-green-700 border-green-200',
  warnings: 'bg-amber-50 text-amber-700 border-amber-200',
  escalated:'bg-orange-50 text-orange-700 border-orange-200',
  blocked:  'bg-red-50 text-red-700 border-red-200',
}

const COMPLIANCE_STATUS_LABELS: Record<string, string> = {
  passed:   '✓ Passed',
  warnings: '⚠ Warnings',
  escalated:'⚡ Escalated',
  blocked:  '✗ Blocked',
}

function ComplianceStatusBadge({ status, createdAt }: { status: string | null | undefined; createdAt?: string }) {
  if (!status || status === 'pending') {
    const isRecent = !!createdAt && (Date.now() - new Date(createdAt).getTime()) < 60_000
    if (isRecent) {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium bg-blue-50 text-blue-500 border-blue-200 animate-pulse">
          Checking…
        </span>
      )
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium bg-gray-50 text-gray-400 border-gray-100">
        Not checked
      </span>
    )
  }
  const style = COMPLIANCE_STATUS_STYLES[status] ?? 'bg-gray-50 text-gray-500 border-gray-200'
  const label = COMPLIANCE_STATUS_LABELS[status] ?? status
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${style}`}>
      {label}
    </span>
  )
}

// ─── Severity badge ───────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, string> = {
    minor:    'bg-yellow-100 text-yellow-700',
    major:    'bg-orange-100 text-orange-700',
    critical: 'bg-red-100 text-red-700',
  }
  return (
    <span className={`text-xs font-medium px-1.5 py-0.5 rounded capitalize ${styles[severity] ?? 'bg-gray-100 text-gray-600'}`}>
      {severity}
    </span>
  )
}

// ─── Rule result row ──────────────────────────────────────────────────────────

function RuleResultRow({ r }: { r: RuleResult }) {
  const [showFix, setShowFix] = useState(false)
  return (
    <div className={`p-3 rounded-md text-xs space-y-1.5 ${r.passed ? 'bg-green-50' : r.severity === 'critical' ? 'bg-red-50' : r.severity === 'major' ? 'bg-orange-50' : 'bg-yellow-50'}`}>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`font-semibold ${r.passed ? 'text-green-700' : 'text-gray-800'}`}>
          {r.passed ? '✓' : '✗'} {r.rule_name}
        </span>
        <SeverityBadge severity={r.severity} />
        {r.auto_fixed && (
          <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded text-xs font-medium">Auto-fixed</span>
        )}
        {r.matches && r.matches.length > 0 && (
          <span className="text-gray-500">matched: {r.matches.slice(0, 3).join(', ')}{r.matches.length > 3 ? '…' : ''}</span>
        )}
      </div>
      <p className="text-gray-600">{r.explanation}</p>
      {r.suggested_fix && (
        <div>
          <button
            onClick={() => setShowFix((v) => !v)}
            className="text-indigo-600 hover:text-indigo-500 underline text-xs"
          >
            {showFix ? 'Hide' : 'Show'} suggested fix
          </button>
          {showFix && (
            <p className="mt-1 text-gray-700 bg-white rounded p-2 border border-gray-200">{r.suggested_fix}</p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Compliance detail panel ──────────────────────────────────────────────────

type ComplianceCheckRow = {
  overall_status: string
  auto_fixes_applied: number
  minor_count: number
  major_count: number
  critical_count: number
  rule_results: RuleResult[]
  duration_ms: number
}

function ComplianceDetailPanel({ checkId }: { checkId: string }) {
  const [data, setData] = useState<ComplianceCheckRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (loaded) return
    setLoading(true)
    const supabase = createClient()
    const { data: row, error: err } = await supabase
      .from('compliance_checks')
      .select('overall_status, auto_fixes_applied, minor_count, major_count, critical_count, rule_results, duration_ms')
      .eq('id', checkId)
      .single()
    setLoading(false)
    setLoaded(true)
    if (err || !row) { setError(err?.message ?? 'Not found'); return }
    setData(row as ComplianceCheckRow)
  }

  const [open, setOpen] = useState(false)

  function toggle() {
    if (!open) load()
    setOpen((v) => !v)
  }

  return (
    <div className="border-t border-gray-100">
      <button
        onClick={toggle}
        className="w-full flex items-center justify-between px-5 py-2.5 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span className="font-medium">Compliance details</span>
        <span>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-2">
          {loading && <p className="text-xs text-gray-400 animate-pulse">Loading…</p>}
          {error && <p className="text-xs text-red-500">{error}</p>}
          {data && (
            <>
              <div className="flex items-center gap-3 text-xs text-gray-500 pb-1">
                {data.auto_fixes_applied > 0 && (
                  <span className="text-blue-600">{data.auto_fixes_applied} auto-fix{data.auto_fixes_applied > 1 ? 'es' : ''} applied</span>
                )}
                <span>{data.minor_count} minor · {data.major_count} major · {data.critical_count} critical</span>
                <span className="text-gray-400">{data.duration_ms}ms</span>
              </div>
              <div className="space-y-2">
                {(data.rule_results as RuleResult[]).map((r, i) => (
                  <RuleResultRow key={r.rule_id ?? i} r={r} />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Main card ────────────────────────────────────────────────────────────────

type Props = {
  item: ContentQueueItem
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  onEdit: () => void
}

export function ContentApprovalCard({ item, onApprove, onReject, onEdit }: Props) {
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const content = (item.content ?? {}) as Record<string, unknown>

  const rawBody = (
    content.body_plain ??
    content.body_html ??
    content.summary ??
    content.summary_html ??
    content.caption ??
    ''
  ) as string
  const previewFull = rawBody.startsWith('<') ? stripHtml(rawBody) : rawBody
  const bodyPreview = previewFull ? previewFull.slice(0, 300) : null
  const bodyTruncated = previewFull.length > 300

  async function handleApprove() {
    setActionLoading('approve')
    setError(null)
    try {
      await onApprove()
    } catch {
      setError('Failed to approve. Please try again.')
      setActionLoading(null)
    }
  }

  async function handleReject() {
    setActionLoading('reject')
    setError(null)
    try {
      await onReject()
    } catch {
      setError('Failed to reject. Please try again.')
      setActionLoading(null)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header row */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
          </span>
          {item.platform && (
            <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              {item.platform}
            </span>
          )}
          {item.audience && (
            <span className="text-xs font-medium bg-purple-50 text-purple-600 px-2 py-0.5 rounded">
              {item.audience.replace(/_/g, ' ')}
            </span>
          )}
          <ComplianceStatusBadge status={item.compliance_status} createdAt={item.created_at} />
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          {formatRelativeTime(item.created_at)}
        </span>
      </div>

      {/* Content preview */}
      <div className="px-5 pb-4">
        {!!content.subject && (
          <p className="text-sm font-medium text-gray-900 mb-1">{content.subject as string}</p>
        )}
        {!!content.title && !content.subject && (
          <p className="text-sm font-medium text-gray-900 mb-1">{content.title as string}</p>
        )}
        {bodyPreview ? (
          <p className="text-sm text-gray-600 leading-relaxed line-clamp-4">
            {bodyPreview}
            {bodyTruncated ? '…' : ''}
          </p>
        ) : (
          <p className="text-sm text-gray-400 italic">No preview available</p>
        )}
      </div>

      {/* Compliance detail panel — expandable, loads on demand */}
      {item.latest_compliance_check_id && (
        <ComplianceDetailPanel checkId={item.latest_compliance_check_id} />
      )}

      {/* Inline error */}
      {error && (
        <div className="px-5 pb-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Action buttons */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
        <button
          onClick={onEdit}
          disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Edit
        </button>
        <button
          onClick={handleReject}
          disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        <button
          onClick={handleApprove}
          disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {actionLoading === 'approve' ? 'Approving…' : 'Approve →'}
        </button>
      </div>
    </div>
  )
}
