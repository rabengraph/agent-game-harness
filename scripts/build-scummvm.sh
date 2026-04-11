#!/usr/bin/env bash
# build-scummvm.sh — clone/update the ScummVM fork, build the web
# target, and copy artifacts into the harness.
#
# This script is opinionated about paths but not about emsdk setup. You
# must have `emcc` on PATH (or source emsdk_env.sh) before running.
#
# Env vars:
#   SCUMMVM_AGENT_REMOTE   git remote to clone
#                          (default: https://github.com/rabengraph/scummvm.git)
#   SCUMMVM_AGENT_BRANCH   branch to build
#                          (default: claude/scummvm-agent-harness-DKVxd)
#
# See the fork's engines/scumm/AGENT_HARNESS.md for the full contract.

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR_DIR="$ROOT/vendor"
SCUMMVM_DIR="$VENDOR_DIR/scummvm-agent"
OUTPUT_DIR="$ROOT/web/public/scummvm"

REMOTE="${SCUMMVM_AGENT_REMOTE:-https://github.com/rabengraph/scummvm.git}"
BRANCH="${SCUMMVM_AGENT_BRANCH:-claude/scummvm-agent-harness-DKVxd}"

log()  { printf "\033[1;36m[build-scummvm]\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m[build-scummvm]\033[0m %s\n" "$*" >&2; }
err()  { printf "\033[1;31m[build-scummvm]\033[0m %s\n" "$*" >&2; }

if ! command -v emcc >/dev/null 2>&1; then
  err "emcc not found on PATH. Activate emsdk first, e.g.:"
  err "  source /path/to/emsdk/emsdk_env.sh"
  exit 1
fi

mkdir -p "$VENDOR_DIR" "$OUTPUT_DIR"

if [ ! -d "$SCUMMVM_DIR/.git" ]; then
  log "cloning $REMOTE into $SCUMMVM_DIR"
  git clone "$REMOTE" "$SCUMMVM_DIR"
fi

cd "$SCUMMVM_DIR"

log "fetching origin…"
git fetch origin

log "checking out $BRANCH"
git checkout "$BRANCH"
git pull --ff-only || warn "could not fast-forward; continuing with local state"

# The fork is responsible for knowing how to build its own web target.
# We prefer a repo-local helper if one exists. Otherwise we fall back
# to a plain emconfigure/emmake flow suitable for a minimal SCUMM-only
# build. Adjust here once the fork stabilizes.

if [ -x "./scripts/build-web.sh" ]; then
  log "using fork's scripts/build-web.sh"
  ./scripts/build-web.sh
elif [ -x "./build-web.sh" ]; then
  log "using fork's ./build-web.sh"
  ./build-web.sh
else
  log "no fork-provided build script found; trying a minimal emconfigure flow"
  emconfigure ./configure \
    --host=wasm32-unknown-emscripten \
    --enable-debug \
    --disable-all-engines \
    --enable-engine=scumm \
    --enable-agent-telemetry
  emmake make -j"$(getconf _NPROCESSORS_ONLN 2>/dev/null || echo 4)"
fi

log "copying artifacts into $OUTPUT_DIR"
# Expected fork outputs. Adjust to match the real filenames once known.
CANDIDATES=(
  "scummvm.js"
  "scummvm.wasm"
  "scummvm.data"
  "scummvm.html"
  "dist/web/scummvm.js"
  "dist/web/scummvm.wasm"
  "dist/web/scummvm.data"
)

copied=0
for rel in "${CANDIDATES[@]}"; do
  if [ -f "$SCUMMVM_DIR/$rel" ]; then
    cp -v "$SCUMMVM_DIR/$rel" "$OUTPUT_DIR/"
    copied=$((copied + 1))
  fi
done

if [ "$copied" -eq 0 ]; then
  err "no build artifacts found to copy. Check the fork's build output."
  err "Expected one of: ${CANDIDATES[*]}"
  exit 2
fi

log "wrote $copied file(s) to $OUTPUT_DIR"
log "done."
