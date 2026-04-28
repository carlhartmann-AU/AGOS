#!/bin/bash
source "$(dirname "$0")/config.sh"

echo "=== KPI Data Pipeline ==="

# Skip gracefully if no orders exist
order_count=$(count_query "orders" "brand_id=eq.plasmaide")
if [ -z "$order_count" ] || [ "$order_count" = "0" ]; then
  warn "No orders for plasmaide — KPI pipeline tests skipped"
  summary
fi

pass "Orders exist for plasmaide (${order_count} rows)"

# Sample orders to inspect financial_status and currency variety
sample=$(db_query "orders" "brand_id=eq.plasmaide&select=financial_status,currency,total_price&limit=200")

statuses=$(echo "$sample" | jq -r '[.[].financial_status // empty] | unique | join(",")')
if [ -n "$statuses" ]; then
  pass "Orders financial_status values: ${statuses}"
else
  warn "No orders have financial_status set"
fi

currencies=$(echo "$sample" | jq -r '[.[].currency // empty] | unique | join(",")')
if [ -n "$currencies" ]; then
  pass "Orders currency values: ${currencies}"
else
  warn "No orders have currency set"
fi

# No orders with null total_price (would break revenue calculations)
null_price_count=$(count_query "orders" "brand_id=eq.plasmaide&total_price=is.null")
if [ "$null_price_count" = "0" ]; then
  pass "No orders with null total_price"
else
  fail "Null total_price" "${null_price_count} orders have null total_price"
fi

# Data source resolution: Shopify must be active for commerce_data role
shopify_roles=$(db_query "brand_integrations" "brand_id=eq.plasmaide&integration_slug=eq.shopify&select=data_roles_active,status")
if [ "$(json_len "$shopify_roles")" -gt 0 ]; then
  status=$(echo "$shopify_roles" | jq -r '.[0].status')
  has_role=$(echo "$shopify_roles" | jq -r '.[0].data_roles_active // [] | tostring' | grep -c "commerce_data")
  if [ "$status" = "connected" ] && [ "$has_role" -gt 0 ]; then
    pass "KPI source: Shopify connected and active for commerce_data"
  elif [ "$status" != "connected" ]; then
    warn "Shopify not connected (status=${status}) — KPIs will fall back"
  else
    fail "KPI source resolution" "Shopify connected but not active for commerce_data"
  fi
else
  warn "No Shopify brand_integrations row — KPI source resolution will fail"
fi

summary
