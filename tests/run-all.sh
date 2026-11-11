#!/usr/bin/env bash
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

passed=0
failed=0
failures=()
shopt -s nullglob
for test_file in tests/*.test.js tests/*.test.mjs; do
  printf '\n===== %s =====\n' "$test_file"
  if node "$test_file"; then
    passed=$((passed + 1))
    printf 'PASS: %s\n' "$test_file"
  else
    failed=$((failed + 1))
    failures+=("$test_file")
    printf 'FAIL: %s\n' "$test_file"
  fi
done

printf '\n===== TEST SUMMARY =====\n'
printf 'Passed: %d\nFailed: %d\n' "$passed" "$failed"
if (( failed > 0 )); then
  printf 'Failing files:\n'
  printf ' - %s\n' "${failures[@]}"
  exit 1
fi
printf 'All QuantLab test files passed.\n'
