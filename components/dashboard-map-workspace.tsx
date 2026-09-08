"use client";

import { DashboardMap, type FeatureCollection, type PointRow } from "@/components/dashboard-map";
import { GeovisorMap } from "@/components/geovisor-map";
import departmentGeoJson from "@/public/data/departments.json";
import municipalityGeoJson from "@/public/data/municipalities.json";

const departmentsGeo = departmentGeoJson as unknown as FeatureCollection;
const municipalitiesGeo = municipalityGeoJson as unknown as FeatureCollection;

type MapMode = "geovisor" | "basic";

export function DashboardMapWorkspace({ mode, points, dates, sources, departmentCode, municipalityCode, onDepartment, onMunicipality }: {
  mode: MapMode;
  points: PointRow[];
  dates: string[];
  sources: string[];
  departmentCode: string;
  municipalityCode: string;
  onDepartment: (code: string) => void;
  onMunicipality: (code: string) => void;
}) {
  if (mode === "geovisor") {
    return <GeovisorMap departments={departmentsGeo} municipalities={municipalitiesGeo} points={points} dates={dates} sources={sources} departmentCode={departmentCode} municipalityCode={municipalityCode} onDepartment={onDepartment} onMunicipality={onMunicipality} />;
  }

  return <DashboardMap departments={departmentsGeo} municipalities={municipalitiesGeo} points={points} departmentCode={departmentCode} municipalityCode={municipalityCode} onDepartment={onDepartment} onMunicipality={onMunicipality} />;
}
