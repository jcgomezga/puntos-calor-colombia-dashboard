import { spawn, spawnSync } from "node:child_process";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, resolve } from "node:path";

const OUTPUT_ROOT = resolve(process.cwd(), process.env.PAGES_OUTPUT_DIR ?? "out");
const BASE_PATH = process.env.PAGES_BASE_PATH ?? "/puntos-calor-colombia-dashboard";
const PORT = Number(process.env.E2E_TEST_PORT ?? 4174);
const CDP_PORT = Number(process.env.E2E_CDP_PORT ?? 9223);
const dashboard = JSON.parse(await readFile(resolve(process.cwd(), "public/data/dashboard.json"), "utf8"));
const operational = dashboard.points.filter((point) => point[7] === 1);

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
  throw new Error("No se encontró Chrome/Chromium. MB-07 exige un navegador real en CI.");
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
  if (result.exceptionDetails) {
    const detail = result.exceptionDetails.exception?.description ?? result.exceptionDetails.text ?? "Error ejecutando E2E en Chrome.";
    throw new Error(detail);
  }
  return result.result?.value;
}

async function waitFor(send, expression, message, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await evaluate(send, expression)) return;
    await delay(100);
  }
  throw new Error(message);
}

async function waitForDashboard(send) {
  await waitFor(
    send,
    `Boolean(document.querySelector(".dashboard-shell")) && Boolean(document.querySelector(".metric-card")) && document.readyState !== "loading"`,
    "El dashboard no terminó de renderizar en Chrome.",
  );
}

function normalizeName(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
}

function findNamed(items, name) {
  const target = normalizeName(name);
  return items.find((item) => normalizeName(item.name) === target);
}

function countVisible({ departmentIndex, municipalityIndex, startIndex = 0, endIndex = dashboard.dates.length - 1, protectedRelation = "all", coverageCode = "all", anlaStatus = "all" } = {}) {
  return operational.filter((point) => {
    if (point[4] < startIndex || point[4] > endIndex) return false;
    if (departmentIndex !== undefined && point[2] !== departmentIndex) return false;
    if (municipalityIndex !== undefined && point[3] !== municipalityIndex) return false;
    if (protectedRelation === "inside" && point[11] !== 1) return false;
    if (protectedRelation === "outside" && point[11] === 1) return false;
    if (coverageCode !== "all") {
      if (coverageCode === "unassigned") {
        if ((point[12] ?? -1) >= 0) return false;
      } else {
        if ((point[12] ?? -1) < 0 || dashboard.landCovers?.[point[12]]?.level1Code !== coverageCode) return false;
      }
    }
    if (anlaStatus === "evaluation" && ((point[15] ?? 0) & 1) === 0) return false;
    if (anlaStatus === "licensed" && ((point[15] ?? 0) & 2) === 0) return false;
    return true;
  }).length;
}

function findZeroCombination() {
  const coverCodes = [...new Set((dashboard.landCovers ?? []).map((item) => item.level1Code))].sort();
  for (let departmentIndex = 0; departmentIndex < dashboard.departments.length; departmentIndex += 1) {
    for (const coverageCode of coverCodes) {
      if (countVisible({ departmentIndex, coverageCode }) === 0) {
        return { departmentIndex, coverageCode };
      }
    }
  }
  for (let departmentIndex = 0; departmentIndex < dashboard.departments.length; departmentIndex += 1) {
    for (const coverageCode of coverCodes) {
      if (countVisible({ departmentIndex, coverageCode, protectedRelation: "inside" }) === 0) {
        return { departmentIndex, coverageCode, protectedRelation: "inside" };
      }
    }
  }
  throw new Error("No se encontró una combinación estable de filtros con cero resultados para validar el estado vacío.");
}

const filterControl = (label) => `(() => {
  const label = [...document.querySelectorAll(".filterbar label")].find((item) => item.querySelector(":scope > span")?.textContent?.trim() === ${JSON.stringify(label)});
  if (!label) throw new Error("No existe filtro: " + ${JSON.stringify(label)});
  const control = label.querySelector("select, input");
  if (!control) throw new Error("Filtro sin control: " + ${JSON.stringify(label)});
  return control;
})()`;

async function setControl(send, label, value) {
  await evaluate(send, `(() => {
    const control = ${filterControl(label)};
    if (control.disabled) throw new Error("Control deshabilitado: ${label}");
    const wanted = ${JSON.stringify(value)};
    if (control.tagName === "SELECT" && ![...control.options].some((option) => option.value === wanted)) throw new Error("Opción ausente en ${label}: " + wanted);
    control.value = wanted;
    control.dispatchEvent(new Event("input", { bubbles: true }));
    control.dispatchEvent(new Event("change", { bubbles: true }));
    return control.value;
  })()`);
}

async function selectOptionByText(send, label, prefix) {
  const value = await evaluate(send, `(() => {
    const control = ${filterControl(label)};
    const option = [...control.options].find((item) => item.textContent?.trim().startsWith(${JSON.stringify(prefix)}));
    if (!option) throw new Error("No existe opción ${prefix} en ${label}");
    return option.value;
  })()`);
  await setControl(send, label, value);
  return value;
}

const visibleCountExpression = `(() => {
  const card = [...document.querySelectorAll(".metric-card")].find((item) => item.querySelector("p")?.textContent?.trim() === "Detecciones visibles");
  if (!card) return null;
  const raw = card.querySelector("strong")?.textContent ?? "";
  const digits = raw.replace(/\\D/g, "");
  return digits ? Number(digits) : 0;
})()`;

async function waitForVisibleCount(send, expected, context) {
  await waitFor(send, `${visibleCountExpression} === ${expected}`, `${context}: el contador visible no llegó a ${expected}.`, 12_000);
}

async function resetFilters(send) {
  await evaluate(send, `document.querySelector(".reset-button")?.click()`);
  await waitForVisibleCount(send, operational.length, "Restablecer filtros");
  await waitFor(send, `${filterControl("Departamento")}.value === "00" && ${filterControl("Municipio")}.disabled === true`, "Restablecer no devolvió territorio al estado inicial.");
}

const tolima = findNamed(dashboard.departments, "Tolima");
if (!tolima) throw new Error("No se encontró Tolima en el catálogo DANE publicado.");
const tolimaIndex = dashboard.departments.indexOf(tolima);
const ibague = dashboard.municipalities.find((item) => item.departmentCode === tolima.code && normalizeName(item.name) === normalizeName("Ibagué"));
if (!ibague) throw new Error("No se encontró Ibagué en el catálogo municipal publicado.");
const ibagueIndex = dashboard.municipalities.indexOf(ibague);
const lastDate = dashboard.metadata.lastObservationDate;
const lastDateIndex = dashboard.dates.indexOf(lastDate);
if (lastDateIndex < 0) throw new Error(`La última fecha ${lastDate} no existe en dashboard.dates.`);
const zeroCombination = findZeroCombination();

let server;
let chrome;
let cdp;
let userDataDir;
const checks = [];

try {
  server = await startStaticServer();
  userDataDir = await mkdtemp(`${tmpdir()}/dashboard-e2e-`);
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
  await cdp.send("Page.addScriptToEvaluateOnNewDocument", {
    source: `window.__dashboardE2eErrors = []; window.addEventListener("error", (event) => window.__dashboardE2eErrors.push(String(event.error?.stack || event.message || event.error))); window.addEventListener("unhandledrejection", (event) => window.__dashboardE2eErrors.push(String(event.reason?.stack || event.reason)));`,
  });

  await cdp.send("Page.navigate", { url: `http://127.0.0.1:${PORT}${BASE_PATH}/` });
  await waitForDashboard(cdp.send);
  await delay(900);
  await waitForVisibleCount(cdp.send, operational.length, "Carga inicial");
  const heading = await evaluate(cdp.send, `document.querySelector("h1")?.textContent?.trim()`);
  if (heading !== "Detecciones de calor") throw new Error(`H1 inesperado en carga inicial: ${heading}`);
  checks.push({ flow: "carga inicial", expected: operational.length });

  await setControl(cdp.send, "Departamento", tolima.code);
  await waitForVisibleCount(cdp.send, countVisible({ departmentIndex: tolimaIndex }), "Filtro Departamento=Tolima");
  await waitFor(cdp.send, `${filterControl("Municipio")}.disabled === false`, "El selector Municipio no se habilitó después de elegir Tolima.");
  checks.push({ flow: "departamento", value: tolima.name, expected: countVisible({ departmentIndex: tolimaIndex }) });

  await setControl(cdp.send, "Municipio", ibague.code);
  await waitForVisibleCount(cdp.send, countVisible({ departmentIndex: tolimaIndex, municipalityIndex: ibagueIndex }), "Filtro Municipio=Ibagué");
  checks.push({ flow: "municipio", value: ibague.name, expected: countVisible({ departmentIndex: tolimaIndex, municipalityIndex: ibagueIndex }) });
  await resetFilters(cdp.send);

  await setControl(cdp.send, "Desde", lastDate);
  await setControl(cdp.send, "Hasta", lastDate);
  const lastDayExpected = countVisible({ startIndex: lastDateIndex, endIndex: lastDateIndex });
  await waitForVisibleCount(cdp.send, lastDayExpected, `Rango de fecha ${lastDate}`);
  checks.push({ flow: "rango de fecha", value: lastDate, expected: lastDayExpected });
  await resetFilters(cdp.send);

  await selectOptionByText(cdp.send, "Departamento", "Sin territorio asignado");
  const unassignedTerritory = operational.filter((point) => point[2] < 0).length;
  await waitForVisibleCount(cdp.send, unassignedTerritory, "Sin territorio asignado");
  checks.push({ flow: "sin territorio", expected: unassignedTerritory });
  await resetFilters(cdp.send);

  await selectOptionByText(cdp.send, "Cobertura 2024", "Sin cobertura asignada");
  const unassignedCoverage = countVisible({ coverageCode: "unassigned" });
  await waitForVisibleCount(cdp.send, unassignedCoverage, "Sin cobertura asignada");
  checks.push({ flow: "sin cobertura", expected: unassignedCoverage });
  await resetFilters(cdp.send);

  await setControl(cdp.send, "Situación ANLA", "evaluation");
  const evaluationExpected = countVisible({ anlaStatus: "evaluation" });
  await waitForVisibleCount(cdp.send, evaluationExpected, "Situación ANLA=En evaluación");
  checks.push({ flow: "situación ANLA", value: "evaluation", expected: evaluationExpected });
  await resetFilters(cdp.send);

  const zeroDepartment = dashboard.departments[zeroCombination.departmentIndex];
  await setControl(cdp.send, "Departamento", zeroDepartment.code);
  await setControl(cdp.send, "Cobertura 2024", zeroCombination.coverageCode);
  if (zeroCombination.protectedRelation) await setControl(cdp.send, "Área protegida", zeroCombination.protectedRelation);
  await waitForVisibleCount(cdp.send, 0, "Combinación con cero resultados");
  await waitFor(cdp.send, `document.querySelectorAll(".chart-empty").length >= 2 && [...document.querySelectorAll(".chart-empty")].every((item) => item.textContent?.includes("No hay detecciones para los filtros seleccionados"))`, "Los gráficos no mostraron un estado vacío explícito en el navegador real.", 12_000);
  checks.push({ flow: "estado vacío", department: zeroDepartment.name, coverage: zeroCombination.coverageCode, protected: zeroCombination.protectedRelation ?? "all" });
  await resetFilters(cdp.send);

  await evaluate(cdp.send, `([...document.querySelectorAll(".trend-toggle button")].find((button) => button.textContent?.trim() === "Meses"))?.click()`);
  await waitFor(cdp.send, `document.querySelector(".trend-panel h2")?.textContent?.trim() === "Detecciones por mes" && ([...document.querySelectorAll(".trend-toggle button")].find((button) => button.textContent?.trim() === "Meses"))?.getAttribute("aria-pressed") === "true"`, "El cambio Días→Meses no se reflejó end-to-end.");
  checks.push({ flow: "agrupación temporal", value: "mes" });

  await evaluate(cdp.send, `document.querySelector(".notice a[href$='/metodologia']")?.click()`);
  await waitFor(cdp.send, `location.pathname.endsWith("/metodologia") && document.querySelector("h1")?.textContent?.includes("Cómo leer el dashboard")`, "La navegación cliente hacia Metodología no se completó.", 12_000);
  checks.push({ flow: "navegación metodología" });
  await evaluate(cdp.send, `history.back()`);
  await waitForDashboard(cdp.send);

  const runtimeErrors = await evaluate(cdp.send, `window.__dashboardE2eErrors ?? []`);
  if (runtimeErrors.length) throw new Error(`Errores no controlados detectados en navegador:\n- ${runtimeErrors.join("\n- ")}`);
  if (chrome.exitCode && chrome.exitCode !== 0) throw new Error(`Chrome terminó con código ${chrome.exitCode}. ${chromeErrors.slice(-1200)}`);

  console.log(JSON.stringify({ operational: operational.length, checks }, null, 2));
} finally {
  try { cdp?.socket.close(); } catch {}
  await stopChrome(chrome);
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
  if (userDataDir) await rm(userDataDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
