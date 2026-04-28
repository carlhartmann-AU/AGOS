import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { transitionContentStatus } from '@/lib/content/queue-approver'
import type { ApproveAction } from '@/lib/content/queue-approver'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; action?: ApproveAction; brand_id?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { id, action, brand_id } = body

  if (!id || !action || !brand_id) {
    return NextResponse.json({ error: 'Missing required fields: id, action, brand_id' }, { status: 400 })
  }

  try {
    const result = await transitionContentStatus({
      content_id: id,
      brand_id,
      action,
      actor_email: user.email ?? 'unknown',
    })
    return NextResponse.json({ ok: true, action, status: result.status, shopify_resource_id: result.shopify_resource_id ?? null })
  } catch (err: unknown) {
    const e = err as Error & { code?: number; current_status?: string }
    if (e.code === 404) {
      return NextResponse.json({ error: e.message }, { status: 404 })
    }
    if (e.code === 409) {
      return NextResponse.json({ error: e.message, current_status: e.current_status }, { status: 409 })
    }
    console.error('[web-designer/approve]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
