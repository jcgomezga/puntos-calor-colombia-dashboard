import csv
import importlib.util
import json
import shutil
import sys
import tempfile
import unittest
from datetime import date
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "update_ideam_data", ROOT / "scripts" / "update_ideam_data.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


class IngestionTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.data_dir = Path(self.temp.name) / "data"
        self.policy = MODULE.load_policy(ROOT / "config" / "data-policy.json")

    def tearDown(self):
        self.temp.cleanup()

    def install_fixture(self):
        destination = MODULE.raw_path(self.data_dir, date(2026, 7, 1))
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(
            ROOT / "tests_py" / "fixtures" / destination.name,
            destination,
        )
        return destination

    def test_date_selection_never_precedes_cutoff(self):
        backfill = MODULE.dates_for_mode("backfill", date(2026, 7, 3), self.policy)
        refresh = MODULE.dates_for_mode("refresh", date(2026, 7, 1), self.policy)
        self.assertEqual(backfill[0], date(2026, 7, 1))
        self.assertEqual(backfill[-1], date(2026, 7, 3))
        self.assertEqual(refresh, [date(2026, 7, 1)])

    def test_normalization_cutoff_invalid_coordinate_and_deduplication(self):
        self.install_fixture()
        manifest = {
            "raw_files": [{
                "date": "2026-07-01",
                "path": "raw/2026/07/Puntos_de_calor_Colombia_2026-07-01.csv",
                "downloaded_at_utc": "2026-09-01T00:00:00Z",
            }]
        }
        summary = MODULE.process_data(
            self.data_dir,
            self.policy,
            manifest,
            MODULE.datetime(2026, 9, 1, tzinfo=MODULE.timezone.utc),
        )
        self.assertEqual(summary["rows_read"], 5)
        self.assertEqual(summary["rows_rejected_cutoff"], 1)
        self.assertEqual(summary["rows_rejected_invalid"], 1)
        self.assertEqual(summary["rows_valid_before_dedup"], 3)
        self.assertEqual(summary["rows_unique"], 2)
        self.assertEqual(summary["scenario_a_rows"], 2)
        self.assertEqual(summary["scenario_b_rows"], 1)

        output = self.data_dir / "processed" / "hotspots_2026-07.csv"
        with output.open(encoding="utf-8", newline="") as stream:
            rows = list(csv.DictReader(stream))
        aqua = next(row for row in rows if row["fuente"] == "MODIS-Aqua")
        self.assertEqual(aqua["frp_mw"], "13")
        self.assertEqual(aqua["confianza"], "85")
        self.assertEqual(aqua["sensor"], "MODIS")
        self.assertEqual(aqua["satelite"], "Aqua")

    def test_policy_outputs_are_auditable(self):
        self.install_fixture()
        manifest = {"raw_files": []}
        MODULE.process_data(
            self.data_dir,
            self.policy,
            manifest,
            MODULE.datetime(2026, 9, 1, tzinfo=MODULE.timezone.utc),
        )
        summary = json.loads(
            (self.data_dir / "metadata" / "summary.json").read_text(encoding="utf-8")
        )
        self.assertEqual(summary["policy"]["history_start_date"], "2026-07-01")
        self.assertEqual(summary["policy"]["timezone"], "America/Bogota")
        self.assertTrue(summary["policy"]["inclusive"])


if __name__ == "__main__":
    unittest.main()
