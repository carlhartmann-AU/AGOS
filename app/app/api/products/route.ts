import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl
  const brand_id = searchParams.get('brand_id') ?? 'plasmaide'
  const status = searchParams.get('status')
  const search = searchParams.get('search')
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '50'), 200)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = createAdminClient()

  let query = supabase
    .from('products')
    .select('id, shopify_product_id, title, status, tags, handle, featured_image_url, vendor, product_type, last_synced_at, created_at, product_variants(id, title, sku, price, currency, inventory_quantity, position)', { count: 'exact' })
    .eq('brand_id', brand_id)
    .order('title', { ascending: true })
    .range(offset, offset + limit - 1)

  if (status && status.trim() !== '') query = query.eq('status', status.trim())
  if (search) query = query.ilike('title', `%${search}%`)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    products: data ?? [],
    total: count ?? 0,
    limit,
    offset,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
