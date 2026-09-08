import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const geovisorEntrySource = await readFile(`${root}/components/geovisor-entry.tsx`, "utf8");

test("keeps large public datasets out of the initial JavaScript module graph", () => {
  for (const file of ["dashboard.json", "history.json", "departments.json", "municipalities.json"]) {
    assert.doesNotMatch(pageSource, new RegExp(`@/public/data/${file.replace(".", "\\.")}`));
    assert.match(pageSource, new RegExp(`\\./data/${file.replace(".", "\\.")}`));
  }
  assert.match(pageSource, /dashboard\.json", "no-cache"/);
  assert.match(pageSource, /history\.json", "no-cache"/);
  assert.match(pageSource, /departments\.json", "force-cache"/);
  assert.match(pageSource, /municipalities\.json", "force-cache"/);
});

test("loads the MapLibre implementation as a separate client chunk", () => {
  assert.match(pageSource, /dynamic\(/);
  assert.match(pageSource, /import\("@\/components\/geovisor-map"\)/);
  assert.match(pageSource, /ssr: false/);
  assert.doesNotMatch(geovisorEntrySource, /dashboardJson|@\/public\/data\/dashboard\.json/);
});

test("gives Recharts valid initial dimensions instead of the -1 default", () => {
  const matches = pageSource.match(/initialDimension=\{\{ width: 600, height: 240 \}\}/g) ?? [];
  assert.equal(matches.length, 2);
});

test("keeps an informative static shell while runtime data loads", () => {
  assert.match(pageSource, /DashboardLoadState/);
  assert.match(pageSource, /Detecciones térmicas IDEAM/);
  assert.match(pageSource, /Histórico desde/);
  assert.match(pageSource, /Ver metodología y alcance/);
});
