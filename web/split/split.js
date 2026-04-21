// split.js — wires two same-origin iframes into parent-level adapters
// (window.scumm1 / window.scumm2), wraps each iframe's __scumm* action
// globals so every call is recorded as NDJSON-friendly rows in
// window.__splitLog, and offers a one-click download.
//
// Same-origin access does the heavy lifting: nothing in bridge.js or
// the fork needs to change. The children don't know they are inside a
// split view — the parent just happens to listen to their DOM events
// and wrap their globals.

const ACTION_GLOBALS = [
  "__scummDoSentence",
  "__scummSelectDialog",
  "__scummSkipMessage",
  "__scummWalkTo",
  "__scummClickAt",
];

const runStart = Date.now();
const perfStart = performance.now();
const runId = `r-${runStart}`;

// Query-string passthrough: if /split was loaded with ?mock=1 (or any
// params we care to propagate), append them to each iframe's src so we
// can exercise the plumbing without the fork built. Kept minimal on
// purpose — parent route params should not leak into the game by
// default.
const PASSTHROUGH_PARAMS = ["mock", "overlay"];
(function applyIframeSrcs() {
  const parentParams = new URLSearchParams(window.location.search);
  const extra = PASSTHROUGH_PARAMS
    .map((k) => (parentParams.has(k) ? `${k}=${encodeURIComponent(parentParams.get(k))}` : null))
    .filter(Boolean);
  for (const f of document.querySelectorAll("iframe[data-src]")) {
    const base = f.getAttribute("data-src");
    const sep = base.includes("?") ? "&" : "?";
    f.src = extra.length ? base + sep + extra.join("&") : base;
  }
})();

const log = [];
window.__splitLog = log;

const actionCountEl = document.getElementById("action-count");

function nowRel() {
  return Math.round(performance.now() - perfStart);
}

function append(row) {
  log.push(row);
  if (actionCountEl) {
    actionCountEl.textContent = `actions: ${log.length - 1}`; // exclude meta row
  }
  window.dispatchEvent(new CustomEvent("split:row", { detail: row }));
}

function methodName(globalName) {
  // "__scummDoSentence" -> "doSentence"
  return globalName.replace(/^__scumm/, "").replace(/^./, (c) => c.toLowerCase());
}

function safeArgs(args) {
  // Most actions take a single object or a couple of numbers. Keep the
  // log compact by unwrapping single-arg calls.
  if (args.length === 0) return null;
  if (args.length === 1) return args[0];
  return Array.from(args);
}

function wrapActions(frameWin, agentId) {
  for (const g of ACTION_GLOBALS) {
    const orig = frameWin[g];
    if (typeof orig !== "function") continue;
    if (orig.__splitWrapped) continue;

    const method = methodName(g);
    function wrapped(...args) {
      const t = Date.now();
      const tRel = nowRel();
      const stateSeq = frameWin.__scummState?.seq;
      const start = performance.now();
      try {
        const result = orig.apply(this, args);
        append({
          kind: "action",
          agent: agentId,
          t,
          tRel,
          method,
          args: safeArgs(args),
          ok: true,
          result,
          durMs: +(performance.now() - start).toFixed(2),
          stateSeq,
        });
        return result;
      } catch (err) {
        append({
          kind: "action",
          agent: agentId,
          t,
          tRel,
          method,
          args: safeArgs(args),
          ok: false,
          error: String(err),
          durMs: +(performance.now() - start).toFixed(2),
          stateSeq,
        });
        throw err;
      }
    }
    wrapped.__splitWrapped = true;
    frameWin[g] = wrapped;
  }
}

function frameWin(frameIdx) {
  const el = document.getElementById(`frame-${frameIdx + 1}`);
  return el ? el.contentWindow : null;
}

function makeAdapter(frameIdx) {
  const w = () => frameWin(frameIdx);
  return {
    get window() {
      return w();
    },
    read: () => w()?.__scummRead?.(),
    eventsSince: (c) => w()?.__scummEventsSince?.(c),
    doSentence: (s) => w()?.__scummDoSentence?.(s),
    selectDialog: (i) => w()?.__scummSelectDialog?.(i),
    skipMessage: () => w()?.__scummSkipMessage?.(),
    walkTo: (x, y) => w()?.__scummWalkTo?.(x, y),
    clickAt: (x, y) => w()?.__scummClickAt?.(x, y),
    actionsReady: () => {
      try {
        return w()?.__scummActionsReady?.() ?? false;
      } catch {
        return false;
      }
    },
  };
}

window.scumm1 = makeAdapter(0);
window.scumm2 = makeAdapter(1);

async function untilBridge(frameEl) {
  // bridge.js installs __scummRead + __scumm*Sentence synchronously
  // once it loads, well before WASM is ready. Polling is cheap here.
  while (true) {
    const w = frameEl.contentWindow;
    if (
      w &&
      typeof w.__scummRead === "function" &&
      typeof w.__scummDoSentence === "function"
    ) {
      return w;
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function untilReady(w) {
  while (true) {
    try {
      if (typeof w.__scummActionsReady === "function" && w.__scummActionsReady()) {
        return;
      }
      // Mock-mode fallback. The fake runtime never installs
      // Module._agent_* exports, so __scummActionsReady() stays false
      // forever. Treat a published mock snapshot as "ready enough" so
      // the UI + recorder exercise end-to-end without a fork build.
      const snap = typeof w.__scummRead === "function" ? w.__scummRead() : null;
      if (snap && snap.mock === true && (snap.seq ?? 0) > 0) return;
    } catch {
      /* still booting */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

function setStatus(id, text, ready = false) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("split__badge--ready", ready);
}

async function boot(agentId) {
  const frameEl = document.getElementById(`frame-${agentId}`);
  const statusId = `status-${agentId}`;
  setStatus(statusId, `agent ${agentId}: waiting for bridge…`);
  const w = await untilBridge(frameEl);
  wrapActions(w, agentId);
  setStatus(statusId, `agent ${agentId}: bridge ready, booting WASM…`);
  await untilReady(w);
  const snap = w.__scummRead?.();
  setStatus(statusId, `agent ${agentId}: ready`, true);
  append({
    kind: "ready",
    agent: agentId,
    t: Date.now(),
    tRel: nowRel(),
    gameName: snap?.gameName ?? null,
    gameId: snap?.gameId ?? null,
    room: snap?.room ?? null,
  });
}

function buildNdjson() {
  return log.map((r) => JSON.stringify(r)).join("\n") + "\n";
}

window.__splitDownload = function download() {
  const ndjson = buildNdjson();
  const blob = new Blob([ndjson], { type: "application/x-ndjson" });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `split-${stamp}.ndjson`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};

document
  .getElementById("download-log")
  .addEventListener("click", () => window.__splitDownload());

// Meta row — first line of every NDJSON export so a reader can key on
// schema version, run id, and start time without guessing.
append({
  kind: "meta",
  runId,
  startedAt: runStart,
  gameId: "monkey1-demo",
  schemaVersion: 1,
  t: runStart,
  tRel: 0,
});

boot(1).catch((err) => console.error("[split] agent 1 boot failed", err));
boot(2).catch((err) => console.error("[split] agent 2 boot failed", err));
