#!/usr/bin/env python3
"""Construye episodios preliminares B con identidad persistente y linaje auditable."""

from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import importlib.util
import json
import math
import os
import statistics
import sys
import tempfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_PUBLIC_DIR = ROOT / "public" / "data"
METHOD_VERSION = "episodes-b-1000m-24h-min3-v1"
SPATIAL_METERS = 1_000
TEMPORAL_HOURS = 24
MIN_MEMBERS = 3
CHAIN_FACTOR = 5
EPISODE_FIELDS = [
    "episode_id", "member_count", "start_local", "end_local", "duration_hours",
    "centroid_longitude", "centroid_latitude", "bbox_diagonal_km", "chained",
    "department_count", "department_codes", "departments", "municipality_count",
    "municipality_codes", "municipalities", "sources", "frp_count", "frp_mean_mw", "frp_max_mw",
]
MEMBERSHIP_FIELDS = [
    "hotspot_id", "episode_class", "episode_id", "candidate_id", "group_size", "chained",
]
LINEAGE_FIELDS = [
    "run_id", "previous_episode_id", "current_episode_id", "change_type",
    "overlap_hotspots", "previous_size", "current_size",
]


def load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"no fue posible cargar {filename}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


ANALYSIS = load_module("analyze_episode_sensitivity.py", "operational_episode_analysis")


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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


def write_csv(path: Path, fields: list[str], rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=path.parent) as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def load_rows(data_dir: Path) -> tuple[list[dict[str, str]], dict[str, dict[str, str]]]:
    rows, by_id = [], {}
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            for row in csv.DictReader(stream):
                hotspot_id = row["hotspot_id"]
                if hotspot_id in by_id:
                    raise RuntimeError(f"hotspot_id duplicado: {hotspot_id}")
                rows.append(row); by_id[hotspot_id] = row
    if not rows:
        raise RuntimeError("no existen hotspots territoriales")
    return rows, by_id


def load_state(path: Path, reset: bool = False) -> dict[str, set[str]]:
    if reset or not path.exists():
        return {}
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        state = json.load(stream)
    if state.get("methodVersion") != METHOD_VERSION:
        raise RuntimeError("el estado previo usa otra versión metodológica; use --reset-state conscientemente")
    return {item["episodeId"]: set(item["members"]) for item in state.get("episodes", [])}


def save_state(path: Path, episodes: dict[str, set[str]], generated: str) -> None:
    payload = {
        "methodVersion": METHOD_VERSION, "generatedAtUtc": generated,
        "episodes": [{"episodeId": episode_id, "members": sorted(members)} for episode_id, members in sorted(episodes.items())],
    }
    raw = (json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n").encode()
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(delete=False, dir=path.parent) as stream:
        temporary = Path(stream.name)
    try:
        with temporary.open("wb") as target:
            with gzip.GzipFile(fileobj=target, mode="wb", mtime=0) as compressed:
                compressed.write(raw)
        os.replace(temporary, path)
    finally:
        temporary.unlink(missing_ok=True)


def new_identifier(members: set[str], points_by_id: dict[str, object], prefix: str = "E") -> str:
    earliest_id = min(members, key=lambda member: (points_by_id[member].minute_utc, member))
    day = datetime.fromtimestamp(points_by_id[earliest_id].minute_utc * 60, timezone.utc).strftime("%Y%m%d")
    digest = hashlib.sha1(f"{METHOD_VERSION}|{earliest_id}".encode()).hexdigest()[:10].upper()
    return f"{prefix}{day}-{digest}"


def assign_episode_ids(
    current: list[set[str]], previous: dict[str, set[str]], points_by_id: dict[str, object], run_id: str,
) -> tuple[list[str], list[dict[str, object]]]:
    previous_owner = {member: episode_id for episode_id, members in previous.items() for member in members}
    overlaps: dict[tuple[int, str], int] = Counter()
    for position, members in enumerate(current):
        for member in members:
            if member in previous_owner:
                overlaps[(position, previous_owner[member])] += 1
    assigned_current, assigned_previous = {}, set()
    for (position, episode_id), overlap in sorted(overlaps.items(), key=lambda item: (-item[1], item[0][1], item[0][0])):
        if position not in assigned_current and episode_id not in assigned_previous:
            assigned_current[position] = episode_id
            assigned_previous.add(episode_id)
    identifiers, used = [], set(previous)
    for position, members in enumerate(current):
        episode_id = assigned_current.get(position) or new_identifier(members, points_by_id)
        if episode_id in used and assigned_current.get(position) != episode_id:
            digest = hashlib.sha1("|".join(sorted(members)).encode()).hexdigest()[:6].upper()
            episode_id = f"{episode_id}-{digest}"
        identifiers.append(episode_id); used.add(episode_id)

    lineage = []
    current_by_id = dict(zip(identifiers, current, strict=True))
    prior_positions = defaultdict(set)
    for current_position, prior in overlaps:
        prior_positions[prior].add(current_position)
    for position, episode_id in enumerate(identifiers):
        candidates = {prior: count for (current_position, prior), count in overlaps.items() if current_position == position}
        if not candidates:
            lineage.append({
                "run_id": run_id, "previous_episode_id": "", "current_episode_id": episode_id,
                "change_type": "created", "overlap_hotspots": 0, "previous_size": 0,
                "current_size": len(current[position]),
            })
        for prior, overlap in sorted(candidates.items()):
            if prior != episode_id and len([key for key in candidates if key != episode_id]) > 0:
                lineage.append({
                    "run_id": run_id, "previous_episode_id": prior, "current_episode_id": episode_id,
                    "change_type": "merged", "overlap_hotspots": overlap,
                    "previous_size": len(previous[prior]), "current_size": len(current[position]),
                })
        if set(candidates) == {episode_id} and len(prior_positions[episode_id]) == 1:
            before, after = previous[episode_id], current[position]
            if before != after:
                change_type = "expanded" if before < after else "contracted" if after < before else "revised"
                lineage.append({
                    "run_id": run_id, "previous_episode_id": episode_id,
                    "current_episode_id": episode_id, "change_type": change_type,
                    "overlap_hotspots": len(before & after), "previous_size": len(before),
                    "current_size": len(after),
                })
    for prior, prior_members in sorted(previous.items()):
        current_hits = [(identifiers[position], len(prior_members & members)) for position, members in enumerate(current) if prior_members & members]
        if not current_hits:
            lineage.append({
                "run_id": run_id, "previous_episode_id": prior, "current_episode_id": "",
                "change_type": "retired", "overlap_hotspots": 0,
                "previous_size": len(prior_members), "current_size": 0,
            })
        elif len(current_hits) > 1:
            inherited = next((current_id for current_id, _ in current_hits if current_id == prior), None)
            for current_id, overlap in current_hits:
                if current_id != inherited:
                    lineage.append({
                        "run_id": run_id, "previous_episode_id": prior, "current_episode_id": current_id,
                        "change_type": "split", "overlap_hotspots": overlap,
                        "previous_size": len(prior_members), "current_size": len(current_by_id[current_id]),
                    })
    return identifiers, lineage


def component_metrics(members: set[str], points_by_id: dict[str, object], rows_by_id: dict[str, dict[str, str]]):
    points = [points_by_id[member] for member in members]
    rows = [rows_by_id[member] for member in members]
    xs, ys = [point.x for point in points], [point.y for point in points]
    duration = (max(point.minute_utc for point in points) - min(point.minute_utc for point in points)) / 60
    diagonal = math.hypot(max(xs) - min(xs), max(ys) - min(ys)) / 1_000
    chained = duration > TEMPORAL_HOURS * CHAIN_FACTOR or diagonal > SPATIAL_METERS / 1_000 * CHAIN_FACTOR
    frp = [float(row["frp_mw"]) for row in rows if row.get("frp_mw")]
    unique = lambda values: "|".join(sorted({value for value in values if value}))
    return {
        "member_count": len(members),
        "start_local": min(row["fecha_hora_col"] for row in rows),
        "end_local": max(row["fecha_hora_col"] for row in rows),
        "duration_hours": round(duration, 2),
        "centroid_longitude": round(statistics.mean(float(row["longitud"]) for row in rows), 5),
        "centroid_latitude": round(statistics.mean(float(row["latitud"]) for row in rows), 5),
        "bbox_diagonal_km": round(diagonal, 2), "chained": str(chained).lower(),
        "department_count": len({row["dpto_codigo"] for row in rows if row.get("dpto_codigo")}),
        "department_codes": unique(row.get("dpto_codigo", "") for row in rows),
        "departments": unique(row.get("departamento", "") for row in rows),
        "municipality_count": len({row["mpio_codigo"] for row in rows if row.get("mpio_codigo")}),
        "municipality_codes": unique(row.get("mpio_codigo", "") for row in rows),
        "municipalities": unique(row.get("municipio", "") for row in rows),
        "sources": unique(row.get("fuente", "") for row in rows),
        "frp_count": len(frp), "frp_mean_mw": round(statistics.mean(frp), 2) if frp else "",
        "frp_max_mw": round(max(frp), 2) if frp else "",
    }


def append_lineage(path: Path, new_rows: list[dict[str, object]]) -> None:
    existing = []
    if path.exists():
        with path.open(encoding="utf-8", newline="") as stream:
            existing = list(csv.DictReader(stream))
    write_csv(path, LINEAGE_FIELDS, existing + new_rows)


def build(data_dir: Path, public_dir: Path, reset_state: bool = False) -> dict[str, object]:
    generated = utc_now_iso()
    run_id = generated.replace(":", "").replace("-", "")
    territorial_rows, rows_by_id = load_rows(data_dir)
    points = ANALYSIS.load_hotspots(data_dir)
    points_b = [point for point in points if point.scenario_b]
    ordered, raw_groups, links = ANALYSIS.connected_groups(points_b, SPATIAL_METERS, TEMPORAL_HOURS)
    points_by_id = {point.hotspot_id: point for point in ordered}
    member_groups = [{ordered[position].hotspot_id for position in members} for members in raw_groups]
    robust = sorted(
        (members for members in member_groups if len(members) >= MIN_MEMBERS),
        key=lambda members: min((points_by_id[member].minute_utc, member) for member in members),
    )
    pairs = [members for members in member_groups if len(members) == 2]
    isolated = [members for members in member_groups if len(members) == 1]

    state_path = data_dir / "episodes" / "episode_state.json.gz"
    previous = load_state(state_path, reset_state)
    identifiers, lineage = assign_episode_ids(robust, previous, points_by_id, run_id)
    current = dict(zip(identifiers, robust, strict=True))
    episode_rows, membership = [], {}
    for episode_id, members in sorted(current.items()):
        metrics = component_metrics(members, points_by_id, rows_by_id)
        episode_rows.append({"episode_id": episode_id, **metrics})
        for member in members:
            membership[member] = {
                "hotspot_id": member, "episode_class": "chained" if metrics["chained"] == "true" else "episode",
                "episode_id": episode_id, "candidate_id": "", "group_size": len(members),
                "chained": metrics["chained"],
            }
    for members in pairs:
        pair_id = new_identifier(members, points_by_id, "P")
        for member in members:
            membership[member] = {
                "hotspot_id": member, "episode_class": "pair", "episode_id": "",
                "candidate_id": pair_id, "group_size": 2, "chained": "false",
            }
    for members in isolated:
        member = next(iter(members))
        membership[member] = {
            "hotspot_id": member, "episode_class": "isolated", "episode_id": "",
            "candidate_id": "", "group_size": 1, "chained": "false",
        }
    if len(membership) != len(points_b):
        raise RuntimeError("el cierre de membresías B no coincide con los hotspots evaluados")

    output_dir = data_dir / "episodes"
    write_csv(output_dir / "episodes.csv", EPISODE_FIELDS, episode_rows)
    write_csv(output_dir / "hotspot_episode_membership.csv", MEMBERSHIP_FIELDS, [membership[key] for key in sorted(membership)])
    append_lineage(output_dir / "episode_lineage.csv", lineage)
    save_state(state_path, current, generated)

    dashboard_path = public_dir / "dashboard.json"
    dashboard = json.loads(dashboard_path.read_text(encoding="utf-8"))
    if len(territorial_rows) != len(dashboard["points"]):
        raise RuntimeError("el orden territorial no cierra con dashboard.json para episodios")
    episode_ids = [row["episode_id"] for row in episode_rows]
    episode_index = {episode_id: position for position, episode_id in enumerate(episode_ids)}
    codes = {"isolated": 0, "pair": 1, "episode": 2, "chained": 3}
    for point, row in zip(dashboard["points"], territorial_rows, strict=True):
        while len(point) > 17:
            point.pop()
        item = membership.get(row["hotspot_id"])
        point.extend([codes[item["episode_class"]], episode_index.get(item["episode_id"], -1)] if item else [-1, -1])
    dashboard["pointSchema"] = dashboard["pointSchema"][:17] + ["episodeClass", "episodeIndex"]
    dashboard["episodes"] = [{
        "id": row["episode_id"], "size": int(row["member_count"]), "start": row["start_local"],
        "end": row["end_local"], "durationHours": float(row["duration_hours"]),
        "longitude": float(row["centroid_longitude"]), "latitude": float(row["centroid_latitude"]),
        "chained": row["chained"] == "true", "extentKm": float(row["bbox_diagonal_km"]),
        "departments": row["departments"].split("|") if row["departments"] else [],
        "municipalities": row["municipalities"].split("|") if row["municipalities"] else [],
        "frpMeanMw": float(row["frp_mean_mw"]) if row["frp_mean_mw"] != "" else None,
        "frpMaxMw": float(row["frp_max_mw"]) if row["frp_max_mw"] != "" else None,
    } for row in episode_rows]
    dashboard["episodeChanges"] = [{
        "type": row["change_type"], "previousId": row["previous_episode_id"],
        "currentId": row["current_episode_id"], "overlap": int(row["overlap_hotspots"]),
        "previousSize": int(row["previous_size"]), "currentSize": int(row["current_size"]),
    } for row in lineage]
    classes = Counter(item["episode_class"] for item in membership.values())
    lineage_counts = Counter(row["change_type"] for row in lineage)
    dashboard["metadata"]["episodes"] = {
        "methodVersion": METHOD_VERSION, "scenario": "B", "spatialMeters": SPATIAL_METERS,
        "temporalHours": TEMPORAL_HOURS, "minimumMembers": MIN_MEMBERS,
        "evaluatedRows": len(points_b), "excludedScenarioARows": len(points) - len(points_b),
        "episodeCount": len(episode_rows), "episodeRows": classes["episode"] + classes["chained"],
        "pairCount": len(pairs), "pairRows": classes["pair"], "isolatedRows": classes["isolated"],
        "chainedEpisodeCount": sum(row["chained"] == "true" for row in episode_rows),
        "chainedRows": classes["chained"], "candidateLinks": links,
        "crossMunicipalityCandidateGroups": sum(
            len({rows_by_id[member].get("mpio_codigo", "") for member in members if rows_by_id[member].get("mpio_codigo")}) > 1
            for members in member_groups if len(members) >= 2
        ),
        "crossMunicipalityEpisodes": sum(int(row["municipality_count"]) > 1 for row in episode_rows),
        "lineageEventsThisRun": len(lineage), "lineageCounts": dict(sorted(lineage_counts.items())),
        "generatedAtUtc": generated,
    }
    atomic_write(dashboard_path, (json.dumps(dashboard, ensure_ascii=False, separators=(",", ":")) + "\n").encode())
    report = {
        "status": "completed", "finishedAtUtc": generated, "methodVersion": METHOD_VERSION,
        **dashboard["metadata"]["episodes"],
    }
    atomic_write(data_dir / "metadata" / "episodes_latest_run.json", (json.dumps(report, ensure_ascii=False, indent=2) + "\n").encode())
    return report


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    result.add_argument("--public-dir", default=str(DEFAULT_PUBLIC_DIR))
    result.add_argument("--reset-state", action="store_true")
    return result


if __name__ == "__main__":
    args = parser().parse_args()
    print(json.dumps(build(Path(args.data_dir), Path(args.public_dir), args.reset_state), ensure_ascii=False, indent=2))
