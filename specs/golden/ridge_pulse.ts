/**
 * ridge_pulse - dense 0.6s beats with repeated small ridge climbs and compact
 * amplitude pulses. This keeps all four active axes under tight beat pressure.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 15,
  // impact pulses in phase with the ridge crests (~6s period): firm accent on
  // each ridge top, softer landings in the dips between.
  contacts: withImpact(beats(0.7, 0.6, 24), (t) => 0.45 + 0.35 * Math.cos((2 * Math.PI * (t - 3)) / 6)),
  axes: {
    air: keyframes([{ t: 0, v: 0.42 }, { t: 4, v: 0.56 }, { t: 8, v: 0.42 }, { t: 12, v: 0.56 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.56 }, { t: 15, v: 0.74 }], "smooth"),
    elevation: keyframes(
      [{ t: 0, v: 0.48 }, { t: 3, v: 0.60 }, { t: 6, v: 0.44 }, { t: 9, v: 0.60 }, { t: 12, v: 0.46 }],
      "smooth",
    ),
    amplitude: keyframes(
      [{ t: 0, v: 0.10 }, { t: 4, v: 0.22 }, { t: 8, v: 0.10 }, { t: 12, v: 0.22 }],
      "smooth",
    ),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
