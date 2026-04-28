// POST /api/content/publish
// Browser-driven publish-confirm. Transitions approved → publish_pending and fires n8n webhook.

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { transitionContentStatus } from '@/lib/content/queue-approver'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(request: NextRequest) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }

  let body: { content_id?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400, headers: { 'Cache-Control': 'no-store' } })
  }

  const { content_id } = body
  if (!content_id || typeof content_id !== 'string') {
    return NextResponse.json(
      { error: 'Missing or invalid content_id' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  // Resolve brand_id from the user's profile (mirrors web-designer/approve pattern)
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('brand_id')
    .eq('id', user.id)
    .single()

  if (!profile?.brand_id) {
    return NextResponse.json(
      { error: 'No brand associated with this user' },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    )
  }

  const brand_id = profile.brand_id as string

  try {
    const result = await transitionContentStatus({
      content_id,
      brand_id,
      action: 'publish_pending',
      actor_email: user.email ?? 'unknown',
    })
    return NextResponse.json(
      { success: true, status: result.status },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (err: unknown) {
    const e = err as Error & { code?: number; current_status?: string }
    if (e.code === 404) {
      return NextResponse.json(
        { error: e.message },
        { status: 404, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    if (e.code === 409) {
      return NextResponse.json(
        { error: e.message, current_status: e.current_status },
        { status: 409, headers: { 'Cache-Control': 'no-store' } },
      )
    }
    console.error('[content/publish]', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
