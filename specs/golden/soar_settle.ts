/**
 * soar_settle — MIXED cadence AMPLITUDE: big soaring pops on a sparse front
 * (1.3s gaps) that settle into smaller hops on a denser back (0.7s beats), as
 * both amplitude and air decline. Tests that amplitude scales down gracefully
 * as the gaps shorten (pop is gap-bound). Speed steady; no grain.
 *
 *   [sparse 1.3–9.1s, 1.3s gaps]  amplitude high, air high  — big soars
 *   [dense  9.8–15.4s, 0.7s beats] amplitude low, air lower  — settle to hops
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 16,
  contacts: [
    ...beats(1.3, 1.3, 7), // sparse soaring front: 1.3 .. 9.1 (52f gaps)
    ...beats(9.8, 0.7, 9), // denser settle back: 9.8 .. 15.4 (28f beats)
  ],
  axes: {
    air: keyframes([{ t: 0, v: 0.75 }, { t: 16, v: 0.45 }], "smooth"),
    speed: constant(0.6),
    amplitude: keyframes(
      [{ t: 0, v: 0.85 }, { t: 9, v: 0.55 }, { t: 16, v: 0.25 }],
      "smooth",
    ),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
