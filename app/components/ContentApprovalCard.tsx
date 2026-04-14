'use client'

import { useState } from 'react'
import type { ContentQueueItem, ComplianceViolation } from '@/types'

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

function ComplianceBadge({ result }: { result: 'PASS' | 'FAIL' | 'ESCALATE' }) {
  const styles = {
    PASS: 'bg-green-50 text-green-700 border-green-200',
    FAIL: 'bg-red-50 text-red-700 border-red-200',
    ESCALATE: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const labels = { PASS: '✓ Compliant', FAIL: '✗ Violations', ESCALATE: '⚠ Escalated' }
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${styles[result]}`}
    >
      {labels[result]}
    </span>
  )
}

function ViolationRow({ v }: { v: ComplianceViolation }) {
  const isCritical = v.severity === 'critical'
  return (
    <div
      className={`p-3 rounded-md text-xs space-y-1.5 ${isCritical ? 'bg-red-50' : 'bg-amber-50'}`}
    >
      <div className="flex items-center justify-between">
        <span
          className={`font-semibold capitalize ${isCritical ? 'text-red-700' : 'text-amber-700'}`}
        >
          {v.check.replace('_', ' ')} &middot; {v.severity}
        </span>
        <span className="text-gray-400">{v.rule_reference}</span>
      </div>
      <p className="text-gray-500">{v.location}</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <span className="block text-gray-400 mb-0.5">Original</span>
          <span className="text-gray-700 italic">&ldquo;{v.original}&rdquo;</span>
        </div>
        <div>
          <span className="block text-gray-400 mb-0.5">Suggested</span>
          <span className="text-gray-700">{v.suggestion}</span>
        </div>
      </div>
    </div>
  )
}

type Props = {
  item: ContentQueueItem
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  onEdit: () => void
}

export function ContentApprovalCard({ item, onApprove, onReject, onEdit }: Props) {
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showViolations, setShowViolations] = useState(false)

  const content = item.content as Record<string, string>
  const compliance = item.compliance_result
  const violations = compliance?.violations ?? []

  const bodyPreview = content.body_plain
    ? content.body_plain.slice(0, 300)
    : content.body_html
    ? stripHtml(content.body_html).slice(0, 300)
    : null
  const bodyTruncated =
    (content.body_plain?.length ?? 0) > 300 ||
    (content.body_html ? stripHtml(content.body_html).length > 300 : false)

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
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          {formatRelativeTime(item.created_at)}
        </span>
      </div>

      {/* Content preview */}
      <div className="px-5 pb-4">
        {content.subject && (
          <p className="text-sm font-medium text-gray-900 mb-1">{content.subject}</p>
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

      {/* Compliance result */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center gap-3 flex-wrap">
        {compliance ? (
          <>
            <ComplianceBadge result={compliance.result} />
            {violations.length > 0 && (
              <button
                onClick={() => setShowViolations((v) => !v)}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                {violations.length} violation{violations.length > 1 ? 's' : ''} &mdash;{' '}
                {showViolations ? 'hide' : 'show'}
              </button>
            )}
            {compliance.escalation_reason && (
              <span className="text-xs text-amber-600">{compliance.escalation_reason}</span>
            )}
          </>
        ) : (
          <span className="text-xs text-gray-400">No compliance result attached</span>
        )}
      </div>

      {/* Violations accordion */}
      {showViolations && violations.length > 0 && (
        <div className="px-5 pb-4 space-y-2">
          {violations.map((v, i) => (
            <ViolationRow key={i} v={v} />
          ))}
        </div>
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
