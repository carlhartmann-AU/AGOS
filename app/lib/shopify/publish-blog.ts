// lib/shopify/publish-blog.ts
// Direct Shopify GraphQL blog publishing (API 2026-04).
// Requires write_content scope — check before calling.

import { shopifyGraphQL } from './client'

const FALLBACK_BLOG_GID = 'gid://shopify/Blog/94553112861'

const BLOGS_QUERY = `
query GetBlogs {
  blogs(first: 5) {
    nodes { id title handle }
  }
}
`

const ARTICLE_CREATE_MUTATION = `
mutation ArticleCreate($blogId: ID!, $article: ArticleCreateInput!) {
  articleCreate(blogId: $blogId, article: $article) {
    article {
      id
      handle
      onlineStoreUrl
    }
    userErrors { field message }
  }
}
`

const ARTICLE_UPDATE_MUTATION = `
mutation ArticleUpdate($id: ID!, $article: ArticleUpdateInput!) {
  articleUpdate(id: $id, article: $article) {
    article {
      id
      handle
      onlineStoreUrl
    }
    userErrors { field message }
  }
}
`

export interface BlogPublishInput {
  title: string
  body_html: string
  summary_html?: string
  author?: string
  tags?: string[]
  handle?: string
  seo_title?: string
  seo_description?: string
  published: boolean
  published_at?: string
}

export interface BlogPublishResult {
  shopify_article_id: string
  handle: string
  url: string | null
}

async function getBlogId(shopDomain: string, accessToken: string): Promise<string> {
  try {
    const result = await shopifyGraphQL<{
      blogs: { nodes: Array<{ id: string; title: string }> }
    }>(shopDomain, accessToken, BLOGS_QUERY)
    const first = result.data?.blogs?.nodes?.[0]
    return first?.id ?? FALLBACK_BLOG_GID
  } catch {
    console.warn('[publish-blog] Failed to fetch blogs, falling back to default ID')
    return FALLBACK_BLOG_GID
  }
}

function buildArticleInput(input: BlogPublishInput): Record<string, unknown> {
  const article: Record<string, unknown> = {
    title: input.title,
    body: input.body_html,
    isPublished: input.published,
    author: { name: input.author ?? 'Plasmaide' },
  }

  if (input.summary_html) article.summaryHtml = input.summary_html
  if (input.tags?.length) article.tags = input.tags
  if (input.handle) article.handle = input.handle
  if (input.published && input.published_at) article.publishedAt = input.published_at
  if (input.seo_title || input.seo_description) {
    article.seo = { title: input.seo_title ?? null, description: input.seo_description ?? null }
  }

  return article
}

export async function createBlogArticle(
  shopDomain: string,
  accessToken: string,
  input: BlogPublishInput,
): Promise<BlogPublishResult> {
  const blogId = await getBlogId(shopDomain, accessToken)
  const article = buildArticleInput(input)

  const result = await shopifyGraphQL<{
    articleCreate: {
      article: { id: string; handle: string; onlineStoreUrl: string | null } | null
      userErrors: Array<{ field: string[]; message: string }>
    }
  }>(shopDomain, accessToken, ARTICLE_CREATE_MUTATION, { blogId, article })

  const errors = result.data?.articleCreate?.userErrors ?? []
  if (errors.length) throw new Error(`Shopify articleCreate failed: ${errors.map(e => e.message).join(', ')}`)

  const created = result.data?.articleCreate?.article
  if (!created) throw new Error('Shopify returned no article after create')

  return { shopify_article_id: created.id, handle: created.handle, url: created.onlineStoreUrl }
}

export async function updateBlogArticle(
  shopDomain: string,
  accessToken: string,
  articleId: string,
  input: Partial<BlogPublishInput>,
): Promise<BlogPublishResult> {
  const article: Record<string, unknown> = {}

  if (input.title !== undefined) article.title = input.title
  if (input.body_html !== undefined) article.body = input.body_html
  if (input.summary_html !== undefined) article.summaryHtml = input.summary_html
  if (input.tags !== undefined) article.tags = input.tags
  if (input.published !== undefined) {
    article.isPublished = input.published
    if (input.published) article.publishedAt = input.published_at ?? new Date().toISOString()
  }
  if (input.seo_title || input.seo_description) {
    article.seo = { title: input.seo_title ?? null, description: input.seo_description ?? null }
  }

  const result = await shopifyGraphQL<{
    articleUpdate: {
      article: { id: string; handle: string; onlineStoreUrl: string | null } | null
      userErrors: Array<{ field: string[]; message: string }>
    }
  }>(shopDomain, accessToken, ARTICLE_UPDATE_MUTATION, { id: articleId, article })

  const errors = result.data?.articleUpdate?.userErrors ?? []
  if (errors.length) throw new Error(`Shopify articleUpdate failed: ${errors.map(e => e.message).join(', ')}`)

  const updated = result.data?.articleUpdate?.article
  if (!updated) throw new Error('Shopify returned no article after update')

  return { shopify_article_id: updated.id, handle: updated.handle, url: updated.onlineStoreUrl }
}
