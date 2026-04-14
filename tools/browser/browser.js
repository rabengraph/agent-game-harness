#!/usr/bin/env node
// tools/browser/browser.js
//
// Browser harness for AI agents playing ScummVM.
//
// Uses raw Chrome DevTools Protocol (CDP) over WebSocket.
// Locates Chromium from the Playwright cache dir on disk (no Playwright
// runtime dependency). All browser communication is direct CDP.
//
// Usage:
//   node tools/browser/browser.js <command> [arg]

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const http = require("http");
const net = require("net");
const readline = require("readline");

const BASE_URL = process.env.SCUMM_URL || "http://127.0.0.1:5173";
const BRIEF_URL = `${BASE_URL}/briefing`;
const SCREENSHOT_DIR = path.join(__dirname, "../../state");
const USER_DATA_DIR = path.join(__dirname, ".chromium-profile");
const CDP_PORT = 9222;

// ---------------------------------------------------------------------------
// Raw CDP helpers — use Node 22 built-in WebSocket
// ---------------------------------------------------------------------------

/** GET a JSON endpoint from Chrome's CDP HTTP interface. */
function cdpGet(urlPath) {
  return new Promise((resolve, reject) => {
    http
      .get(`http://127.0.0.1:${CDP_PORT}${urlPath}`, (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try { resolve(JSON.parse(data)); }
          catch (e) { reject(new Error(`CDP parse error: ${e.message}`)); }
        });
      })
      .on("error", (e) => reject(new Error(`CDP HTTP error: ${e.message}`)));
  });
}

/** Send a single CDP command over WebSocket and return the result. */
function cdpCommand(wsUrl, method, params = {}, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    const id = 1;
    let done = false;

    const timer = setTimeout(() => {
      if (!done) { done = true; ws.close(); reject(new Error(`CDP timeout: ${method}`)); }
    }, timeoutMs);

    ws.addEventListener("open", () => {
      ws.send(JSON.stringify({ id, method, params }));
    });

    ws.addEventListener("message", (event) => {
      const msg = JSON.parse(typeof event.data === "string" ? event.data : event.data.toString());
      if (msg.id === id && !done) {
        done = true;
        clearTimeout(timer);
        ws.close();
        if (msg.error) reject(new Error(`CDP error: ${msg.error.message}`));
        else resolve(msg.result);
      }
    });

    ws.addEventListener("error", (err) => {
      if (!done) { done = true; clearTimeout(timer); reject(err); }
    });
  });
}

/**
 * Evaluate a JS expression in the page and return the result.
 * Wraps in a try/catch so errors come back as data, not exceptions.
 */
async function pageEval(wsUrl, expression) {
  // Wrap the expression so we always get a JSON-serializable result
  const wrapped = `
    (() => {
      try {
        const __result = eval(${JSON.stringify(expression)});
        // Handle undefined, functions, symbols — things JSON can't represent
        if (__result === undefined) return { __ok: true, __value: null, __undefined: true };
        return { __ok: true, __value: __result };
      } catch (e) {
        return { __ok: false, __error: String(e) };
      }
    })()
  `;
  const cdpResult = await cdpCommand(wsUrl, "Runtime.evaluate", {
    expression: wrapped,
    returnByValue: true,
    awaitPromise: false,
  });
  if (cdpResult.exceptionDetails) {
    return { ok: false, error: cdpResult.exceptionDetails.text || "Evaluation failed" };
  }
  const val = cdpResult.result?.value;
  if (!val) return { ok: true, value: null };
  if (!val.__ok) return { ok: false, error: val.__error };
  return { ok: true, value: val.__value, undefined: val.__undefined || false };
}

// ---------------------------------------------------------------------------
// Browser lifecycle
// ---------------------------------------------------------------------------

function findChromiumPath() {
  const cacheDir =
    process.env.PLAYWRIGHT_BROWSERS_PATH ||
    path.join(process.env.HOME || process.env.USERPROFILE || "", "Library/Caches/ms-playwright");
  if (fs.existsSync(cacheDir)) {
    const dirs = fs.readdirSync(cacheDir).filter((d) => d.startsWith("chromium-"));
    if (dirs.length > 0) {
      dirs.sort();
      const latest = dirs[dirs.length - 1];
      for (const rel of [
        "chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-mac/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing",
        "chrome-linux/chrome",
      ]) {
        const p = path.join(cacheDir, latest, rel);
        if (fs.existsSync(p)) return p;
      }
    }
  }
  return null;
}

function isPortOpen(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    sock.setTimeout(500);
    sock.on("connect", () => { sock.destroy(); resolve(true); });
    sock.on("timeout", () => { sock.destroy(); resolve(false); });
    sock.on("error", () => { sock.destroy(); resolve(false); });
    sock.connect(port, "127.0.0.1");
  });
}

async function ensureBrowser() {
  if (await isPortOpen(CDP_PORT)) return; // already running

  const execPath = findChromiumPath();
  if (!execPath || !fs.existsSync(execPath)) {
    throw new Error("Chromium not found. Run: npx playwright install chromium (one-time setup)");
  }

  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  const child = spawn(execPath, [
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${USER_DATA_DIR}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-blink-features=AutomationControlled",
    "about:blank",
  ], { detached: true, stdio: "ignore" });
  child.unref();

  // Wait for CDP to be ready
  const start = Date.now();
  while (Date.now() - start < 10000) {
    if (await isPortOpen(CDP_PORT)) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`Chromium did not start CDP on port ${CDP_PORT} within 10s`);
}

/** Get the WebSocket debugger URL for the first page. */
async function getPageWsUrl() {
  const pages = await cdpGet("/json");
  const page = pages.find((p) => p.type === "page");
  if (!page) throw new Error("No page found in browser");
  return page.webSocketDebuggerUrl;
}

// ---------------------------------------------------------------------------
// Command handlers
// ---------------------------------------------------------------------------

async function cmdOpen(wsUrl, arg) {
  const url = arg || BRIEF_URL;
  await cdpCommand(wsUrl, "Page.navigate", { url });
  // Wait for page to load
  await new Promise((r) => setTimeout(r, 1500));
  const readyResult = await pageEval(wsUrl,
    "typeof window.__scummActionsReady === 'function' ? window.__scummActionsReady() : false"
  );
  // Get the current URL
  const urlResult = await pageEval(wsUrl, "window.location.href");
  return {
    ok: true,
    action: "open",
    url: urlResult.value,
    actionsReady: readyResult.value || false,
  };
}

async function cmdState(wsUrl) {
  const result = await pageEval(wsUrl,
    "typeof window.__scummRead === 'function' ? window.__scummRead() : null"
  );
  if (!result.ok) return { ok: false, action: "state", error: result.error };
  if (!result.value) return { ok: false, action: "state", error: "No state available yet (WASM may not be loaded)" };
  return { ok: true, action: "state", state: result.value };
}

async function cmdEvents(wsUrl, arg) {
  const cursor = parseInt(arg, 10) || 0;
  const result = await pageEval(wsUrl,
    `typeof window.__scummEventsSince === 'function' ? window.__scummEventsSince(${cursor}) : { events: [], cursor: ${cursor} }`
  );
  if (!result.ok) return { ok: false, action: "events", error: result.error };
  return { ok: true, action: "events", ...result.value };
}

async function cmdEval(wsUrl, arg) {
  if (!arg) return { ok: false, action: "eval", error: "No expression provided" };
  const result = await pageEval(wsUrl, arg);
  return { action: "eval", ...result };
}

async function cmdScreenshot(wsUrl, arg) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const filename = arg || `screenshot-${Date.now()}.png`;
  const filepath = path.isAbsolute(filename) ? filename : path.join(SCREENSHOT_DIR, filename);
  const result = await cdpCommand(wsUrl, "Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(filepath, Buffer.from(result.data, "base64"));
  return { ok: true, action: "screenshot", path: filepath };
}

async function cmdAction(wsUrl, arg) {
  if (!arg) return { ok: false, action: "action", error: "No action JSON provided" };
  let parsed;
  try { parsed = JSON.parse(arg); }
  catch (e) { return { ok: false, action: "action", error: `Invalid JSON: ${e.message}` }; }

  const { type, ...params } = parsed;

  // Build the JS expression to evaluate in the page
  let expr;
  switch (type) {
    case "doSentence":
      expr = `window.__scummDoSentence({ verb: ${params.verb}, objectA: ${params.objectA || 0}, objectB: ${params.objectB || 0} })`;
      break;
    case "walkTo":
      expr = `window.__scummWalkTo(${params.x}, ${params.y})`;
      break;
    case "clickAt":
      expr = `window.__scummClickAt(${params.x}, ${params.y})`;
      break;
    case "clickObject":
      expr = `window.__scummClickObject(${params.objectId})`;
      break;
    case "selectDialog":
      expr = `window.__scummSelectDialog(${params.index})`;
      break;
    case "skipMessage":
      expr = `window.__scummSkipMessage()`;
      break;
    default:
      return { ok: false, action: "action", error: `Unknown action type: ${type}` };
  }

  // Check readiness first
  const ready = await pageEval(wsUrl,
    "typeof window.__scummActionsReady === 'function' ? window.__scummActionsReady() : false"
  );
  if (ready.ok && !ready.value) {
    return { action: "action", type, ok: false, error: "Actions not ready (WASM not loaded)" };
  }

  const result = await pageEval(wsUrl, expr);
  return { action: "action", type, ok: result.ok ? (result.value !== false) : false, error: result.error };
}

async function cmdClose() {
  try { execSync(`lsof -ti :${CDP_PORT} | xargs kill 2>/dev/null`, { stdio: "ignore" }); }
  catch (_e) {}
  return { ok: true, action: "close" };
}

// ---------------------------------------------------------------------------
// Interactive loop
// ---------------------------------------------------------------------------

async function cmdLoop() {
  await ensureBrowser();
  let wsUrl = await getPageWsUrl();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, prompt: "scumm> " });
  console.log(JSON.stringify({ ok: true, action: "loop", message: "Interactive mode. Send JSON: {\"cmd\":\"state\"}" }));
  rl.prompt();

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "quit" || trimmed === "exit") {
      console.log(JSON.stringify({ ok: true, action: "quit" }));
      return;
    }

    let parsed;
    try { parsed = JSON.parse(trimmed); }
    catch (_e) { parsed = { cmd: trimmed }; }

    const { cmd, arg } = parsed;
    let result;
    try {
      // Refresh wsUrl in case page changed
      wsUrl = await getPageWsUrl();
      switch (cmd) {
        case "open":    result = await cmdOpen(wsUrl, arg); break;
        case "state":   result = await cmdState(wsUrl); break;
        case "events":  result = await cmdEvents(wsUrl, arg); break;
        case "eval":    result = await cmdEval(wsUrl, arg); break;
        case "screenshot": result = await cmdScreenshot(wsUrl, arg); break;
        case "action":
          result = await cmdAction(wsUrl, typeof arg === "string" ? arg : JSON.stringify(arg));
          break;
        case "close":
          result = await cmdClose();
          console.log(JSON.stringify(result));
          return;
        default:
          result = { ok: false, error: `Unknown command: ${cmd}` };
      }
    } catch (e) {
      result = { ok: false, error: String(e) };
    }
    console.log(JSON.stringify(result));
    rl.prompt();
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

(async () => {
  const command = process.argv[2];
  const arg = process.argv.slice(3).join(" ");

  if (!command) {
    console.log(JSON.stringify({
      ok: false,
      error: "Usage: browser.js <open|state|events|eval|screenshot|action|loop|close> [arg]",
    }));
    process.exitCode = 1;
    return;
  }

  if (command === "close") {
    console.log(JSON.stringify(await cmdClose(), null, 2));
    return;
  }

  if (command === "loop") {
    await cmdLoop();
    return;
  }

  await ensureBrowser();
  const wsUrl = await getPageWsUrl();

  let result;
  try {
    switch (command) {
      case "open":       result = await cmdOpen(wsUrl, arg || undefined); break;
      case "state":      result = await cmdState(wsUrl); break;
      case "events":     result = await cmdEvents(wsUrl, arg || undefined); break;
      case "eval":       result = await cmdEval(wsUrl, arg || undefined); break;
      case "screenshot": result = await cmdScreenshot(wsUrl, arg || undefined); break;
      case "action":     result = await cmdAction(wsUrl, arg || undefined); break;
      default:           result = { ok: false, error: `Unknown command: ${command}` };
    }
  } catch (e) {
    result = { ok: false, error: String(e) };
  }

  console.log(JSON.stringify(result, null, 2));
  // Node exits naturally — no cleanup needed, no pages destroyed.
  // Each CDP WebSocket was already closed after its command completed.
})();
