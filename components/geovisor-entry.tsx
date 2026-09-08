"use client";

import * as maplibregl from "maplibre-gl";
import type { ComponentProps } from "react";
import dashboardJson from "@/public/data/dashboard.json";
import { PublicDetectionGeovisorMap as BaseGeovisorMap } from "./public-detection-geovisor-map";

// MapLibre GL JS v6 requiere un worker explícito. La ruta relativa funciona
// tanto en Vite local como bajo el basePath del repositorio en GitHub Pages.
maplibregl.setWorkerUrl("./maplibre/maplibre-gl-worker.mjs");

type DashboardCatalog = {
  departments: Array<{ code: string; name: string }>;
  municipalities: Array<{ code: string; name: string }>;
};

const dashboard = dashboardJson as DashboardCatalog;
const departmentNames = Object.fromEntries(dashboard.departments.map((item) => [item.code, item.name]));
const municipalityNames = Object.fromEntries(dashboard.municipalities.map((item) => [item.code, item.name]));

type GeovisorProps = Omit<ComponentProps<typeof BaseGeovisorMap>, "departmentNames" | "municipalityNames">;

export function GeovisorMap(props: GeovisorProps) {
  return <BaseGeovisorMap {...props} departmentNames={departmentNames} municipalityNames={municipalityNames} />;
}
