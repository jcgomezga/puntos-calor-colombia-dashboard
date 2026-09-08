import { readFileSync, writeFileSync } from "node:fs";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) throw new Error(`No se encontró el bloque esperado: ${label}`);
  const updated = source.replace(before, after);
  if (updated === source) throw new Error(`No se pudo reemplazar: ${label}`);
  return updated;
}

const geovisorPath = "components/geovisor-map.tsx";
let geovisor = readFileSync(geovisorPath, "utf8");

geovisor = replaceOnce(
  geovisor,
  'const DEPARTMENT_LABEL_LAYER_ID = "dane-department-labels";\nconst MUNICIPALITY_LABEL_LAYER_ID = "dane-municipality-labels";\n',
  'const DEPARTMENT_LABEL_LAYER_ID = "dane-department-labels";\nconst MUNICIPALITY_LABEL_LAYER_ID = "dane-municipality-labels";\nconst NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM = 7.6;\nconst NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM = 8;\nconst SELECTED_DEPARTMENT_LABEL_MAX_ZOOM = 6.6;\nconst SELECTED_MUNICIPALITY_LABEL_MIN_ZOOM = 6.35;\nconst MUNICIPALITY_LABEL_MAX_ZOOM = 14;\n',
  "constantes de jerarquía territorial",
);

geovisor = replaceOnce(
  geovisor,
  '          maxzoom: 6.8,\n          layout: {\n            "text-field": ["get", "name"],\n            "text-size": ["interpolate", ["linear"], ["zoom"], 3, 11, 5, 13.5, 6.8, 15.5],\n            "text-transform": "uppercase",\n            "text-letter-spacing": 0.04,\n            "text-max-width": 10,\n            "text-padding": 3,\n',
  '          maxzoom: NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM,\n          layout: {\n            "text-field": ["get", "name"],\n            "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10.5, 5, 13, 7.6, 15.25],\n            "text-transform": "uppercase",\n            "text-letter-spacing": 0.04,\n            "text-max-width": 10,\n            "text-padding": 4,\n',
  "escala de etiquetas departamentales",
);

geovisor = replaceOnce(
  geovisor,
  '          minzoom: 6.2,\n          maxzoom: 14,\n          layout: {\n            "text-field": ["get", "name"],\n            "text-size": ["interpolate", ["linear"], ["zoom"], 6.2, 9.5, 8.5, 11.5, 12, 13],\n            "text-variable-anchor": ["center", "top", "bottom", "left", "right"],\n            "text-justify": "auto",\n            "text-radial-offset": 0.15,\n            "text-max-width": 9,\n            "text-padding": 2,\n',
  '          minzoom: NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM,\n          maxzoom: MUNICIPALITY_LABEL_MAX_ZOOM,\n          layout: {\n            "text-field": ["get", "name"],\n            "text-size": ["interpolate", ["linear"], ["zoom"], 6.35, 9.25, 8, 10.5, 10, 12, 12, 13.2],\n            "text-variable-anchor": ["center", "top", "bottom", "left", "right"],\n            "text-justify": "auto",\n            "text-radial-offset": 0.2,\n            "text-max-width": 8.5,\n            "text-padding": 5,\n',
  "densidad de etiquetas municipales",
);

geovisor = replaceOnce(
  geovisor,
  '    map.setFilter("dane-municipalities-fill", ["==", ["get", "d"], departmentCode]);\n    map.setFilter("dane-municipalities-line", ["==", ["get", "d"], departmentCode]);\n    map.setFilter(MUNICIPALITY_LABEL_LAYER_ID, departmentCode === "00" ? null : ["==", ["get", "departmentCode"], departmentCode]);\n',
  '    map.setFilter("dane-municipalities-fill", ["==", ["get", "d"], departmentCode]);\n    map.setFilter("dane-municipalities-line", ["==", ["get", "d"], departmentCode]);\n    const hasDepartmentSelection = departmentCode !== "00";\n    map.setFilter(MUNICIPALITY_LABEL_LAYER_ID, hasDepartmentSelection ? ["==", ["get", "departmentCode"], departmentCode] : null);\n    map.setLayerZoomRange(DEPARTMENT_LABEL_LAYER_ID, 3, hasDepartmentSelection ? SELECTED_DEPARTMENT_LABEL_MAX_ZOOM : NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM);\n    map.setLayerZoomRange(MUNICIPALITY_LABEL_LAYER_ID, hasDepartmentSelection ? SELECTED_MUNICIPALITY_LABEL_MIN_ZOOM : NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM, MUNICIPALITY_LABEL_MAX_ZOOM);\n',
  "transición dinámica departamento-municipio",
);

writeFileSync(geovisorPath, geovisor);

const testPath = "tests/geovisor-config.test.mjs";
let tests = readFileSync(testPath, "utf8");
const marker = 'test("preserves synchronized DANE selection and clustered heat detections", () => {\n';
if (!tests.includes(marker)) throw new Error("No se encontró el test DANE esperado");

const addition = `test("uses a scale-aware hierarchy for department and municipality labels", () => {\n  assert.match(geovisorSource, /NATIONAL_DEPARTMENT_LABEL_MAX_ZOOM = 7\\.6/);\n  assert.match(geovisorSource, /NATIONAL_MUNICIPALITY_LABEL_MIN_ZOOM = 8/);\n  assert.match(geovisorSource, /SELECTED_MUNICIPALITY_LABEL_MIN_ZOOM = 6\\.35/);\n  assert.match(geovisorSource, /setLayerZoomRange\\(DEPARTMENT_LABEL_LAYER_ID/);\n  assert.match(geovisorSource, /setLayerZoomRange\\(MUNICIPALITY_LABEL_LAYER_ID/);\n  assert.match(geovisorSource, /"text-padding": 5/);\n});\n\n`;

tests = tests.replace(marker, addition + marker);
writeFileSync(testPath, tests);

console.log("Jerarquía de etiquetas territoriales afinada correctamente.");
