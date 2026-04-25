import { shopifyGraphQL } from './client'
import type { SupabaseClient } from '@supabase/supabase-js'

const CUSTOMERS_QUERY = `
query GetCustomers($first: Int!, $after: String) {
  customers(first: $first, after: $after) {
    pageInfo {
      hasNextPage
      endCursor
    }
    nodes {
      id
      email
      firstName
      lastName
      phone
      numberOfOrders
      amountSpent {
        amount
        currencyCode
      }
      tags
      state
      emailMarketingConsent {
        marketingState
      }
      defaultAddress {
        city
        province
        country
        countryCodeV2
      }
      createdAt
      updatedAt
      firstOrder: orders(first: 1, sortKey: PROCESSED_AT, reverse: false) {
        nodes { processedAt }
      }
      lastOrder: orders(first: 1, sortKey: PROCESSED_AT, reverse: true) {
        nodes { processedAt }
      }
    }
  }
}
`

interface ShopifyCustomer {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
  phone: string | null
  numberOfOrders: number
  amountSpent: { amount: string; currencyCode: string }
  tags: string[]
  state: string
  emailMarketingConsent: { marketingState: string } | null
  defaultAddress: {
    city: string | null
    province: string | null
    country: string | null
    countryCodeV2: string | null
  } | null
  createdAt: string
  updatedAt: string
  firstOrder: { nodes: Array<{ processedAt: string }> }
  lastOrder: { nodes: Array<{ processedAt: string }> }
}

interface CustomersQueryResponse {
  customers: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null }
    nodes: ShopifyCustomer[]
  }
}

export interface CustomerSyncResult {
  customers_synced: number
}

export async function syncCustomers(
  supabase: SupabaseClient,
  brandId: string,
  shopDomain: string,
  accessToken: string,
): Promise<CustomerSyncResult> {
  const syncStart = new Date().toISOString()
  const allCustomers: ShopifyCustomer[] = []
  let cursor: string | null = null
  let hasNextPage = true

  while (hasNextPage) {
    const result: import('./client').ShopifyGraphQLResponse<CustomersQueryResponse> = await shopifyGraphQL<CustomersQueryResponse>(
      shopDomain,
      accessToken,
      CUSTOMERS_QUERY,
      { first: 50, after: cursor },
    )

    if (result.errors?.length) {
      throw new Error(result.errors[0].message)
    }

    const page = result.data!.customers
    allCustomers.push(...page.nodes)
    hasNextPage = page.pageInfo.hasNextPage
    cursor = page.pageInfo.endCursor
  }

  let customersUpserted = 0

  for (const customer of allCustomers) {
    const accepts = customer.emailMarketingConsent?.marketingState === 'SUBSCRIBED'
    const firstOrderAt = customer.firstOrder.nodes[0]?.processedAt ?? null
    const lastOrderAt = customer.lastOrder.nodes[0]?.processedAt ?? null

    const { error } = await supabase
      .from('customers')
      .upsert({
        brand_id: brandId,
        shopify_customer_id: customer.id,
        email: customer.email,
        first_name: customer.firstName,
        last_name: customer.lastName,
        phone: customer.phone,
        orders_count: customer.numberOfOrders,
        total_spent: parseFloat(customer.amountSpent.amount),
        currency: customer.amountSpent.currencyCode,
        tags: customer.tags,
        state: customer.state.toLowerCase(),
        accepts_marketing: accepts,
        city: customer.defaultAddress?.city ?? null,
        province: customer.defaultAddress?.province ?? null,
        country: customer.defaultAddress?.country ?? null,
        country_code: customer.defaultAddress?.countryCodeV2 ?? null,
        first_order_at: firstOrderAt,
        last_order_at: lastOrderAt,
        synced_at: syncStart,
        updated_at: syncStart,
      }, { onConflict: 'brand_id,shopify_customer_id' })

    if (error) throw new Error(`Customer upsert failed: ${error.message}`)
    customersUpserted++
  }

  return { customers_synced: customersUpserted }
}
