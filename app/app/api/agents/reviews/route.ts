import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { analyseReviews } from '@/lib/agents/reviews/engine'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brandId = searchParams.get('brand_id') ?? 'plasmaide'
  const sentiment = searchParams.get('sentiment')
  const responseStatus = searchParams.get('response_status')
  const limit = parseInt(searchParams.get('limit') ?? '20', 10)
  const supabase = createAdminClient()

  let query = supabase
    .from('reviews')
    .select('*')
    .eq('brand_id', brandId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (sentiment) query = query.eq('sentiment', sentiment)
  if (responseStatus) query = query.eq('response_status', responseStatus)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reviews: data ?? [], count: data?.length ?? 0 })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      brand_id?: string
      reviews: Array<{
        source: string
        reviewer_name?: string
        rating: number
        title?: string
        body: string
        review_date?: string
      }>
    }
    if (!Array.isArray(body.reviews) || !body.reviews.length) {
      return NextResponse.json({ error: 'reviews array required' }, { status: 400 })
    }
    const supabase = createAdminClient()
    const result = await analyseReviews(supabase, body.brand_id ?? 'plasmaide', body.reviews)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[reviews POST]', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}
