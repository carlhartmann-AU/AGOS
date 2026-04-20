-- Migration 004: FX rate storage on tw_daily_summary + display currency on brand_settings
-- Additive only; safe to run on existing data.

-- ============================================================================
-- 1. tw_daily_summary: add source_currency + fx_rates
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='tw_daily_summary' AND column_name='source_currency') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN source_currency TEXT DEFAULT 'GBP';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='tw_daily_summary' AND column_name='fx_rates') THEN
    ALTER TABLE public.tw_daily_summary ADD COLUMN fx_rates JSONB;
  END IF;
END $$;

-- ============================================================================
-- 2. brand_settings: add display_currency
-- ============================================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='brand_settings' AND column_name='display_currency') THEN
    ALTER TABLE public.brand_settings ADD COLUMN display_currency TEXT DEFAULT 'USD';
  END IF;
END $$;

-- ============================================================================
-- 3. Set Plasmaide's display currency to AUD
-- ============================================================================
UPDATE public.brand_settings
SET display_currency = 'AUD'
WHERE brand_id = 'plasmaide';
