-- ============================================================
-- AGOS — Supabase RPC Functions
-- Paste into Supabase SQL Editor after schema.sql.
-- Requires: vector extension, agent_memory table.
-- ============================================================


-- ============================================================
-- match_agent_memory
--
-- Semantic similarity search over agent_memory.
-- Called by n8n before each agent invocation to retrieve relevant
-- context. Returns top-k memories ordered by cosine similarity.
--
-- Parameters:
--   query_embedding   — 1536-dim vector from OpenAI text-embedding-3-small
--   match_brand_id    — scopes search to a single brand
--   match_agent       — scopes search to a single agent
--   match_memory_type — optional: filter to one memory_type
--   match_count       — number of results to return (default 5)
--
-- Usage (from n8n / PostgREST):
--   POST /rest/v1/rpc/match_agent_memory
--   {
--     "query_embedding": [...],
--     "match_brand_id": "plasmaide",
--     "match_agent": "content_strategy",
--     "match_memory_type": "brand_voice_example",
--     "match_count": 5
--   }
-- ============================================================
CREATE OR REPLACE FUNCTION match_agent_memory(
  query_embedding   vector(1536),
  match_brand_id    TEXT,
  match_agent       TEXT,
  match_memory_type TEXT    DEFAULT NULL,
  match_count       INTEGER DEFAULT 5
)
RETURNS TABLE (
  id          UUID,
  content     TEXT,
  memory_type TEXT,
  metadata    JSONB,
  similarity  FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as function owner, bypasses RLS (n8n already uses service_role)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    am.id,
    am.content,
    am.memory_type,
    am.metadata,
    (1 - (am.embedding <=> query_embedding))::FLOAT AS similarity
  FROM agent_memory am
  WHERE am.brand_id    = match_brand_id
    AND am.agent       = match_agent
    AND am.embedding   IS NOT NULL
    AND (match_memory_type IS NULL OR am.memory_type = match_memory_type)
  ORDER BY am.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;


-- ============================================================
-- get_content_queue_summary
--
-- Returns a count of content_queue rows by status for a brand.
-- Used by the dashboard KPI cards and approval queue depth panel.
--
-- Usage:
--   POST /rest/v1/rpc/get_content_queue_summary
--   { "target_brand_id": "plasmaide" }
-- ============================================================
CREATE OR REPLACE FUNCTION get_content_queue_summary(
  target_brand_id TEXT
)
RETURNS TABLE (
  status TEXT,
  count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT status, COUNT(*) AS count
  FROM content_queue
  WHERE brand_id = target_brand_id
  GROUP BY status
  ORDER BY status;
$$;


-- ============================================================
-- get_financial_queue_summary
--
-- Returns a count of financial_queue rows by status for a brand.
-- Used by the dashboard financial approval queue depth panel.
--
-- Usage:
--   POST /rest/v1/rpc/get_financial_queue_summary
--   { "target_brand_id": "plasmaide" }
-- ============================================================
CREATE OR REPLACE FUNCTION get_financial_queue_summary(
  target_brand_id TEXT
)
RETURNS TABLE (
  status TEXT,
  count  BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT status, COUNT(*) AS count
  FROM financial_queue
  WHERE brand_id = target_brand_id
  GROUP BY status
  ORDER BY status;
$$;


-- ============================================================
-- get_agent_token_usage
--
-- Returns daily token usage per agent for a brand, for the last N days.
-- Used by the dashboard observability panel (cost/token tracking).
--
-- Usage:
--   POST /rest/v1/rpc/get_agent_token_usage
--   { "target_brand_id": "plasmaide", "days_back": 7 }
-- ============================================================
CREATE OR REPLACE FUNCTION get_agent_token_usage(
  target_brand_id TEXT,
  days_back       INTEGER DEFAULT 7
)
RETURNS TABLE (
  day        DATE,
  agent      TEXT,
  tokens_in  BIGINT,
  tokens_out BIGINT,
  calls      BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    DATE(created_at)      AS day,
    agent,
    SUM(tokens_in)        AS tokens_in,
    SUM(tokens_out)       AS tokens_out,
    COUNT(*)              AS calls
  FROM audit_log
  WHERE brand_id  = target_brand_id
    AND created_at >= NOW() - (days_back || ' days')::INTERVAL
    AND status     = 'success'
  GROUP BY DATE(created_at), agent
  ORDER BY day DESC, agent;
$$;
