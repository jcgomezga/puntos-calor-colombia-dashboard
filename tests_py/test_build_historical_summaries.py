import csv
import importlib.util
import json
import sys
import tempfile
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_historical_summaries", ROOT / "scripts" / "build_historical_summaries.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


FIELDS = [
    "hotspot_id", "fecha_local", "escenario_b", "dpto_codigo", "mpio_codigo",
    "en_area_protegida", "en_titulo_minero", "anla_clase_minima", "anh_clase_minima",
]


def row(hotspot_id, day, scenario_b="true", **overrides):
    value = {
        "hotspot_id": hotspot_id, "fecha_local": day, "escenario_b": scenario_b,
        "dpto_codigo": "73", "mpio_codigo": "73001", "en_area_protegida": "false",
        "en_titulo_minero": "false", "anla_clase_minima": "mas_de_5_km",
        "anh_clase_minima": "mas_de_5_km",
    }
    value.update(overrides)
    return value


class HistoricalSummaryTests(unittest.TestCase):
    def test_relation_flags_use_only_inside_or_five_kilometres(self):
        flags = MODULE.relation_flags(row(
            "a", "2026-07-01", en_area_protegida="true", en_titulo_minero="true",
            anla_clase_minima="hasta_1_km", anh_clase_minima="entre_1_y_5_km",
        ))
        self.assertEqual(flags, {"runap": True, "mining": True, "anlaWithin5": True, "anhWithin5": True})

    def test_monthly_summaries_separate_scenarios_and_open_month(self):
        rows = [
            row("a", "2026-07-01"), row("b", "2026-07-02", "false"),
            row("c", "2026-08-01", anh_clase_minima="dentro"),
        ]
        output = MODULE.records(MODULE.summarize(rows, lambda value: value[:7]), "2026-08")
        july_a = next(item for item in output if item["period"] == "2026-07" and item["scenario"] == "A")
        july_b = next(item for item in output if item["period"] == "2026-07" and item["scenario"] == "B")
        august_a = next(item for item in output if item["period"] == "2026-08" and item["scenario"] == "A")
        self.assertEqual((july_a["hotspots"], july_b["hotspots"], august_a["anhWithin5"]), (2, 1, 1))
        self.assertEqual((july_a["status"], august_a["status"]), ("closed", "open"))

    def test_rejects_duplicate_ids_and_pre_cutoff_rows(self):
        with tempfile.TemporaryDirectory() as temporary:
            data_dir = Path(temporary)
            target = data_dir / "territorial" / "hotspots_2026-07.csv"
            target.parent.mkdir(parents=True)
            with target.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=FIELDS); writer.writeheader()
                writer.writerows([row("a", "2026-06-30"), row("a", "2026-07-01")])
            with self.assertRaisesRegex(RuntimeError, "anterior al corte histórico"):
                MODULE.load_rows(data_dir, "2026-07-01")

    def test_build_closes_against_dashboard(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary); data_dir = root / "data"; public_dir = root / "public"
            target = data_dir / "territorial" / "hotspots_2026-07.csv"; target.parent.mkdir(parents=True)
            with target.open("w", encoding="utf-8", newline="") as stream:
                writer = csv.DictWriter(stream, fieldnames=FIELDS); writer.writeheader()
                writer.writerows([row("a", "2026-07-01"), row("b", "2026-07-02", "false")])
            public_dir.mkdir(); (public_dir / "dashboard.json").write_text(json.dumps({"points": [[], []]}))
            report = MODULE.build(data_dir, public_dir, "2026-07-01")
            self.assertEqual((report["totalRows"], report["scenarioBRows"]), (2, 1))
            history = json.loads((public_dir / "history.json").read_text())
            self.assertEqual(history["metadata"]["openMonth"], "2026-07")


if __name__ == "__main__":
    unittest.main()
