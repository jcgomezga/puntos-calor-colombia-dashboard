import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFile(`${root}/${path}`, "utf8");

const workflowPaths = [
  ".github/workflows/build-context-tiles.yml",
  ".github/workflows/episode-relation-sensitivity.yml",
  ".github/workflows/geovisor-ci.yml",
  ".github/workflows/pages.yml",
  ".github/workflows/update-data.yml",
];

test("keeps the public geovisor canonical and isolates the obsolete implementation", async () => {
  await assert.rejects(access(`${root}/components/geovisor-map.tsx`));
  await access(`${root}/archive/legacy-geovisor/geovisor-map.tsx`);

  const tsconfig = JSON.parse(await read("tsconfig.json"));
  const eslintConfig = await read("eslint.config.mjs");
  const entry = await read("components/geovisor-entry.tsx");
  const operational = await read("components/operational-geovisor-map.tsx");

  assert.deepEqual(tsconfig.compilerOptions.paths["@/components/geovisor-map"], ["./components/geovisor-entry.tsx"]);
  assert.ok(tsconfig.exclude.includes("archive"), "El archivo histórico no debe entrar al proyecto TypeScript activo.");
  assert.match(eslintConfig, /"archive\/\*\*"/);
  assert.match(entry, /public-detection-geovisor-map/);
  assert.match(entry, /PublicDetectionGeovisorMap/);
  assert.match(operational, /OPERATIONAL_SPATIAL_METERS = 1_000/);
  assert.match(operational, /Episodio de detecciones térmicas/);
});

test("uses current Node 24-compatible first-party Actions in maintained workflows", async () => {
  const workflows = Object.fromEntries(
    await Promise.all(workflowPaths.map(async (path) => [path, await read(path)])),
  );

  for (const [path, source] of Object.entries(workflows)) {
    if (source.includes("actions/checkout@")) {
      assert.match(source, /actions\/checkout@v7/, `${path} debe usar checkout v7`);
      assert.doesNotMatch(source, /actions\/checkout@v[1-6]\b/);
    }
    if (source.includes("actions/setup-node@")) {
      assert.match(source, /actions\/setup-node@v7/, `${path} debe usar setup-node v7`);
      assert.doesNotMatch(source, /actions\/setup-node@v[1-6]\b/);
    }
    if (source.includes("actions/setup-python@")) {
      assert.match(source, /actions\/setup-python@v7/, `${path} debe usar setup-python v7`);
      assert.doesNotMatch(source, /actions\/setup-python@v[1-6]\b/);
    }
  }

  assert.match(workflows[".github/workflows/episode-relation-sensitivity.yml"], /actions\/upload-artifact@v7/);
  assert.match(workflows[".github/workflows/pages.yml"], /actions\/upload-pages-artifact@v5/);
  assert.match(workflows[".github/workflows/pages.yml"], /actions\/deploy-pages@v5/);
});
