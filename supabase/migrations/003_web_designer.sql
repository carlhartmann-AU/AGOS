-- Migration: Web Designer Agent tables
-- AGOS Phase 3
-- NOTE: This migration has already been run on the Supabase instance.
-- Kept in repo for reference and future deployments.

CREATE TABLE IF NOT EXISTS content_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL DEFAULT 'plasmaide',
  content_type TEXT NOT NULL CHECK (content_type IN ('landing_page', 'product_cro', 'blog_article', 'email', 'social')),
  agent TEXT NOT NULL DEFAULT 'web_designer',
  title TEXT NOT NULL,
  handle TEXT,
  body_html TEXT NOT NULL,
  body_html_before TEXT,
  summary_html TEXT,
  meta_title TEXT,
  meta_description TEXT,
  target_keywords TEXT[],
  tags TEXT,
  shopify_resource_id TEXT,
  shopify_blog_id TEXT,
  changes_summary TEXT,
  cro_rationale TEXT,
  compliance_status TEXT NOT NULL DEFAULT 'pending' CHECK (compliance_status IN ('pending', 'passed', 'warning', 'failed')),
  compliance_notes JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending_review' CHECK (status IN (
    'pending_review',
    'staged',
    'published',
    'rejected',
    'revision_requested'
  )),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  publish_mode TEXT DEFAULT 'draft' CHECK (publish_mode IN ('draft', 'live')),
  published_at TIMESTAMPTZ,
  shopify_published_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_queue_status ON content_queue (status, brand_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_type ON content_queue (content_type, brand_id);
CREATE INDEX IF NOT EXISTS idx_content_queue_created ON content_queue (created_at DESC);

CREATE OR REPLACE FUNCTION update_content_queue_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS content_queue_updated ON content_queue;
CREATE TRIGGER content_queue_updated
  BEFORE UPDATE ON content_queue
  FOR EACH ROW
  EXECUTE FUNCTION update_content_queue_timestamp();

CREATE TABLE IF NOT EXISTS event_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL DEFAULT 'plasmaide',
  event_type TEXT NOT NULL,
  agent TEXT,
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_event_log_type ON event_log (event_type, brand_id);
CREATE INDEX IF NOT EXISTS idx_event_log_created ON event_log (created_at DESC);

CREATE TABLE IF NOT EXISTS shopify_blogs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL,
  shopify_blog_id TEXT NOT NULL,
  handle TEXT NOT NULL,
  title TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_id, shopify_blog_id)
);

ALTER TABLE content_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_blogs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on content_queue"
  ON content_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on event_log"
  ON event_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access on shopify_blogs"
  ON shopify_blogs FOR ALL USING (true) WITH CHECK (true);
