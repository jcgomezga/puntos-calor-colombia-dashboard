import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pageSource = await readFile(`${root}/app/page.tsx`, "utf8");
const chartsSource = await readFile(`${root}/components/dashboard-charts.tsx`, "utf8");
const cssSource = await readFile(`${root}/app/globals.css`, "utf8");
const workflowSource = await readFile(`${root}/.github/workflows/geovisor-ci.yml`, "utf8");
const responsiveSource = await readFile(`${root}/scripts/check-responsive-layout.mjs`, "utf8");

function channel(value) {
  const normalized = value / 255;
  return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function luminance(hex) {
  const value = hex.replace("#", "");
  const red = channel(Number.parseInt(value.slice(0, 2), 16));
  const green = channel(Number.parseInt(value.slice(2, 4), 16));
  const blue = channel(Number.parseInt(value.slice(4, 6), 16));
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrast(a, b) {
  const first = luminance(a), second = luminance(b);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

test("announces state for non-cartographic toggle controls", () => {
  assert.match(pageSource, /aria-pressed=\{mapMode === "geovisor"\}/);
  assert.match(pageSource, /aria-pressed=\{mapMode === "basic"\}/);
  assert.match(pageSource, /aria-pressed=\{trendGrouping === "day"\}/);
  assert.match(pageSource, /aria-pressed=\{trendGrouping === "month"\}/);
});

test("gives charts useful textual alternatives instead of exposing generic Recharts semantics", () => {
  assert.match(pageSource, /<RankingChart data=\{ranking\} label=/);
  assert.match(pageSource, /<TrendChart data=\{trend\} label=/);
  assert.match(chartsSource, /<figure className="chart-figure">/);
  assert.match(chartsSource, /<div className="chart-visual" aria-hidden="true">/);
  assert.match(chartsSource, /<figcaption className="sr-only">/);
  assert.match(chartsSource, /role="status" aria-label=\{label\}/);
});

test("keeps small non-cartographic text at AA contrast or better", () => {
  const muted = cssSource.match(/--muted:\s*(#[0-9a-f]{6})/i)?.[1];
  const canvas = cssSource.match(/--canvas:\s*(#[0-9a-f]{6})/i)?.[1];
  assert.ok(muted, "Debe existir el token --muted.");
  assert.ok(canvas, "Debe existir el token --canvas.");
  assert.ok(contrast(muted, "#ffffff") >= 4.5, `--muted debe alcanzar 4.5:1 sobre blanco; obtuvo ${contrast(muted, "#ffffff").toFixed(2)}:1.`);
  assert.ok(contrast(muted, canvas) >= 4.5, `--muted debe alcanzar 4.5:1 sobre canvas; obtuvo ${contrast(muted, canvas).toFixed(2)}:1.`);
  assert.match(cssSource, /\.metric-card span \{[^}]*color: var\(--muted\)/);
  assert.match(cssSource, /\.chart-loading \{ color: var\(--muted\); \}/);
  assert.match(cssSource, /footer \{[^}]*color: var\(--muted\)/);
  assert.doesNotMatch(cssSource, /\.metric-card span \{[^}]*#7a857e/);
  assert.doesNotMatch(cssSource, /footer \{[^}]*#7a857e/);
});

test("uses 44px minimum targets for dashboard controls outside the cartographic internals", () => {
  assert.match(cssSource, /\.select-wrap select, \.filterbar input \{[^}]*height: 44px/);
  assert.match(cssSource, /\.reset-button \{[^}]*min-height: 44px/);
  assert.match(cssSource, /\.segmented button \{[^}]*min-height: 44px/);
  assert.match(cssSource, /\.trend-toggle button \{[^}]*min-height: 44px/);
  assert.match(cssSource, /:focus-visible[^}]*outline: 3px solid #2f6844/);
});

test("runs a real-browser responsive gate at representative widths", () => {
  assert.match(workflowSource, /check-responsive-layout\.mjs/);
  for (const width of [1440, 1024, 768, 390]) assert.match(responsiveSource, new RegExp(`width: ${width}`));
  assert.match(responsiveSource, /desbordamiento horizontal/);
  assert.match(responsiveSource, /targetSelectors/);
  assert.match(responsiveSource, /target\.width < 44 \|\| target\.height < 44/);
  assert.match(responsiveSource, /filterColumns !== 1/);
  assert.match(responsiveSource, /sideColumns !== 1/);
});

test("leaves cartographic target sizing for the final map block", () => {
  assert.match(cssSource, /\.geovisor-map \.maplibregl-ctrl-group button \{ width: 29px; height: 29px; \}/);
  assert.match(cssSource, /\.layer-control \{[^}]*width: 215px/);
});
