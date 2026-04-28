#!/bin/bash
source "$(dirname "$0")/config.sh"

echo "=== Agent Configuration ==="

# All 8 expected agent keys must exist
expected_keys=(compliance intelligence cfo coo content b2b_outreach customer_service review_harvester)
for key in "${expected_keys[@]}"; do
  result=$(db_query "agent_config" "brand_id=eq.plasmaide&agent_key=eq.${key}&select=agent_key,enabled,llm_model")
  if [ "$(json_len "$result")" -gt 0 ]; then
    pass "Agent config exists: ${key}"
  else
    fail "Agent config missing" "${key} not found for plasmaide"
  fi
done

# Verify no agent has the known-bad date-suffixed model ID
all_agents=$(db_query "agent_config" "brand_id=eq.plasmaide&select=agent_key,llm_model")
bad_models=$(echo "$all_agents" | jq -r '[.[] | select(.llm_model // "" | test("20250415|20250416|20250417"))] | map(.agent_key + "=" + .llm_model) | join(", ")')
if [ -z "$bad_models" ]; then
  pass "No agents have invalid date-suffixed model IDs"
else
  fail "Invalid model IDs" "Agents with bad model: ${bad_models}"
fi

# Verify all enabled agents have a non-null model
null_models=$(echo "$all_agents" | jq -r '[.[] | select(.llm_model == null or .llm_model == "")] | map(.agent_key) | join(",")')
if [ -z "$null_models" ]; then
  pass "All agents have llm_model set"
else
  warn "Agents with null/empty llm_model: ${null_models}"
fi

# Brand has a plan assigned
plan=$(db_query "brands" "brand_id=eq.plasmaide&select=plan_id")
plan_id=$(echo "$plan" | jq -r 'if type=="array" and length>0 then .[0].plan_id // "" else "" end' 2>/dev/null)
if [ -n "$plan_id" ] && [ "$plan_id" != "null" ]; then
  pass "Plasmaide has plan_id: ${plan_id}"
else
  warn "Plasmaide has no plan_id"
fi

summary
