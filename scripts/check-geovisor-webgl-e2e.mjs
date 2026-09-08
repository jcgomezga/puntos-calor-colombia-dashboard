import { spawn, spawnSync } from "node:child_process";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";

const OUTPUT_ROOT = resolve(process.cwd(), process.env.PAGES_OUTPUT_DIR ?? "out");
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "/puntos-calor-colombia-dashboard";
const PORT = Number(process.env.GEOVISOR_E2E_PORT ?? 4175);
const CDP_PORT = Number(process.env.GEOVISOR_E2E_CDP_PORT ?? 9225);

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".mjs": "text/javascript; charset=utf-8",
  ".pmtiles": "application/octet-stream",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

const delay = (ms) => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

async function stopChrome(process) {
  if (!process || process.exitCode !== null || process.signalCode !== null) return;
  try { process.kill("SIGTERM"); } catch {}
  await delay(700);
  if (process.exitCode === null && process.signalCode === null) {
    try { process.kill("SIGKILL"); } catch {}
  }
}

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
    try {
      if ((await stat(absolute)).isFile()) return absolute;
    } catch {
      // Continúa con el siguiente candidato.
    }
  }
  return null;
}

function startStaticServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url ?? "/", `http://127.0.0.1:${PORT}`);
      const file = await resolvePublicFile(url.pathname);
      if (!file) {
        response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
        response.end("Not found");
        return;
      }
      const metadata = await stat(file);
      const headers = { "content-type": contentTypes[extname(file)] ?? "application/octet-stream", "accept-ranges": "bytes" };
      const range = request.headers.range?.match(/bytes=(\d+)-(\d*)/);
      if (range) {
        const start = Number(range[1]);
        const end = range[2] ? Math.min(Number(range[2]), metadata.size - 1) : metadata.size - 1;
        if (!Number.isFinite(start) || start < 0 || start > end || start >= metadata.size) {
          response.writeHead(416, { "content-range": `bytes */${metadata.size}` });
          response.end();
          return;
        }
        response.writeHead(206, {
          ...headers,
          "content-range": `bytes ${start}-${end}/${metadata.size}`,
          "content-length": String(end - start + 1),
        });
        createReadStream(file, { start, end }).pipe(response);
        return;
      }
      response.writeHead(200, { ...headers, "content-length": String(metadata.size) });
      createReadStream(file).pipe(response);
    } catch (error) {
      response.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
      response.end(String(error));
    }
  });
  return new Promise((resolveServer, rejectServer) => {
    server.once("error", rejectServer);
    server.listen(PORT, "127.0.0.1", () => resolveServer(server));
  });
}

function findChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  for (const command of ["google-chrome", "google-chrome-stable", "chromium", "chromium-browser"]) {
    const result = spawnSync("which", [command], { encoding: "utf8" });
    if (result.status === 0 && result.stdout.trim()) return result.stdout.trim();
  }
  throw new Error("No se encontró Chrome/Chromium para el gate cartográfico WebGL2.");
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
    } catch {
      // Chrome todavía inicia.
    }
    await delay(150);
  }
  throw new Error("Chrome no expuso DevTools Protocol para el gate cartográfico.");
}

async function connectCdp(url) {
  const socket = new WebSocket(url);
  const pending = new Map();
  let sequence = 0;
  await new Promise((resolveSocket, rejectSocket) => {
    socket.addEventListener("open", resolveSocket, { once: true });
    socket.addEventListener("error", rejectSocket, { once: true });
  });
  socket.addEventListener("message", (event) => {
    const message = JSON.parse(String(event.data));
    if (!message.id) return;
    const waiter = pending.get(message.id);
    if (!waiter) return;
    pending.delete(message.id);
    if (message.error) waiter.reject(new Error(message.error.message));
    else waiter.resolve(message.result);
  });
  const send = (method, params = {}) => new Promise((resolveMessage, rejectMessage) => {
    const id = ++sequence;
    pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
    socket.send(JSON.stringify({ id, method, params }));
  });
  return { socket, send };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Falló una aserción cartográfica en Chrome.");
  }
  return result.result?.value;
}

async function waitFor(send, expression, message, timeoutMs = 15_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(send, expression)) return;
    await delay(120);
  }
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

let server;
let chrome;
let cdp;
let userDataDir;
const checks = [];

try {
  server = await startStaticServer();
  userDataDir = await mkdtemp(`${tmpdir()}/geovisor-webgl-e2e-`);
  chrome = spawn(findChrome(), [
    "--headless=new",
    "--no-sandbox",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--enable-webgl",
    "--ignore-gpu-blocklist",
    "--enable-unsafe-swiftshader",
    "--use-angle=swiftshader",
    "--use-gl=angle",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let chromeErrors = "";
  chrome.stderr.on("data", (chunk) => { chromeErrors += String(chunk); });

  cdp = await connectCdp(await waitForChrome());
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");
  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  const webgl = await evaluate(cdp.send, `(() => {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2", { failIfMajorPerformanceCaveat: false });
    if (!gl) return { available: false };
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      available: true,
      version: gl.getParameter(gl.VERSION),
      renderer: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
    };
  })()`);
  assert(webgl?.available, "Chrome no expuso WebGL2 con SwiftShader.");
  checks.push({ flow: "WebGL2", version: webgl.version, renderer: webgl.renderer });

  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}${BASE_PATH}/` });
  await waitFor(cdp.send, `Boolean(document.querySelector(".dashboard-shell"))`, "El dashboard no renderizó.");
  await waitFor(cdp.send, `Boolean(document.querySelector(".geovisor-map .maplibregl-canvas"))`, "MapLibre no creó canvas WebGL2.", 25_000);

  const desktop = await evaluate(cdp.send, `(() => {
    const panel = document.querySelector(".layer-control");
    const detection = [...document.querySelectorAll(".query-control button")].find((button) => button.textContent?.trim() === "Detección");
    const centerButton = [...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Consultar centro del mapa");
    const nav = document.querySelector(".maplibregl-ctrl-group button");
    return {
      canvasCount: document.querySelectorAll(".geovisor-map .maplibregl-canvas").length,
      panelOpen: panel?.classList.contains("open") ?? false,
      detectionPressed: detection?.getAttribute("aria-pressed"),
      centerButton: Boolean(centerButton),
      navWidth: nav ? Number.parseFloat(getComputedStyle(nav).width) : 0,
      navHeight: nav ? Number.parseFloat(getComputedStyle(nav).height) : 0,
    };
  })()`);
  assert(desktop.canvasCount === 1, `Se esperó 1 canvas MapLibre; se encontraron ${desktop.canvasCount}.`);
  assert(desktop.panelOpen, "El panel cartográfico debe iniciar abierto en escritorio.");
  assert(desktop.detectionPressed === "true", "Detección debe ser el modo de consulta inicial.");
  assert(desktop.centerButton, "Falta la alternativa accesible «Consultar centro del mapa».");
  assert(desktop.navWidth >= 40 && desktop.navHeight >= 40, `Targets MapLibre insuficientes en escritorio: ${desktop.navWidth}×${desktop.navHeight}.`);
  checks.push({ flow: "geovisor escritorio", ...desktop });

  await evaluate(cdp.send, `([...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Consultar centro del mapa"))?.click()`);
  await waitFor(cdp.send, `Boolean(document.querySelector(".query-feedback")?.textContent?.trim())`, "La consulta por centro no publicó feedback accesible.");
  checks.push({ flow: "consulta espacial por teclado" });

  await cdp.send("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await waitFor(cdp.send, `document.querySelector(".layer-control")?.classList.contains("collapsed") === true`, "El panel de capas no se colapsó en 390 px.", 8_000);
  const mobile = await evaluate(cdp.send, `(() => {
    const rect = (element) => { if (!element) return null; const r = element.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
    const map = rect(document.querySelector(".geovisor-map"));
    const panel = rect(document.querySelector(".layer-control"));
    const overlap = (a, b) => { if (!a || !b) return 0; const width = Math.max(0, Math.min(a.right,b.right)-Math.max(a.x,b.x)); const height = Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.y,b.y)); return a.width*a.height ? (width*height)/(a.width*a.height) : 0; };
    const toggle = document.querySelector(".layer-control-toggle");
    const nav = document.querySelector(".maplibregl-ctrl-group button");
    return {
      map,
      panel,
      occlusionRatio: overlap(map, panel),
      collapsed: document.querySelector(".layer-control")?.classList.contains("collapsed") ?? false,
      toggleText: toggle?.textContent?.trim(),
      toggleHeight: toggle ? Number.parseFloat(getComputedStyle(toggle).height) : 0,
      navWidth: nav ? Number.parseFloat(getComputedStyle(nav).width) : 0,
      navHeight: nav ? Number.parseFloat(getComputedStyle(nav).height) : 0,
    };
  })()`);
  assert(mobile.collapsed, "El panel móvil debe iniciar colapsado.");
  assert(mobile.occlusionRatio < 0.15, `Oclusión móvil excesiva: ${(mobile.occlusionRatio * 100).toFixed(1)} %.`);
  assert(mobile.toggleHeight >= 44, `Target del botón móvil insuficiente: ${mobile.toggleHeight}px.`);
  assert(mobile.navWidth >= 44 && mobile.navHeight >= 44, `Targets MapLibre móviles insuficientes: ${mobile.navWidth}×${mobile.navHeight}.`);
  checks.push({ flow: "geovisor móvil 390", ...mobile });

  await evaluate(cdp.send, `document.querySelector(".layer-control-toggle")?.click()`);
  await waitFor(cdp.send, `document.querySelector(".layer-control")?.classList.contains("open") === true && Boolean(document.querySelector(".center-query-button"))`, "No fue posible abrir el panel cartográfico móvil.");
  checks.push({ flow: "panel móvil expandible" });

  const basicButtonExists = await evaluate(cdp.send, `[...document.querySelectorAll("button")].some((button) => button.textContent?.trim() === "Mapa básico")`);
  if (basicButtonExists) {
    await evaluate(cdp.send, `([...document.querySelectorAll("button")].find((button) => button.textContent?.trim() === "Mapa básico"))?.click()`);
    await waitFor(cdp.send, `Boolean(document.querySelector(".real-map .territory-shape[tabindex='0']"))`, "El Mapa básico no expuso territorios enfocables por teclado.");
    checks.push({ flow: "mapa básico teclado" });
  }

  if (chrome.exitCode && chrome.exitCode !== 0) throw new Error(`Chrome terminó con código ${chrome.exitCode}. ${chromeErrors.slice(-1200)}`);
  console.log(JSON.stringify({ checks }, null, 2));
} finally {
  try { cdp?.socket.close(); } catch {}
  await stopChrome(chrome);
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (userDataDir) await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
