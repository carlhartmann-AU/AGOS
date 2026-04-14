'use client'

import { useState } from 'react'
import type { FinancialQueueItem } from '@/types'

// ─── Labels & styles ──────────────────────────────────────────────────────────

const ACTION_TYPE_LABELS: Record<string, string> = {
  budget_reallocation: 'Budget Reallocation',
  xero_journal: 'Xero Journal Entry',
  refund_approval: 'Refund Approval',
  invoice_update: 'Invoice Update',
  spend_pause: 'Spend Pause',
  spend_increase: 'Spend Increase',
}

// Visual weight — financial actions carry real consequence
const ACTION_TYPE_STYLES: Record<string, string> = {
  budget_reallocation: 'bg-amber-50 text-amber-700 border-amber-200',
  xero_journal: 'bg-blue-50 text-blue-700 border-blue-200',
  refund_approval: 'bg-red-50 text-red-700 border-red-200',
  invoice_update: 'bg-gray-100 text-gray-600 border-gray-200',
  spend_pause: 'bg-amber-50 text-amber-700 border-amber-200',
  spend_increase: 'bg-green-50 text-green-700 border-green-200',
}

const RISK_STYLES: Record<string, string> = {
  low: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-amber-50 text-amber-700 border-amber-200',
  high: 'bg-red-50 text-red-700 border-red-200',
  critical: 'bg-red-100 text-red-800 border-red-300',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAUD(amount: number | null): string {
  if (amount === null) return 'No amount specified'
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    minimumFractionDigits: 2,
  }).format(amount)
}

function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatRequestedBy(raw: string): string {
  return raw.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * Renders a details value that may be a string, number, object, or array.
 * Strings render as paragraphs. Objects render as a compact key:value grid.
 * Arrays render as a bullet list.
 */
function DetailsValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return null

  if (typeof value === 'string' || typeof value === 'number') {
    return <p className="text-sm text-gray-700 leading-relaxed">{String(value)}</p>
  }

  if (Array.isArray(value)) {
    return (
      <ul className="text-sm text-gray-700 space-y-0.5 list-disc list-inside">
        {value.map((item, i) => (
          <li key={i}>{typeof item === 'object' ? JSON.stringify(item) : String(item)}</li>
        ))}
      </ul>
    )
  }

  if (typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>)
    return (
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        {entries.map(([k, v]) => (
          <>
            <dt key={`k-${k}`} className="text-xs font-medium text-gray-400 whitespace-nowrap pt-0.5">
              {k.replace(/_/g, ' ')}
            </dt>
            <dd key={`v-${k}`} className="text-xs text-gray-700">
              {typeof v === 'object' ? JSON.stringify(v) : String(v ?? '—')}
            </dd>
          </>
        ))}
      </dl>
    )
  }

  return null
}

// ─── Section wrapper for card body rows ───────────────────────────────────────

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-t border-gray-100 first:border-t-0">
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1.5">{label}</p>
      {children}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

type Props = {
  item: FinancialQueueItem
  onApprove: () => Promise<void>
  onReject: () => Promise<void>
  onRequestDetail: () => void
}

export function FinancialApprovalCard({ item, onApprove, onReject, onRequestDetail }: Props) {
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const details = item.details as Record<string, unknown>
  const riskLevel = typeof details.risk_level === 'string'
    ? details.risk_level.toLowerCase()
    : null

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
      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${
              ACTION_TYPE_STYLES[item.action_type] ?? 'bg-gray-100 text-gray-600 border-gray-200'
            }`}
          >
            {ACTION_TYPE_LABELS[item.action_type] ?? item.action_type}
          </span>

          {item.amount_aud !== null && (
            <span className="text-sm font-semibold text-gray-900">
              {formatAUD(item.amount_aud)}
            </span>
          )}

          {riskLevel && RISK_STYLES[riskLevel] && (
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${RISK_STYLES[riskLevel]}`}
            >
              {riskLevel.charAt(0).toUpperCase() + riskLevel.slice(1)} risk
            </span>
          )}
        </div>

        <div className="text-right flex-shrink-0">
          <p className="text-xs text-gray-400">{formatRelativeTime(item.created_at)}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            via {formatRequestedBy(item.requested_by)}
          </p>
        </div>
      </div>

      {/* Detail rows */}
      <div className="px-5 pb-4">
        {/* Rationale */}
        {!!details.rationale && (
          <DetailRow label="Rationale">
            <DetailsValue value={details.rationale} />
          </DetailRow>
        )}

        {/* Current state */}
        {'current_state' in details && (
          <DetailRow label="Current state">
            <DetailsValue value={details.current_state} />
          </DetailRow>
        )}

        {/* Proposed state */}
        {'proposed_state' in details && (
          <DetailRow label="Proposed state">
            <DetailsValue value={details.proposed_state} />
          </DetailRow>
        )}

        {/* Risk assessment */}
        {!!details.risk_assessment && (
          <DetailRow label="Risk assessment">
            <div
              className={`rounded-md p-3 border ${
                riskLevel === 'high' || riskLevel === 'critical'
                  ? 'bg-red-50 border-red-200'
                  : riskLevel === 'medium'
                  ? 'bg-amber-50 border-amber-200'
                  : 'bg-gray-50 border-gray-200'
              }`}
            >
              <DetailsValue value={details.risk_assessment} />
            </div>
          </DetailRow>
        )}

        {/* Fallback: no structured fields found — render raw details */}
        {!details.rationale &&
          !('current_state' in details) &&
          !('proposed_state' in details) &&
          !details.risk_assessment && (
            <DetailRow label="Details">
              <DetailsValue value={details} />
            </DetailRow>
          )}
      </div>

      {/* Inline error */}
      {error && (
        <div className="px-5 pb-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-between gap-2">
        <button
          onClick={onRequestDetail}
          disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          Request Detail
        </button>

        <div className="flex items-center gap-2">
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
    </div>
  )
}
