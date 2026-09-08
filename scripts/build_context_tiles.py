#!/usr/bin/env python3
"""Empaqueta capas territoriales de contexto en un PMTiles reproducible."""

from __future__ import annotations

import argparse
import gzip
import hashlib
import json
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

try:
    from pyproj import Transformer
    from shapely.geometry import LineString, MultiLineString, Point, Polygon, mapping
    from shapely.ops import transform, unary_union
except ImportError as error:
    raise RuntimeError("Instale requirements-tiles.txt para construir las teselas") from error


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_OUTPUT = ROOT / "public" / "data" / "context-layers.pmtiles"
DEFAULT_METADATA = ROOT / "public" / "data" / "context-layers.json"
ANLA_CONFIG = {
    1: ("evaluacion", "linea"),
    2: ("evaluacion", "poligono"),
    4: ("licenciado", "punto"),
    5: ("licenciado", "linea"),
    6: ("licenciado", "poligono"),
}
ANLA_SECTORS = {
    "101": "Hidrocarburos",
    "102": "Infraestructura",
    "103": "Minería",
    "104": "Energía",
    "105": "Agroquímicos",
    "106": "Proyectos Especiales",
}


def clean(value: object) -> str:
    return "" if value is None else str(value).strip()


def read_gzip_json(path: Path) -> dict[str, object]:
    with gzip.open(path, "rt", encoding="utf-8") as stream:
        value = json.load(stream)
    if not isinstance(value, dict):
        raise RuntimeError(f"contenido inesperado en {path}")
    return value


def signed_ring_area(ring: list[list[float]]) -> float:
    return sum(
        float(a[0]) * float(b[1]) - float(b[0]) * float(a[1])
        for a, b in zip(ring, ring[1:] + ring[:1])
    ) / 2


def arcgis_polygon(rings: list[list[list[float]]]):
    usable = [ring for ring in rings if len(ring) >= 4]
    if not usable:
        return None
    outers = [ring for ring in usable if signed_ring_area(ring) < 0]
    holes = [ring for ring in usable if signed_ring_area(ring) >= 0]
    if not outers:
        ordered = sorted(usable, key=lambda ring: abs(signed_ring_area(ring)), reverse=True)
        outers, holes = ordered[:1], ordered[1:]
    polygons = []
    unassigned = holes.copy()
    for outer in outers:
        shell = Polygon(outer)
        included = [hole for hole in unassigned if shell.covers(Polygon(hole).representative_point())]
        unassigned = [hole for hole in unassigned if hole not in included]
        polygon = Polygon(outer, included)
        polygons.append(polygon if polygon.is_valid else polygon.buffer(0))
    polygons.extend(Polygon(ring) for ring in unassigned)
    merged = polygons[0] if len(polygons) == 1 else unary_union(polygons)
    return merged if merged.is_valid else merged.buffer(0)


def arcgis_shape(geometry_type: str, geometry: dict[str, object]):
    if geometry_type == "punto":
        return Point(float(geometry["x"]), float(geometry["y"]))
    if geometry_type == "linea":
        paths = geometry.get("paths", [])
        if not isinstance(paths, list) or not paths:
            return None
        return LineString(paths[0]) if len(paths) == 1 else MultiLineString(paths)
    rings = geometry.get("rings", [])
    return arcgis_polygon(rings) if isinstance(rings, list) else None


def geojson_feature(geometry: dict[str, object], properties: dict[str, object], identifier: object):
    return {"type": "Feature", "id": clean(identifier), "properties": properties, "geometry": geometry}


def runap_features(data_dir: Path) -> Iterable[dict[str, object]]:
    collection = read_gzip_json(data_dir / "boundaries" / "runap_join.geojson.gz")
    for feature in collection.get("features", []):
        properties = feature.get("properties", {})
        geometry = feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue
        yield geojson_feature(geometry, {
            "nombre": clean(properties.get("ap_nombre")),
            "categoria": clean(properties.get("ap_categoria")),
            "condicion": clean(properties.get("condicion")),
            "organizacion": clean(properties.get("organizacion")),
        }, properties.get("ap_id"))


def anm_features(data_dir: Path) -> Iterable[dict[str, object]]:
    collection = read_gzip_json(data_dir / "boundaries" / "anm_titles_join.geojson.gz")
    for feature in collection.get("features", []):
        properties = feature.get("properties", {})
        geometry = feature.get("geometry")
        if not isinstance(properties, dict) or not isinstance(geometry, dict):
            continue
        yield geojson_feature(geometry, {
            "codigo": clean(properties.get("codigo_exp")),
            "minerales": clean(properties.get("minerales")),
            "etapa": clean(properties.get("etapa")),
            "tipo": clean(properties.get("tipo_explo")),
            "municipios": clean(properties.get("municipios")),
            "departamento": clean(properties.get("departamento")),
            "area_ha": properties.get("area_ha"),
        }, properties.get("fid"))


def anla_features(data_dir: Path, transformer: Transformer) -> Iterable[dict[str, object]]:
    collection = read_gzip_json(data_dir / "boundaries" / "anla_projects_join.json.gz")
    layers = collection.get("layers", {})
    if not isinstance(layers, dict):
        return
    for raw_layer, features in layers.items():
        layer_id = int(raw_layer)
        legal_status, geometry_type = ANLA_CONFIG[layer_id]
        if not isinstance(features, list):
            continue
        for feature in features:
            attributes = feature.get("attributes", {})
            geometry = feature.get("geometry", {})
            if not isinstance(attributes, dict) or not isinstance(geometry, dict):
                continue
            projected = arcgis_shape(geometry_type, geometry)
            if projected is None or projected.is_empty:
                continue
            converted = transform(transformer.transform, projected)
            sector_code = clean(attributes.get("sector")).removesuffix(".0")
            yield geojson_feature(mapping(converted), {
                "expediente": clean(attributes.get("expediente")),
                "proyecto": clean(attributes.get("proyecto")),
                "operador": clean(attributes.get("operador")),
                "sector": ANLA_SECTORS.get(sector_code, sector_code),
                "situacion": legal_status,
                "geometria": geometry_type,
                "estado": clean(attributes.get("estado")),
            }, attributes.get("objectid") or attributes.get("globalid") or attributes.get("globalid_1"))


def anh_features(data_dir: Path, transformer: Transformer) -> Iterable[dict[str, object]]:
    collection = read_gzip_json(data_dir / "boundaries" / "anh_tierras_join.json.gz")
    for feature in collection.get("features", []):
        attributes = feature.get("attributes", {})
        geometry = feature.get("geometry", {})
        if not isinstance(attributes, dict) or not isinstance(geometry, dict):
            continue
        if clean(attributes.get("CLASIFICAC")) != "ASIGNADA":
            continue
        projected = arcgis_shape("poligono", geometry)
        if projected is None or projected.is_empty:
            continue
        converted = transform(transformer.transform, projected)
        yield geojson_feature(mapping(converted), {
            "contrato": clean(attributes.get("CONTRATO_N")),
            "area": clean(attributes.get("AREA_NOMBR")),
            "operador": clean(attributes.get("OPERADOR")),
            "estado": clean(attributes.get("ESTAD_AREA")),
            "tipo": clean(attributes.get("TIPO_CONTR")),
            "cuenca": clean(attributes.get("CUENCA_SED")),
            "area_ha": attributes.get("AREA_HA"),
        }, attributes.get("OBJECTID"))


def write_sequence(path: Path, features: Iterable[dict[str, object]]) -> int:
    count = 0
    with path.open("w", encoding="utf-8") as stream:
        for feature in features:
            stream.write(json.dumps(feature, ensure_ascii=False, separators=(",", ":")) + "\n")
            count += 1
    return count


def build_tiles(data_dir: Path, output: Path, metadata_path: Path, tippecanoe: str) -> dict[str, object]:
    transformer = Transformer.from_crs("EPSG:9377", "EPSG:4326", always_xy=True)
    output.parent.mkdir(parents=True, exist_ok=True)
    metadata_path.parent.mkdir(parents=True, exist_ok=True)
    source_metadata = {
        name: json.loads((data_dir / "boundaries" / filename).read_text(encoding="utf-8"))
        for name, filename in {
            "runap": "runap_metadata.json",
            "anm": "anm_titles_metadata.json",
            "anla": "anla_projects_metadata.json",
            "anh": "anh_tierras_metadata.json",
        }.items()
    }
    with tempfile.TemporaryDirectory(prefix="context-tiles-") as directory:
        temporary = Path(directory)
        inputs = {
            "runap": (temporary / "runap.geojsonseq", runap_features(data_dir)),
            "anm": (temporary / "anm.geojsonseq", anm_features(data_dir)),
            "anla": (temporary / "anla.geojsonseq", anla_features(data_dir, transformer)),
            "anh": (temporary / "anh.geojsonseq", anh_features(data_dir, transformer)),
        }
        counts = {name: write_sequence(path, features) for name, (path, features) in inputs.items()}
        temporary_output = temporary / "context-layers.pmtiles"
        command = [
            tippecanoe,
            f"--output={temporary_output}",
            "--force",
            "--projection=EPSG:4326",
            "--minimum-zoom=3",
            "--maximum-zoom=14",
            "--extend-zooms-if-still-dropping",
            "--extend-zooms-if-still-dropping-maximum=16",
            "--drop-smallest-as-needed",
            "--detect-shared-borders",
            "--read-parallel",
            "--generate-ids",
            "--no-progress-indicator",
            "--name=Contexto territorial del dashboard de detecciones de calor",
            "--description=RUNAP, títulos ANM, proyectos ANLA y áreas asignadas ANH",
            "--attribution=PNN · ANM · ANLA · ANH",
        ]
        for name, (path, _) in inputs.items():
            command.extend(["--named-layer", f"{name}:{path}"])
        subprocess.run(command, check=True)
        temporary_output.replace(output)

    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    source_counts = {name: int(details["featureCount"]) for name, details in source_metadata.items()}
    not_rendered = {name: source_counts[name] - counts[name] for name in counts}
    metadata = {
        "generatedAtUtc": datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z"),
        "format": "PMTiles v3",
        "featureCounts": counts,
        "sourceFeatureCounts": source_counts,
        "totalFeatures": sum(counts.values()),
        "notRendered": {
            "runap": {"count": not_rendered["runap"], "reason": "sin geometría dibujable"},
            "anm": {"count": not_rendered["anm"], "reason": "sin geometría dibujable"},
            "anla": {"count": not_rendered["anla"], "reason": "sin geometría dibujable"},
            "anh": {"count": not_rendered["anh"], "reason": "áreas no asignadas fuera del alcance visual"},
        },
        "sizeBytes": output.stat().st_size,
        "sha256": digest,
        "sources": source_metadata,
    }
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return metadata


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--metadata", type=Path, default=DEFAULT_METADATA)
    parser.add_argument("--tippecanoe", default=shutil.which("tippecanoe"))
    args = parser.parse_args()
    if not args.tippecanoe:
        raise RuntimeError("No se encontró tippecanoe; instálelo desde su repositorio oficial")
    metadata = build_tiles(args.data_dir, args.output, args.metadata, args.tippecanoe)
    print(json.dumps({
        "output": str(args.output),
        "featureCounts": metadata["featureCounts"],
        "sizeBytes": metadata["sizeBytes"],
        "sha256": metadata["sha256"],
    }, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
