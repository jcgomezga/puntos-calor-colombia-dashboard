import assert from "node:assert/strict";
import test from "node:test";

const developmentPreviewMeta =
  /<meta(?=[^>]*\bname=["']codex-preview["'])(?=[^>]*\bcontent=["']development["'])[^>]*>/i;
const publicTitle = "Análisis espacial de detecciones de calor en zonas con potencial uso extractivista";

const assets = {
  fetch: async () => new Response("Not found", { status: 404 }),
};

const executionContext = {
  waitUntil() {},
  passThroughOnException() {},
};

test("renders development preview metadata and the public methodology route", async () => {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  const response = await worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    { ASSETS: assets },
    executionContext,
  );

  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, developmentPreviewMeta);
  assert.match(html, /Histórico desde/);
  assert.match(html, /1(?: de)? jul(?: de)? 2026/);
  assert.match(html, new RegExp(publicTitle));
  assert.match(html, /metodologia/);

  const methodologyResponse = await worker.fetch(
    new Request("http://localhost/metodologia/", {
      headers: { accept: "text/html" },
    }),
    { ASSETS: assets },
    executionContext,
  );
  assert.equal(methodologyResponse.status, 200);
  const methodologyHtml = await methodologyResponse.text();
  assert.match(methodologyHtml, /Cómo leer el dashboard de detecciones térmicas/);
  assert.match(methodologyHtml, /universo operativo/i);
  assert.match(methodologyHtml, /no deben interpretarse como una probabilidad de que exista un incendio/i);
});
