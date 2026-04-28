#!/bin/bash
# Bug: sync looped over rows calling .upsert() one at a time → N round-trips per sync,
# causing timeouts on large order sets and leaving partial data.
# Fix: collect rows into array per GraphQL page, single .upsert(rows[]) call per page.

source "$(dirname "$0")/../config.sh"

echo "=== REGRESSION: Sync uses batch upserts, not single-row ==="

REPO_ROOT="$(dirname "$0")/../.."
SYNC_FILES=$(find "$REPO_ROOT/app" -name '*sync*.ts' 2>/dev/null)

if [ -z "$SYNC_FILES" ]; then
  warn "Cannot find sync source files"
  summary
fi

# Heuristic: look for .upsert( inside a for/while loop
# This is a soft check — flag for human review rather than fail outright
found=$(awk '
  /for\s*\(|while\s*\(/ { in_loop=1; loop_brace=0 }
  in_loop { loop_brace += gsub(/{/,"&") - gsub(/}/,"&") }
  in_loop && /\.upsert\(/ { print FILENAME ":" NR ": " $0 }
  in_loop && loop_brace <= 0 && /}/ { in_loop=0 }
' $SYNC_FILES 2>/dev/null | head -5)

if [ -n "$found" ]; then
  warn "Possible per-row .upsert() inside a loop — review:\n${found}"
else
  pass "No single-row upsert-in-loop patterns detected"
fi

summary
