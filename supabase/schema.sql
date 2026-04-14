-- ============================================================
-- AGOS — Supabase Schema
-- Paste into Supabase SQL Editor and run in one shot.
-- Idempotent: safe to re-run (uses IF NOT EXISTS / ON CONFLICT).
-- ============================================================


-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- UTILITY: updated_at trigger function
-- Applied to any table with an updated_at column.
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- BRANDS (core identity table)
-- No RLS — all authenticated dashboard users can read the brand
-- list (needed for brand selector). Brand rows are added by admins.
-- ============================================================
CREATE TABLE IF NOT EXISTS brands (
  brand_id    TEXT        PRIMARY KEY,
  name        TEXT        NOT NULL,
  status      TEXT        DEFAULT 'active'
                          CHECK (status IN ('active', 'paused', 'archived')),
  industry    TEXT,
  base_locale TEXT        DEFAULT 'en-AU',
  logo_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- EVENTS (canonical event log — append-only)
-- Every business event is written here by n8n (service_role).
-- Dashboard reads only. Never deleted.
-- ============================================================
-- Canonical event_type values:
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
--
-- Canonical source values:
--   shopify, klaviyo, dotdigital, gorgias, xero,
--   n8n, artifact, coo, content_strategy, compliance, cfo,
--   cs_agent, campaign_exec, web_designer, b2b_outreach,
--   review_harvester, intelligence
CREATE TABLE IF NOT EXISTS events (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id    TEXT        NOT NULL REFERENCES brands(brand_id),
  event_type  TEXT        NOT NULL,
  source      TEXT        NOT NULL,
  payload     JSONB,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_brand_type ON events (brand_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_created    ON events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_source     ON events (source);


-- ============================================================
-- CONTENT QUEUE
-- Tracks every content piece from creation through publication.
-- ============================================================
CREATE TABLE IF NOT EXISTS content_queue (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id          TEXT        NOT NULL REFERENCES brands(brand_id),
  content_type      TEXT        NOT NULL
                                CHECK (content_type IN (
                                  'email', 'blog', 'social_caption', 'ad',
                                  'landing_page', 'b2b_email', 'cs_response',
                                  'review_response'
                                )),
  status            TEXT        DEFAULT 'pending'
                                CHECK (status IN (
                                  'pending', 'compliance_check', 'compliance_fail',
                                  'escalated', 'approved', 'rejected',
                                  'publish_pending', 'published', 'failed'
                                )),
  content           JSONB       NOT NULL,
  compliance_result JSONB,
  platform          TEXT,
  audience          TEXT,
  approved_by       TEXT,
  approved_at       TIMESTAMPTZ,
  published_at      TIMESTAMPTZ,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_content_queue_brand_status ON content_queue (brand_id, status);
CREATE INDEX IF NOT EXISTS idx_content_queue_created      ON content_queue (created_at DESC);

CREATE OR REPLACE TRIGGER set_content_queue_updated_at
  BEFORE UPDATE ON content_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- FINANCIAL QUEUE
-- Separate from content — different approvers and audit trail.
-- ============================================================
CREATE TABLE IF NOT EXISTS financial_queue (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id     TEXT        NOT NULL REFERENCES brands(brand_id),
  action_type  TEXT        NOT NULL
                           CHECK (action_type IN (
                             'budget_reallocation', 'xero_journal', 'refund_approval',
                             'invoice_update', 'spend_pause', 'spend_increase'
                           )),
  status       TEXT        DEFAULT 'pending'
                           CHECK (status IN (
                             'pending', 'approved', 'rejected', 'executed', 'failed'
                           )),
  details      JSONB       NOT NULL,
  amount_aud   DECIMAL,
  requested_by TEXT        NOT NULL,
  approved_by  TEXT,
  approved_at  TIMESTAMPTZ,
  executed_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_queue_brand_status ON financial_queue (brand_id, status);


-- ============================================================
-- AUDIT LOG (every agent invocation)
-- Written by n8n after each Claude API call. Dashboard reads only.
-- input_summary and output_summary are capped at 500 chars each.
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_log (
  id             UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id       TEXT        NOT NULL REFERENCES brands(brand_id),
  agent          TEXT        NOT NULL,
  action         TEXT        NOT NULL,
  tool_called    TEXT,
  input_summary  TEXT,
  output_summary TEXT,
  tokens_in      INTEGER,
  tokens_out     INTEGER,
  latency_ms     INTEGER,
  status         TEXT        CHECK (status IN ('success', 'failure', 'escalated')),
  error_message  TEXT,
  human_override BOOLEAN     DEFAULT FALSE,
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_brand_agent ON audit_log (brand_id, agent);
CREATE INDEX IF NOT EXISTS idx_audit_log_created     ON audit_log (created_at DESC);


-- ============================================================
-- AGENT MEMORY (pgvector semantic storage)
-- Embeddings: OpenAI text-embedding-3-small (1536 dims, cosine).
-- Written by n8n after successful agent invocations.
-- Read by n8n before agent invocations (via match_agent_memory RPC).
-- ============================================================
CREATE TABLE IF NOT EXISTS agent_memory (
  id          UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id    TEXT        NOT NULL REFERENCES brands(brand_id),
  agent       TEXT        NOT NULL,
  memory_type TEXT        NOT NULL
                          CHECK (memory_type IN (
                            'campaign_outcome', 'customer_segment', 'brand_learning',
                            'tone_preference', 'compliance_pattern', 'brand_voice_example',
                            'product_knowledge', 'financial_model', 'cro_test_result',
                            'outreach_pattern', 'cs_resolution_pattern', 'faq_knowledge',
                            'review_sentiment', 'market_research'
                          )),
  content     TEXT        NOT NULL,
  embedding   vector(1536),
  metadata    JSONB,
  -- metadata.retrieval_count tracked for monthly pruning (memories >12mo, low retrieval)
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_memory_brand_agent ON agent_memory (brand_id, agent);
CREATE INDEX IF NOT EXISTS idx_agent_memory_type        ON agent_memory (memory_type);
CREATE INDEX IF NOT EXISTS idx_agent_memory_embedding   ON agent_memory
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE TRIGGER set_agent_memory_updated_at
  BEFORE UPDATE ON agent_memory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- CUSTOMER IDENTITY (unified cross-platform IDs)
-- Maps a brand's customer across Shopify, Klaviyo, DotDigital, Gorgias.
-- n8n writes; dashboard reads. Claude API never receives individual PII.
-- ============================================================
CREATE TABLE IF NOT EXISTS customer_identity (
  id                     UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id               TEXT        NOT NULL REFERENCES brands(brand_id),
  customer_id            TEXT        NOT NULL,
  shopify_customer_id    TEXT,
  klaviyo_profile_id     TEXT,
  dotdigital_contact_id  TEXT,
  gorgias_customer_id    TEXT,
  segment                TEXT        CHECK (segment IN (
                                       'professional_athlete', 'prosumer',
                                       'wellness', 'at_risk'
                                     )),
  ltv_estimate           DECIMAL,
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_identity_brand   ON customer_identity (brand_id);
CREATE INDEX IF NOT EXISTS idx_customer_identity_segment ON customer_identity (brand_id, segment);

CREATE OR REPLACE TRIGGER set_customer_identity_updated_at
  BEFORE UPDATE ON customer_identity
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- B2B PROSPECTS (B2B Outreach Agent)
-- status = 'suppressed' is checked before any outreach attempt.
-- outreach_history is a JSON array of attempt objects.
-- ============================================================
CREATE TABLE IF NOT EXISTS b2b_prospects (
  id                UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id          TEXT        NOT NULL REFERENCES brands(brand_id),
  company_name      TEXT        NOT NULL,
  contact_name      TEXT,
  contact_email     TEXT,
  category          TEXT,
  status            TEXT        DEFAULT 'identified'
                                CHECK (status IN (
                                  'identified', 'researched', 'outreach_drafted',
                                  'outreach_sent', 'responded', 'meeting_booked',
                                  'converted', 'suppressed', 'dead'
                                )),
  outreach_history  JSONB       DEFAULT '[]'::jsonb,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_b2b_prospects_brand_status ON b2b_prospects (brand_id, status);

CREATE OR REPLACE TRIGGER set_b2b_prospects_updated_at
  BEFORE UPDATE ON b2b_prospects
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
-- Rules:
--   - brands: no RLS — all authenticated users can read (brand selector)
--   - all other tables: brand-scoped via JWT user_metadata.brand_ids
--   - n8n uses service_role key → bypasses RLS entirely
--   - brand_ids in JWT is a comma-separated string: "plasmaide,folle"
--
-- To set brand access for a user, update their user_metadata in
-- Supabase Auth: { "brand_ids": "plasmaide" }

ALTER TABLE events           ENABLE ROW LEVEL SECURITY;
ALTER TABLE content_queue    ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_queue  ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log        ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_memory     ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_identity ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_prospects    ENABLE ROW LEVEL SECURITY;

-- Events
CREATE POLICY brand_isolation ON events
  FOR ALL TO authenticated
  USING (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  )
  WITH CHECK (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  );

-- Content queue
CREATE POLICY brand_isolation ON content_queue
  FOR ALL TO authenticated
  USING (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  )
  WITH CHECK (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  );

-- Financial queue
CREATE POLICY brand_isolation ON financial_queue
  FOR ALL TO authenticated
  USING (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  )
  WITH CHECK (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  );

-- Audit log
CREATE POLICY brand_isolation ON audit_log
  FOR ALL TO authenticated
  USING (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  )
  WITH CHECK (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  );

-- Agent memory
CREATE POLICY brand_isolation ON agent_memory
  FOR ALL TO authenticated
  USING (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  )
  WITH CHECK (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  );

-- Customer identity
CREATE POLICY brand_isolation ON customer_identity
  FOR ALL TO authenticated
  USING (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  )
  WITH CHECK (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  );

-- B2B prospects
CREATE POLICY brand_isolation ON b2b_prospects
  FOR ALL TO authenticated
  USING (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  )
  WITH CHECK (
    brand_id = ANY(string_to_array(
      auth.jwt() -> 'user_metadata' ->> 'brand_ids', ','
    ))
  );


-- ============================================================
-- SEED DATA — Plasmaide
-- ============================================================
INSERT INTO brands (brand_id, name, status, industry, base_locale)
VALUES ('plasmaide', 'Plasmaide', 'active', 'supplements', 'en-AU')
ON CONFLICT (brand_id) DO NOTHING;
