// POST /api/content/publish-shopify
// Publishes a content_queue blog article directly to Shopify via GraphQL.
// Requires write_content scope — returns 403 with scope_error:true if missing.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createBlogArticle, updateBlogArticle } from '@/lib/shopify/publish-blog'
import type { BlogPublishInput } from '@/lib/shopify/publish-blog'

export const dynamic = 'force-dynamic'

type Action = 'draft' | 'go_live'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  let body: { content_queue_id?: string; brand_id?: string; action?: Action }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content_queue_id, brand_id, action } = body

  if (!content_queue_id || !brand_id || !action) {
    return NextResponse.json(
      { error: 'Missing required fields: content_queue_id, brand_id, action' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const admin = createAdminClient()

  const { data: conn } = await admin
    .from('shopify_connections')
    .select('shop_domain, access_token, scopes')
    .eq('brand_id', brand_id)
    .neq('sync_status', 'disconnected')
    .neq('access_token', '')
    .order('connected_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json(
      { error: 'No active Shopify connection for this brand' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Guard: write_content scope required
  const scopes = (conn.scopes ?? '').split(',').map((s: string) => s.trim())
  if (!scopes.includes('write_content')) {
    return NextResponse.json(
      {
        error: 'write_content scope not granted — re-connect Shopify from Settings > Integrations to enable direct blog publishing.',
        scope_error: true,
      },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const { data: queueRow, error: queueError } = await admin
    .from('content_queue')
    .select('*')
    .eq('id', content_queue_id)
    .eq('brand_id', brand_id)
    .single()

  if (queueError || !queueRow) {
    return NextResponse.json(
      { error: 'Content queue item not found' },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    )
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
  }

  let publishResult: { shopify_article_id: string; handle: string; url: string | null }
  const existingArticleId = content.shopify_article_id as string | undefined

  try {
    if (existingArticleId && action === 'go_live') {
      publishResult = await updateBlogArticle(conn.shop_domain, conn.access_token, existingArticleId, input)
    } else {
      publishResult = await createBlogArticle(conn.shop_domain, conn.access_token, input)
    }
  } catch (err) {
    console.error('[publish-shopify]', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Shopify publish failed' },
      { status: 502, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Write shopify IDs back to content_queue
  await admin
    .from('content_queue')
    .update({
      content: {
        ...content,
        shopify_article_id: publishResult.shopify_article_id,
        shopify_url: publishResult.url,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', content_queue_id)

  return NextResponse.json(
    {
      ok: true,
      shopify_article_id: publishResult.shopify_article_id,
      handle: publishResult.handle,
      url: publishResult.url,
    },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
