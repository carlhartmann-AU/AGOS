-- Migration: recover_stuck_blog_publish_pending
-- Blog rows at publish_pending were misrouted to the DotDigital n8n workflow
-- (wrong fallback, now removed in Prompt 1J). Reset them to 'approved' so they
-- can be re-approved via /approvals/web-designer/ with direct OAuth publish.

-- Step 1: Recover stuck blog publish_pending rows back to approved.
UPDATE content_queue
SET status = 'approved',
    updated_at = now()
WHERE content_type = 'blog'
  AND status = 'publish_pending';

-- Step 2: audit_log entries for traceability (one per recovered row).
INSERT INTO audit_log (
  brand_id,
  agent,
  action,
  tokens_in,
  tokens_out,
  status,
  input_summary,
  output_summary,
  created_at
)
SELECT
  brand_id,
  'migration',
  'content_publish_pending_recovered',
  0,
  0,
  'success',
  'reason=misrouted_n8n_fallback_cleanup previous_status=publish_pending recovered_to=approved',
  'content_id=' || id,
  now()
FROM content_queue
WHERE content_type = 'blog'
  AND status = 'approved'
  AND updated_at >= now() - interval '5 minutes';

-- Step 3: Diagnostic — blogs at 'approved' with no shopify_article_id.
-- Manual triage by Carl: pull back via dashboard, re-approve via /approvals/web-designer/.
SELECT
  id,
  brand_id,
  created_at,
  updated_at,
  content->>'title' AS title,
  LEFT(content->>'body_html', 100) AS body_preview,
  (
    SELECT COUNT(*)
    FROM audit_log
    WHERE input_summary LIKE '%' || content_queue.id::text || '%'
       OR output_summary LIKE '%' || content_queue.id::text || '%'
  ) AS audit_entry_count
FROM content_queue
WHERE content_type = 'blog'
  AND status = 'approved'
  AND (content->>'shopify_article_id') IS NULL
ORDER BY updated_at DESC NULLS LAST;

-- Step 4: Verification.
SELECT
  'blog_publish_pending_remaining' AS check_name,
  count(*) AS result
FROM content_queue
WHERE content_type = 'blog'
  AND status = 'publish_pending';
-- Expected: 0

SELECT
  'blog_recovered_audit_entries' AS check_name,
  count(*) AS result
FROM audit_log
WHERE action = 'content_publish_pending_recovered'
  AND created_at >= now() - interval '5 minutes';
-- Expected: equal to the rowcount of the Step 1 UPDATE.
