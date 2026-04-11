# agent-game-harness

Agent-first browser harness for running ScummVM games with symbolic state
exposed to AI agents (e.g. Claude).

This repo is the **app shell and deployment target** for an AI-agent proof
of concept. It pairs with a separate ScummVM fork (`scummvm-agent`) that
adds telemetry hooks into the SCUMM engine.

The central question this POC tries to answer:

> Does exposing symbolic SCUMM state in-browser materially improve an
> agent's ability to play the game compared to pure vision?

## Repo split

- **`scummvm-agent`** (separate repo / fork) — SCUMM engine telemetry
  hooks, C++ to JavaScript bridge, Emscripten target tweaks.
- **`agent-game-harness`** (this repo) — homepage, `/game` route,
  overlays, state panel, startup scripts, hosting config, and the
  Claude runbook.

## Quick start

```bash
./scripts/bootstrap.sh        # install deps and verify prerequisites
./scripts/build-scummvm.sh    # clone + build the fork, copy artifacts into web/public/scummvm
./scripts/start-dev.sh        # start a static dev server and print routes
./scripts/open-chrome.sh      # open the homepage in a fresh Chrome profile
```

Or:

```bash
npm start
```

## Routes

- `/` — agent briefing page. Tells the agent what this site is, where
  the game lives, and how to inspect symbolic state. Also contains a
  machine-readable `#agent-brief` JSON blob.
- `/game` — the actual playable game. Mounts the ScummVM wasm runtime,
  exposes telemetry via `window.__scummState`, `#scumm-state`,
  console tags, overlay boxes, and a debug state panel.
- `/status` — optional debug view of the latest snapshot and event
  history. Useful during development.

## Game files

Commercial game assets **must not** be committed to Git. Put your
legally owned game files in:

```text
game-data/monkey1/
```

They stay local only. `game-data/*` is gitignored by default.

## Documentation

- `ARCHITECTURE.md` — two-repo model, route design, telemetry flow,
  hosting model.
- `TASKS.md` — implementation checklist.
- `claude/runbook.md` — instructions for the agent / operator.

## Status

This is a narrow proof of concept. See `TASKS.md` for the current
milestone. Auth, multi-game support, persistent saves, and polished UX
are explicitly out of scope.
