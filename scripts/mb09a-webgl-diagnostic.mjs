import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";

const OUTPUT_ROOT = resolve(process.cwd(), process.env.PAGES_OUTPUT_DIR ?? "out");
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "/puntos-calor-colombia-dashboard";
const ARTIFACT_DIR = resolve(process.cwd(), "artifacts/mb09a");
const PORT = Number(process.env.MB09A_PORT ?? 4176);
const CDP_PORT = Number(process.env.MB09A_CDP_PORT ?? 9226);

const contentTypes = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".svg": "image/svg+xml", ".mjs": "text/javascript; charset=utf-8",
  ".pmtiles": "application/octet-stream", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".woff2": "font/woff2",
};
const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function resolvePublicFile(pathname) {
  let relative = decodeURIComponent(pathname);
  if (relative === BASE_PATH || relative === `${BASE_PATH}/`) relative = "/";
  else if (relative.startsWith(`${BASE_PATH}/`)) relative = relative.slice(BASE_PATH.length);
  else return null;
  relative = relative.replace(/^\/+/, "");
  if (!relative) relative = "index.html";
  if (relative.includes("..")) return null;
  const candidates = [relative, ...(extname(relative) ? [] : [`${relative}.html`, `${relative}/index.html`])];
  for (const candidate of candidates) {
    const absolute = resolve(OUTPUT_ROOT, candidate);
    if (!absolute.startsWith(OUTPUT_ROOT)) continue;
    try { if ((await stat(absolute)).isFile()) return absolute; } catch {}
  }
  return null;
}

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
      const file = await resolvePublicFile(url.pathname);
      if (!file) { response.writeHead(404); response.end("Not found"); return; }
      const metadata = await stat(file);
      const headers = { "content-type": contentTypes[extname(file)] ?? "application/octet-stream", "accept-ranges": "bytes" };
      const range = request.headers.range?.match(/bytes=(\d+)-(\d*)/);
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), metadata.size - 1) : metadata.size - 1;
        if (!Number.isFinite(start) || start < 0 || start > end || start >= metadata.size) {
          response.writeHead(416, { "content-range": `bytes */${metadata.size}` }); response.end(); return;
        }
        response.writeHead(206, { ...headers, "content-range": `bytes ${start}-${end}/${metadata.size}`, "content-length": String(end - start + 1) });
        createReadStream(file, { start, end }).pipe(response); return;
      }
      response.writeHead(200, { ...headers, "content-length": String(metadata.size) });
      createReadStream(file).pipe(response);
    } catch (error) { response.writeHead(500); response.end(String(error)); }
  });
  return new Promise((resolveServer, rejectServer) => { server.once("error", rejectServer); server.listen(PORT, "127.0.0.1", () => resolveServer(server)); });
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [command], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("No se encontró Chrome/Chromium para el diagnóstico MB-09A.");
}

async function waitForChrome() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (response.ok) {
        const page = (await response.json()).find((target) => target.type === "page");
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {}
    await delay(150);
  }
  throw new Error("Chrome no expuso DevTools Protocol.");
}

async function connectCdp(url) {
  const socket = new WebSocket(url), pending = new Map(), eventListeners = new Map(); let sequence = 0;
  await new Promise((resolveSocket, rejectSocket) => { socket.addEventListener("open", resolveSocket, { once: true }); socket.addEventListener("error", rejectSocket, { once: true }); });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (message.id) {
      const waiter = pending.get(message.id); if (!waiter) return; pending.delete(message.id);
      if (message.error) waiter.reject(new Error(message.error.message)); else waiter.resolve(message.result); return;
    }
    for (const listener of eventListeners.get(message.method) ?? []) listener(message.params ?? {});
  });
  const send = (method, params = {}) => new Promise((resolveMessage, rejectMessage) => { const id = ++sequence; pending.set(id, { resolve: resolveMessage, reject: rejectMessage }); socket.send(JSON.stringify({ id, method, params })); });
  const on = (method, listener) => { const list = eventListeners.get(method) ?? []; list.push(listener); eventListeners.set(method, list); };
  return { socket, send, on };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Error de evaluación CDP");
  return result.result?.value;
}
async function waitFor(send, expression, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) { if (await evaluate(send, expression)) return true; await delay(150); }
  return false;
}
async function stopChrome(process) {
  if (!process || process.exitCode !== null || process.signalCode !== null) return;
  try { process.kill("SIGTERM"); } catch {}
  await delay(800);
  if (process.exitCode === null && process.signalCode === null) { try { process.kill("SIGKILL"); } catch {} }
}
async function screenshot(send, filename) {
  const result = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false, fromSurface: true });
  await writeFile(resolve(ARTIFACT_DIR, filename), Buffer.from(result.data, "base64"));
}

let server, chrome, cdp, profileDir;
const network = [];
const diagnostic = { chromeFlags: [], webgl: null, desktop: null, context: null, mobile: null, network: [], notes: [] };

try {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  server = await startStaticServer();
  profileDir = await mkdtemp(`${tmpdir()}/mb09a-webgl-`);
  const chromePath = findChrome();
  const flags = [
    "--headless=new", "--no-sandbox", "--disable-dev-shm-usage", "--no-first-run", "--no-default-browser-check",
    "--enable-webgl", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--use-gl=angle",
    `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, "about:blank",
  ];
  diagnostic.chromeFlags = flags.filter((flag) => !flag.startsWith("--user-data-dir"));
  chrome = spawn(chromePath, flags, { stdio: ["ignore", "ignore", "pipe"] });
  let chromeStderr = ""; chrome.stderr.on("data", (chunk) => { chromeStderr += String(chunk); });

  cdp = await connectCdp(await waitForChrome());
  await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Network.enable");
  cdp.on("Network.responseReceived", ({ response, type }) => {
    const url = response?.url ?? "";
    if (/VectorTileServer|context-layers\.pmtiles|maplibre-gl-worker|maplibre-gl-shared/i.test(url)) {
      network.push({ url, status: response.status, mimeType: response.mimeType, protocol: response.protocol, type, timing: response.timing ?? null });
    }
  });

  diagnostic.webgl = await evaluate(cdp.send, `(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!gl) return { available: false };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return { available: true, version: gl.getParameter(gl.VERSION), shadingLanguage: gl.getParameter(gl.SHADING_LANGUAGE_VERSION), vendor: ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR), renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER) };
  })()`);

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}${BASE_PATH}/` });
  await waitFor(cdp.send, `Boolean(document.querySelector(".dashboard-shell"))`, 12_000);
  const mapReady = await waitFor(cdp.send, `Boolean(document.querySelector(".geovisor-map .maplibregl-canvas")) || Boolean(document.querySelector(".geovisor-error"))`, 20_000);
  await delay(mapReady ? 8_000 : 1_000);

  const probe = `(() => {
    const rect = (selector) => { const el = document.querySelector(selector); if (!el) return null; const r = el.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
    const canvas = document.querySelector(".geovisor-map .maplibregl-canvas");
    const error = document.querySelector(".geovisor-error")?.textContent?.trim() ?? "";
    const resources = performance.getEntriesByType("resource").filter((entry) => /VectorTileServer|context-layers\\.pmtiles|maplibre-gl-worker|maplibre-gl-shared/i.test(entry.name)).map((entry) => ({ name: entry.name, duration: entry.duration, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize }));
    return { error, canvas: rect(".geovisor-map .maplibregl-canvas"), geovisor: rect(".geovisor-map"), layerControl: rect(".layer-control"), navControl: rect(".maplibregl-ctrl-top-left"), attribution: rect(".maplibregl-ctrl-bottom-left"), scale: rect(".maplibregl-ctrl-bottom-right"), maplibreCanvasCount: document.querySelectorAll(".geovisor-map .maplibregl-canvas").length, resources };
  })()`;
  diagnostic.desktop = await evaluate(cdp.send, probe);
  await screenshot(cdp.send, "geovisor-desktop.png");

  await evaluate(cdp.send, `(() => {
    const wanted = ["Áreas protegidas RUNAP", "Títulos mineros ANM", "Proyectos ANLA", "Áreas asignadas ANH"];
    for (const label of document.querySelectorAll(".layer-control label")) {
      const text = label.textContent?.replace(/\\s+/g, " ").trim() ?? "";
      if (!wanted.some((item) => text.includes(item))) continue;
      const input = label.querySelector('input[type="checkbox"]'); if (input && !input.checked) input.click();
    }
  })()`);
  await delay(7_000);
  diagnostic.context = await evaluate(cdp.send, probe);
  await screenshot(cdp.send, "geovisor-context-layers.png");

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await delay(1_200);
  diagnostic.mobile = await evaluate(cdp.send, probe);
  await screenshot(cdp.send, "geovisor-mobile-390.png");

  diagnostic.network = network;
  if (!diagnostic.webgl?.available) diagnostic.notes.push("SwiftShader no expuso WebGL2 en este runner.");
  if (diagnostic.desktop?.error) diagnostic.notes.push(`Mensaje del geovisor: ${diagnostic.desktop.error}`);
  if (!diagnostic.desktop?.maplibreCanvasCount) diagnostic.notes.push("MapLibre no creó un canvas visible durante el probe.");
  diagnostic.chromeStderrTail = chromeStderr.slice(-4000);
  await writeFile(resolve(ARTIFACT_DIR, "diagnostic.json"), JSON.stringify(diagnostic, null, 2));
  console.log(JSON.stringify(diagnostic, null, 2));
} finally {
  try { cdp?.socket.close(); } catch {}
  await stopChrome(chrome);
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (profileDir) await rm(profileDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
