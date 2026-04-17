# AGOS Phase 3 — Web Designer Integration Reference

## Working Infrastructure

### n8n Workflows (Plasmaide project)
- **Shopify Workflows** (ID: Wvh9IBax5jaFmkGG) — active, published
  - Webhook: POST `/webhook/web-designer-draft` → creates Shopify draft
  - Webhook: POST `/webhook/web-designer-go-live` → publishes existing draft
  - Auth: Shopify OAuth2 API ("Shopify account" credential)

- **Dot Digital Workflow** (ID: ZYGGRZjyQZDGLrw5) — active, published
  - Webhook: POST `/webhook/plasmaide-content-publish` → creates DotDigital campaign

### Shopify
- Store: plasmaide-uk.myshopify.com
- App: AGOS (Dev Dashboard, OAuth2)
- Scopes: read_products, write_products, read_content, write_content
- Blog: "The Journal" (ID: 94553112861, handle: news)

### Supabase
- URL: https://wgfrtkezensrxcjoplih.supabase.co
- Tables: content_queue, event_log, shopify_blogs
- Realtime enabled on content_queue

### Claude Project
- "AGOS — Web Designer" with web-designer.md as instructions
- Generates structured JSON matching the webhook payload schema

## Webhook Payload Schema (Draft)

```json
{
  "content_type": "blog_article|landing_page|product_cro",
  "brand_id": "plasmaide",
  "title": "Article title",
  "handle": "url-slug",
  "shopify_blog_id": "94553112861",
  "body_html": "<html content>",
  "summary_html": "<excerpt>",
  "tags": "tag1, tag2",
  "shopify_resource_id": "existing_id_for_updates"
}
```

## Two-Stage Approval Flow

```
Stage 1: Review Content → Approve → Shopify Draft (unpublished)
Stage 2: Preview in storefront → Go Live (published)
```

## Environment Variables (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://wgfrtkezensrxcjoplih.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<your_anon_key>
SUPABASE_SERVICE_ROLE_KEY=<your_service_role_key>
N8N_WEBHOOK_BASE_URL=https://plasmaide.app.n8n.cloud
```
