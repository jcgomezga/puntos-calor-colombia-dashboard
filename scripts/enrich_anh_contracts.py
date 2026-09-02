#!/usr/bin/env python3
"""Relaciona hotspots con áreas contractuales asignadas del Mapa de Tierras ANH."""

from __future__ import annotations

import argparse
import csv
import gzip
import importlib.util
import json
import os
import re
import sys
import tempfile
import time
from collections import Counter
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from shapely.geometry import Point, box
from shapely.strtree import STRtree


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
DEFAULT_PUBLIC_DIR = ROOT / "public" / "data"
ANH_SERVICE = (
    "https://geovisor.anh.gov.co/server/rest/services/GEOVISOR_v32/"
    "ANH_HISTORICOS1_EGDB/MapServer"
)
LAYER_PATTERN = re.compile(r"^Tierras (\d{4}-\d{2}-\d{2})$")
ANH_FIELDS = (
    "OBJECTID,CONTRAT_ID,CONTRATO_N,AREA_NOMBR,FECHA_FIRM,CLASIFICAC,"
    "TIPO_CONTR,ESTAD_AREA,SUBTIPO,OPERADOR,OPR_ABR,AREA_HA,CUENCA_SED,"
    "SUPERFICIE,YACIMIENTO,PROCESO,LEYENDA,URL_MINUTA,ID_GECOH"
)
MAX_RELATION_DISTANCE_M = 5_000
ANH_OUTPUT_FIELDS = [
    "anh_clase_minima", "anh_distancia_min_m", "anh_relaciones_count",
    "anh_contratos_ids", "anh_contratos_numeros", "anh_areas_nombres",
    "anh_operadores", "anh_estados", "anh_tipos_contrato",
]
RELATION_FIELDS = [
    "hotspot_id", "feature_id", "contrat_id", "contrato", "area_nombre",
    "operador", "estado_area", "tipo_contrato", "cuenca", "proceso",
    "distancia_m", "clase_espacial",
]


def load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"no fue posible cargar {filename}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


HELPERS = load_module("territorialize_hotspots.py", "anh_helpers")
SPATIAL = load_module("enrich_anla_projects.py", "anh_spatial")


@dataclass(frozen=True)
class AnhArea:
    feature_id: str
    contract_id: str
    contract_number: str
    area_name: str
    operator: str
    area_status: str
    contract_type: str
    basin: str
    process: str
    classification: str
    geometry: dict[str, object]


@dataclass(frozen=True)
class AnhRelation:
    area: AnhArea
    distance_m: float
    spatial_class: str


def clean(value: object) -> str:
    return "" if value is None else str(value).strip()


def resilient_json(url: str, params: dict[str, str], timeout: int, attempts: int = 5):
    last_error = None
    for attempt in range(attempts):
        try:
            return HELPERS.curl_json(url, params, timeout=timeout)
        except RuntimeError as error:
            last_error = error
            if attempt + 1 < attempts:
                delay = min(5 * (2**attempt), 60)
                print(f"ANH reintento {attempt + 2}/{attempts} en {delay}s: {error}", flush=True)
                time.sleep(delay)
    raise RuntimeError(f"ANH agotó {attempts} intentos: {last_error}")


def latest_layer(service_metadata: dict[str, object]) -> tuple[int, str]:
    candidates = []
    for layer in service_metadata.get("layers", []):
        match = LAYER_PATTERN.match(clean(layer.get("name")))
        if match:
            candidates.append((match.group(1), int(layer["id"])))
    if not candidates:
        raise RuntimeError("ANH no publicó capas con nombre Tierras AAAA-MM-DD")
    date, layer_id = max(candidates)
    return layer_id, date


def discover_latest() -> tuple[int, str]:
    return latest_layer(resilient_json(ANH_SERVICE, {"f": "json"}, timeout=90))


def download_layer(layer_id: int, layer_date: str, batch_size: int, workers: int):
    layer_url = f"{ANH_SERVICE}/{layer_id}"
    metadata = resilient_json(layer_url, {"f": "json"}, timeout=90)
    ids_payload = resilient_json(
        f"{layer_url}/query", {"where": "1=1", "returnIdsOnly": "true", "f": "json"}, timeout=90,
    )
    object_ids = sorted(int(value) for value in ids_payload.get("objectIds", []))
    if not object_ids:
        raise RuntimeError("ANH no devolvió identificadores")

    def fetch(ids: list[int]):
        try:
            payload = resilient_json(f"{layer_url}/query", {
                "objectIds": ",".join(map(str, ids)), "outFields": ANH_FIELDS,
                "returnGeometry": "true", "outSR": "9377", "returnZ": "false",
                "maxAllowableOffset": "2", "f": "json",
            }, timeout=120, attempts=3)
            return payload.get("features", [])
        except RuntimeError:
            if len(ids) == 1:
                raise
            middle = len(ids) // 2
            return fetch(ids[:middle]) + fetch(ids[middle:])

    batches = list(HELPERS.chunks(object_ids, batch_size))
    features = []
    with ThreadPoolExecutor(max_workers=min(workers, len(batches))) as executor:
        futures = [executor.submit(fetch, ids) for ids in batches]
        for position, future in enumerate(as_completed(futures), start=1):
            features.extend(future.result())
            print(f"ANH: {position}/{len(futures)} lotes", flush=True)
    if len(features) != len(object_ids):
        raise RuntimeError(f"cierre ANH fallido: {len(features)} geometrías para {len(object_ids)} IDs")
    features.sort(key=lambda feature: int(feature.get("attributes", {}).get("OBJECTID", 0)))
    classifications = Counter(clean(feature.get("attributes", {}).get("CLASIFICAC")) for feature in features)
    audit = {
        "source": "Mapa de Tierras ANH", "authority": "Agencia Nacional de Hidrocarburos (ANH)",
        "url": layer_url, "serviceUrl": ANH_SERVICE, "sourceLayerId": layer_id,
        "sourceDate": layer_date, "layerName": metadata.get("name"),
        "featureCount": len(features), "assignedFeatureCount": classifications["ASIGNADA"],
        "reservedFeatureCount": classifications["RESERVADA"],
        "availableFeatureCount": classifications["DISPONIBLE"],
        "spatialReference": 9377, "maxAllowableOffsetMeters": 2,
        "downloadedAtUtc": HELPERS.utc_now_iso(),
    }
    return {"spatialReference": {"wkid": 9377}, "features": features}, audit


def cache_is_fresh(metadata: dict[str, object], layer_id: int, max_hours: float) -> bool:
    if max_hours <= 0 or int(metadata.get("sourceLayerId", -1)) != layer_id:
        return False
    try:
        downloaded = datetime.fromisoformat(clean(metadata["downloadedAtUtc"]).replace("Z", "+00:00"))
        return (datetime.now(timezone.utc) - downloaded).total_seconds() < max_hours * 3600
    except (KeyError, TypeError, ValueError):
        return False


def save_cache(data_dir: Path, collection: dict[str, object], audit: dict[str, object]) -> None:
    boundary_dir = data_dir / "boundaries"
    boundary_dir.mkdir(parents=True, exist_ok=True)
    HELPERS.save_gzip(boundary_dir / "anh_tierras_join.json.gz", collection)
    HELPERS.atomic_write(boundary_dir / "anh_tierras_metadata.json", HELPERS.json_bytes(audit, pretty=True))


def load_or_download(data_dir: Path, refresh: bool, max_cache_hours: float, batch_size: int, workers: int):
    layer_id, layer_date = discover_latest()
    cache = data_dir / "boundaries" / "anh_tierras_join.json.gz"
    metadata_path = data_dir / "boundaries" / "anh_tierras_metadata.json"
    if cache.exists() and metadata_path.exists() and not refresh:
        metadata = json.loads(metadata_path.read_text(encoding="utf-8"))
        if cache_is_fresh(metadata, layer_id, max_cache_hours):
            with gzip.open(cache, "rt", encoding="utf-8") as stream:
                return json.load(stream), metadata
    collection, audit = download_layer(layer_id, layer_date, batch_size, workers)
    save_cache(data_dir, collection, audit)
    return collection, audit


def assigned_records(collection: dict[str, object]) -> list[AnhArea]:
    records = []
    for feature in collection.get("features", []):
        attributes, geometry = feature.get("attributes"), feature.get("geometry")
        if not isinstance(attributes, dict) or not isinstance(geometry, dict):
            continue
        if clean(attributes.get("CLASIFICAC")) != "ASIGNADA" or not geometry.get("rings"):
            continue
        records.append(AnhArea(
            feature_id=clean(attributes.get("OBJECTID")), contract_id=clean(attributes.get("CONTRAT_ID")),
            contract_number=clean(attributes.get("CONTRATO_N")), area_name=clean(attributes.get("AREA_NOMBR")),
            operator=clean(attributes.get("OPERADOR")), area_status=clean(attributes.get("ESTAD_AREA")),
            contract_type=clean(attributes.get("TIPO_CONTR")), basin=clean(attributes.get("CUENCA_SED")),
            process=clean(attributes.get("PROCESO")), classification=clean(attributes.get("CLASIFICAC")),
            geometry=geometry,
        ))
    if not records:
        raise RuntimeError("ANH no contiene áreas contractuales asignadas utilizables")
    return records


def build_index(records: list[AnhArea]):
    shapes = [SPATIAL.polygon_shape(record.geometry["rings"]) for record in records]
    return shapes, STRtree(shapes)


def relations_for_point(longitude: float, latitude: float, records: list[AnhArea], shapes, index):
    px, py = SPATIAL.project_epsg9377(longitude, latitude)
    point = Point(px, py)
    candidates = index.query(box(
        px - MAX_RELATION_DISTANCE_M, py - MAX_RELATION_DISTANCE_M,
        px + MAX_RELATION_DISTANCE_M, py + MAX_RELATION_DISTANCE_M,
    ))
    relations = []
    for value in candidates:
        position = int(value)
        distance = float(shapes[position].distance(point))
        if distance <= MAX_RELATION_DISTANCE_M:
            spatial_class = SPATIAL.spatial_class("poligono", distance)
            relations.append(AnhRelation(records[position], distance, spatial_class))
    rank = {"dentro": 0, "hasta_1_km": 1, "entre_1_y_5_km": 2}
    return sorted(relations, key=lambda item: (rank[item.spatial_class], item.distance_m, item.area.feature_id))


def atomic_csv(path: Path, fields: list[str], rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=path.parent) as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def relation_row(hotspot_id: str, relation: AnhRelation):
    area = relation.area
    return {
        "hotspot_id": hotspot_id, "feature_id": area.feature_id, "contrat_id": area.contract_id,
        "contrato": area.contract_number, "area_nombre": area.area_name, "operador": area.operator,
        "estado_area": area.area_status, "tipo_contrato": area.contract_type, "cuenca": area.basin,
        "proceso": area.process, "distancia_m": f"{relation.distance_m:.2f}",
        "clase_espacial": relation.spatial_class,
    }


def enrich(data_dir: Path, public_dir: Path, records: list[AnhArea], audit: dict[str, object]):
    shapes, index = build_index(records)
    statuses, relation_rows, related_areas = Counter(), [], set()
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            fields = [field for field in (reader.fieldnames or []) if field not in ANH_OUTPUT_FIELDS] + ANH_OUTPUT_FIELDS
            output = []
            for source_row in reader:
                row = {key: value for key, value in source_row.items() if key not in ANH_OUTPUT_FIELDS}
                relations = relations_for_point(float(row["longitud"]), float(row["latitud"]), records, shapes, index)
                closest_class = relations[0].spatial_class if relations else "mas_de_5_km"
                statuses[closest_class] += 1
                if len(relations) > 1:
                    statuses["multiples"] += 1
                related_areas.update(item.area.feature_id for item in relations)
                relation_rows.extend(relation_row(row["hotspot_id"], item) for item in relations)
                unique = lambda values: "|".join(dict.fromkeys(value for value in values if value))
                row.update({
                    "anh_clase_minima": closest_class,
                    "anh_distancia_min_m": f"{relations[0].distance_m:.2f}" if relations else "",
                    "anh_relaciones_count": str(len(relations)),
                    "anh_contratos_ids": unique(item.area.contract_id for item in relations),
                    "anh_contratos_numeros": unique(item.area.contract_number for item in relations),
                    "anh_areas_nombres": unique(item.area.area_name for item in relations),
                    "anh_operadores": unique(item.area.operator for item in relations),
                    "anh_estados": unique(item.area.area_status for item in relations),
                    "anh_tipos_contrato": unique(item.area.contract_type for item in relations),
                })
                output.append(row)
        atomic_csv(source, fields, output)

    atomic_csv(data_dir / "anh" / "hotspot_contract_relations.csv", RELATION_FIELDS, relation_rows)
    territorial_rows = []
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            territorial_rows.extend(csv.DictReader(stream))
    dashboard_path = public_dir / "dashboard.json"
    dashboard = json.loads(dashboard_path.read_text(encoding="utf-8"))
    if len(territorial_rows) != len(dashboard["points"]):
        raise RuntimeError("el orden territorial no cierra con dashboard.json para ANH")
    relation_codes = {"mas_de_5_km": 0, "entre_1_y_5_km": 1, "hasta_1_km": 2, "dentro": 3}
    for point, row in zip(dashboard["points"], territorial_rows, strict=True):
        while len(point) > 16:
            point.pop()
        point.append(relation_codes[row["anh_clase_minima"]])
    dashboard["pointSchema"] = dashboard["pointSchema"][:16] + ["anhRelation"]
    dashboard["metadata"]["anhContracts"] = {
        **audit, "usableAssignedGeometryCount": len(records),
        "missingAssignedGeometryCount": audit["assignedFeatureCount"] - len(records),
        "excludedNonAssignedCount": audit["featureCount"] - audit["assignedFeatureCount"],
        "insideRows": statuses["dentro"], "within1KmRows": statuses["hasta_1_km"],
        "between1And5KmRows": statuses["entre_1_y_5_km"], "beyond5KmRows": statuses["mas_de_5_km"],
        "multipleRelationRows": statuses["multiples"], "relationRows": len(relation_rows),
        "relatedAssignedAreas": len(related_areas),
    }
    if sum(statuses[key] for key in ("dentro", "hasta_1_km", "entre_1_y_5_km", "mas_de_5_km")) != len(dashboard["points"]):
        raise RuntimeError("cierre de contratos ANH fallido")
    HELPERS.atomic_write(dashboard_path, HELPERS.json_bytes(dashboard))
    return dashboard, dict(statuses)


def run(args: argparse.Namespace) -> int:
    data_dir, public_dir = Path(args.data_dir), Path(args.public_dir)
    collection, audit = load_or_download(
        data_dir, args.refresh_boundaries, args.max_cache_hours, args.batch_size, args.workers,
    )
    records = assigned_records(collection)
    dashboard, statuses = enrich(data_dir, public_dir, records, audit)
    report = {
        "finishedAtUtc": HELPERS.utc_now_iso(), "status": "completed", "source": audit,
        "relations": statuses, "dashboardRows": len(dashboard["points"]),
        "relationRows": dashboard["metadata"]["anhContracts"]["relationRows"],
    }
    HELPERS.atomic_write(data_dir / "metadata" / "anh_latest_run.json", HELPERS.json_bytes(report, pretty=True))
    print(json.dumps(report, ensure_ascii=False, indent=2))
    return 0


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    result.add_argument("--data-dir", default=str(DEFAULT_DATA_DIR))
    result.add_argument("--public-dir", default=str(DEFAULT_PUBLIC_DIR))
    result.add_argument("--refresh-boundaries", action="store_true")
    result.add_argument("--max-cache-hours", type=float, default=24)
    result.add_argument("--batch-size", type=int, default=100)
    result.add_argument("--workers", type=int, default=5)
    return result


if __name__ == "__main__":
    raise SystemExit(run(parser().parse_args()))
