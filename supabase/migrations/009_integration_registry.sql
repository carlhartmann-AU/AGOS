-- Migration 009: Integration Registry & Brand Integrations
-- Run in Supabase SQL Editor.
-- Central catalog of all platform integrations + per-brand connection state.

-- ─── integration_registry ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS integration_registry (
  id          UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT    NOT NULL UNIQUE,
  name        TEXT    NOT NULL,
  description TEXT,
  category    TEXT    NOT NULL CHECK (category IN (
    'commerce_cms','email_marketing','analytics_attribution',
    'customer_service','financial','ai_llm','social_publishing','reviews_ugc'
  )),
  icon_code   TEXT,
  icon_color  TEXT,
  status      TEXT    NOT NULL DEFAULT 'coming_soon' CHECK (status IN ('live','coming_soon')),
  roadmap_eta TEXT,
  data_roles  TEXT[]  DEFAULT '{}',
  auth_type   TEXT,
  docs_url    TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE OR REPLACE TRIGGER integration_registry_updated_at
  BEFORE UPDATE ON integration_registry
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE integration_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read integration registry"
  ON integration_registry FOR SELECT TO authenticated USING (true);

-- ─── brand_integrations ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_integrations (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id          TEXT    NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  integration_slug  TEXT    NOT NULL REFERENCES integration_registry(slug) ON DELETE CASCADE,
  status            TEXT    NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected','disconnected','error')),
  connected_at      TIMESTAMPTZ,
  config            JSONB   DEFAULT '{}',
  data_roles_active TEXT[]  DEFAULT '{}',
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_id, integration_slug)
);

CREATE OR REPLACE TRIGGER brand_integrations_updated_at
  BEFORE UPDATE ON brand_integrations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE brand_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand members can view their integrations"
  ON brand_integrations FOR SELECT TO authenticated
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));

-- ─── Seed: integration_registry ───────────────────────────────────────────────

INSERT INTO integration_registry
  (slug, name, description, category, icon_code, icon_color, status, roadmap_eta, data_roles, auth_type)
VALUES
  -- Commerce & CMS
  ('shopify',      'Shopify',
   'Reads orders, products, customers · writes blog posts, PDP copy, alt text',
   'commerce_cms', 'Sh', '#95BF47', 'live', NULL,
   ARRAY['commerce_data','product_catalog','content_publishing'], 'oauth'),

  ('woocommerce',  'WooCommerce',
   'Same as Shopify, for WP-based stores',
   'commerce_cms', 'Wc', '#7F54B3', 'coming_soon', 'Q3 2026',
   ARRAY['commerce_data','product_catalog','content_publishing'], NULL),

  ('bigcommerce',  'BigCommerce',
   'Headless and hosted store support',
   'commerce_cms', 'Bc', '#121118', 'coming_soon', 'Q3 2026',
   ARRAY['commerce_data','product_catalog'], NULL),

  -- Email & Marketing Automation
  ('dotdigital',   'DotDigital',
   'Ships campaigns, templates, lists · reads engagement data',
   'email_marketing', 'Dd', '#7B8F9E', 'live', NULL,
   ARRAY['email_marketing'], 'api_key'),

  ('klaviyo',      'Klaviyo',
   'Lifecycle flows, segments, campaign deploys',
   'email_marketing', 'Kl', '#2B2D42', 'live', NULL,
   ARRAY['email_marketing'], 'api_key'),

  ('omnisend',     'Omnisend',
   'Multi-channel lifecycle marketing',
   'email_marketing', 'Om', '#1BA37F', 'coming_soon', 'Q3 2026',
   ARRAY['email_marketing'], NULL),

  -- Analytics & Attribution
  ('triple_whale',       'Triple Whale',
   'Multi-touch attribution, daily revenue, CAC / LTV',
   'analytics_attribution', 'Tw', '#6C5CE7', 'live', NULL,
   ARRAY['attribution_data','ad_management'], 'api_key'),

  ('google_analytics_4', 'Google Analytics 4',
   'Sessions, conversions, e-comm events',
   'analytics_attribution', 'G4', '#E37400', 'live', NULL,
   ARRAY['web_analytics'], 'oauth'),

  ('meta_pixel',         'Meta Pixel',
   'Ad attribution and conversion tracking',
   'analytics_attribution', 'Mp', '#4267B2', 'coming_soon', 'Q3 2026',
   ARRAY['attribution_data','ad_management'], NULL),

  -- Customer Service
  ('gorgias',   'Gorgias',
   'Ticket triage and drafted replies · Customer Service Agent',
   'customer_service', 'Gx', '#E85D75', 'live', NULL,
   ARRAY['customer_service'], 'oauth'),

  ('zendesk',   'Zendesk',
   'Enterprise support desk integration',
   'customer_service', 'Zd', '#03363D', 'coming_soon', 'Q3 2026',
   ARRAY['customer_service'], NULL),

  ('intercom',  'Intercom',
   'Conversational support and chat',
   'customer_service', 'Ic', '#6AFDEF', 'coming_soon', 'Q3 2026',
   ARRAY['customer_service'], NULL),

  -- Financial
  ('xero',       'Xero',
   'P&L, contribution margin, invoice data · CFO Agent',
   'financial', 'Xr', '#13B5EA', 'live', NULL,
   ARRAY['accounting_data'], 'oauth'),

  ('quickbooks', 'QuickBooks',
   'Accounting and payroll sync',
   'financial', 'Qb', '#2CA01C', 'coming_soon', 'Q3 2026',
   ARRAY['accounting_data'], NULL),

  ('stripe',     'Stripe',
   'Revenue and subscription data',
   'financial', 'St', '#635BFF', 'coming_soon', 'Q3 2026',
   ARRAY['billing_data'], NULL),

  -- AI / LLM Providers
  ('anthropic',     'Anthropic (Claude)',
   'Default · Haiku 4.5 (fast), Sonnet 4.6 (accurate), Opus 4.7 (premium)',
   'ai_llm', 'An', '#D4A27F', 'live', NULL,
   ARRAY['llm_provider'], 'native'),

  ('openai',        'OpenAI',
   'Bring your own key · GPT-4 and GPT-4o',
   'ai_llm', 'Oa', '#10A37F', 'live', NULL,
   ARRAY['llm_provider'], 'api_key'),

  ('google_gemini', 'Google Gemini',
   'Gemini 3 Pro and Gemini 3 Flash',
   'ai_llm', 'Gg', '#4285F4', 'coming_soon', 'Q3 2026',
   ARRAY['llm_provider'], NULL),

  -- Social & Publishing
  ('meta_social', 'Meta (Facebook + Instagram)',
   'Post scheduling and ad campaign deploys',
   'social_publishing', 'Fb', '#1877F2', 'live', NULL,
   ARRAY['social_publishing','ad_management'], 'oauth'),

  ('linkedin',    'LinkedIn',
   'B2B posts and company page scheduling',
   'social_publishing', 'Li', '#0A66C2', 'coming_soon', 'Q3 2026',
   ARRAY['social_publishing'], NULL),

  ('tiktok',      'TikTok',
   'Organic and paid content deploys',
   'social_publishing', 'Tk', '#000000', 'coming_soon', 'Q3 2026',
   ARRAY['social_publishing'], NULL),

  -- Reviews & UGC
  ('okendo',     'Okendo',
   'Review monitoring and drafted responses',
   'reviews_ugc', 'Ok', '#FF6B6B', 'coming_soon', 'Q3 2026',
   ARRAY['review_data'], 'api_key'),

  ('trustpilot', 'Trustpilot',
   'Reputation signals and response workflow',
   'reviews_ugc', 'Tp', '#00B67A', 'coming_soon', 'Q3 2026',
   ARRAY['review_data'], NULL),

  ('yotpo',      'Yotpo',
   'Loyalty + UGC review platform',
   'reviews_ugc', 'Yo', '#3B5998', 'coming_soon', 'Q3 2026',
   ARRAY['review_data'], NULL)

ON CONFLICT (slug) DO NOTHING;

-- ─── Seed: Plasmaide brand_integrations ───────────────────────────────────────

INSERT INTO brand_integrations
  (brand_id, integration_slug, status, connected_at, data_roles_active, config)
VALUES
  ('plasmaide', 'shopify',      'connected', now(),
   ARRAY['commerce_data','product_catalog','content_publishing'],
   '{"shop_domain":"plasmaide-uk.myshopify.com"}'),

  ('plasmaide', 'triple_whale', 'connected', now(),
   ARRAY['attribution_data'],
   '{"shop_domain":"plasmaide-uk.myshopify.com"}'),

  ('plasmaide', 'xero',         'connected', now(),
   ARRAY['accounting_data'], '{}'),

  ('plasmaide', 'dotdigital',   'connected', now(),
   ARRAY['email_marketing'], '{"via":"n8n"}'),

  ('plasmaide', 'anthropic',    'connected', now(),
   ARRAY['llm_provider'], '{}')

ON CONFLICT (brand_id, integration_slug) DO NOTHING;
