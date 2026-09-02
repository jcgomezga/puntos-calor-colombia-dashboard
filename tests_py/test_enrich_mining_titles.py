import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "enrich_mining_titles", ROOT / "scripts" / "enrich_mining_titles.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def square(min_x, min_y, max_x, max_y):
    return {"type": "Polygon", "coordinates": [[[min_x, min_y], [max_x, min_y],
        [max_x, max_y], [min_x, max_y], [min_x, min_y]]]}


def title(feature_id, code, geometry):
    return MODULE.MiningTitle(
        feature_id, code, "Solicitante", "Explotación", "Oro", "Vigente",
        "Concesión", "25", geometry, MODULE.HELPERS.geometry_bbox(geometry),
    )


class MiningTitleTests(unittest.TestCase):
    def test_finds_direct_intersection_and_boundary(self):
        records = [title("1", "ABC-1", square(0, 0, 1, 1))]
        index = MODULE.build_grid(records)
        self.assertEqual(len(MODULE.intersecting_titles(0.5, 0.5, records, index)), 1)
        self.assertEqual(len(MODULE.intersecting_titles(1.0, 0.5, records, index)), 1)

    def test_keeps_outside_point_outside(self):
        records = [title("1", "ABC-1", square(0, 0, 1, 1))]
        self.assertEqual(MODULE.intersecting_titles(2, 2, records, MODULE.build_grid(records)), [])

    def test_preserves_all_overlapping_titles(self):
        records = [
            title("2", "B", square(0, 0, 2, 2)),
            title("1", "A", square(0.5, 0.5, 1.5, 1.5)),
        ]
        matches = MODULE.intersecting_titles(1, 1, records, MODULE.build_grid(records))
        self.assertEqual([item.code for item in matches], ["A", "B"])

    def test_builds_auditable_record(self):
        collection = {"features": [{"id": 7, "properties": {
            "fid": 7, "codigo_exp": "ABC-1", "solicitante": "Titular ejemplo",
            "etapa": "Explotación", "minerales": "Oro", "estado_exp": "Vigente",
            "modalidade": "Concesión", "area_ha": 25,
        }, "geometry": square(0, 0, 1, 1)}]}
        record = MODULE.title_records(collection)[0]
        self.assertEqual(record.code, "ABC-1")
        self.assertEqual(record.applicant, "Titular ejemplo")


if __name__ == "__main__":
    unittest.main()
