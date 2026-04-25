-- Migration 010: Orders & Customers tables
-- Run in Supabase SQL Editor.
-- Customers must come first since orders references it.

-- ─── customers ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS customers (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id            TEXT        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  shopify_customer_id TEXT        NOT NULL,
  email               TEXT,
  first_name          TEXT,
  last_name           TEXT,
  phone               TEXT,
  orders_count        INTEGER     DEFAULT 0,
  total_spent         NUMERIC(12,2) DEFAULT 0,
  currency            TEXT,
  tags                TEXT[],
  state               TEXT,
  accepts_marketing   BOOLEAN     DEFAULT false,
  city                TEXT,
  province            TEXT,
  country             TEXT,
  country_code        TEXT,
  first_order_at      TIMESTAMPTZ,
  last_order_at       TIMESTAMPTZ,
  synced_at           TIMESTAMPTZ DEFAULT now(),
  created_at          TIMESTAMPTZ DEFAULT now(),
  updated_at          TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_id, shopify_customer_id)
);

CREATE INDEX IF NOT EXISTS customers_brand_id_idx
  ON customers(brand_id);
CREATE INDEX IF NOT EXISTS customers_email_idx
  ON customers(email);
CREATE INDEX IF NOT EXISTS customers_country_code_idx
  ON customers(country_code);
CREATE INDEX IF NOT EXISTS customers_brand_total_spent_idx
  ON customers(brand_id, total_spent DESC);

CREATE OR REPLACE TRIGGER customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand members can view their customers"
  ON customers FOR SELECT TO authenticated
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));

-- ─── orders ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS orders (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id              TEXT        NOT NULL REFERENCES brands(brand_id) ON DELETE CASCADE,
  shopify_order_id      TEXT        NOT NULL,
  shopify_order_number  TEXT,
  email                 TEXT,
  financial_status      TEXT,
  fulfillment_status    TEXT,
  currency              TEXT,
  total_price           NUMERIC(12,2),
  subtotal_price        NUMERIC(12,2),
  total_tax             NUMERIC(12,2),
  total_discounts       NUMERIC(12,2),
  total_shipping        NUMERIC(12,2),
  total_refunded        NUMERIC(12,2) DEFAULT 0,
  line_item_count       INTEGER,
  source_name           TEXT,
  tags                  TEXT[],
  customer_id           UUID        REFERENCES customers(id),
  shopify_customer_id   TEXT,
  order_created_at      TIMESTAMPTZ NOT NULL,
  order_updated_at      TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ DEFAULT now(),
  created_at            TIMESTAMPTZ DEFAULT now(),
  updated_at            TIMESTAMPTZ DEFAULT now(),
  UNIQUE(brand_id, shopify_order_id)
);

CREATE INDEX IF NOT EXISTS orders_brand_id_idx
  ON orders(brand_id);
CREATE INDEX IF NOT EXISTS orders_order_created_at_idx
  ON orders(order_created_at);
CREATE INDEX IF NOT EXISTS orders_financial_status_idx
  ON orders(financial_status);
CREATE INDEX IF NOT EXISTS orders_shopify_customer_id_idx
  ON orders(shopify_customer_id);
CREATE INDEX IF NOT EXISTS orders_brand_created_at_idx
  ON orders(brand_id, order_created_at DESC);

CREATE OR REPLACE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Brand members can view their orders"
  ON orders FOR SELECT TO authenticated
  USING (brand_id IN (SELECT brand_id FROM profiles WHERE id = auth.uid()));
