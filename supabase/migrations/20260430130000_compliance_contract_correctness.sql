-- Migration: 20260430130000_compliance_contract_correctness.sql
-- Purpose: Enforce QA contracts 1-4 for compliance posture on every content_queue row.
-- Contract 1: Coverage — every row gets a compliance_checks row (or documented reason it didn't).
-- Contract 2: No silent skip — compliance_status NOT NULL + CHECK enforced going forward.
-- Contract 3: Audit trail — dispatcher writes audit_log on every evaluation.
-- Contract 4: Retroactive liveness — pending_retroactive rows tracked via new column.
--
-- Pre-flight findings that deviate from original spec:
--   - Existing CHECK content_queue_compliance_status_check must be dropped first (Step 0 added).
--   - Compliance engine outputs 'passed'/'warnings'/'escalated', not 'pass'/'pass_with_warnings'/'fail'.
--   - agent_config INSERT requires display_name (NOT NULL) and uses 'settings' not 'data'.
--   - 0 NULL rows have latest_compliance_check_id set — Step 1 updates 0 rows today.
--   - Step 6 is a no-op today (plasmaide compliance already enabled=true); guards future brands.

-- ─── Step 0: Drop existing CHECK to allow extended vocabulary ─────────────────
ALTER TABLE content_queue DROP CONSTRAINT content_queue_compliance_status_check;

-- ─── Step 1: Backfill compliance_status from compliance_checks FK ─────────────
-- Touches only NULL rows where latest_compliance_check_id points to a compliance_checks row.
-- Uses actual engine output values in the CASE (passed/warnings/escalated), not spec aliases.
UPDATE content_queue cq
SET compliance_status = CASE cck.overall_status
    WHEN 'passed'    THEN 'passed'
    WHEN 'warnings'  THEN 'passed_with_warnings'
    WHEN 'escalated' THEN 'escalated'
    WHEN 'fail'      THEN 'blocked'
    WHEN 'error'     THEN 'errored'
    ELSE 'legacy_unverified'
  END,
  updated_at = now()
FROM compliance_checks cck
WHERE cq.latest_compliance_check_id = cck.id
  AND cq.compliance_status IS NULL;

-- ─── Step 2: Remaining NULLs → legacy_unverified ─────────────────────────────
UPDATE content_queue
SET compliance_status = 'legacy_unverified',
    updated_at = now()
WHERE compliance_status IS NULL;

-- ─── Step 3: Add retroactive tracking column ──────────────────────────────────
ALTER TABLE content_queue
  ADD COLUMN retroactive_started_at TIMESTAMPTZ NULL;

-- ─── Step 4: New CHECK constraint + NOT NULL ──────────────────────────────────
ALTER TABLE content_queue
  ADD CONSTRAINT compliance_status_valid
  CHECK (compliance_status IN (
    'passed',
    'passed_with_warnings',
    'warnings',              -- legacy engine value (maps to passed_with_warnings via dispatcher)
    'escalated',             -- compliance engine escalation requiring human review
    'blocked',               -- content blocked by compliance
    'skipped',               -- legacy pre-dispatcher skip (backward compat)
    'errored',
    'skipped_by_config',
    'skipped_by_error',
    'pending',
    'pending_async',
    'legacy_unverified',
    'pending_retroactive'
  ));

ALTER TABLE content_queue
  ALTER COLUMN compliance_status SET NOT NULL;

-- ─── Step 5: Indexes ─────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_content_queue_compliance_status
  ON content_queue (compliance_status, brand_id);

CREATE INDEX IF NOT EXISTS idx_content_queue_retroactive_stuck
  ON content_queue (compliance_status, retroactive_started_at)
  WHERE compliance_status = 'pending_retroactive';

-- ─── Step 6: Agent config defensive flip ─────────────────────────────────────
-- Ensure every brand has a compliance agent_config row with enabled=true.
-- No-op today (plasmaide already has enabled=true). Guards future brands
-- onboarded before seedBrandDefaults is called.
UPDATE agent_config
SET enabled = true, updated_at = now()
WHERE agent_key = 'compliance'
  AND enabled = false;

INSERT INTO agent_config (
  brand_id, agent_key, display_name, enabled, settings, created_at, updated_at
)
SELECT
  b.brand_id,
  'compliance',
  'Compliance Agent',
  true,
  '{}'::jsonb,
  now(),
  now()
FROM brands b
WHERE NOT EXISTS (
  SELECT 1 FROM agent_config ac
  WHERE ac.brand_id = b.brand_id AND ac.agent_key = 'compliance'
)
ON CONFLICT (brand_id, agent_key) DO NOTHING;

-- ─── Step 7: Verification SELECTs (paste output in build report) ──────────────

-- 7a: compliance_status distribution — should show legacy_unverified for ~24 rows
SELECT compliance_status, count(*) AS row_count
FROM content_queue
GROUP BY compliance_status
ORDER BY compliance_status;

-- 7b: compliance agent enabled per brand
SELECT brand_id, enabled
FROM agent_config
WHERE agent_key = 'compliance'
ORDER BY brand_id;

-- 7c: new CHECK constraint exists
SELECT conname, contype, pg_get_constraintdef(oid) AS consrc
FROM pg_constraint
WHERE conrelid = 'content_queue'::regclass
  AND conname = 'compliance_status_valid';

-- 7d: compliance_status NOT NULL, retroactive_started_at nullable
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'content_queue'
  AND column_name IN ('compliance_status', 'retroactive_started_at')
ORDER BY column_name;

-- 7e: both new indexes present
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'content_queue'
  AND indexname IN (
    'idx_content_queue_compliance_status',
    'idx_content_queue_retroactive_stuck'
  );
