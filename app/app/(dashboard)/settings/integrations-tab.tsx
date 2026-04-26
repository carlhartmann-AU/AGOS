'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import type { Brand } from '@/types'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegistryRow {
  slug: string
  name: string
  description: string | null
  category: string
  icon_code: string | null
  icon_color: string | null
  status: 'live' | 'coming_soon'
  roadmap_eta: string | null
  data_roles: string[]
  auth_type: string | null
}

interface ConnectionRow {
  integration_slug: string
  status: string
  config: Record<string, unknown>
  data_roles_active: string[]
  connected_at: string | null
}

interface IntegWithConn extends RegistryRow {
  connection: ConnectionRow | null
}

type ShopifyConn = {
  shop_domain: string
  shop_name: string | null
  sync_status: string
  sync_error: string | null
  connected_at: string
  last_sync_at: string | null
}

type XeroTenant = {
  xero_tenant_id: string
  xero_tenant_name: string
  connected_at: string
  last_sync: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  commerce_cms: 'Commerce & CMS',
  email_marketing: 'Email & Marketing Automation',
  analytics_attribution: 'Analytics & Attribution',
  customer_service: 'Customer Service',
  financial: 'Financial',
  ai_llm: 'AI / LLM Providers',
  social_publishing: 'Social & Publishing',
  reviews_ugc: 'Reviews & UGC',
}

const CATEGORY_ORDER = [
  'commerce_cms',
  'email_marketing',
  'analytics_attribution',
  'customer_service',
  'financial',
  'ai_llm',
  'social_publishing',
  'reviews_ugc',
]

// Live in registry but OAuth/API flow not yet built — show toast on click
const TOAST_SLUGS = new Set(['google_analytics_4', 'klaviyo', 'gorgias', 'openai', 'meta_social'])

// ─── Icon Avatar ──────────────────────────────────────────────────────────────

function IconAvatar({ code, color }: { code: string | null; color: string | null }) {
  const bg = color ?? '#6b7280'
  // Decide text colour: white on dark, dark on light
  const isLight = (() => {
    const c = (color ?? '#6b7280').replace('#', '')
    const r = parseInt(c.slice(0, 2), 16)
    const g = parseInt(c.slice(2, 4), 16)
    const b = parseInt(c.slice(4, 6), 16)
    return (r * 299 + g * 587 + b * 114) / 1000 > 155
  })()
  return (
    <div
      style={{ background: bg }}
      className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${isLight ? 'text-gray-900' : 'text-white'}`}
    >
      {code ?? '?'}
    </div>
  )
}

// ─── Status badge ─────────────────────────────────────────────────────────────

function StatusBadge({ connected, status, eta }: { connected: boolean; status: 'live' | 'coming_soon'; eta?: string | null }) {
  if (connected) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
        Connected
      </span>
    )
  }
  if (status === 'coming_soon') {
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
        {eta ?? 'Coming soon'}
      </span>
    )
  }
  return null
}

// ─── Management panels ────────────────────────────────────────────────────────

function ShopifyPanel({
  shopifyStatus,
  syncing,
  disconnecting,
  onSync,
  onDisconnect,
  successBanner,
  errorBanner,
  onDismissSuccess,
  onDismissError,
  brandId,
}: {
  shopifyStatus: { configured: boolean; connected: boolean; connection: ShopifyConn | null } | null
  syncing: boolean
  disconnecting: boolean
  onSync: () => void
  onDisconnect: () => void
  successBanner: boolean
  errorBanner: string | null
  onDismissSuccess: () => void
  onDismissError: () => void
  brandId: string
}) {
  const [ordersSyncing, setOrdersSyncing] = useState(false)
  const [ordersSyncMsg, setOrdersSyncMsg] = useState<string | null>(null)

  async function handleSyncOrders() {
    setOrdersSyncing(true)
    setOrdersSyncMsg(null)
    try {
      const res = await fetch('/api/integrations/shopify/sync-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId }),
      })
      const data = await res.json() as { ok?: boolean; orders_synced?: number; customers_synced?: number; error?: string }
      if (data.ok) {
        setOrdersSyncMsg(`✓ ${data.orders_synced ?? 0} orders, ${data.customers_synced ?? 0} customers synced`)
      } else {
        setOrdersSyncMsg(`Error: ${data.error ?? 'Sync failed'}`)
      }
    } catch {
      setOrdersSyncMsg('Sync request failed')
    } finally {
      setOrdersSyncing(false)
      setTimeout(() => setOrdersSyncMsg(null), 5000)
    }
  }
  if (!shopifyStatus) return <div className="mt-3 h-6 bg-gray-100 rounded animate-pulse" />
  if (!shopifyStatus.configured) {
    return (
      <p className="mt-3 text-xs text-gray-400">
        Add <code className="bg-gray-100 px-1 rounded">SHOPIFY_CLIENT_ID</code> and{' '}
        <code className="bg-gray-100 px-1 rounded">SHOPIFY_CLIENT_SECRET</code> to your Vercel environment variables.
      </p>
    )
  }
  const conn = shopifyStatus.connection
  if (!conn) {
    return (
      <div className="mt-3 space-y-2">
        {errorBanner && (
          <div className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <span>Connection failed: {errorBanner}</span>
            <button onClick={onDismissError} className="text-red-400 hover:text-red-600">✕</button>
          </div>
        )}
        <div className="px-3 py-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800">
          OAuth token missing or revoked. Use the <strong>Connect</strong> button to re-authorise.
        </div>
      </div>
    )
  }
  return (
    <div className="mt-3 space-y-2">
      {successBanner && (
        <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          <span>✓ Shopify connected successfully</span>
          <button onClick={onDismissSuccess} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}
      {errorBanner && (
        <div className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <span>Connection failed: {errorBanner}</span>
          <button onClick={onDismissError} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      <div className="flex flex-wrap items-start gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800">{conn.shop_name ?? conn.shop_domain}</div>
          <div className="text-xs text-gray-400 mt-0.5">
            {conn.shop_domain} · Connected {new Date(conn.connected_at).toLocaleDateString()}
            {conn.last_sync_at && ` · Last sync ${new Date(conn.last_sync_at).toLocaleDateString()}`}
            {conn.sync_status === 'error' && <span className="ml-1 text-red-500">· Sync error</span>}
          </div>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap flex-shrink-0">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing || conn.sync_status === 'syncing'}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {syncing || conn.sync_status === 'syncing' ? 'Syncing…' : 'Sync products'}
          </button>
          <button
            type="button"
            onClick={handleSyncOrders}
            disabled={ordersSyncing}
            className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {ordersSyncing ? 'Syncing…' : 'Sync orders'}
          </button>
          <button
            type="button"
            onClick={onDisconnect}
            disabled={disconnecting}
            className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      </div>
      {ordersSyncMsg && (
        <div className={`px-3 py-2 rounded text-xs ${ordersSyncMsg.startsWith('✓') ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
          {ordersSyncMsg}
        </div>
      )}
    </div>
  )
}

function XeroPanel({
  xeroStatus,
  disconnecting,
  onDisconnect,
  successBanner,
  errorBanner,
  onDismissSuccess,
  onDismissError,
}: {
  xeroStatus: { configured: boolean; connected: boolean; tenants: XeroTenant[] } | null
  disconnecting: boolean
  onDisconnect: (id: string) => void
  successBanner: boolean
  errorBanner: string | null
  onDismissSuccess: () => void
  onDismissError: () => void
}) {
  if (!xeroStatus) return <div className="mt-3 h-6 bg-gray-100 rounded animate-pulse" />
  if (!xeroStatus.configured) {
    return (
      <p className="mt-3 text-xs text-gray-400">
        Add <code className="bg-gray-100 px-1 rounded">XERO_CLIENT_ID</code> and{' '}
        <code className="bg-gray-100 px-1 rounded">XERO_CLIENT_SECRET</code> to your Vercel environment variables.
      </p>
    )
  }
  return (
    <div className="mt-3 space-y-2">
      {successBanner && (
        <div className="flex items-center justify-between px-3 py-2 bg-green-50 border border-green-200 rounded text-xs text-green-700">
          <span>✓ Xero connected successfully</span>
          <button onClick={onDismissSuccess} className="text-green-500 hover:text-green-700">✕</button>
        </div>
      )}
      {errorBanner && (
        <div className="flex items-center justify-between px-3 py-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
          <span>Connection failed: {errorBanner}</span>
          <button onClick={onDismissError} className="text-red-400 hover:text-red-600">✕</button>
        </div>
      )}
      {xeroStatus.tenants.map(t => (
        <div key={t.xero_tenant_id} className="flex items-center justify-between px-3 py-2 bg-gray-50 border border-gray-200 rounded">
          <div>
            <div className="text-sm font-medium text-gray-800">{t.xero_tenant_name}</div>
            <div className="text-xs text-gray-400 mt-0.5">
              Connected {new Date(t.connected_at).toLocaleDateString()}
              {t.last_sync && ` · Last sync ${new Date(t.last_sync).toLocaleDateString()}`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onDisconnect(t.xero_tenant_id)}
            disabled={disconnecting}
            className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
          >
            {disconnecting ? 'Disconnecting…' : 'Disconnect'}
          </button>
        </div>
      ))}
    </div>
  )
}

function TripleWhalePanel({
  apiKey,
  shopDomain,
  onApiKeyChange,
  onShopDomainChange,
  testState,
  onTest,
  onSave,
  saveState,
  isReadOnly,
}: {
  apiKey: string
  shopDomain: string
  onApiKeyChange: (v: string) => void
  onShopDomainChange: (v: string) => void
  testState: 'idle' | 'testing' | 'ok' | 'fail'
  onTest: () => void
  onSave: () => void
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  isReadOnly: boolean
}) {
  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1">API key</p>
        <input
          type="password"
          value={apiKey}
          onChange={e => onApiKeyChange(e.target.value)}
          placeholder="tw_…"
          disabled={isReadOnly}
          className="block w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
        />
      </div>
      <div>
        <p className="text-xs text-gray-500 mb-1">Shop domain</p>
        <input
          type="text"
          value={shopDomain}
          onChange={e => onShopDomainChange(e.target.value)}
          placeholder="plasmaide-uk.myshopify.com"
          disabled={isReadOnly}
          className="block w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
        />
      </div>
      {!isReadOnly && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onTest}
            disabled={testState === 'testing'}
            className="px-2.5 py-1.5 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            {testState === 'testing' ? 'Testing…' : 'Test connection'}
          </button>
          {testState === 'ok' && <span className="text-xs text-green-600">✓ Connected</span>}
          {testState === 'fail' && <span className="text-xs text-red-500">Failed — check API key</span>}
          <button
            type="button"
            onClick={onSave}
            disabled={saveState === 'saving'}
            className="px-2.5 py-1.5 text-xs rounded border border-gray-900 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save'}
          </button>
        </div>
      )}
    </div>
  )
}

function DotDigitalPanel({
  endpoint,
  onEndpointChange,
  onSave,
  saveState,
  isReadOnly,
}: {
  endpoint: string
  onEndpointChange: (v: string) => void
  onSave: () => void
  saveState: 'idle' | 'saving' | 'saved' | 'error'
  isReadOnly: boolean
}) {
  return (
    <div className="mt-3 space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1">API endpoint</p>
        <input
          type="text"
          value={endpoint}
          onChange={e => onEndpointChange(e.target.value)}
          placeholder="https://r3-api.dotdigital.com"
          disabled={isReadOnly}
          className="block w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
        />
        <p className="mt-1 text-xs text-gray-400">Credentials are stored in n8n — not here.</p>
      </div>
      {!isReadOnly && (
        <button
          type="button"
          onClick={onSave}
          disabled={saveState === 'saving'}
          className="px-2.5 py-1.5 text-xs rounded border border-gray-900 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save'}
        </button>
      )}
    </div>
  )
}

// ─── Integration Card ─────────────────────────────────────────────────────────

function IntegCard({
  integ,
  brandId,
  isReadOnly,
  isPrimary,
  isManaging,
  onToggleManage,
  onToast,
  // Shopify
  shopifyStatus,
  shopifySyncing,
  shopifyDisconnecting,
  onShopifySync,
  onShopifyDisconnect,
  shopifySuccessBanner,
  shopifyErrorBanner,
  onDismissShopifySuccess,
  onDismissShopifyError,
  // Xero
  xeroStatus,
  xeroDisconnecting,
  onXeroDisconnect,
  xeroSuccessBanner,
  xeroErrorBanner,
  onDismissXeroSuccess,
  onDismissXeroError,
  // Triple Whale
  twApiKey,
  twShopDomain,
  onTwApiKeyChange,
  onTwShopDomainChange,
  twTestState,
  onTwTest,
  onTwSave,
  twSaveState,
  // DotDigital
  ddEndpoint,
  onDdEndpointChange,
  onDdSave,
  ddSaveState,
}: {
  integ: IntegWithConn
  brandId: string
  isReadOnly: boolean
  isPrimary: boolean
  isManaging: boolean
  onToggleManage: () => void
  onToast: (msg: string) => void
  shopifyStatus: { configured: boolean; connected: boolean; connection: ShopifyConn | null } | null
  shopifySyncing: boolean
  shopifyDisconnecting: boolean
  onShopifySync: () => void
  onShopifyDisconnect: () => void
  shopifySuccessBanner: boolean
  shopifyErrorBanner: string | null
  onDismissShopifySuccess: () => void
  onDismissShopifyError: () => void
  xeroStatus: { configured: boolean; connected: boolean; tenants: XeroTenant[] } | null
  xeroDisconnecting: boolean
  onXeroDisconnect: (id: string) => void
  xeroSuccessBanner: boolean
  xeroErrorBanner: string | null
  onDismissXeroSuccess: () => void
  onDismissXeroError: () => void
  twApiKey: string
  twShopDomain: string
  onTwApiKeyChange: (v: string) => void
  onTwShopDomainChange: (v: string) => void
  twTestState: 'idle' | 'testing' | 'ok' | 'fail'
  onTwTest: () => void
  onTwSave: () => void
  twSaveState: 'idle' | 'saving' | 'saved' | 'error'
  ddEndpoint: string
  onDdEndpointChange: (v: string) => void
  onDdSave: () => void
  ddSaveState: 'idle' | 'saving' | 'saved' | 'error'
}) {
  // For Shopify, derive connection state from the status route (checks actual token)
  // rather than brand_integrations alone. Falls back to registry while status loads.
  const isConnected = (integ.slug === 'shopify' && shopifyStatus !== null)
    ? shopifyStatus.connected
    : integ.connection?.status === 'connected'
  const isLive = integ.status === 'live'
  const isNative = integ.auth_type === 'native'
  const isToastSlug = TOAST_SLUGS.has(integ.slug)

  function handleConnect() {
    if (isToastSlug) {
      onToast('Integration coming soon — we\'re actively building this connection.')
      return
    }
    if (integ.slug === 'shopify') {
      window.location.href = `/api/integrations/shopify/connect?brand_id=${brandId}`
    } else if (integ.slug === 'xero') {
      window.location.href = `/api/xero/connect?brand_id=${brandId}`
    } else if (integ.slug === 'triple_whale') {
      onToggleManage()
    } else if (integ.slug === 'dotdigital') {
      onToggleManage()
    } else {
      onToast('Integration coming soon — we\'re actively building this connection.')
    }
  }

  const cardBorder = isConnected
    ? 'border-green-200 bg-green-50/20'
    : 'border-gray-200 bg-white'

  return (
    <div className={`border rounded-lg p-4 transition-colors ${cardBorder}`}>
      <div className="flex items-start gap-3">
        <IconAvatar code={integ.icon_code} color={integ.icon_color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-gray-900">{integ.name}</span>
            <StatusBadge connected={isConnected} status={integ.status} eta={integ.roadmap_eta} />
          </div>
          {integ.description && (
            <p className="text-xs text-gray-400 mt-1 leading-relaxed">{integ.description}</p>
          )}
          {isPrimary && isConnected && (
            <span className="mt-1.5 inline-flex items-center gap-1 text-xs text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              Primary data source
            </span>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          {isConnected && !isNative && (
            <button
              type="button"
              onClick={onToggleManage}
              className="px-2.5 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
            >
              {isManaging ? 'Close' : 'Manage'}
            </button>
          )}
          {isConnected && isNative && (
            <span className="text-xs text-gray-400 italic">Built-in provider</span>
          )}
          {!isConnected && isLive && !isNative && (
            <button
              type="button"
              onClick={handleConnect}
              className="px-2.5 py-1 text-xs rounded border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
            >
              Connect
            </button>
          )}
        </div>
        {/* Shopify OAuth error — shown below Connect button when not connected */}
        {integ.slug === 'shopify' && !isConnected && shopifyErrorBanner && (
          <div className="flex items-center justify-between px-2.5 py-1.5 bg-red-50 border border-red-200 rounded text-xs text-red-700">
            <span>Connection failed: {shopifyErrorBanner}</span>
            <button type="button" onClick={onDismissShopifyError} className="ml-2 text-red-400 hover:text-red-600 shrink-0">✕</button>
          </div>
        )}
      </div>

      {/* Management panels — Shopify only renders when actually connected (has valid token) */}
      {isManaging && (integ.slug !== 'shopify' || isConnected) && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          {integ.slug === 'shopify' && (
            <ShopifyPanel
              shopifyStatus={shopifyStatus}
              syncing={shopifySyncing}
              disconnecting={shopifyDisconnecting}
              onSync={onShopifySync}
              onDisconnect={onShopifyDisconnect}
              successBanner={shopifySuccessBanner}
              errorBanner={shopifyErrorBanner}
              onDismissSuccess={onDismissShopifySuccess}
              onDismissError={onDismissShopifyError}
              brandId={brandId}
            />
          )}
          {integ.slug === 'xero' && (
            <XeroPanel
              xeroStatus={xeroStatus}
              disconnecting={xeroDisconnecting}
              onDisconnect={onXeroDisconnect}
              successBanner={xeroSuccessBanner}
              errorBanner={xeroErrorBanner}
              onDismissSuccess={onDismissXeroSuccess}
              onDismissError={onDismissXeroError}
            />
          )}
          {integ.slug === 'triple_whale' && (
            <TripleWhalePanel
              apiKey={twApiKey}
              shopDomain={twShopDomain}
              onApiKeyChange={onTwApiKeyChange}
              onShopDomainChange={onTwShopDomainChange}
              testState={twTestState}
              onTest={onTwTest}
              onSave={onTwSave}
              saveState={twSaveState}
              isReadOnly={isReadOnly}
            />
          )}
          {integ.slug === 'dotdigital' && (
            <DotDigitalPanel
              endpoint={ddEndpoint}
              onEndpointChange={onDdEndpointChange}
              onSave={onDdSave}
              saveState={ddSaveState}
              isReadOnly={isReadOnly}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000)
    return () => clearTimeout(t)
  }, [onDismiss])

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-4 py-3 bg-gray-900 text-white text-sm rounded-lg shadow-xl max-w-sm">
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} className="text-gray-400 hover:text-white">✕</button>
    </div>
  )
}

// ─── Telegram Section ─────────────────────────────────────────────────────────

type TelegramSubscriber = {
  id: string
  telegram_chat_id: number
  telegram_username: string | null
  user_role: string
  alerts_enabled: boolean
  daily_digest: boolean
}

function TelegramSection({
  brandId,
  isReadOnly,
}: {
  brandId: string
  isReadOnly: boolean
}) {
  const [status, setStatus] = useState<{ configured: boolean; subscribers: TelegramSubscriber[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [newChatId, setNewChatId] = useState('')
  const [newUsername, setNewUsername] = useState('')
  const [addState, setAddState] = useState<'idle' | 'saving' | 'ok' | 'fail'>('idle')
  const [testState, setTestState] = useState<'idle' | 'sending' | 'ok' | 'fail'>('idle')

  useEffect(() => {
    setLoading(true)
    fetch(`/api/telegram/send?brand_id=${brandId}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStatus(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [brandId])

  async function handleAdd() {
    if (!newChatId.trim()) return
    setAddState('saving')
    try {
      const res = await fetch('/api/telegram/subscribers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, telegram_chat_id: parseInt(newChatId), telegram_username: newUsername.trim() || null }),
      })
      if (res.ok) {
        setAddState('ok')
        setNewChatId('')
        setNewUsername('')
        const r = await fetch(`/api/telegram/send?brand_id=${brandId}`)
        if (r.ok) setStatus(await r.json())
      } else {
        setAddState('fail')
      }
    } catch { setAddState('fail') }
  }

  async function handleRemove(id: string) {
    await fetch('/api/telegram/subscribers', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setStatus(s => s ? { ...s, subscribers: s.subscribers.filter(x => x.id !== id) } : s)
  }

  async function handleToggle(id: string, field: 'alerts_enabled' | 'daily_digest', val: boolean) {
    await fetch('/api/telegram/subscribers', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, [field]: val }),
    })
    setStatus(s => s ? { ...s, subscribers: s.subscribers.map(x => x.id === id ? { ...x, [field]: val } : x) } : s)
  }

  async function handleTest(chatId: number) {
    setTestState('sending')
    try {
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, chat_id: chatId, message: '✅ AGOS Telegram connection test — you\'re all set!' }),
      })
      setTestState(res.ok ? 'ok' : 'fail')
    } catch { setTestState('fail') }
    setTimeout(() => setTestState('idle'), 3000)
  }

  if (loading) return <div className="h-16 bg-gray-100 rounded animate-pulse" />
  if (!status?.configured) {
    return (
      <p className="text-xs text-gray-400">
        Add <code className="bg-gray-100 px-1 rounded">TELEGRAM_BOT_TOKEN</code> and{' '}
        <code className="bg-gray-100 px-1 rounded">TELEGRAM_WEBHOOK_SECRET</code> to your Vercel environment variables.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      {status.subscribers.length === 0 ? (
        <p className="text-xs text-gray-400">Bot active — add your Telegram chat ID below.</p>
      ) : (
        status.subscribers.map(sub => (
          <div key={sub.id} className="border border-gray-200 rounded-md overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50">
              <div>
                <div className="text-sm font-medium text-gray-800">
                  {sub.telegram_username ? `@${sub.telegram_username}` : `Chat ${sub.telegram_chat_id}`}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">ID: {sub.telegram_chat_id} · {sub.user_role}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleTest(sub.telegram_chat_id)}
                  disabled={testState === 'sending'}
                  className="px-2 py-1 text-xs rounded border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                >
                  {testState === 'sending' ? 'Sending…' : testState === 'ok' ? '✓ Sent' : testState === 'fail' ? 'Failed' : 'Test'}
                </button>
                <button
                  type="button"
                  onClick={() => handleRemove(sub.id)}
                  className="px-2 py-1 text-xs rounded border border-red-200 text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            </div>
            <div className="px-3 py-2 flex gap-6">
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={sub.alerts_enabled} onChange={e => handleToggle(sub.id, 'alerts_enabled', e.target.checked)} className="rounded" />
                Alerts
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                <input type="checkbox" checked={sub.daily_digest} onChange={e => handleToggle(sub.id, 'daily_digest', e.target.checked)} className="rounded" />
                Daily digest
              </label>
            </div>
          </div>
        ))
      )}

      {!isReadOnly && (
        <div className="flex gap-2 items-end flex-wrap">
          <div>
            <p className="text-xs text-gray-500 mb-1">Chat ID</p>
            <input
              type="number"
              value={newChatId}
              onChange={e => setNewChatId(e.target.value)}
              placeholder="123456789"
              className="block w-32 rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Username (optional)</p>
            <input
              type="text"
              value={newUsername}
              onChange={e => setNewUsername(e.target.value)}
              placeholder="yourusername"
              className="block w-36 rounded border border-gray-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
            />
          </div>
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newChatId.trim() || addState === 'saving'}
            className="px-3 py-1.5 text-sm rounded border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {addState === 'saving' ? 'Adding…' : addState === 'ok' ? '✓ Added' : 'Add'}
          </button>
        </div>
      )}
      <p className="text-xs text-gray-400">
        Get your chat ID by messaging <code className="bg-gray-100 px-1 rounded">@userinfobot</code> on Telegram.
      </p>
    </div>
  )
}

// ─── n8n Section ──────────────────────────────────────────────────────────────

function N8nSection({
  brandId,
  initialWebhookBase,
  isReadOnly,
}: {
  brandId: string
  initialWebhookBase: string
  isReadOnly: boolean
}) {
  const supabase = createClient()
  const [webhookBase, setWebhookBase] = useState(initialWebhookBase)
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  async function handleSave() {
    setSaveState('saving')
    try {
      await supabase
        .from('brand_settings')
        .upsert({ brand_id: brandId, integrations: { n8n_webhook_base: webhookBase } }, { onConflict: 'brand_id' })
      setSaveState('saved')
      setTimeout(() => setSaveState('idle'), 2000)
    } catch {
      setSaveState('error')
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-gray-500 mb-1">Webhook base URL</p>
        <input
          type="text"
          value={webhookBase}
          onChange={e => setWebhookBase(e.target.value)}
          placeholder="https://plasmaide.app.n8n.cloud/webhook/"
          disabled={isReadOnly}
          className="block w-full rounded border border-gray-200 px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 disabled:bg-gray-50"
        />
        <p className="mt-1 text-xs text-gray-400">Base URL for all n8n webhook callbacks. Credentials are stored in n8n — not here.</p>
      </div>
      {!isReadOnly && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saveState === 'saving'}
          className="px-2.5 py-1.5 text-xs rounded border border-gray-900 bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? '✓ Saved' : 'Save'}
        </button>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function IntegrationsTabContent({
  activeBrand,
  isReadOnly,
}: {
  activeBrand: Brand
  isReadOnly: boolean
}) {
  const supabase = createClient()
  const searchParams = useSearchParams()
  const brandId = activeBrand.brand_id

  // Registry + connections
  const [grouped, setGrouped] = useState<Record<string, IntegWithConn[]>>({})
  const [registryLoading, setRegistryLoading] = useState(true)

  // Manage panel state
  const [manageSlug, setManageSlug] = useState<string | null>(null)

  // Toast
  const [toast, setToast] = useState<string | null>(null)

  // Shopify
  const [shopifyStatus, setShopifyStatus] = useState<{ configured: boolean; connected: boolean; connection: ShopifyConn | null } | null>(null)
  const [shopifySyncing, setShopifySyncing] = useState(false)
  const [shopifyDisconnecting, setShopifyDisconnecting] = useState(false)
  const [shopifySuccessBanner, setShopifySuccessBanner] = useState(false)
  const [shopifyErrorBanner, setShopifyErrorBanner] = useState<string | null>(null)

  // Xero
  const [xeroStatus, setXeroStatus] = useState<{ configured: boolean; connected: boolean; tenants: XeroTenant[] } | null>(null)
  const [xeroDisconnecting, setXeroDisconnecting] = useState(false)
  const [xeroSuccessBanner, setXeroSuccessBanner] = useState(false)
  const [xeroErrorBanner, setXeroErrorBanner] = useState<string | null>(null)

  // Triple Whale
  const [twApiKey, setTwApiKey] = useState('')
  const [twShopDomain, setTwShopDomain] = useState('')
  const [twTestState, setTwTestState] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [twSaveState, setTwSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // DotDigital
  const [ddEndpoint, setDdEndpoint] = useState('')
  const [ddSaveState, setDdSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

  // n8n webhook base
  const [n8nWebhookBase, setN8nWebhookBase] = useState('')

  // Registry fetch — extracted so disconnect/connect can call it without a page reload
  const fetchRegistry = useCallback(async (showLoading = true) => {
    if (showLoading) setRegistryLoading(true)
    try {
      const r = await fetch(`/api/integrations/registry?brand_id=${brandId}`, { cache: 'no-store' })
      const data = r.ok ? await r.json() as { registry: RegistryRow[]; connections: ConnectionRow[] } : { registry: [], connections: [] }
      const connMap = new Map<string, ConnectionRow>(
        data.connections.map((c) => [c.integration_slug, c])
      )
      const g: Record<string, IntegWithConn[]> = {}
      for (const reg of data.registry) {
        const conn = connMap.get(reg.slug) ?? null
        g[reg.category] ??= []
        g[reg.category].push({ ...reg, connection: conn })
      }
      setGrouped(g)
    } catch { /* ignore */ } finally {
      if (showLoading) setRegistryLoading(false)
    }
  }, [brandId])

  useEffect(() => { fetchRegistry() }, [fetchRegistry])

  // Fetch Shopify status
  const fetchShopifyStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/integrations/shopify/status?brand_id=${brandId}`, { cache: 'no-store' })
      if (res.ok) setShopifyStatus(await res.json())
    } catch { /* ignore */ }
  }, [brandId])

  // Fetch Xero status
  const fetchXeroStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/xero/status?brand_id=${brandId}`)
      if (res.ok) setXeroStatus(await res.json())
    } catch { /* ignore */ }
  }, [brandId])

  // Fetch brand settings for TW + DD config
  useEffect(() => {
    supabase
      .from('brand_settings')
      .select('integrations')
      .eq('brand_id', brandId)
      .single()
      .then(({ data }) => {
        if (!data) return
        const integ = (data.integrations ?? {}) as Record<string, Record<string, string | null> | string | null>
        const tw = integ.triple_whale as Record<string, string | null> | undefined
        const dd = integ.dotdigital as Record<string, string | null> | undefined
        setTwShopDomain((tw?.shop_domain as string | null) ?? '')
        setTwTestState(tw?.api_key ? 'ok' : 'idle')
        setDdEndpoint((dd?.endpoint as string | null) ?? '')
        setN8nWebhookBase((integ.n8n_webhook_base as string | null) ?? '')
      }, () => { /* ignore */ })
  }, [brandId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Handle OAuth return params
  useEffect(() => {
    const shopifyParam = searchParams.get('shopify')
    const xeroParam = searchParams.get('xero')
    const tab = searchParams.get('tab')

    if (shopifyParam === 'connected') { setShopifySuccessBanner(true); setManageSlug('shopify') }
    // Error: store banner but don't open manage panel — user needs to see the Connect button to retry
    if (shopifyParam === 'error') { setShopifyErrorBanner(searchParams.get('reason') ?? 'Unknown error') }
    if (xeroParam === 'connected') { setXeroSuccessBanner(true); setManageSlug('xero') }
    if (xeroParam === 'error') { setXeroErrorBanner(searchParams.get('reason') ?? 'Unknown error'); setManageSlug('xero') }
    if (tab === 'integrations') { /* already on this tab */ }

    fetchShopifyStatus()
    fetchXeroStatus()
  }, [brandId]) // eslint-disable-line react-hooks/exhaustive-deps

  // If Shopify panel is open but the token goes offline, close it so Connect button is unobstructed
  useEffect(() => {
    if (manageSlug === 'shopify' && shopifyStatus !== null && !shopifyStatus.connected) {
      setManageSlug(null)
    }
  }, [manageSlug, shopifyStatus])

  // Shopify handlers
  async function handleShopifyDisconnect() {
    if (!shopifyStatus?.connection) return
    if (!confirm('Disconnect Shopify? Product sync will stop, but existing synced data is preserved.')) return
    setShopifyDisconnecting(true)
    try {
      await fetch('/api/integrations/shopify/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, shop_domain: shopifyStatus.connection.shop_domain }),
      })
      // Refresh both: shopify panel details + registry card state (flips isConnected → shows Connect button)
      await Promise.all([fetchShopifyStatus(), fetchRegistry(false)])
      setManageSlug(null)
    } finally { setShopifyDisconnecting(false) }
  }

  async function handleShopifySync() {
    setShopifySyncing(true)
    try {
      await fetch('/api/integrations/shopify/sync-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId }),
      })
      await fetchShopifyStatus()
    } catch { /* ignore */ } finally { setShopifySyncing(false) }
  }

  // Xero handlers
  async function handleXeroDisconnect(tenantId: string) {
    if (!confirm('Disconnect this Xero organisation?')) return
    setXeroDisconnecting(true)
    try {
      await fetch('/api/xero/disconnect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, xero_tenant_id: tenantId }),
      })
      await fetchXeroStatus()
    } finally { setXeroDisconnecting(false) }
  }

  // Triple Whale handlers
  async function handleTwTest() {
    setTwTestState('testing')
    try {
      const res = await fetch('/api/integrations/triple-whale/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brand_id: brandId, api_key: twApiKey.trim() || undefined }),
      })
      setTwTestState(res.ok ? 'ok' : 'fail')
    } catch { setTwTestState('fail') }
  }

  async function handleTwSave() {
    setTwSaveState('saving')
    try {
      const { data: existing } = await supabase
        .from('brand_settings')
        .select('integrations')
        .eq('brand_id', brandId)
        .single()
      const existingInteg = ((existing?.integrations ?? {}) as Record<string, unknown>)
      const existingTw = (existingInteg.triple_whale ?? {}) as Record<string, string | null>
      const updated = {
        ...existingInteg,
        triple_whale: {
          ...existingTw,
          api_key: twApiKey.trim() || existingTw.api_key || null,
          shop_domain: twShopDomain.trim() || existingTw.shop_domain || 'plasmaide-uk.myshopify.com',
        },
      }
      await supabase
        .from('brand_settings')
        .upsert({ brand_id: brandId, integrations: updated }, { onConflict: 'brand_id' })
      setTwApiKey('')
      setTwSaveState('saved')
      setTimeout(() => setTwSaveState('idle'), 2000)
    } catch { setTwSaveState('error') }
  }

  // DotDigital handlers
  async function handleDdSave() {
    setDdSaveState('saving')
    try {
      const { data: existing } = await supabase
        .from('brand_settings')
        .select('integrations')
        .eq('brand_id', brandId)
        .single()
      const existingInteg = ((existing?.integrations ?? {}) as Record<string, unknown>)
      const updated = {
        ...existingInteg,
        dotdigital: { ...(existingInteg.dotdigital as Record<string, unknown> ?? {}), endpoint: ddEndpoint.trim(), connected: true },
      }
      await supabase
        .from('brand_settings')
        .upsert({ brand_id: brandId, integrations: updated }, { onConflict: 'brand_id' })
      setDdSaveState('saved')
      setTimeout(() => setDdSaveState('idle'), 2000)
    } catch { setDdSaveState('error') }
  }

  // Determine primary data source per category
  const primarySlugs = new Set<string>()
  for (const integrationsInCat of Object.values(grouped)) {
    const connected = integrationsInCat.filter(i => i.connection?.status === 'connected')
    if (connected.length === 1) primarySlugs.add(connected[0].slug)
  }

  if (registryLoading) {
    return (
      <div className="space-y-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-lg border border-gray-200 p-5 space-y-3 animate-pulse">
            <div className="h-4 bg-gray-100 rounded w-40" />
            <div className="grid grid-cols-2 gap-3">
              {[1, 2, 3].map(j => <div key={j} className="h-24 bg-gray-100 rounded-lg" />)}
            </div>
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Category sections */}
      {CATEGORY_ORDER.map(cat => {
        const integrationsInCat = grouped[cat]
        if (!integrationsInCat?.length) return null
        return (
          <div key={cat} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-100">
              <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                {CATEGORY_LABELS[cat]}
              </h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {integrationsInCat.map(integ => (
                  <IntegCard
                    key={integ.slug}
                    integ={integ}
                    brandId={brandId}
                    isReadOnly={isReadOnly}
                    isPrimary={primarySlugs.has(integ.slug)}
                    isManaging={manageSlug === integ.slug}
                    onToggleManage={() => setManageSlug(s => s === integ.slug ? null : integ.slug)}
                    onToast={setToast}
                    shopifyStatus={shopifyStatus}
                    shopifySyncing={shopifySyncing}
                    shopifyDisconnecting={shopifyDisconnecting}
                    onShopifySync={handleShopifySync}
                    onShopifyDisconnect={handleShopifyDisconnect}
                    shopifySuccessBanner={shopifySuccessBanner}
                    shopifyErrorBanner={shopifyErrorBanner}
                    onDismissShopifySuccess={() => setShopifySuccessBanner(false)}
                    onDismissShopifyError={() => setShopifyErrorBanner(null)}
                    xeroStatus={xeroStatus}
                    xeroDisconnecting={xeroDisconnecting}
                    onXeroDisconnect={handleXeroDisconnect}
                    xeroSuccessBanner={xeroSuccessBanner}
                    xeroErrorBanner={xeroErrorBanner}
                    onDismissXeroSuccess={() => setXeroSuccessBanner(false)}
                    onDismissXeroError={() => setXeroErrorBanner(null)}
                    twApiKey={twApiKey}
                    twShopDomain={twShopDomain}
                    onTwApiKeyChange={v => { setTwApiKey(v); setTwTestState('idle') }}
                    onTwShopDomainChange={setTwShopDomain}
                    twTestState={twTestState}
                    onTwTest={handleTwTest}
                    onTwSave={handleTwSave}
                    twSaveState={twSaveState}
                    ddEndpoint={ddEndpoint}
                    onDdEndpointChange={setDdEndpoint}
                    onDdSave={handleDdSave}
                    ddSaveState={ddSaveState}
                  />
                ))}
              </div>
            </div>
          </div>
        )
      })}

      {/* Platform config: n8n */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Orchestration</h3>
          <p className="text-xs text-gray-400 mt-0.5">n8n handles scheduling, retries, and platform API routing.</p>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0" style={{ background: '#EA4B71' }}>
              n8
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">n8n</span>
                <span className="px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                  <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 mr-1" />Connected
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-1">Workflow automation · plasmaide.app.n8n.cloud</p>
              <div className="mt-3">
                <N8nSection brandId={brandId} initialWebhookBase={n8nWebhookBase} isReadOnly={isReadOnly} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Telegram */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Notifications</h3>
          <p className="text-xs text-gray-400 mt-0.5">COO alerts and daily digest delivery channels.</p>
        </div>
        <div className="px-5 py-5">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white flex-shrink-0" style={{ background: '#229ED9' }}>
              Tg
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-gray-900 mb-3">Telegram Bot</p>
              <TelegramSection brandId={brandId} isReadOnly={isReadOnly} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
