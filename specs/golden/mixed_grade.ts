/**
 * mixed_grade — a deliberately MIXED cadence: a dense level intro (0.5s beats)
 * then a sparse climbing body (1.2s gaps). Tests that the arc-length / climb
 * lever opens only where there is room — the dense intro should stay a flat
 * ride, the sparse body should climb. air + speed steady; no grain.
 *
 *   [dense  0.8–4.3s, 0.5s beats]  elevation 0.5  — flat warm-up
 *   [sparse 5.5–15.1s, 1.2s gaps]  elevation → 0.9 — climb with room
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 16,
  contacts: [
    ...beats(0.8, 0.5, 8), // dense intro: 0.8 .. 4.3 (20f beats)
    ...beats(5.5, 1.2, 9), // sparse body: 5.5 .. 15.1 (48f gaps)
  ],
  axes: {
    air: constant(0.5),
    speed: constant(0.6),
    elevation: keyframes(
      [{ t: 0, v: 0.5 }, { t: 4.5, v: 0.5 }, { t: 15, v: 0.9 }],
      "smooth",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
