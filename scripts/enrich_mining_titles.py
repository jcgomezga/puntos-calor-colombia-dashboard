#!/usr/bin/env python3
"""Relaciona hotspots con títulos mineros vigentes publicados por la ANM."""

from __future__ import annotations

import argparse
import csv
import gzip
import importlib.util
import json
import math
import os
import sys
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_PUBLIC_DIR = ROOT / "public" / "data"
ANM_LAYER = "https://gisanm.anm.gov.co/server/rest/services/Hosted/Titulos_mineros/FeatureServer/0"
ANM_FIELDS = (
    "fid,codigo_exp,area_ha,fecha_insc,estado_exp,modalidade,etapa,minerales,"
    "municipios,fecha_term,tipo_explo,departamento,solicitante"
)
GRID_SIZE = 0.25
MINING_FIELDS = [
    "en_titulo_minero", "titulos_mineros_count", "titulos_mineros_codigos",
    "titulos_mineros_solicitantes", "titulos_mineros_etapas", "titulos_mineros_minerales",
]


def load_helpers():
    path = ROOT / "scripts" / "territorialize_hotspots.py"
    spec = importlib.util.spec_from_file_location("mining_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("no fue posible cargar el motor geométrico")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


HELPERS = load_helpers()


@dataclass(frozen=True)
class MiningTitle:
    feature_id: str
    code: str
    applicant: str
    stage: str
    minerals: str
    status: str
    modality: str
    area_ha: str
    geometry: dict[str, object]
    bbox: tuple[float, float, float, float]


def clean(value: object) -> str:
    return "" if value is None else str(value).strip()


def download_titles(batch_size: int, workers: int):
    metadata = HELPERS.curl_json(ANM_LAYER, {"f": "json"}, timeout=90)
    ids_payload = HELPERS.curl_json(
        f"{ANM_LAYER}/query", {"where": "1=1", "returnIdsOnly": "true", "f": "json"},
        timeout=90,
    )
    object_ids = sorted(int(value) for value in ids_payload.get("objectIds", []))
    if not object_ids:
        raise RuntimeError("ANM no devolvió identificadores de títulos vigentes")
    batches = list(HELPERS.chunks(object_ids, batch_size))

    def fetch(ids: list[int]):
        payload = HELPERS.curl_json(f"{ANM_LAYER}/query", {
            "objectIds": ",".join(map(str, ids)), "outFields": ANM_FIELDS,
            "returnGeometry": "true", "outSR": "4326", "geometryPrecision": "6",
            "returnZ": "false", "f": "geojson",
        }, timeout=180)
        features = payload.get("features", []) if isinstance(payload, dict) else []
        if not isinstance(features, list):
            raise RuntimeError("respuesta GeoJSON ANM inválida")
        return features

    from concurrent.futures import ThreadPoolExecutor, as_completed
    features = []
    with ThreadPoolExecutor(max_workers=min(workers, len(batches))) as executor:
        futures = [executor.submit(fetch, batch) for batch in batches]
        for future in as_completed(futures):
            features.extend(future.result())
    features.sort(key=lambda feature: clean(feature.get("properties", {}).get("fid")))
    if len(features) != len(object_ids):
        raise RuntimeError(f"cierre ANM fallido: {len(features)} geometrías para {len(object_ids)} IDs")
    audit = {
        "source": "Títulos mineros vigentes", "authority": "Agencia Nacional de Minería (ANM)",
        "url": ANM_LAYER, "featureCount": len(features), "spatialReference": 4326,
        "layerName": metadata.get("name"), "serviceItemId": metadata.get("serviceItemId"),
    }
    return {"type": "FeatureCollection", "features": features}, audit


def cache_is_fresh(metadata_path: Path, max_hours: float) -> bool:
    if not metadata_path.exists() or max_hours <= 0:
        return False
    try:
        value = json.loads(metadata_path.read_text(encoding="utf-8"))["downloadedAtUtc"]
        downloaded = datetime.fromisoformat(value.replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - downloaded).total_seconds() < max_hours * 3600
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return False


def load_or_download(data_dir: Path, refresh: bool, max_cache_hours: float, batch_size: int, workers: int):
    cache = data_dir / "boundaries" / "anm_titles_join.geojson.gz"
    metadata_path = data_dir / "boundaries" / "anm_titles_metadata.json"
    if cache.exists() and not refresh and cache_is_fresh(metadata_path, max_cache_hours):
        with gzip.open(cache, "rt", encoding="utf-8") as stream:
            return json.load(stream), json.loads(metadata_path.read_text(encoding="utf-8"))
    collection, audit = download_titles(batch_size, workers)
    HELPERS.save_gzip(cache, collection)
    audit["downloadedAtUtc"] = HELPERS.utc_now_iso()
    HELPERS.atomic_write(metadata_path, HELPERS.json_bytes(audit, pretty=True))
    return collection, audit


def title_records(collection: dict[str, object]) -> list[MiningTitle]:
    records = []
    for feature in collection.get("features", []):
        properties, geometry = feature.get("properties"), feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue
        records.append(MiningTitle(
            clean(properties.get("fid") or feature.get("id")),
            clean(properties.get("codigo_exp")), clean(properties.get("solicitante")),
            clean(properties.get("etapa")), clean(properties.get("minerales")),
            clean(properties.get("estado_exp")), clean(properties.get("modalidade")),
            clean(properties.get("area_ha")), geometry, HELPERS.geometry_bbox(geometry),
        ))
    if not records:
        raise RuntimeError("ANM no contiene geometrías utilizables")
    return records


def build_grid(records: list[MiningTitle]):
    index = defaultdict(list)
    for position, record in enumerate(records):
        min_x, min_y, max_x, max_y = record.bbox
        for x in range(math.floor(min_x / GRID_SIZE), math.floor(max_x / GRID_SIZE) + 1):
            for y in range(math.floor(min_y / GRID_SIZE), math.floor(max_y / GRID_SIZE) + 1):
                index[(x, y)].append(position)
    return dict(index)


def intersecting_titles(longitude: float, latitude: float, records, index):
    matches = []
    cell = (math.floor(longitude / GRID_SIZE), math.floor(latitude / GRID_SIZE))
    for position in index.get(cell, []):
        record = records[position]
        min_x, min_y, max_x, max_y = record.bbox
        if min_x <= longitude <= max_x and min_y <= latitude <= max_y:
            if HELPERS.point_in_geometry(longitude, latitude, record.geometry) in (1, 2):
                matches.append(record)
    return sorted(matches, key=lambda item: (item.code, item.applicant, item.feature_id))


def atomic_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=path.parent) as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def enrich(data_dir: Path, public_dir: Path, records: list[MiningTitle], audit: dict[str, object]):
    index, statuses, intersected_codes = build_grid(records), Counter(), set()
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            fields = [field for field in (reader.fieldnames or []) if field not in MINING_FIELDS] + MINING_FIELDS
            output = []
            for source_row in reader:
                row = {key: value for key, value in source_row.items() if key not in MINING_FIELDS}
                matches = intersecting_titles(float(row["longitud"]), float(row["latitud"]), records, index)
                statuses["dentro" if matches else "fuera"] += 1
                if len(matches) > 1:
                    statuses["solapamiento"] += 1
                intersected_codes.update(item.code for item in matches if item.code)
                row.update({
                    "en_titulo_minero": "true" if matches else "false",
                    "titulos_mineros_count": str(len(matches)),
                    "titulos_mineros_codigos": "|".join(item.code for item in matches),
                    "titulos_mineros_solicitantes": "|".join(item.applicant for item in matches),
                    "titulos_mineros_etapas": "|".join(item.stage for item in matches),
                    "titulos_mineros_minerales": "|".join(item.minerals for item in matches),
                })
                output.append(row)
        atomic_csv(source, fields, output)

    territorial_rows = []
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            territorial_rows.extend(csv.DictReader(stream))
    dashboard_path = public_dir / "dashboard.json"
    dashboard = json.loads(dashboard_path.read_text(encoding="utf-8"))
    if len(territorial_rows) != len(dashboard["points"]):
        raise RuntimeError("el orden territorial no cierra con dashboard.json")
    for point, row in zip(dashboard["points"], territorial_rows, strict=True):
        while len(point) > 13:
            point.pop()
        point.append(1 if row["en_titulo_minero"] == "true" else 0)
    dashboard["pointSchema"] = dashboard["pointSchema"][:13] + ["insideMiningTitle"]
    dashboard["metadata"]["miningTitles"] = {
        **audit, "insideRows": statuses["dentro"], "outsideRows": statuses["fuera"],
        "overlapRows": statuses["solapamiento"], "intersectedTitles": len(intersected_codes),
    }
    if statuses["dentro"] + statuses["fuera"] != len(dashboard["points"]):
        raise RuntimeError("cierre de títulos mineros fallido")
    HELPERS.atomic_write(dashboard_path, HELPERS.json_bytes(dashboard))
    return dashboard, dict(statuses)


def run(args: argparse.Namespace) -> int:
    data_dir, public_dir = Path(args.data_dir), Path(args.public_dir)
    collection, audit = load_or_download(
        data_dir, args.refresh_boundaries, args.max_cache_hours, args.batch_size, args.workers,
    )
    dashboard, statuses = enrich(data_dir, public_dir, title_records(collection), audit)
    report = {
        "finishedAtUtc": HELPERS.utc_now_iso(), "status": "completed", "source": audit,
        "relations": statuses, "dashboardRows": len(dashboard["points"]),
        "intersectedTitles": dashboard["metadata"]["miningTitles"]["intersectedTitles"],
    }
    HELPERS.atomic_write(
        data_dir / "metadata" / "mining_titles_latest_run.json",
        HELPERS.json_bytes(report, pretty=True),
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    result.add_argument("--public-dir", default=str(DEFAULT_PUBLIC_DIR))
    result.add_argument("--refresh-boundaries", action="store_true")
    result.add_argument("--max-cache-hours", type=float, default=24)
    result.add_argument("--batch-size", type=int, default=200)
    result.add_argument("--workers", type=int, default=6)
    return result


if __name__ == "__main__":
    raise SystemExit(run(parser().parse_args()))
