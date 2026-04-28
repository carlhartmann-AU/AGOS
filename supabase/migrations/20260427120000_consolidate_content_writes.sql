-- Migration: consolidate_content_writes
-- Adds audit_log index for query performance.
-- Drops vestigial generation-quota infrastructure (columns + undeployed RPC).

-- Step 1: Diagnostic — does an index exist on audit_log (brand_id, created_at)?
DO $$
DECLARE
  idx_count integer;
BEGIN
  SELECT count(*) INTO idx_count
  FROM pg_indexes
  WHERE tablename = 'audit_log'
    AND indexdef ILIKE '%brand_id%'
    AND indexdef ILIKE '%created_at%';
  IF idx_count > 0 THEN
    RAISE NOTICE 'audit_log already has a (brand_id, created_at) index variant — skipping create';
  ELSE
    RAISE NOTICE 'audit_log lacks a (brand_id, created_at) index — creating';
  END IF;
END $$;

-- Step 2: Conditionally create audit_log index
CREATE INDEX IF NOT EXISTS audit_log_brand_id_created_at_idx
  ON audit_log (brand_id, created_at DESC);

-- Step 3: Drop vestigial generation-quota infrastructure
ALTER TABLE brand_settings DROP COLUMN IF EXISTS generations_this_month;
ALTER TABLE brand_settings DROP COLUMN IF EXISTS generations_reset_at;
DROP FUNCTION IF EXISTS increment_generations(text);

-- Step 4: Verification SELECTs
SELECT
  'audit_log_index' AS check_name,
  count(*) AS result
FROM pg_indexes
WHERE tablename = 'audit_log'
  AND indexdef ILIKE '%brand_id%'
  AND indexdef ILIKE '%created_at%';
-- Expected: result >= 1

SELECT
  'vestigial_columns_dropped' AS check_name,
  count(*) AS result
FROM information_schema.columns
WHERE table_name = 'brand_settings'
  AND column_name IN ('generations_this_month', 'generations_reset_at');
-- Expected: result = 0

SELECT
  'rpc_dropped' AS check_name,
  count(*) AS result
FROM pg_proc
WHERE proname = 'increment_generations';
-- Expected: result = 0
