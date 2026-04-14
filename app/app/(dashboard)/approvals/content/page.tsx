'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'
import { ContentApprovalCard } from '@/components/ContentApprovalCard'
import { PublishConfirmCard } from '@/components/PublishConfirmCard'
import type { ContentQueueItem } from '@/types'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse space-y-3">
      <div className="flex gap-2">
        <div className="h-5 bg-gray-100 rounded w-16" />
        <div className="h-5 bg-gray-100 rounded w-20" />
      </div>
      <div className="h-4 bg-gray-100 rounded w-2/3" />
      <div className="space-y-1.5">
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
        <div className="h-3 bg-gray-100 rounded w-4/6" />
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

  async function handleConfirmPublish(id: string) {
    const { error } = await supabase
      .from('content_queue')
      .update({
        status: 'publish_pending',
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (error) throw error

    setConfirmingItems((prev) => prev.filter((c) => c.id !== id))
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
      <div className="p-6">
        <PageHeader
          title="Content Approvals"
          description="Review and approve content before it publishes."
        />
        <div className="mt-6 bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
          Select a brand to view the approval queue.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      <PageHeader
        title="Content Approvals"
        description="Review and approve content before it publishes."
      />

      <div className="mt-6 space-y-8">
        {/* Publish confirmation section — shown when items are approved but not yet confirmed */}
        {confirmingItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Awaiting publish confirmation ({confirmingItems.length})
            </h2>
            {confirmingItems.map((item) => (
              <PublishConfirmCard
                key={item.id}
                item={item}
                onConfirm={() => handleConfirmPublish(item.id)}
                onCancel={() => handleCancelPublish(item.id)}
              />
            ))}
          </section>
        )}

        {/* Pending approval section */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pending approval
            </h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {loading ? '…' : pendingItems.length}
            </span>
          </div>

          {fetchError && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
              {fetchError}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : pendingItems.length === 0 ? (
            <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
              No content awaiting approval for {activeBrand.name}.
            </div>
          ) : (
            <div className="space-y-3">
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
        </section>
      </div>
    </div>
  )
}
