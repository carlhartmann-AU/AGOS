import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReviewResponse } from '@/lib/agents/reviews/engine'

export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { review_id: string }
    if (!body.review_id) return NextResponse.json({ error: 'review_id required' }, { status: 400 })

    const supabase = createAdminClient()
    const result = await generateReviewResponse(supabase, body.review_id)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[reviews/respond]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
