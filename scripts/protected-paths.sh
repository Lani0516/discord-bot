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

# Protected directory prefixes (any file under them).
prefixes=( '.github/' 'scripts/' )
# Protected exact files.
exact=( 'Dockerfile' '.dockerignore' 'docker-compose.yml' 'AGENTS.md' 'CLAUDE.md' 'CONTEXT.md' )

is_protected() {
  local f="$1" p
  for p in "${prefixes[@]}"; do
    case "$f" in "$p"*) echo "$p*"; return 0 ;; esac
  done
  for p in "${exact[@]}"; do
    [ "$f" = "$p" ] && { echo "$p"; return 0; }
  done
  # .env and .env.* (but not .env.example, which is safe to change).
  case "$f" in
    .env) echo ".env"; return 0 ;;
    .env.example) return 1 ;;
    .env.*) echo ".env.*"; return 0 ;;
  esac
  return 1
}

changed="$(git diff --name-only "$range")"
hits=0
while IFS= read -r f; do
  [ -z "$f" ] && continue
  if match="$(is_protected "$f")"; then
    echo "PROTECTED: $f (matched '$match')"
    hits=$((hits + 1))
  fi
done <<< "$changed"

echo "----"
if [ "$hits" -gt 0 ]; then
  echo "protected-paths: $hits protected file(s) modified — agent must not touch these; requires human change."
  exit 1
fi
echo "protected-paths: clean."
