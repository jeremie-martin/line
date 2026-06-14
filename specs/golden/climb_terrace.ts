/**
 * climb_terrace — sparse-cadence ELEVATION study. Steady speed and mid air; the
 * rider climbs in three terraces (level → moderate → steep) over ~1.0s gaps so
 * each climb has room to express. No grain (line length is free). Exercises the
 * arc-length / launch lever: a climb spends speed, so the long gaps give the
 * compiler room to set up a surviving ascent between beats.
 *
 *   [ 0– 5s]  elevation 0.50  — gentle rise
 *   [ 5–10s]  elevation 0.58  — moderate climb
 *   [10–15s]  elevation 0.62  — steep climb (near the achievable ceiling ~0.65)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 16,
  // impact steps up with each terrace: gentle landings on the level rise,
  // firmer on the moderate climb, hardest on the steep top terrace.
  contacts: withImpactLegacy(beats(1.0, 1.0, 15), (t) => (t < 5 ? 0.3 : t < 10 ? 0.55 : 0.8)), // ~1.0s gaps (40f) — non-dense
  axes: {
    air: constant(0.5),
    speed: constant(0.6),
    elevation: keyframes(
      [{ t: 0, v: 0.50 }, { t: 5, v: 0.58 }, { t: 10, v: 0.62 }],
      "hold",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
