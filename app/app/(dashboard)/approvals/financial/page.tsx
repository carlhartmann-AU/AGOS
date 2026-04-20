'use client'

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import { PageHeader } from '@/components/PageHeader'
import { FinancialApprovalCard } from '@/components/FinancialApprovalCard'
import {
  DEFAULT_FY_CONFIG,
  getAllFiscalYears,
  getCurrentFiscalYear,
  getFiscalYearRange,
  getFiscalYearRangeLabel,
} from '@/lib/utils/fiscal-year'
import type { FYConfig, FinancialQueueItem } from '@/types'

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-5 bg-gray-100 rounded w-32" />
        <div className="h-5 bg-gray-100 rounded w-20" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-16" />
        <div className="h-3 bg-gray-100 rounded w-full" />
        <div className="h-3 bg-gray-100 rounded w-5/6" />
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-gray-100 rounded w-24" />
        <div className="h-3 bg-gray-100 rounded w-4/6" />
      </div>
    </div>
  )
}

export default function FinancialApprovalsPage() {
  const { activeBrand } = useBrand()
  const supabase = createClient()

  const [fyConfig, setFyConfig] = useState<FYConfig>(DEFAULT_FY_CONFIG)
  const [fyOptions, setFyOptions] = useState<string[]>([])
  const [selectedFY, setSelectedFY] = useState<string>('')

  const [items, setItems] = useState<FinancialQueueItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Load fy_config from brand_settings when brand changes
  useEffect(() => {
    if (!activeBrand) return
    supabase
      .from('brand_settings')
      .select('fy_config')
      .eq('brand_id', activeBrand.brand_id)
      .single()
      .then(({ data }) => {
        const cfg: FYConfig = data?.fy_config ?? DEFAULT_FY_CONFIG
        setFyConfig(cfg)
        const opts = getAllFiscalYears(cfg)
        setFyOptions(opts)
        setSelectedFY(getCurrentFiscalYear(cfg))
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.brand_id])

  // Re-derive options when fyConfig changes (e.g., after settings save)
  useEffect(() => {
    if (!fyConfig) return
    const opts = getAllFiscalYears(fyConfig)
    setFyOptions(opts)
    setSelectedFY((prev) => (opts.includes(prev) ? prev : opts[0]))
  }, [fyConfig])

  const fetchItems = useCallback(async (brandId: string, fy: string, cfg: FYConfig) => {
    if (!fy) return
    setLoading(true)
    setFetchError(null)

    const { start, end } = getFiscalYearRange(fy, cfg)
    // Include end of the final day
    const endOfDay = new Date(end)
    endOfDay.setHours(23, 59, 59, 999)

    const { data, error } = await supabase
      .from('financial_queue')
      .select('*')
      .eq('brand_id', brandId)
      .eq('status', 'pending')
      .gte('created_at', start.toISOString())
      .lte('created_at', endOfDay.toISOString())
      .order('created_at', { ascending: false })

    if (error) {
      setFetchError(error.message)
    } else {
      setItems(data ?? [])
    }
    setLoading(false)
  }, [supabase]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch items when brand, FY, or config changes
  useEffect(() => {
    if (!activeBrand || !selectedFY) return
    fetchItems(activeBrand.brand_id, selectedFY, fyConfig)
  }, [activeBrand?.brand_id, selectedFY, fyConfig, fetchItems]) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time subscription for the current brand (client-side FY filter)
  useEffect(() => {
    if (!activeBrand) return
    const brandId = activeBrand.brand_id

    const channel = supabase
      .channel(`financial_queue:${brandId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'financial_queue',
          filter: `brand_id=eq.${brandId}`,
        },
        (payload) => {
          if (!selectedFY || !fyConfig) return
          const { start, end } = getFiscalYearRange(selectedFY, fyConfig)
          const endOfDay = new Date(end)
          endOfDay.setHours(23, 59, 59, 999)

          function inFY(item: FinancialQueueItem) {
            const t = new Date(item.created_at)
            return t >= start && t <= endOfDay
          }

          if (payload.eventType === 'INSERT') {
            const item = payload.new as FinancialQueueItem
            if (item.status === 'pending' && inFY(item)) {
              setItems((prev) => [item, ...prev])
            }
          } else if (payload.eventType === 'UPDATE') {
            const item = payload.new as FinancialQueueItem
            if (item.status !== 'pending') {
              setItems((prev) => prev.filter((p) => p.id !== item.id))
            } else {
              setItems((prev) => prev.map((p) => (p.id === item.id ? item : p)))
            }
          } else if (payload.eventType === 'DELETE') {
            const old = payload.old as { id: string }
            setItems((prev) => prev.filter((p) => p.id !== old.id))
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeBrand?.brand_id, selectedFY, fyConfig])

  async function handleApprove(item: FinancialQueueItem) {
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { error } = await supabase
      .from('financial_queue')
      .update({
        status: 'approved',
        approved_by: user?.email ?? null,
        approved_at: new Date().toISOString(),
      })
      .eq('id', item.id)

    if (error) throw error
    setItems((prev) => prev.filter((p) => p.id !== item.id))
  }

  async function handleReject(id: string) {
    const { error } = await supabase
      .from('financial_queue')
      .update({ status: 'rejected' })
      .eq('id', id)

    if (error) throw error
    setItems((prev) => prev.filter((p) => p.id !== id))
  }

  function handleRequestDetail() {
    alert('Request Detail will re-invoke the CFO Agent for deeper analysis. Available in a future phase.')
  }

  const rangeLabel = selectedFY && fyConfig
    ? getFiscalYearRangeLabel(selectedFY, fyConfig)
    : ''

  if (!activeBrand) {
    return (
      <div className="p-6">
        <PageHeader
          title="Financial Approvals"
          description="Review and approve financial actions before execution."
        />
        <div className="mt-6 bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
          Select a brand to view the financial approval queue.
        </div>
      </div>
    )
  }

  return (
    <div className="p-6">
      {/* Header with FY selector */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <PageHeader
          title="Financial Approvals"
          description={
            selectedFY
              ? `${selectedFY} · ${rangeLabel}`
              : 'Review and approve financial actions before execution.'
          }
        />
        {fyOptions.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="text-xs text-gray-400 font-medium">Fiscal year</span>
            <select
              value={selectedFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="text-sm border border-gray-200 rounded-md px-2.5 py-1.5 bg-white text-gray-700
                         focus:outline-none focus:ring-2 focus:ring-gray-900 transition"
            >
              {fyOptions.map((fy) => (
                <option key={fy} value={fy}>{fy}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* High-stakes notice */}
      <div className="mt-4 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
        <span className="text-amber-500 text-sm mt-0.5 flex-shrink-0">⚠</span>
        <p className="text-xs text-amber-700 leading-relaxed">
          Actions approved here are executed against live systems — Xero, advertising platforms,
          or payment processors. Approvals cannot be undone automatically.
          Review all details carefully before approving.
        </p>
      </div>

      <div className="mt-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Pending approval
          </h2>
          <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
            {loading ? '…' : items.length}
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
        ) : items.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
            No financial actions awaiting approval for {activeBrand.name}
            {selectedFY ? ` in ${selectedFY}` : ''}.
          </div>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <FinancialApprovalCard
                key={item.id}
                item={item}
                onApprove={() => handleApprove(item)}
                onReject={() => handleReject(item.id)}
                onRequestDetail={handleRequestDetail}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
