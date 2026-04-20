-- Add fiscal year config to brand_settings
ALTER TABLE brand_settings
  ADD COLUMN IF NOT EXISTS fy_config JSONB
    DEFAULT '{"type":"au","start_month":7,"start_day":1,"end_month":6,"end_day":30}'::jsonb;

-- Seed Plasmaide with Australian FY
UPDATE brand_settings
SET fy_config = '{"type":"au","start_month":7,"start_day":1,"end_month":6,"end_day":30}'::jsonb
WHERE brand_id = 'plasmaide';
