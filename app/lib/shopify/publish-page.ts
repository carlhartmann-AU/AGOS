// lib/shopify/publish-page.ts
// Direct Shopify GraphQL landing page publishing (API 2026-04).
// Requires write_content scope — check before calling.

import { shopifyGraphQL } from './client'

const PAGE_CREATE_MUTATION = `
mutation PageCreate($page: PageCreateInput!) {
  pageCreate(page: $page) {
    page {
      id
      handle
      onlineStoreUrl
    }
    userErrors { field message }
  }
}
`

const PAGE_UPDATE_MUTATION = `
mutation PageUpdate($id: ID!, $page: PageUpdateInput!) {
  pageUpdate(id: $id, page: $page) {
    page {
      id
      handle
      onlineStoreUrl
    }
    userErrors { field message }
  }
}
`

export interface PagePublishInput {
  title: string
  body_html: string
  handle?: string
  meta_title?: string
  meta_description?: string
}

export interface PagePublishResult {
  shopify_page_id: string
  handle: string
  url: string | null
}

type PageResponse = {
  id: string
  handle: string
  onlineStoreUrl: string | null
} | null

type PageUserError = { field: string[]; message: string }

export async function createShopifyPage(
  shopDomain: string,
  accessToken: string,
  input: PagePublishInput,
): Promise<PagePublishResult> {
  const page: Record<string, unknown> = {
    title: input.title,
    body: input.body_html,
    isPublished: true,
  }

  if (input.handle) page.handle = input.handle

  const result = await shopifyGraphQL<{
    pageCreate: {
      page: PageResponse
      userErrors: Array<PageUserError>
    }
  }>(shopDomain, accessToken, PAGE_CREATE_MUTATION, { page })

  const errors = result.data?.pageCreate?.userErrors ?? []
  if (errors.length) throw new Error(`Shopify pageCreate failed: ${errors.map(e => e.message).join(', ')}`)

  const created = result.data?.pageCreate?.page
  if (!created) {
    console.error('[publish-page] pageCreate returned null. Full response:', JSON.stringify(result, null, 2))
    throw new Error('Shopify returned no page after create')
  }

  return {
    shopify_page_id: created.id,
    handle: created.handle,
    url: created.onlineStoreUrl ?? null,
  }
}

export async function updateShopifyPage(
  shopDomain: string,
  accessToken: string,
  pageId: string,
  input: Partial<PagePublishInput>,
): Promise<PagePublishResult> {
  const page: Record<string, unknown> = {}

  if (input.title !== undefined) page.title = input.title
  if (input.body_html !== undefined) page.body = input.body_html
  if (input.handle !== undefined) page.handle = input.handle

  const result = await shopifyGraphQL<{
    pageUpdate: {
      page: PageResponse
      userErrors: Array<PageUserError>
    }
  }>(shopDomain, accessToken, PAGE_UPDATE_MUTATION, { id: pageId, page })

  const errors = result.data?.pageUpdate?.userErrors ?? []
  if (errors.length) throw new Error(`Shopify pageUpdate failed: ${errors.map(e => e.message).join(', ')}`)

  const updated = result.data?.pageUpdate?.page
  if (!updated) throw new Error('Shopify returned no page after update')

  return {
    shopify_page_id: updated.id,
    handle: updated.handle,
    url: updated.onlineStoreUrl ?? null,
  }
}
