#!/usr/bin/env python3
"""Descarga proyectos ANLA y calcula relaciones espaciales reproducibles."""

from __future__ import annotations

import gzip
import importlib.util
import csv
import json
import math
import os
import sys
import tempfile
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

try:
    from shapely.geometry import LineString, MultiLineString, Point, Polygon, box
    from shapely.ops import unary_union
    from shapely.strtree import STRtree
except ImportError as error:
    raise RuntimeError("Shapely es obligatorio: instale requirements-data.txt") from error


ROOT = Path(__file__).resolve().parents[1]
ANLA_SERVICE = (
    "https://portalsig.anla.gov.co/publico/rest/services/"
    "PROYECTOS_ANLA/ProyectosANLA/FeatureServer"
)
ANLA_FIELDS = (
    "objectid,globalid,globalid_1,expediente,sector,operador,proyecto,"
    "num_act_ad,fec_act_ad,art_act_ad,contrato,descrip,nomenclat,observ,"
    "area_ha,longitud_m,tipo_infra,estado"
)
LAYER_CONFIG = {
    1: ("evaluacion", "linea"),
    2: ("evaluacion", "poligono"),
    4: ("licenciado", "punto"),
    5: ("licenciado", "linea"),
    6: ("licenciado", "poligono"),
}
SECTOR_NAMES = {
    "101": "Hidrocarburos", "102": "Infraestructura", "103": "Minería",
    "104": "Energía", "105": "Agroquímicos", "106": "Proyectos Especiales",
}
GRID_SIZE_M = 25_000
MAX_RELATION_DISTANCE_M = 5_000
ANLA_OUTPUT_FIELDS = [
    "anla_clase_minima", "anla_distancia_min_m", "anla_relaciones_count",
    "anla_evaluacion_count", "anla_licenciado_count", "anla_expedientes",
    "anla_proyectos", "anla_operadores", "anla_geometrias",
]
RELATION_FIELDS = [
    "hotspot_id", "layer_id", "feature_id", "expediente", "proyecto", "operador",
    "sector", "situacion_juridica", "tipo_geometria", "acto_administrativo",
    "distancia_m", "clase_espacial",
]


def load_helpers():
    path = ROOT / "scripts" / "territorialize_hotspots.py"
    spec = importlib.util.spec_from_file_location("anla_helpers", path)
    if spec is None or spec.loader is None:
        raise RuntimeError("no fue posible cargar las utilidades territoriales")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


HELPERS = load_helpers()


@dataclass(frozen=True)
class AnlaProject:
    layer_id: int
    feature_id: str
    proceeding: str
    project: str
    operator: str
    sector: str
    legal_status: str
    geometry_type: str
    administrative_act: str
    geometry: dict[str, object]


@dataclass(frozen=True)
class ProjectRelation:
    project: AnlaProject
    distance_m: float
    spatial_class: str


def clean(value: object) -> str:
    return "" if value is None else str(value).strip()


def sector_name(value: object) -> str:
    raw = clean(value)
    code = raw[:-2] if raw.endswith(".0") else raw
    return SECTOR_NAMES.get(code, raw)


def resilient_json(url: str, params: dict[str, str], timeout: int, attempts: int = 5):
    last_error = None
    for attempt in range(attempts):
        try:
            return HELPERS.curl_json(url, params, timeout=timeout)
        except RuntimeError as error:
            last_error = error
            if attempt + 1 < attempts:
                delay = min(5 * (2**attempt), 60)
                print(f"ANLA reintento {attempt + 2}/{attempts} en {delay}s: {error}", flush=True)
                time.sleep(delay)
    raise RuntimeError(f"ANLA agotó {attempts} intentos: {last_error}")


def project_epsg9377(longitude: float, latitude: float) -> tuple[float, float]:
    """Proyección Transverse Mercator MAGNA-SIRGAS / Origen-Nacional."""
    a = 6378137.0
    inv_f = 298.257222101
    f = 1.0 / inv_f
    e2 = f * (2.0 - f)
    ep2 = e2 / (1.0 - e2)
    k0, lon0, lat0 = 0.9992, math.radians(-73.0), math.radians(4.0)
    false_easting, false_northing = 5_000_000.0, 2_000_000.0
    lon, lat = math.radians(longitude), math.radians(latitude)

    def meridional(phi: float) -> float:
        return a * (
            (1 - e2 / 4 - 3 * e2**2 / 64 - 5 * e2**3 / 256) * phi
            - (3 * e2 / 8 + 3 * e2**2 / 32 + 45 * e2**3 / 1024) * math.sin(2 * phi)
            + (15 * e2**2 / 256 + 45 * e2**3 / 1024) * math.sin(4 * phi)
            - (35 * e2**3 / 3072) * math.sin(6 * phi)
        )

    n = a / math.sqrt(1 - e2 * math.sin(lat) ** 2)
    t = math.tan(lat) ** 2
    c = ep2 * math.cos(lat) ** 2
    aa = math.cos(lat) * (lon - lon0)
    m, m0 = meridional(lat), meridional(lat0)
    x = false_easting + k0 * n * (
        aa + (1 - t + c) * aa**3 / 6
        + (5 - 18 * t + t**2 + 72 * c - 58 * ep2) * aa**5 / 120
    )
    y = false_northing + k0 * (
        m - m0 + n * math.tan(lat) * (
            aa**2 / 2
            + (5 - t + 9 * c + 4 * c**2) * aa**4 / 24
            + (61 - 58 * t + t**2 + 600 * c - 330 * ep2) * aa**6 / 720
        )
    )
    return x, y


def point_segment_distance(px: float, py: float, a: list[float], b: list[float]) -> float:
    ax, ay, bx, by = float(a[0]), float(a[1]), float(b[0]), float(b[1])
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    ratio = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    return math.hypot(px - (ax + ratio * dx), py - (ay + ratio * dy))


def path_distance(px: float, py: float, path: list[list[float]]) -> float:
    if len(path) == 1:
        return math.hypot(px - path[0][0], py - path[0][1])
    return min(point_segment_distance(px, py, a, b) for a, b in zip(path, path[1:]))


def ring_location(px: float, py: float, ring: list[list[float]]) -> int:
    """Devuelve 0 fuera, 1 dentro y 2 en el borde."""
    inside = False
    for a, b in zip(ring, ring[1:] + ring[:1]):
        if point_segment_distance(px, py, a, b) <= 1e-7:
            return 2
        ax, ay, bx, by = a[0], a[1], b[0], b[1]
        if (ay > py) != (by > py):
            cross_x = (bx - ax) * (py - ay) / (by - ay) + ax
            if px < cross_x:
                inside = not inside
    return 1 if inside else 0


def geometry_distance(px: float, py: float, geometry_type: str, geometry: dict[str, object]) -> float:
    if geometry_type == "punto":
        return math.hypot(px - float(geometry["x"]), py - float(geometry["y"]))
    if geometry_type == "linea":
        paths = geometry.get("paths", [])
        return min(path_distance(px, py, path) for path in paths)
    rings = geometry.get("rings", [])
    locations = [ring_location(px, py, ring) for ring in rings]
    if 2 in locations or sum(value == 1 for value in locations) % 2 == 1:
        return 0.0
    return min(path_distance(px, py, ring + [ring[0]]) for ring in rings)


def spatial_class(geometry_type: str, distance_m: float) -> str:
    if geometry_type == "poligono" and distance_m <= 1e-7:
        return "dentro"
    if distance_m <= 1_000:
        return "hasta_1_km"
    if distance_m <= 5_000:
        return "entre_1_y_5_km"
    return "mas_de_5_km"


def project_records(payload: dict[str, object], layer_id: int) -> list[AnlaProject]:
    legal_status, geometry_type = LAYER_CONFIG[layer_id]
    records = []
    for feature in payload.get("features", []):
        attributes, geometry = feature.get("attributes"), feature.get("geometry")
        if not isinstance(attributes, dict) or not isinstance(geometry, dict):
            continue
        if geometry_type == "punto" and (geometry.get("x") is None or geometry.get("y") is None):
            continue
        coordinate_groups = geometry.get("paths" if geometry_type == "linea" else "rings", [])
        if geometry_type != "punto" and not coordinate_groups:
            continue
        records.append(AnlaProject(
            layer_id=layer_id,
            feature_id=clean(attributes.get("globalid") or attributes.get("globalid_1") or attributes.get("objectid")),
            proceeding=clean(attributes.get("expediente")),
            project=clean(attributes.get("proyecto")),
            operator=clean(attributes.get("operador")),
            sector=sector_name(attributes.get("sector")),
            legal_status=legal_status,
            geometry_type=geometry_type,
            administrative_act=clean(attributes.get("num_act_ad")),
            geometry=geometry,
        ))
    return records


def relations_for_point(longitude: float, latitude: float, records: list[AnlaProject]) -> list[ProjectRelation]:
    px, py = project_epsg9377(longitude, latitude)
    relations = []
    for record in records:
        distance = geometry_distance(px, py, record.geometry_type, record.geometry)
        if distance <= 5_000:
            relations.append(ProjectRelation(record, distance, spatial_class(record.geometry_type, distance)))
    rank = {"dentro": 0, "hasta_1_km": 1, "entre_1_y_5_km": 2}
    return sorted(relations, key=lambda item: (rank[item.spatial_class], item.distance_m, item.project.feature_id))


def geometry_bbox(geometry_type: str, geometry: dict[str, object]) -> tuple[float, float, float, float]:
    if geometry_type == "punto":
        x, y = float(geometry["x"]), float(geometry["y"])
        return x, y, x, y
    groups = geometry.get("paths" if geometry_type == "linea" else "rings", [])
    coordinates = [point for group in groups for point in group]
    if not coordinates:
        raise ValueError("geometría ANLA vacía")
    xs, ys = [float(point[0]) for point in coordinates], [float(point[1]) for point in coordinates]
    return min(xs), min(ys), max(xs), max(ys)


def build_grid(records: list[AnlaProject]):
    index = defaultdict(list)
    for position, record in enumerate(records):
        min_x, min_y, max_x, max_y = geometry_bbox(record.geometry_type, record.geometry)
        min_x -= MAX_RELATION_DISTANCE_M; min_y -= MAX_RELATION_DISTANCE_M
        max_x += MAX_RELATION_DISTANCE_M; max_y += MAX_RELATION_DISTANCE_M
        for x in range(math.floor(min_x / GRID_SIZE_M), math.floor(max_x / GRID_SIZE_M) + 1):
            for y in range(math.floor(min_y / GRID_SIZE_M), math.floor(max_y / GRID_SIZE_M) + 1):
                index[(x, y)].append(position)
    return dict(index)


def indexed_relations(px: float, py: float, records: list[AnlaProject], index) -> list[ProjectRelation]:
    candidates = index.get((math.floor(px / GRID_SIZE_M), math.floor(py / GRID_SIZE_M)), [])
    relations = []
    for position in candidates:
        record = records[position]
        distance = geometry_distance(px, py, record.geometry_type, record.geometry)
        if distance <= MAX_RELATION_DISTANCE_M:
            relations.append(ProjectRelation(record, distance, spatial_class(record.geometry_type, distance)))
    rank = {"dentro": 0, "hasta_1_km": 1, "entre_1_y_5_km": 2}
    return sorted(relations, key=lambda item: (rank[item.spatial_class], item.distance_m, item.project.feature_id))


def signed_ring_area(ring: list[list[float]]) -> float:
    return sum(
        float(a[0]) * float(b[1]) - float(b[0]) * float(a[1])
        for a, b in zip(ring, ring[1:] + ring[:1])
    ) / 2


def polygon_shape(rings: list[list[list[float]]]):
    usable = [ring for ring in rings if len(ring) >= 4]
    if not usable:
        raise ValueError("polígono ANLA sin anillos utilizables")
    outers = [ring for ring in usable if signed_ring_area(ring) < 0]
    holes = [ring for ring in usable if signed_ring_area(ring) >= 0]
    if not outers:
        ordered = sorted(usable, key=lambda ring: abs(signed_ring_area(ring)), reverse=True)
        outers, holes = ordered[:1], ordered[1:]
    polygons = []
    unassigned = holes.copy()
    for outer in outers:
        shell = Polygon(outer)
        included = []
        for hole in unassigned:
            if shell.covers(Polygon(hole).representative_point()):
                included.append(hole)
        unassigned = [hole for hole in unassigned if hole not in included]
        polygon = Polygon(outer, included)
        polygons.append(polygon if polygon.is_valid else polygon.buffer(0))
    polygons.extend(Polygon(ring) for ring in unassigned)
    merged = polygons[0] if len(polygons) == 1 else unary_union(polygons)
    return merged if merged.is_valid else merged.buffer(0)


def project_shape(record: AnlaProject):
    geometry = record.geometry
    if record.geometry_type == "punto":
        return Point(float(geometry["x"]), float(geometry["y"]))
    if record.geometry_type == "linea":
        paths = geometry["paths"]
        return LineString(paths[0]) if len(paths) == 1 else MultiLineString(paths)
    return polygon_shape(geometry["rings"])


def build_spatial_index(records: list[AnlaProject]):
    shapes = [project_shape(record) for record in records]
    return shapes, STRtree(shapes)


def spatial_relations(px: float, py: float, records: list[AnlaProject], shapes, index) -> list[ProjectRelation]:
    point = Point(px, py)
    candidates = index.query(box(
        px - MAX_RELATION_DISTANCE_M, py - MAX_RELATION_DISTANCE_M,
        px + MAX_RELATION_DISTANCE_M, py + MAX_RELATION_DISTANCE_M,
    ))
    relations = []
    for position_value in candidates:
        position = int(position_value)
        distance = float(shapes[position].distance(point))
        if distance <= MAX_RELATION_DISTANCE_M:
            record = records[position]
            relations.append(ProjectRelation(record, distance, spatial_class(record.geometry_type, distance)))
    rank = {"dentro": 0, "hasta_1_km": 1, "entre_1_y_5_km": 2}
    return sorted(relations, key=lambda item: (rank[item.spatial_class], item.distance_m, item.project.feature_id))


def download_projects(batch_size: int = 100, workers: int = 5):
    def download_layer(layer_id: int):
        layer_url = f"{ANLA_SERVICE}/{layer_id}"
        metadata = resilient_json(layer_url, {"f": "json"}, timeout=90)
        ids_payload = resilient_json(
            f"{layer_url}/query", {"where": "1=1", "returnIdsOnly": "true", "f": "json"}, timeout=90,
        )
        object_ids = sorted(int(value) for value in ids_payload.get("objectIds", []))
        available = {field.get("name") for field in metadata.get("fields", [])}
        requested = [field for field in ANLA_FIELDS.split(",") if field in available]
        def fetch(ids: list[int]):
            try:
                payload = resilient_json(f"{layer_url}/query", {
                "objectIds": ",".join(map(str, ids)), "outFields": ",".join(requested),
                "returnGeometry": "true", "outSR": "9377", "returnZ": "false",
                "maxAllowableOffset": "2", "f": "json",
                }, timeout=120, attempts=3)
                return payload.get("features", [])
            except RuntimeError:
                if len(ids) == 1:
                    raise
                middle = len(ids) // 2
                return fetch(ids[:middle]) + fetch(ids[middle:])

        features = []
        batches = list(HELPERS.chunks(object_ids, batch_size))
        with ThreadPoolExecutor(max_workers=min(workers, len(batches))) as layer_executor:
            futures = [layer_executor.submit(fetch, ids) for ids in batches]
            for position, future in enumerate(as_completed(futures), start=1):
                features.extend(future.result())
                if position % 10 == 0 or position == len(futures):
                    print(f"ANLA capa {layer_id}: {position}/{len(futures)} lotes", flush=True)
        if len(features) != len(object_ids):
            raise RuntimeError(f"cierre ANLA capa {layer_id}: {len(features)} geometrías para {len(object_ids)} IDs")
        return layer_id, features, {"name": metadata.get("name"), "count": len(features)}

    layer_payloads, audit_layers = {}, {}
    for layer_id in LAYER_CONFIG:
        downloaded_layer, features, audit = download_layer(layer_id)
        layer_payloads[str(downloaded_layer)] = features
        audit_layers[str(downloaded_layer)] = audit
    collection = {"spatialReference": {"wkid": 9377}, "layers": layer_payloads}
    audit = {
        "source": "Proyectos ANLA", "authority": "Autoridad Nacional de Licencias Ambientales",
        "url": ANLA_SERVICE, "featureCount": sum(item["count"] for item in audit_layers.values()),
        "spatialReference": 9377, "maxAllowableOffsetMeters": 2,
        "layers": audit_layers, "downloadedAtUtc": HELPERS.utc_now_iso(),
    }
    return collection, audit


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
    cache = data_dir / "boundaries" / "anla_projects_join.json.gz"
    metadata_path = data_dir / "boundaries" / "anla_projects_metadata.json"
    if cache.exists() and not refresh and cache_is_fresh(metadata_path, max_cache_hours):
        with gzip.open(cache, "rt", encoding="utf-8") as stream:
            return json.load(stream), json.loads(metadata_path.read_text(encoding="utf-8"))
    collection, audit = download_projects(batch_size, workers)
    save_cache(data_dir, collection, audit)
    return collection, audit


def all_project_records(collection: dict[str, object]) -> list[AnlaProject]:
    records = []
    for layer_id in LAYER_CONFIG:
        records.extend(project_records({"features": collection.get("layers", {}).get(str(layer_id), [])}, layer_id))
    if not records:
        raise RuntimeError("ANLA no contiene geometrías utilizables")
    return records


def atomic_csv(path: Path, fields: list[str], rows: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", newline="", delete=False, dir=path.parent) as stream:
        writer = csv.DictWriter(stream, fieldnames=fields)
        writer.writeheader(); writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def relation_row(hotspot_id: str, relation: ProjectRelation) -> dict[str, object]:
    project = relation.project
    return {
        "hotspot_id": hotspot_id, "layer_id": project.layer_id,
        "feature_id": project.feature_id, "expediente": project.proceeding,
        "proyecto": project.project, "operador": project.operator, "sector": project.sector,
        "situacion_juridica": project.legal_status, "tipo_geometria": project.geometry_type,
        "acto_administrativo": project.administrative_act,
        "distancia_m": f"{relation.distance_m:.2f}", "clase_espacial": relation.spatial_class,
    }


def enrich(data_dir: Path, public_dir: Path, records: list[AnlaProject], audit: dict[str, object]):
    shapes, index = build_spatial_index(records)
    statuses = Counter()
    relation_rows, related_projects = [], set()
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            fields = [field for field in (reader.fieldnames or []) if field not in ANLA_OUTPUT_FIELDS] + ANLA_OUTPUT_FIELDS
            output = []
            for source_row in reader:
                row = {key: value for key, value in source_row.items() if key not in ANLA_OUTPUT_FIELDS}
                px, py = project_epsg9377(float(row["longitud"]), float(row["latitud"]))
                relations = spatial_relations(px, py, records, shapes, index)
                closest_class = relations[0].spatial_class if relations else "mas_de_5_km"
                statuses[closest_class] += 1
                if len(relations) > 1:
                    statuses["multiples"] += 1
                evaluation = [item for item in relations if item.project.legal_status == "evaluacion"]
                licensed = [item for item in relations if item.project.legal_status == "licenciado"]
                if evaluation: statuses["con_evaluacion"] += 1
                if licensed: statuses["con_licenciado"] += 1
                related_projects.update((item.project.layer_id, item.project.feature_id) for item in relations)
                relation_rows.extend(relation_row(row["hotspot_id"], item) for item in relations)
                unique = lambda values: "|".join(dict.fromkeys(value for value in values if value))
                row.update({
                    "anla_clase_minima": closest_class,
                    "anla_distancia_min_m": f"{relations[0].distance_m:.2f}" if relations else "",
                    "anla_relaciones_count": str(len(relations)),
                    "anla_evaluacion_count": str(len(evaluation)),
                    "anla_licenciado_count": str(len(licensed)),
                    "anla_expedientes": unique(item.project.proceeding for item in relations),
                    "anla_proyectos": unique(item.project.project for item in relations),
                    "anla_operadores": unique(item.project.operator for item in relations),
                    "anla_geometrias": unique(item.project.geometry_type for item in relations),
                })
                output.append(row)
        atomic_csv(source, fields, output)

    atomic_csv(data_dir / "anla" / "hotspot_project_relations.csv", RELATION_FIELDS, relation_rows)
    territorial_rows = []
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            territorial_rows.extend(csv.DictReader(stream))
    dashboard_path = public_dir / "dashboard.json"
    dashboard = json.loads(dashboard_path.read_text(encoding="utf-8"))
    if len(territorial_rows) != len(dashboard["points"]):
        raise RuntimeError("el orden territorial no cierra con dashboard.json para ANLA")
    relation_codes = {"mas_de_5_km": 0, "entre_1_y_5_km": 1, "hasta_1_km": 2, "dentro": 3}
    for point, row in zip(dashboard["points"], territorial_rows, strict=True):
        while len(point) > 14:
            point.pop()
        point.append(relation_codes[row["anla_clase_minima"]])
        legal_mask = (1 if int(row["anla_evaluacion_count"]) else 0) | (2 if int(row["anla_licenciado_count"]) else 0)
        point.append(legal_mask)
    dashboard["pointSchema"] = dashboard["pointSchema"][:14] + ["anlaRelation", "anlaLegalStatus"]
    dashboard["metadata"]["anlaProjects"] = {
        **audit, "insideRows": statuses["dentro"], "within1KmRows": statuses["hasta_1_km"],
        "between1And5KmRows": statuses["entre_1_y_5_km"], "beyond5KmRows": statuses["mas_de_5_km"],
        "withEvaluationRows": statuses["con_evaluacion"], "withLicensedRows": statuses["con_licenciado"],
        "multipleRelationRows": statuses["multiples"], "relationRows": len(relation_rows),
        "relatedFeatures": len(related_projects),
    }
    if sum(statuses[key] for key in ("dentro", "hasta_1_km", "entre_1_y_5_km", "mas_de_5_km")) != len(dashboard["points"]):
        raise RuntimeError("cierre de proyectos ANLA fallido")
    HELPERS.atomic_write(dashboard_path, HELPERS.json_bytes(dashboard))
    return dashboard, dict(statuses)


def save_cache(data_dir: Path, collection: dict[str, object], audit: dict[str, object]) -> None:
    boundary_dir = data_dir / "boundaries"
    boundary_dir.mkdir(parents=True, exist_ok=True)
    with gzip.open(boundary_dir / "anla_projects_join.json.gz", "wt", encoding="utf-8") as stream:
        json.dump(collection, stream, ensure_ascii=False, separators=(",", ":"))
    HELPERS.atomic_write(boundary_dir / "anla_projects_metadata.json", HELPERS.json_bytes(audit, pretty=True))


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", default=str(ROOT / "data"))
    parser.add_argument("--batch-size", type=int, default=100)
    parser.add_argument("--workers", type=int, default=5)
    parser.add_argument("--refresh-boundaries", action="store_true")
    parser.add_argument("--max-cache-hours", type=float, default=24)
    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    downloaded, metadata = load_or_download(
        data_dir, args.refresh_boundaries, args.max_cache_hours, args.batch_size, args.workers,
    )
    records = all_project_records(downloaded)
    metadata["usableGeometryCount"] = len(records)
    metadata["nullGeometryCount"] = metadata["featureCount"] - len(records)
    HELPERS.atomic_write(
        data_dir / "boundaries" / "anla_projects_metadata.json",
        HELPERS.json_bytes(metadata, pretty=True),
    )
    dashboard, statuses = enrich(data_dir, ROOT / "public" / "data", records, metadata)
    report = {
        "finishedAtUtc": HELPERS.utc_now_iso(), "status": "completed", "source": metadata,
        "relations": statuses, "dashboardRows": len(dashboard["points"]),
        "relationRows": dashboard["metadata"]["anlaProjects"]["relationRows"],
    }
    HELPERS.atomic_write(data_dir / "metadata" / "anla_latest_run.json", HELPERS.json_bytes(report, pretty=True))
    print(json.dumps(report, ensure_ascii=False, indent=2))
