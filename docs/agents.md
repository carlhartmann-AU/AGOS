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

