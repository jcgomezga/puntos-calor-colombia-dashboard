#!/usr/bin/env python3
"""Relaciona hotspots territorializados con las áreas protegidas oficiales RUNAP."""

from __future__ import annotations

import argparse
import csv
import gzip
import importlib.util
import json
import os
import sys
import tempfile
from collections import Counter, defaultdict
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_PUBLIC_DIR = ROOT / "public" / "data"
RUNAP_LAYER = (
    "https://mapas.parquesnacionales.gov.co/arcgis/rest/services/"
    "pnn/runap/FeatureServer/0"
)
RUNAP_FIELDS = "ap_id,ap_nombre,ap_categoria,condicion,organizacion"
GRID_SIZE = 0.5
PROTECTED_FIELDS = [
    "en_area_protegida", "areas_protegidas_count", "areas_protegidas_ids",
    "areas_protegidas_nombres", "areas_protegidas_categorias",
]


def load_territorial_module():
    path = ROOT / "scripts" / "territorialize_hotspots.py"
    spec = importlib.util.spec_from_file_location("territorial_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("no fue posible cargar el motor geométrico territorial")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


TERRITORIAL = load_territorial_module()


@dataclass(frozen=True)
class ProtectedArea:
    area_id: str
    name: str
    category: str
    condition: str
    authority: str
    geometry: dict[str, object]
    bbox: tuple[float, float, float, float]


def layer_url(suffix: str = "") -> str:
    return f"{RUNAP_LAYER}{suffix}"


def download_runap(batch_size: int, workers: int) -> tuple[dict[str, object], dict[str, object]]:
    metadata = TERRITORIAL.curl_json(layer_url(), {"f": "json"})
    ids_payload = TERRITORIAL.curl_json(
        layer_url("/query"), {"where": "1=1", "returnIdsOnly": "true", "f": "json"}
    )
    object_ids = sorted(int(value) for value in ids_payload.get("objectIds", []))
    if not object_ids:
        raise RuntimeError("RUNAP no devolvió identificadores")
    batches = list(TERRITORIAL.chunks(object_ids, batch_size))

    def fetch(ids: list[int]) -> list[dict[str, object]]:
        payload = TERRITORIAL.curl_json(layer_url("/query"), {
            "objectIds": ",".join(map(str, ids)), "outFields": RUNAP_FIELDS,
            "returnGeometry": "true", "outSR": "4326", "geometryPrecision": "6",
            "f": "geojson",
        })
        features = payload.get("features", []) if isinstance(payload, dict) else []
        if not isinstance(features, list):
            raise RuntimeError("respuesta GeoJSON RUNAP inválida")
        return features

    from concurrent.futures import ThreadPoolExecutor, as_completed
    features: list[dict[str, object]] = []
    with ThreadPoolExecutor(max_workers=min(workers, len(batches))) as executor:
        futures = [executor.submit(fetch, batch) for batch in batches]
        for future in as_completed(futures):
            features.extend(future.result())
    features.sort(key=lambda feature: int(feature.get("id", 0)))
    if len(features) != len(object_ids):
        raise RuntimeError(f"cierre RUNAP fallido: {len(features)} geometrías para {len(object_ids)} IDs")
    audit = {
        "source": "Registro Único Nacional de Áreas Protegidas (RUNAP)",
        "authority": "Parques Nacionales Naturales de Colombia",
        "url": RUNAP_LAYER, "featureCount": len(features),
        "spatialReference": 4326, "layerName": metadata.get("name"),
    }
    return {"type": "FeatureCollection", "features": features}, audit


def load_or_download(data_dir: Path, refresh: bool, batch_size: int, workers: int):
    cache = data_dir / "boundaries" / "runap_join.geojson.gz"
    metadata_path = data_dir / "boundaries" / "runap_metadata.json"
    if cache.exists() and metadata_path.exists() and not refresh:
        with gzip.open(cache, "rt", encoding="utf-8") as stream:
            return json.load(stream), json.loads(metadata_path.read_text(encoding="utf-8"))
    collection, audit = download_runap(batch_size, workers)
    TERRITORIAL.save_gzip(cache, collection)
    audit["downloadedAtUtc"] = TERRITORIAL.utc_now_iso()
    TERRITORIAL.atomic_write(metadata_path, TERRITORIAL.json_bytes(audit, pretty=True))
    return collection, audit


def protected_records(collection: dict[str, object]) -> list[ProtectedArea]:
    records = []
    for feature in collection.get("features", []):
        properties, geometry = feature.get("properties"), feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue
        records.append(ProtectedArea(
            area_id=str(properties.get("ap_id") or feature.get("id") or ""),
            name=str(properties.get("ap_nombre") or "Sin nombre").strip(),
            category=str(properties.get("ap_categoria") or "Sin categoría").strip(),
            condition=str(properties.get("condicion") or "").strip(),
            authority=str(properties.get("organizacion") or "").strip(),
            geometry=geometry, bbox=TERRITORIAL.geometry_bbox(geometry),
        ))
    if not records:
        raise RuntimeError("RUNAP no contiene geometrías utilizables")
    return records


def build_grid(records: list[ProtectedArea]) -> dict[tuple[int, int], list[int]]:
    index: dict[tuple[int, int], list[int]] = defaultdict(list)
    import math
    for position, record in enumerate(records):
        min_x, min_y, max_x, max_y = record.bbox
        for x in range(math.floor(min_x / GRID_SIZE), math.floor(max_x / GRID_SIZE) + 1):
            for y in range(math.floor(min_y / GRID_SIZE), math.floor(max_y / GRID_SIZE) + 1):
                index[(x, y)].append(position)
    return dict(index)


def intersecting_areas(longitude: float, latitude: float, records, index):
    import math
    matches = []
    for position in index.get((math.floor(longitude / GRID_SIZE), math.floor(latitude / GRID_SIZE)), []):
        record = records[position]
        min_x, min_y, max_x, max_y = record.bbox
        if min_x <= longitude <= max_x and min_y <= latitude <= max_y:
            if TERRITORIAL.point_in_geometry(longitude, latitude, record.geometry) in (1, 2):
                matches.append(record)
    return sorted(matches, key=lambda item: (item.category, item.name, item.area_id))


def atomic_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> None:
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="", delete=False, dir=path.parent
    ) as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def enrich(data_dir: Path, public_dir: Path, records: list[ProtectedArea], audit: dict[str, object]):
    index = build_grid(records)
    relation_by_hotspot: dict[str, list[ProtectedArea]] = {}
    statuses = Counter()
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            fields = [field for field in (reader.fieldnames or []) if field not in PROTECTED_FIELDS] + PROTECTED_FIELDS
            output = []
            for source_row in reader:
                row = {key: value for key, value in source_row.items() if key not in PROTECTED_FIELDS}
                matches = intersecting_areas(float(row["longitud"]), float(row["latitud"]), records, index)
                relation_by_hotspot[row["hotspot_id"]] = matches
                status = "dentro" if matches else "fuera"
                statuses[status] += 1
                if len(matches) > 1:
                    statuses["solapamiento"] += 1
                row.update({
                    "en_area_protegida": "true" if matches else "false",
                    "areas_protegidas_count": str(len(matches)),
                    "areas_protegidas_ids": "|".join(item.area_id for item in matches),
                    "areas_protegidas_nombres": "|".join(item.name for item in matches),
                    "areas_protegidas_categorias": "|".join(item.category for item in matches),
                })
                output.append(row)
        atomic_csv(source, fields, output)

    dashboard_path = public_dir / "dashboard.json"
    dashboard = json.loads(dashboard_path.read_text(encoding="utf-8"))
    territorial_rows = []
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            territorial_rows.extend(csv.DictReader(stream))
    if len(territorial_rows) != len(dashboard["points"]):
        raise RuntimeError("el orden territorial no cierra con los puntos del dashboard")
    for point, row in zip(dashboard["points"], territorial_rows, strict=True):
        while len(point) > 11:
            point.pop()
        point.append(1 if row["en_area_protegida"] == "true" else 0)
    dashboard["pointSchema"] = dashboard["pointSchema"][:11] + ["insideProtectedArea"]
    dashboard["metadata"]["protectedAreas"] = {
        **audit, "insideRows": statuses["dentro"], "outsideRows": statuses["fuera"],
        "overlapRows": statuses["solapamiento"],
        "categories": len({record.category for record in records}),
    }
    if statuses["dentro"] + statuses["fuera"] != len(dashboard["points"]):
        raise RuntimeError("cierre de relación RUNAP fallido")
    TERRITORIAL.atomic_write(dashboard_path, TERRITORIAL.json_bytes(dashboard))
    return dashboard, dict(statuses)


def run(args: argparse.Namespace) -> int:
    data_dir, public_dir = Path(args.data_dir), Path(args.public_dir)
    collection, audit = load_or_download(
        data_dir, args.refresh_boundaries, args.batch_size, args.workers
    )
    records = protected_records(collection)
    dashboard, statuses = enrich(data_dir, public_dir, records, audit)
    report = {
        "finishedAtUtc": TERRITORIAL.utc_now_iso(), "status": "completed",
        "source": audit, "relations": statuses, "dashboardRows": len(dashboard["points"]),
    }
    TERRITORIAL.atomic_write(
        data_dir / "metadata" / "protected_areas_latest_run.json",
        TERRITORIAL.json_bytes(report, pretty=True),
    )
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    result.add_argument("--public-dir", default=str(DEFAULT_PUBLIC_DIR))
    result.add_argument("--refresh-boundaries", action="store_true")
    result.add_argument("--batch-size", type=int, default=100)
    result.add_argument("--workers", type=int, default=4)
    return result


if __name__ == "__main__":
    raise SystemExit(run(parser().parse_args()))
