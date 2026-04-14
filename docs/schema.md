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

