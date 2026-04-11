#!/usr/bin/env bash
# open-chrome.sh — open the harness homepage in Chrome using a
# dedicated, isolated profile so the agent's browsing state doesn't
# leak into your normal profile and vice versa.
#
# Env vars:
#   PORT          dev server port   (default: 5173)
#   HOST          dev server host   (default: 127.0.0.1)
#   CHROME_PROFILE  profile dir     (default: ./state/chrome-profile)

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PORT:-5173}"
HOST="${HOST:-127.0.0.1}"
PROFILE_DIR="${CHROME_PROFILE:-$ROOT/state/chrome-profile}"

URL="http://${HOST}:${PORT}/routes/index.html"

log() { printf "\033[1;36m[open-chrome]\033[0m %s\n" "$*"; }

find_chrome() {
  local candidates=(
    "google-chrome"
    "google-chrome-stable"
    "chromium"
    "chromium-browser"
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
    "/Applications/Chromium.app/Contents/MacOS/Chromium"
  )
  for c in "${candidates[@]}"; do
    if command -v "$c" >/dev/null 2>&1; then
      echo "$c"
      return 0
    fi
    if [ -x "$c" ]; then
      echo "$c"
      return 0
    fi
  done
  return 1
}

CHROME="$(find_chrome || true)"
if [ -z "${CHROME:-}" ]; then
  echo "could not find Chrome or Chromium on PATH" >&2
  echo "open this URL manually: $URL" >&2
  exit 1
fi

mkdir -p "$PROFILE_DIR"
log "using profile dir: $PROFILE_DIR"
log "opening: $URL"

exec "$CHROME" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  --new-window \
  "$URL"
