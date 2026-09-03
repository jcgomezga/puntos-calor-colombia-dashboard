#!/usr/bin/env python3
"""Evalúa la sensibilidad de episodios espacio-temporales sin publicarlos en el dashboard."""

from __future__ import annotations

import argparse
import csv
import hashlib
import importlib.util
import json
import math
import os
import statistics
import sys
import tempfile
from collections import defaultdict
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
SPATIAL_THRESHOLDS_M = (500, 1_000, 2_000)
TEMPORAL_THRESHOLDS_H = (12, 24, 48)


def load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"no fue posible cargar {filename}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


SPATIAL = load_module("enrich_anla_projects.py", "episode_projection")


@dataclass(frozen=True)
class Hotspot:
    hotspot_id: str
    x: float
    y: float
    minute_utc: float
    municipality: str
    source: str
    scenario_b: bool


@dataclass(frozen=True)
class Component:
    size: int
    duration_hours: float
    bbox_diagonal_km: float
    municipalities: int
    sources: int


class UnionFind:
    def __init__(self, size: int):
        self.parent = list(range(size))
        self.rank = [0] * size

    def find(self, value: int) -> int:
        while self.parent[value] != value:
            self.parent[value] = self.parent[self.parent[value]]
            value = self.parent[value]
        return value

    def union(self, left: int, right: int) -> None:
        left_root, right_root = self.find(left), self.find(right)
        if left_root == right_root:
            return
        if self.rank[left_root] < self.rank[right_root]:
            left_root, right_root = right_root, left_root
        self.parent[right_root] = left_root
        if self.rank[left_root] == self.rank[right_root]:
            self.rank[left_root] += 1


def parse_minute_utc(value: str) -> float:
    instant = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return instant.timestamp() / 60


def load_hotspots(data_dir: Path) -> list[Hotspot]:
    points, seen = [], set()
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            for row in csv.DictReader(stream):
                hotspot_id = row["hotspot_id"]
                if hotspot_id in seen:
                    raise RuntimeError(f"hotspot_id duplicado: {hotspot_id}")
                seen.add(hotspot_id)
                x, y = SPATIAL.project_epsg9377(float(row["longitud"]), float(row["latitud"]))
                points.append(Hotspot(
                    hotspot_id=hotspot_id, x=x, y=y,
                    minute_utc=parse_minute_utc(row["fecha_hora_utc"]),
                    municipality=row.get("mpio_codigo", ""), source=row.get("fuente", ""),
                    scenario_b=row.get("escenario_b") == "true",
                ))
    if not points:
        raise RuntimeError("no existen hotspots para analizar")
    return sorted(points, key=lambda point: (point.minute_utc, point.hotspot_id))


def connected_groups(points: list[Hotspot], spatial_m: float, temporal_h: float):
    if spatial_m <= 0 or temporal_h <= 0:
        raise ValueError("los umbrales deben ser positivos")
    ordered = sorted(points, key=lambda point: (point.minute_utc, point.hotspot_id))
    union = UnionFind(len(ordered))
    grid: dict[tuple[int, int], list[int]] = defaultdict(list)
    temporal_minutes = temporal_h * 60
    spatial_sq = spatial_m * spatial_m
    links = 0
    for position, point in enumerate(ordered):
        cell_x, cell_y = math.floor(point.x / spatial_m), math.floor(point.y / spatial_m)
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for previous in reversed(grid.get((cell_x + dx, cell_y + dy), [])):
                    candidate = ordered[previous]
                    if point.minute_utc - candidate.minute_utc > temporal_minutes:
                        break
                    if (point.x - candidate.x) ** 2 + (point.y - candidate.y) ** 2 <= spatial_sq:
                        union.union(position, previous)
                        links += 1
        grid[(cell_x, cell_y)].append(position)
    groups: dict[int, list[int]] = defaultdict(list)
    for position in range(len(ordered)):
        groups[union.find(position)].append(position)
    return ordered, list(groups.values()), links


def components(points: list[Hotspot], spatial_m: float, temporal_h: float) -> tuple[list[Component], int]:
    ordered, groups, links = connected_groups(points, spatial_m, temporal_h)
    output = []
    for members in groups:
        selected = [ordered[position] for position in members]
        xs, ys = [point.x for point in selected], [point.y for point in selected]
        output.append(Component(
            size=len(selected),
            duration_hours=(selected[-1].minute_utc - selected[0].minute_utc) / 60,
            bbox_diagonal_km=math.hypot(max(xs) - min(xs), max(ys) - min(ys)) / 1_000,
            municipalities=len({point.municipality for point in selected if point.municipality}),
            sources=len({point.source for point in selected if point.source}),
        ))
    return output, links


def percentile(values: list[float], probability: float) -> float:
    if not values:
        return 0.0
    ordered = sorted(values)
    position = max(0, math.ceil(probability * len(ordered)) - 1)
    return float(ordered[position])


def summarize(points: list[Hotspot], spatial_m: int, temporal_h: int, scenario: str) -> dict[str, object]:
    groups, links = components(points, spatial_m, temporal_h)
    candidates = [group for group in groups if group.size >= 2]
    robust = [group for group in groups if group.size >= 3]
    candidate_hotspots = sum(group.size for group in candidates)
    robust_hotspots = sum(group.size for group in robust)
    chained = [
        group for group in candidates
        if group.duration_hours > temporal_h * 5 or group.bbox_diagonal_km > spatial_m / 1_000 * 5
    ]
    sizes = [group.size for group in candidates]
    durations = [group.duration_hours for group in candidates]
    extents = [group.bbox_diagonal_km for group in candidates]
    return {
        "scenario": scenario, "spatialMeters": spatial_m, "temporalHours": temporal_h,
        "totalHotspots": len(points), "candidateLinks": links,
        "candidateEpisodes": len(candidates), "robustEpisodes": len(robust),
        "singletonHotspots": len(points) - candidate_hotspots,
        "candidateEpisodeHotspots": candidate_hotspots, "robustEpisodeHotspots": robust_hotspots,
        "pairedOnlyEpisodes": sum(group.size == 2 for group in candidates),
        "medianEpisodeSize": round(statistics.median(sizes), 2) if sizes else 0,
        "p95EpisodeSize": int(percentile(sizes, .95)), "maxEpisodeSize": max(sizes, default=0),
        "medianDurationHours": round(statistics.median(durations), 2) if durations else 0,
        "p95DurationHours": round(percentile(durations, .95), 2),
        "maxDurationHours": round(max(durations, default=0), 2),
        "p95BboxDiagonalKm": round(percentile(extents, .95), 2),
        "maxBboxDiagonalKm": round(max(extents, default=0), 2),
        "crossMunicipalityEpisodes": sum(group.municipalities > 1 for group in candidates),
        "multiSourceEpisodes": sum(group.sources > 1 for group in candidates),
        "chainedEpisodes": len(chained), "chainedHotspots": sum(group.size for group in chained),
        "largestEpisodeSharePct": round(max(sizes, default=0) / len(points) * 100, 3),
    }


def atomic_write(path: Path, content: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    try:
        with os.fdopen(handle, "wb") as stream:
            stream.write(content)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=path.parent) as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader(); writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def run(data_dir: Path) -> dict[str, object]:
    points_a = load_hotspots(data_dir)
    points_b = [point for point in points_a if point.scenario_b]
    results = []
    for scenario, points in (("A", points_a), ("B", points_b)):
        for spatial_m in SPATIAL_THRESHOLDS_M:
            for temporal_h in TEMPORAL_THRESHOLDS_H:
                print(f"Episodios {scenario}: {spatial_m} m / {temporal_h} h", flush=True)
                results.append(summarize(points, spatial_m, temporal_h, scenario))
    output_dir = data_dir / "episodes"
    write_csv(output_dir / "sensitivity_matrix.csv", results)
    payload = {
        "generatedAtUtc": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "method": "componentes conexos espacio-temporales", "minimumCandidateSize": 2,
        "minimumRobustSize": 3, "spatialThresholdsMeters": list(SPATIAL_THRESHOLDS_M),
        "temporalThresholdsHours": list(TEMPORAL_THRESHOLDS_H), "results": results,
    }
    atomic_write(output_dir / "sensitivity_matrix.json", (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode())
    digest = hashlib.sha256((output_dir / "sensitivity_matrix.csv").read_bytes()).hexdigest()
    report = {
        "status": "completed", "scenarioARows": len(points_a), "scenarioBRows": len(points_b),
        "parameterCombinations": len(results), "csvSha256": digest,
        "output": str((output_dir / "sensitivity_matrix.csv").relative_to(data_dir)),
    }
    atomic_write(data_dir / "metadata" / "episode_sensitivity_latest_run.json", (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode())
    return report


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    return result


if __name__ == "__main__":
    args = parser().parse_args()
    print(json.dumps(run(Path(args.data_dir)), ensure_ascii=False, indent=2))
