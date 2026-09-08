import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const chartsSource = await readFile(`${root}/components/dashboard-charts.tsx`, "utf8");
const workflowSource = await readFile(`${root}/.github/workflows/geovisor-ci.yml`, "utf8");

test("keeps Recharts outside server prerender and exposes explicit empty states", () => {
  assert.doesNotMatch(pageSource, /from "recharts"/);
  assert.match(pageSource, /dynamic\(\(\) => import\("@\/components\/dashboard-charts"\)/);
  assert.match(pageSource, /ssr: false/);
  assert.match(chartsSource, /from "recharts"/);
  assert.match(chartsSource, /No hay detecciones para los filtros seleccionados\./);
  assert.match(chartsSource, /data\.every\(\(item\) => item\.value === 0\)/);
});

test("measures the exported Pages JavaScript budget in pull request CI", () => {
  assert.match(workflowSource, /check-pages-bundle-budget\.mjs/);
});
