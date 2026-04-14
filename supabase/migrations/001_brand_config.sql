-- ============================================================
-- Migration 001 — brand_config table
-- Run in Supabase SQL Editor.
-- Replaces the Google Sheets Config tab for Phase 2.
-- Will be synced to Sheets in Phase 4+ when Sheets integration lands.
-- ============================================================

-- Key-value config store, one row per brand+key pair.
-- All values are stored as TEXT; callers cast to appropriate types.
--
-- Canonical keys (from docs/schema.md Config tab):
--   shopify_store, email_platform, xero_tenant_id,
--   min_roas, max_cac, spend_anomaly_pct,
--   report_day, report_time, report_timezone,
--   alert_email, slack_channel,
--   coo_channel_slack, coo_channel_artifact,
--   shopify_markets, base_locale,
--   cs_platform, gorgias_domain,
--   refund_threshold_aud, b2b_daily_outreach_limit

CREATE TABLE IF NOT EXISTS brand_config (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id   TEXT        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  key        TEXT        NOT NULL,
  value      TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (brand_id, key)
);

CREATE INDEX IF NOT EXISTS idx_brand_config_brand ON brand_config (brand_id);

CREATE OR REPLACE TRIGGER set_brand_config_updated_at
  BEFORE UPDATE ON brand_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: same brand-isolation pattern as all other tables
ALTER TABLE brand_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY brand_isolation ON brand_config
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

-- Seed defaults for Plasmaide
INSERT INTO brand_config (brand_id, key, value) VALUES
  ('plasmaide', 'min_roas',               '2.0'),
  ('plasmaide', 'max_cac',                '40'),
  ('plasmaide', 'spend_anomaly_pct',       '20'),
  ('plasmaide', 'report_day',              'Monday'),
  ('plasmaide', 'report_time',             '08:00'),
  ('plasmaide', 'report_timezone',         'Australia/Brisbane'),
  ('plasmaide', 'alert_email',             ''),
  ('plasmaide', 'slack_channel',           '#plasmaide-coo'),
  ('plasmaide', 'coo_channel_slack',       'true'),
  ('plasmaide', 'coo_channel_artifact',    'true'),
  ('plasmaide', 'shopify_store',           'plasmaide.myshopify.com'),
  ('plasmaide', 'email_platform',          'dotdigital'),
  ('plasmaide', 'shopify_markets',         'AU,GB,US,EU'),
  ('plasmaide', 'base_locale',             'en-AU'),
  ('plasmaide', 'cs_platform',             'gorgias'),
  ('plasmaide', 'refund_threshold_aud',    '100'),
  ('plasmaide', 'b2b_daily_outreach_limit','10')
ON CONFLICT (brand_id, key) DO NOTHING;
