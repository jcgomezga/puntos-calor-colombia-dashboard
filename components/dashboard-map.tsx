"use client";

import { useEffect, useMemo, useRef } from "react";

type Position = number[];
type Geometry = { type: "Polygon" | "MultiPolygon"; coordinates: unknown };
type Feature = { type: "Feature"; properties: Record<string, unknown>; geometry: Geometry };
export type FeatureCollection = { type: "FeatureCollection"; features: Feature[] };
export type PointRow = [number, number, number, number, number, number, number, number, number | null, number, number, number?];

const WIDTH = 1000;
const HEIGHT = 650;
const PAD = 28;

function rings(geometry: Geometry): Position[][] {
  if (geometry.type === "Polygon") return geometry.coordinates as Position[][];
  return (geometry.coordinates as Position[][][]).flat();
}

function featureBounds(features: Feature[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const feature of features) {
    for (const ring of rings(feature.geometry)) {
      for (const point of ring) {
        minX = Math.min(minX, point[0]); minY = Math.min(minY, point[1]);
        maxX = Math.max(maxX, point[0]); maxY = Math.max(maxY, point[1]);
      }
    }
  }
  return { minX, minY, maxX, maxY };
}

function projector(bounds: ReturnType<typeof featureBounds>) {
  const spanX = Math.max(bounds.maxX - bounds.minX, 0.01);
  const spanY = Math.max(bounds.maxY - bounds.minY, 0.01);
  const scale = Math.min((WIDTH - PAD * 2) / spanX, (HEIGHT - PAD * 2) / spanY);
  const offsetX = (WIDTH - spanX * scale) / 2;
  const offsetY = (HEIGHT - spanY * scale) / 2;
  return (longitude: number, latitude: number) => [
    offsetX + (longitude - bounds.minX) * scale,
    HEIGHT - offsetY - (latitude - bounds.minY) * scale,
  ] as const;
}

function geometryPath(geometry: Geometry, project: ReturnType<typeof projector>) {
  return rings(geometry).map((ring) => ring.map((point, index) => {
    const [x, y] = project(point[0], point[1]);
    return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ") + " Z").join(" ");
}

export function DashboardMap({ departments, municipalities, points, departmentCode,
  municipalityCode, onDepartment, onMunicipality }: {
  departments: FeatureCollection; municipalities: FeatureCollection; points: PointRow[];
  departmentCode: string; municipalityCode: string;
  onDepartment: (code: string) => void; onMunicipality: (code: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const departmentFeatures = departments.features;
  const municipalityFeatures = useMemo(
    () => municipalities.features.filter((feature) => feature.properties.d === departmentCode),
    [municipalities.features, departmentCode],
  );
  const visibleFeatures = departmentCode === "00" ? departmentFeatures : municipalityFeatures;
  const focused = municipalityCode !== "00000"
    ? municipalityFeatures.filter((feature) => feature.properties.m === municipalityCode)
    : departmentCode !== "00"
      ? departmentFeatures.filter((feature) => feature.properties.DPTO_CCDGO === departmentCode)
      : departmentFeatures;
  const bounds = useMemo(() => featureBounds(focused.length ? focused : visibleFeatures), [focused, visibleFeatures]);
  const project = useMemo(() => projector(bounds), [bounds]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const draw = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(rect.width * ratio));
      canvas.height = Math.max(1, Math.round(rect.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.scale(canvas.width / WIDTH, canvas.height / HEIGHT);
      context.fillStyle = points.length > 8000 ? "rgba(196, 48, 31, .38)" : "rgba(210, 54, 31, .58)";
      const radius = departmentCode === "00" ? 1.15 : municipalityCode === "00000" ? 2.1 : 3.2;
      for (const point of points) {
        const [x, y] = project(point[0], point[1]);
        context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill();
      }
    };
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [points, project, departmentCode, municipalityCode]);

  return <div className="real-map" aria-label={`Mapa con ${points.length.toLocaleString("es-CO")} detecciones filtradas`}>
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Límites territoriales DANE 2025"><g>
      {visibleFeatures.map((feature) => {
        const isDepartment = departmentCode === "00";
        const code = String(feature.properties[isDepartment ? "DPTO_CCDGO" : "m"] ?? "");
        const selected = !isDepartment && code === municipalityCode;
        return <path key={code} d={geometryPath(feature.geometry, project)} fillRule="evenodd"
          className={`territory-shape${selected ? " selected" : ""}`}
          onClick={() => isDepartment ? onDepartment(code) : onMunicipality(code)} />;
      })}
    </g></svg>
    <canvas ref={canvasRef} aria-hidden="true" />
  </div>;
}
