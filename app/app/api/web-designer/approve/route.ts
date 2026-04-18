import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const N8N_BASE = (
  process.env.N8N_WEBHOOK_BASE_URL ?? 'https://plasmaide.app.n8n.cloud/webhook/'
).replace(/\/?$/, '/')

const WEBHOOK_DRAFT   = `${N8N_BASE}web-designer-draft`
const WEBHOOK_GO_LIVE = `${N8N_BASE}web-designer-go-live`

type Action = 'draft' | 'go_live' | 'reject' | 'pull_back'

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

  if (action === 'draft') {
    const { data: row, error } = await supabase
      .from('content_queue')
      .update({
        status: 'approved',
        approved_by: user.email ?? null,
        approved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', content_queue_id)
      .eq('brand_id', brand_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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

    return NextResponse.json({ ok: true, action: 'draft' })
  }

  if (action === 'go_live') {
    const { data: row, error } = await supabase
      .from('content_queue')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', content_queue_id)
      .eq('brand_id', brand_id)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

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

    return NextResponse.json({ ok: true, action: 'go_live' })
  }

  if (action === 'reject') {
    const { error } = await supabase
      .from('content_queue')
      .update({
        status: 'rejected',
        updated_at: new Date().toISOString(),
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
        updated_at: new Date().toISOString(),
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
