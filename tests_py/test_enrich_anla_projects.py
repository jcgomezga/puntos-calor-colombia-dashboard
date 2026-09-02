import importlib.util
import math
import sys
import unittest
from unittest.mock import patch
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "enrich_anla_projects", ROOT / "scripts" / "enrich_anla_projects.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class AnlaProjectTests(unittest.TestCase):
    def test_retries_transient_source_failure(self):
        with patch.object(MODULE.HELPERS, "curl_json", side_effect=[RuntimeError("temporal"), {"ok": True}]) as call:
            with patch.object(MODULE.time, "sleep"):
                self.assertEqual(MODULE.resilient_json("https://example.test", {"f": "json"}, 1), {"ok": True})
        self.assertEqual(call.call_count, 2)

    def test_projects_known_origin(self):
        x, y = MODULE.project_epsg9377(-73, 4)
        self.assertAlmostEqual(x, 5_000_000, places=3)
        self.assertAlmostEqual(y, 2_000_000, places=3)

    def test_point_and_line_distances(self):
        self.assertEqual(MODULE.geometry_distance(0, 0, "punto", {"x": 300, "y": 400}), 500)
        geometry = {"paths": [[[0, 0], [2_000, 0]]]}
        self.assertEqual(MODULE.geometry_distance(1_000, 500, "linea", geometry), 500)

    def test_polygon_inside_boundary_and_outside(self):
        polygon = {"rings": [[[0, 0], [2_000, 0], [2_000, 2_000], [0, 2_000], [0, 0]]]}
        self.assertEqual(MODULE.geometry_distance(1_000, 1_000, "poligono", polygon), 0)
        self.assertEqual(MODULE.geometry_distance(2_000, 1_000, "poligono", polygon), 0)
        self.assertEqual(MODULE.geometry_distance(3_000, 1_000, "poligono", polygon), 1_000)

    def test_polygon_hole_is_not_inside(self):
        polygon = {"rings": [
            [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]],
            [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]],
        ]}
        self.assertEqual(MODULE.geometry_distance(5, 5, "poligono", polygon), 2)

    def test_classification_boundaries_and_geometry_semantics(self):
        self.assertEqual(MODULE.spatial_class("poligono", 0), "dentro")
        self.assertEqual(MODULE.spatial_class("linea", 0), "hasta_1_km")
        self.assertEqual(MODULE.spatial_class("punto", 1_000), "hasta_1_km")
        self.assertEqual(MODULE.spatial_class("punto", 5_000), "entre_1_y_5_km")
        self.assertEqual(MODULE.spatial_class("punto", 5_000.01), "mas_de_5_km")

    def test_maps_legal_status_and_auditable_fields(self):
        payload = {"features": [{"attributes": {
            "objectid": 7, "globalid": "abc", "expediente": "LAM001",
            "proyecto": "Proyecto ejemplo", "operador": "Operador ejemplo",
            "sector": 104, "num_act_ad": "123",
        }, "geometry": {"rings": [[[0, 0], [1, 0], [1, 1], [0, 0]]]}}]}
        record = MODULE.project_records(payload, 2)[0]
        self.assertEqual(record.legal_status, "evaluacion")
        self.assertEqual(record.geometry_type, "poligono")
        self.assertEqual(record.proceeding, "LAM001")
        self.assertEqual(record.sector, "Energía")

    def test_projection_matches_official_geometry_service(self):
        x, y = MODULE.project_epsg9377(-74.08175, 4.60971)
        self.assertAlmostEqual(x, 4_880_056.0161100104, places=3)
        self.assertAlmostEqual(y, 2_067_459.1319015007, places=3)

    def test_excludes_features_without_geometry(self):
        payload = {"features": [{"attributes": {"objectid": 8}, "geometry": {"paths": []}}]}
        self.assertEqual(MODULE.project_records(payload, 5), [])

    def test_keeps_all_relations_within_five_kilometres(self):
        x, y = MODULE.project_epsg9377(-73, 4)
        projects = [
            MODULE.AnlaProject(4, "b", "", "B", "", "", "licenciado", "punto", "", {"x": x + 900, "y": y}),
            MODULE.AnlaProject(4, "a", "", "A", "", "", "licenciado", "punto", "", {"x": x + 4_000, "y": y}),
            MODULE.AnlaProject(4, "c", "", "C", "", "", "licenciado", "punto", "", {"x": x + 6_000, "y": y}),
        ]
        relations = MODULE.relations_for_point(-73, 4, projects)
        self.assertEqual([item.project.feature_id for item in relations], ["b", "a"])
        self.assertEqual([item.spatial_class for item in relations], ["hasta_1_km", "entre_1_y_5_km"])


if __name__ == "__main__":
    unittest.main()
