import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";

const OUTPUT_ROOT = resolve(process.cwd(), process.env.PAGES_OUTPUT_DIR ?? "out");
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "/puntos-calor-colombia-dashboard";
const PORT = Number(process.env.RESPONSIVE_TEST_PORT ?? 4173);
const CDP_PORT = Number(process.env.RESPONSIVE_CDP_PORT ?? 9222);
const VIEWPORTS = [
  { width: 1440, height: 900, name: "desktop" },
  { width: 1024, height: 768, name: "laptop" },
  { width: 768, height: 1024, name: "tablet" },
  { width: 390, height: 844, name: "mobile" },
];

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

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

async function stopChrome(process) {
  if (!process || process.exitCode !== null || process.signalCode !== null) return;

  const waitForExit = (timeoutMs) => new Promise((resolveExit) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      process.off("exit", finish);
      resolveExit(process.exitCode !== null || process.signalCode !== null);
    };
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      process.off("exit", finish);
      resolveExit(false);
    }, timeoutMs);
    process.once("exit", finish);
  });

  try { process.kill("SIGTERM"); } catch {}
  if (await waitForExit(3_000)) return;

  try { process.kill("SIGKILL"); } catch {}
  await waitForExit(1_000);
}

async function resolvePublicFile(pathname) {
  let relative = decodeURIComponent(pathname);
  if (relative === BASE_PATH || relative === `${BASE_PATH}/`) relative = "/";
  else if (relative.startsWith(`${BASE_PATH}/`)) relative = relative.slice(BASE_PATH.length);
  else return null;

  relative = relative.replace(/^\/+/, "");
  if (!relative) relative = "index.html";
  if (relative.includes("..")) return null;

  const candidates = [relative];
  if (!extname(relative)) candidates.push(`${relative}.html`, `${relative}/index.html`);

  for (const candidate of candidates) {
    const absolute = resolve(OUTPUT_ROOT, candidate);
    if (!absolute.startsWith(OUTPUT_ROOT)) continue;
    try {
      const metadata = await stat(absolute);
      if (metadata.isFile()) return absolute;
    } catch {
      // Prueba el siguiente candidato.
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
      response.writeHead(200, { "content-type": contentTypes[extname(file)] ?? "application/octet-stream" });
      response.end(await readFile(file));
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
  throw new Error("No se encontró Chrome/Chromium. Este gate debe ejecutarse en un runner con navegador real.");
}

async function waitForChrome() {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`);
      if (response.ok) {
        const targets = await response.json();
        const page = targets.find((target) => target.type === "page");
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch {
      // Chrome todavía está iniciando.
    }
    await delay(150);
  }
  throw new Error("Chrome no expuso DevTools Protocol dentro del tiempo esperado.");
}

async function connectCdp(webSocketUrl) {
  const socket = new WebSocket(webSocketUrl);
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

  function send(method, params = {}) {
    const id = ++sequence;
    return new Promise((resolveMessage, rejectMessage) => {
      pending.set(id, { resolve: resolveMessage, reject: rejectMessage });
      socket.send(JSON.stringify({ id, method, params }));
    });
  }

  return { socket, send };
}

async function evaluate(send, expression) {
  const result = await send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text ?? "Error evaluando el layout en Chrome.");
  return result.result?.value;
}

async function waitForDashboard(send) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const ready = await evaluate(send, `Boolean(document.querySelector(".dashboard-shell")) && document.readyState !== "loading"`);
    if (ready) return;
    await delay(100);
  }
  throw new Error("El dashboard no terminó de renderizar en Chrome.");
}

const layoutProbe = `(() => {
  const keySelectors = [".dashboard-shell", ".topbar", ".notice", ".filterbar", ".metrics-grid", ".workspace-grid", ".audit-strip", "footer"];
  const targetSelectors = [".filterbar input", ".filterbar select", ".filterbar .reset-button", ".segmented button", ".trend-toggle button"];
  const boxes = keySelectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
    const rect = element.getBoundingClientRect();
    return { selector, left: rect.left, right: rect.right, width: rect.width };
  }));
  const targets = targetSelectors.flatMap((selector) => [...document.querySelectorAll(selector)].map((element) => {
    const rect = element.getBoundingClientRect();
    return { selector, text: element.textContent?.trim() ?? "", width: rect.width, height: rect.height };
  }));
  const columns = (selector) => {
    const element = document.querySelector(selector);
    if (!element) return 0;
    const template = getComputedStyle(element).gridTemplateColumns.trim();
    return template ? template.split(/\\s+/).length : 0;
  };
  return {
    innerWidth: window.innerWidth,
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    boxes,
    targets,
    filterColumns: columns(".filterbar"),
    sideColumns: columns(".side-stack"),
  };
})()`;

let server;
let chrome;
let cdp;
let userDataDir;

try {
  server = await startStaticServer();
  userDataDir = await mkdtemp(`${tmpdir()}/dashboard-responsive-`);
  const chromePath = findChrome();
  chrome = spawn(chromePath, [
    "--headless=new",
    "--no-sandbox",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    `--remote-debugging-port=${CDP_PORT}`,
    `--user-data-dir=${userDataDir}`,
    "about:blank",
  ], { stdio: ["ignore", "ignore", "pipe"] });

  let chromeErrors = "";
  chrome.stderr.on("data", (chunk) => { chromeErrors += String(chunk); });

  const webSocketUrl = await waitForChrome();
  cdp = await connectCdp(webSocketUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  const failures = [];
  const results = [];
  for (const viewport of VIEWPORTS) {
    await cdp.send("Emulation.setDeviceMetricsOverride", {
      width: viewport.width,
      height: viewport.height,
      deviceScaleFactor: 1,
      mobile: viewport.width <= 640,
    });
    await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}${BASE_PATH}/` });
    await waitForDashboard(cdp.send);
    await delay(250);
    const probe = await evaluate(cdp.send, layoutProbe);
    results.push({ viewport, ...probe });

    const overflow = Math.max(probe.documentWidth, probe.bodyWidth) - probe.innerWidth;
    if (overflow > 1) failures.push(`${viewport.name}: desbordamiento horizontal de ${overflow}px.`);

    for (const box of probe.boxes) {
      if (box.left < -1 || box.right > probe.innerWidth + 1) {
        failures.push(`${viewport.name}: ${box.selector} sale del viewport (${box.left.toFixed(1)}–${box.right.toFixed(1)}px).`);
      }
    }

    for (const target of probe.targets) {
      if (target.width < 44 || target.height < 44) {
        failures.push(`${viewport.name}: target ${target.selector} ${JSON.stringify(target.text)} mide ${target.width.toFixed(1)}×${target.height.toFixed(1)}px.`);
      }
    }

    if (viewport.width <= 640 && probe.filterColumns !== 1) failures.push(`${viewport.name}: los filtros no se apilan en una columna.`);
    if (viewport.width <= 640 && probe.sideColumns !== 1) failures.push(`${viewport.name}: los gráficos laterales no se apilan en una columna.`);
  }

  console.log(JSON.stringify(results, null, 2));
  if (failures.length) throw new Error(`Falló la validación responsive:\n- ${failures.join("\n- ")}`);
  if (chrome.exitCode && chrome.exitCode !== 0) throw new Error(`Chrome terminó con código ${chrome.exitCode}. ${chromeErrors.slice(-1000)}`);
} finally {
  try { cdp?.socket.close(); } catch {}
  await stopChrome(chrome);
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (userDataDir) await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
