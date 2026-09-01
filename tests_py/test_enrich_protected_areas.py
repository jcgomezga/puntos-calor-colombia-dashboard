import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "enrich_protected_areas", ROOT / "scripts" / "enrich_protected_areas.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def square(min_x, min_y, max_x, max_y):
    return {"type": "Polygon", "coordinates": [[[min_x, min_y], [max_x, min_y],
        [max_x, max_y], [min_x, max_y], [min_x, min_y]]]}


class ProtectedAreaTests(unittest.TestCase):
    def setUp(self):
        self.records = [MODULE.ProtectedArea(
            "7", "Reserva ejemplo", "Reserva Natural", "Registrada", "Autoridad",
            square(0, 0, 1, 1), (0, 0, 1, 1),
        )]
        self.index = MODULE.build_grid(self.records)

    def test_finds_interior_and_boundary(self):
        self.assertEqual(len(MODULE.intersecting_areas(0.5, 0.5, self.records, self.index)), 1)
        self.assertEqual(len(MODULE.intersecting_areas(1.0, 0.5, self.records, self.index)), 1)

    def test_keeps_outside_point_outside(self):
        self.assertEqual(MODULE.intersecting_areas(2.0, 2.0, self.records, self.index), [])

    def test_builds_auditable_records(self):
        collection = {"features": [{"id": 7, "properties": {
            "ap_id": 7, "ap_nombre": "Reserva ejemplo", "ap_categoria": "Reserva Natural",
            "condicion": "Registrada", "organizacion": "Autoridad",
        }, "geometry": square(0, 0, 1, 1)}]}
        records = MODULE.protected_records(collection)
        self.assertEqual(records[0].area_id, "7")
        self.assertEqual(records[0].category, "Reserva Natural")


if __name__ == "__main__":
    unittest.main()
