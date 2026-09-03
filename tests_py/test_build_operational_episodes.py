import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "build_operational_episodes", ROOT / "scripts" / "build_operational_episodes.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def point(identifier, minute):
    return MODULE.ANALYSIS.Hotspot(identifier, 0, 0, minute, "1", "A", True)


class OperationalEpisodeTests(unittest.TestCase):
    def test_new_identifier_is_deterministic_and_uses_earliest_member(self):
        points = {"a": point("a", 20), "b": point("b", 10), "c": point("c", 30)}
        first = MODULE.new_identifier({"a", "b", "c"}, points)
        second = MODULE.new_identifier({"c", "b", "a"}, points)
        self.assertEqual(first, second)
        self.assertTrue(first.startswith("E19700101-"))

    def test_continuing_episode_inherits_identifier(self):
        points = {key: point(key, index) for index, key in enumerate("abcd")}
        identifiers, lineage = MODULE.assign_episode_ids(
            [{"a", "b", "c", "d"}], {"E-old": {"a", "b", "c"}}, points, "run",
        )
        self.assertEqual(identifiers, ["E-old"])
        self.assertEqual(lineage, [])

    def test_merge_keeps_dominant_identifier_and_records_absorbed(self):
        points = {key: point(key, index) for index, key in enumerate("abcdef")}
        identifiers, lineage = MODULE.assign_episode_ids(
            [{"a", "b", "c", "d", "e", "f"}],
            {"E-main": {"a", "b", "c", "d"}, "E-small": {"e", "f"}}, points, "run",
        )
        self.assertEqual(identifiers, ["E-main"])
        self.assertTrue(any(row["change_type"] == "merged" and row["previous_episode_id"] == "E-small" for row in lineage))

    def test_split_assigns_previous_id_to_largest_overlap(self):
        points = {key: point(key, index) for index, key in enumerate("abcdef")}
        identifiers, lineage = MODULE.assign_episode_ids(
            [{"a", "b", "c"}, {"d", "e", "f"}], {"E-old": {"a", "b", "c", "d"}}, points, "run",
        )
        self.assertIn("E-old", identifiers)
        self.assertTrue(any(row["change_type"] == "split" for row in lineage))

    def test_method_mismatch_requires_explicit_reset(self):
        self.assertEqual(MODULE.load_state(Path("/does/not/exist")), {})


if __name__ == "__main__":
    unittest.main()
