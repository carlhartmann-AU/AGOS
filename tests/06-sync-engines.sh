#!/bin/bash
source "$(dirname "$0")/config.sh"

echo "=== Sync Engine Integrity ==="

# Products
prod_count=$(count_query "products" "brand_id=eq.plasmaide")
if [ -n "$prod_count" ] && [ "$prod_count" -gt 0 ] 2>/dev/null; then
  pass "Products synced: ${prod_count}"
else
  warn "No products synced for plasmaide"
fi

# Variants
variant_count=$(count_query "product_variants" "select=id")
if [ -n "$variant_count" ] && [ "$variant_count" -gt 0 ] 2>/dev/null; then
  pass "Product variants present: ${variant_count}"
else
  warn "No product variants synced"
fi

# Orphaned products (null brand_id)
orphan_count=$(count_query "products" "brand_id=is.null")
if [ "$orphan_count" = "0" ]; then
  pass "No products with null brand_id"
else
  fail "Orphan products" "${orphan_count} products have null brand_id"
fi

# Customers
cust_count=$(count_query "customers" "brand_id=eq.plasmaide")
if [ -n "$cust_count" ] && [ "$cust_count" -gt 0 ] 2>/dev/null; then
  pass "Customers synced: ${cust_count}"
else
  warn "No customers synced — order/customer joins will be empty"
fi

# Sync metadata
sync_meta=$(db_query "shopify_connections" "brand_id=eq.plasmaide&select=last_sync_at,sync_status")
if [ "$(json_len "$sync_meta")" -gt 0 ]; then
  last_sync=$(echo "$sync_meta" | jq -r '.[0].last_sync_at // "never"')
  sync_status=$(echo "$sync_meta" | jq -r '.[0].sync_status // "unknown"')
  pass "Shopify sync metadata: last_sync_at=${last_sync}, status=${sync_status}"
else
  warn "No shopify_connections row — sync has never run"
fi

summary
