#!/bin/bash
source "$(dirname "$0")/config.sh"

echo "=== API Endpoint Smoke Tests ==="

# Most endpoints require session auth — we can only verify they don't 500 and they reject bad auth
# Real authenticated endpoint testing requires browser-based suite (future Playwright work)

protected_endpoints=(
  "/api/kpis?brand_id=plasmaide&window=7d"
  "/api/integrations/registry?brand_id=plasmaide"
  "/api/integrations/shopify/status?brand_id=plasmaide"
  "/api/dashboard/shopify-metrics"
  "/api/compliance/check"
  "/api/coo/chat"
)

for endpoint in "${protected_endpoints[@]}"; do
  status=$(api_get_status "$endpoint")
  case "$status" in
    500|502|503)
      fail "Endpoint ${endpoint}" "Returned ${status} (server error)"
      ;;
    000)
      fail "Endpoint ${endpoint}" "Connection failed — is the deployment up?"
      ;;
    200|307|401|403)
      pass "Endpoint ${endpoint} returns ${status} (no server error)"
      ;;
    *)
      warn "Endpoint ${endpoint} returned unexpected ${status}"
      ;;
  esac
done

# Cron auth: test rejection only — never EXECUTE cron endpoints in tests
# (executing them would hammer Shopify and run real syncs)
cron_endpoints=(
  "/api/cron/shopify-product-sync"
)

for endpoint in "${cron_endpoints[@]}"; do
  # No auth header → should reject
  status=$(api_get_status "$endpoint")
  if [ "$status" = "401" ] || [ "$status" = "403" ]; then
    pass "Cron ${endpoint} rejects unauthenticated request (${status})"
  else
    fail "Cron ${endpoint} auth" "Expected 401/403 without auth, got ${status}"
  fi

  # Bad CRON_SECRET → should reject
  status=$(api_get_with_bad_cron "$endpoint")
  if [ "$status" = "401" ] || [ "$status" = "403" ]; then
    pass "Cron ${endpoint} rejects bad CRON_SECRET (${status})"
  else
    fail "Cron ${endpoint} auth" "Expected 401/403 with bad secret, got ${status}"
  fi
done

# Cache-Control header tests deferred until we have authenticated session testing
# (unauthenticated requests follow redirects to login and don't return the headers we set)

summary
