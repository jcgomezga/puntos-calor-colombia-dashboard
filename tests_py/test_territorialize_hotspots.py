import importlib.util
import gzip
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "territorialize_hotspots", ROOT / "scripts" / "territorialize_hotspots.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def square(min_x, min_y, max_x, max_y):
    return {
        "type": "Polygon",
        "coordinates": [[
            [min_x, min_y], [max_x, min_y], [max_x, max_y],
            [min_x, max_y], [min_x, min_y],
        ]],
    }


class TerritorializationTests(unittest.TestCase):
    def setUp(self):
        self.records = [
            MODULE.PolygonRecord("01001", "01", "Uno", "Occidente", 1.0, square(0, 0, 1, 1), (0, 0, 1, 1)),
            MODULE.PolygonRecord("01002", "01", "Uno", "Oriente", 1.0, square(1, 0, 2, 1), (1, 0, 2, 1)),
        ]
        self.index = MODULE.build_grid(self.records, size=0.5)

    def test_assigns_single_interior(self):
        status, record = MODULE.assign_point(0.5, 0.5, self.records, self.index, size=0.5)
        self.assertEqual(status, "asignado")
        self.assertEqual(record.code, "01001")

    def test_marks_shared_boundary_for_review(self):
        status, record = MODULE.assign_point(1.0, 0.5, self.records, self.index, size=0.5)
        self.assertEqual(status, "limite_revision")
        self.assertIsNone(record)

    def test_does_not_force_nearest_polygon(self):
        status, record = MODULE.assign_point(3.0, 3.0, self.records, self.index, size=0.5)
        self.assertEqual(status, "sin_asignacion")
        self.assertIsNone(record)

    def test_excludes_polygon_holes(self):
        geometry = {
            "type": "Polygon",
            "coordinates": [
                [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]],
                [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]],
            ],
        }
        self.assertEqual(MODULE.point_in_geometry(0.5, 0.5, geometry), 1)
        self.assertEqual(MODULE.point_in_geometry(2.0, 2.0, geometry), 0)

    def test_rebuilds_metadata_from_completed_cache(self):
        collection = {
            "type": "FeatureCollection",
            "features": [{"type": "Feature", "properties": {}, "geometry": square(0, 0, 1, 1)}],
        }
        with tempfile.TemporaryDirectory() as temporary:
            data_dir = Path(temporary)
            boundary = data_dir / "boundaries" / "municipios.geojson.gz"
            boundary.parent.mkdir(parents=True)
            with gzip.open(boundary, "wt", encoding="utf-8") as stream:
                json.dump(collection, stream)
            with patch.object(MODULE, "curl_json", return_value={"name": "Municipios 2025"}):
                audit = MODULE.rebuild_cached_metadata(
                    boundary, data_dir, collection, "2026-09-01T00:00:00Z"
                )
        self.assertEqual(audit["municipalities"]["feature_count"], 1)
        self.assertEqual(audit["archive"]["path"], "boundaries/municipios.geojson.gz")
        self.assertTrue(audit["archive"]["recovered_from_cache"])

    def test_exact_dane_assignment_recovers_simplification_gap(self):
        response = {
            "features": [{"attributes": {"MPIO_CDPMP": "01001"}}]
        }
        with patch.object(MODULE, "curl_json", return_value=response):
            status, record = MODULE.exact_dane_assignment(
                0.5, 0.5, {item.code: item for item in self.records}
            )
        self.assertEqual(status, "asignado")
        self.assertEqual(record.code, "01001")

    def test_exact_dane_assignment_preserves_true_unassigned(self):
        with patch.object(MODULE, "curl_json", return_value={"features": []}):
            status, record = MODULE.exact_dane_assignment(
                3.0, 3.0, {item.code: item for item in self.records}
            )
        self.assertEqual(status, "sin_asignacion")
        self.assertIsNone(record)


if __name__ == "__main__":
    unittest.main()
