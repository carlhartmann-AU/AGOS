#!/bin/bash
source "$(dirname "$0")/../config.sh"

echo "=== Phase 1: Shopify OAuth Capability Test ==="

# MULTI-TENANT NOTE: This test is currently single-tenant (Plasmaide only).
# When Folle onboards in January 2027, parameterise BRAND_ID and SHOP_DOMAIN
# from arguments and run this script once per brand. Expected green for each.
# Any test brand ('qa_test') would need a real Shopify dev store to be useful —
# mocking the Shopify Admin API is out of scope for this layer of testing.

EXPECTED_SHOP_DOMAIN="plasmaide-uk.myshopify.com"
EXPECTED_BLOG_ID="97071792413"
EXPECTED_BLOG_NAME="Newsroom"
EXPECTED_API_VERSION="2026-04"

# State for trap cleanup
CREATED_ARTICLE_ID=""

# Per-run header capture file (mktemp prevents races on concurrent runs)
HEADER_FILE=$(mktemp /tmp/shopify_phase1_headers_XXXXXX)

# Trap fires on script exit (success, failure, or interrupt).
# Guard logic:
#   - If Check 5a never set CREATED_ARTICLE_ID, the variable is empty → no-op
#   - If Check 5c succeeded and explicitly cleared the variable → no-op
#   - If the script died between 5a and 5c with the variable still populated → safety net fires
# The standalone cleanup_qa_artifacts.sh handles the safety-net case rather than
# duplicating delete logic here.
cleanup_on_exit() {
  if [ -n "$CREATED_ARTICLE_ID" ]; then
    echo ""
    echo "!!! TRAP CLEANUP: article ${CREATED_ARTICLE_ID} was created but may not have been deleted"
    echo "!!! Running cleanup_qa_artifacts.sh as safety net"
    bash "$(dirname "$0")/../cleanup_qa_artifacts.sh" || true
  fi
  rm -f "$HEADER_FILE"
}
trap cleanup_on_exit EXIT

# ---------- Check 1: Token presence and format ----------

echo ""
echo "--- Check 1: Token presence and format ---"

token_row=$(db_query "shopify_connections" "brand_id=eq.plasmaide&select=access_token,shop_domain")
if [ "$(json_len "$token_row")" = "0" ]; then
  fail "Check 1: Token presence" "No shopify_connections row for plasmaide"
  summary
fi

ACCESS_TOKEN=$(echo "$token_row" | jq -r '.[0].access_token // ""')
DB_SHOP_DOMAIN=$(echo "$token_row" | jq -r '.[0].shop_domain // ""')

if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  fail "Check 1: Token presence" "access_token is empty or null"
  summary
fi

if [[ ! "$ACCESS_TOKEN" =~ ^shpat_[a-f0-9]{32}$ ]]; then
  fail "Check 1: Token format" "Token does not match ^shpat_[a-f0-9]{32}$ — corrupted or wrong field"
  summary
fi
pass "Check 1: Token present and matches shpat_ format"

if [ "$DB_SHOP_DOMAIN" != "$EXPECTED_SHOP_DOMAIN" ]; then
  fail "Check 1: Shop domain" "DB has '${DB_SHOP_DOMAIN}', expected '${EXPECTED_SHOP_DOMAIN}'"
  summary
fi
pass "Check 1: Shop domain matches expected (${EXPECTED_SHOP_DOMAIN})"

# ---------- Check 2: Live shop authentication ----------

echo ""
echo "--- Check 2: Live shop authentication ---"

shop_response=$(curl -s -w "\n%{http_code}" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Accept: application/json" \
  -D "$HEADER_FILE" \
  "https://${EXPECTED_SHOP_DOMAIN}/admin/api/${EXPECTED_API_VERSION}/shop.json" 2>/dev/null)

shop_status=$(echo "$shop_response" | tail -1)
shop_body=$(echo "$shop_response" | sed '$d')

if [ "$shop_status" != "200" ]; then
  case "$shop_status" in
    401|403) fail "Check 2: Auth" "Token rejected by Shopify (HTTP ${shop_status}) — token revoked or rotated" ;;
    404)     fail "Check 2: Auth" "Shop not found (HTTP 404) — wrong shop_domain in DB" ;;
    000)     fail "Check 2: Auth" "Network error reaching Shopify" ;;
    *)       fail "Check 2: Auth" "Unexpected HTTP ${shop_status}" ;;
  esac
  summary
fi

shop_name=$(echo "$shop_body" | jq -r '.shop.name // "unknown"')
shop_plan=$(echo "$shop_body" | jq -r '.shop.plan_name // "unknown"')
pass "Check 2: Authenticated against Shopify (shop='${shop_name}', plan='${shop_plan}')"

# ---------- Check 3: Live scope enumeration ----------

echo ""
echo "--- Check 3: Live scope enumeration ---"

scopes_response=$(curl -s -w "\n%{http_code}" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Accept: application/json" \
  "https://${EXPECTED_SHOP_DOMAIN}/admin/oauth/access_scopes.json" 2>/dev/null)

scopes_status=$(echo "$scopes_response" | tail -1)
scopes_body=$(echo "$scopes_response" | sed '$d')

if [ "$scopes_status" != "200" ]; then
  fail "Check 3: Scope enumeration" "HTTP ${scopes_status} from /admin/oauth/access_scopes.json"
  summary
fi

granted_scopes=$(echo "$scopes_body" | jq -r '.access_scopes[].handle' 2>/dev/null | tr -d '\r' | sort | tr '\n' ',' | sed 's/,$//')
pass "Check 3: Granted scopes retrieved (${granted_scopes})"

# Phase 2 required scopes (NOT including read_content — implicit via read-from-write per diagnostic)
required=(write_content write_products read_customers)
missing=()
for scope in "${required[@]}"; do
  if ! echo ",${granted_scopes}," | grep -q ",${scope},"; then
    missing+=("$scope")
  fi
done

# Orders read can be either read_orders or read_all_orders
if ! echo ",${granted_scopes}," | grep -qE ",(read_orders|read_all_orders),"; then
  missing+=("read_orders OR read_all_orders")
fi

if [ ${#missing[@]} -eq 0 ]; then
  pass "Check 3: All required Phase 2 scopes present"
else
  fail "Check 3: Missing scopes" "Missing: ${missing[*]}"
  summary
fi

# Informational: log if read_content is present (would be unexpected per diagnostic but not bad)
if echo ",${granted_scopes}," | grep -q ",read_content,"; then
  echo "  (info: read_content is granted — diagnostic noted it's typically not, may have changed)"
else
  echo "  (info: read_content NOT granted — confirmed expected per diagnostic, read works via implicit read-from-write)"
fi

# ---------- Check 4: Read against content surface ----------

echo ""
echo "--- Check 4: Read against content surface ---"

blogs_response=$(curl -s -w "\n%{http_code}" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Accept: application/json" \
  "https://${EXPECTED_SHOP_DOMAIN}/admin/api/${EXPECTED_API_VERSION}/blogs.json" 2>/dev/null)

blogs_status=$(echo "$blogs_response" | tail -1)
blogs_body=$(echo "$blogs_response" | sed '$d')

if [ "$blogs_status" != "200" ]; then
  fail "Check 4: Blog read" "HTTP ${blogs_status} — implicit read-from-write may have stopped working"
  summary
fi
pass "Check 4: Read access to /blogs.json works (implicit read-from-write confirmed)"

newsroom_id=$(echo "$blogs_body" | jq -r ".blogs[] | select(.id == ${EXPECTED_BLOG_ID}) | .id" 2>/dev/null)
if [ "$newsroom_id" = "$EXPECTED_BLOG_ID" ]; then
  pass "Check 4: Newsroom blog (id ${EXPECTED_BLOG_ID}) exists"
else
  fail "Check 4: Newsroom blog" "Blog with id ${EXPECTED_BLOG_ID} not found — was it deleted/renamed?"
  summary
fi

# ---------- Check 5: Write capability ----------

echo ""
echo "--- Check 5: Write capability (create → verify → delete → verify) ---"

timestamp=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
article_payload=$(jq -n --arg title "AGOS QA Phase 1 Test — ${timestamp}" '{
  article: {
    title: $title,
    body_html: "<p>QA test article. Safe to delete. Created by tests/integrations/test_shopify_oauth_phase1.sh</p>",
    published: false,
    tags: "agos-qa-test"
  }
}')

# 5a: Create
create_response=$(curl -s -w "\n%{http_code}" \
  -X POST \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$article_payload" \
  "https://${EXPECTED_SHOP_DOMAIN}/admin/api/${EXPECTED_API_VERSION}/blogs/${EXPECTED_BLOG_ID}/articles.json" 2>/dev/null)

create_status=$(echo "$create_response" | tail -1)
create_body=$(echo "$create_response" | sed '$d')

if [ "$create_status" != "201" ]; then
  fail "Check 5a: Create" "Expected 201, got ${create_status}. Body: $(echo $create_body | head -c 300)"
  summary
fi

CREATED_ARTICLE_ID=$(echo "$create_body" | jq -r '.article.id')
if [ -z "$CREATED_ARTICLE_ID" ] || [ "$CREATED_ARTICLE_ID" = "null" ]; then
  fail "Check 5a: Create" "201 received but no article.id in response"
  summary
fi
pass "Check 5a: Article created (id=${CREATED_ARTICLE_ID})"

# 5b: Read back
verify_response=$(curl -s -w "\n%{http_code}" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Accept: application/json" \
  "https://${EXPECTED_SHOP_DOMAIN}/admin/api/${EXPECTED_API_VERSION}/articles/${CREATED_ARTICLE_ID}.json" 2>/dev/null)

verify_status=$(echo "$verify_response" | tail -1)
verify_body=$(echo "$verify_response" | sed '$d')

if [ "$verify_status" != "200" ]; then
  fail "Check 5b: Read-back" "Expected 200, got ${verify_status}"
  # Continue to attempt delete anyway
fi

published_at=$(echo "$verify_body" | jq -r '.article.published_at // "null"')
article_tags=$(echo "$verify_body" | jq -r '.article.tags // ""')

if [ "$published_at" = "null" ]; then
  pass "Check 5b: Article confirmed as draft (published_at is null)"
else
  fail "Check 5b: Draft state" "Article should be draft but published_at=${published_at}"
fi

if echo "$article_tags" | grep -q "agos-qa-test"; then
  pass "Check 5b: Article tagged agos-qa-test"
else
  warn "Check 5b: Article tag missing — found tags='${article_tags}'"
fi

# 5c: Delete
delete_response=$(curl -s -w "\n%{http_code}" \
  -X DELETE \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Accept: application/json" \
  "https://${EXPECTED_SHOP_DOMAIN}/admin/api/${EXPECTED_API_VERSION}/blogs/${EXPECTED_BLOG_ID}/articles/${CREATED_ARTICLE_ID}.json" 2>/dev/null)

delete_status=$(echo "$delete_response" | tail -1)

if [ "$delete_status" = "200" ] || [ "$delete_status" = "204" ]; then
  pass "Check 5c: Article deleted (HTTP ${delete_status})"
  DELETED_ARTICLE_ID="$CREATED_ARTICLE_ID"  # save for 5d verify
  CREATED_ARTICLE_ID=""                      # clear so trap doesn't retry
else
  echo ""
  echo "!!! ============================================ !!!"
  echo "!!! MANUAL CLEANUP REQUIRED                        !!!"
  echo "!!! Article ID: ${CREATED_ARTICLE_ID}              !!!"
  echo "!!! Blog ID:    ${EXPECTED_BLOG_ID}                !!!"
  echo "!!! Run: bash tests/cleanup_qa_artifacts.sh        !!!"
  echo "!!! ============================================ !!!"
  fail "Check 5c: Delete" "HTTP ${delete_status} — see manual cleanup notice above"
  summary
fi

# 5d: Verify deletion
verify_delete_status=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Accept: application/json" \
  "https://${EXPECTED_SHOP_DOMAIN}/admin/api/${EXPECTED_API_VERSION}/articles/${DELETED_ARTICLE_ID}.json" 2>/dev/null)

if [ "$verify_delete_status" = "404" ]; then
  pass "Check 5d: Deletion confirmed (article returns 404)"
else
  warn "Check 5d: Deletion verification returned HTTP ${verify_delete_status} (expected 404)"
fi

# ---------- Check 6: API version verification ----------

echo ""
echo "--- Check 6: API version verification ---"

actual_version=$(grep -i "x-shopify-api-version:" "$HEADER_FILE" 2>/dev/null | sed 's/.*: *//' | tr -d '\r\n ')
if [ -z "$actual_version" ]; then
  warn "Check 6: API version header not found in ${HEADER_FILE}"
elif [ "$actual_version" = "$EXPECTED_API_VERSION" ]; then
  pass "Check 6: API version is ${EXPECTED_API_VERSION} as expected"
else
  fail "Check 6: API version" "Expected ${EXPECTED_API_VERSION}, got ${actual_version}"
fi

summary
