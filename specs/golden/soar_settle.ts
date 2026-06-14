/**
 * soar_settle — MIXED cadence AMPLITUDE: big soaring pops on a sparse front
 * (1.3s gaps) that settle into tiny hops on a denser back (0.7s beats). Air and
 * amplitude decline together as the gaps shorten — a tall pop needs both airborne
 * time AND a long gap, so the dense back can only carry small hops. Speed steady;
 * no grain.
 *
 *   [sparse 1.3–9.1s, 1.3s gaps]  air 0.85, amplitude 0.71  — big soars
 *   [dense  9.8–15.4s, 0.7s beats] air → 0.45, amplitude → 0.06 — tiny hops
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 16,
  // big soars land hard up front, then the dense back settles to soft grazes.
  contacts: withImpactLegacy([
    ...beats(1.3, 1.3, 7), // sparse soaring front: 1.3 .. 9.1 (52f gaps)
    ...beats(9.8, 0.7, 9), // denser settle back: 9.8 .. 15.4 (28f beats)
  ], keyframes([{ t: 0, v: 0.9 }, { t: 9, v: 0.55 }, { t: 16, v: 0.1 }], "smooth")),
  axes: {
    air: keyframes([{ t: 0, v: 0.85 }, { t: 9, v: 0.6 }, { t: 16, v: 0.45 }], "smooth"),
    speed: constant(0.6),
    amplitude: keyframes(
      [{ t: 0, v: 0.71 }, { t: 9, v: 0.30 }, { t: 16, v: 0.06 }],
      "smooth",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
