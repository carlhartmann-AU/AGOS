'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useBrand } from '@/context/BrandContext'
import { useContentQueue } from '@/lib/useContentQueue'
import type { ContentQueueItem, ContentType, ComplianceViolation } from '@/types'

// ─── Utilities ───────────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function relativeTime(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function ComplianceBadge({ result }: { result: 'PASS' | 'FAIL' | 'ESCALATE' }) {
  const styles = {
    PASS: 'bg-green-50 text-green-700 border-green-200',
    FAIL: 'bg-red-50 text-red-700 border-red-200',
    ESCALATE: 'bg-amber-50 text-amber-700 border-amber-200',
  }
  const labels = { PASS: '✓ Compliant', FAIL: '✗ Violations', ESCALATE: '⚠ Escalated' }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-medium ${styles[result]}`}>
      {labels[result]}
    </span>
  )
}

function ViolationList({ violations }: { violations: ComplianceViolation[] }) {
  return (
    <div className="space-y-2 mt-2">
      {violations.map((v, i) => (
        <div
          key={i}
          className={`p-2.5 rounded text-xs space-y-1 ${v.severity === 'critical' ? 'bg-red-50' : 'bg-amber-50'}`}
        >
          <div className="flex items-center justify-between">
            <span className={`font-semibold capitalize ${v.severity === 'critical' ? 'text-red-700' : 'text-amber-700'}`}>
              {v.check.replace(/_/g, ' ')} · {v.severity}
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
      ))}
    </div>
  )
}

function HtmlPreview({ html }: { html: string }) {
  return (
    <iframe
      srcDoc={html}
      sandbox=""
      title="Content preview"
      className="w-full h-72 rounded border border-gray-200 bg-white"
    />
  )
}

function SeoSection({ title, description }: { title?: string; description?: string }) {
  if (!title && !description) return null
  return (
    <div className="space-y-2">
      {title && (
        <div>
          <span className="text-xs text-gray-400 block mb-0.5">SEO title</span>
          <p className="text-sm text-gray-800 font-medium truncate">{title}</p>
          <span className={`text-xs ${title.length > 60 ? 'text-amber-600' : 'text-gray-400'}`}>
            {title.length}/60 chars
          </span>
        </div>
      )}
      {description && (
        <div>
          <span className="text-xs text-gray-400 block mb-0.5">Meta description</span>
          <p className="text-sm text-gray-700 line-clamp-2">{description}</p>
          <span className={`text-xs ${description.length > 160 ? 'text-amber-600' : 'text-gray-400'}`}>
            {description.length}/160 chars
          </span>
        </div>
      )}
    </div>
  )
}

function BeforeAfterDiff({ before, after }: { before: string; after: string }) {
  const beforeText = stripHtml(before)
  const afterText = stripHtml(after)
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <span className="text-xs text-gray-400 block mb-1">Before</span>
        <div className="text-xs text-gray-600 bg-red-50 border border-red-100 rounded p-2.5 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {beforeText || <em className="text-gray-400">Empty</em>}
        </div>
      </div>
      <div>
        <span className="text-xs text-gray-400 block mb-1">After</span>
        <div className="text-xs text-gray-600 bg-green-50 border border-green-100 rounded p-2.5 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
          {afterText || <em className="text-gray-400">Empty</em>}
        </div>
      </div>
    </div>
  )
}

type Section = 'preview' | 'seo' | 'diff' | 'violations'

function ExpandSection({
  label,
  active,
  onToggle,
  disabled,
}: {
  label: string
  active: boolean
  onToggle: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`text-xs px-2.5 py-1 rounded border transition-colors ${
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'text-gray-500 border-gray-200 hover:border-gray-400 hover:text-gray-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {label}
    </button>
  )
}

// ─── Web Designer Card ────────────────────────────────────────────────────────

type CardProps = {
  item: ContentQueueItem
  stage: 'pending' | 'approved' | 'publish_pending'
  onApproveDraft: () => Promise<void>
  onGoLive: () => Promise<void>
  onReject: () => Promise<void>
  onPullBack?: () => Promise<void>
}

function WebDesignerCard({ item, stage, onApproveDraft, onGoLive, onReject, onPullBack }: CardProps) {
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [openSection, setOpenSection] = useState<Section | null>(null)

  const content = item.content as Record<string, unknown>
  const compliance = item.compliance_result
  const violations = compliance?.violations ?? []

  const bodyHtml = content.body_html as string | undefined
  const beforeHtml = content.before_html as string | undefined
  const seoTitle = content.seo_title as string | undefined
  const seoDescription = content.seo_description as string | undefined
  const changeSummary = content.change_summary as string | undefined
  const pageType = content.page_type as string | undefined
  const requiresDevReview = content.requires_dev_review as boolean | undefined

  function toggleSection(s: Section) {
    setOpenSection((prev) => (prev === s ? null : s))
  }

  async function act(fn: () => Promise<void>, key: string) {
    setLoading(key)
    setError(null)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action failed')
      setLoading(null)
    }
  }

  const PAGE_TYPE_LABEL: Record<string, string> = {
    landing_page: 'Landing Page',
    product_page: 'Product Page',
    blog_post: 'Blog Post',
    collection_page: 'Collection',
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Stage 2 header */}
      {stage === 'approved' && (
        <div className="px-5 py-2.5 bg-green-50 border-b border-green-200">
          <span className="text-green-700 text-xs font-medium">
            ✓ Draft created in Shopify — confirm go-live
          </span>
        </div>
      )}

      {/* Stage 3 header */}
      {stage === 'publish_pending' && (
        <div className="px-5 py-2.5 bg-blue-50 border-b border-blue-200">
          <span className="text-blue-700 text-xs font-medium">
            ⏳ Awaiting publish — approved by {item.approved_by ?? 'dashboard'}{item.approved_at ? `, ${relativeTime(item.approved_at)}` : ''}
          </span>
        </div>
      )}

      {/* Dev review warning */}
      {requiresDevReview && (
        <div className="px-5 py-2.5 bg-amber-50 border-b border-amber-200">
          <span className="text-amber-700 text-xs font-medium">
            ⚠ Requires developer review before publish (theme/Liquid change)
          </span>
        </div>
      )}

      {/* Header */}
      <div className="px-5 py-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
            {PAGE_TYPE_LABEL[pageType ?? ''] ?? item.content_type.replace('_', ' ')}
          </span>
          {item.platform && (
            <span className="text-xs font-medium bg-blue-50 text-blue-600 px-2 py-0.5 rounded">
              {item.platform}
            </span>
          )}
          {compliance && <ComplianceBadge result={compliance.result} />}
        </div>
        <span className="text-xs text-gray-400 whitespace-nowrap flex-shrink-0">
          {relativeTime(item.created_at)}
        </span>
      </div>

      {/* Title + summary */}
      <div className="px-5 pb-3">
        {content.title != null && (
          <p className="text-sm font-medium text-gray-900 mb-1">{String(content.title)}</p>
        )}
        {changeSummary && (
          <p className="text-sm text-gray-600 leading-relaxed">{changeSummary}</p>
        )}
      </div>

      {/* Section toggles */}
      <div className="px-5 pb-3 flex flex-wrap gap-1.5">
        <ExpandSection
          label="HTML Preview"
          active={openSection === 'preview'}
          onToggle={() => toggleSection('preview')}
          disabled={!bodyHtml}
        />
        <ExpandSection
          label="SEO Metadata"
          active={openSection === 'seo'}
          onToggle={() => toggleSection('seo')}
          disabled={!seoTitle && !seoDescription}
        />
        <ExpandSection
          label="Before / After"
          active={openSection === 'diff'}
          onToggle={() => toggleSection('diff')}
          disabled={!beforeHtml}
        />
        {violations.length > 0 && (
          <ExpandSection
            label={`${violations.length} violation${violations.length > 1 ? 's' : ''}`}
            active={openSection === 'violations'}
            onToggle={() => toggleSection('violations')}
          />
        )}
      </div>

      {/* Expanded section */}
      {openSection && (
        <div className="px-5 pb-4 border-t border-gray-100 pt-3">
          {openSection === 'preview' && bodyHtml && <HtmlPreview html={bodyHtml} />}
          {openSection === 'seo' && <SeoSection title={seoTitle} description={seoDescription} />}
          {openSection === 'diff' && beforeHtml && bodyHtml && (
            <BeforeAfterDiff before={beforeHtml} after={bodyHtml} />
          )}
          {openSection === 'violations' && <ViolationList violations={violations} />}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="px-5 pb-3">
          <p className="text-xs text-red-600">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="px-5 py-3 border-t border-gray-100 flex items-center justify-end gap-2">
        <button
          onClick={() => act(onReject, 'reject')}
          disabled={!!loading}
          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 rounded hover:bg-red-50 disabled:opacity-50 transition-colors"
        >
          {loading === 'reject' ? 'Rejecting…' : 'Reject'}
        </button>

        {stage === 'pending' && (
          <button
            onClick={() => act(onApproveDraft, 'draft')}
            disabled={!!loading}
            className="px-3 py-1.5 text-xs font-medium text-white bg-gray-900 rounded hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'draft' ? 'Creating draft…' : 'Approve → Shopify Draft'}
          </button>
        )}

        {stage === 'approved' && (
          <button
            onClick={() => act(onGoLive, 'go_live')}
            disabled={!!loading || requiresDevReview}
            className="px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded hover:bg-green-700 disabled:opacity-50 transition-colors"
          >
            {loading === 'go_live' ? 'Going live…' : 'Go Live →'}
          </button>
        )}

        {stage === 'publish_pending' && (
          <>
            <button
              onClick={() => act(onPullBack!, 'pull_back')}
              disabled={!!loading}
              className="px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              {loading === 'pull_back' ? 'Pulling back…' : '← Pull Back'}
            </button>
            <button
              onClick={() => act(onGoLive, 'go_live')}
              disabled={!!loading}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {loading === 'go_live' ? 'Publishing…' : 'Go Live →'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Action Log ───────────────────────────────────────────────────────────────

type LogEntry = ContentQueueItem & { _decidedAt: string }

const STATUS_STYLE: Record<string, string> = {
  published: 'text-green-700',
  publish_pending: 'text-blue-600',
  rejected: 'text-red-600',
  failed: 'text-red-700',
}

const STATUS_LABEL: Record<string, string> = {
  published: 'Published',
  publish_pending: 'Awaiting publish',
  rejected: 'Rejected',
  failed: 'Failed',
}

function ActionLog({ brandId }: { brandId: string }) {
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()
    supabase
      .from('content_queue')
      .select('*')
      .eq('brand_id', brandId)
      .in('status', ['published', 'publish_pending', 'rejected', 'failed'])
      .in('content_type', ['landing_page', 'blog'])
      .order('updated_at', { ascending: false })
      .limit(20)
      .then(({ data }) => {
        setEntries(
          (data ?? []).map((item) => ({ ...item, _decidedAt: item.updated_at }))
        )
        setLoading(false)
      })
  }, [brandId])

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-9 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    )
  }

  if (entries.length === 0) {
    return <p className="text-sm text-gray-400 py-4 text-center">No completed actions yet.</p>
  }

  return (
    <div className="divide-y divide-gray-100">
      {entries.map((entry) => {
        const content = entry.content as Record<string, unknown>
        const title = (content.title as string) || entry.content_type.replace('_', ' ')
        return (
          <div key={entry.id} className="flex items-center justify-between py-2.5 px-1 gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-xs text-gray-500 truncate">{title}</span>
              {entry.approved_by && (
                <span className="text-xs text-gray-400 flex-shrink-0">by {entry.approved_by}</span>
              )}
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-xs font-medium ${STATUS_STYLE[entry.status] ?? 'text-gray-500'}`}>
                {STATUS_LABEL[entry.status] ?? entry.status}
              </span>
              <span className="text-xs text-gray-400">{relativeTime(entry._decidedAt)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-5 animate-pulse space-y-3">
      <div className="flex gap-2">
        <div className="h-5 bg-gray-100 rounded w-24" />
        <div className="h-5 bg-gray-100 rounded w-16" />
      </div>
      <div className="h-4 bg-gray-100 rounded w-2/3" />
      <div className="h-3 bg-gray-100 rounded w-full" />
      <div className="h-3 bg-gray-100 rounded w-5/6" />
    </div>
  )
}

// ─── Generate Content Modal ───────────────────────────────────────────────────

function GenerateModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [topic, setTopic] = useState('')
  const [keywords, setKeywords] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const topicRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    topicRef.current?.focus()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!topic.trim()) return
    setLoading(true)
    setError(null)
    try {
      const target_keywords = keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean)
      const res = await fetch('/api/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: topic.trim(), target_keywords, content_type: 'blog' }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body.error ?? `Request failed: ${res.status}`)
      onSuccess()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Generate Content</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Topic <span className="text-red-500">*</span>
            </label>
            <input
              ref={topicRef}
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              disabled={loading}
              placeholder="e.g. Pine Bark Extract and endurance training"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Target keywords <span className="text-gray-400">(comma-separated)</span>
            </label>
            <input
              type="text"
              value={keywords}
              onChange={(e) => setKeywords(e.target.value)}
              disabled={loading}
              placeholder="e.g. pine bark extract, nitric oxide, endurance"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:opacity-50"
            />
          </div>
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !topic.trim()}
              className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              {loading ? 'Generating…' : 'Generate'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function WebDesignerDashboard() {
  const { activeBrand } = useBrand()
  const brandId = activeBrand?.brand_id ?? null
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  const WEB_TYPES: ContentType[] = ['landing_page', 'blog']

  const {
    items: pendingItems,
    loading: pendingLoading,
    error: pendingError,
    setItems: setPendingItems,
  } = useContentQueue(brandId, ['pending', 'escalated'], WEB_TYPES)

  const {
    items: approvedItems,
    loading: approvedLoading,
    setItems: setApprovedItems,
  } = useContentQueue(brandId, ['approved'], WEB_TYPES)

  const {
    items: publishPendingItems,
    loading: publishPendingLoading,
    setItems: setPublishPendingItems,
  } = useContentQueue(brandId, ['publish_pending'], WEB_TYPES)

  async function callApprove(queueId: string, action: 'draft' | 'go_live' | 'reject' | 'pull_back') {
    if (!brandId) throw new Error('No active brand')
    const res = await fetch('/api/web-designer/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: queueId, action, brand_id: brandId }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.error ?? `Request failed: ${res.status}`)
    }
  }

  async function handleApproveDraft(item: ContentQueueItem) {
    await callApprove(item.id, 'draft')
    setPendingItems((prev) => prev.filter((p) => p.id !== item.id))
    setApprovedItems((prev) => [{ ...item, status: 'approved' }, ...prev])
  }

  async function handleGoLive(item: ContentQueueItem) {
    await callApprove(item.id, 'go_live')
    setApprovedItems((prev) => prev.filter((p) => p.id !== item.id))
  }

  async function handleGoLiveFromPublishPending(item: ContentQueueItem) {
    await callApprove(item.id, 'go_live')
    setPublishPendingItems((prev) => prev.filter((p) => p.id !== item.id))
  }

  async function handlePullBack(item: ContentQueueItem) {
    await callApprove(item.id, 'pull_back')
    setPublishPendingItems((prev) => prev.filter((p) => p.id !== item.id))
    setPendingItems((prev) => [{ ...item, status: 'pending' }, ...prev])
  }

  async function handleRejectPending(item: ContentQueueItem) {
    await callApprove(item.id, 'reject')
    setPendingItems((prev) => prev.filter((p) => p.id !== item.id))
  }

  async function handleRejectApproved(item: ContentQueueItem) {
    await callApprove(item.id, 'reject')
    setApprovedItems((prev) => prev.filter((p) => p.id !== item.id))
  }

  if (!activeBrand) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
        Select a brand to view the web designer queue.
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {showGenerateModal && (
        <GenerateModal
          onClose={() => setShowGenerateModal(false)}
          onSuccess={() => {}}
        />
      )}

      {/* Stage 2 — Approved, awaiting go-live */}
      {(approvedLoading || approvedItems.length > 0) && (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Shopify Draft Created — Awaiting Go-Live
            {!approvedLoading && (
              <span className="ml-2 bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full normal-case font-medium">
                {approvedItems.length}
              </span>
            )}
          </h2>
          {approvedLoading ? (
            <SkeletonCard />
          ) : (
            approvedItems.map((item) => (
              <WebDesignerCard
                key={item.id}
                item={item}
                stage="approved"
                onApproveDraft={() => handleApproveDraft(item)}
                onGoLive={() => handleGoLive(item)}
                onReject={() => handleRejectApproved(item)}
              />
            ))
          )}
        </section>
      )}

      {/* Stage 3 — Awaiting publish */}
      {(publishPendingLoading || publishPendingItems.length > 0) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Awaiting Publish
            </h2>
            {!publishPendingLoading && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {publishPendingItems.length}
              </span>
            )}
          </div>
          {publishPendingLoading ? (
            <SkeletonCard />
          ) : (
            publishPendingItems.map((item) => (
              <WebDesignerCard
                key={item.id}
                item={item}
                stage="publish_pending"
                onApproveDraft={() => handleApproveDraft(item)}
                onGoLive={() => handleGoLiveFromPublishPending(item)}
                onReject={() => handleRejectApproved(item)}
                onPullBack={() => handlePullBack(item)}
              />
            ))
          )}
        </section>
      )}

      {/* Stage 1 — Pending review */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Pending Review
            </h2>
            <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
              {pendingLoading ? '…' : pendingItems.length}
            </span>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors"
          >
            + Generate Content
          </button>
        </div>

        {pendingError && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            {pendingError}
          </div>
        )}

        {pendingLoading ? (
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : pendingItems.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 px-5 py-10 text-center text-sm text-gray-400">
            No web designer changes awaiting review for {activeBrand.name}.
          </div>
        ) : (
          <div className="space-y-3">
            {pendingItems.map((item) => (
              <WebDesignerCard
                key={item.id}
                item={item}
                stage="pending"
                onApproveDraft={() => handleApproveDraft(item)}
                onGoLive={() => handleGoLive(item)}
                onReject={() => handleRejectPending(item)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Action log */}
      <section>
        <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Recent Actions
        </h2>
        <div className="bg-white rounded-lg border border-gray-200 px-5 py-1">
          <ActionLog brandId={activeBrand.brand_id} />
        </div>
      </section>
    </div>
  )
}
