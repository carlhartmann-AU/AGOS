-- Fix invalid date-suffixed model IDs on 7 agents
-- Caught by QA regression test on 2026-04-27
-- Root cause: previous Claude Code session fabricated a date suffix from training-data memory
-- Correct pattern per Anthropic API docs: model strings are used as-is, no date suffix

UPDATE agent_config
SET llm_model = 'claude-sonnet-4-6',
    updated_at = NOW()
WHERE brand_id = 'plasmaide'
  AND agent_key IN ('compliance', 'content', 'customer_service', 'review_harvester', 'b2b_outreach', 'cfo', 'intelligence')
  AND llm_model = 'claude-sonnet-4-6-20250415';
