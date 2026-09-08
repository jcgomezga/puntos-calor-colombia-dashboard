"use client";

import * as maplibregl from "maplibre-gl";
import type { ComponentProps } from "react";
import { PublicDetectionGeovisorMap as BaseGeovisorMap } from "./public-detection-geovisor-map";

// MapLibre GL JS v6 requiere un worker explícito. La ruta relativa funciona
// tanto en Vite local como bajo el basePath del repositorio en GitHub Pages.
maplibregl.setWorkerUrl("./maplibre/maplibre-gl-worker.mjs");

type GeovisorProps = ComponentProps<typeof BaseGeovisorMap>;

export function GeovisorMap(props: GeovisorProps) {
  return <BaseGeovisorMap {...props} />;
}
