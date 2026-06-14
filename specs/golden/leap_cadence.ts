/**
 * leap_cadence — AMPLITUDE stepped in three blocks (modest → bigger → biggest
 * leaps) over sparse ~1.2s gaps. Air steps up WITH amplitude (a taller pop needs
 * more airborne time for one arc), against a building speed. The step blocks make
 * each leap tier legible on-screen. No grain.
 *
 *   air        0.65 / 0.80 / 0.92  (steps up with the leaps)
 *   amplitude  0.35 / 0.54 / 0.71  (= air-supported pop ceiling at 48f gaps)
 *   speed      0.55 → 0.75 (build)
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 15,
  // each leap lands hard, stepping up with the tiers: modest → bigger → biggest.
  contacts: withImpactLegacy(beats(1.2, 1.2, 12), (t) => (t < 5 ? 0.45 : t < 10 ? 0.7 : 0.95)), // ~1.2s gaps (48f)
  axes: {
    air: keyframes([{ t: 0, v: 0.65 }, { t: 5, v: 0.80 }, { t: 10, v: 0.92 }], "hold"),
    speed: keyframes([{ t: 0, v: 0.55 }, { t: 14, v: 0.75 }], "smooth"),
    amplitude: keyframes([{ t: 0, v: 0.35 }, { t: 5, v: 0.54 }, { t: 10, v: 0.71 }], "hold"),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
