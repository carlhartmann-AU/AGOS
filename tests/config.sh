#!/bin/bash
# AGOS Test Suite — Shared Configuration

# Fail fast if jq missing
command -v jq >/dev/null 2>&1 || { echo "ERROR: jq is required. Install: brew install jq"; exit 2; }

API_BASE="https://dashboard.agos-app.com"
BRAND_ID="plasmaide"
SUPABASE_URL="https://wgfrtkezensrxcjoplih.supabase.co"

# Load env from .env.test if present
ENV_FILE="$(dirname "${BASH_SOURCE[0]}")/.env.test"
if [ -f "$ENV_FILE" ]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

pass() {
  echo -e "${GREEN}PASS${NC}: $1"
  PASS_COUNT=$((PASS_COUNT + 1))
}

fail() {
  echo -e "${RED}FAIL${NC}: $1"
  echo -e "   ${RED}-> $2${NC}"
  FAIL_COUNT=$((FAIL_COUNT + 1))
}

warn() {
  echo -e "${YELLOW}WARN${NC}: $1"
  WARN_COUNT=$((WARN_COUNT + 1))
}

summary() {
  echo ""
  echo "--------------------------------"
  echo -e "Results: ${GREEN}${PASS_COUNT} passed${NC}, ${RED}${FAIL_COUNT} failed${NC}, ${YELLOW}${WARN_COUNT} warnings${NC}"
  echo "--------------------------------"
  [ $FAIL_COUNT -gt 0 ] && exit 1 || exit 0
}

# Direct PostgREST query — returns JSON array
db_query() {
  local table=$1
  local params=$2
  curl -s "${SUPABASE_URL}/rest/v1/${table}?${params}" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Content-Type: application/json" \
    2>/dev/null
}

# Exact row count via PostgREST count header — works for tables of any size
# Usage: count_query "orders" "brand_id=eq.plasmaide"
count_query() {
  local table=$1
  local filter=$2
  local response
  response=$(curl -s -I \
    "${SUPABASE_URL}/rest/v1/${table}?${filter}&select=id" \
    -H "apikey: ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Authorization: Bearer ${SUPABASE_SERVICE_ROLE_KEY}" \
    -H "Prefer: count=exact" \
    -H "Range-Unit: items" \
    -H "Range: 0-0" \
    2>/dev/null)
  echo "$response" | grep -i "content-range:" | sed 's/.*\///' | tr -d '\r\n '
}

# Safe JSON length — returns 0 on parse error rather than empty string
json_len() {
  local input=$1
  echo "$input" | jq 'if type == "array" then length else 0 end' 2>/dev/null || echo "0"
}

# GET an API endpoint, return HTTP status code only
api_get_status() {
  local path=$1
  curl -s -o /dev/null -w "%{http_code}" "${API_BASE}${path}" 2>/dev/null
}

# GET an API endpoint with bad CRON_SECRET to verify auth rejection
api_get_with_bad_cron() {
  local path=$1
  curl -s -o /dev/null -w "%{http_code}" \
    -H "Authorization: Bearer not_a_real_secret" \
    "${API_BASE}${path}" 2>/dev/null
}
