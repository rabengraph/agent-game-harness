// state-panel.js
//
// Compact human-readable state panel on /game. Intentionally ugly and
// dense — this is a debug tool, not product UX.
//
// Rendered fields follow the fork's v1 snapshot schema (see the fork's
// engines/scumm/AGENT_HARNESS.md §4):
//   room / roomResource / roomWidth × roomHeight
//   ego.pos, ego.walking, ego.facing
//   sentence.verb (resolved via verbs[]) + objectA/objectB names
//   hover.objectName + verbId
//   inventory[]
//   verbs[] (visible only)
//   roomObjects[]
//
// The fork does not emit a pre-formatted `sentenceLine` string, so we
// synthesize one here from sentence.verb + object names. If sentence
// is inactive we show "—".

const panel = document.getElementById("scumm-panel");
if (panel) {
  function render(s) {
    if (!s) {
      panel.innerHTML = '<p class="panel__empty">no state yet</p>';
      return;
    }

    const inv = Array.isArray(s.inventory) ? s.inventory : [];
    const roomObjects = Array.isArray(s.roomObjects) ? s.roomObjects : [];
    const verbs = Array.isArray(s.verbs) ? s.verbs : [];
    const visibleVerbs = verbs.filter((v) => v && v.visible !== false);

    const verbById = new Map();
    for (const v of verbs) if (v && v.id != null) verbById.set(v.id, v);
    const roomObjectsById = new Map();
    for (const o of roomObjects) if (o && o.id != null) roomObjectsById.set(o.id, o);
    const invById = new Map();
    for (const i of inv) if (i && i.id != null) invById.set(i.id, i);
    const lookupObjectName = (id) => {
      if (id == null || id === 0) return null;
      const ro = roomObjectsById.get(id);
      if (ro && ro.name) return ro.name;
      const invItem = invById.get(id);
      if (invItem && invItem.name) return invItem.name;
      return `#${id}`;
    };

    const sentence = s.sentence || {};
    let sentenceLine = "—";
    if (sentence.active) {
      const verbObj = verbById.get(sentence.verb);
      const verbName =
        verbObj && verbObj.name
          ? verbObj.name
          : sentence.verb != null
            ? `verb#${sentence.verb}`
            : "";
      const a = lookupObjectName(sentence.objectA);
      const b = lookupObjectName(sentence.objectB);
      sentenceLine = [verbName, a, b && "with", b].filter(Boolean).join(" ");
      if (!sentenceLine) sentenceLine = "(active, empty)";
    }

    const egoPos =
      s.ego && s.ego.pos
        ? `${fmt(s.ego.pos.x)}, ${fmt(s.ego.pos.y)}${
            s.ego.walking ? " (walking)" : ""
          }${s.ego.facing != null ? ` facing=${s.ego.facing}` : ""}`
        : "—";

    const hover = s.hover || {};
    const hoverLine = hover.objectName
      ? `${escape(hover.objectName)} (#${fmt(hover.objectId)})${
          hover.verbId ? ` verb=${fmt(hover.verbId)}` : ""
        }`
      : hover.objectId
        ? `#${fmt(hover.objectId)}`
        : "—";

    const gameLine = s.gameName
      ? `${escape(s.gameName)}${
          s.gameVersion != null ? ` v${s.gameVersion}` : ""
        }`
      : "—";
    const roomLine = `${fmt(s.room)}${
      s.roomWidth && s.roomHeight
        ? ` <span class="panel__hint">${s.roomWidth}×${s.roomHeight}</span>`
        : ""
    }`;

    panel.innerHTML = `
      <h2 class="panel__title">state</h2>
      <dl class="panel__kv">
        <dt>schema</dt><dd>${fmt(s.schema)}${
      s.seq != null ? ` <span class="panel__hint">seq=${s.seq}</span>` : ""
    }</dd>
        <dt>game</dt><dd>${gameLine}</dd>
        <dt>room</dt><dd>${roomLine}</dd>
        <dt>ego</dt><dd>${egoPos}</dd>
        <dt>sentence</dt><dd>${escape(sentenceLine)}</dd>
        <dt>hover</dt><dd>${hoverLine}</dd>
      </dl>

      <h3 class="panel__title">verbs (${visibleVerbs.length})</h3>
      <ul class="panel__list">
        ${
          visibleVerbs.length
            ? visibleVerbs
                .map(
                  (v) =>
                    `<li>${escape(v.name || `#${v.id}`)} <span class="panel__hint">slot=${v.slot} id=${v.id}</span></li>`
                )
                .join("")
            : '<li class="panel__empty">—</li>'
        }
      </ul>

      <h3 class="panel__title">inventory (${inv.length})</h3>
      <ul class="panel__list">
        ${
          inv.length
            ? inv
                .map(
                  (i) =>
                    `<li>${escape(i.name || "?")} <span class="panel__hint">#${fmt(
                      i.id
                    )}</span></li>`
                )
                .join("")
            : '<li class="panel__empty">empty</li>'
        }
      </ul>

      <h3 class="panel__title">roomObjects (${roomObjects.length})</h3>
      <ul class="panel__list panel__list--objs">
        ${
          roomObjects.length
            ? roomObjects
                .map((o) => {
                  const flags = [];
                  if (o.untouchable) flags.push("untouch");
                  if (o.inInventory) flags.push("inv");
                  const flagStr = flags.length ? " " + flags.join(",") : "";
                  return `<li>${escape(o.name || "?")} <span class="panel__hint">#${
                    o.id ?? "?"
                  } state=${o.state ?? 0}${flagStr}</span></li>`;
                })
                .join("")
            : '<li class="panel__empty">—</li>'
        }
      </ul>
    `;
  }

  function fmt(v) {
    if (v == null) return "—";
    return String(v);
  }
  function escape(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.addEventListener("scumm:state", (e) => render(e.detail));
  render(window.__scummState);
}
