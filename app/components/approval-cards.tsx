'use client'

import { useState } from 'react'
import type { ContentQueueItem } from '@/types'

export { ContentApprovalCard } from './ContentApprovalCard'
export { PublishConfirmCard } from './PublishConfirmCard'

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

function formatRelativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function CardHeader({ item, badge }: { item: ContentQueueItem; badge: React.ReactNode }) {
  const content = (item.content ?? {}) as Record<string, unknown>
  const title = (content.title ?? content.subject ?? null) as string | null
  return (
    <div className="px-5 py-4">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {CONTENT_TYPE_LABELS[item.content_type] ?? item.content_type}
          </span>
          {item.platform && (
            <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              {item.platform}
            </span>
          )}
          {badge}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          {formatRelativeTime(item.updated_at)}
        </span>
      </div>
      {title && (
        <p className="text-sm font-medium text-gray-900">{title}</p>
      )}
    </div>
  )
}

// ─── PublishingCard ───────────────────────────────────────────────────────────
// Shown for status='publish_pending' — queued for publishing by n8n.

type PullBackProps = {
  item: ContentQueueItem
  onPullBack: () => Promise<void>
}

export function PublishingCard({ item, onPullBack }: PullBackProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handlePullBack() {
    setLoading(true)
    setError(null)
    try {
      await onPullBack()
    } catch {
      setError('Failed to pull back. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-amber-200 overflow-hidden">
      <CardHeader
        item={item}
        badge={
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-xs font-medium bg-amber-50 text-amber-700 border-amber-200">
            <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Publishing to Shopify…
          </span>
        }
      />
      {item.approved_by && (
        <div className="px-5 pb-3">
          <p className="text-xs text-gray-400">
            Approved by {item.approved_by}
            {item.approved_at ? ` · ${formatRelativeTime(item.approved_at)}` : ''}
          </p>
        </div>
      )}
      {error && (
        <div className="px-5 pb-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
        <button
          onClick={handlePullBack}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Pulling back…' : 'Pull Back'}
        </button>
      </div>
    </div>
  )
}

// ─── EscalatedCard ────────────────────────────────────────────────────────────
// Shown for status='escalated' — compliance flagged for manual review.

export function EscalatedCard({ item, onPullBack }: PullBackProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const content = (item.content ?? {}) as Record<string, unknown>
  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const rawBody = (
    content.body_plain ??
    content.body_html ??
    content.summary ??
    content.summary_html ??
    content.caption ??
    ''
  ) as string
  const bodyPreview = rawBody
    ? (rawBody.startsWith('<') ? stripHtml(rawBody) : rawBody).slice(0, 200)
    : null

  const complianceResult = (item.compliance_result ?? null) as Record<string, unknown> | null
  const notes = Array.isArray(complianceResult?.notes) ? (complianceResult!.notes as unknown[]) : []
  const escalationReason = (complianceResult?.escalation_reason ?? null) as string | null

  async function handlePullBack() {
    setLoading(true)
    setError(null)
    try {
      await onPullBack()
    } catch {
      setError('Failed to pull back. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-orange-200 overflow-hidden">
      <CardHeader
        item={item}
        badge={
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs font-medium bg-orange-50 text-orange-700 border-orange-200">
            ⚡ Compliance escalated — manual review required
          </span>
        }
      />
      {(bodyPreview || escalationReason || notes.length > 0) ? (
        <div className="px-5 pb-3 space-y-2">
          {(escalationReason || notes.length > 0) && (
            <div>
              <p className="text-xs font-medium text-orange-700 mb-1">Why this was escalated</p>
              {escalationReason && (
                <p className="text-xs text-orange-700 bg-orange-50 rounded px-3 py-2 border border-orange-100 mb-1">
                  {escalationReason}
                </p>
              )}
              {Array.isArray(notes) && notes.length > 0 && (
                <ul className="text-xs text-gray-600 space-y-1">
                  {notes.map((note, i) => (
                    <li key={i} className="flex gap-1.5">
                      <span className="text-orange-400 mt-0.5">·</span>
                      <span>{String(note)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {bodyPreview && (
            <p className="text-xs text-gray-500 line-clamp-3">{bodyPreview}…</p>
          )}
        </div>
      ) : null}
      {error && (
        <div className="px-5 pb-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-100 flex justify-end">
        <button
          onClick={handlePullBack}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Pulling back…' : 'Pull Back'}
        </button>
      </div>
    </div>
  )
}

// ─── BlogGoLiveCard ───────────────────────────────────────────────────────────
// Shown for status='approved' + content_type='blog'.
// Draft exists in Shopify; this action publishes it live.

type BlogGoLiveProps = {
  item: ContentQueueItem
  onGoLive: () => Promise<void>
  onReject: () => Promise<void>
}

export function BlogGoLiveCard({ item, onGoLive, onReject }: BlogGoLiveProps) {
  const [actionLoading, setActionLoading] = useState<'golive' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const content = (item.content ?? {}) as Record<string, unknown>
  const title = (content.title ?? content.subject ?? '(untitled)') as string

  const stripHtml = (s: string) => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const rawBody = (
    content.body_plain ??
    content.body_html ??
    content.summary ??
    content.summary_html ??
    content.caption ??
    ''
  ) as string
  const bodyPreview = rawBody
    ? (rawBody.startsWith('<') ? stripHtml(rawBody) : rawBody).slice(0, 200)
    : null

  async function handleGoLive() {
    setActionLoading('golive')
    setError(null)
    try {
      await onGoLive()
    } catch {
      setError('Failed to go live. Please try again.')
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
    <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
      <div className="px-5 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
        <span className="text-green-700 text-sm font-medium">✓ Approved — ready to go live</span>
      </div>
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            Blog Post
          </span>
        </div>
        <p className="text-sm font-medium text-gray-900 mb-1">{title}</p>
        {bodyPreview && (
          <p className="text-xs text-gray-500 line-clamp-2">{bodyPreview}…</p>
        )}
      </div>
      {(item.approved_by || item.approved_at) && (
        <div className="px-5 pb-3">
          <p className="text-xs text-gray-400">
            Approved by {item.approved_by ?? 'unknown'}
            {item.approved_at ? ` · ${formatRelativeTime(item.approved_at)}` : ''}
          </p>
        </div>
      )}
      {error && (
        <div className="px-5 pb-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
        <button
          onClick={handleReject}
          disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {actionLoading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>
        <button
          onClick={handleGoLive}
          disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {actionLoading === 'golive' ? 'Going live…' : 'Go Live →'}
        </button>
      </div>
    </div>
  )
}
