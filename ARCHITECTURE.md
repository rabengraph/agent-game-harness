# Architecture

## Two-repo model

### Repo 1 — `scummvm-agent`
A fork of ScummVM. Owns:

- SCUMM engine telemetry collection (`engines/scumm/agent_state.{h,cpp}`)
- C++ to JavaScript bridge for the Emscripten target
  (`engines/scumm/agent_bridge_emscripten.cpp`)
- Optional compile-time flag to enable the telemetry
- Browser build configuration

It does **not** own the app shell, homepage, overlays, scripts, or
deployment. Keep this repo narrow and mechanical.

Suggested branch: `poc/agent-telemetry`.

### Repo 2 — `agent-game-harness` (this repo)
Owns everything the agent sees and everything needed to run the site:

- Homepage `/` with the agent brief (HTML and JSON)
- `/game` route hosting the ScummVM wasm runtime
- Optional `/status` debug route
- Shared browser modules: `bridge.js`, `overlay.js`, `state-panel.js`,
  `agent-brief.js`, `styles.css`
- Startup scripts: `bootstrap.sh`, `build-scummvm.sh`, `start-dev.sh`,
  `open-chrome.sh`
- Vercel deployment config
- Claude runbook

## Route design

```text
Agent
  -> homepage `/`
    -> reads mission + operating rules (HTML + #agent-brief JSON)
    -> navigates to `/game`
      -> ScummVM wasm runtime
        -> SCUMM engine telemetry
          -> window.__scummState
          -> #scumm-state JSON node
          -> console events (SCUMM_STATE, SCUMM_EVENT)
          -> optional overlay + state panel
```

`/` is treated as an **agent control page**, not a marketing homepage.
`/game` is the only actual play surface.

## Telemetry flow

1. The SCUMM engine in the fork collects a compact snapshot (room,
   ego position, active verb, hover, sentence line, inventory,
   dialog choices, a relevant subset of room objects).
2. The fork serializes this to JSON and publishes it via a C++-to-JS
   bridge (Emscripten).
3. `web/shared/bridge.js` receives the snapshot and updates:
   - `window.__scummState` (latest authoritative state)
   - `#scumm-state` JSON DOM node (inspectable via `document.querySelector`)
   - `console.debug("[SCUMM_STATE]", ...)` and
     `console.debug("[SCUMM_EVENT]", ...)`
   - optional short in-memory history ring for `/status`
4. `overlay.js` draws bounding boxes + labels for objects in the
   current room.
5. `state-panel.js` renders a human-readable summary for debugging.

### State schema (v1)

```json
{
  "frame": 0,
  "room": 0,
  "sceneName": null,
  "ego": { "x": 0, "y": 0, "walking": false },
  "activeVerb": null,
  "hover": { "objectId": null, "name": null },
  "sentenceLine": "",
  "inventory": [],
  "dialogChoices": [],
  "objects": [
    {
      "id": 0,
      "name": "",
      "x": 0, "y": 0, "w": 0, "h": 0,
      "visible": true,
      "clickable": true,
      "state": 0
    }
  ]
}
```

Field rules:

- `objects` is only the current room's relevant objects.
- `visible` and `clickable` are distinct.
- Object names are exported when available.
- Bounding boxes are included only when reliable.
- `sentenceLine` reflects the built action (e.g. "Open door").
- `dialogChoices` reflects *current* interaction choices, not every
  possible script state.

### Cadence

Hybrid model:

- **Snapshots** — compact, on meaningful change or capped at 5–10 Hz.
- **Events** — small immediate messages for: room change, active verb
  change, hover change, inventory change, dialogue change, sentence
  line change.

## Hosting model

- **Local** — primary dev environment. Static server serving `web/`.
- **Hosted** — deployed to Vercel (or any static host). Mostly static:
  HTML, JS, CSS, wasm, runtime assets. No long-running backend is
  assumed.

Privacy for now: no auth, no access control. A hard-to-guess URL
shared with trusted friends. Treat the hosted deployment as
semi-public.

## Asset boundary

- Commercial game assets must not be committed to Git.
- Local development can use local files under `game-data/`.
- Hosted use with commercial assets may create distribution issues.
- Architecture must allow swapping in safer content later.

## Out of scope (for now)

Auth, polished UX, public distribution at scale, CI/CD complexity,
Docker, a generic multi-game framework, database-backed sessions,
permanent telemetry storage, polished saves UI, upstream cleanup,
generalized agent APIs.
