#!/usr/bin/env bash
# Security scan over a PR diff (M1 harness, no AI).
# Flags changes that, in the full agent flow, would require mod approval:
#   1. new/changed dependencies (package.json deps, bun.lock)
#   2. outbound network calls newly introduced in code
#   3. new reads of secret-like env vars (*SECRET|TOKEN|KEY|PASSWORD)
# Heuristic, added-lines only.
#
# M4: non-blocking. Flags are printed for visibility but the job always exits 0;
# the real gate is the mod [Merge]/[Reject] approval on the finished PR, which
# sees these flags. (protected-paths.sh stays hard-fail for infra/guardrails.)
#
# Usage: scripts/security-scan.sh [BASE_REF]
#   BASE_REF defaults to origin/main. Compares BASE_REF...HEAD.
set -euo pipefail

BASE_REF="${1:-${BASE_REF:-origin/main}}"

# Merge-base diff so only PR-introduced changes are scanned.
range="${BASE_REF}...HEAD"

added() {
  # Added lines (without the leading +) for the given pathspec.
  git diff "$range" -- "$@" | grep -E '^\+' | grep -vE '^\+\+\+' | sed 's/^+//'
}

findings=0
note() { findings=$((findings + 1)); echo "FLAG: $1"; }

# 1. Dependency changes ------------------------------------------------------
dep_lines="$(added package.json | grep -E '"[^"]+"\s*:\s*"[\^~]?[0-9]' || true)"
if [ -n "$dep_lines" ]; then
  note "package.json dependency added/changed:"
  echo "$dep_lines" | sed 's/^/    /'
fi
if [ -n "$(git diff "$range" -- bun.lock 2>/dev/null)" ]; then
  note "bun.lock changed (dependency tree modified)."
fi

# 2. Outbound network --------------------------------------------------------
code_added="$(added '*.ts' '*.tsx' '*.js' '*.mjs' || true)"
net_hits="$(echo "$code_added" | grep -nE \
  'fetch\(|https?\.(request|get)|net\.(connect|createConnection)|new WebSocket|require\(.?(axios|node-fetch|undici|got)|from .(axios|node-fetch|undici|got)' \
  || true)"
if [ -n "$net_hits" ]; then
  note "new outbound-network code:"
  echo "$net_hits" | sed 's/^/    /'
fi

# 3. Secret-like env reads ---------------------------------------------------
secret_hits="$(echo "$code_added" | grep -nE \
  'process\.env\.[A-Z0-9_]*(SECRET|TOKEN|KEY|PASSWORD)|process\.env\[[^]]*(SECRET|TOKEN|KEY|PASSWORD)' \
  || true)"
if [ -n "$secret_hits" ]; then
  note "new secret-like env read:"
  echo "$secret_hits" | sed 's/^/    /'
fi

echo "----"
if [ "$findings" -gt 0 ]; then
  echo "security-scan: $findings flag(s) — surfaced to mod for [Merge]/[Reject] review (non-blocking)."
else
  echo "security-scan: clean."
fi
exit 0
