#!/usr/bin/env bash
set -euo pipefail

test_root="$(mktemp -d)"
trap 'rm -rf "$test_root"' EXIT

hugo \
  --contentDir testdata/hugo-content \
  --destination "$test_root/public" \
  --cleanDestinationDir \
  --quiet

list_page="$test_root/public/wine/index.html"
single_page="$test_root/public/wine/2026/class-example/index.html"

grep -q 'aria-label="Wine verdict: Class"' "$list_page"
grep -q 'aria-label="Wine verdict: Class"' "$single_page"

printf 'Wine verdict badges rendered on list and single pages.\n'
