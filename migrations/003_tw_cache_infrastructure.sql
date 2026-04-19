-- Migration: Triple Whale caching layer enhancements
-- Assumes tw_daily_summary exists from earlier work. Additive only.

-- ============================================================================
-- 1. Ensure tw_daily_summary has all the columns we need
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='brand_id') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN brand_id UUID REFERENCES public.brand_settings(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='date') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN date DATE NOT NULL DEFAULT CURRENT_DATE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='revenue') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN revenue NUMERIC(12, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='orders') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN orders INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='aov') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN aov NUMERIC(10, 2) DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='new_customers') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN new_customers INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='returning_customers') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN returning_customers INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='raw_response') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN raw_response JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='tw_daily_summary' AND column_name='synced_at') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN synced_at TIMESTAMPTZ NOT NULL DEFAULT now();
  END IF;
END $$;

-- Unique constraint — one row per brand per day
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tw_daily_summary_brand_date_unique'
  ) THEN
    ALTER TABLE public.tw_daily_summary
      ADD CONSTRAINT tw_daily_summary_brand_date_unique UNIQUE (brand_id, date);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_tw_daily_summary_brand_date
  ON public.tw_daily_summary(brand_id, date DESC);

-- ============================================================================
-- 2. tw_sync_log — audit trail for every sync attempt
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.tw_sync_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id UUID NOT NULL REFERENCES public.brand_settings(id) ON DELETE CASCADE,

  triggered_by TEXT NOT NULL CHECK (triggered_by IN ('cron', 'manual', 'backfill', 'cold_start')),
  status TEXT NOT NULL CHECK (status IN ('success', 'partial', 'failed')),

  days_synced INTEGER NOT NULL DEFAULT 0,
  errors JSONB,                    -- Array of { endpoint, error } if partial/failed

  duration_ms INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tw_sync_log_brand_time
  ON public.tw_sync_log(brand_id, started_at DESC);

-- ============================================================================
-- 3. RLS
-- ============================================================================
ALTER TABLE public.tw_daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tw_sync_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Brand members can view TW summary" ON public.tw_daily_summary;
CREATE POLICY "Brand members can view TW summary"
  ON public.tw_daily_summary FOR SELECT
  USING (
    brand_id IN (SELECT brand_id FROM public.profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "Brand members can view TW sync log" ON public.tw_sync_log;
CREATE POLICY "Brand members can view TW sync log"
  ON public.tw_sync_log FOR SELECT
  USING (
    brand_id IN (SELECT brand_id FROM public.profiles WHERE id = auth.uid())
  );

-- ============================================================================
-- 4. Helper view: latest sync per brand (used by UI for "Last updated X ago")
-- ============================================================================
CREATE OR REPLACE VIEW public.tw_latest_sync AS
SELECT DISTINCT ON (brand_id)
  brand_id,
  started_at,
  completed_at,
  status,
  triggered_by
FROM public.tw_sync_log
ORDER BY brand_id, started_at DESC;
