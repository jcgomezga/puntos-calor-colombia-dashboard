import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const page = await readFile(`${root}/app/page.tsx`, "utf8");
const layout = await readFile(`${root}/app/layout.tsx`, "utf8");
const css = await readFile(`${root}/app/globals.css`, "utf8");

const title = "Análisis espacial de detecciones de calor en zonas con potencial uso extractivista";

test("uses the requested public title in the page and metadata", () => {
  assert.match(page, new RegExp(title));
  assert.match(layout, new RegExp(title));
});

test("places accessible Instagram and LinkedIn links before the responsible-reading notice", () => {
  const socialIndex = page.indexOf('className="social-links"');
  const noticeIndex = page.indexOf('className="notice"');
  assert.ok(socialIndex > 0 && noticeIndex > socialIndex, "Las redes deben aparecer entre el encabezado y Lectura responsable.");
  assert.match(page, /https:\/\/www\.instagram\.com\/juancgomezg_\//);
  assert.match(page, /https:\/\/www\.linkedin\.com\/in\/jcgomezga\//);
  assert.match(page, /aria-label="Instagram de Juan Carlos Gómez García"/);
  assert.match(page, /aria-label="LinkedIn de Juan Carlos Gómez García"/);
  assert.match(page, /rel="noopener noreferrer"/);
});

test("keeps social controls compact, focusable and responsive", () => {
  assert.match(css, /\.social-link \{[^}]*width: 30px;[^}]*height: 30px;/s);
  assert.match(css, /\.social-link:focus-visible/);
  assert.match(css, /\.brand-block h1 \{[^}]*max-width: 780px;/s);
});
