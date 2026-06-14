/**
 * impact_lab_v2 — chase metric DIVERGENCE by mimicking what actually produced it in the
 * golden suite: rolling_drop (the lone high-divergence track, 0.63) is a SPARSE phrase with
 * a big elevation DROP + amplitude crest on the rebound. v1's speed-contrast design gave
 * near-zero divergence — the metrics agreed. So v2 strings together several sparse
 * drop→rebound cycles of varying depth and speed; the drop dynamics are what split
 * redirection from force.
 */
import type { Spec } from "../types.ts";
import { keyframes } from "../core/curves.ts";
import { withImpact } from "../core/beats.ts";

const seg = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

// Uniform-sparse like rolling_drop (~1.2s), long enough for 3 drop cycles.
const beats = seg(1.2, 1.2, 22);

const spec: Spec = {
  duration: 28,
  // impact crests at the bottom of each drop, eases on the rebounds.
  contacts: withImpact(beats, keyframes(
    [{ t: 0, v: 0.4 }, { t: 6, v: 0.95 }, { t: 10, v: 0.5 }, { t: 14, v: 0.9 }, { t: 18, v: 0.5 }, { t: 22, v: 0.95 }, { t: 28, v: 0.55 }],
    "smooth",
  )),
  axes: {
    air:       keyframes([{ t: 0, v: 0.60 }, { t: 6, v: 0.52 }, { t: 10, v: 0.82 }, { t: 14, v: 0.50 }, { t: 18, v: 0.80 }, { t: 22, v: 0.50 }, { t: 28, v: 0.60 }], "smooth"),
    speed:     keyframes([{ t: 0, v: 0.58 }, { t: 6, v: 0.62 }, { t: 10, v: 0.85 }, { t: 14, v: 0.60 }, { t: 18, v: 0.90 }, { t: 22, v: 0.58 }, { t: 28, v: 0.70 }], "smooth"),
    // three drops of increasing depth, each rebounding.
    elevation: keyframes([{ t: 0, v: 0.62 }, { t: 6, v: 0.30 }, { t: 10, v: 0.60 }, { t: 14, v: 0.24 }, { t: 18, v: 0.62 }, { t: 22, v: 0.18 }, { t: 28, v: 0.58 }], "smooth"),
    amplitude: keyframes([{ t: 0, v: 0.28 }, { t: 6, v: 0.18 }, { t: 10, v: 0.64 }, { t: 14, v: 0.20 }, { t: 18, v: 0.68 }, { t: 22, v: 0.22 }, { t: 28, v: 0.40 }], "smooth"),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
