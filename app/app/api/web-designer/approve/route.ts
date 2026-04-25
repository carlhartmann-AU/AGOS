import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const N8N_BASE = (
  process.env.N8N_WEBHOOK_BASE_URL ?? 'https://plasmaide.app.n8n.cloud/webhook/'
).replace(/\/?$/, '/')

const WEBHOOK_DRAFT   = `${N8N_BASE}web-designer-draft`
const WEBHOOK_GO_LIVE = `${N8N_BASE}web-designer-go-live`

type Action = 'draft' | 'go_live' | 'reject' | 'pull_back'

interface PublishShopifyResult {
  ok?: boolean
  shopify_article_id?: string
  handle?: string
  url?: string | null
  scope_error?: boolean
  error?: string
}

function buildWebhookPayload(row: Record<string, unknown>, approvedBy: string | null | undefined) {
  const content = (row.content ?? {}) as Record<string, unknown>
  return {
    queue_id: row.id,
    brand_id: row.brand_id,
    approved_by: approvedBy ?? null,
    content_type: row.content_type,
    title: content.title ?? null,
    handle: content.handle ?? null,
    body_html: content.body_html ?? null,
    summary_html: content.summary_html ?? null,
    tags: content.tags ?? null,
    shopify_blog_id: content.shopify_blog_id ?? null,
    shopify_resource_id: content.shopify_resource_id ?? null,
  }
}

async function tryDirectPublish(
  request: NextRequest,
  content_queue_id: string,
  brand_id: string,
  action: 'draft' | 'go_live',
): Promise<{ ok: boolean; result: PublishShopifyResult }> {
  try {
    const res = await fetch(`${request.nextUrl.origin}/api/content/publish-shopify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': request.headers.get('Cookie') ?? '',
      },
      body: JSON.stringify({ content_queue_id, brand_id, action }),
    })
    const data = await res.json() as PublishShopifyResult
    return { ok: res.ok && !!data.ok, result: data }
  } catch (err) {
    console.warn('[approve] direct Shopify publish exception:', err)
    return { ok: false, result: {} }
  }
}

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { content_queue_id?: string; action?: Action; brand_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { content_queue_id, action, brand_id } = body

  if (!content_queue_id || !action || !brand_id) {
    return NextResponse.json({ error: 'Missing required fields: content_queue_id, action, brand_id' }, { status: 400 })
  }

  const now = new Date().toISOString()

  if (action === 'draft') {
    const { data: row, error } = await supabase
      .from('content_queue')
      .update({
        status: 'approved',
        approved_by: user.email ?? null,
        approved_at: now,
        updated_at: now,
      })
      .eq('id', content_queue_id)
      .eq('brand_id', brand_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Try direct Shopify publish for blog content
    if (row.content_type === 'blog') {
      const { ok, result } = await tryDirectPublish(request, content_queue_id, brand_id, 'draft')
      if (ok) {
        return NextResponse.json({
          ok: true,
          action: 'draft',
          via: 'shopify',
          shopify_article_id: result.shopify_article_id ?? null,
          url: result.url ?? null,
        })
      }
      if (result.scope_error) {
        console.log('[approve] write_content scope missing — falling back to n8n')
      }
    }

    // n8n fallback
    console.log('[approve] firing draft webhook →', WEBHOOK_DRAFT)
    const webhookRes = await fetch(WEBHOOK_DRAFT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildWebhookPayload(row, user.email)),
    })

    if (!webhookRes.ok) {
      return NextResponse.json(
        { error: `n8n webhook failed: ${webhookRes.status}` },
        { status: 502 }
      )
    }

    const webhookBody = await webhookRes.json().catch(() => ({})) as Record<string, unknown>
    const shopifyId = webhookBody.shopify_id as string | undefined

    if (shopifyId) {
      const existingContent = (row.content ?? {}) as Record<string, unknown>
      await supabase
        .from('content_queue')
        .update({ content: { ...existingContent, shopify_resource_id: shopifyId } })
        .eq('id', content_queue_id)
    }

    return NextResponse.json({ ok: true, action: 'draft', via: 'n8n', shopify_id: shopifyId ?? null })
  }

  if (action === 'go_live') {
    const { data: row, error } = await supabase
      .from('content_queue')
      .update({
        status: 'published',
        published_at: now,
        updated_at: now,
      })
      .eq('id', content_queue_id)
      .eq('brand_id', brand_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Try direct Shopify publish for blog content
    if (row.content_type === 'blog') {
      const { ok, result } = await tryDirectPublish(request, content_queue_id, brand_id, 'go_live')
      if (ok) {
        return NextResponse.json({
          ok: true,
          action: 'go_live',
          via: 'shopify',
          shopify_article_id: result.shopify_article_id ?? null,
          url: result.url ?? null,
        })
      }
      if (result.scope_error) {
        console.log('[approve] write_content scope missing — falling back to n8n')
      }
    }

    // n8n fallback
    console.log('[approve] firing go-live webhook →', WEBHOOK_GO_LIVE)
    const webhookRes = await fetch(WEBHOOK_GO_LIVE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildWebhookPayload(row, user.email)),
    })

    if (!webhookRes.ok) {
      return NextResponse.json(
        { error: `n8n webhook failed: ${webhookRes.status}` },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, action: 'go_live', via: 'n8n' })
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('content_queue')
      .update({
        status: 'rejected',
        updated_at: now,
      })
      .eq('id', content_queue_id)
      .eq('brand_id', brand_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: 'reject' })
  }

  if (action === 'pull_back') {
    const { error } = await supabase
      .from('content_queue')
      .update({
        status: 'pending',
        approved_by: null,
        approved_at: null,
        updated_at: now,
      })
      .eq('id', content_queue_id)
      .eq('brand_id', brand_id)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, action: 'pull_back' })
  }

  return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
}
