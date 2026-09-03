import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const dashboard = JSON.parse(await readFile(`${root}/public/data/dashboard.json`, "utf8"));
const history = JSON.parse(await readFile(`${root}/public/data/history.json`, "utf8"));

test("closes the official national dashboard dataset", () => {
  const statuses = dashboard.metadata.territorialStatus;
  assert.equal(dashboard.points.length, dashboard.metadata.totalRows);
  assert.equal(dashboard.points.length, dashboard.metadata.scenarioARows);
  assert.equal(statuses.asignado + statuses.sin_asignacion, dashboard.points.length);
  assert.equal(
    dashboard.points.filter((point) => point[7] === 1).length,
    dashboard.metadata.scenarioBRows,
  );
});

test("keeps territorial and temporal catalogs valid", () => {
  assert.equal(dashboard.departments.length, 33);
  assert.equal(dashboard.municipalities.length, 1_122);
  assert.equal(dashboard.metadata.historyStartDate, "2026-07-01");
  assert.ok(dashboard.metadata.lastObservationDate >= dashboard.metadata.historyStartDate);
  for (const point of dashboard.points) {
    assert.ok(point[4] >= 0 && point[4] < dashboard.dates.length);
    assert.ok(point[2] === -1 || point[2] < dashboard.departments.length);
    assert.ok(point[3] === -1 || point[3] < dashboard.municipalities.length);
    if (dashboard.metadata.protectedAreas) assert.ok(point[11] === 0 || point[11] === 1);
    if (dashboard.metadata.landCover) assert.ok(point[12] === -1 || point[12] < dashboard.landCovers.length);
    if (dashboard.metadata.miningTitles) assert.ok(point[13] === 0 || point[13] === 1);
    if (dashboard.metadata.anlaProjects) {
      assert.ok(Number.isInteger(point[14]) && point[14] >= 0 && point[14] <= 3);
      assert.ok(Number.isInteger(point[15]) && point[15] >= 0 && point[15] <= 3);
    }
    if (dashboard.metadata.anhContracts) {
      assert.ok(Number.isInteger(point[16]) && point[16] >= 0 && point[16] <= 3);
    }
    if (dashboard.metadata.episodes) {
      assert.ok(Number.isInteger(point[17]) && point[17] >= -1 && point[17] <= 3);
      assert.ok(Number.isInteger(point[18]) && point[18] >= -1 && point[18] < dashboard.episodes.length);
    }
  }
});

test("closes operational episode membership", () => {
  if (!dashboard.metadata.episodes) return;
  const metadata = dashboard.metadata.episodes;
  const evaluated = dashboard.points.filter((point) => point[17] >= 0);
  const episodeIndexes = new Set(dashboard.points.map((point) => point[18]).filter((index) => index >= 0));
  assert.equal(evaluated.length, metadata.evaluatedRows);
  assert.equal(dashboard.episodes.length, metadata.episodeCount);
  assert.equal(episodeIndexes.size, metadata.episodeCount);
  assert.equal(dashboard.points.filter((point) => point[17] === 1).length, metadata.pairRows);
  assert.equal(dashboard.points.filter((point) => point[17] === 0).length, metadata.isolatedRows);
});

test("removes demonstrative claims from the connected interface", async () => {
  const source = await readFile(`${root}/app/page.tsx`, "utf8");
  assert.doesNotMatch(source, /DATOS DEMOSTRATIVOS|carga simulada|demoPoints/);
  assert.match(source, /DATOS OFICIALES PROCESADOS/);
});

test("closes daily and monthly historical summaries", () => {
  assert.equal(history.metadata.historyStartDate, "2026-07-01");
  assert.equal(history.metadata.totalRows, dashboard.metadata.totalRows);
  assert.equal(history.metadata.scenarioBRows, dashboard.metadata.scenarioBRows);
  assert.equal(
    history.daily.filter((item) => item.scenario === "A").reduce((sum, item) => sum + item.hotspots, 0),
    dashboard.metadata.totalRows,
  );
  assert.equal(
    history.monthly.filter((item) => item.scenario === "A").reduce((sum, item) => sum + item.hotspots, 0),
    dashboard.metadata.totalRows,
  );
  assert.ok(history.monthly.some((item) => item.period === history.metadata.openMonth && item.status === "open"));
});
