# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Agent-first browser harness for running ScummVM games with symbolic state exposed to AI agents. This is a proof-of-concept answering: **Does exposing symbolic SCUMM state in-browser materially improve an agent's ability to play the game compared to pure vision?**

Two-repo architecture developed in parallel:
- **This repo (`agent-game-harness`)** — app shell, homepage, game route, overlays, state panel, scripts, deployment
- **ScummVM fork** — SCUMM engine telemetry hooks, C++ to JavaScript bridge

## ScummVM Fork (vendor/scummvm-agent/)

The fork lives at `vendor/scummvm-agent/` as a separate git repository (gitignored from harness). It tracks `rabengraph/scummvm` branch `develop`.

**Active parallel development:** When making telemetry changes, work directly in `vendor/scummvm-agent/` and commit/push to `develop`. The fork's `master` stays as a pristine mirror of upstream ScummVM.

Key fork locations:
- `engines/scumm/AGENT_HARNESS.md` — canonical telemetry schema
- `engines/scumm/agent_state.{h,cpp}` — state collection
- `engines/scumm/agent_bridge_emscripten.cpp` — C++ to JS bridge

## Common Commands

```bash
# Setup (install Node via nvm, pnpm, deps)
./scripts/bootstrap.sh

# Build ScummVM fork (requires emsdk on PATH)
source ~/emsdk/emsdk_env.sh
./scripts/build-scummvm.sh

# Start dev server
pnpm dev                    # or ./scripts/start-dev.sh

# Add a game (from directory or zip)
./scripts/add-game.sh ~/games/MONKEY1 monkey1

# Open Chrome with fresh profile
./scripts/open-chrome.sh
```

## Key Routes

- `/` — Agent briefing page with machine-readable `#agent-brief` JSON
- `/game` — ScummVM wasm runtime with telemetry
  - `?game=<id>` — launch specific game (e.g., `?game=monkey1`)
  - `?mock=1` — use fake telemetry (no fork build needed)
  - `?overlay=1` — start with debug overlay visible
- `/status` — Debug view of snapshot and event history

Press `O` on `/game` to toggle debug overlay.

## Directory Structure

```
web/
├── routes/          # HTML pages (index.html, game.html, status.html)
├── shared/          # JS modules: bridge.js, overlay.js, state-panel.js, mock.js
├── public/scummvm/  # Build artifacts (scummvm.js, .wasm) - populated by build script
├── data/            # Engine runtime assets + games/<id>/ - gitignored
└── dev-tools/       # smoke.html for bridge contract testing
scripts/             # bootstrap.sh, build-scummvm.sh, add-game.sh, start-dev.sh
vendor/scummvm-agent/  # Fork repo (separate git) - gitignored
game-data/           # Commercial assets - gitignored
```

## Telemetry Architecture

The fork emits v1 snapshots via `window.__scummPublish()` → `bridge.js` fans out to:
- `window.__scummState` — latest state object
- `#scumm-state` — DOM node with JSON
- `console.debug("[SCUMM_STATE]", ...)` and `"[SCUMM_EVENT]"`
- Overlay (bounding boxes) and state panel

Key state fields: `room`, `ego`, `hover`, `sentence`, `roomObjects[]`, `inventory[]`, `verbs[]`

Coordinates are virtual-screen pixels (`roomWidth × roomHeight`), not canvas pixels.

## Important Notes

- Canvas must have `id="canvas"` (SDL3 hardcodes this selector)
- Commercial game assets go in `web/data/games/<id>/` — never commit to Git
- Mock mode (`?mock=1`) emits snapshots with `"mock": true`
