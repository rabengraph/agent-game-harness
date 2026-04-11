# Tasks

Implementation order for the POC. Do not reorder — each step depends on
the previous one being testable.

## Milestone 1 — Local browser runtime
- [ ] `./scripts/bootstrap.sh` succeeds on a clean machine
- [ ] `./scripts/build-scummvm.sh` clones `scummvm-agent`, checks out
      `poc/agent-telemetry`, builds the web target, and copies artifacts
      into `web/public/scummvm/`
- [ ] ScummVM web build runs locally via `./scripts/start-dev.sh`
- [ ] Game launches manually at `/game` in Chrome

## Milestone 2 — Minimal telemetry
- [ ] `window.__scummState` exists and updates as the game runs
- [ ] `#scumm-state` DOM node mirrors it
- [ ] `console.debug("[SCUMM_STATE]", ...)` and
      `console.debug("[SCUMM_EVENT]", ...)` fire as expected

## Milestone 3 — Homepage brief
- [ ] `/` renders the agent brief in plain HTML
- [ ] `#agent-brief` JSON blob on `/` matches the HTML mission + rules
- [ ] An agent can read either version and understand what to do

## Milestone 4 — Overlay and state panel
- [ ] Object bounding boxes and labels roughly align with the scene
- [ ] Room, active verb, sentence line, hover target, inventory, and
      dialogue choices are visible in the debug panel
- [ ] Visual overlay catches telemetry mistakes (field tested by
      deliberately mis-aligning one value)

## Milestone 5 — Agent performs directed actions
- [ ] Agent navigates from `/` to `/game`
- [ ] Agent inspects `window.__scummState`
- [ ] Agent clicks a requested object
- [ ] Agent selects a requested verb
- [ ] Agent reads inventory contents

## Milestone 6 — Hosted preview
- [ ] Vercel preview deployment renders `/` and `/game`
- [ ] Same `/` -> `/game` flow works in the hosted preview

## Milestone 7 — Limited autonomous play
- [ ] Agent makes measurable progress with symbolic state vs. pure vision

## Acceptance criteria (first usable POC)

All of:

- One command starts the local environment
- Homepage `/` contains an explicit agent brief
- `/game` loads the game in Chrome
- Current state is available through JavaScript **and** the DOM
- At least some clickable objects are exported with names and boxes
- Inventory is exported
- Current verb or sentence line is exported
- The overlay is good enough to catch telemetry mistakes
- An agent can start at `/`, move to `/game`, inspect state, and
  perform a simple directed action

## Explicitly out of scope for the POC

Auth, generic multi-game framework, database-backed sessions,
permanent telemetry storage, polished saves UI, public packaging of
commercial assets, upstream cleanup, generalized agent APIs.
