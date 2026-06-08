/**
 * big_air_ramp — AMPLITUDE build over long ~1.3s gaps. Air and amplitude rise
 * TOGETHER: for one ballistic arc the pop height is set by airborne time, so a
 * tall pop requires high air. Co-varying them keeps the target satisfiable —
 * the rider goes from small low hops to big high soars. Speed steady; no grain.
 *
 *   air        0.5 → 0.9   (longer aloft as it builds)
 *   amplitude  0.25 → 0.80 (= the air-supported pop ceiling at 52f gaps)
 *   speed      0.6 (flat)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 18,
  // impact RAMPS with the build: small early hops land soft, the big late soars
  // land hard — heavier touchdown as the arc grows.
  contacts: withImpact(beats(1.3, 1.3, 13), (t) => 0.20 + 0.70 * (t / 17)), // ~1.3s gaps (52f)
  axes: {
    air: keyframes([{ t: 0, v: 0.5 }, { t: 17, v: 0.9 }], "smooth"),
    speed: constant(0.6),
    amplitude: keyframes([{ t: 0, v: 0.25 }, { t: 17, v: 0.80 }], "smooth"),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
