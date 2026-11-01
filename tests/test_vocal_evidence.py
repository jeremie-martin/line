"""Signal checks independent of music labels: python -m unittest discover -s tests -p test_vocal_evidence.py."""
import importlib.util
import json
import unittest
from pathlib import Path

import numpy as np

spec = importlib.util.spec_from_file_location("vocal_evidence", Path(__file__).resolve().parents[1] / "tools/music/vocal_evidence.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VocalMeasurements(unittest.TestCase):
    def test_silence_is_not_evidence_of_spectral_change(self):
        result = module.measurements(np.zeros(22050))
        self.assertTrue(all(v == 0 for v in result["rms"]))
        self.assertTrue(all(v is None for v in result["spectralChange"]))
        json.dumps(result, allow_nan=False)

    def test_gain_changes_amplitude_but_not_spectral_shape(self):
        t = np.arange(22050) / 22050
        wave = .2 * np.sin(2 * np.pi * (300 * t + 200 * t**2))
        a, b = module.measurements(wave), module.measurements(wave * .2)
        np.testing.assert_allclose(np.array(a["rms"]) * .2, b["rms"], atol=1e-7)
        np.testing.assert_allclose(a["spectralChange"][1:], b["spectralChange"][1:], atol=1e-7)

    def test_changed_timbre_without_a_loudness_jump_is_visible(self):
        t = np.arange(22050) / 22050
        fundamental = np.sin(2 * np.pi * 440 * t)
        harmonic = np.sin(2 * np.pi * 1320 * t)
        wave = .2 * np.where(t < .5, fundamental, (fundamental + harmonic) / np.sqrt(2))
        result = module.measurements(wave)
        centers = np.arange(len(result["rms"])) * module.HOP / module.SR
        values = np.array([np.nan if v is None else v for v in result["spectralChange"]])
        self.assertGreater(np.nanmax(values[np.abs(centers - .5) < .04]), .05)
        self.assertLess(np.nanmax(values[(centers > .1) & (centers < .4)]), .001)

    def test_window_centers_and_impulse_support(self):
        wave = np.zeros(22050)
        wave[11025] = 1
        result = module.measurements(wave)
        centers = np.flatnonzero(result["rms"]) * module.HOP / module.SR
        self.assertTrue(np.all(np.abs(centers - .5) <= module.WINDOW / module.SR / 2))
        self.assertEqual(len(result["rms"]), (len(wave) + module.HOP - 1) // module.HOP)

    def test_invalid_input_rejected(self):
        for wave in [np.array([]), np.array([np.nan]), np.zeros((2, 3))]:
            with self.assertRaises(ValueError):
                module.measurements(wave)


class AcousticLandmarks(unittest.TestCase):
    def test_landmarks_keep_candidate_times_and_locate_a_known_rise(self):
        candidates = [{"t": 7.0, "kind": "unpitched-estimate"}]
        result = module.attack_landmarks([0, 1, 3, 2, 1, 2, 6, 5], candidates, sr=100, hop=100)
        self.assertEqual(candidates, [{"t": 7.0, "kind": "unpitched-estimate"}])
        self.assertEqual(result, [{"precedingMinimumT": 4.0, "minimumAtClipStart": False,
                                   "steepestRiseT": 6.0, "risePerSecond": 4.0}])

    def test_flat_energy_does_not_invent_a_rise(self):
        result = module.attack_landmarks([1, 1, 1, 1], [{"t": .02}])
        self.assertIsNone(result[0]["steepestRiseT"])
        self.assertIsNone(result[0]["risePerSecond"])
        self.assertTrue(result[0]["minimumAtClipStart"])
        self.assertEqual(module.attack_landmarks([0], []), [])

    def test_silent_bands_are_zero_with_an_unavailable_first_difference(self):
        bands = module.band_flux(np.zeros(module.SR))
        self.assertEqual([b["filterCenterHz"] for b in bands], [[80, 1000], [1000, 3000], [3000, 8000]])
        for band in bands:
            self.assertIsNone(band["values"][0])
            self.assertTrue(all(v == 0 for v in band["values"][1:]))
            self.assertEqual(len(band["values"]), (module.SR + module.HOP - 1) // module.HOP)

    def test_gain_does_not_change_flux_above_the_power_floor(self):
        wave = np.random.default_rng(123).normal(0, .1, module.SR)
        a, b = module.band_flux(wave), module.band_flux(wave * .5)
        for left, right in zip(a, b):
            np.testing.assert_allclose(left["values"][1:], right["values"][1:], atol=1e-6)

    def test_impulse_change_uses_centered_frame_times_for_each_window(self):
        wave = np.zeros(module.SR)
        wave[module.SR // 2] = 1
        for window in [512, 1024, 2048]:
            for band in module.band_flux(wave, window=window):
                flux = np.array([0 if v is None else v for v in band["values"]])
                active = np.flatnonzero(flux > 0) * module.HOP / module.SR
                self.assertGreater(len(active), 0)
                self.assertTrue(np.all(active >= .5 - window / (2 * module.SR) - 1 / module.SR))
                self.assertTrue(np.all(active <= .5 + module.HOP / module.SR))

    def test_invalid_landmarks_and_bands_rejected(self):
        for wave in [np.array([]), np.array([np.nan]), np.zeros((2, 3))]:
            with self.assertRaises(ValueError):
                module.band_flux(wave)
        with self.assertRaises(ValueError):
            module.attack_landmarks([0, -1], [{"t": 0}])
        for t in [float("nan"), -1, 10]:
            with self.assertRaises(ValueError):
                module.attack_landmarks([0, 1], [{"t": t}])


if __name__ == "__main__":
    unittest.main()
