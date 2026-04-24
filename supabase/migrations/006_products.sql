-- Migration 006: Product catalog tables
-- Run in Supabase SQL Editor.
-- Products are soft-archived (never hard-deleted) to preserve content/order references.

CREATE TABLE IF NOT EXISTS products (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             TEXT        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  shopify_product_id   TEXT        NOT NULL,
  title                TEXT        NOT NULL,
  description_html     TEXT,
  vendor               TEXT,
  product_type         TEXT,
  status               TEXT,         -- active, draft, archived
  tags                 TEXT[],
  handle               TEXT,
  seo_title            TEXT,
  seo_description      TEXT,
  category_taxonomy    TEXT,
  featured_image_url   TEXT,
  images               JSONB       DEFAULT '[]',   -- [{url, alt_text, position}]
  metafields           JSONB       DEFAULT '{}',
  shopify_created_at   TIMESTAMPTZ,
  shopify_updated_at   TIMESTAMPTZ,
  last_synced_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, shopify_product_id)
);

CREATE TABLE IF NOT EXISTS product_variants (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id             TEXT        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  product_id           UUID        NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  shopify_variant_id   TEXT        NOT NULL,
  title                TEXT        NOT NULL,
  sku                  TEXT,
  barcode              TEXT,
  price                DECIMAL(10,2),
  compare_at_price     DECIMAL(10,2),
  currency             TEXT,
  inventory_quantity   INTEGER,
  inventory_policy     TEXT,
  weight               DECIMAL(10,2),
  weight_unit          TEXT,
  requires_shipping    BOOLEAN     DEFAULT TRUE,
  taxable              BOOLEAN     DEFAULT TRUE,
  position             INTEGER,
  option_values        JSONB       DEFAULT '{}',
  image_url            TEXT,
  shopify_created_at   TIMESTAMPTZ,
  shopify_updated_at   TIMESTAMPTZ,
  last_synced_at       TIMESTAMPTZ DEFAULT NOW(),
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(brand_id, shopify_variant_id)
);

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand members can view products"
  ON products FOR SELECT
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));

CREATE POLICY "Brand members can view product_variants"
  ON product_variants FOR SELECT
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));

CREATE INDEX IF NOT EXISTS idx_products_brand_id ON products(brand_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(brand_id, status);
CREATE INDEX IF NOT EXISTS idx_product_variants_product_id ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variants_sku ON product_variants(brand_id, sku);

CREATE TRIGGER update_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_variants_updated_at
  BEFORE UPDATE ON product_variants
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
