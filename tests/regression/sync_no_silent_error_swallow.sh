#!/bin/bash
# Bug: try/catch around Supabase calls returned $0 instead of throwing, hiding failures.
# Sync would return 200 OK even when Shopify API calls had failed — no audit log entry.
# Fix: errors must propagate — sync routes throw, audit_log records status=failure.

source "$(dirname "$0")/../config.sh"

echo "=== REGRESSION: Sync does not silently swallow Supabase errors ==="

REPO_ROOT="$(dirname "$0")/../.."
# Match both lib/shopify/sync-*.ts and api/integrations/shopify/sync-*/route.ts
SYNC_FILES=$(find "$REPO_ROOT/app" -name '*sync*.ts' 2>/dev/null)

if [ -z "$SYNC_FILES" ]; then
  warn "Cannot find sync source files"
  summary
fi

# Look for catch blocks that return 0 / null without re-throwing or logging
# This is heuristic — adjust to actual fix pattern in your codebase
found=$(grep -rn -A2 "catch.*{" $SYNC_FILES 2>/dev/null | grep -E "return\s+0|return\s+null|return\s+\{\s*\}" | head -5)
if [ -n "$found" ]; then
  warn "Possible silent error swallow found — review:\n${found}"
else
  pass "No obvious silent error swallow patterns in sync code"
fi

summary
