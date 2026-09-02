import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "enrich_anh_contracts", ROOT / "scripts" / "enrich_anh_contracts.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def feature(classification="ASIGNADA", geometry=True):
    return {"attributes": {
        "OBJECTID": 7, "CONTRAT_ID": "0123", "CONTRATO_N": "LLA 01",
        "AREA_NOMBR": "Área ejemplo", "OPERADOR": "Operador ejemplo",
        "ESTAD_AREA": "PRODUCCION", "TIPO_CONTR": "CONTRATO E&P",
        "CUENCA_SED": "LLANOS", "PROCESO": "CONTRATACION DIRECTA",
        "CLASIFICAC": classification,
    }, "geometry": {"rings": [[[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]]} if geometry else None}


class AnhContractTests(unittest.TestCase):
    def test_selects_latest_date_not_highest_layer_id(self):
        metadata = {"layers": [
            {"id": 99, "name": "Otra capa"},
            {"id": 14, "name": "Tierras 2025-12-29"},
            {"id": 18, "name": "Tierras 2026-08-06"},
            {"id": 17, "name": "Tierras 2026-06-03"},
        ]}
        self.assertEqual(MODULE.latest_layer(metadata), (18, "2026-08-06"))

    def test_excludes_reserved_available_and_missing_geometry(self):
        collection = {"features": [feature(), feature("RESERVADA"), feature("DISPONIBLE"), feature(geometry=False)]}
        records = MODULE.assigned_records(collection)
        self.assertEqual(len(records), 1)
        self.assertEqual(records[0].contract_id, "0123")

    def test_calculates_inside_and_distance_classes(self):
        record = MODULE.assigned_records({"features": [feature()]})[0]
        shapes, index = MODULE.build_index([record])
        with patch.object(MODULE.SPATIAL, "project_epsg9377", return_value=(5, 5)):
            self.assertEqual(MODULE.relations_for_point(0, 0, [record], shapes, index)[0].spatial_class, "dentro")
        with patch.object(MODULE.SPATIAL, "project_epsg9377", return_value=(510, 5)):
            self.assertEqual(MODULE.relations_for_point(0, 0, [record], shapes, index)[0].spatial_class, "hasta_1_km")
        with patch.object(MODULE.SPATIAL, "project_epsg9377", return_value=(3010, 5)):
            self.assertEqual(MODULE.relations_for_point(0, 0, [record], shapes, index)[0].spatial_class, "entre_1_y_5_km")

    def test_cache_requires_same_layer_and_recent_download(self):
        recent = MODULE.datetime.now(MODULE.timezone.utc).isoformat()
        self.assertTrue(MODULE.cache_is_fresh({"sourceLayerId": 18, "downloadedAtUtc": recent}, 18, 24))
        self.assertFalse(MODULE.cache_is_fresh({"sourceLayerId": 17, "downloadedAtUtc": recent}, 18, 24))

    def test_retries_transient_failure(self):
        with patch.object(MODULE.HELPERS, "curl_json", side_effect=[RuntimeError("temporal"), {"ok": True}]) as call:
            with patch.object(MODULE.time, "sleep"):
                self.assertEqual(MODULE.resilient_json("https://example.test", {"f": "json"}, 1), {"ok": True})
        self.assertEqual(call.call_count, 2)


if __name__ == "__main__":
    unittest.main()
