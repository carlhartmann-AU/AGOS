#!/bin/bash
source "$(dirname "$0")/config.sh"

echo "=== Integration State Consistency ==="

# Shopify state must be consistent across shopify_connections and brand_integrations
shopify_conn=$(db_query "shopify_connections" "brand_id=eq.plasmaide&select=access_token,scopes,sync_status,last_sync_at")
shopify_bi=$(db_query "brand_integrations" "brand_id=eq.plasmaide&integration_slug=eq.shopify&select=status,data_roles_active")

conn_len=$(json_len "$shopify_conn")
bi_len=$(json_len "$shopify_bi")

if [ "$conn_len" = "0" ] && [ "$bi_len" = "0" ]; then
  warn "Shopify: no connection or brand_integrations row — fully disconnected"
elif [ "$conn_len" = "0" ] && [ "$bi_len" -gt 0 ]; then
  bi_status=$(echo "$shopify_bi" | jq -r '.[0].status')
  if [ "$bi_status" = "disconnected" ]; then
    pass "Shopify: no connection row, brand_integrations=disconnected (consistent)"
  else
    fail "Shopify state" "No connection row but brand_integrations.status=${bi_status}"
  fi
else
  has_token=$(echo "$shopify_conn" | jq -r '.[0].access_token // ""')
  bi_status=$(echo "$shopify_bi" | jq -r '.[0].status // "missing"')

  if [ -n "$has_token" ] && [ "$has_token" != "null" ] && [ "$bi_status" = "connected" ]; then
    pass "Shopify: token present AND brand_integrations=connected"

    # If connected, verify scopes include write_content (required for blog publishing)
    scopes=$(echo "$shopify_conn" | jq -r '.[0].scopes // ""')
    if echo "$scopes" | grep -q "write_content"; then
      pass "Shopify scopes include write_content"
    else
      fail "Shopify scopes" "write_content missing — blog publishing will fail"
    fi

    # Verify data_roles_active includes commerce_data (KPI source resolution)
    roles=$(echo "$shopify_bi" | jq -r '.[0].data_roles_active // [] | tostring')
    if echo "$roles" | grep -q "commerce_data"; then
      pass "Shopify data_roles_active includes commerce_data"
    else
      fail "Shopify data roles" "commerce_data not in data_roles_active — KPIs will not resolve"
    fi
  elif [ -z "$has_token" ] || [ "$has_token" = "null" ]; then
    if [ "$bi_status" = "disconnected" ]; then
      pass "Shopify: empty token AND brand_integrations=disconnected"
    else
      # THIS IS THE REGRESSION — see regression/shopify_connected_with_empty_token.sh
      fail "Shopify state" "Empty token but brand_integrations.status=${bi_status} — REGRESSION"
    fi
  else
    fail "Shopify state" "Inconsistent: token=$([ -n "$has_token" ] && echo present || echo empty), bi_status=${bi_status}"
  fi
fi

# Xero connection (informational)
xero_bi=$(db_query "brand_integrations" "brand_id=eq.plasmaide&integration_slug=eq.xero&select=status")
if [ "$(json_len "$xero_bi")" -gt 0 ]; then
  xero_status=$(echo "$xero_bi" | jq -r '.[0].status')
  if [ "$xero_status" = "connected" ]; then
    pass "Xero brand_integrations=connected"
  else
    warn "Xero brand_integrations.status=${xero_status}"
  fi
else
  warn "Xero brand_integrations row missing"
fi

# At least 5 integrations registered for Plasmaide
bi_count=$(count_query "brand_integrations" "brand_id=eq.plasmaide")
if [ -n "$bi_count" ] && [ "$bi_count" -ge 5 ] 2>/dev/null; then
  pass "brand_integrations has ${bi_count} rows for plasmaide (>= 5)"
else
  fail "brand_integrations count" "Expected >= 5, got '${bi_count}'"
fi

# No duplicate integration slugs per brand
all_slugs=$(db_query "brand_integrations" "brand_id=eq.plasmaide&select=integration_slug")
dupes=$(echo "$all_slugs" | jq -r '[.[].integration_slug] | group_by(.) | map(select(length > 1)) | map(.[0]) | join(",")')
if [ -z "$dupes" ]; then
  pass "No duplicate integration slugs"
else
  fail "Duplicate integration slugs" "$dupes"
fi

summary
