"use client";

import * as maplibregl from "maplibre-gl";

// MapLibre GL JS v6 requires an explicit worker URL when bundled. A relative
// same-origin path works in the Work/Vite preview and under the GitHub Pages
// repository base path. The matching worker and shared module are copied from
// the installed MapLibre package before each build/dev run.
maplibregl.setWorkerUrl("./maplibre/maplibre-gl-worker.mjs");

export { GeovisorMap } from "./geovisor-map";
