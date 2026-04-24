-- Migration 007: Agent configuration table
-- Run in Supabase SQL Editor.
-- Stores per-brand agent settings: enabled/disabled, LLM model, cron schedule.

CREATE TABLE IF NOT EXISTS agent_config (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id               TEXT        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  agent_key              TEXT        NOT NULL,
  display_name           TEXT        NOT NULL,
  description            TEXT,
  enabled                BOOLEAN     DEFAULT TRUE,
  llm_provider           TEXT        DEFAULT 'anthropic',
  llm_model              TEXT        DEFAULT 'claude-sonnet-4-6-20250415',
  llm_config             JSONB       DEFAULT '{}',
  cron_schedule          TEXT,
  notification_channels  JSONB       DEFAULT '[]',
  settings               JSONB       DEFAULT '{}',
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, agent_key)
);

ALTER TABLE agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand members can view agent_config"
  ON agent_config FOR SELECT
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Brand members can update agent_config"
  ON agent_config FOR UPDATE
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));

CREATE TRIGGER update_agent_config_updated_at
  BEFORE UPDATE ON agent_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO agent_config (brand_id, agent_key, display_name, description, enabled, llm_model, cron_schedule) VALUES
  ('plasmaide', 'compliance',       'Compliance Agent',      'Validates content against regulatory rules and brand guidelines', true,  'claude-sonnet-4-6-20250415', NULL),
  ('plasmaide', 'intelligence',     'Intelligence Agent',    'Weekly business intelligence reports with anomaly detection',    true,  'claude-sonnet-4-6-20250415', '0 22 * * 0'),
  ('plasmaide', 'cfo',              'CFO Agent',             'Financial analysis, unit economics, and budget tracking',        true,  'claude-sonnet-4-6-20250415', '0 23 * * 0'),
  ('plasmaide', 'coo',              'COO Agent',             'Chat interface for operations management',                       true,  'claude-sonnet-4-6-20250415', NULL),
  ('plasmaide', 'content',          'Content Studio',        'Content creation with templates and Shopify publishing',         true,  'claude-sonnet-4-6-20250415', NULL),
  ('plasmaide', 'b2b_outreach',     'B2B Outreach Agent',    'Prospect pipeline management and outreach copy',                 true,  'claude-sonnet-4-6-20250415', NULL),
  ('plasmaide', 'customer_service', 'Customer Service Agent','Ticket management with escalation triggers',                     true,  'claude-sonnet-4-6-20250415', NULL),
  ('plasmaide', 'review_harvester', 'Review Harvester',      'Review sentiment analysis and content repurposing',              true,  'claude-sonnet-4-6-20250415', NULL)
ON CONFLICT (brand_id, agent_key) DO NOTHING;
