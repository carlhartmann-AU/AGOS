'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import {
  ContentApprovalCard,
  BlogGoLiveCard,
  PublishConfirmCard,
  PublishingCard,
  EscalatedCard,
} from '@/components/approval-cards'
import { CardErrorBoundary } from './content/CardErrorBoundary'
import * as dispatcher from '@/lib/content/approval-dispatcher'
import { ApprovalActionError } from '@/lib/content/approval-dispatcher'
import type { ContentQueueItem } from '@/types'

const ACTIVE_STATUSES = ['pending', 'approved', 'publish_pending', 'escalated'] as const
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

export default function ApprovalsPage() {
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

    const channel = supabase
      .channel(`approvals_unified:${brandId}`)
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
              setItems((prev) =>
                prev.some((p) => p.id === item.id)
                  ? prev.map((p) => (p.id === item.id ? item : p))
                  : [item, ...prev],
              )
            } else {
              setItems((prev) => prev.filter((p) => p.id !== item.id))
            }
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) => prev.filter((p) => p.id !== (payload.old as ContentQueueItem).id))
          }
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.brand_id])

  function showError(err: unknown) {
    if (err instanceof ApprovalActionError) {
      setActionError(err.detail ? `${err.message}: ${err.detail}` : err.message)
    } else if (err instanceof Error) {
      setActionError(err.message)
    } else {
      setActionError('An unexpected error occurred.')
    }
  }

  async function handleApprove(item: ContentQueueItem) {
    setActionError(null)
    try {
      await dispatcher.approve(item)
    } catch (err) {
      showError(err)
    }
  }

  async function handleGoLive(item: ContentQueueItem) {
    setActionError(null)
    try {
      await dispatcher.goLive(item)
    } catch (err) {
      showError(err)
    }
  }

  async function handleConfirmPublish(item: ContentQueueItem) {
    setActionError(null)
    try {
      await dispatcher.confirmPublish(item)
    } catch (err) {
      showError(err)
    }
  }

  async function handleReject(item: ContentQueueItem) {
    setActionError(null)
    try {
      await dispatcher.reject(item)
    } catch (err) {
      showError(err)
    }
  }

  async function handlePullBack(item: ContentQueueItem) {
    setActionError(null)
    try {
      await dispatcher.pullBack(item)
    } catch (err) {
      showError(err)
    }
  }

  function renderCard(item: ContentQueueItem) {
    if (item.status === 'escalated') {
      return (
        <CardErrorBoundary key={item.id} contentId={item.id}>
          <EscalatedCard
            item={item}
            onPullBack={() => handlePullBack(item)}
          />
        </CardErrorBoundary>
      )
    }

    if (item.status === 'pending') {
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
    }

    if (item.status === 'approved') {
      if (item.content_type === 'blog') {
        return (
          <CardErrorBoundary key={item.id} contentId={item.id}>
            <BlogGoLiveCard
              item={item}
              onGoLive={() => handleGoLive(item)}
              onReject={() => handleReject(item)}
            />
          </CardErrorBoundary>
        )
      }
      return (
        <CardErrorBoundary key={item.id} contentId={item.id}>
          <PublishConfirmCard
            item={item}
            onConfirm={() => handleConfirmPublish(item)}
            onCancel={() => handlePullBack(item)}
          />
        </CardErrorBoundary>
      )
    }

    if (item.status === 'publish_pending') {
      return (
        <CardErrorBoundary key={item.id} contentId={item.id}>
          <PublishingCard
            item={item}
            onPullBack={() => handlePullBack(item)}
          />
        </CardErrorBoundary>
      )
    }

    return null
  }

  if (!activeBrand) {
    return (
      <div className="page">
        <div className="page-head">
          <div>
            <h1 className="page-title">Approvals</h1>
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

  const escalated = items.filter((i) => i.status === 'escalated')
  const pending = items.filter((i) => i.status === 'pending')
  const approved = items.filter((i) => i.status === 'approved')
  const publishPending = items.filter((i) => i.status === 'publish_pending')
  const allEmpty = escalated.length === 0 && pending.length === 0 && approved.length === 0 && publishPending.length === 0

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1 className="page-title">Approvals</h1>
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
      ) : allEmpty ? (
        <div className="card">
          <div className="empty">
            <div className="glyph">✓</div>
            <div className="h">Nothing in the queue right now.</div>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          {escalated.length > 0 && (
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                Escalated ({escalated.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {escalated.map(renderCard)}
              </div>
            </section>
          )}

          {pending.length > 0 && (
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                Needs review ({pending.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pending.map(renderCard)}
              </div>
            </section>
          )}

          {approved.length > 0 && (
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                Awaiting publish ({approved.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {approved.map(renderCard)}
              </div>
            </section>
          )}

          {publishPending.length > 0 && (
            <section>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)', marginBottom: 10 }}>
                Publishing… ({publishPending.length})
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {publishPending.map(renderCard)}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}
