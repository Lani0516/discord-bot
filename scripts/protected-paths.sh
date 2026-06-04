#!/usr/bin/env bash
# Protected-path review (M1 harness, defense-in-depth).
# Even with the two-repo physical isolation, fail any PR that touches
# infra / CI / guardrail files. The agent works only in src/** + tests/**.
#
# Usage: scripts/protected-paths.sh [BASE_REF]
#   BASE_REF defaults to origin/main. Compares BASE_REF...HEAD.
set -euo pipefail

BASE_REF="${1:-${BASE_REF:-origin/main}}"
range="${BASE_REF}...HEAD"

# Glob patterns (bash extended) for protected paths.
protected=(
  '.github/*'
  '.github/**'
  'Dockerfile'
  '.dockerignore'
  'docker-compose.yml'
  'scripts/*'
  'AGENTS.md'
  'CLAUDE.md'
  'CONTEXT.md'
  '.env'
  '.env.*'
)

shopt -s globstar extglob nullglob

changed="$(git diff --name-only "$range")"
hits=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  for pat in "${protected[@]}"; do
    # shellcheck disable=SC2053
    if [[ "$f" == $pat ]]; then
      echo "PROTECTED: $f (matched '$pat')"
      hits=$((hits + 1))
      break
    fi
  done
done <<< "$changed"

echo "----"
if [ "$hits" -gt 0 ]; then
  echo "protected-paths: $hits protected file(s) modified — agent must not touch these; requires human change."
  exit 1
fi
echo "protected-paths: clean."
