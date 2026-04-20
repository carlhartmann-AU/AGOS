# AGOS Handover Notes — April 19, 2026

## What Was Built (Phases 1-3 + Platform Foundation)

### Working Production System
- **Dashboard:** https://app-tau-black-82.vercel.app
- **GitHub:** carlhartmann-AU/AGOS
- **Vercel project:** carlhartmann-au/app (can rename to "agos")

### Content Pipeline (end-to-end working)
1. Content Studio → generates content via Claude API → inserts to Supabase content_queue
2. Web Designer Approvals → shows pending content with HTML preview, SEO metadata, compliance badges
3. Approve → Shopify Draft → n8n webhook creates unpublished article in Shopify
4. Go Live → n8n webhook publishes the article
5. Email notification to Carl + Steve when content goes live
6. Scheduled generation via Vercel Cron (daily at 8am AEST)

### Dashboard KPIs (live data)
- Store Performance: Revenue, Orders, AOV, New Customers (from Triple Whale API)
- Content Pipeline: Generated, Pending Review, Published, Approval Rate (from Supabase)
- Recent Content feed with status badges

### Settings Infrastructure
- 8 tabs: Brand Profile, Content Schedule, AI Model, Integrations, Alert Thresholds, Reporting, COO Channels, Team, Billing
- Multi-user auth with roles (admin/approver/viewer)
- Plan/billing architecture (starter/growth/scale/enterprise)
- All integrations configured: Shopify, DotDigital, n8n, Triple Whale

---

## Infrastructure Details

### n8n (plasmaide.app.n8n.cloud)
- **Shopify Workflows** (ID: Wvh9IBax5jaFmkGG) — active, published
  - Draft webhook: POST /webhook/web-designer-draft (response mode: lastNode)
  - Go Live webhook: POST /webhook/web-designer-go-live
  - Routing: Webhook → Is Article? → true: Publish Article / false: Is Page?1 → Publish Page
  - Auth: Shopify OAuth2 API credential (ID: zONKBR2HnZbRLsO9)
- **Dot Digital Workflow** (ID: ZYGGRZjyQZDGLrw5) — active
- n8n SDK node()/trigger() functions are BROKEN — cannot create/update workflows via MCP SDK. Use UI or API directly.

### Shopify
- Store: plasmaide-uk.myshopify.com
- App: AGOS (OAuth2 via Dev Dashboard)
- Blog: "The Journal" (ID: 94553112861)
- OAuth redirect: https://oauth.n8n.cloud/oauth2/callback

### Supabase (wgfrtkezensrxcjoplih.supabase.co)
- **content_queue** — JSONB content column, NOT flat columns
  - content_type CHECK: email, blog, social_caption, ad, landing_page, b2b_email, cs_response, review_response
  - status CHECK: pending, compliance_check, compliance_fail, escalated, approved, rejected, publish_pending, published, failed
  - Content stored in `content` JSONB: {title, handle, body_html, summary_html, meta_title, meta_description, tags, shopify_blog_id, target_keywords, author, shopify_resource_id}
- **brand_settings** — schedule config, LLM config, integrations, billing
- **profiles** — user roles (admin/approver/viewer), linked to auth.users
- **event_log** — action logging
- **tw_daily_summary** — Triple Whale daily metrics cache
- RLS enabled on all tables. Admin client (service role) needed for server-side fetches to avoid recursive RLS loops.

### Triple Whale API
- Base URL: https://api.triplewhale.com/api/v2/
- Auth: x-api-key header
- Key: stored in brand_settings.integrations.triple_whale.api_key (ROTATE — exposed in conversation)
- Working endpoints:
  - POST /summary-page/get-data — revenue, orders (requires shopDomain, period, todayHour)
  - POST /orcabase/api/moby — AOV, new/returning customers (NL query)
  - GET /users/api-keys/me — key validation
  - POST /attribution/get-orders-with-journeys-v2 — attribution data
- Ad metrics (ROAS, CPA, etc.) blocked until ad accounts connected

### Vercel
- Hobby plan (daily cron only, not hourly)
- Cron: 0 8 * * * (daily at 8am UTC)
- Environment vars: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, N8N_WEBHOOK_BASE_URL, ANTHROPIC_API_KEY

---

## Critical Learnings

1. **Always delete .next before deploying** — stale cache is the #1 cause of bugs
2. **n8n: Save ≠ Publish** — always check versionId === activeVersionId
3. **n8n If node v2 copy/paste** loses options.caseSensitive — add "Ignore Case" option manually
4. **Supabase RLS recursive loop** — profiles table admin-check policy causes infinite recursion when queried from browser client. Use admin client (service role) for role lookups.
5. **content_queue schema mismatch** — the actual table uses JSONB content column, NOT the individual columns from the Phase 3 migration design
6. **Webhook response mode** — Draft webhook uses "lastNode" to return Shopify article ID; Go Live uses "immediately"

---

## Remaining Work

### Quick Wins
- [ ] Topics queue UI — only shows last topic (bug in ContentSchedule component)
- [ ] Invite Steve — test multi-user invite flow
- [ ] Rotate Triple Whale API key (exposed in conversation)
- [ ] Vercel custom domain
- [ ] Clean up any test articles in Shopify

### Phase 4 — Intelligence + Compliance
- [ ] Standalone Compliance Agent
- [ ] Intelligence Agent (merged: marketing + analytics + customer)
- [ ] Event log analytics in dashboard
- [ ] Token/cost tracking
- [ ] Memory layer (Supabase pgvector)
- [ ] Triple Whale daily sync cron

### Phase 5 — COO + CFO + Voice
- [ ] COO Agent (orchestration, weekly reports)
- [ ] CFO Agent (Xero MCP, financial approval queue)
- [ ] Gmail/WhatsApp interfaces
- [ ] Voice interface (ElevenLabs)

### Phase 6 — Growth
- [ ] B2B Outreach Agent
- [ ] Gorgias CS integration
- [ ] Folle brand onboarding
- [ ] Full observability dashboard

### Platform Roadmap
- [ ] Stripe integration for billing
- [ ] Native OAuth (eliminate n8n dependency)
- [ ] MCP server for AI-assisted configuration
- [ ] Bring your own LLM
- [ ] Template management CRUD
- [ ] Multi-brand onboarding wizard
