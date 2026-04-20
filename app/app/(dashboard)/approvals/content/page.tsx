'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import { ContentApprovalCard } from '@/components/ContentApprovalCard'
import { PublishConfirmCard } from '@/components/PublishConfirmCard'
import type { ContentQueueItem } from '@/types'

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

  const [pendingItems, setPendingItems] = useState<ContentQueueItem[]>([])
  const [confirmingItems, setConfirmingItems] = useState<ContentQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Fetch pending items and subscribe to real-time changes
  useEffect(() => {
    if (!activeBrand) {
      setLoading(false)
      return
    }

    const brandId = activeBrand.brand_id

    // Reset confirming items when brand changes
    setConfirmingItems([])
    setLoading(true)
    setFetchError(null)

    // Initial fetch
    supabase
      .from('content_queue')
      .select('*')
      .eq('brand_id', brandId)
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (error) {
          setFetchError(error.message)
        } else {
          setPendingItems(data ?? [])
        }
        setLoading(false)
      })

    // Real-time subscription — filter by brand_id, manage status client-side
    const channel = supabase
      .channel(`content_queue:${brandId}`)
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
            if (item.status === 'pending') {
              setPendingItems((prev) => [item, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            const item = payload.new as ContentQueueItem
            if (item.status !== 'pending') {
              // Remove from pending list — could have been actioned externally
              setPendingItems((prev) => prev.filter((p) => p.id !== item.id))
            } else {
              // Update the item in-place if still pending
              setPendingItems((prev) =>
                prev.map((p) => (p.id === item.id ? item : p))
              )
            }
          } else if (payload.eventType === 'DELETE') {
            setPendingItems((prev) => prev.filter((p) => p.id !== (payload.old as ContentQueueItem).id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.brand_id])

  async function handleApprove(item: ContentQueueItem) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('content_queue')
      .update({
        status: 'approved',
        approved_by: user?.email ?? null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) throw error

    // Optimistically move to confirming — real-time UPDATE will also fire and remove from pending
    setPendingItems((prev) => prev.filter((p) => p.id !== item.id))
    setConfirmingItems((prev) => [{ ...item, status: 'approved' }, ...prev])
  }

  async function handleReject(id: string) {
    const { error } = await supabase
      .from('content_queue')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    // Optimistic removal — real-time UPDATE will also fire
    setPendingItems((prev) => prev.filter((p) => p.id !== id))
  }

  async function handleConfirmPublish(item: ContentQueueItem) {
    const { error } = await supabase
      .from('content_queue')
      .update({
        status: 'publish_pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) throw error

    // Trigger n8n publish workflow now that status is committed
    const webhookPayload = {
      source_queue_id: item.id,
      brand_id: item.brand_id,
      platform: item.platform,
    }
    console.log('[handleConfirmPublish] firing n8n webhook', webhookPayload)
    const webhookRes = await fetch(
      'https://plasmaide.app.n8n.cloud/webhook/plasmaide-content-publish',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookPayload),
      }
    )
    console.log('[handleConfirmPublish] webhook response', webhookRes.status, webhookRes.ok)
    if (!webhookRes.ok) {
      throw new Error(`n8n webhook failed: ${webhookRes.status}`)
    }

    setConfirmingItems((prev) => prev.filter((c) => c.id !== item.id))
  }

  async function handleCancelPublish(id: string) {
    const { error } = await supabase
      .from('content_queue')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    setConfirmingItems((prev) => prev.filter((c) => c.id !== id))
  }

  function handleEdit() {
    // Phase 3+ — inline Claude-assisted editor
    alert('Inline editing will be available in a future phase.')
  }

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
            {loading ? '…' : pendingItems.length} pending
          </span>
        </div>
      </div>

      {/* Publish confirmation section */}
      {confirmingItems.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div className="section-head">
            <h2>Awaiting publish confirmation <span className="desc">· {confirmingItems.length}</span></h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {confirmingItems.map((item) => (
              <PublishConfirmCard
                key={item.id}
                item={item}
                onConfirm={() => handleConfirmPublish(item)}
                onCancel={() => handleCancelPublish(item.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Pending approval section */}
      <div>
        <div className="section-head">
          <h2>Pending approval</h2>
        </div>

        {fetchError && (
          <div className="err-banner">{fetchError}</div>
        )}

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="card">
            <div className="empty">
              <div className="glyph">✓</div>
              <div className="h">Queue empty</div>
              <p>No content awaiting approval for {activeBrand.name}.</p>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {pendingItems.map((item) => (
              <ContentApprovalCard
                key={item.id}
                item={item}
                onApprove={() => handleApprove(item)}
                onReject={() => handleReject(item.id)}
                onEdit={handleEdit}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
