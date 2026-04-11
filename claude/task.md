# Claude task — first directed run

A narrow, single-session task for an agent running against this harness.

## Preconditions

- `./scripts/bootstrap.sh` has run successfully.
- `./scripts/build-scummvm.sh` has produced artifacts under
  `web/public/scummvm/`.
- `./scripts/start-dev.sh` is running (or a hosted preview is reachable).
- Legal game files are present in `game-data/monkey1/` (or whatever
  game the fork currently targets).

## Task

1. Open `/`.
2. Parse `#agent-brief`. Confirm `gameRoute` points at `/game`.
3. Navigate to `/game`.
4. Wait until `window.__scummState` is populated.
5. Report:
   - current `room`
   - current `activeVerb`
   - current `sentenceLine`
   - inventory item names
   - the names of all currently clickable objects
6. Click one of the clickable objects named by the operator.
7. Observe the next state snapshot. Confirm the click had an effect
   (room change, sentence line change, object state change, or new
   dialog choices).
8. If nothing changed, do not retry the same click. Report the
   observation instead.

## Success

You completed step 7 with a measurable state change, or you
correctly reported at step 8 that the click had no effect and
produced no follow-up loop.

## Out of scope for this task

- Completing a full puzzle.
- Loading or saving.
- Interacting with multiple objects per run.
