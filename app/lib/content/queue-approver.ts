// lib/content/queue-approver.ts
// CANONICAL update path for content_queue status transitions.
// All user-facing status changes MUST flow through this helper.
//
// Known second write path (backlog Item 14): the n8n publish workflow's 'Mark Published'
// node writes status='published' directly via PostgREST, bypassing this helper.
// Until Item 14 ships, two write paths exist in production.

import { createAdminClient } from '@/lib/supabase/admin'
import { createBlogArticle, updateBlogArticle } from '@/lib/shopify/publish-blog'
import { createShopifyPage, updateShopifyPage } from '@/lib/shopify/publish-page'
import { fireN8nPublishWebhook } from './n8n-webhook'
import type { BlogPublishInput } from '@/lib/shopify/publish-blog'
import type { PagePublishInput } from '@/lib/shopify/publish-page'

export class ShopifyPublishError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options)
    this.name = 'ShopifyPublishError'
  }
}

export type ApproveAction = 'draft' | 'go_live' | 'reject' | 'pull_back' | 'publish_pending'

// State machine — (from_status, action) → to_status
const TRANSITIONS: Record<string, Record<ApproveAction, string>> = {
  pending:         { draft: 'approved',  reject: 'rejected',  go_live: '',  pull_back: '',             publish_pending: '' },
  approved:        { draft: '',          reject: 'rejected',  go_live: 'published', pull_back: 'pending', publish_pending: 'publish_pending' },
  publish_pending: { draft: '',          reject: '',          go_live: '',  pull_back: 'pending',       publish_pending: '' },
  escalated:       { draft: '',          reject: '',          go_live: '',  pull_back: 'pending',       publish_pending: '' },
}

export async function transitionContentStatus(input: {
  content_id: string
  brand_id: string
  action: ApproveAction
  actor_email: string
}): Promise<{
  success: boolean
  status: string
  shopify_resource_id?: string
}> {
  const { content_id, brand_id, action, actor_email } = input
  const supabase = createAdminClient()
  const now = new Date().toISOString()

  // 1. Fetch current row
  const { data: current, error: fetchError } = await supabase
    .from('content_queue')
    .select('*')
    .eq('id', content_id)
    .eq('brand_id', brand_id)
    .single()

  if (fetchError || !current) {
    const err = new Error(`Content item not found: ${fetchError?.message ?? 'no row'}`) as Error & { code: number }
    err.code = 404
    throw err
  }

  // 2. Validate transition
  const fromStatus: string = current.status ?? ''
  const validTransitions = TRANSITIONS[fromStatus]
  const toStatus = validTransitions?.[action] ?? ''

  if (!toStatus) {
    const err = new Error(
      `Invalid transition: status='${fromStatus}' does not allow action='${action}'`
    ) as Error & { code: number; current_status: string }
    err.code = 409
    err.current_status = fromStatus
    throw err
  }

  // 3. Build column updates
  const updates: Record<string, unknown> = { status: toStatus, updated_at: now }

  if (action === 'draft') {
    updates.approved_by = actor_email
    updates.approved_at = now
  }
  if (action === 'go_live') {
    updates.published_at = now
  }
  if (action === 'pull_back') {
    updates.approved_by = null
    updates.approved_at = null
  }

  // 4. Direct Shopify publish runs BEFORE DB status update.
  //    On failure, status never transitions and the error surfaces to the caller.
  let shopify_resource_id: string | undefined
  const isBlogShopifyAction = current.content_type === 'blog' && (action === 'draft' || action === 'go_live')
  const isLandingPageShopifyAction = current.content_type === 'landing_page' && action === 'go_live'

  if (isBlogShopifyAction) {
    try {
      shopify_resource_id = await tryShopifyPublish(supabase, content_id, brand_id, current, action as 'draft' | 'go_live')
    } catch (err) {
      if (err instanceof ShopifyPublishError) {
        try {
          await supabase.from('audit_log').insert({
            brand_id,
            agent: 'content_studio',
            action: `content_${action}_failed`,
            tokens_in: 0,
            tokens_out: 0,
            status: 'failure',
            input_summary: `from=${fromStatus} action=${action} content_type=${current.content_type} actor=${actor_email}`.slice(0, 500),
            output_summary: '',
            error_message: (err as Error).message.slice(0, 500),
          })
        } catch (auditErr) {
          console.warn('[queue-approver] failure audit_log write failed (non-fatal):', auditErr)
        }
      }
      throw err
    }
  }

  if (isLandingPageShopifyAction) {
    try {
      shopify_resource_id = await tryShopifyPagePublish(supabase, content_id, brand_id, current)
    } catch (err) {
      if (err instanceof ShopifyPublishError) {
        try {
          await supabase.from('audit_log').insert({
            brand_id,
            agent: 'content_studio',
            action: `content_${action}_failed`,
            tokens_in: 0,
            tokens_out: 0,
            status: 'failure',
            input_summary: `from=${fromStatus} action=${action} content_type=${current.content_type} actor=${actor_email}`.slice(0, 500),
            output_summary: '',
            error_message: (err as Error).message.slice(0, 500),
          })
        } catch (auditErr) {
          console.warn('[queue-approver] failure audit_log write failed (non-fatal):', auditErr)
        }
      }
      throw err
    }
  }

  // 5. UPDATE — only reached if Shopify publish succeeded (or action doesn't require it)
  const { data: updated, error: updateError } = await supabase
    .from('content_queue')
    .update(updates)
    .eq('id', content_id)
    .eq('brand_id', brand_id)
    .select()
    .single()

  if (updateError) {
    const err = new Error(`Status update failed: ${updateError.message}`) as Error & { code: number }
    err.code = 500
    throw err
  }
  if (!updated) {
    const err = new Error('Status update matched 0 rows — possible race condition') as Error & { code: number; current_status: string }
    err.code = 409
    err.current_status = fromStatus
    throw err
  }

  // 6. publish_pending → n8n (email only; DotDigital is the only legitimate n8n target)
  if (action === 'publish_pending' && current.content_type === 'email') {
    await fireN8nPublishWebhook({ content_id, brand_id, platform: current.platform ?? null })
  }
  // TODO(Item 12): Per-brand × per-content-type platform routing
  // will replace this hardcoded 'email' guard. Currently restricted
  // to email because that's the only legitimate n8n use case
  // (DotDigital). Other content_types reaching publish_pending is
  // a state machine misuse, prevented at the dashboard layer.

  // 7. Audit log — non-throwing
  try {
    await supabase.from('audit_log').insert({
      brand_id,
      agent: 'content_studio',
      action: `content_${action}`,
      tokens_in: 0,
      tokens_out: 0,
      status: 'success',
      input_summary: `from=${fromStatus} to=${toStatus} actor=${actor_email}`.slice(0, 500),
      output_summary: `content_id=${content_id}${shopify_resource_id ? ` shopify_resource_id=${shopify_resource_id}` : ''}`.slice(0, 500),
    })
  } catch (auditErr) {
    console.warn('[queue-approver] audit_log write failed (non-fatal):', auditErr)
  }

  return { success: true, status: toStatus, shopify_resource_id }
}

// Direct Shopify publish. Throws ShopifyPublishError on any failure — no silent fallback.
async function tryShopifyPublish(
  supabase: ReturnType<typeof createAdminClient>,
  content_id: string,
  brand_id: string,
  queueRow: Record<string, unknown>,
  action: 'draft' | 'go_live',
): Promise<string> {
  try {
    const { data: conn } = await supabase
      .from('shopify_connections')
      .select('shop_domain, access_token, scopes')
      .eq('brand_id', brand_id)
      .neq('sync_status', 'disconnected')
      .neq('access_token', '')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conn) {
      throw new ShopifyPublishError('No active Shopify connection found for this brand')
    }

    const scopes = (conn.scopes ?? '').split(',').map((s: string) => s.trim())
    if (!scopes.includes('write_content')) {
      throw new ShopifyPublishError('Shopify connection is missing write_content scope — reconnect via Settings → Integrations')
    }

    const content = (queueRow.content ?? {}) as Record<string, unknown>
    const input: BlogPublishInput = {
      title: (content.title as string) ?? 'Untitled',
      body_html: (content.body_html as string) ?? '',
      summary_html: content.summary_html as string | undefined,
      author: (content.author as string | undefined) ?? 'Plasmaide',
      tags: content.tags as string[] | undefined,
      handle: content.handle as string | undefined,
      seo_title: (content.meta_title ?? content.seo_title) as string | undefined,
      seo_description: (content.meta_description ?? content.seo_description) as string | undefined,
      published: action === 'go_live',
      published_at: action === 'go_live' ? new Date().toISOString() : undefined,
      hero_image_url: (queueRow.hero_image_url as string | undefined) ?? undefined,
    }

    const existingArticleId = content.shopify_article_id as string | undefined
    let publishResult: { shopify_article_id: string; handle: string; url: string | null }

    if (existingArticleId && action === 'go_live') {
      publishResult = await updateBlogArticle(conn.shop_domain, conn.access_token, existingArticleId, input)
    } else {
      publishResult = await createBlogArticle(conn.shop_domain, conn.access_token, input)
    }

    // Write shopify IDs back to content field
    await supabase
      .from('content_queue')
      .update({
        content: {
          ...content,
          shopify_article_id: publishResult.shopify_article_id,
          shopify_url: publishResult.url,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', content_id)

    return publishResult.shopify_article_id
  } catch (err) {
    if (err instanceof ShopifyPublishError) throw err
    console.error('[queue-approver] Direct Shopify publish failed:', err)
    throw new ShopifyPublishError(
      err instanceof Error ? err.message : 'Shopify publish failed',
      { cause: err }
    )
  }
}

// Direct Shopify page publish. Throws ShopifyPublishError on any failure — no silent fallback.
async function tryShopifyPagePublish(
  supabase: ReturnType<typeof createAdminClient>,
  content_id: string,
  brand_id: string,
  queueRow: Record<string, unknown>,
): Promise<string> {
  try {
    const { data: conn } = await supabase
      .from('shopify_connections')
      .select('shop_domain, access_token, scopes')
      .eq('brand_id', brand_id)
      .neq('sync_status', 'disconnected')
      .neq('access_token', '')
      .order('connected_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!conn) {
      throw new ShopifyPublishError('No active Shopify connection found for this brand')
    }

    const scopes = (conn.scopes ?? '').split(',').map((s: string) => s.trim())
    if (!scopes.includes('write_content')) {
      throw new ShopifyPublishError('Shopify connection is missing write_content scope — reconnect via Settings → Integrations')
    }

    const content = (queueRow.content ?? {}) as Record<string, unknown>
    const input: PagePublishInput = {
      title: (content.title as string) ?? 'Untitled',
      body_html: (content.body_html as string) ?? '',
      handle: content.handle as string | undefined,
      meta_title: (content.meta_title ?? content.seo_title) as string | undefined,
      meta_description: (content.meta_description ?? content.seo_description) as string | undefined,
    }

    const existingPageId = content.shopify_page_id as string | undefined
    let publishResult: { shopify_page_id: string; handle: string; url: string | null }

    if (existingPageId) {
      publishResult = await updateShopifyPage(conn.shop_domain, conn.access_token, existingPageId, input)
    } else {
      publishResult = await createShopifyPage(conn.shop_domain, conn.access_token, input)
    }

    // Write shopify IDs back to content field
    await supabase
      .from('content_queue')
      .update({
        content: {
          ...content,
          shopify_page_id: publishResult.shopify_page_id,
          shopify_url: publishResult.url,
        },
        updated_at: new Date().toISOString(),
      })
      .eq('id', content_id)

    return publishResult.shopify_page_id
  } catch (err) {
    if (err instanceof ShopifyPublishError) throw err
    console.error('[queue-approver] Direct Shopify page publish failed:', err)
    throw new ShopifyPublishError(
      err instanceof Error ? err.message : 'Shopify page publish failed',
      { cause: err }
    )
  }
}
