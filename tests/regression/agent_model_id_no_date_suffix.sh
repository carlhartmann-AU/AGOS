#!/bin/bash
# Bug: agent_config.llm_model had values like claude-sonnet-4-6-20250415 (pinned date suffix)
# which are not valid Anthropic API model IDs — the correct IDs are claude-sonnet-4-6 etc.
# Fix: model IDs must match real Anthropic model strings without trailing date suffixes

source "$(dirname "$0")/../config.sh"

echo "=== REGRESSION: Agent model IDs have no invalid date suffix ==="

agents=$(db_query "agent_config" "brand_id=eq.plasmaide&select=agent_key,llm_model")
bad=$(echo "$agents" | jq -r '[.[] | select(.llm_model // "" | test("20250415|20250416|20250417"))] | map(.agent_key + "=" + .llm_model) | join(", ")')

if [ -z "$bad" ]; then
  pass "No agents have invalid date-suffixed model IDs"
else
  fail "REGRESSION RETURNED" "Invalid model IDs: ${bad}"
fi

summary
