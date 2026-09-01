import importlib.util
import sys
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("enrich_land_cover", ROOT / "scripts" / "enrich_land_cover.py")
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def square(min_x, min_y, max_x, max_y):
    return {"type": "Polygon", "coordinates": [[[min_x, min_y], [max_x, min_y],
        [max_x, max_y], [min_x, max_y], [min_x, min_y]]]}


class LandCoverTests(unittest.TestCase):
    def test_maps_official_properties(self):
        result = MODULE.mapping_from_properties({
            "codigo": 311, "leyenda": "3.1.1. Bosque denso",
            "nivel_1": "3. Bosques y áreas seminaturales", "confiabili": "Alta",
        }, "asignado")
        self.assertEqual(result["cobertura_codigo"], "311")
        self.assertEqual(result["cobertura_estado"], "asignado")
        self.assertEqual(MODULE.level_code(result["cobertura_nivel_1"]), "3")

    def test_matches_point_without_forcing_nearest(self):
        records = [MODULE.CoverPolygon(
            {"codigo": "311", "leyenda": "Bosque denso"}, square(0, 0, 1, 1), (0, 0, 1, 1)
        )]
        self.assertEqual(len(MODULE.match_point({"longitud": "0.5", "latitud": "0.5"}, records)), 1)
        self.assertEqual(MODULE.match_point({"longitud": "2", "latitud": "2"}, records), [])

    def test_exact_query_preserves_true_unassigned(self):
        with patch.object(MODULE.HELPERS, "curl_json", return_value={"features": []}):
            result = MODULE.query_exact({"longitud": "-74", "latitud": "4"})
        self.assertEqual(result["cobertura_estado"], "sin_cobertura")

    def test_incremental_mapping_queries_only_new_ids(self):
        rows = [
            {"hotspot_id": "old", "mpio_codigo": "1"},
            {"hotspot_id": "new", "mpio_codigo": "1"},
        ]
        mapping = {"old": {"hotspot_id": "old"}}
        with patch.object(MODULE, "process_batch", return_value={
            "new": {"cobertura_estado": "asignado", "cobertura_codigo": "311"}
        }) as mocked:
            missing, batches = MODULE.update_mapping(rows, mapping, 100, 2)
        self.assertEqual((missing, batches), (1, 1))
        self.assertIn("new", mapping)
        mocked.assert_called_once()


if __name__ == "__main__":
    unittest.main()
