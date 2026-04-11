#!/usr/bin/env bash
# bootstrap.sh — install harness dependencies and verify local prerequisites.
#
# This script is safe to re-run. It intentionally does *not* build the
# ScummVM fork; that lives in build-scummvm.sh.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

log() { printf "\033[1;36m[bootstrap]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[bootstrap]\033[0m %s\n" "$*" >&2; }
err()  { printf "\033[1;31m[bootstrap]\033[0m %s\n" "$*" >&2; }

require() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    err "missing required command: $name"
    return 1
  fi
  log "found $name: $(command -v "$name")"
}

soft_require() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    warn "optional command not found: $name"
    return 0
  fi
  log "found $name: $(command -v "$name")"
}

# Load nvm if available and .nvmrc exists
if [ -f "$ROOT/.nvmrc" ]; then
  if [ -s "$HOME/.nvm/nvm.sh" ]; then
    log "loading nvm…"
    source "$HOME/.nvm/nvm.sh"
    log "installing node from .nvmrc…"
    nvm install
    nvm use
  else
    warn ".nvmrc found but nvm not installed; install nvm or Node.js manually"
  fi
fi

log "checking prerequisites…"
missing=0
require git || missing=$((missing + 1))
require node || missing=$((missing + 1))

# Enable corepack to use pnpm from packageManager field in package.json
log "enabling corepack for pnpm…"
if ! corepack enable pnpm 2>/dev/null; then
  err "failed to enable corepack; ensure Node.js >= 16.10 is installed"
  missing=$((missing + 1))
fi

# Emscripten is needed by build-scummvm.sh, not by the harness itself.
# Warn rather than fail so harness-only dev still works.
soft_require emcc
soft_require emconfigure
soft_require emmake

if [ "$missing" -gt 0 ]; then
  err "missing $missing required prerequisite(s); fix and re-run."
  exit 1
fi

log "ensuring directories…"
mkdir -p \
  "$ROOT/vendor" \
  "$ROOT/game-data" \
  "$ROOT/state/saves" \
  "$ROOT/web/public/scummvm"

log "installing node deps…"
pnpm install

log "done."
log "next: ./scripts/build-scummvm.sh (once emsdk is set up)"
log "then: ./scripts/start-dev.sh"
