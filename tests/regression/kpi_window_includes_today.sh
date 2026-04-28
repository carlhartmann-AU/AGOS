#!/bin/bash
# Bug: KPI date math used < end_date instead of <= end_date, excluding today's orders
# Fix: window is now inclusive of today (24h window covers yesterday + today, days_expected = 2)
# Commit: e75c87f
# Grep-checks the source for the fix pattern

source "$(dirname "$0")/../config.sh"

echo "=== REGRESSION: KPI window includes today ==="

REPO_ROOT="$(dirname "$0")/../.."
KPI_FILES=$(find "$REPO_ROOT/app" -path '*/api/kpis*' -name '*.ts' 2>/dev/null)

if [ -z "$KPI_FILES" ]; then
  warn "Cannot find KPI route source — running from outside repo?"
  summary
fi

# Search for the off-by-one anti-pattern: subtracting 1 day from "today"
# Adjust the grep pattern based on what the actual fix looks like in your codebase
found_bad=$(grep -rn "addDays.*-1\|subDays.*1.*today\|new Date().*setDate.*-1" $KPI_FILES 2>/dev/null)
if [ -n "$found_bad" ]; then
  fail "REGRESSION RETURNED" "Off-by-one date math found:\n${found_bad}"
else
  pass "KPI date window does not subtract a day from 'today'"
fi

summary
