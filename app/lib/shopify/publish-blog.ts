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
      title
      handle
      body
      summary
      isPublished
      publishedAt
      author { name }
    }
    userErrors { code field message }
  }
}
`

const ARTICLE_UPDATE_MUTATION = `
mutation ArticleUpdate($id: ID!, $article: ArticleUpdateInput!) {
  articleUpdate(id: $id, article: $article) {
    article {
      id
      title
      handle
      body
      summary
      isPublished
      publishedAt
      author { name }
    }
    userErrors { code field message }
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

type BlogNode = { id: string; title: string; handle: string }

async function getBlog(shopDomain: string, accessToken: string): Promise<{ id: string; handle: string | null }> {
  try {
    const result = await shopifyGraphQL<{
      blogs: { nodes: Array<BlogNode> }
    }>(shopDomain, accessToken, BLOGS_QUERY)
    const first = result.data?.blogs?.nodes?.[0]
    return { id: first?.id ?? FALLBACK_BLOG_GID, handle: first?.handle ?? null }
  } catch {
    console.warn('[publish-blog] Failed to fetch blogs, falling back to default ID')
    return { id: FALLBACK_BLOG_GID, handle: null }
  }
}

function buildArticleInput(input: BlogPublishInput): Record<string, unknown> {
  const article: Record<string, unknown> = {
    title: input.title,
    body: input.body_html,
    isPublished: input.published,
    author: { name: input.author ?? 'Plasmaide' },
  }

  if (input.summary_html) article.summary = input.summary_html
  if (input.tags?.length) article.tags = input.tags
  if (input.handle) article.handle = input.handle
  if (input.published && input.published_at) article.publishDate = input.published_at
  // SEO metadata not supported on ArticleCreateInput; future work via metafields write.

  return article
}

type ArticleResponse = {
  id: string
  title: string
  handle: string
  body: string
  summary: string | null
  isPublished: boolean
  publishedAt: string | null
  author: { name: string }
} | null

type ArticleUserError = { code: string; field: string[]; message: string }

export async function createBlogArticle(
  shopDomain: string,
  accessToken: string,
  input: BlogPublishInput,
): Promise<BlogPublishResult> {
  const { id: blogId, handle: blogHandle } = await getBlog(shopDomain, accessToken)
  const article = buildArticleInput(input)

  const result = await shopifyGraphQL<{
    articleCreate: {
      article: ArticleResponse
      userErrors: Array<ArticleUserError>
    }
  }>(shopDomain, accessToken, ARTICLE_CREATE_MUTATION, { blogId, article })

  const errors = result.data?.articleCreate?.userErrors ?? []
  if (errors.length) throw new Error(`Shopify articleCreate failed: ${errors.map(e => e.message).join(', ')}`)

  const created = result.data?.articleCreate?.article
  if (!created) {
    console.error('[publish-blog] articleCreate returned null. Full response:', JSON.stringify(result, null, 2))
    console.error('[publish-blog] Input that failed:', JSON.stringify(input, null, 2))
    throw new Error('Shopify returned no article after create')
  }

  const url = blogHandle && created.handle
    ? `https://${shopDomain}/blogs/${blogHandle}/${created.handle}`
    : null

  return { shopify_article_id: created.id, handle: created.handle, url }
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
  if (input.summary_html !== undefined) article.summary = input.summary_html
  if (input.tags !== undefined) article.tags = input.tags
  if (input.published !== undefined) {
    article.isPublished = input.published
    if (input.published) article.publishDate = input.published_at ?? new Date().toISOString()
  }
  // SEO metadata not supported on ArticleUpdateInput; future work via metafields write.

  const result = await shopifyGraphQL<{
    articleUpdate: {
      article: ArticleResponse
      userErrors: Array<ArticleUserError>
    }
  }>(shopDomain, accessToken, ARTICLE_UPDATE_MUTATION, { id: articleId, article })

  const errors = result.data?.articleUpdate?.userErrors ?? []
  if (errors.length) throw new Error(`Shopify articleUpdate failed: ${errors.map(e => e.message).join(', ')}`)

  const updated = result.data?.articleUpdate?.article
  if (!updated) throw new Error('Shopify returned no article after update')

  return { shopify_article_id: updated.id, handle: updated.handle, url: null }
}
