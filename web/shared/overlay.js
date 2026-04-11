// overlay.js
//
// Draws bounding boxes + labels over the ScummVM canvas so humans can
// visually confirm that the symbolic state matches the rendered scene.
// If overlay and scene disagree, trust the scene — the overlay is a
// debug aid, not ground truth.

const stage = document.getElementById("scumm-stage");
const overlay = document.getElementById("scumm-overlay");
const canvas = document.getElementById("scumm-canvas");

if (stage && overlay && canvas) {
  function render(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.objects)) {
      overlay.innerHTML = "";
      return;
    }

    const cw = canvas.clientWidth || canvas.width;
    const ch = canvas.clientHeight || canvas.height;
    const rw = canvas.width || cw;
    const rh = canvas.height || ch;
    const sx = cw / rw;
    const sy = ch / rh;

    const parts = [];
    for (const obj of snapshot.objects) {
      if (!obj || obj.visible === false) continue;
      const x = Math.round((obj.x ?? 0) * sx);
      const y = Math.round((obj.y ?? 0) * sy);
      const w = Math.round((obj.w ?? 0) * sx);
      const h = Math.round((obj.h ?? 0) * sy);
      const name = obj.name || `#${obj.id ?? "?"}`;
      const clickable = obj.clickable !== false;
      parts.push(
        `<div class="overlay-box ${clickable ? "overlay-box--click" : ""}"` +
          ` style="left:${x}px;top:${y}px;width:${w}px;height:${h}px"` +
          ` data-object-id="${obj.id ?? ""}"` +
          ` title="${escapeAttr(name)}">` +
          `<span class="overlay-label">${escapeHtml(name)}</span>` +
          `</div>`
      );
    }

    if (snapshot.hover && snapshot.hover.name) {
      parts.push(
        `<div class="overlay-hover">hover: ${escapeHtml(
          snapshot.hover.name
        )}</div>`
      );
    }

    overlay.innerHTML = parts.join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  window.addEventListener("scumm:state", (e) => render(e.detail));
  if (window.__scummState) render(window.__scummState);
}
