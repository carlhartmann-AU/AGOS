-- Add hero image columns to content_queue (v1: one hero image per article, nullable).
-- Additive only — no existing columns altered, no RLS changes needed.
-- New columns inherit existing content_queue JWT-claim brand_id policy automatically.

ALTER TABLE content_queue
  ADD COLUMN IF NOT EXISTS hero_image_url    TEXT NULL,
  ADD COLUMN IF NOT EXISTS hero_image_status TEXT NULL,
  ADD COLUMN IF NOT EXISTS hero_image_file_id TEXT NULL;

COMMENT ON COLUMN content_queue.hero_image_status IS
  'NULL | uploaded | failed — soft-fail soft-proceed pattern';

-- Verification
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'content_queue'
  AND column_name LIKE 'hero_image%'
ORDER BY column_name;
