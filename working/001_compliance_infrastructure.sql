-- Migration: Compliance Agent infrastructure
-- Run against Supabase project: wgfrtkezensrxcjoplih

-- ============================================================================
-- 1. compliance_checks: audit trail for every compliance evaluation
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.compliance_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID NOT NULL REFERENCES public.content_queue(id) ON DELETE CASCADE,
  brand_id TEXT NOT NULL,

  -- Overall outcome
  overall_status TEXT NOT NULL CHECK (overall_status IN ('passed', 'warnings', 'escalated', 'blocked')),
  auto_fixes_applied INTEGER NOT NULL DEFAULT 0,
  content_modified BOOLEAN NOT NULL DEFAULT false,

  -- Counts by severity (denormalised for quick dashboard queries)
  minor_count INTEGER NOT NULL DEFAULT 0,
  major_count INTEGER NOT NULL DEFAULT 0,
  critical_count INTEGER NOT NULL DEFAULT 0,

  -- Full rule results (JSONB array of RuleResult)
  rule_results JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Content snapshot: what was evaluated and what was produced
  input_content JSONB NOT NULL,
  output_content JSONB, -- Only set if content_modified=true

  -- Cost tracking
  tokens_input INTEGER NOT NULL DEFAULT 0,
  tokens_output INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  estimated_cost_usd NUMERIC(10, 6) DEFAULT 0,

  -- Metadata
  rule_packs_used TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  triggered_by TEXT NOT NULL DEFAULT 'system' CHECK (triggered_by IN ('system', 'manual', 'retry')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_checks_content ON public.compliance_checks(content_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_brand ON public.compliance_checks(brand_id);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_status ON public.compliance_checks(overall_status);
CREATE INDEX IF NOT EXISTS idx_compliance_checks_created ON public.compliance_checks(created_at DESC);

-- ============================================================================
-- 2. rule_packs: library of pre-built rule packs
-- Seeded in code/seed file; brands reference by pack_id in brand_settings
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.rule_packs (
  id TEXT PRIMARY KEY, -- e.g. 'health_supplements_au'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  jurisdiction TEXT,
  category TEXT NOT NULL,
  rules JSONB NOT NULL DEFAULT '[]'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ============================================================================
-- 3. content_queue: add compliance state tracking
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='content_queue' AND column_name='compliance_status') THEN
    ALTER TABLE public.content_queue ADD COLUMN compliance_status TEXT
      CHECK (compliance_status IN ('pending', 'passed', 'warnings', 'escalated', 'blocked', 'skipped'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='content_queue' AND column_name='latest_compliance_check_id') THEN
    ALTER TABLE public.content_queue ADD COLUMN latest_compliance_check_id UUID
      REFERENCES public.compliance_checks(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- 4. RLS policies
-- ============================================================================
ALTER TABLE public.compliance_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rule_packs ENABLE ROW LEVEL SECURITY;

-- compliance_checks: brand members can read their brand's checks
CREATE POLICY "Brand members can view compliance checks"
  ON public.compliance_checks FOR SELECT
  USING (
    brand_id IN (
      SELECT brand_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- rule_packs: everyone authenticated can read active packs
CREATE POLICY "Authenticated users can view active rule packs"
  ON public.rule_packs FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = true);

-- Writes happen via service role only (no policies needed for service role)

-- ============================================================================
-- 5. updated_at trigger for rule_packs
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_rule_packs_updated_at ON public.rule_packs;
CREATE TRIGGER update_rule_packs_updated_at
  BEFORE UPDATE ON public.rule_packs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
