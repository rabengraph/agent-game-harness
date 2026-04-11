# Claude runbook — agent-game-harness

You are an AI agent operating the ScummVM browser harness.

## Mission

Open the homepage `/`, read the brief, navigate to `/game`, and make
progress in the adventure game running there.

## Inspection order (do this every time)

1. Open `/`. Read the visible brief.
2. Parse `document.getElementById("agent-brief").textContent` as JSON.
   This is the canonical machine-readable brief.
3. Navigate to `/game`.
4. Read `window.__scummState`. This is the authoritative latest state.
5. If `window.__scummState` is missing, read
   `document.getElementById("scumm-state").textContent` and parse it
   as JSON.
6. Scan recent console entries for tags:
   - `[SCUMM_STATE]` — full snapshots
   - `[SCUMM_EVENT]` — discrete events (room change, verb change, etc.)
7. Only then look at the rendered canvas for visual confirmation.

## Action policy

- **Prefer symbolic state first.** The whole point of this harness is
  that you don't have to guess from pixels.
- **Use visual confirmation second.** Pixels are the reality check,
  not the first signal.
- **If telemetry and visuals disagree, trust the rendered game.**
  Report the discrepancy so the fork can be fixed.
- **Save frequently.** Before any risky action, save.
- **Avoid repeating failed action loops.** If the same click or verb
  combination fails twice, change approach rather than retrying a
  third time.

## State schema you can expect

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
      "id": 0, "name": "",
      "x": 0, "y": 0, "w": 0, "h": 0,
      "visible": true, "clickable": true, "state": 0
    }
  ]
}
```

- `objects` is only the currently relevant room objects.
- `visible` and `clickable` are distinct. A thing can be visible but
  not clickable (and vice versa).
- `sentenceLine` is the player's in-progress action (e.g.
  `"Open door"`).
- `dialogChoices` reflects the **current** interaction choices, not
  the whole script tree.

## Debug aids

On `/game`:

- `#scumm-overlay` — bounding boxes and labels drawn over the canvas.
  Use this to visually confirm that exported objects match what's on
  screen.
- `#scumm-panel` — compact state panel showing room, verb, sentence,
  hover, inventory, dialog choices, and object counts.

On `/status`:

- Latest snapshot and recent events from the most recent `/game`
  session in the same tab (via `sessionStorage`).

## Debug policy when telemetry seems wrong

1. Inspect the overlay — is the box aligned with the rendered object?
2. Inspect `#scumm-state` raw JSON.
3. Cross-reference against the schema above.
4. Compare with the rendered scene.
5. If the discrepancy is reproducible, note it clearly so the
   `scummvm-agent` fork can be patched.

## What you should not do

- Don't invent routes. There's `/`, `/game`, and optionally `/status`.
- Don't expect auth. There isn't any.
- Don't commit or upload game assets.
- Don't try to "fix" the fork from the harness repo; that's a
  separate repo.
- Don't optimize for human UX. This site is built for you.

## Operator notes

- The harness is static HTML/JS/CSS plus the Emscripten bundle.
- The ScummVM runtime is expected under `/public/scummvm/scummvm.js`
  and is produced by `./scripts/build-scummvm.sh` in a separate repo
  (the `scummvm-agent` fork).
- If `/game` shows a "runtime not built" banner, the operator needs
  to build the fork.
