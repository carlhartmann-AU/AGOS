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

  // Step 1: query products (no embedded select — PostgREST embedded resources
  // return 0 rows for unfiltered queries on this schema, two-step is reliable)
  let productsQuery = supabase
    .from('products')
    .select('id, shopify_product_id, title, status, tags, handle, featured_image_url, vendor, product_type, last_synced_at, created_at', { count: 'exact' })
    .eq('brand_id', brand_id)
    .order('title', { ascending: true })
    .range(offset, offset + limit - 1)

  if (status && status.trim() !== '') productsQuery = productsQuery.eq('status', status.trim())
  if (search) productsQuery = productsQuery.ilike('title', `%${search}%`)

  const { data: products, error, count } = await productsQuery

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Step 2: fetch variants for the returned products
  const productIds = (products ?? []).map(p => p.id)
  let variantsByProduct: Record<string, unknown[]> = {}

  if (productIds.length > 0) {
    const { data: variants } = await supabase
      .from('product_variants')
      .select('id, product_id, title, sku, price, currency, inventory_quantity, position')
      .in('product_id', productIds)
    for (const v of variants ?? []) {
      const row = v as { product_id: string; [k: string]: unknown }
      if (!variantsByProduct[row.product_id]) variantsByProduct[row.product_id] = []
      variantsByProduct[row.product_id].push(v)
    }
  }

  // Step 3: merge
  const result = (products ?? []).map(p => ({
    ...p,
    product_variants: variantsByProduct[p.id] ?? [],
  }))

  return NextResponse.json({
    products: result,
    total: count ?? 0,
    limit,
    offset,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
