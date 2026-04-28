#!/bin/bash
# Bug: brand_integrations.status was 'connected' while shopify_connections.access_token was ''
# Fix: connection state must reconcile — empty token implies disconnected

source "$(dirname "$0")/../config.sh"

echo "=== REGRESSION: Shopify connected with empty token ==="

conn=$(db_query "shopify_connections" "brand_id=eq.plasmaide&select=access_token")
bi=$(db_query "brand_integrations" "brand_id=eq.plasmaide&integration_slug=eq.shopify&select=status")

# Only meaningful if both rows exist
if [ "$(json_len "$conn")" -gt 0 ] && [ "$(json_len "$bi")" -gt 0 ]; then
  token=$(echo "$conn" | jq -r '.[0].access_token // ""')
  status=$(echo "$bi" | jq -r '.[0].status')

  if { [ -z "$token" ] || [ "$token" = "null" ]; } && [ "$status" = "connected" ]; then
    fail "REGRESSION RETURNED" "shopify_connections.access_token is empty but brand_integrations.status=connected"
  else
    pass "Shopify token/status reconciled correctly"
  fi
else
  warn "Cannot test — connection or brand_integrations row missing"
fi

summary
