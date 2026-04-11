// bridge.js
//
// Receives SCUMM state from the wasm runtime and normalizes it into
// the public surfaces agents read:
//
//   - window.__scummState       (latest authoritative snapshot)
//   - #scumm-state              (JSON mirror in the DOM)
//   - console.debug("[SCUMM_STATE]", ...)
//   - console.debug("[SCUMM_EVENT]", ...)
//   - CustomEvents on window    ("scumm:state", "scumm:event")
//
// The scummvm-agent fork publishes state by calling
// window.__scummPublish(snapshotObject). It should also call
// window.__scummEmit(eventObject) for immediate event messages
// (room/hover/sentence/inventory/ego-moved, see fork's AGENT_HARNESS.md).
//
// Keep this file small — all schema knowledge lives in the fork. The
// harness tolerates unknown top-level keys so additive changes to the
// snapshot don't require bridge changes. A schema version bump (any
// field removed or renamed) logs a loud warning once so the operator
// knows the harness may be rendering stale assumptions.

const HISTORY_CAP = 64;

// Bump this when the consumers (overlay/panel/runbook) are updated for
// a new snapshot schema. Must match the fork's Agent::kSchemaVersion.
const SUPPORTED_SCHEMA = 1;
let schemaWarned = false;

const state = {
  latest: null,
  history: [],
  events: [],
};

function nowIso() {
  return new Date().toISOString();
}

function writeDomMirror(snapshot) {
  const node = document.getElementById("scumm-state");
  if (!node) return;
  try {
    node.textContent = JSON.stringify(snapshot, null, 2);
  } catch (e) {
    node.textContent = "{}";
    console.warn("[SCUMM_BRIDGE] failed to stringify snapshot", e);
  }
}

function persistForStatus() {
  try {
    sessionStorage.setItem(
      "scummLatestSnapshot",
      JSON.stringify(state.latest ?? null)
    );
    sessionStorage.setItem(
      "scummRecentEvents",
      JSON.stringify(state.events.slice(-HISTORY_CAP))
    );
  } catch (_e) {
    // sessionStorage may be disabled; /status will just show empty.
  }
}

function publish(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return;

  if (typeof snapshot.schema === "number" && snapshot.schema > SUPPORTED_SCHEMA && !schemaWarned) {
    schemaWarned = true;
    console.warn(
      "[SCUMM_BRIDGE] snapshot schema " +
        snapshot.schema +
        " is newer than harness-supported schema " +
        SUPPORTED_SCHEMA +
        ". Rendering may be stale; update the harness."
    );
  }

  const normalized = {
    receivedAt: nowIso(),
    ...snapshot,
  };

  state.latest = normalized;
  state.history.push(normalized);
  if (state.history.length > HISTORY_CAP) {
    state.history.splice(0, state.history.length - HISTORY_CAP);
  }

  window.__scummState = normalized;
  writeDomMirror(normalized);
  persistForStatus();

  console.debug("[SCUMM_STATE]", normalized);
  window.dispatchEvent(
    new CustomEvent("scumm:state", { detail: normalized })
  );
}

function emit(event) {
  if (!event || typeof event !== "object") return;
  const normalized = { receivedAt: nowIso(), ...event };
  state.events.push(normalized);
  if (state.events.length > HISTORY_CAP) {
    state.events.splice(0, state.events.length - HISTORY_CAP);
  }
  persistForStatus();

  console.debug("[SCUMM_EVENT]", normalized);
  window.dispatchEvent(
    new CustomEvent("scumm:event", { detail: normalized })
  );
}

// Install the bridge before the wasm runtime loads so the fork can
// simply call these functions from its Emscripten EM_JS code.
window.__scummPublish = publish;
window.__scummEmit = emit;

// Expose a tiny read helper that agents may prefer over poking the
// globals directly.
window.__scummRead = function readScummState() {
  return state.latest;
};

window.__scummHistory = function readScummHistory() {
  return state.history.slice();
};

window.__scummEvents = function readScummEvents() {
  return state.events.slice();
};

// In the absence of a fork build we still want the page to be useful
// for development. Mirror any initial JSON in #scumm-state into
// window.__scummState so overlay/panel/tests have something to chew on.
(function hydrateFromDom() {
  const node = document.getElementById("scumm-state");
  if (!node) return;
  try {
    const initial = JSON.parse(node.textContent || "{}");
    if (initial && typeof initial === "object") {
      window.__scummState = initial;
    }
  } catch (_e) {}
})();
