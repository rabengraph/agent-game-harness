#!/usr/bin/env bash
# start-dev.sh — serve the harness locally and print routes.
#
# Does not build the ScummVM fork. If /game shows a "runtime not
# built" banner, run ./scripts/build-scummvm.sh first.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PORT:-5173}"
HOST="${HOST:-127.0.0.1}"

log()  { printf "\033[1;36m[start-dev]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[start-dev]\033[0m %s\n" "$*" >&2; }

if [ ! -f "$ROOT/web/public/scummvm/scummvm.js" ]; then
  warn "no scummvm runtime at web/public/scummvm/scummvm.js"
  warn "  → /game will show a 'runtime not built' banner"
  warn "  → run ./scripts/build-scummvm.sh to build the fork"
fi

log "routes:"
printf "  http://%s:%s/routes/index.html   (/)\n" "$HOST" "$PORT"
printf "  http://%s:%s/routes/game.html    (/game)\n" "$HOST" "$PORT"
printf "  http://%s:%s/routes/status.html  (/status)\n" "$HOST" "$PORT"
log "press ctrl-c to stop"

# http-server is listed as a devDependency; use the local binary when
# available, otherwise fall back to npx.
if [ -x "$ROOT/node_modules/.bin/http-server" ]; then
  exec "$ROOT/node_modules/.bin/http-server" "$ROOT/web" \
    -a "$HOST" -p "$PORT" -c-1 --cors
else
  exec npx --yes http-server "$ROOT/web" \
    -a "$HOST" -p "$PORT" -c-1 --cors
fi
