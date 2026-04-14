# CLAUDE.md — Autonomous Growth Operating System

## Project Bible v2.0

> **This file is the single source of truth for the entire project.**
> Read this fully before starting any session. Every decision made here
> has a reason. Do not deviate without updating this file first.
>
> If a task conflicts with the Cardinal Rules (Section 2), stop and ask.
> If a schema change is needed, update this file first, then implement.

---

## 1. WHAT WE ARE BUILDING

An **Autonomous Growth Operating System (AGOS)** for multi-brand e-commerce businesses.

Not a set of agents. Not a demo. A production system that runs real businesses.

Built initially for **Plasmaide** (pine bark extract supplement, AU/UK/US/EU markets)
and **Folle** (FMCG, calendar year from January 2027), with architecture designed to
onboard additional brands with zero code changes.

### Core value proposition

- AI agents handle marketing, content, customer service, finance monitoring, and web optimisation
- Humans approve before anything publishes, sends, or changes
- Every brand runs on the same stack with brand-scoped config
- MCP-native wherever possible — no custom API wrappers

### What this is NOT

- Not a chatbot product
- Not a SaaS platform (yet) — this is an internal operating system
- Not autonomous — every customer-facing or financial action has a human gate

---

## 2. CARDINAL RULES

These never change. If a task conflicts with these, stop and ask.

1. **COO Agent is the sole orchestrator.** No peer-to-peer agent communication.
   Every inter-agent message routes through the COO. The only exception is the
   Content Strategy → Compliance pipeline, which is a fixed synchronous chain
   (not peer-to-peer routing).

2. **Humans approve before execution.** Content, financial changes, store edits,
   campaign launches, refunds — all require approval. Nothing autonomous touches
   production without a human sign-off step.

3. **n8n is dumb pipes.** It executes, retries, and routes. It never reasons,
   prioritises, or decides. Agents decide → n8n executes.

4. **Secrets never in Google Sheets.** API keys, tokens, credentials → n8n
   credential store only. Sheets holds non-sensitive config only.

5. **Least-privilege MCP access.** Each agent gets only the MCP tools it needs.
   No agent has blanket access to everything.

6. **Brand isolation.** Every piece of data, every config row, every log entry
   carries a `brand_id`. Nothing is shared across brands unless explicitly designed
   (e.g., the compliance rules engine schema is shared; the rules themselves are
   brand-scoped).

7. **Compliance first.** Content guardrails are not optional. Pine Bark Extract only
   for Plasmaide. No medical claims. TGA/FDA/EFSA/MHRA compliant language. The
   Compliance Agent checks everything before it reaches the approval queue.

8. **Supabase is production data. Google Sheets is lightweight config.**
   All production reads/writes go through Supabase REST API or client library.
   Supabase MCP is for development/schema work only — never production.

9. **Agents are Claude API calls, not autonomous loops.** Every agent invocation
   is a single Claude API call with a system prompt, context payload, and structured
   output. Agents do not loop, poll, or maintain persistent processes. n8n handles
   all scheduling and triggering.

---

## 3. TECH STACK

### Intelligence Layer

| Component | Usage |
|-----------|-------|
| **Claude Sonnet 4.6** | All agent reasoning, content generation, analysis |
| **Model string** | `claude-sonnet-4-6` in all API calls |
| **Claude Opus** | Reserved for complex architectural decisions (human-initiated only) |

### Orchestration

| Component | Usage |
|-----------|-------|
| **n8n Cloud** | `plasmaide.app.n8n.cloud` |
| Handles | Cron scheduling, webhook routing, retry logic, platform API calls (DotDigital, Meta, TikTok, LinkedIn), fan-out/fan-in |
| Does NOT | Reason, prioritise, decide, or hold business logic |

### Data Layer

| Component | Usage |
|-----------|-------|
| **Supabase** | Primary production data store |
| | pgvector for memory/embeddings |
| | Postgres for events, content_queue, financial_queue, audit_log, agent_memory, customer_identity |
| | Storage buckets for brand assets and uploaded PDFs |
| | Row Level Security (RLS) for brand isolation |
| **Google Sheets** | Lightweight config only (4 tabs: Brands, Config, Alert Log, Prompt Registry) |
| | Never stores secrets or sensitive data |

### UI / Hosting

| Component | Usage |
|-----------|-------|
| **Vercel** | Production hosting of dashboard web app |
| **Next.js + React + Tailwind** | UI framework |
| **Supabase JS client** | Real-time data subscriptions in dashboard |
| **Supabase Auth** | Dashboard authentication (email/password, Google OAuth) |
| **Claude Artifacts** | Development iteration and prototyping only |

### MCP Servers (complete list)

```
Server              → Used By                                         → Access Level
─────────────────────────────────────────────────────────────────────────────────────
Shopify MCP         → Content Strategy, Campaign Exec, Customer Intel,  → per-agent scoped
                      CFO, Web Designer, CS Agent, Review Harvester
Xero MCP            → CFO (read+write w/ approval), COO (read only)    → role-based
Klaviyo MCP         → Campaign Exec (Folle), Intelligence (Folle)      → brand-conditional
DotDigital          → n8n only (API calls). MCP for code/docs assist.  → n8n credential
Gorgias MCP         → CS Agent, Review Harvester                       → read+write
ElevenLabs MCP      → COO voice interface (Phase 5 only)               → Phase 5
Gmail MCP           → COO (Phase 4+), B2B Outreach (draft only)        → phase-gated
Slack MCP           → COO alerts (Phase 1+)                            → write alerts
Google Sheets MCP   → Config reads (all agents that need config)       → read only
Supabase MCP        → Development/schema work ONLY (never production)  → dev only
n8n MCP             → Workflow building and management                 → admin
```

**Not used:** Pinecone MCP (Supabase pgvector chosen instead).

### External Services

| Service | Brand | Purpose |
|---------|-------|---------|
| **DotDigital** | Plasmaide | Email marketing. API user: `apiuser-3567b76c6e13@apiconnector.com`, region: r3 |
| **Klaviyo** | Folle | Email marketing (native MCP) |
| **Shopify** | All | Single store per brand + Markets for regional. Plasmaide: `plasmaide.myshopify.com` |
| **Xero** | All | Accounting for all brands |
| **Gorgias** | All | Customer service (Shopify-native helpdesk) |
| **ElevenLabs** | System | Voice interface for COO (Phase 5) |
| **Meta Graph API** | All | Instagram + Facebook posting (via n8n) |
| **TikTok API** | All | TikTok posting (via n8n) |
| **LinkedIn API** | All | LinkedIn posting (via n8n) |
| **Snapchat** | All | Semi-manual (API too restrictive for automation) |

---

## 4. AGENT EXECUTION MODEL

### How agents work

Each agent is a **system prompt** (stored in `/agents/*.md`) combined with a **context payload**
sent via the Claude API. There are no persistent agent processes.

```
Trigger (cron / webhook / manual)
  → n8n fires
  → n8n assembles context payload (brand config, relevant data from Supabase)
  → n8n calls Claude API with:
      - system prompt (from /agents/*.md, version tracked in Prompt Registry)
      - context payload (JSON)
      - tools (MCP servers scoped to this agent)
  → Claude returns structured JSON response
  → n8n routes response to next step (queue insert, webhook, platform API)
  → n8n logs to Supabase audit_log
```

### System prompt management

- Canonical source: `/agents/*.md` files in the repo
- Version tracked in Google Sheets → Prompt Registry tab
- Each prompt has: `agent`, `prompt_name`, `version` (semver), `last_updated`, `sha256_hash`, `status`
- Statuses: `live`, `test`, `deprecated`
- n8n reads the `live` prompt at invocation time
- Prompt changes require version bump and hash update in registry

### Token budgets (per invocation)

| Agent | Max tokens | Rationale |
|-------|-----------|-----------|
| Content Strategy | 4096 | Long-form content generation |
| Compliance | 2048 | Pass/fail analysis |
| Intelligence | 4096 | Research synthesis |
| CFO | 2048 | Financial summary |
| COO | 2048 | Routing decisions |
| CS Agent | 2048 | Response drafting |
| Web Designer | 4096 | Page/layout generation |
| B2B Outreach | 2048 | Email drafting |
| Review Harvester | 1024 | Review analysis |
| Campaign Execution | 1024 | Format translation |
| Customer Intelligence | 2048 | Segment analysis |
| Performance Analytics | 2048 | Metrics synthesis |

### Error handling

When a Claude API call fails:
1. n8n retries up to 3 times with 30s exponential backoff
2. On final failure: log to `audit_log` with `status = 'failure'`
3. Insert event to `events` table with `event_type = 'agent_failure'`
4. Alert COO via Slack with agent name, error summary, and timestamp
5. Content in-flight remains in its current queue status (no rollback needed)

When an n8n platform API call fails (DotDigital, Meta, etc.):
1. n8n retries per `retry_config` in the payload
2. On final failure: update `content_queue.status = 'failed'`
3. Log error to `audit_log` and `events`
4. Alert COO via Slack

---

## 5. AGENTS (12 total)

### Hierarchy

```
COO Agent (orchestrator)
├── Intelligence Agent (3 modes — splits Phase 5+)
│   ├── [mode] Market Research
│   ├── [mode] Performance Analytics
│   └── [mode] Customer Intelligence
├── Content Strategy Agent
│   └── Compliance & Guardrail Agent (fixed pipeline, not routed by COO)
├── Campaign Execution Agent
├── CFO Agent
├── Web Designer Agent
├── B2B Outreach Agent
├── Review Harvester Agent
└── Customer Service Agent (external-facing)
```

**Agent count:** 12 named agents. In Phases 1–4, the Intelligence Agent operates as
one agent with 3 modes, so 10 agents are actively deployed. In Phase 5+, Intelligence
splits into 3, making 12 independent agents.

---

### Agent 1: COO Agent

**Role:** Sole orchestrator. Routes, delegates, monitors. Does NO domain work itself.

**Triggers:**
- Cron: Monday 08:00 AEST (weekly report)
- Threshold breach (n8n polls every 4hrs, fires COO if breach detected)
- Manual (via Artifact, Slack, WhatsApp, Gmail, Voice — phased)

**Tools (MCP):** Xero (read only), Google Sheets, Slack, Gmail (Phase 4+), n8n

**Outputs:** Delegation payloads to other agents, alert notifications, executive reports

**Interfaces (phased):**
- Phase 1–3: Artifact + Slack
- Phase 4: + Gmail
- Phase 5: + WhatsApp (inbound only) + Voice (ElevenLabs)

**Approval required:** Budget reallocations, strategic pivots

**Memory scope:** Global + brand-scoped KPI history

**Weekly report contents:**
- Content published this week (count by platform)
- Campaign performance summary (ROAS, CAC, spend)
- CS ticket volume and resolution rate
- Financial anomalies detected
- Approval queue depth
- Agent health (failures, latency)

---

### Agent 2: Intelligence Agent

**Role:** Research, market analysis, performance analysis, customer insights.
Operates in three modes, selected by the COO delegation payload:
- `mode: market_research` — trend scanning, competitor analysis, content opportunities
- `mode: performance_analytics` — campaign ROAS/CAC, attribution, spend monitoring
- `mode: customer_intelligence` — segmentation, LTV, churn prediction

Splits into three separate agents (Agents 9, 10, and dedicated Market Research) in Phase 5+
when core loops are stable and token/complexity warrants separation.

**Triggers:** COO delegation (with mode specified), weekly cron, threshold breach

**Tools (MCP):** Shopify (read), Klaviyo/DotDigital (read via n8n), web search (native Claude tool)

**Outputs:** Structured JSON briefs to Content Strategy (market mode), KPI summaries to COO (all modes)

**Approval required:** None — outputs are briefs, not actions

**Memory scope:** Brand-scoped campaign history, customer segment summaries, market research

**Privacy rule (customer_intelligence mode):** Claude API receives aggregated segment data only — never individual PII. n8n pre-aggregates before invoking agent.

**Customer segments (Plasmaide):**
- Professional Athletes (high AOV, performance-driven)
- Prosumers (research-driven, community-influenced)
- General Wellness (lifestyle, daily health)
- At-risk (60+ days no purchase)

**Alert thresholds (performance_analytics mode, user-configurable):**
- ROAS minimum: 2.0 (Plasmaide default)
- CAC maximum: $40 AUD (Plasmaide default)
- Spend anomaly: >20% above 7-day rolling average

---

### Agent 3: Content Strategy Agent

**Role:** Creates platform-neutral content from Intelligence briefs.
Produces: blog posts, email copy, social captions, ad variants, landing page copy.
Never decides what to publish — only creates.

**Triggers:** Intelligence Agent output (via COO), COO delegation, manual

**Tools (MCP):** Shopify (read product context), web search

**Outputs:** Platform-neutral content JSON → sent directly to Compliance Agent
(this is a fixed pipeline, not routed through COO)

**Content JSON schema:**
```json
{
  "brand_id": "plasmaide",
  "content_pieces": [
    {
      "id": "uuid-generated-by-agent",
      "type": "email | blog | social_caption | ad | landing_page",
      "audience": "professional_athlete | prosumer | wellness",
      "subject": "string (email/blog only)",
      "body_html": "string",
      "body_plain": "string",
      "sequence": "welcome | post_purchase | win_back | standalone",
      "step": 3,
      "platform_format": "short | long",
      "image_brief": "string (description for image sourcing)",
      "seo_keywords": ["string"],
      "compliance_notes": "string (agent's own compliance pre-check notes)"
    }
  ]
}
```

**Approval required:** All content passes through Compliance Agent, then Artifact approval queue

**Memory scope:** Brand voice embeddings, past approved content, tone examples

---

### Agent 4: Campaign Execution Agent

**Role:** Formats approved content for specific platforms and coordinates publishing.
Receives approved content JSON from the approval queue, translates to platform-specific
format, sends execution payload to n8n.

**This agent is stateless.** It does not store or remember anything.

**Triggers:** Artifact approval webhook (content_queue status changed to `approved`)

**Tools (MCP):** Shopify (write: pages/blogs only), Klaviyo (Folle only)

**n8n handles:** DotDigital (Plasmaide), Meta Graph API, TikTok API, LinkedIn API

**Execution payload to n8n:**
```json
{
  "action": "publish_content",
  "brand_id": "plasmaide",
  "platform": "dotdigital | klaviyo | shopify_blog | shopify_page | meta_ig | meta_fb | tiktok | linkedin",
  "content": {
    "subject": "string",
    "body_html": "string",
    "body_plain": "string",
    "metadata": {}
  },
  "schedule": "2026-04-15T08:00:00+10:00",
  "content_queue_id": "uuid (for status callback)",
  "callback_webhook": "https://[supabase-url]/rest/v1/events",
  "retry_config": {
    "max_attempts": 3,
    "backoff_seconds": 30
  }
}
```

**Approval required:** Content already approved upstream. Publish confirmation step in
Artifact before n8n fires (two-step: approve content → confirm publish).

**Memory scope:** None — stateless executor

---

### Agent 5: CFO Agent

**Role:** Financial monitoring, anomaly detection, budget governance.
Monitors actuals vs financial model assumptions.

**Triggers:** Monthly cron (1st of month), threshold breach, COO query

**Tools (MCP):** Xero (read + write with approval gate), Shopify (read: revenue data), Google Sheets (read: model assumptions)

**Also ingests via n8n:** Klaviyo/DotDigital campaign costs, Meta/TikTok/LinkedIn ad spend

**Outputs:**
- Monthly CFO report (to COO)
- Anomaly alerts (to COO → Slack)
- Budget approval requests (to Financial Approval Queue)

**Financial model knowledge:** Plasmaide v2 Excel model assumptions uploaded as
Supabase knowledge (agent_memory table, memory_type = `financial_model`)

**Approval required:** All Xero write operations (invoice updates, journal entries, refunds)

**Financial Approval Queue:** Separate from Content queue in Artifact UI

**Memory scope:** Brand-scoped financial history, model assumptions

---

### Agent 6: Web Designer Agent

**Role:** Site optimisation, landing page creation, CRO suggestions, SEO content.
Operates on **drafts only** — never publishes directly.

**Triggers:** COO delegation, performance data trigger (low conversion flag from Intelligence), manual

**Tools (MCP):** Shopify (pages, blogs, products, metafields, theme — draft mode only)

**Outputs:** Draft page changes for human review in Artifact

**Staging rule:** All Shopify changes created as `status: draft`. Human confirms publish
via Artifact. Shopify Theme API / Liquid changes require additional human review
before deploy — these are flagged as `requires_dev_review: true`.

**Memory scope:** Brand design guidelines, past CRO test results

---

### Agent 7: B2B Outreach Agent

**Role:** Identifies and reaches out to wholesale/B2B prospects.
Targets: sports teams, gyms, training facilities, sports dietitians, athlete agencies.

**Triggers:** COO delegation, manual

**Tools (MCP):** Gmail (draft only — never send), Google Sheets (prospect tracking), web search

**Outputs:** Draft outreach emails for human approval in Content Approval Queue

**Guardrails:**
- Suppression list check (Supabase `b2b_prospects` table, `status = 'suppressed'`)
- Compliance review (all outreach passes through Compliance Agent)
- Human approval before ANY send — no exceptions
- CAN-SPAM / AU Spam Act compliance (unsubscribe, sender identification)

**Memory scope:** Prospect history, outreach outcomes, response patterns

---

### Agent 8: Review Harvester Agent

**Role:** Monitors mentions and reviews, surfaces social proof, suggests responses.
Tightly paired with Customer Service Agent — CS resolution triggers review request.

**Triggers:** CS Agent resolution event (via events table), scheduled monitoring (daily cron)

**Tools (MCP):** Gorgias (read), Shopify (read: product reviews), web search

**Monitors:** Shopify reviews, Google Business, social mentions, forums

**Outputs:**
- Positive reviews → structured testimonial JSON to Content Strategy (via COO)
- Negative reviews → draft response for human approval
- Adverse reactions mentioned in reviews → **immediate** escalation to human (Slack + email)

**Approval required:** All public responses

**Memory scope:** Review sentiment history, response templates

---

### Agent 9: Customer Intelligence Agent

*(Starts as `customer_intelligence` mode of Intelligence Agent. Splits into standalone agent in Phase 5+.)*

**Role:** Customer segmentation, LTV modelling, churn prediction, personalisation.

**Triggers:** Weekly cron (via Intelligence Agent mode), COO query

**Tools (MCP):** Shopify (read: orders, customers), Klaviyo/DotDigital (read: engagement via n8n)

**Privacy rule:** Claude API receives aggregated segment data only — never individual PII.
n8n pre-aggregates customer data into segment summaries before invoking.

**Outputs:** Segment summaries to Intelligence Agent (pre-split) or COO (post-split), churn alerts

**Memory scope:** Segment profiles, cohort history

---

### Agent 10: Performance Analytics Agent

*(Starts as `performance_analytics` mode of Intelligence Agent. Splits into standalone agent in Phase 5+.)*

**Role:** Campaign performance monitoring, ROAS/CAC tracking, attribution analysis.

**Triggers:** Post-campaign launch event (from Campaign Execution), weekly cron, threshold breach

**Tools:** Shopify MCP (read), Klaviyo MCP (read), n8n polling for ad platform data

**Note on TripleWhale:** Currently broken (see Section 15). Stubbed with Shopify + platform-native analytics. When resolved, add TripleWhale API as data source via n8n.

**Outputs:** Performance reports to COO, campaign monitoring briefs

**Memory scope:** Campaign performance history, benchmark data

---

### Agent 11: Compliance & Guardrail Agent

**Role:** Cross-cutting rules enforcement. Every content piece passes through
this agent before reaching the Approval Queue. This is a **synchronous gate**,
not an asynchronous review.

**Triggers:** Direct pipeline from Content Strategy Agent output. Also invoked by
B2B Outreach Agent, CS Agent (for drafted responses), and Web Designer Agent.

**Tools:** None — pure reasoning, no MCP access

**Checks (ordered):**
1. Scope check — Pine Bark Extract only for Plasmaide (no ashwagandha, mushrooms, adaptogens, nootropics)
2. Health claims — no unsubstantiated claims, no medical claims, no diagnosis/treatment language
3. Disclaimers — required disclaimers present per market (TGA, FDA, EFSA, MHRA)
4. Regulatory language — compliant phrasing per jurisdiction
5. Brand voice — consistency with brand guidelines
6. Privacy — GDPR / AU Privacy Act compliance in customer-facing copy
7. Banned phrases — checked against brand-specific banned phrases list (Supabase)

**Output schema:**
```json
{
  "content_id": "uuid",
  "result": "PASS | FAIL | ESCALATE",
  "violations": [
    {
      "check": "health_claims",
      "severity": "critical | warning",
      "location": "body_html, paragraph 3",
      "original": "quoted violating text",
      "suggestion": "compliant alternative",
      "rule_reference": "TGA s.22(5)"
    }
  ],
  "escalation_reason": "string (only if ESCALATE)"
}
```

**Routing:**
- `PASS` → content inserted into `content_queue` with `status = 'pending'`
- `FAIL` → content returned to Content Strategy with violations array. Content Strategy
  regenerates and re-submits. Max 3 regeneration attempts before escalation.
- `ESCALATE` → inserted into `content_queue` with `status = 'escalated'`, human alerted via Slack

**Memory scope:** Brand-specific compliance rules, banned phrases, past violations

---

### Agent 12: Customer Service Agent *(External-facing)*

**Role:** Handles all inbound customer queries across channels.

**Channels:** Gorgias (email, live chat, social DMs — all Shopify-native)

**Triggers:** New Gorgias ticket (via Gorgias webhook → n8n → Claude API)

**Tools (MCP):** Gorgias (read + write), Shopify (read: orders, products, customer)

**Action classes (strict hierarchy):**

| Class | Description | Requires Approval |
|-------|-------------|-------------------|
| `INFORM` | Answer product/science questions, order status | No (pre-approved FAQ class) |
| `DRAFT` | Prepare response for human review | Yes — Content Approval Queue |
| `PROPOSE` | Suggest refund/resolution | Yes — Financial Approval Queue |
| `EXECUTE` | Pre-approved actions only: order status lookup, FAQ | No |
| `ESCALATE` | Immediate human alert | N/A — goes to Slack + email |

**Escalation triggers (immediate, non-negotiable):**
- Adverse reaction reports
- Legal threats
- Refunds over policy threshold (configurable per brand in Config sheet)
- Media/PR enquiries
- Any message mentioning injury, hospitalisation, or medical condition
- Suicide/self-harm mentions (provide crisis resource + escalate)

**Guardrails:**
- Never make medical claims
- Never promise specific health outcomes
- Always recommend consulting healthcare professional for medical queries
- TGA/FDA compliant language only
- All drafted responses pass through Compliance Agent before reaching approval queue
- Log every interaction to Supabase `audit_log`

**Memory scope:** Customer history (via Gorgias + Shopify), FAQ knowledge base (agent_memory)

---

## 6. DATA LAYER

### Supabase Schema

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- BRANDS (core identity table)
-- ============================================================
CREATE TABLE brands (
  brand_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'paused', 'archived')),
  industry TEXT,
  base_locale TEXT DEFAULT 'en-AU',
  logo_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EVENTS (canonical event log — append-only)
-- ============================================================
CREATE TABLE events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  event_type TEXT NOT NULL,
  -- Canonical event types:
  --   content_created, content_compliance_pass, content_compliance_fail,
  --   content_approved, content_rejected, content_published, content_failed,
  --   campaign_sent, campaign_completed,
  --   customer_created, ticket_opened, ticket_resolved,
  --   purchase_made, refund_issued, refund_approved, refund_rejected,
  --   agent_triggered, agent_completed, agent_failure,
  --   threshold_breached, approval_given, approval_rejected,
  --   compliance_fail, compliance_escalation,
  --   financial_approved, financial_rejected,
  --   b2b_outreach_sent, review_harvested
  source TEXT NOT NULL,
  -- Source systems: shopify, klaviyo, dotdigital, gorgias, xero,
  --   n8n, artifact, coo, content_strategy, compliance, cfo,
  --   cs_agent, campaign_exec, web_designer, b2b_outreach,
  --   review_harvester, intelligence
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_events_brand_type ON events (brand_id, event_type);
CREATE INDEX idx_events_created ON events (created_at DESC);
CREATE INDEX idx_events_source ON events (source);

-- ============================================================
-- CONTENT QUEUE
-- ============================================================
CREATE TABLE content_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  content_type TEXT NOT NULL CHECK (content_type IN (
    'email', 'blog', 'social_caption', 'ad', 'landing_page',
    'b2b_email', 'cs_response', 'review_response'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'compliance_check', 'compliance_fail',
    'escalated', 'approved', 'rejected',
    'publish_pending', 'published', 'failed'
  )),
  content JSONB NOT NULL,
  compliance_result JSONB,
  platform TEXT,
  audience TEXT,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_content_queue_brand_status ON content_queue (brand_id, status);
CREATE INDEX idx_content_queue_created ON content_queue (created_at DESC);

-- ============================================================
-- FINANCIAL QUEUE (separate from content — different approvers)
-- ============================================================
CREATE TABLE financial_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'budget_reallocation', 'xero_journal', 'refund_approval',
    'invoice_update', 'spend_pause', 'spend_increase'
  )),
  status TEXT DEFAULT 'pending' CHECK (status IN (
    'pending', 'approved', 'rejected', 'executed', 'failed'
  )),
  details JSONB NOT NULL,
  amount_aud DECIMAL,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_financial_queue_brand_status ON financial_queue (brand_id, status);

-- ============================================================
-- AUDIT LOG (every agent action)
-- ============================================================
CREATE TABLE audit_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  agent TEXT NOT NULL,
  action TEXT NOT NULL,
  tool_called TEXT,
  input_summary TEXT,
  output_summary TEXT,
  tokens_in INTEGER,
  tokens_out INTEGER,
  latency_ms INTEGER,
  status TEXT CHECK (status IN ('success', 'failure', 'escalated')),
  error_message TEXT,
  human_override BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_log_brand_agent ON audit_log (brand_id, agent);
CREATE INDEX idx_audit_log_created ON audit_log (created_at DESC);

-- ============================================================
-- AGENT MEMORY (pgvector semantic storage)
-- ============================================================
CREATE TABLE agent_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  agent TEXT NOT NULL,
  memory_type TEXT NOT NULL CHECK (memory_type IN (
    'campaign_outcome', 'customer_segment', 'brand_learning',
    'tone_preference', 'compliance_pattern', 'brand_voice_example',
    'product_knowledge', 'financial_model', 'cro_test_result',
    'outreach_pattern', 'cs_resolution_pattern', 'faq_knowledge',
    'review_sentiment', 'market_research'
  )),
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_memory_brand_agent ON agent_memory (brand_id, agent);
CREATE INDEX idx_agent_memory_type ON agent_memory (memory_type);
CREATE INDEX idx_agent_memory_embedding ON agent_memory
  USING hnsw (embedding vector_cosine_ops);

-- ============================================================
-- CUSTOMER IDENTITY (unified cross-platform IDs)
-- ============================================================
CREATE TABLE customer_identity (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  customer_id TEXT NOT NULL,
  shopify_customer_id TEXT,
  klaviyo_profile_id TEXT,
  dotdigital_contact_id TEXT,
  gorgias_customer_id TEXT,
  segment TEXT CHECK (segment IN (
    'professional_athlete', 'prosumer', 'wellness', 'at_risk'
  )),
  ltv_estimate DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, customer_id)
);

CREATE INDEX idx_customer_identity_brand ON customer_identity (brand_id);
CREATE INDEX idx_customer_identity_segment ON customer_identity (brand_id, segment);

-- ============================================================
-- B2B PROSPECTS (for B2B Outreach Agent)
-- ============================================================
CREATE TABLE b2b_prospects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL REFERENCES brands(brand_id),
  company_name TEXT NOT NULL,
  contact_name TEXT,
  contact_email TEXT,
  category TEXT,
  status TEXT DEFAULT 'identified' CHECK (status IN (
    'identified', 'researched', 'outreach_drafted', 'outreach_sent',
    'responded', 'meeting_booked', 'converted', 'suppressed', 'dead'
  )),
  outreach_history JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_b2b_prospects_brand_status ON b2b_prospects (brand_id, status);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- RLS ensures brand isolation at the database level.
-- Dashboard users are scoped to their brand(s) via Supabase Auth metadata.
-- Service role (n8n) bypasses RLS.

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_prospects ENABLE ROW LEVEL SECURITY;

-- Policy pattern (apply to each table above):
-- Dashboard users see only their brand(s)
CREATE POLICY brand_isolation ON events
  FOR ALL
  USING (brand_id = ANY(
    string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    )
  ));

-- Repeat for each table. n8n uses service_role key (bypasses RLS).
```

### Embedding Strategy

- **Model:** OpenAI `text-embedding-3-small` (1536 dimensions, cosine similarity)
- **Rationale:** Cost-efficient, well-supported by Supabase pgvector, high quality for retrieval
- **Alternative:** Supabase Edge Functions with built-in embedding (evaluate during Phase 4)
- **Retrieval pattern:**
  ```
  Agent needs context
    → n8n calls Supabase RPC function for semantic search
    → filter by brand_id + agent + memory_type
    → top-k results (k=5 default) injected as context in Claude API call
  ```

### Google Sheets Structure (config only — 4 tabs)

```
Tab 1: Brands
  brand_id | name | status | created | logo_url

Tab 2: Config
  brand_id | setting | value | updated_at
  -- Settings:
  --   shopify_store, email_platform, xero_tenant_id,
  --   min_roas, max_cac, spend_anomaly_pct,
  --   report_day, report_time, report_timezone,
  --   alert_email, slack_channel,
  --   shopify_markets, base_locale,
  --   cs_platform, gorgias_domain,
  --   refund_threshold_aud, b2b_daily_outreach_limit

Tab 3: Alert Log
  brand_id | timestamp | alert_type | severity | value | threshold | resolved | resolved_at

Tab 4: Prompt Registry
  agent | prompt_name | version | last_updated | sha256_hash | status
  -- Status: live | test | deprecated
```

### Default Config — Plasmaide

```
shopify_store:          plasmaide.myshopify.com
email_platform:         dotdigital
xero_tenant_id:         [from Xero]
min_roas:               2.0
max_cac:                40
spend_anomaly_pct:      20
report_day:             Monday
report_time:            08:00
report_timezone:        Australia/Brisbane
alert_email:            carl@plasmaide.com
slack_channel:          #plasmaide-coo
shopify_markets:        AU,GB,US,EU
base_locale:            en-AU
cs_platform:            gorgias
refund_threshold_aud:   100
b2b_daily_outreach_limit: 10
```

---

## 7. APPROVAL FLOWS

### Content Approval Flow

```
Content Strategy Agent creates content
  │
  ▼
Compliance & Guardrail Agent (synchronous gate)
  │
  ├─ FAIL → returned to Content Strategy with violations
  │         Content Strategy regenerates (max 3 attempts)
  │         After 3 fails → ESCALATE
  │
  ├─ ESCALATE → content_queue (status = 'escalated')
  │             Slack alert to human
  │
  └─ PASS → content_queue (status = 'pending')
            │
            ▼
      Artifact: Content Approval UI
            │
            ├─ REJECT → content_queue (status = 'rejected')
            │           Event logged. Archived.
            │
            ├─ EDIT → inline Claude API call with edit instruction
            │         Re-enters Compliance check
            │
            └─ APPROVE → content_queue (status = 'approved')
                         │
                         ▼
                   Campaign Execution Agent formats for platform
                         │
                         ▼
                   n8n creates DRAFT on target platform
                         │
                         ▼
                   Artifact: Publish Confirmation UI
                         │
                         ├─ CANCEL → content_queue (status = 'rejected')
                         │
                         └─ CONFIRM → n8n publishes/activates
                                      content_queue (status = 'published')
                                      Event logged to Supabase
```

### Financial Approval Flow

```
CFO Agent detects anomaly or suggests action
  │
  ▼
financial_queue (status = 'pending')
  │
  ▼
Artifact: Financial Approval UI
  │
  ├─ REJECT → financial_queue (status = 'rejected')
  │           Event logged.
  │
  ├─ REQUEST DETAIL → COO re-invokes CFO for more analysis
  │
  └─ APPROVE → financial_queue (status = 'approved')
               n8n webhook fired
               n8n executes via Xero API / ad platform API
               financial_queue (status = 'executed')
               Event logged to Supabase
```

### Customer Service Response Flow

```
New Gorgias ticket
  │
  ▼
n8n receives webhook → assembles context → invokes CS Agent
  │
  ▼
CS Agent classifies action class
  │
  ├─ INFORM → CS Agent responds directly via Gorgias (pre-approved FAQ)
  │           Logged to audit_log
  │
  ├─ EXECUTE → Pre-approved action only (order status lookup)
  │            Logged to audit_log
  │
  ├─ DRAFT → Response passes through Compliance Agent
  │          → content_queue (type = 'cs_response', status = 'pending')
  │          → Human approves in Artifact → Gorgias response sent
  │
  ├─ PROPOSE → Resolution proposal
  │            → financial_queue (status = 'pending')
  │            → Human approves → n8n executes refund/resolution
  │
  └─ ESCALATE → Immediate Slack alert + email to alert_email
                Ticket tagged in Gorgias as 'escalated'
                Event logged
```

---

## 8. n8n EXECUTION CONTRACT

### Core rule

Agents output structured JSON. n8n receives via webhook and executes.
n8n **never** reasons. n8n **never** decides. n8n retries on failure.

### Standard payload structure (agent → n8n)

```json
{
  "action": "string (verb_noun format: publish_content, send_email, create_draft, etc.)",
  "brand_id": "string",
  "platform": "string (dotdigital | klaviyo | shopify_blog | shopify_page | meta_ig | meta_fb | tiktok | linkedin | gorgias | xero)",
  "priority": "normal | urgent",
  "payload": {
    "// platform-specific data"
  },
  "source_queue_id": "uuid (content_queue or financial_queue ID for status updates)",
  "source_queue_table": "content_queue | financial_queue",
  "callback_webhook": "https://[supabase-url]/rest/v1/events",
  "retry_config": {
    "max_attempts": 3,
    "backoff_seconds": 30
  }
}
```

### Standard callback structure (n8n → Supabase)

On completion (success or final failure), n8n POSTs to Supabase:
```json
{
  "brand_id": "string",
  "event_type": "content_published | content_failed | campaign_sent | financial_executed | ...",
  "source": "n8n",
  "payload": {
    "action": "original action",
    "platform": "original platform",
    "status": "success | failure",
    "error": "string (if failure)",
    "platform_response": {},
    "source_queue_id": "uuid",
    "source_queue_table": "string"
  }
}
```

n8n also updates the source queue record status (e.g., `content_queue.status = 'published'`
or `'failed'`).

### n8n workflow naming convention

`[brand_id]-[function]-[version]`

Examples:
- `plasmaide-email-publish-v1`
- `plasmaide-social-publish-v1`
- `plasmaide-cs-ticket-handler-v1`
- `plasmaide-coo-weekly-report-v1`
- `global-threshold-poller-v1` (brand-agnostic scheduler)

### n8n responsibilities (exhaustive list)

| Responsibility | Details |
|---------------|---------|
| DotDigital API calls | Plasmaide email send/schedule |
| Meta Graph API | Instagram + Facebook posting |
| TikTok API | TikTok posting |
| LinkedIn API | LinkedIn posting |
| Cron scheduling | Reads Config sheet for schedule, fires agent invocations |
| Threshold polling | Reads Config sheet for thresholds, checks Shopify/Xero, fires COO if breach |
| Error handling | Retry with backoff per retry_config |
| Status callbacks | POST to Supabase events + update queue statuses |
| Gorgias webhook receiver | Routes new tickets to CS Agent invocation |
| WhatsApp inbound | Routes inbound messages to COO Agent (Phase 5) |
| Ad spend aggregation | Polls Meta/TikTok/LinkedIn for spend data, writes to Supabase for CFO |
| PII aggregation | Pre-aggregates customer data into segments before Intelligence invocation |

### n8n does NOT

- Make decisions about content, routing, or priority
- Store business logic or branching conditions beyond "if platform = X, use X node"
- Hold state between executions (stateless — all context from payload)
- Access Claude API directly for reasoning (only for agent invocation with full payload)

---

## 9. MULTI-BRAND ARCHITECTURE

### Brand isolation rules

1. Every Supabase row has `brand_id` (enforced by RLS)
2. Every n8n workflow reads brand config at runtime from Config sheet
3. Every Claude API call includes brand context in system prompt
4. Every MCP operation scoped to brand's credentials (n8n credential store)
5. Dashboard users see only their brand(s) (Supabase Auth metadata)

### Adding a new brand (zero code change)

1. Add row to `brands` table in Supabase
2. Add row to Brands sheet in Google Sheets
3. Add config rows to Config sheet (copy Plasmaide defaults, modify)
4. Add platform credentials to n8n credential store
5. Upload brand knowledge to Supabase `agent_memory` (guidelines, product info, compliance rules)
6. Configure Gorgias inbox for brand
7. Create brand-specific agent prompts in `/agents/[brand]/` (or use defaults with brand context injection)
8. Add `brand_ids` to user's Supabase Auth metadata for dashboard access

### Platform routing (n8n config-driven, zero code)

```
Config: email_platform = dotdigital  → n8n uses DotDigital nodes
Config: email_platform = klaviyo     → n8n uses Klaviyo MCP
Config: shopify_store = [domain]     → Shopify MCP scoped to that store's credential
Config: cs_platform = gorgias       → Gorgias MCP scoped to that brand's inbox
```

---

## 10. SECURITY MODEL

### Credential management

| Storage | What goes here |
|---------|---------------|
| n8n credential store | ALL API keys, tokens, OAuth credentials, service accounts |
| `.env.local` (Vercel) | Supabase URL, anon key, service role key |
| Google Sheets | Non-sensitive config values ONLY |
| Supabase | No credentials stored. Service role key used by n8n only. |
| Git repo | NO secrets. `.env.local` in `.gitignore` |

### MCP permissions matrix (least privilege)

| Agent | MCP Access | Scope |
|-------|-----------|-------|
| COO | Xero, Sheets, Slack, Gmail, n8n | Xero: **read only**. Gmail: Phase 4+. |
| Intelligence | Shopify, web search | Read only. Klaviyo read via n8n. |
| Content Strategy | Shopify, web search | Read only (product context). |
| Compliance | **None** | Pure reasoning. No external access. |
| Campaign Execution | Shopify, Klaviyo | Shopify: write pages/blogs. Klaviyo: Folle only. |
| CFO | Xero, Shopify, Sheets | Xero: read + write **with approval gate**. Shopify: read. |
| Web Designer | Shopify | Write **drafts only**. Theme changes flagged for dev review. |
| B2B Outreach | Gmail, Sheets, web search | Gmail: **draft only, never send**. |
| Review Harvester | Gorgias, Shopify, web search | **Read only**. |
| CS Agent | Gorgias, Shopify | Gorgias: read + write. Shopify: read. |
| Customer Intelligence | Shopify | Read only. Receives pre-aggregated data. |
| Performance Analytics | Shopify | Read only. |

### Sensitive action gates

These **always** require human approval before execution, regardless of agent confidence:

- Any Xero write operation (journal, invoice, payment)
- Campaign launch (activate from draft)
- Store page/product publish (draft → live)
- Refund processing (any amount)
- Any B2B outreach email send
- Adverse reaction escalation response
- Customer-facing content publish (any channel)
- Budget reallocation
- Theme/Liquid code deployment

### Data privacy rules

- Claude API **never** receives individual customer PII in prompts
- Customer Intelligence receives aggregated segment data only (n8n pre-aggregates)
- All Gorgias conversations logged to `audit_log` (summaries, not full transcripts)
- GDPR / AU Privacy Act: customer data is brand-scoped, never cross-brand
- Customer deletion requests: process via Gorgias → Shopify → purge from `customer_identity`
- No customer data stored in Google Sheets

---

## 11. OBSERVABILITY

### Audit log (`audit_log` table)

Every agent invocation logs:

| Field | Description |
|-------|-------------|
| `agent` | Agent name (e.g., `content_strategy`) |
| `action` | What was done (e.g., `generate_blog_post`) |
| `tool_called` | MCP tool invoked (if any) |
| `input_summary` | Summary of input (NOT full prompt — summary only, max 500 chars) |
| `output_summary` | Summary of output (max 500 chars) |
| `tokens_in` | Input tokens consumed |
| `tokens_out` | Output tokens generated |
| `latency_ms` | End-to-end invocation time |
| `status` | `success`, `failure`, `escalated` |
| `error_message` | Error details (if failure) |
| `human_override` | Whether a human modified the agent's output |

### Event log (`events` table)

Every business event logs:

| Field | Description |
|-------|-------------|
| `event_type` | Canonical type (see schema for full list) |
| `brand_id` | Brand scope |
| `source` | System that generated the event |
| `payload` | Full event data (JSONB) |

### Dashboard observability panels (Vercel app)

- Token usage per agent per day (line chart)
- Cost estimate per agent per day (derived from token counts)
- Latency per agent (p50, p95, p99)
- Approval queue depth (content + financial, bar chart)
- Failure rate per agent (last 7d, 30d)
- Human override frequency per agent
- Content pipeline throughput (created → published, funnel)
- Event log stream (filterable by type, source, brand)

---

## 12. VECTOR MEMORY (Supabase pgvector)

### What gets embedded and stored

```
Brand Knowledge (per brand):
├── Brand voice examples (approved content samples)
├── Product knowledge (Pine Bark Extract science, benefits, usage)
├── Compliance rules and violation examples
├── Past campaign briefs and outcomes
├── Customer segment profiles
└── Financial model assumptions

Agent-Specific Memory (per agent per brand):
├── campaign_outcome      → Intelligence / Performance Analytics
├── tone_preference       → Content Strategy
├── brand_voice_example   → Content Strategy
├── compliance_pattern    → Compliance Agent
├── outreach_pattern      → B2B Outreach
├── cs_resolution_pattern → Customer Service
├── cro_test_result       → Web Designer
├── review_sentiment      → Review Harvester
├── market_research       → Intelligence
├── faq_knowledge         → Customer Service
└── financial_model       → CFO
```

### Memory lifecycle

1. **Write:** After successful agent invocation, n8n calls embedding API →
   writes to `agent_memory` with `brand_id`, `agent`, `memory_type`, content, embedding
2. **Read:** Before agent invocation, n8n calls Supabase RPC for semantic search →
   top-k results (k=5) injected as `memory_context` in the Claude API call
3. **Prune:** Monthly cron removes memories older than 12 months with low retrieval count
   (tracked via `metadata.retrieval_count`)

### Supabase RPC function for retrieval

```sql
CREATE OR REPLACE FUNCTION match_agent_memory(
  query_embedding vector(1536),
  match_brand_id TEXT,
  match_agent TEXT,
  match_memory_type TEXT DEFAULT NULL,
  match_count INTEGER DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  memory_type TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.content,
    am.memory_type,
    am.metadata,
    1 - (am.embedding <=> query_embedding) AS similarity
  FROM agent_memory am
  WHERE am.brand_id = match_brand_id
    AND am.agent = match_agent
    AND (match_memory_type IS NULL OR am.memory_type = match_memory_type)
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

---

## 13. DASHBOARD SPEC (Vercel App)

### Tech stack

- **Next.js 14** (App Router) + React + Tailwind CSS
- **Supabase JS client** (real-time subscriptions for queues and events)
- **Supabase Auth** (email/password + Google OAuth)
- **Hosted on Vercel** (auto-deploy from `main` branch)
- **Domain:** `dashboard.plasmaide.com` (single multi-brand dashboard with brand selector)

### Authentication & authorisation

- Users log in via Supabase Auth
- `user_metadata.brand_ids` controls which brands a user can see
- RLS policies enforce brand isolation at the database level
- Carl and Steve: access to all brands
- Future: role-based access (admin, approver, viewer)

### Navigation structure

```
[Brand Selector Dropdown]  ← switches all data/context
├── 🏠 Dashboard
│   ├── KPI cards: ROAS, CAC, revenue, spend (live from Supabase)
│   ├── Active campaigns (list)
│   ├── Content queue depth (count by status)
│   └── Active alerts (from Alert Log)
├── 📋 Approval Queues
│   ├── Content Approvals (content_queue WHERE status = 'pending')
│   └── Financial Approvals (financial_queue WHERE status = 'pending')
├── 📊 Performance
│   ├── Campaign metrics (from events)
│   ├── Email metrics (from events)
│   ├── CS metrics (ticket volume, resolution time, CSAT)
│   └── Agent health (from audit_log)
├── 🎙️ COO Interface
│   ├── Text input (sends to COO Agent via webhook)
│   └── Voice (ElevenLabs — Phase 5)
└── ⚙️ Settings
    ├── Brand profile (name, logo, industry)
    ├── Integrations (connection status + masked credentials)
    ├── Alert thresholds (min_roas, max_cac, etc.)
    ├── Reporting schedule (day, time, timezone)
    ├── Content guardrails (compliance rules text)
    ├── Brand voice (upload examples → embedded to agent_memory)
    └── COO channel preferences (Slack + Artifact for Phase 1)
```

### Content Approval UI (per item)

```
┌──────────────────────────────────────────────────┐
│ [Content type badge]  [Audience badge]           │
│ [Platform destination]                           │
│                                                  │
│ ┌──────────────────────────────────────────────┐ │
│ │ Preview (rendered as it will appear)         │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Compliance: ✅ PASS (or details of violations)   │
│                                                  │
│ [✅ Approve]  [✏️ Edit]  [❌ Reject]             │
│                                                  │
│ On Approve:                                      │
│ ┌──────────────────────────────────────────────┐ │
│ │ Confirm publish to [platform] on [date]?     │ │
│ │ [Confirm] [Cancel]                           │ │
│ └──────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────┘
```

Edit flow: clicking Edit opens inline editor → on save, content is re-sent through
Compliance Agent → if PASS, returns to approval queue with `edited: true` flag.

### Financial Approval UI (per item)

```
┌──────────────────────────────────────────────────┐
│ [Action type]  [Amount: $X AUD]                  │
│                                                  │
│ Rationale: [CFO Agent's analysis]                │
│ Current state: [e.g., current budget allocation] │
│ Proposed state: [e.g., new allocation]           │
│ Risk assessment: [from CFO Agent]                │
│                                                  │
│ [✅ Approve]  [❌ Reject]  [🔍 Request Detail]   │
└──────────────────────────────────────────────────┘
```

### Settings — Security rules

- API keys displayed as masked (last 4 chars only) in dashboard
- Keys written to n8n credential store via n8n API on save
- Never stored in Supabase or readable from dashboard after save
- `[Test Connection]` button validates credential before saving
- Connection status indicators: 🟢 Connected | 🔴 Error | ⚪ Not configured

---

## 14. BRAND-SPECIFIC KNOWLEDGE

### Plasmaide

| Attribute | Value |
|-----------|-------|
| **Product** | Pine Bark Extract supplement, 2×14-pack sachet format |
| **Purpose** | Boost nitric oxide production for athletes |
| **Benefits** | Endurance, oxygen flow, muscle recovery |
| **Usage** | Pre/post-exercise or daily wellness |
| **Testing** | Banned substance tested for professional athletes |
| **Markets** | ANZ, UK, US, EU (single Shopify store + Shopify Markets) |
| **Shopify domain** | `plasmaide.myshopify.com` (primary), `plasmaide-uk.myshopify.com` (UK) |
| **Compliance** | TGA (AU), MHRA (UK), FDA (US), EFSA (EU) |
| **Key athlete** | Kristian Blummenfelt (Ironman 70.3) |
| **Email platform** | DotDigital |
| **Existing sequences** | Welcome, post-purchase, win-back (set up in DotDigital) |
| **Financial model** | Plasmaide v2 (3-way P&L/BS/CF, 5 AU FYs to June 2030, DTC + Wholesale + Retail, monthly, per-country wholesale) |
| **Retail launch toggle** | July 2028 (month 37, dynamic) |

**Target audiences:**
- **Professional Athletes** — elite, sponsored, performance-focused, high AOV
- **Prosumers** — serious enthusiasts, semi-professional, research-driven, community-influenced
- **General Wellness** — health-conscious, daily use, lifestyle buyers

**Content guardrails (non-negotiable):**
- Pine Bark Extract benefits ONLY — never mention other adaptogens (ashwagandha, mushrooms, lion's mane, rhodiola, etc.)
- No unsubstantiated health claims
- No medical claims (no "treats", "cures", "prevents" disease)
- No diagnosis or treatment language
- Mandatory human approval before any public content
- Required disclaimer on all marketing materials (market-specific TGA/FDA/MHRA/EFSA language)
- "Always consult your healthcare professional" on any content touching health outcomes

### Folle

| Attribute | Value |
|-----------|-------|
| **Product** | FMCG (details TBC) |
| **Launch** | January 2027 |
| **Email platform** | Klaviyo |
| **Financial model** | Folle generic model (calendar year from Jan 2027) |
| **Status** | Pre-launch. Brand knowledge to be uploaded when available. |

---

## 15. KNOWN ISSUES AND WORKAROUNDS

### TripleWhale API

- **Status:** Broken — persistent 400 errors on all Data Out endpoints
- **Support ticket:** Trace ID `b99527300c65f3b2111765a8eb71e9a5`
- **Workaround:** Stub with Shopify + platform-native analytics (Meta, TikTok, LinkedIn)
- **Action required:** Rotate both TripleWhale API keys (exposed in previous Claude session)
- **Impact:** Performance Analytics Agent operates without TripleWhale data until resolved

### DotDigital Wait Node (n8n)

- **Status:** n8n loses execution context after webhook resume in Wait nodes
- **Root cause:** `$('NodeName').item.json` references, Set nodes, and Code nodes all
  fail to access pre-Wait data after webhook resume
- **Fix:** Store content in Supabase before Wait node, read back after resume.
  Or split into two workflows passing data via webhook payload.
- **Architecture note:** The Supabase-first design in AGOS avoids this issue entirely —
  all data lives in Supabase, n8n references queue IDs not in-memory data.

### WhatsApp HITL (outbound)

- **Status:** Blocked by Meta message template requirement
- **Root cause:** Meta requires pre-approved message templates for outbound WhatsApp.
  Template `content_published` needs creation in Meta Business → WhatsApp → Message Templates.
- **Workaround:** WhatsApp inbound only (user messages COO). Outbound alerts → Slack or Gmail.
- **Phase:** Deferred to Phase 5.

### n8n API Manipulation

- Use `javascript_exec` in browser tab — sandbox cannot reach n8n.cloud due to proxy
- Prefer API-first manipulation: fetch workflow → modify nodes array → PUT full payload
- Always include in PUT: `name`, `nodes`, `connections`, `settings: { executionOrder: 'v1' }`
- When renaming nodes: sync connection references with `JSON.stringify(wf.connections).replace(/OldName/g, 'NewName')`
- PowerShell: use `$body` variable for JSON payloads; use `curl.exe` (not `curl` alias)
- Always do hard refresh (`Cmd+Shift+R`) after saves to confirm state

---

## 16. BUILD PHASES

### Phase 1 — Foundation (START HERE)

**Goal:** Multi-brand data layer + dashboard shell + settings + auth

**Deliverables:**
- [ ] Supabase project created
- [ ] Full schema applied (Section 6) including all tables, indexes, RLS policies
- [ ] pgvector extension enabled
- [ ] `match_agent_memory` RPC function created
- [ ] Supabase Auth configured (email/password + Google OAuth)
- [ ] Google Sheets created (4 tabs per Section 6)
- [ ] Plasmaide brand added to Brands sheet and `brands` table
- [ ] Plasmaide config rows added to Config sheet
- [ ] Next.js + Tailwind dashboard scaffolded
- [ ] Supabase Auth integration (login page, protected routes)
- [ ] Brand selector dropdown (reads `brands` table)
- [ ] Settings page (reads/writes Config sheet via Sheets MCP)
  - Brand profile
  - Integration config (masked tokens → n8n credential store)
  - Alert thresholds
  - Reporting schedule + timezone
  - Content guardrails text
  - COO channel preferences (Slack + Artifact only)
- [ ] Supabase client connected (real-time subscriptions)
- [ ] Vercel deployment configured (auto-deploy from `main`)
- [ ] n8n MCP connected for workflow management
- [ ] Empty Approval Queue pages (UI shell, no data yet)

**Not in Phase 1:**
- No agent invocations
- No content generation
- No MCP calls beyond Sheets + Supabase setup
- No n8n workflow creation (beyond testing connectivity)

**Exit criteria:** Dashboard loads, user can log in, select Plasmaide, view/edit settings,
see empty queues. Supabase schema is complete and RLS is enforced.

---

### Phase 2 — Content Engine

**Goal:** Content generation → compliance → approval → publishing pipeline

**Prerequisites:** Phase 1 complete (Supabase schema, dashboard, auth)

**Deliverables:**
- [ ] Content Strategy Agent system prompt (`/agents/content-strategy.md`)
  - Plasmaide product context + guardrails baked in
  - Output schema matches Section 5 content JSON
- [ ] Compliance & Guardrail Agent system prompt (`/agents/compliance.md`)
  - All compliance rules from Section 5, Agent 11
  - Output schema matches Section 5 compliance output
- [ ] n8n workflow: `plasmaide-content-generate-v1`
  - Cron trigger (configurable) → invokes Content Strategy → pipes to Compliance
  - Writes result to `content_queue`
  - Logs to `audit_log`
- [ ] Content Approval Queue UI in dashboard
  - Real-time subscription to `content_queue` WHERE `status = 'pending'`
  - Preview per content type
  - Approve / Edit / Reject flow
  - Edit → inline Claude API regeneration → re-compliance check
- [ ] Publish Confirmation UI (second approval step)
- [ ] n8n workflow: `plasmaide-email-publish-v1` (approved content → DotDigital)
- [ ] n8n workflow: `plasmaide-blog-publish-v1` (approved content → Shopify blog/pages)
- [ ] Event logging to Supabase on every status change
- [ ] Prompt Registry entries for content-strategy and compliance agents
- [ ] Brand voice examples uploaded to `agent_memory` (memory_type = 'brand_voice_example')

**Not in Phase 2:**
- No social media publishing (Meta, TikTok, LinkedIn — Phase 3 or later)
- No Intelligence Agent (Content Strategy uses manual briefs or COO delegation)
- No CFO, CS, or other agents

**Dependency note:** Content Strategy Agent operates without Intelligence Agent in Phase 2.
Content briefs are manually provided via COO delegation or the dashboard COO interface.
This is intentional — get the content pipeline solid before adding the intelligence layer.

**Exit criteria:** Content can be generated, compliance-checked, approved, and published
to DotDigital and Shopify blog from the dashboard. Full audit trail in Supabase.

---

### Phase 3 — Customer Service + Social Publishing + Web Designer

**Goal:** Gorgias CS live, social media publishing, site optimisation drafts

**Prerequisites:** Phase 2 complete (content pipeline working)

**Deliverables:**
- [ ] Customer Service Agent system prompt (`/agents/customer-service.md`)
  - Gorgias MCP connected
  - Shopify MCP connected (read)
  - Full compliance + escalation rules
  - Action classes: INFORM / DRAFT / PROPOSE / EXECUTE / ESCALATE
- [ ] n8n workflow: `plasmaide-cs-ticket-handler-v1` (Gorgias webhook → CS Agent)
- [ ] CS response approval flow in dashboard (content_queue type = 'cs_response')
- [ ] Review Harvester Agent system prompt (`/agents/review-harvester.md`)
  - Paired with CS Agent (resolution events trigger review requests)
  - Daily cron for external review monitoring
- [ ] Web Designer Agent system prompt (`/agents/web-designer.md`)
  - Shopify MCP (draft mode only)
  - CRO and landing page optimisation
  - Draft approval in dashboard
- [ ] n8n workflow: `plasmaide-social-publish-v1` (Meta, TikTok, LinkedIn)
- [ ] Social media content types added to content pipeline
- [ ] Campaign Execution Agent system prompt (`/agents/campaign-execution.md`)

**Exit criteria:** CS tickets auto-triaged, responses drafted for approval. Social media
content publishes through approval pipeline. Web Designer produces drafts.

---

### Phase 4 — Intelligence + Full Compliance + Observability

**Goal:** Data-driven intelligence loop running, full observability

**Prerequisites:** Phase 3 complete (CS, social, web designer operational)

**Deliverables:**
- [ ] Intelligence Agent system prompt (`/agents/intelligence.md`)
  - Three modes operational (market_research, performance_analytics, customer_intelligence)
  - Memory reads/writes to Supabase pgvector
- [ ] n8n workflows for Intelligence invocation (weekly cron, threshold-triggered)
- [ ] Intelligence → Content Strategy pipeline (market_research mode feeds content briefs)
- [ ] Compliance Agent enhanced to standalone reusable service
  - All agents that generate content route through it
  - Violation logging to Supabase
- [ ] Observability dashboard panels (Section 11)
  - Token/cost tracking
  - Agent health metrics
  - Event log stream
- [ ] Gmail interface for COO
- [ ] Prompt Registry fully populated and version-tracked

**Exit criteria:** Intelligence Agent feeds Content Strategy with data-driven briefs.
Observability dashboard shows agent health, costs, and event stream.

---

### Phase 5 — COO + CFO + Voice

**Goal:** Full orchestration + financial governance + voice interface

**Prerequisites:** Phase 4 complete (intelligence loop running)

**Deliverables:**
- [ ] COO Agent system prompt (`/agents/coo.md`) — full orchestration
  - All interface channels active (Slack, Gmail, WhatsApp inbound, Voice)
  - Threshold monitoring live (n8n polls → COO decides)
  - Weekly report automation
  - Delegation routing to all agents
- [ ] CFO Agent system prompt (`/agents/cfo.md`)
  - Xero MCP connected
  - Shopify revenue feed
  - Ad spend feed via n8n
  - Financial Approval Queue live in dashboard
  - Monthly CFO report automation
- [ ] ElevenLabs MCP + voice interface in dashboard
- [ ] WhatsApp inbound routing via n8n → COO Agent
- [ ] Financial Approval Queue UI fully operational

**Exit criteria:** COO orchestrates all agents. CFO monitors financials with approval gates.
Voice interface functional.

---

### Phase 6 — Growth Agents + Multi-Brand

**Goal:** B2B pipeline + intelligence split + Folle onboarded

**Prerequisites:** Phase 5 complete (full orchestration running)

**Deliverables:**
- [ ] B2B Outreach Agent system prompt (`/agents/b2b-outreach.md`)
  - Suppression list (b2b_prospects table)
  - Compliance gates (all outreach through Compliance Agent)
  - Full approval workflow
  - Gmail draft → human approval → send
- [ ] Intelligence Agent split:
  - Market Research Agent (standalone)
  - Customer Intelligence Agent (standalone, Agent 9)
  - Performance Analytics Agent (standalone, Agent 10)
- [ ] Folle brand onboarded
  - Brand row in Supabase + Sheets
  - Klaviyo credentials in n8n
  - Brand knowledge uploaded to agent_memory
  - Folle-specific compliance rules configured
- [ ] Full observability dashboard (all panels from Section 11)

**Exit criteria:** All 12 agents operational independently. Folle runs on same stack.
B2B pipeline generating qualified prospects.

---

## 17. CONVENTIONS

### File structure

```
/
├── CLAUDE.md                    ← THIS FILE — always up to date
├── /app                         ← Next.js dashboard (Vercel)
│   ├── /app                     ← App Router pages
│   │   ├── layout.tsx
│   │   ├── page.tsx             ← Dashboard home
│   │   ├── /login
│   │   ├── /approvals
│   │   │   ├── /content
│   │   │   └── /financial
│   │   ├── /performance
│   │   ├── /coo
│   │   └── /settings
│   ├── /components
│   │   ├── BrandSelector.tsx
│   │   ├── ContentApprovalCard.tsx
│   │   ├── FinancialApprovalCard.tsx
│   │   ├── PublishConfirmation.tsx
│   │   ├── KPICards.tsx
│   │   ├── EventStream.tsx
│   │   └── AgentHealth.tsx
│   ├── /lib
│   │   ├── supabase.ts          ← Supabase client + auth helpers
│   │   ├── sheets.ts            ← Google Sheets config reads
│   │   └── webhooks.ts          ← n8n webhook helpers
│   └── /types
│       └── index.ts             ← TypeScript types matching Supabase schema
├── /agents                      ← Agent system prompts (canonical source)
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
│   └── /brand-overrides         ← Brand-specific prompt additions
│       ├── plasmaide.md
│       └── folle.md
├── /supabase
│   ├── schema.sql               ← Full schema (matches Section 6)
│   ├── functions.sql            ← RPC functions (match_agent_memory, etc.)
│   └── /migrations              ← Incremental migrations
├── /n8n
│   └── /workflows               ← Exported n8n workflow JSONs
│       ├── plasmaide-content-generate-v1.json
│       ├── plasmaide-email-publish-v1.json
│       ├── plasmaide-blog-publish-v1.json
│       ├── plasmaide-social-publish-v1.json
│       ├── plasmaide-cs-ticket-handler-v1.json
│       └── global-threshold-poller-v1.json
└── /docs
    └── /brand
        ├── /plasmaide
        │   ├── product-knowledge.md
        │   ├── compliance-rules.md
        │   └── brand-voice-examples.md
        └── /folle
```

### Naming conventions

| Context | Convention | Example |
|---------|-----------|---------|
| `brand_id` | lowercase, no hyphens | `plasmaide`, `folle` |
| Table names | snake_case, plural | `content_queue`, `audit_log` |
| Column names | snake_case | `brand_id`, `created_at` |
| React components | PascalCase | `BrandSelector`, `ContentApprovalCard` |
| n8n workflows | `[brand]-[function]-v[N]` | `plasmaide-email-publish-v1` |
| Agent prompt files | kebab-case `.md` | `content-strategy.md` |
| Event types | snake_case | `content_published`, `agent_failure` |
| Environment variables | SCREAMING_SNAKE | `SUPABASE_SERVICE_ROLE_KEY` |

### Git workflow

- Branch per phase: `phase-1-foundation`, `phase-2-content`, etc.
- Commit after each working deliverable (not after each file)
- PR to `main` at phase completion
- Never commit secrets (`.env.local` in `.gitignore`)
- Commit messages: `[phase-N] description` (e.g., `[phase-1] Add Supabase schema`)

### Environment variables (`.env.local` — never committed)

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Google Sheets
GOOGLE_SHEETS_ID=

# n8n
N8N_WEBHOOK_BASE_URL=https://plasmaide.app.n8n.cloud/webhook/
N8N_API_KEY=

# Claude API (for inline edit regeneration in dashboard)
ANTHROPIC_API_KEY=
```

---

## 18. CURRENT STATUS

**Date:** April 2026
**Phase:** Pre-Phase 1 (about to start)

**What exists:**
- n8n cloud instance (`plasmaide.app.n8n.cloud`) with 6 Relevance AI-ported workflows (being replaced by AGOS)
- DotDigital credential in n8n (ID: `YOCMOmkElZtkJzkR`)
- Google Sheets content log (ID: `1GHgGzzISKtpSKoXmImczduL4T82HZcMrWAqHZzPB6_g`) — will be replaced by Supabase
- Plasmaide UK Shopify: `plasmaide-uk.myshopify.com`
- Plasmaide primary Shopify: `plasmaide.myshopify.com`
- Plasmaide v2 financial model (Excel, built, 9 sheets, 3-way integrated)
- Folle financial model (Excel, built, calendar year)
- TripleWhale API broken (support ticket open)
- WhatsApp HITL blocked (Meta template issue — inbound only for now)
- Gmail approval flow (Approve/Reject buttons) working for `carl@plasmaide.com` and `steve@plasmaide.com`

**What does NOT exist yet:**
- Supabase project
- Dashboard app
- Agent system prompts
- Production n8n workflows
- Any AGOS infrastructure

**Next action:** Start Phase 1 — create Supabase project, apply schema, scaffold dashboard.

---

## 19. GLOSSARY

| Term | Definition |
|------|-----------|
| **AGOS** | Autonomous Growth Operating System — this project |
| **Agent** | A Claude API call with a system prompt, context, and structured output. Not a persistent process. |
| **Approval Queue** | Supabase table + dashboard UI where humans approve/reject agent outputs |
| **Brand isolation** | Every data row scoped to a `brand_id`, enforced by RLS |
| **Compliance Agent** | Synchronous gate that checks all content before it reaches approval queue |
| **Content Queue** | `content_queue` table — holds content from creation through to publication |
| **Dumb pipes** | n8n's role: execute, retry, route. Never reason or decide. |
| **Financial Queue** | `financial_queue` table — separate approval flow for money-related actions |
| **HITL** | Human In The Loop — the approval gates |
| **MCP** | Model Context Protocol — Anthropic's standard for tool integration |
| **Memory** | Supabase pgvector embeddings that give agents context from past operations |
| **Prompt Registry** | Google Sheets tab tracking which version of each agent prompt is `live` |
| **RLS** | Row Level Security — Supabase feature enforcing brand isolation at DB level |
| **System prompt** | The `/agents/*.md` file that defines an agent's role, rules, and output schema |

---

*Last updated: April 2026*
*Updated by: Carl (via Claude Opus 4.6)*
*Version: 2.0*
*Next review: End of Phase 1*
