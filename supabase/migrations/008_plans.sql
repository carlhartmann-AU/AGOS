-- Migration 008: Plans and plan-agent mappings
-- Run in Supabase SQL Editor.
-- Integrations are available on ALL plans. Only agents are plan-tiered.

CREATE TABLE IF NOT EXISTS plans (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                TEXT        NOT NULL UNIQUE,
  name                TEXT        NOT NULL,
  description         TEXT,
  price_monthly_usd   INTEGER,
  price_yearly_usd    INTEGER,
  is_active           BOOLEAN     DEFAULT TRUE,
  features            JSONB       DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS plan_agents (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id    UUID        NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  agent_key  TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(plan_id, agent_key)
);

ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view plans" ON plans FOR SELECT USING (true);
CREATE POLICY "Anyone can view plan_agents" ON plan_agents FOR SELECT USING (true);

CREATE TRIGGER update_plans_updated_at
  BEFORE UPDATE ON plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed plans
INSERT INTO plans (slug, name, description, price_monthly_usd, features) VALUES
  ('starter',    'Starter',    'Essential analytics and content tools', 4900,  '{"max_users": 2,  "max_brands": 1,  "integrations_included": true}'),
  ('growth',     'Growth',     'Full agent suite for growing brands',   14900, '{"max_users": 5,  "max_brands": 2,  "integrations_included": true}'),
  ('enterprise', 'Enterprise', 'Complete platform with custom agents',  49900, '{"max_users": 20, "max_brands": 10, "integrations_included": true}')
ON CONFLICT (slug) DO NOTHING;

-- Starter: Intelligence + Content Studio
INSERT INTO plan_agents (plan_id, agent_key)
SELECT p.id, a.agent_key FROM plans p
CROSS JOIN (VALUES ('intelligence'), ('content')) AS a(agent_key)
WHERE p.slug = 'starter'
ON CONFLICT (plan_id, agent_key) DO NOTHING;

-- Growth: all Starter + Compliance + CFO + COO + Review Harvester
INSERT INTO plan_agents (plan_id, agent_key)
SELECT p.id, a.agent_key FROM plans p
CROSS JOIN (VALUES ('intelligence'), ('content'), ('compliance'), ('cfo'), ('coo'), ('review_harvester')) AS a(agent_key)
WHERE p.slug = 'growth'
ON CONFLICT (plan_id, agent_key) DO NOTHING;

-- Enterprise: everything
INSERT INTO plan_agents (plan_id, agent_key)
SELECT p.id, a.agent_key FROM plans p
CROSS JOIN (VALUES ('intelligence'), ('content'), ('compliance'), ('cfo'), ('coo'), ('review_harvester'), ('b2b_outreach'), ('customer_service')) AS a(agent_key)
WHERE p.slug = 'enterprise'
ON CONFLICT (plan_id, agent_key) DO NOTHING;

-- Add plan_id column to brands table (optional — set Plasmaide to enterprise)
ALTER TABLE brands ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id);

UPDATE brands
SET plan_id = (SELECT id FROM plans WHERE slug = 'enterprise')
WHERE brand_id = 'plasmaide' AND plan_id IS NULL;
