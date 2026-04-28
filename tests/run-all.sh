#!/bin/bash
# AGOS master test runner

cd "$(dirname "$0")"

mkdir -p results
LOG="results/run-$(date +%Y%m%d-%H%M%S).log"

echo "========================================" | tee -a "$LOG"
echo "  AGOS Test Suite" | tee -a "$LOG"
echo "  $(date)" | tee -a "$LOG"
echo "========================================" | tee -a "$LOG"
echo "" | tee -a "$LOG"

# Pre-flight: verify .env.test exists
if [ ! -f .env.test ]; then
  echo "ERROR: tests/.env.test not found" | tee -a "$LOG"
  echo "Copy .env.test.example to .env.test and fill in credentials" | tee -a "$LOG"
  exit 2
fi

GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

SUITE_FAILURES=()

# Run main suites in numeric order
for test_file in 0*.sh; do
  echo "" | tee -a "$LOG"
  echo "----------------------------------------" | tee -a "$LOG"
  bash "$test_file" 2>&1 | tee -a "$LOG"
  if [ ${PIPESTATUS[0]} -ne 0 ]; then
    SUITE_FAILURES+=("$test_file")
  fi
done

# Integration-layer tests (if directory exists)
if [ -d integrations ]; then
  echo "" | tee -a "$LOG"
  echo "========================================" | tee -a "$LOG"
  echo "  Integration Tests" | tee -a "$LOG"
  echo "========================================" | tee -a "$LOG"
  for test_file in integrations/*.sh; do
    [ -f "$test_file" ] || continue
    echo "" | tee -a "$LOG"
    echo "----------------------------------------" | tee -a "$LOG"
    bash "$test_file" 2>&1 | tee -a "$LOG"
    if [ ${PIPESTATUS[0]} -ne 0 ]; then
      SUITE_FAILURES+=("$test_file")
    fi
  done
fi

# Run regression suite
echo "" | tee -a "$LOG"
echo "========================================" | tee -a "$LOG"
echo "  Regression Tests" | tee -a "$LOG"
echo "========================================" | tee -a "$LOG"

for test_file in regression/*.sh; do
  echo "" | tee -a "$LOG"
  echo "----------------------------------------" | tee -a "$LOG"
  bash "$test_file" 2>&1 | tee -a "$LOG"
  if [ ${PIPESTATUS[0]} -ne 0 ]; then
    SUITE_FAILURES+=("$test_file")
  fi
done

echo "" | tee -a "$LOG"
echo "========================================" | tee -a "$LOG"
if [ ${#SUITE_FAILURES[@]} -eq 0 ]; then
  echo -e "${GREEN}  ALL SUITES PASSED${NC}" | tee -a "$LOG"
  echo "========================================" | tee -a "$LOG"
  echo "Log: $LOG"
  exit 0
else
  echo -e "${RED}  SUITE FAILURES:${NC}" | tee -a "$LOG"
  for f in "${SUITE_FAILURES[@]}"; do
    echo "    - $f" | tee -a "$LOG"
  done
  echo "========================================" | tee -a "$LOG"
  echo "Log: $LOG"
  exit 1
fi
