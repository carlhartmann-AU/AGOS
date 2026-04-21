import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateReviewDigest } from '@/lib/agents/reviews/engine'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { brand_id?: string; days?: number }
    const supabase = createAdminClient()
    const result = await generateReviewDigest(supabase, body.brand_id ?? 'plasmaide', body.days ?? 7)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[reviews/digest]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
