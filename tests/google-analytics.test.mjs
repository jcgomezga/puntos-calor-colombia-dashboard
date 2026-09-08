import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const layout = await readFile(`${root}/app/layout.tsx`, "utf8");
const analytics = await readFile(`${root}/lib/analytics.ts`, "utf8");

const measurementId = "G-XCRJ9H9ETQ";

test("uses the dedicated GA4 property for the national dashboard", () => {
  assert.match(analytics, new RegExp(`GA_MEASUREMENT_ID = "${measurementId}"`));
  assert.match(layout, /GA_MEASUREMENT_ID/);
  assert.doesNotMatch(layout, /G-[A-Z0-9]{10}/, "El ID debe mantenerse centralizado en lib/analytics.ts.");
});

test("loads gtag globally only in production", () => {
  assert.match(layout, /process\.env\.NODE_ENV === "production"/);
  assert.match(layout, /https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=\$\{GA_MEASUREMENT_ID\}/);
  assert.match(layout, /strategy="afterInteractive"/);
  assert.match(layout, /gtag\('config', '\$\{GA_MEASUREMENT_ID\}'\)/);
});

test("prepares a safe helper for custom SIG events", () => {
  assert.match(analytics, /export function trackAnalyticsEvent/);
  assert.match(analytics, /typeof window === "undefined"/);
  assert.match(analytics, /typeof window\.gtag !== "function"/);
  assert.match(analytics, /window\.gtag\("event", name, params\)/);
});
