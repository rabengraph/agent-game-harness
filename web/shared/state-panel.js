// state-panel.js
//
// Compact human-readable state panel on /game. Intentionally ugly and
// dense — this is a debug tool, not product UX.

const panel = document.getElementById("scumm-panel");
if (panel) {
  function render(s) {
    if (!s) {
      panel.innerHTML = '<p class="panel__empty">no state yet</p>';
      return;
    }
    const inv = Array.isArray(s.inventory) ? s.inventory : [];
    const objs = Array.isArray(s.objects) ? s.objects : [];
    const dialog = Array.isArray(s.dialogChoices) ? s.dialogChoices : [];

    panel.innerHTML = `
      <h2 class="panel__title">state</h2>
      <dl class="panel__kv">
        <dt>frame</dt><dd>${fmt(s.frame)}</dd>
        <dt>room</dt><dd>${fmt(s.room)} ${
      s.sceneName ? `<span class="panel__hint">(${escape(s.sceneName)})</span>` : ""
    }</dd>
        <dt>ego</dt><dd>${
          s.ego
            ? `${fmt(s.ego.x)}, ${fmt(s.ego.y)}${s.ego.walking ? " (walking)" : ""}`
            : "—"
        }</dd>
        <dt>verb</dt><dd>${fmt(s.activeVerb)}</dd>
        <dt>sentence</dt><dd>${escape(s.sentenceLine || "—")}</dd>
        <dt>hover</dt><dd>${
          s.hover && s.hover.name
            ? `${escape(s.hover.name)} (#${fmt(s.hover.objectId)})`
            : "—"
        }</dd>
      </dl>

      <h3 class="panel__title">inventory (${inv.length})</h3>
      <ul class="panel__list">
        ${
          inv.length
            ? inv
                .map(
                  (i) =>
                    `<li>${escape(i.name || i)}${
                      i.id != null ? ` <span class="panel__hint">#${i.id}</span>` : ""
                    }</li>`
                )
                .join("")
            : '<li class="panel__empty">empty</li>'
        }
      </ul>

      <h3 class="panel__title">dialog (${dialog.length})</h3>
      <ul class="panel__list">
        ${
          dialog.length
            ? dialog.map((d) => `<li>${escape(d.text || d)}</li>`).join("")
            : '<li class="panel__empty">—</li>'
        }
      </ul>

      <h3 class="panel__title">objects (${objs.length})</h3>
      <ul class="panel__list panel__list--objs">
        ${
          objs.length
            ? objs
                .map(
                  (o) =>
                    `<li>${escape(o.name || "?")} <span class="panel__hint">#${
                      o.id ?? "?"
                    } ${o.clickable === false ? "nc" : "click"}${
                      o.visible === false ? " hidden" : ""
                    }</span></li>`
                )
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
