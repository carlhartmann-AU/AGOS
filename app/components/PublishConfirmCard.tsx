'use client'

import { useState } from 'react'
import type { ContentQueueItem } from '@/types'

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

type Props = {
  item: ContentQueueItem
  onConfirm: () => Promise<void>
  onCancel: () => Promise<void>
}

export function PublishConfirmCard({ item, onConfirm, onCancel }: Props) {
  const [actionLoading, setActionLoading] = useState<'confirm' | 'cancel' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const content = (item.content ?? {}) as Record<string, unknown>
  const title = (content.title ?? content.subject ?? '(untitled)') as string

  async function handleConfirm() {
    setActionLoading('confirm')
    setError(null)
    try {
      await onConfirm()
    } catch {
      setError('Failed to confirm. Please try again.')
      setActionLoading(null)
    }
  }

  async function handleCancel() {
    setActionLoading('cancel')
    setError(null)
    try {
      await onCancel()
    } catch {
      setError('Failed to cancel. Please try again.')
      setActionLoading(null)
    }
  }

  return (
    <div className="bg-white rounded-lg border border-green-200 overflow-hidden">
      {/* Status header */}
      <div className="px-5 py-3 bg-green-50 border-b border-green-200 flex items-center gap-2">
        <span className="text-green-700 text-sm font-medium">
          ✓ Approved — confirm publish
        </span>
      </div>

      {/* Content summary */}
      <div className="px-5 py-4">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
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
        <p className="text-sm font-medium text-gray-900 mb-2">{title}</p>
        <p className="text-sm text-gray-500">
          Confirming will set status to{' '}
          <span className="font-mono text-xs bg-gray-100 px-1 py-0.5 rounded">
            publish_pending
          </span>{' '}
          and queue this for n8n to publish to the target platform.
        </p>
      </div>

      {/* Inline error */}
      {error && (
        <div className="px-5 pb-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
        <button
          onClick={handleCancel}
          disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {actionLoading === 'cancel' ? 'Cancelling…' : 'Cancel'}
        </button>
        <button
          onClick={handleConfirm}
          disabled={!!actionLoading}
          className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
        >
          {actionLoading === 'confirm' ? 'Confirming…' : 'Confirm Publish →'}
        </button>
      </div>
    </div>
  )
}
