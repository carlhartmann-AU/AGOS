# CLAUDE.md — Autonomous Growth Operating System

## Project Bible v2.0

> **This file is the single source of truth for the project.**
> Read this fully before starting any session. For detailed specs,
> read the relevant file in `/docs/` before starting work on that area.
>
> If a task conflicts with the Cardinal Rules, stop and ask.
> If a schema change is needed, update `/docs/schema.md` first, then implement.

### Reference docs (read on demand)

| File | Contents |
|------|----------|
| `docs/agents.md` | Full specs for all 12 agents |
| `docs/schema.md` | Supabase schema, RLS policies, RPC functions |
| `docs/approval-flows.md` | Content, Financial, and CS approval flows |
| `docs/n8n-contract.md` | n8n execution contract, payloads, callbacks |
| `docs/security.md` | Security model, MCP permissions matrix |
| `docs/brands.md` | Brand-specific knowledge (Plasmaide, Folle) |
| `docs/known-issues.md` | TripleWhale, DotDigital, WhatsApp workarounds |
| `docs/dashboard.md` | Dashboard spec, navigation, UI wireframes |
| `docs/memory.md` | Vector memory, embedding strategy, retrieval |

---

## 1. WHAT WE ARE BUILDING

An **Autonomous Growth Operating System (AGOS)** for multi-brand e-commerce.

Built initially for **Plasmaide** (pine bark extract supplement, AU/UK/US/EU)
and **Folle** (FMCG, January 2027), with architecture designed to onboard
additional brands with zero code changes.

**Core value proposition:**
- AI agents handle marketing, content, CS, finance monitoring, web optimisation
- Humans approve before anything publishes, sends, or changes
- Every brand runs on the same stack with brand-scoped config
- MCP-native wherever possible — no custom API wrappers

**This is NOT:** a chatbot, a SaaS platform, or autonomous. Every customer-facing
or financial action has a human gate.

---

## 2. CARDINAL RULES

These never change. If a task conflicts, stop and ask.

1. **COO Agent is sole orchestrator.** No peer-to-peer agent communication.
   Only exception: Content Strategy → Compliance is a fixed synchronous pipeline.

2. **Humans approve before execution.** Content, financial changes, store edits,
   campaign launches, refunds — all require approval.

3. **n8n is dumb pipes.** Executes, retries, routes. Never reasons or decides.

4. **Secrets never in Google Sheets.** Keys/tokens → n8n credential store only.

5. **Least-privilege MCP access.** Each agent gets only the MCP tools it needs.

6. **Brand isolation.** Every data row carries `brand_id`. Enforced by RLS.

7. **Compliance first.** No medical claims. TGA/FDA/EFSA/MHRA compliant.
   Compliance Agent checks everything before approval queue.

8. **Supabase is production data. Sheets is config.**
   Production reads/writes via Supabase REST API or client library.
   Supabase MCP is dev/schema only — never production.

9. **Agents are Claude API calls, not loops.** Every invocation is a single
   API call with system prompt + context + structured output. n8n handles
   all scheduling and triggering.

---

## 3. TECH STACK

### Intelligence Layer
- **Claude Sonnet 4.6** (`claude-sonnet-4-6`) — all agent API calls
- **Claude Opus** — complex architectural decisions only (human-initiated)

### Orchestration
- **n8n Cloud** (`plasmaide.app.n8n.cloud`) — cron, webhooks, retries, platform APIs

### Data Layer
- **Supabase** — Postgres + pgvector + Storage + Auth + RLS
- **Google Sheets** — config only (Brands, Config, Alert Log, Prompt Registry)

### UI / Hosting
- **Next.js 14** (App Router) + React + Tailwind
- **Supabase JS client** (real-time subscriptions)
- **Supabase Auth** (email/password + Google OAuth)
- **Vercel** (production hosting, auto-deploy from `main`)

### MCP Servers
```
Shopify         → Content Strategy, Campaign Exec, CFO, Web Designer, CS, Review Harvester, Intelligence
Xero            → CFO (read+write w/ approval), COO (read only)
Klaviyo         → Campaign Exec (Folle), Intelligence (Folle)
DotDigital      → n8n only. MCP for code/docs assist.
Gorgias         → CS Agent, Review Harvester
ElevenLabs      → COO (Phase 5)
Gmail           → COO (Phase 4+), B2B Outreach (draft only)
Slack           → COO alerts (Phase 1+)
Google Sheets   → Config reads
Supabase MCP    → Dev/schema only (never production)
n8n MCP         → Workflow building
```

### External Services
- **DotDigital** — Plasmaide email (API user: `apiuser-3567b76c6e13@apiconnector.com`, region r3)
- **Klaviyo** — Folle email
- **Shopify** — single store per brand + Markets. Plasmaide: `plasmaide.myshopify.com`
- **Xero** — accounting (all brands)
- **Gorgias** — CS helpdesk (Shopify-native)
- **Meta Graph API / TikTok API / LinkedIn API** — social posting via n8n

---

## 4. AGENT EXECUTION MODEL

Each agent is a **system prompt** (`/agents/*.md`) + **context payload** sent via Claude API.
No persistent processes. No loops.

```
Trigger (cron / webhook / manual)
  → n8n assembles context (brand config + Supabase data)
  → n8n calls Claude API (system prompt + context + MCP tools)
  → Claude returns structured JSON
  → n8n routes response (queue insert / webhook / platform API)
  → n8n logs to audit_log
```

### Prompt management
- Canonical source: `/agents/*.md` files
- Version tracked in Prompt Registry (Google Sheets tab)
- Each prompt has: agent, version (semver), sha256_hash, status (live/test/deprecated)

### Error handling
- API failures: n8n retries 3× with 30s exponential backoff
- Final failure: log to `audit_log` (status=failure), insert event, Slack alert to COO
- Platform API failures: retry per `retry_config`, update queue status to `failed`, Slack alert

### Token budgets per invocation

| Agent | Max tokens |
|-------|-----------|
| Content Strategy | 4096 |
| Compliance | 2048 |
| Intelligence | 4096 |
| CFO | 2048 |
| COO | 2048 |
| CS Agent | 2048 |
| Web Designer | 4096 |
| B2B Outreach | 2048 |
| Review Harvester | 1024 |
| Campaign Execution | 1024 |

---

## 5. AGENT HIERARCHY

```
COO Agent (orchestrator)
├── Intelligence Agent (3 modes — splits Phase 5+)
│   ├── [mode] Market Research
│   ├── [mode] Performance Analytics
│   └── [mode] Customer Intelligence
├── Content Strategy Agent
│   └── Compliance & Guardrail Agent (fixed pipeline)
├── Campaign Execution Agent
├── CFO Agent
├── Web Designer Agent
├── B2B Outreach Agent
├── Review Harvester Agent
└── Customer Service Agent (external-facing)
```

**12 named agents.** Phases 1–4: Intelligence runs as 1 agent with 3 modes (10 active).
Phase 5+: splits into 3 (12 independent agents).

> Full agent specs: `docs/agents.md`

---

## 6. DATA LAYER (Summary)

### Supabase tables
- `brands` — brand registry
- `events` — canonical event log (append-only)
- `content_queue` — content lifecycle tracking
- `financial_queue` — financial action approvals
- `audit_log` — every agent invocation
- `agent_memory` — pgvector semantic storage
- `customer_identity` — unified cross-platform customer IDs
- `b2b_prospects` — B2B outreach tracking

All tables have RLS enabled, scoped by `brand_id`.

### Google Sheets (4 tabs)
- Brands, Config, Alert Log, Prompt Registry

> Full schema + indexes + RLS policies + RPC functions: `docs/schema.md`

---

## 7. KEY FLOWS (Summary)

### Content: Create → Comply → Approve → Publish
Content Strategy → Compliance Agent (PASS/FAIL/ESCALATE) → content_queue →
Artifact approval → Campaign Execution → n8n draft → Publish confirmation → live

### Financial: Detect → Queue → Approve → Execute
CFO detects anomaly → financial_queue → Artifact approval → n8n executes via Xero/ad API

### CS: Ticket → Classify → Act
Gorgias ticket → CS Agent classifies (INFORM/DRAFT/PROPOSE/EXECUTE/ESCALATE) →
pre-approved actions execute, all others queue for human approval

> Full flow diagrams: `docs/approval-flows.md`

---

## 8. MULTI-BRAND ARCHITECTURE

### Adding a new brand (zero code change)
1. Add to `brands` table + Brands sheet
2. Add config rows to Config sheet
3. Add credentials to n8n
4. Upload brand knowledge to `agent_memory`
5. Configure Gorgias inbox
6. Add `brand_ids` to user's Supabase Auth metadata

### Platform routing (n8n config-driven)
```
email_platform = dotdigital → DotDigital nodes
email_platform = klaviyo    → Klaviyo MCP
shopify_store  = [domain]   → Shopify MCP scoped to credential
```

---

## 9. BUILD PHASES

### Phase 1 — Foundation (CURRENT)
**Goal:** Multi-brand data layer + dashboard shell + auth

- [ ] Supabase project created, full schema applied (`docs/schema.md`)
- [ ] pgvector enabled, `match_agent_memory` RPC function created
- [ ] Supabase Auth configured (email/password + Google OAuth)
- [ ] Google Sheets created (4 tabs)
- [ ] Plasmaide brand added to `brands` table + Sheets
- [ ] Next.js + Tailwind dashboard scaffolded
- [ ] Auth integration (login, protected routes)
- [ ] Brand selector dropdown
- [ ] Settings page (reads/writes Config sheet)
- [ ] Supabase client connected (real-time)
- [ ] Vercel deployment configured
- [ ] n8n MCP connected
- [ ] Empty Approval Queue page shells

**NOT Phase 1:** No agents, no content generation, no n8n workflows.

**Exit criteria:** Dashboard loads, user logs in, selects Plasmaide, views/edits settings,
sees empty queues. Schema complete. RLS enforced.

### Phase 2 — Content Engine
Content Strategy + Compliance agents → approval queue → DotDigital + Shopify publishing

### Phase 3 — CS + Social + Web Designer
Gorgias CS live, social publishing, site optimisation drafts

### Phase 4 — Intelligence + Observability
Intelligence Agent (3 modes), full compliance service, dashboard analytics, Gmail COO

### Phase 5 — COO + CFO + Voice
Full orchestration, financial governance, ElevenLabs voice, WhatsApp inbound

### Phase 6 — Growth + Multi-Brand
B2B Outreach, Intelligence split (3 agents), Folle onboarded

> Full phase deliverables: each phase's detail is in the relevant `/docs/` files

---

## 10. CONVENTIONS

### File structure
```
/
├── CLAUDE.md                    ← THIS FILE
├── /app                         ← Next.js dashboard (Vercel)
│   ├── /app                     ← App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   ├── /login
│   │   ├── /approvals
│   │   │   ├── /content
│   │   │   └── /financial
│   │   ├── /performance
│   │   ├── /coo
│   │   └── /settings
│   ├── /components
│   ├── /lib
│   │   ├── supabase.ts
│   │   ├── sheets.ts
│   │   └── webhooks.ts
│   └── /types
│       └── index.ts
├── /agents                      ← Agent system prompts
│   ├── coo.md
│   ├── intelligence.md
│   ├── content-strategy.md
│   ├── campaign-execution.md
│   ├── compliance.md
│   ├── cfo.md
│   ├── web-designer.md
│   ├── b2b-outreach.md
│   ├── review-harvester.md
│   ├── customer-service.md
│   └── /brand-overrides
│       ├── plasmaide.md
│       └── folle.md
├── /supabase
│   ├── schema.sql
│   ├── functions.sql
│   └── /migrations
├── /n8n
│   └── /workflows
├── /docs                        ← Detailed reference (read on demand)
│   ├── agents.md
│   ├── schema.md
│   ├── approval-flows.md
│   ├── n8n-contract.md
│   ├── security.md
│   ├── brands.md
│   ├── known-issues.md
│   ├── dashboard.md
│   └── memory.md
└── /docs/brand
    ├── /plasmaide
    └── /folle
```

### Naming conventions

| Context | Convention | Example |
|---------|-----------|---------|
| `brand_id` | lowercase, no hyphens | `plasmaide`, `folle` |
| Tables | snake_case, plural | `content_queue` |
| Columns | snake_case | `brand_id` |
| Components | PascalCase | `BrandSelector` |
| n8n workflows | `[brand]-[function]-v[N]` | `plasmaide-email-publish-v1` |
| Agent prompts | kebab-case `.md` | `content-strategy.md` |
| Event types | snake_case | `content_published` |
| Env vars | SCREAMING_SNAKE | `SUPABASE_SERVICE_ROLE_KEY` |

### Git workflow
- Branch per phase: `phase-1-foundation`, `phase-2-content`, etc.
- Commit after each working deliverable
- PR to `main` at phase completion
- Never commit secrets (`.env.local` in `.gitignore`)
- Commit messages: `[phase-N] description`

### Environment variables (.env.local — never committed)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
GOOGLE_SHEETS_ID=
N8N_WEBHOOK_BASE_URL=https://plasmaide.app.n8n.cloud/webhook/
N8N_API_KEY=
ANTHROPIC_API_KEY=
```

---

## 11. CURRENT STATUS

**Date:** April 2026
**Phase:** Phase 1 — Foundation (starting)

**What exists:**
- n8n cloud: `plasmaide.app.n8n.cloud` (6 legacy Relevance AI workflows, being replaced)
- DotDigital credential in n8n (ID: `YOCMOmkElZtkJzkR`)
- Plasmaide Shopify: `plasmaide.myshopify.com`, UK: `plasmaide-uk.myshopify.com`
- Plasmaide v2 financial model (Excel)
- Folle financial model (Excel)
- TripleWhale API broken (see `docs/known-issues.md`)
- WhatsApp HITL blocked (see `docs/known-issues.md`)

**What does NOT exist yet:** Supabase project, dashboard, agent prompts, AGOS workflows.

**Next action:** Create Supabase project, apply schema, scaffold Next.js dashboard.

---

## 12. GLOSSARY

| Term | Definition |
|------|-----------|
| **AGOS** | Autonomous Growth Operating System — this project |
| **Agent** | Single Claude API call with system prompt + context. Not a persistent process. |
| **Approval Queue** | Supabase table + dashboard UI for human approve/reject |
| **Compliance Agent** | Synchronous gate checking all content before approval queue |
| **Dumb pipes** | n8n's role: execute, retry, route. Never reason. |
| **HITL** | Human In The Loop — the approval gates |
| **MCP** | Model Context Protocol — tool integration standard |
| **RLS** | Row Level Security — Supabase brand isolation |

---

*Last updated: April 2026 · v2.0 · Next review: End of Phase 1*
