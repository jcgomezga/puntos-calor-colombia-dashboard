"use client";

import { useEffect, useMemo, useRef } from "react";

type Position = number[];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry };
export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };
export type PointRow = [number, number, number, number, number, number, number, number, number | null, number, number, number?, number?, number?, number?, number?, number?, number?, number?];

const WIDTH = 1000;
const HEIGHT = 650;
const PAD = 28;
const NATIONAL_AGGREGATION_THRESHOLD = 2500;
const NATIONAL_GRID_SIZE = 7;

function rings(geometry: Geometry): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates as Position[][];
  return (geometry.coordinates as Position[][][]).flat();
}
function featureBounds(features: Feature[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const feature of features) for (const ring of rings(feature.geometry)) for (const point of ring) {
    minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]); maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]);
  }
  return { minX, minY, maxX, maxY };
}
function projector(bounds: ReturnType<typeof featureBounds>) {
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.01), spanY = Math.max(bounds.maxY - bounds.minY, 0.01);
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (HEIGHT - PAD * 2) / spanY);
  const offsetX = (WIDTH - spanX * scale) / 2, offsetY = (HEIGHT - spanY * scale) / 2;
  return (longitude: number, latitude: number) => [offsetX + (longitude - bounds.minX) * scale, HEIGHT - offsetY - (latitude - bounds.minY) * scale] as const;
}
function geometryPath(geometry: Geometry, project: ReturnType<typeof projector>) {
  return rings(geometry).map((ring) => ring.map((point, index) => { const [x, y] = project(point[0], point[1]); return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`; }).join(" ") + " Z").join(" ");
}
function featureLabel(feature: Feature, isDepartment: boolean, code: string) {
  const keys = isDepartment ? ["DPTO_CNMBR", "NOMBRE_DPT", "name", "nombre"] : ["MPIO_CNMBR", "MPIO_CCNCT", "name", "nombre"];
  for (const key of keys) { const value = String(feature.properties[key] ?? "").trim(); if (value) return value; }
  return code;
}

export function DashboardMap({ departments, municipalities, points, departmentCode, municipalityCode, onDepartment, onMunicipality }: {
  departments: FeatureCollection; municipalities: FeatureCollection; points: PointRow[]; departmentCode: string; municipalityCode: string;
  onDepartment: (code: string) => void; onMunicipality: (code: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const departmentFeatures = departments.features;
  const municipalityFeatures = useMemo(() => municipalities.features.filter((feature) => feature.properties.d === departmentCode), [municipalities.features, departmentCode]);
  const visibleFeatures = departmentCode === "00" ? departmentFeatures : municipalityFeatures;
  const focused = municipalityCode !== "00000" ? municipalityFeatures.filter((feature) => feature.properties.m === municipalityCode) : departmentCode !== "00" ? departmentFeatures.filter((feature) => feature.properties.DPTO_CCDGO === departmentCode) : departmentFeatures;
  const bounds = useMemo(() => featureBounds(focused.length ? focused : visibleFeatures), [focused, visibleFeatures]);
  const project = useMemo(() => projector(bounds), [bounds]);
  const usesNationalAggregation = departmentCode === "00" && points.length > NATIONAL_AGGREGATION_THRESHOLD;

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect(), ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio)); canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext("2d"); if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height); context.scale(canvas.width / WIDTH, canvas.height / HEIGHT); context.fillStyle = "rgb(201, 58, 38)";
      if (usesNationalAggregation) {
        const grid = new Map<string, { x: number; y: number; count: number }>();
        for (const point of points) { const [x, y] = project(point[0], point[1]); const gx = Math.floor(x / NATIONAL_GRID_SIZE), gy = Math.floor(y / NATIONAL_GRID_SIZE), key = `${gx}:${gy}`; const cell = grid.get(key); if (cell) { cell.x += x; cell.y += y; cell.count += 1; } else grid.set(key, { x, y, count: 1 }); }
        for (const cell of grid.values()) { const x = cell.x / cell.count, y = cell.y / cell.count, radius = Math.min(6, 1.4 + Math.log2(cell.count + 1) * 0.78); context.globalAlpha = Math.min(0.76, 0.32 + Math.log10(cell.count + 1) * 0.18); context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); }
        context.globalAlpha = 1;
      } else {
        context.globalAlpha = points.length > 8000 ? 0.4 : 0.62; const radius = municipalityCode === "00000" ? 2.1 : 3.2;
        for (const point of points) { const [x, y] = project(point[0], point[1]); context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); }
        context.globalAlpha = 1;
      }
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(canvas); return () => observer.disconnect();
  }, [points, project, municipalityCode, usesNationalAggregation]);

  return <div className="real-map" role="group" data-visual-aggregation={usesNationalAggregation ? "grid" : "points"} aria-label={`Mapa básico con ${points.length.toLocaleString("es-CO")} detecciones filtradas`}>
    <p className="sr-only">Las detecciones son referencia visual en este modo. Los territorios sí pueden seleccionarse con clic, tecla Enter o barra espaciadora. Usa los filtros del dashboard para explorar los datos.</p>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Límites territoriales DANE 2025"><g>
      {visibleFeatures.map((feature) => { const isDepartment = departmentCode === "00", code = String(feature.properties[isDepartment ? "DPTO_CCDGO" : "m"] ?? ""), selected = !isDepartment && code === municipalityCode, name = featureLabel(feature, isDepartment, code); const activate = () => isDepartment ? onDepartment(code) : onMunicipality(code); return <path key={code} d={geometryPath(feature.geometry, project)} fillRule="evenodd" className={`territory-shape${selected ? " selected" : ""}`} role="button" tabIndex={0} aria-label={`Seleccionar ${isDepartment ? "departamento" : "municipio"}: ${name}`} onClick={activate} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); activate(); } }} />; })}
    </g></svg>
    <canvas ref={canvasRef} aria-hidden="true" />
  </div>;
}
