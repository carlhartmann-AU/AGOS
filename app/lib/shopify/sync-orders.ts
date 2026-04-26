import { shopifyGraphQL } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'

// Two-year lookback for initial full backfill
const INITIAL_BACKFILL_DATE = '2024-01-01T00:00:00Z'

const ORDERS_QUERY = `
query GetOrders($first: Int!, $after: String, $query: String) {
  orders(first: $first, after: $after, query: $query) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      name
      email
      financialStatus
      fulfillmentStatus
      currencyCode
      totalPriceSet {
        shopMoney { amount }
      }
      subtotalPriceSet {
        shopMoney { amount }
      }
      totalTaxSet {
        shopMoney { amount }
      }
      totalDiscountsSet {
        shopMoney { amount }
      }
      totalShippingPriceSet {
        shopMoney { amount }
      }
      totalRefundedSet {
        shopMoney { amount }
      }
      lineItems {
        totalCount
      }
      sourceName
      tags
      customer {
        id
      }
      processedAt
      updatedAt
    }
  }
}
`

interface MoneySet {
  shopMoney: { amount: string }
}

interface ShopifyOrder {
  id: string
  name: string
  email: string | null
  financialStatus: string
  fulfillmentStatus: string | null
  currencyCode: string
  totalPriceSet: MoneySet
  subtotalPriceSet: MoneySet
  totalTaxSet: MoneySet
  totalDiscountsSet: MoneySet
  totalShippingPriceSet: MoneySet
  totalRefundedSet: MoneySet
  lineItems: { totalCount: number }
  sourceName: string | null
  tags: string[]
  customer: { id: string } | null
  processedAt: string
  updatedAt: string
}

interface OrdersQueryResponse {
  orders: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: ShopifyOrder[]
  }
}

export interface OrderSyncResult {
  orders_synced: number
  is_full_backfill: boolean
}

function money(set: MoneySet): number {
  return parseFloat(set.shopMoney.amount)
}

export async function syncOrders(
  supabase: SupabaseClient,
  brandId: string,
  shopDomain: string,
  accessToken: string,
): Promise<OrderSyncResult> {
  const syncStart = new Date().toISOString()

  // Determine if this is an initial sync or incremental
  const { count: existingOrderCount } = await supabase
    .from('orders')
    .select('id', { count: 'exact', head: true })
    .eq('brand_id', brandId)

  let queryFilter: string
  let isFullBackfill = false

  if (!existingOrderCount || existingOrderCount === 0) {
    // Initial backfill: fetch all orders from lookback date
    queryFilter = `updated_at:>=${INITIAL_BACKFILL_DATE}`
    isFullBackfill = true
    console.log(`[sync-orders] ${brandId}: initial backfill from ${INITIAL_BACKFILL_DATE}`)
  } else {
    // Incremental: fetch only orders updated since last sync
    const { data: lastSyncRow } = await supabase
      .from('shopify_connections')
      .select('last_sync_at')
      .eq('brand_id', brandId)
      .eq('shop_domain', shopDomain)
      .maybeSingle()

    const lastSync = lastSyncRow?.last_sync_at ?? INITIAL_BACKFILL_DATE
    queryFilter = `updated_at:>=${lastSync}`
    console.log(`[sync-orders] ${brandId}: incremental sync from ${lastSync}`)
  }

  // Build customer ID map for FK linking
  const { data: customerRows } = await supabase
    .from('customers')
    .select('id, shopify_customer_id')
    .eq('brand_id', brandId)
  const customerMap = new Map<string, string>(
    (customerRows ?? []).map(c => [c.shopify_customer_id, c.id])
  )

  // Fetch all matching orders with pagination
  const allOrders: ShopifyOrder[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const result: import('./client').ShopifyGraphQLResponse<OrdersQueryResponse> = await shopifyGraphQL<OrdersQueryResponse>(
      shopDomain,
      accessToken,
      ORDERS_QUERY,
      { first: 50, after: cursor, query: queryFilter },
    )

    if (result.errors?.length) {
      throw new Error(result.errors[0].message)
    }

    const page = result.data!.orders
    allOrders.push(...page.nodes)
    hasNextPage = page.pageInfo.hasNextPage
    cursor = page.pageInfo.endCursor
  }

  // Build all rows first, then batch-upsert in chunks of 100
  const rows = allOrders.map(order => {
    const shopifyCustomerId = order.customer?.id ?? null
    return {
      brand_id: brandId,
      shopify_order_id: order.id,
      shopify_order_number: order.name,
      email: order.email,
      financial_status: order.financialStatus.toLowerCase(),
      fulfillment_status: order.fulfillmentStatus?.toLowerCase() ?? null,
      currency: order.currencyCode,
      total_price: money(order.totalPriceSet),
      subtotal_price: money(order.subtotalPriceSet),
      total_tax: money(order.totalTaxSet),
      total_discounts: money(order.totalDiscountsSet),
      total_shipping: money(order.totalShippingPriceSet),
      total_refunded: money(order.totalRefundedSet),
      line_item_count: order.lineItems.totalCount,
      source_name: order.sourceName,
      tags: order.tags,
      customer_id: shopifyCustomerId ? (customerMap.get(shopifyCustomerId) ?? null) : null,
      shopify_customer_id: shopifyCustomerId,
      order_created_at: order.processedAt,
      order_updated_at: order.updatedAt,
      synced_at: syncStart,
      updated_at: syncStart,
    }
  })

  const CHUNK = 100
  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase
      .from('orders')
      .upsert(rows.slice(i, i + CHUNK), { onConflict: 'brand_id,shopify_order_id' })
    if (error) throw new Error(`Order upsert failed: ${error.message}`)
  }

  return { orders_synced: rows.length, is_full_backfill: isFullBackfill }
}
