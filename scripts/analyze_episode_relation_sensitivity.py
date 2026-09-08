#!/usr/bin/env python3
"""Compara A/B a nivel de episodio frente a RUNAP, ANM, ANLA y ANH.

Este análisis es deliberadamente no operacional: no modifica el estado de episodios,
la identidad persistente de B ni dashboard.json. Reconstruye A y B con los mismos
umbrales adoptados (1 km, 24 h, mínimo 3 detecciones) y produce artefactos de
auditoría reproducibles.
"""

from __future__ import annotations

import csv
import importlib.util
import json
import math
import os
import sys
import tempfile
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DATA_DIR = ROOT / "data"
SPATIAL_METERS = 1_000
TEMPORAL_HOURS = 24
MIN_MEMBERS = 3
DOMAINS = ("runap", "anm", "anla", "anh")
DOMAIN_LABELS = {
    "runap": "RUNAP · dentro de área protegida",
    "anm": "ANM · dentro de título minero vigente",
    "anla": "ANLA · dentro o hasta 5 km",
    "anh": "ANH · dentro o hasta 5 km",
}


def load_module(filename: str, name: str):
    spec = importlib.util.spec_from_file_location(name, ROOT / "scripts" / filename)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"no fue posible cargar {filename}")
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


ANALYSIS = load_module("analyze_episode_sensitivity.py", "episode_relation_analysis")


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
        writer.writeheader()
        writer.writerows(rows)
        temporary = stream.name
    os.replace(temporary, path)


def pipe_values(row: dict[str, str], field: str) -> list[str]:
    return [value.strip() for value in row.get(field, "").split("|") if value.strip()]


def load_rows(data_dir: Path) -> dict[str, dict[str, str]]:
    rows: dict[str, dict[str, str]] = {}
    required = {
        "hotspot_id", "escenario_b", "en_area_protegida", "areas_protegidas_ids",
        "areas_protegidas_nombres", "en_titulo_minero", "titulos_mineros_codigos",
        "titulos_mineros_solicitantes", "anla_clase_minima", "anla_expedientes",
        "anla_proyectos", "anh_clase_minima", "anh_contratos_ids",
        "anh_contratos_numeros", "anh_areas_nombres",
    }
    for source in sorted((data_dir / "territorial").glob("hotspots_*.csv")):
        with source.open(encoding="utf-8", newline="") as stream:
            reader = csv.DictReader(stream)
            missing = required - set(reader.fieldnames or [])
            if missing:
                raise RuntimeError(f"{source.name} carece de campos requeridos: {sorted(missing)}")
            for row in reader:
                hotspot_id = row["hotspot_id"]
                if hotspot_id in rows:
                    raise RuntimeError(f"hotspot_id duplicado: {hotspot_id}")
                rows[hotspot_id] = row
    if not rows:
        raise RuntimeError("no existen hotspots territorializados")
    return rows


def robust_groups(points: list[object]) -> list[frozenset[str]]:
    ordered, groups, _ = ANALYSIS.connected_groups(points, SPATIAL_METERS, TEMPORAL_HOURS)
    robust: list[tuple[int, frozenset[str]]] = []
    for members in groups:
        if len(members) >= MIN_MEMBERS:
            robust.append((min(members), frozenset(ordered[position].hotspot_id for position in members)))
    robust.sort(key=lambda item: item[0])
    return [members for _, members in robust]


def relation_present(row: dict[str, str], domain: str) -> bool:
    if domain == "runap":
        return row.get("en_area_protegida") == "true"
    if domain == "anm":
        return row.get("en_titulo_minero") == "true"
    if domain == "anla":
        return row.get("anla_clase_minima") in {"dentro", "hasta_1_km", "entre_1_y_5_km"}
    if domain == "anh":
        return row.get("anh_clase_minima") in {"dentro", "hasta_1_km", "entre_1_y_5_km"}
    raise KeyError(domain)


def entities_for_row(row: dict[str, str], domain: str) -> dict[str, str]:
    """Devuelve claves estables y etiquetas legibles para rankings por episodio."""
    if domain == "runap":
        keys = pipe_values(row, "areas_protegidas_ids")
        names = pipe_values(row, "areas_protegidas_nombres")
        return {
            f"RUNAP:{key}": (names[index] if index < len(names) else key)
            for index, key in enumerate(keys)
        }
    if domain == "anm":
        keys = pipe_values(row, "titulos_mineros_codigos")
        applicants = pipe_values(row, "titulos_mineros_solicitantes")
        return {
            f"ANM:{key}": f"{key} · {applicants[index]}" if index < len(applicants) and applicants[index] else key
            for index, key in enumerate(keys)
        }
    if domain == "anla":
        proceedings = pipe_values(row, "anla_expedientes")
        if proceedings:
            return {f"ANLA:EXP:{value}": value for value in proceedings}
        projects = pipe_values(row, "anla_proyectos")
        return {f"ANLA:PROY:{value}": value for value in projects}
    if domain == "anh":
        numbers = pipe_values(row, "anh_contratos_numeros")
        if numbers:
            return {f"ANH:CONTRATO:{value}": value for value in numbers}
        ids = pipe_values(row, "anh_contratos_ids")
        if ids:
            return {f"ANH:ID:{value}": value for value in ids}
        names = pipe_values(row, "anh_areas_nombres")
        return {f"ANH:AREA:{value}": value for value in names}
    raise KeyError(domain)


def episode_profile(
    groups: list[frozenset[str]], rows_by_id: dict[str, dict[str, str]],
) -> tuple[dict[str, list[bool]], dict[str, list[dict[str, str]]]]:
    presence = {domain: [] for domain in DOMAINS}
    entities = {domain: [] for domain in DOMAINS}
    for members in groups:
        for domain in DOMAINS:
            present = False
            entity_map: dict[str, str] = {}
            for member in members:
                row = rows_by_id[member]
                if relation_present(row, domain):
                    present = True
                entity_map.update(entities_for_row(row, domain))
            presence[domain].append(present)
            entities[domain].append(entity_map)
    return presence, entities


def average_ranks(values: list[float], descending: bool = False) -> list[float]:
    indexed = sorted(enumerate(values), key=lambda item: ((-item[1]) if descending else item[1], item[0]))
    output = [0.0] * len(values)
    start = 0
    while start < len(indexed):
        end = start + 1
        current = indexed[start][1]
        while end < len(indexed) and indexed[end][1] == current:
            end += 1
        rank = ((start + 1) + end) / 2
        for position in range(start, end):
            output[indexed[position][0]] = rank
        start = end
    return output


def pearson(left: list[float], right: list[float]) -> float | None:
    if len(left) < 2 or len(left) != len(right):
        return None
    mean_left = sum(left) / len(left)
    mean_right = sum(right) / len(right)
    numerator = sum((a - mean_left) * (b - mean_right) for a, b in zip(left, right, strict=True))
    left_ss = sum((a - mean_left) ** 2 for a in left)
    right_ss = sum((b - mean_right) ** 2 for b in right)
    if left_ss <= 0 or right_ss <= 0:
        return None
    return numerator / math.sqrt(left_ss * right_ss)


def spearman_counts(counts_a: Counter[str], counts_b: Counter[str], keys: list[str]) -> float | None:
    if len(keys) < 2:
        return None
    values_a = [float(counts_a.get(key, 0)) for key in keys]
    values_b = [float(counts_b.get(key, 0)) for key in keys]
    return pearson(average_ranks(values_a), average_ranks(values_b))


def ranked_counts(entity_maps: list[dict[str, str]]) -> tuple[Counter[str], dict[str, str], int]:
    counts: Counter[str] = Counter()
    labels: dict[str, str] = {}
    unkeyed_related = 0
    for entity_map in entity_maps:
        if not entity_map:
            unkeyed_related += 1
            continue
        counts.update(entity_map.keys())
        labels.update(entity_map)
    return counts, labels, unkeyed_related


def top_entries(counts: Counter[str], labels: dict[str, str], limit: int = 10) -> list[dict[str, object]]:
    keys = sorted(counts, key=lambda key: (-counts[key], labels.get(key, key), key))[:limit]
    return [
        {"key": key, "label": labels.get(key, key), "episodes": counts[key], "rank": position}
        for position, key in enumerate(keys, start=1)
    ]


def build(data_dir: Path) -> dict[str, object]:
    generated = utc_now_iso()
    rows_by_id = load_rows(data_dir)
    points_a = ANALYSIS.load_hotspots(data_dir)
    points_b = [point for point in points_a if point.scenario_b]
    if len(rows_by_id) != len(points_a):
        raise RuntimeError(f"cierre territorial fallido: {len(rows_by_id)} != {len(points_a)}")

    groups_a = robust_groups(points_a)
    groups_b = robust_groups(points_b)
    presence_a, entities_a = episode_profile(groups_a, rows_by_id)
    presence_b, entities_b = episode_profile(groups_b, rows_by_id)

    operational_path = data_dir / "metadata" / "episodes_latest_run.json"
    if operational_path.exists():
        operational = json.loads(operational_path.read_text(encoding="utf-8"))
        if int(operational.get("evaluatedRows", -1)) != len(points_b):
            raise RuntimeError("el escenario B reconstruido no cierra con episodes_latest_run.json")
        if int(operational.get("episodeCount", -1)) != len(groups_b):
            raise RuntimeError("los episodios B reconstruidos no cierran con el producto operacional")

    a_owner: dict[str, int] = {}
    for position, members in enumerate(groups_a):
        for member in members:
            a_owner[member] = position
    descendants: dict[int, list[int]] = defaultdict(list)
    for b_position, members in enumerate(groups_b):
        owners = {a_owner.get(member) for member in members}
        if None in owners or len(owners) != 1:
            raise RuntimeError(f"episodio B {b_position} no tiene un único episodio A progenitor: {owners}")
        descendants[next(iter(owners))].append(b_position)

    a_with_descendant = sum(bool(descendants.get(position)) for position in range(len(groups_a)))
    a_lost = len(groups_a) - a_with_descendant
    a_split = sum(len(descendants.get(position, [])) > 1 for position in range(len(groups_a)))
    b_from_split = sum(
        len(descendants[position]) for position in descendants if len(descendants[position]) > 1
    )

    summary_rows: list[dict[str, object]] = []
    ranking_rows: list[dict[str, object]] = []
    domains_report: dict[str, object] = {}

    for domain in DOMAINS:
        related_a = sum(presence_a[domain])
        related_b = sum(presence_b[domain])
        pct_a = related_a / len(groups_a) * 100 if groups_a else 0.0
        pct_b = related_b / len(groups_b) * 100 if groups_b else 0.0

        preserved = lost_no_descendant = lost_with_descendant = 0
        for a_position, is_related in enumerate(presence_a[domain]):
            if not is_related:
                continue
            child_positions = descendants.get(a_position, [])
            if not child_positions:
                lost_no_descendant += 1
            elif any(presence_b[domain][position] for position in child_positions):
                preserved += 1
            else:
                lost_with_descendant += 1
        if preserved + lost_no_descendant + lost_with_descendant != related_a:
            raise RuntimeError(f"descomposición de relación {domain} no cierra")

        for b_position in range(len(groups_b)):
            a_position = next(position for position, children in descendants.items() if b_position in children)
            if presence_b[domain][b_position] and not presence_a[domain][a_position]:
                raise RuntimeError(f"relación {domain} aparece en B pero no en su progenitor A")

        counts_a, labels_a, unkeyed_a = ranked_counts([
            entity_map if presence_a[domain][position] else {}
            for position, entity_map in enumerate(entities_a[domain])
        ])
        counts_b, labels_b, unkeyed_b = ranked_counts([
            entity_map if presence_b[domain][position] else {}
            for position, entity_map in enumerate(entities_b[domain])
        ])
        labels = {**labels_a, **labels_b}
        keys = sorted(set(counts_a) | set(counts_b))
        rho = spearman_counts(counts_a, counts_b, keys)
        top_a = top_entries(counts_a, labels)
        top_b = top_entries(counts_b, labels)
        top_a_keys = {item["key"] for item in top_a}
        top_b_keys = {item["key"] for item in top_b}
        overlap = len(top_a_keys & top_b_keys)
        union_top = len(top_a_keys | top_b_keys)
        jaccard = overlap / union_top if union_top else 1.0

        ranks_a = average_ranks([float(counts_a.get(key, 0)) for key in keys], descending=True) if keys else []
        ranks_b = average_ranks([float(counts_b.get(key, 0)) for key in keys], descending=True) if keys else []
        for index, key in enumerate(keys):
            ranking_rows.append({
                "domain": domain, "domainLabel": DOMAIN_LABELS[domain], "entityKey": key,
                "entityLabel": labels.get(key, key), "episodesA": counts_a.get(key, 0),
                "rankA": round(ranks_a[index], 3), "episodesB": counts_b.get(key, 0),
                "rankB": round(ranks_b[index], 3),
                "deltaEpisodes": counts_b.get(key, 0) - counts_a.get(key, 0),
                "top10A": str(key in top_a_keys).lower(), "top10B": str(key in top_b_keys).lower(),
            })

        report = {
            "label": DOMAIN_LABELS[domain],
            "scenarioA": {"episodes": len(groups_a), "related": related_a, "percent": round(pct_a, 4)},
            "scenarioB": {"episodes": len(groups_b), "related": related_b, "percent": round(pct_b, 4)},
            "deltaPercentagePointsBminusA": round(pct_b - pct_a, 4),
            "relatedAEpisodes": {
                "preservedInAtLeastOneRobustBDescendant": preserved,
                "lostBecauseNoRobustBDescendant": lost_no_descendant,
                "lostWithinExistingBDescendants": lost_with_descendant,
                "preservationPercent": round(preserved / related_a * 100, 4) if related_a else 100.0,
            },
            "ranking": {
                "entities": len(keys), "spearmanCountRanks": round(rho, 6) if rho is not None else None,
                "top10Overlap": overlap, "top10Jaccard": round(jaccard, 6),
                "relatedEpisodesWithoutRankingKeyA": unkeyed_a,
                "relatedEpisodesWithoutRankingKeyB": unkeyed_b,
                "top10A": top_a, "top10B": top_b,
            },
        }
        domains_report[domain] = report
        summary_rows.append({
            "domain": domain, "domainLabel": DOMAIN_LABELS[domain],
            "episodesA": len(groups_a), "relatedA": related_a, "percentA": round(pct_a, 4),
            "episodesB": len(groups_b), "relatedB": related_b, "percentB": round(pct_b, 4),
            "deltaPercentagePointsBminusA": round(pct_b - pct_a, 4),
            "relatedAPreserved": preserved, "relatedALostNoRobustB": lost_no_descendant,
            "relatedALostWithinB": lost_with_descendant,
            "rankingEntities": len(keys), "spearmanCountRanks": round(rho, 6) if rho is not None else "",
            "top10Overlap": overlap, "top10Jaccard": round(jaccard, 6),
        })

    payload = {
        "metadata": {
            "generatedAtUtc": generated, "method": "componentes conexos espacio-temporales",
            "spatialMeters": SPATIAL_METERS, "temporalHours": TEMPORAL_HOURS,
            "minimumMembers": MIN_MEMBERS, "scenarioARows": len(points_a),
            "scenarioBRows": len(points_b), "excludedFromB": len(points_a) - len(points_b),
        },
        "episodes": {
            "scenarioA": len(groups_a), "scenarioB": len(groups_b),
            "differenceBminusA": len(groups_b) - len(groups_a),
            "percentChangeBvsA": round((len(groups_b) / len(groups_a) - 1) * 100, 4) if groups_a else 0.0,
        },
        "lineageAtoB": {
            "aEpisodesWithRobustBDescendant": a_with_descendant,
            "aEpisodesWithoutRobustBDescendant": a_lost,
            "aEpisodesSplitIntoMultipleRobustB": a_split,
            "bEpisodesDescendingFromSplitA": b_from_split,
        },
        "domains": domains_report,
    }

    output_dir = data_dir / "episodes"
    write_csv(output_dir / "relation_sensitivity_summary.csv", list(summary_rows[0]), summary_rows)
    write_csv(
        output_dir / "relation_sensitivity_rankings.csv",
        [
            "domain", "domainLabel", "entityKey", "entityLabel", "episodesA", "rankA",
            "episodesB", "rankB", "deltaEpisodes", "top10A", "top10B",
        ],
        ranking_rows,
    )
    atomic_write(
        output_dir / "relation_sensitivity.json",
        (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8"),
    )
    atomic_write(
        data_dir / "metadata" / "episode_relation_sensitivity_latest_run.json",
        (json.dumps(payload, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode("utf-8"),
    )
    return payload


if __name__ == "__main__":
    result = build(DEFAULT_DATA_DIR)
    print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
