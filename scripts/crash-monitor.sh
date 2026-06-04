#!/bin/sh
# Crash-loop rollback monitor (M0).
# Watches TARGET_CONTAINER. While healthy, records its image digest as
# "last good". If it crash-loops (too many restarts in a window) or stays
# unhealthy, it recreates the container from the last-good digest, preserving
# env / mounts / network / labels captured from the live container.
set -eu

C="${TARGET_CONTAINER:-discord-bot}"
STATE_DIR="${STATE_DIR:-/state}"
MAX_RESTARTS="${MAX_RESTARTS:-3}"
WINDOW_SECONDS="${WINDOW_SECONDS:-180}"
GOOD="$STATE_DIR/last-good-image"
LOCK="$STATE_DIR/rolling-back"

mkdir -p "$STATE_DIR"
log() { echo "[crash-monitor] $(date -u +%H:%M:%S) $*"; }

# Read a single field via Go template (grep on raw JSON is ambiguous:
# both .State.Status and .State.Health.Status serialise as "Status").
state_of()  { docker inspect "$C" -f '{{.State.Status}}' 2>/dev/null || echo unknown; }
health_of() { docker inspect "$C" -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' 2>/dev/null || echo none; }

# Rebuild docker run flags from the live container's config.
run_args() {
  docker inspect "$C" --format '
{{- range .Config.Env}}-e {{printf "%q" .}} {{end -}}
{{- range .Mounts}}{{if eq .Type "volume"}}-v {{.Name}}:{{.Destination}} {{else}}-v {{.Source}}:{{.Destination}} {{end}}{{end -}}
{{- range $k,$v := .Config.Labels}}-l {{printf "%q" (printf "%s=%s" $k $v)}} {{end -}}
--restart {{.HostConfig.RestartPolicy.Name}} '
}
net_of() { docker inspect "$C" --format '{{range $k,$_ := .NetworkSettings.Networks}}{{$k}}{{end}}'; }

# Pinnable, pullable reference (repo@sha256:...) of the container's current image.
# A bare image ID is not durable: it vanishes when its tag is overwritten and the
# old image is GC'd, leaving nothing to run on rollback. RepoDigest survives.
good_ref() {
  iid="$(docker inspect "$C" -f '{{.Image}}' 2>/dev/null)" || return 1
  docker image inspect "$iid" -f '{{if .RepoDigests}}{{index .RepoDigests 0}}{{end}}' 2>/dev/null
}

rollback() {
  good="$(cat "$GOOD" 2>/dev/null || true)"
  [ -n "$good" ] || { log "no last-good image recorded; cannot roll back"; return 1; }
  log "ROLLBACK -> $good"
  : > "$LOCK"
  if ! docker image inspect "$good" >/dev/null 2>&1; then
    log "last-good not present locally; pulling $good"
    docker pull "$good" >/dev/null 2>&1 || { log "pull failed; cannot roll back"; rm -f "$LOCK"; return 1; }
  fi
  args="$(run_args)"; net="$(net_of)"
  docker rm -f "$C" >/dev/null 2>&1 || true
  # shellcheck disable=SC2086
  eval docker run -d --name "$C" --network "$net" $args "$good" >/dev/null
  log "rollback container started"
  sleep "$WINDOW_SECONDS"   # cool-off before resuming watch
  rm -f "$LOCK"
}

log "watching $C (max $MAX_RESTARTS restarts / ${WINDOW_SECONDS}s)"
base_restarts=""; window_start="$(date +%s)"
while true; do
  sleep 15
  [ -f "$LOCK" ] && continue
  state="$(state_of)"           # running / restarting / exited ...
  health="$(health_of)"         # healthy / unhealthy / starting / none
  restarts="$(docker inspect "$C" --format '{{.RestartCount}}' 2>/dev/null || echo 0)"
  [ -z "$restarts" ] && restarts=0
  [ -z "$base_restarts" ] && base_restarts="$restarts"

  now="$(date +%s)"
  if [ $((now - window_start)) -ge "$WINDOW_SECONDS" ]; then
    window_start="$now"; base_restarts="$restarts"
  fi

  if [ "$health" = "healthy" ]; then
    ref="$(good_ref || true)"
    if [ -n "$ref" ] && [ "$ref" != "$(cat "$GOOD" 2>/dev/null || true)" ]; then
      echo "$ref" > "$GOOD"; log "recorded last-good $ref"
    fi
  fi

  delta=$((restarts - base_restarts))
  if [ "$delta" -ge "$MAX_RESTARTS" ] || { [ "$health" = "unhealthy" ] && [ "$state" != "running" ]; }; then
    log "crash-loop detected (restarts +$delta, state=$state health=$health)"
    rollback || log "rollback failed"
    window_start="$(date +%s)"; base_restarts=""
  fi
done
