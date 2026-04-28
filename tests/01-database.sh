#!/bin/bash
source "$(dirname "$0")/config.sh"

echo "=== Database Integrity ==="

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
  echo "ERROR: SUPABASE_SERVICE_ROLE_KEY not set in .env.test"
  exit 2
fi

# Required tables — query returns error JSON if table missing
for table in brands profiles content_queue products product_variants \
  orders customers shopify_connections xero_connections agent_config \
  integration_registry brand_integrations plans plan_agents \
  intelligence_reports intelligence_alerts compliance_checks \
  financial_snapshots coo_conversations coo_messages b2b_prospects; do

  result=$(db_query "$table" "select=*&limit=1")
  # PostgREST returns {"code":...} on error, [] or [{...}] on success
  if echo "$result" | jq -e 'type == "array"' >/dev/null 2>&1; then
    pass "Table ${table} exists"
  else
    fail "Table ${table} exists" "PostgREST error: $(echo $result | jq -r '.message // "unknown"' 2>/dev/null)"
  fi
done

# Brand row exists with TEXT slug id
result=$(db_query "brands" "brand_id=eq.plasmaide&select=brand_id,name")
if [ "$(json_len "$result")" -gt 0 ]; then
  pass "Brand 'plasmaide' exists as TEXT slug"
else
  fail "Brand 'plasmaide' exists" "Not found — possible UUID/slug mismatch"
fi

# brand_id type guard — verify TEXT slug, not UUID, across key tables
# Catches future migrations that accidentally create UUID brand_id columns
for table in orders customers products content_queue agent_config brand_integrations; do
  sample=$(db_query "$table" "brand_id=eq.plasmaide&select=brand_id&limit=1")
  if [ "$(json_len "$sample")" = "0" ]; then
    warn "${table}: no rows for plasmaide — cannot verify brand_id type"
    continue
  fi
  brand_id_val=$(echo "$sample" | jq -r '.[0].brand_id')
  # UUID pattern: 8-4-4-4-12 hex chars
  if [[ "$brand_id_val" =~ ^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$ ]]; then
    fail "${table}.brand_id is TEXT slug" "Got UUID format: ${brand_id_val}"
  elif [ "$brand_id_val" = "plasmaide" ]; then
    pass "${table}.brand_id is TEXT slug"
  else
    warn "${table}.brand_id unexpected value: ${brand_id_val}"
  fi
done

# Integration registry: assert minimum count, not exact, so adding new integrations doesn't break tests
count=$(count_query "integration_registry" "select=id")
if [ -n "$count" ] && [ "$count" -ge 24 ] 2>/dev/null; then
  pass "Integration registry has ${count} entries (>= 24)"
else
  fail "Integration registry count" "Expected >= 24, got '${count}'"
fi

# Agent config: verify all 8 expected keys exist (specific check below in 03-agents.sh)
# Here just confirm at least 8 rows for plasmaide
count=$(count_query "agent_config" "brand_id=eq.plasmaide")
if [ -n "$count" ] && [ "$count" -ge 8 ] 2>/dev/null; then
  pass "agent_config has ${count} rows for plasmaide (>= 8)"
else
  fail "agent_config count" "Expected >= 8, got '${count}'"
fi

# Data presence (informational — empty is a warning, not failure)
for table in orders customers products; do
  count=$(count_query "$table" "brand_id=eq.plasmaide")
  if [ -n "$count" ] && [ "$count" -gt 0 ] 2>/dev/null; then
    pass "${table} has ${count} rows for plasmaide"
  else
    warn "${table} empty for plasmaide — sync may not have run"
  fi
done

summary
