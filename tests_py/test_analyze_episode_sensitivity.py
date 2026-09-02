import importlib.util
import sys
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "analyze_episode_sensitivity", ROOT / "scripts" / "analyze_episode_sensitivity.py"
)
MODULE = importlib.util.module_from_spec(SPEC)
assert SPEC.loader is not None
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def point(identifier, x, y, minute, municipality="1", source="A"):
    return MODULE.Hotspot(identifier, x, y, minute, municipality, source, True)


class EpisodeSensitivityTests(unittest.TestCase):
    def test_connects_points_only_when_space_and_time_close(self):
        points = [point("a", 0, 0, 0), point("b", 400, 0, 60), point("c", 900, 0, 2_000)]
        groups, links = MODULE.components(points, 500, 12)
        self.assertEqual(sorted(group.size for group in groups), [1, 2])
        self.assertEqual(links, 1)

    def test_transitive_chain_is_measured_not_hidden(self):
        points = [point(str(i), i * 400, 0, i * 60) for i in range(8)]
        groups, _ = MODULE.components(points, 500, 12)
        self.assertEqual(len(groups), 1)
        self.assertEqual(groups[0].size, 8)
        self.assertAlmostEqual(groups[0].bbox_diagonal_km, 2.8)

    def test_summary_separates_pairs_from_robust_episodes(self):
        points = [
            point("a", 0, 0, 0), point("b", 100, 0, 1),
            point("c", 5_000, 0, 0), point("d", 5_100, 0, 1), point("e", 5_200, 0, 2),
            point("f", 20_000, 0, 0),
        ]
        result = MODULE.summarize(points, 500, 12, "A")
        self.assertEqual((result["candidateEpisodes"], result["robustEpisodes"]), (2, 1))
        self.assertEqual((result["pairedOnlyEpisodes"], result["singletonHotspots"]), (1, 1))

    def test_shared_boundary_values_are_inclusive(self):
        points = [point("a", 0, 0, 0), point("b", 500, 0, 12 * 60)]
        groups, _ = MODULE.components(points, 500, 12)
        self.assertEqual(len(groups), 1)

    def test_rejects_non_positive_thresholds(self):
        with self.assertRaises(ValueError):
            MODULE.components([point("a", 0, 0, 0)], 0, 12)


if __name__ == "__main__":
    unittest.main()
