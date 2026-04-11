// agent-brief.js
//
// Tiny helper for the homepage. Reads the machine-readable brief from
// #agent-brief and shows a pretty-printed preview. Agents should parse
// #agent-brief directly — the preview is for humans.

(function () {
  const briefNode = document.getElementById("agent-brief");
  const preview = document.getElementById("agent-brief-preview");
  if (!briefNode || !preview) return;
  try {
    const data = JSON.parse(briefNode.textContent || "{}");
    preview.textContent = JSON.stringify(data, null, 2);
    // Also hang it on window for easy console inspection.
    window.__agentBrief = data;
  } catch (e) {
    preview.textContent = "// failed to parse #agent-brief: " + e.message;
  }
})();
