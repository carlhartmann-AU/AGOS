-- Migration: 20260430120000_create_brand_content_config.sql
-- Purpose: Per-brand-per-content-type platform/HITL configuration table.
-- Tier 1 Item 5 Phase 1 — schema + seed only. No consumer changes.
--
-- RLS: mirror agent_config profiles-join pattern.
-- TODO(Tier 1 Item 2): align with canonical RLS pattern when
-- standardisation lands. Currently mirrors agent_config's
-- profiles-join pattern. agent_config uses one-user-one-brand
-- model; brand_content_config inherits same model for now.

CREATE TABLE brand_content_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id TEXT NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  content_type TEXT NOT NULL CHECK (content_type IN (
    'blog', 'email', 'landing_page', 'social_post'
  )),
  destination_platform TEXT NOT NULL CHECK (destination_platform IN (
    'shopify_blog', 'shopify_pages', 'dotdigital', 'klaviyo',
    'meta_business', 'manual'
  )),
  platform_label TEXT NOT NULL,
  platform_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  hitl_required BOOLEAN NOT NULL DEFAULT true,
  compliance_gating TEXT NOT NULL DEFAULT 'block_on_critical' CHECK (
    compliance_gating IN (
      'always_block', 'block_on_critical', 'block_on_major', 'never_block'
    )
  ),
  auto_approve_threshold NUMERIC(3,2) NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID NULL REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Unique active config per (brand_id, content_type)
CREATE UNIQUE INDEX idx_brand_content_config_unique_active
  ON brand_content_config (brand_id, content_type)
  WHERE is_active = true;

-- Hot read path index (resolver hits this every publish)
CREATE INDEX idx_brand_content_config_lookup
  ON brand_content_config (brand_id, content_type)
  WHERE is_active = true;

ALTER TABLE brand_content_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY brand_content_config_read ON brand_content_config
  FOR SELECT USING (
    brand_id IN (
      SELECT brand_id FROM profiles WHERE id = auth.uid()
    )
  );

-- Write path is service-role-only. No public mutation policy.
-- App-layer admin routes use service role.

-- Seed: Plasmaide current hardcoded values made explicit.

-- Plasmaide blog → Shopify Newsroom blog
INSERT INTO brand_content_config (
  brand_id, content_type, destination_platform, platform_label,
  platform_config, hitl_required, compliance_gating
) VALUES (
  'plasmaide', 'blog', 'shopify_blog', 'Shopify Newsroom',
  jsonb_build_object(
    'blog_handle', 'newsroom',
    'default_author', 'Plasmaide Team',
    'default_tags', jsonb_build_array('wellness')
  ),
  true, 'block_on_critical'
);

-- Plasmaide landing_page → Shopify Pages
INSERT INTO brand_content_config (
  brand_id, content_type, destination_platform, platform_label,
  platform_config, hitl_required, compliance_gating
) VALUES (
  'plasmaide', 'landing_page', 'shopify_pages', 'Shopify Pages',
  jsonb_build_object(
    'default_template_suffix', null,
    'is_published', true
  ),
  true, 'block_on_critical'
);

-- Plasmaide email → DotDigital AU instance
INSERT INTO brand_content_config (
  brand_id, content_type, destination_platform, platform_label,
  platform_config, hitl_required, compliance_gating
) VALUES (
  'plasmaide', 'email', 'dotdigital', 'DotDigital (AU)',
  jsonb_build_object(
    'region', 'r3',
    'api_base_url', 'https://r3-api.dotdigital.com',
    'address_book_id', 14376785,
    'from_address_id', 1109,
    'from_name', 'Plasmaide',
    'unsubscribe_token', 'https://$UNSUB$',
    'merge_token_format', '{{FIELD_NAME}}',
    'n8n_webhook_url', 'https://plasmaide.app.n8n.cloud/webhook/plasmaide-content-publish',
    'auto_send_after_create', false
  ),
  true, 'block_on_critical'
);

-- Verification SELECT (inspect output to confirm 3 rows seeded)
SELECT brand_id, content_type, destination_platform, platform_label,
       hitl_required, compliance_gating, is_active
FROM brand_content_config
WHERE brand_id = 'plasmaide'
ORDER BY content_type;
