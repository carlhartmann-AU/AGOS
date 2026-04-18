-- ─── brand_settings table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS brand_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id TEXT NOT NULL UNIQUE,

  content_schedule JSONB DEFAULT '{
    "enabled": false,
    "frequency": "daily",
    "time": "08:00",
    "timezone": "Australia/Sydney",
    "content_types": ["blog"],
    "topics_queue": [],
    "auto_approve": false
  }'::jsonb,

  llm_provider TEXT DEFAULT 'anthropic',
  llm_model TEXT DEFAULT 'claude-sonnet-4-6',
  llm_api_key_encrypted TEXT,

  integrations JSONB DEFAULT '{
    "shopify": { "connected": false, "store_url": null, "blog_id": null },
    "dotdigital": { "connected": false, "endpoint": null },
    "gorgias": { "connected": false },
    "triple_whale": { "connected": false },
    "n8n_webhook_base": null
  }'::jsonb,

  plan TEXT DEFAULT 'starter' CHECK (plan IN ('starter', 'growth', 'scale', 'enterprise')),
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  subscription_status TEXT DEFAULT 'trialing' CHECK (subscription_status IN (
    'trialing', 'active', 'past_due', 'canceled', 'unpaid'
  )),
  trial_ends_at TIMESTAMPTZ DEFAULT (now() + interval '14 days'),

  generations_this_month INTEGER DEFAULT 0,
  generations_reset_at TIMESTAMPTZ DEFAULT date_trunc('month', now()) + interval '1 month',

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE brand_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read brand_settings"
  ON brand_settings FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can insert brand_settings"
  ON brand_settings FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update brand_settings"
  ON brand_settings FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Seed Plasmaide defaults
INSERT INTO brand_settings (brand_id)
VALUES ('plasmaide')
ON CONFLICT (brand_id) DO NOTHING;

-- updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS brand_settings_updated_at ON brand_settings;
CREATE TRIGGER brand_settings_updated_at
  BEFORE UPDATE ON brand_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ─── profiles table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  brand_id TEXT NOT NULL DEFAULT 'plasmaide',
  role TEXT NOT NULL DEFAULT 'viewer' CHECK (role IN ('admin', 'approver', 'viewer')),
  invited_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Users can always read their own profile
CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can read all profiles in their brand
CREATE POLICY "Admins can read brand profiles"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.brand_id = profiles.brand_id
        AND p.role = 'admin'
    )
  );

-- Admins can update any profile in their brand
CREATE POLICY "Admins can update brand profiles"
  ON profiles FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.brand_id = profiles.brand_id
        AND p.role = 'admin'
    )
  );

-- Admins can delete members from their brand (except themselves)
CREATE POLICY "Admins can delete brand profiles"
  ON profiles FOR DELETE
  USING (
    auth.uid() != id AND
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.brand_id = profiles.brand_id
        AND p.role = 'admin'
    )
  );

-- Allow insert from the trigger (SECURITY DEFINER bypasses RLS)
CREATE POLICY "Service role can insert profiles"
  ON profiles FOR INSERT
  WITH CHECK (true);


-- ─── Auto-create profile on auth.users insert ──────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, brand_id, role)
  VALUES (NEW.id, NEW.email, 'plasmaide', 'admin')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ─── Backfill profiles for existing users ─────────────────────────────────────

INSERT INTO profiles (id, email, brand_id, role)
SELECT id, email, 'plasmaide', 'admin'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
