'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { ContentQueueItem, ContentQueueStatus, ContentType } from '@/types'

type UseContentQueueResult = {
  items: ContentQueueItem[]
  loading: boolean
  error: string | null
  setItems: React.Dispatch<React.SetStateAction<ContentQueueItem[]>>
}

export function useContentQueue(
  brandId: string | null,
  statuses: ContentQueueStatus[],
  contentTypes?: ContentType[]
): UseContentQueueResult {
  const [items, setItems] = useState<ContentQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const statusKey = statuses.join(',')
  const typeKey = contentTypes?.join(',') ?? ''

  const supabaseRef = useRef(createClient())

  useEffect(() => {
    if (!brandId) {
      setItems([])
      setLoading(false)
      return
    }

    const supabase = supabaseRef.current
    setLoading(true)
    setError(null)

    let query = supabase
      .from('content_queue')
      .select('*')
      .eq('brand_id', brandId)
      .in('status', statuses)
      .order('created_at', { ascending: false })

    if (contentTypes && contentTypes.length > 0) {
      query = query.in('content_type', contentTypes)
    }

    query.then(({ data, error: fetchError }) => {
      if (fetchError) {
        setError(fetchError.message)
      } else {
        setItems(data ?? [])
      }
      setLoading(false)
    })

    const channelKey = `content_queue:${brandId}:${statusKey}:${typeKey}`
    const channel = supabase
      .channel(channelKey)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'content_queue', filter: `brand_id=eq.${brandId}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const item = payload.new as ContentQueueItem
            const statusMatch = statuses.includes(item.status)
            const typeMatch = !contentTypes || contentTypes.includes(item.content_type)
            if (statusMatch && typeMatch) {
              setItems((prev) => [item, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            const item = payload.new as ContentQueueItem
            const statusMatch = statuses.includes(item.status)
            const typeMatch = !contentTypes || contentTypes.includes(item.content_type)
            if (!statusMatch || !typeMatch) {
              setItems((prev) => prev.filter((p) => p.id !== item.id))
            } else {
              setItems((prev) => prev.map((p) => (p.id === item.id ? item : p)))
            }
          } else if (payload.eventType === 'DELETE') {
            setItems((prev) =>
              prev.filter((p) => p.id !== (payload.old as ContentQueueItem).id)
            )
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandId, statusKey, typeKey])

  return { items, loading, error, setItems }
}
