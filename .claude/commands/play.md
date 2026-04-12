# Play ScummVM Game

You are an AI agent playing a point-and-click adventure game through a browser harness. Your job is to play strategically and solve the game.

## Additional instructions from user

$ARGUMENTS

## Setup

1. The dev server must already be running (`pnpm dev`).
2. Use `node tools/browser/browser.js <command> [arg]` for ALL browser interaction.
3. **Important:** Do NOT use `pnpm browser:eval --` syntax. Use `node tools/browser/browser.js eval "<expression>"` directly to avoid argument parsing issues.

## Browser commands

```
node tools/browser/browser.js open [url]        # open a page (default: briefing)
node tools/browser/browser.js eval "<expr>"      # eval JS in page, returns JSON
node tools/browser/browser.js screenshot [name]  # save PNG to state/
node tools/browser/browser.js state              # shortcut for __scummRead()
node tools/browser/browser.js events [cursor]    # shortcut for __scummEventsSince()
node tools/browser/browser.js action '<json>'    # execute a game action
node tools/browser/browser.js close              # kill browser
```

## Game API

### Read

| Function | Description |
|---|---|
| `__scummRead()` | Full state snapshot (room, ego, objects, verbs, inventory, actors, dialogChoices) |
| `__scummEventsSince(cursor)` | Returns `{events[], cursor}` — pass cursor back for incremental reads |
| `__scummActionsReady()` | True when WASM is loaded and actions work |

### Act

| Function | Description |
|---|---|
| `__scummDoSentence({verb, objectA, objectB?})` | **Preferred.** Atomic verb+object, auto-walks ego |
| `__scummSelectDialog(index)` | Pick dialog choice (0-indexed into `dialogChoices[]`) |
| `__scummSkipMessage()` | Dismiss current dialog text |
| `__scummWalkTo(x, y)` | Walk ego to room coordinates |
| `__scummClickAt(x, y)` | Last resort click at room coordinates |

### Key state fields

- `room`, `roomObjects[]` — current room ID and objects with `{id, name, box, state, untouchable}`
- `ego.pos.{x,y}`, `ego.walking` — player position and movement
- `verbs[]` — available verbs with `{id, name, kind}` (kind: 0=action, 2=dialog)
- `dialogChoices[]` — active dialog options (subset of verbs with kind==2)
- `inventory[]` — items with `{id, name}`
- `actors[]` — NPCs in room with `{id, name, pos}`
- `haveMsg` — 0=no text, 255=text active, 1=ending. Read `msgText` for content
- `inputLocked` — true during cutscenes, don't send actions
- `camera.x` — viewport scroll offset

### Key events

- `egoArrived` — ego finished walking
- `roomEntered` — room transition completed
- `messageStateChanged` — dialog text appeared/cleared (has `text`, `talkingActor`)
- `dialogChoicesChanged` — dialog options updated
- `inputLockChanged` — cutscene started/ended

## Action command format

Use `node tools/browser/browser.js action '<json>'` with these types:

```json
{"type":"doSentence","verb":8,"objectA":429}
{"type":"doSentence","verb":8,"objectA":429,"objectB":100}
{"type":"selectDialog","index":0}
{"type":"skipMessage"}
{"type":"walkTo","x":160,"y":100}
{"type":"clickAt","x":160,"y":100}
```

## Patterns

### Look at / use an object
```js
// via eval:
node tools/browser/browser.js eval "(() => { const s = __scummRead(); const verb = s.verbs.find(v => v.name.toLowerCase().includes('look')); const obj = s.roomObjects.find(o => o.name === 'poster'); return __scummDoSentence({ verb: verb.id, objectA: obj.id }); })()"
// or via action command:
node tools/browser/browser.js action '{"type":"doSentence","verb":LOOK_VERB_ID,"objectA":OBJ_ID}'
```

### Conversation flow
1. Talk to NPC: `action '{"type":"doSentence","verb":TALK_VERB_ID,"objectA":NPC_ID}'`
2. **Check events** to see what was said and whether dialog choices appeared
3. Skip text: `action '{"type":"skipMessage"}'` when `haveMsg > 0`
4. Pick choice: `action '{"type":"selectDialog","index":0}'` when `dialogChoices.length > 0`
5. **After each choice, check events again** — there may be follow-up text, new choices, or the NPC may ask something back
6. Repeat until `dialogChoices` empty **and** `haveMsg === 0` **and** no pending NPC responses in events
7. **Never walk away mid-conversation.** Always confirm the conversation is fully over before doing something else. An unanswered NPC prompt can block movement or cause you to miss critical game flags.

### Passing through doors
Doors in SCUMM games are **closed by default** and must be opened before you can walk through them. This is a two-step process:

1. **Open the door:** `action '{"type":"doSentence","verb":OPEN_VERB_ID,"objectA":DOOR_ID}'`
2. **Wait for the open to complete** (sleep 2-3s, check events — ego walks to the door and opens it)
3. **Walk to the door's position:** `action '{"type":"walkTo","x":DOOR_CENTER_X,"y":DOOR_CENTER_Y}'` using the door's `box` coordinates (center of the bounding box)
4. Wait for `roomEntered` event, then re-read state

**Common mistakes:**
- Using `Walk to` verb (id 11) on the door — this sometimes works for exits/archways but NOT for closed doors
- Trying to walk through without opening first — Guybrush will just stand at the door
- Using `Open` alone and expecting a room transition — opening a door doesn't walk through it

**For archways and open exits** (no door to open), just walk to them: `action '{"type":"doSentence","verb":11,"objectA":EXIT_ID}'`

Calculate door center from its box: `centerX = box.x + box.w/2`, `centerY = box.y + box.h/2`

## Strategy

1. **Use `state` as your primary orientation tool** — inspect room objects, actors, verbs, and inventory to understand where you are and what you can do. Do NOT take screenshots for routine orientation.
2. **Use `events` to catch up** on what happened after an action — dialog text, room changes, cutscene starts/ends. Much cheaper than full state reads or screenshots.
3. **Screenshots are a fallback only** — use when API state is ambiguous (spatial layout, visual identification). They are expensive in tokens.
4. **Plan before acting:** read the full state, identify available objects and NPCs, form a goal, then execute. Don't wander blindly.
5. **Collect everything you can.** Most puzzles involve using inventory items — on objects, on other items, or giving them to NPCs. Pick up anything not nailed down.
6. **Build a mental map** of room connections as you explore. Track which exits lead where.
7. **Talk to every NPC** to gather information — adventure games progress through conversation and item use.
8. **Exhaust dialog trees** — important clues and game flags are often buried in dialog options you haven't tried.
9. **If stuck, revisit** — new inventory items or game flags can unlock new interactions in previously visited rooms.

## Rules

1. Check `__scummActionsReady()` before your first action.
2. Check `inputLocked` before each action — don't act during cutscenes.
3. Prefer `doSentence` over `clickAt`.
4. Use events (not polling state) to detect action results.
5. Avoid repeating failed actions — try something different.
6. After each action, wait briefly (`sleep 1-2s`) then check events before acting again.
7. **Don't wait for event confirmation on obvious actions** (opening doors, walking to objects, etc.) — assume they worked and move on. Events don't always log routine actions. Only check events when expecting meaningful responses (dialog, room transitions, item pickups). If something didn't work, you'll discover it naturally through later exploration.
8. **Always finish conversations before moving on.** After selecting a dialog choice or triggering a conversation, check events to see if there are more messages to skip or new dialog choices to answer. Do NOT walk away or start a new action while a conversation is still in progress — NPCs may be waiting for your response.
9. **Watch for NPC-initiated conversations.** Sometimes an NPC starts talking to you unprompted (e.g. a shopkeeper demanding payment, a character reacting to your presence). Check events regularly to catch these — if `dialogChoices` appeared or `haveMsg > 0` without you initiating, someone is talking to you and you need to respond.
10. **When stuck, check events first.** If you can't move, can't exit a room, or an action seems to have no effect, immediately check recent events. You may have missed a dialog prompt, a question from an NPC, or a state change that requires your response. Events are your ground truth — the state snapshot only shows the current moment, but events show what happened and what's pending.

## Startup sequence

1. `node tools/browser/browser.js open "http://127.0.0.1:5173/routes/game.html?game=monkey1"`
2. Wait a few seconds for WASM to load
3. `node tools/browser/browser.js eval "__scummActionsReady()"` — retry until true
4. `node tools/browser/browser.js state` — read initial state
5. Begin playing!

Now start playing the game. Open the browser, navigate to the game, wait for it to load, then begin the gameplay loop: read state, plan, act, observe, repeat.
