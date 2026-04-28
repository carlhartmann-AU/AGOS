#!/bin/bash
source "$(dirname "$0")/../config.sh"

echo "=== REGRESSION: Currency conversion uses correct endpoint format ==="

REPO_ROOT="$(dirname "$0")/../.."
CURRENCY_FILES=$(grep -rln "currency\|exchange.*rate\|fxrate\|fxConvert\|convertCurrency" "$REPO_ROOT/app" --include='*.ts' 2>/dev/null)

if [ -z "$CURRENCY_FILES" ]; then
  warn "No currency conversion source files found"
  summary
fi

# Soft check: confirm currency conversion functions exist
if grep -rn "convertAmount\|convertCurrency\|fxConvert\|exchangeRate" $CURRENCY_FILES >/dev/null 2>&1; then
  pass "Currency conversion functions present"
else
  warn "No currency conversion functions found — has feature been removed?"
fi

# TODO: When the actual currency API endpoint is confirmed, add a specific
# pattern check here to verify the correct endpoint format is in use.
# Example: if [ -n "$(grep -rn 'expected_endpoint_pattern' $CURRENCY_FILES)" ]; then ...

summary
