-- Migration 005: Shopify OAuth connections
-- Run in Supabase SQL Editor.
-- Shopify offline tokens don't expire. Stored as plaintext for now.
-- TECH DEBT: encrypt via Supabase Vault before broader user access.

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TABLE IF NOT EXISTS shopify_connections (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id         TEXT        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  shop_domain      TEXT        NOT NULL,
  access_token     TEXT        NOT NULL,
  scopes           TEXT        NOT NULL,
  shopify_shop_id  TEXT,
  shop_name        TEXT,
  connected_at     TIMESTAMPTZ DEFAULT NOW(),
  last_sync_at     TIMESTAMPTZ,
  sync_status      TEXT        DEFAULT 'pending',  -- pending, syncing, success, error
  sync_error       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, shop_domain)
);

ALTER TABLE shopify_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand members can view shopify_connections"
  ON shopify_connections FOR SELECT
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Brand members can update shopify_connections"
  ON shopify_connections FOR UPDATE
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));

CREATE TRIGGER update_shopify_connections_updated_at
  BEFORE UPDATE ON shopify_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
