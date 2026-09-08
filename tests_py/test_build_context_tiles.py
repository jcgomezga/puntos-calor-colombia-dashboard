import importlib.util
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_context_tiles", ROOT / "scripts" / "build_context_tiles.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class ContextTileTests(unittest.TestCase):
    def test_converts_arcgis_outer_ring_and_hole(self):
        outer_clockwise = [[0, 0], [0, 10], [10, 10], [10, 0], [0, 0]]
        hole_counterclockwise = [[3, 3], [7, 3], [7, 7], [3, 7], [3, 3]]
        polygon = MODULE.arcgis_polygon([outer_clockwise, hole_counterclockwise])

        self.assertIsNotNone(polygon)
        self.assertAlmostEqual(polygon.area, 84)
        self.assertTrue(polygon.covers(MODULE.Point(1, 1)))
        self.assertFalse(polygon.covers(MODULE.Point(5, 5)))

    def test_writes_newline_delimited_geojson_without_losing_unicode(self):
        feature = MODULE.geojson_feature(
            {"type": "Point", "coordinates": [-73, 4]},
            {"nombre": "Área protegida"},
            "id-1",
        )
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "features.geojsonseq"
            self.assertEqual(MODULE.write_sequence(path, [feature]), 1)
            self.assertIn("Área protegida", path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
