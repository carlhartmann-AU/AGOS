'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import { ContentApprovalCard } from '@/components/ContentApprovalCard'
import { PublishConfirmCard } from '@/components/PublishConfirmCard'
import { PublishingCard, EscalatedCard } from '@/components/approval-cards'
import { CardErrorBoundary } from './CardErrorBoundary'
import type { ContentQueueItem } from '@/types'

// Active states fetched and rendered. Terminal states (published, rejected) are
// excluded — they belong in a future history view.
const ACTIVE_STATUSES = [
  'pending',
  'approved',
  'publish_pending',
  'escalated',
] as const

type ActiveStatus = typeof ACTIVE_STATUSES[number]

function isActiveStatus(status: string): status is ActiveStatus {
  return (ACTIVE_STATUSES as readonly string[]).includes(status)
}

function SkeletonCard() {
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <div className="skel" style={{ height: 20, width: 60 }} />
        <div className="skel" style={{ height: 20, width: 80 }} />
      </div>
      <div className="skel" style={{ height: 14, width: '60%', marginBottom: 10 }} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="skel" style={{ height: 12 }} />
        <div className="skel" style={{ height: 12, width: '80%' }} />
      </div>
    </div>
  )
}

export default function ContentApprovalsPage() {
  const { activeBrand } = useBrand()
  const supabase = createClient()

  const [items, setItems] = useState<ContentQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (!activeBrand) {
      setLoading(false)
      return
    }

    const brandId = activeBrand.brand_id
    setItems([])
    setLoading(true)
    setFetchError(null)

    // Initial fetch — all active states in a single query
    supabase
      .from('content_queue')
      .select('*')
      .eq('brand_id', brandId)
      .in('status', [...ACTIVE_STATUSES])
      .order('updated_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setFetchError(error.message)
        } else {
          setItems((data as ContentQueueItem[]) ?? [])
        }
        setLoading(false)
      })

    // Real-time subscription — DB is the single source of truth
    const channel = supabase
      .channel(`content_queue_active:${brandId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'content_queue',
          filter: `brand_id=eq.${brandId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const item = payload.new as ContentQueueItem
            if (isActiveStatus(item.status)) {
              setItems((prev) => [item, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            const item = payload.new as ContentQueueItem
            if (isActiveStatus(item.status)) {
              // Row is still active — replace in place
              setItems((prev) =>
                prev.some((p) => p.id === item.id)
                  ? prev.map((p) => (p.id === item.id ? item : p))
                  : [item, ...prev]
              )
            } else {
              // Row moved to a terminal state (published / rejected) — remove
              setItems((prev) => prev.filter((p) => p.id !== item.id))
            }
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((p) => p.id !== (payload.old as ContentQueueItem).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.brand_id])

  // ── Handlers — no optimistic state; real-time subscription reflects new status ──

  async function handleApprove(item: ContentQueueItem) {
    setActionError(null)
    const res = await fetch('/api/web-designer/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, action: 'draft', brand_id: item.brand_id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      const msg = (body.error as string) ?? `Approve failed: ${res.status}`
      setActionError(msg)
      throw new Error(msg)
    }
  }

  async function handleReject(item: ContentQueueItem) {
    setActionError(null)
    const res = await fetch('/api/web-designer/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, action: 'reject', brand_id: item.brand_id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      const msg = (body.error as string) ?? `Reject failed: ${res.status}`
      setActionError(msg)
      throw new Error(msg)
    }
  }

  async function handleConfirmPublish(item: ContentQueueItem) {
    setActionError(null)
    const res = await fetch('/api/content/publish', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content_id: item.id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      const msg = (body.error as string) ?? `Publish failed: ${res.status}`
      setActionError(msg)
      throw new Error(msg)
    }
  }

  async function handlePullBack(item: ContentQueueItem) {
    setActionError(null)
    const res = await fetch('/api/web-designer/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, action: 'pull_back', brand_id: item.brand_id }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as Record<string, unknown>
      const msg = (body.error as string) ?? `Pull back failed: ${res.status}`
      setActionError(msg)
      throw new Error(msg)
    }
  }

  // ── Per-item card renderer — switch on status ─────────────────────────────

  function renderCard(item: ContentQueueItem) {
    const status = item.status as ActiveStatus

    switch (status) {
      case 'pending':
        return (
          <CardErrorBoundary key={item.id} contentId={item.id}>
            <ContentApprovalCard
              item={item}
              onApprove={() => handleApprove(item)}
              onReject={() => handleReject(item)}
              onEdit={() => {}}
            />
          </CardErrorBoundary>
        )

      case 'approved':
        return (
          <CardErrorBoundary key={item.id} contentId={item.id}>
            <PublishConfirmCard
              item={item}
              onConfirm={() => handleConfirmPublish(item)}
              onCancel={() => handlePullBack(item)}
            />
          </CardErrorBoundary>
        )

      case 'publish_pending':
        return (
          <CardErrorBoundary key={item.id} contentId={item.id}>
            <PublishingCard
              item={item}
              onPullBack={() => handlePullBack(item)}
            />
          </CardErrorBoundary>
        )

      case 'escalated':
        return (
          <CardErrorBoundary key={item.id} contentId={item.id}>
            <EscalatedCard
              item={item}
              onPullBack={() => handlePullBack(item)}
            />
          </CardErrorBoundary>
        )

      default:
        return null
    }
  }

  // ── No-brand guard ────────────────────────────────────────────────────────

  if (!activeBrand) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Content Approvals</h1>
            <div className="page-sub">Review and approve content before it publishes.</div>
          </div>
        </div>
        <div className="card">
          <div className="empty">
            <div className="glyph">◎</div>
            <div className="h">No brand selected</div>
            <p>Select a brand to view the approval queue.</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Main render ───────────────────────────────────────────────────────────

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Content Approvals</h1>
          <div className="page-sub">Review and approve content before it publishes.</div>
        </div>
        <div className="page-meta">
          <span className="chip mono">
            <span className="dot" />
            {loading ? '…' : items.length} active
          </span>
        </div>
      </div>

      {actionError && (
        <div className="err-banner" style={{ marginBottom: 12 }}>
          {actionError}
        </div>
      )}

      {fetchError && (
        <div className="err-banner" style={{ marginBottom: 12 }}>
          {fetchError}
        </div>
      )}

      {loading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <SkeletonCard />
          <SkeletonCard />
        </div>
      ) : items.length === 0 ? (
        <div className="card">
          <div className="empty">
            <div className="glyph">✓</div>
            <div className="h">Nothing in the queue right now.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {items.map((item) => renderCard(item))}
        </div>
      )}
    </div>
  )
}
