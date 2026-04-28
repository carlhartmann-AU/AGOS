// Shopify GraphQL Admin API client
// API version: 2026-04
// Auth: X-Shopify-Access-Token header (offline tokens don't expire)

const SHOPIFY_API_VERSION = '2026-04'
const MAX_RETRIES = 3

export interface ShopifyGraphQLResponse<T> {
  data?: T
  errors?: Array<{ message: string; locations?: unknown[]; path?: string[] }>
  extensions?: {
    cost?: {
      requestedQueryCost: number
      actualQueryCost: number
      throttleStatus: {
        maximumAvailable: number
        currentlyAvailable: number
        restoreRate: number
      }
    }
  }
}

export async function shopifyGraphQL<T>(
  shopDomain: string,
  accessToken: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphQLResponse<T>> {
  const url = `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Shopify-Access-Token': accessToken,
      },
      body: JSON.stringify({ query, variables }),
    })

    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After')
      const waitMs = retryAfter ? parseFloat(retryAfter) * 1000 : 2000
      if (attempt < MAX_RETRIES - 1) {
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }
      throw new Error(`Shopify rate limit exceeded after ${MAX_RETRIES} retries`)
    }

    if (!res.ok) {
      throw new Error(`Shopify API error: ${res.status} ${res.statusText}`)
    }

    const response = await res.json() as ShopifyGraphQLResponse<T>

    if (response.errors && response.errors.length > 0) {
      console.error('[shopifyGraphQL] GraphQL errors in response:', JSON.stringify(response.errors, null, 2))
    }
    if (response.data && typeof response.data === 'object') {
      for (const [key, value] of Object.entries(response.data as Record<string, unknown>)) {
        if (value && typeof value === 'object' && 'userErrors' in value) {
          const userErrors = (value as { userErrors?: unknown }).userErrors
          if (Array.isArray(userErrors) && userErrors.length > 0) {
            console.error(`[shopifyGraphQL] userErrors on ${key}:`, JSON.stringify(userErrors, null, 2))
          }
        }
      }
    }

    return response
  }

  throw new Error('Shopify request failed after max retries')
}
