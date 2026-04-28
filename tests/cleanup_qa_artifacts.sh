#!/bin/bash
source "$(dirname "$0")/config.sh"

echo "=== QA Artifact Cleanup ==="
echo "Idempotent. Safe to run any time."
echo ""

EXPECTED_SHOP_DOMAIN="plasmaide-uk.myshopify.com"
EXPECTED_BLOG_ID="97071792413"
EXPECTED_API_VERSION="2026-04"

# Get token
token_row=$(db_query "shopify_connections" "brand_id=eq.plasmaide&select=access_token")
if [ "$(json_len "$token_row")" = "0" ]; then
  fail "Cleanup: Token" "No shopify_connections row for plasmaide"
  summary
fi
ACCESS_TOKEN=$(echo "$token_row" | jq -r '.[0].access_token // ""')
if [ -z "$ACCESS_TOKEN" ] || [ "$ACCESS_TOKEN" = "null" ]; then
  fail "Cleanup: Token" "access_token is empty"
  summary
fi

# List all articles tagged agos-qa-test in the Newsroom blog
list_response=$(curl -s -w "\n%{http_code}" \
  -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
  -H "Accept: application/json" \
  "https://${EXPECTED_SHOP_DOMAIN}/admin/api/${EXPECTED_API_VERSION}/blogs/${EXPECTED_BLOG_ID}/articles.json?tag=agos-qa-test&limit=250" 2>/dev/null)

list_status=$(echo "$list_response" | tail -1)
list_body=$(echo "$list_response" | sed '$d')

if [ "$list_status" != "200" ]; then
  fail "Cleanup: List" "HTTP ${list_status} listing articles"
  summary
fi

article_ids=$(echo "$list_body" | jq -r '.articles[].id' 2>/dev/null)
count=$(echo "$article_ids" | grep -c . || true)

if [ "$count" = "0" ] || [ -z "$article_ids" ]; then
  pass "Cleanup: No QA artefacts found — nothing to clean"
  summary
fi

echo "Found ${count} QA artefact(s) to delete:"
echo "$article_ids" | sed 's/^/  - /'
echo ""

deleted=0
failed=0
failed_ids=""

for article_id in $article_ids; do
  delete_status=$(curl -s -o /dev/null -w "%{http_code}" \
    -X DELETE \
    -H "X-Shopify-Access-Token: ${ACCESS_TOKEN}" \
    -H "Accept: application/json" \
    "https://${EXPECTED_SHOP_DOMAIN}/admin/api/${EXPECTED_API_VERSION}/blogs/${EXPECTED_BLOG_ID}/articles/${article_id}.json" 2>/dev/null)

  if [ "$delete_status" = "200" ] || [ "$delete_status" = "204" ]; then
    echo "  Deleted ${article_id} (HTTP ${delete_status})"
    deleted=$((deleted + 1))
  else
    echo "  FAILED ${article_id} (HTTP ${delete_status})"
    failed=$((failed + 1))
    failed_ids="${failed_ids} ${article_id}"
  fi
done

echo ""
if [ $failed -eq 0 ]; then
  pass "Cleanup: All ${deleted} artefact(s) deleted"
else
  fail "Cleanup: Partial" "${deleted} deleted, ${failed} failed (ids:${failed_ids})"
fi

summary
