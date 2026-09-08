import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const tracker = await readFile(`${root}/components/analytics-interaction-tracker.tsx`, "utf8");
const layout = await readFile(`${root}/app/layout.tsx`, "utf8");

const expectedEvents = [
  "filter_change",
  "filter_reset",
  "territory_view",
  "map_view_change",
  "map_layer_toggle",
  "map_query_mode_change",
  "map_query",
  "map_result_view",
  "context_entity_view",
  "context_entity_select",
  "methodology_view",
  "geovisor_error",
];

test("mounts the SIG interaction tracker with production analytics", () => {
  assert.match(layout, /AnalyticsInteractionTracker/);
  assert.match(layout, /analyticsEnabled \? \(/);
  assert.match(layout, /<AnalyticsInteractionTracker \/>/);
});

test("covers the main analytical interactions of the dashboard", () => {
  for (const eventName of expectedEvents) {
    assert.match(tracker, new RegExp(`"${eventName}"`), `Falta instrumentar ${eventName}`);
  }
  assert.match(tracker, /trackAnalyticsEvent\(result\.event, result\.params\)/);
  assert.match(tracker, /\.filterbar/);
  assert.match(tracker, /aria-label="Modo de mapa"/);
  assert.match(tracker, /\.query-control/);
  assert.match(tracker, /\.geovisor-canvas/);
  assert.match(tracker, /\.context-match-selector/);
});

test("uses bounded categorical parameters and does not send map coordinates", () => {
  assert.match(tracker, /territory_level/);
  assert.match(tracker, /territory_code/);
  assert.match(tracker, /territory_name/);
  assert.match(tracker, /error_type/);
  assert.doesNotMatch(tracker, /\b(longitude|latitude|lng|lat)\b/i);
  assert.doesNotMatch(tracker, /detail_key|expediente|solicitante|operador/i);
});

test("keeps automatic GA4 events out of the custom tracker", () => {
  assert.doesNotMatch(tracker, /trackAnalyticsEvent\("page_view"/);
  assert.doesNotMatch(tracker, /trackAnalyticsEvent\("scroll"/);
  assert.doesNotMatch(tracker, /trackAnalyticsEvent\("file_download"/);
  assert.doesNotMatch(tracker, /trackAnalyticsEvent\("click"/);
});
