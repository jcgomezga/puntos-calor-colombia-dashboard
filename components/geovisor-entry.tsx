"use client";

import * as maplibregl from "maplibre-gl";
import type { ComponentProps } from "react";
import dashboardJson from "@/public/data/dashboard.json";
import { OperationalGeovisorMap as BaseGeovisorMap } from "./operational-geovisor-map";

// MapLibre GL JS v6 requires an explicit worker URL when bundled. A relative
// same-origin path works in the Work/Vite preview and under the GitHub Pages
// repository base path. The matching worker and shared module are copied from
// the installed MapLibre package before each build/dev run.
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
