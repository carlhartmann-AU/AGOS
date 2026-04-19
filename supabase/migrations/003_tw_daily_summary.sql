-- Triple Whale daily summary cache
CREATE TABLE IF NOT EXISTS tw_daily_summary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  shop_domain text NOT NULL,
  date date NOT NULL,
  revenue numeric,
  orders integer,
  aov numeric,
  new_customer_orders integer,
  new_customer_revenue numeric,
  returning_customer_orders integer,
  returning_customer_revenue numeric,
  synced_at timestamptz DEFAULT now(),
  UNIQUE(shop_domain, date)
);

ALTER TABLE tw_daily_summary ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated access"
  ON tw_daily_summary FOR ALL
  USING (auth.role() = 'authenticated');
