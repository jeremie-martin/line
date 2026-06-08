/**
 * dense_echo_climb - dense beat grid with a restrained climb and echoing
 * amplitude pulses. This is the tight-cadence counterpart to the sparse climb
 * specs, with smaller amplitude and elevation swings.
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

const beats = (t0: number, gap: number, n: number) =>
  Array.from({ length: n }, (_, i) => ({ t: Number((t0 + i * gap).toFixed(3)) }));

const spec: Spec = {
  duration: 14,
  // impact echoes beat-to-beat (alternating soft/firm) on a slowly climbing
  // base — small recurring pulses that intensify as the climb builds.
  contacts: withImpact(
    beats(0.6, 0.5, 27),
    (t, i) => 0.28 + 0.22 * (t / 14) + (i % 2 === 0 ? 0.18 : 0),
  ),
  axes: {
    air: keyframes([{ t: 0, v: 0.36 }, { t: 7, v: 0.52 }, { t: 14, v: 0.44 }], "smooth"),
    speed: keyframes([{ t: 0, v: 0.60 }, { t: 14, v: 0.78 }], "smooth"),
    elevation: keyframes([{ t: 0, v: 0.48 }, { t: 5, v: 0.54 }, { t: 10, v: 0.60 }, { t: 14, v: 0.56 }], "smooth"),
    amplitude: keyframes(
      [{ t: 0, v: 0.06 }, { t: 3.5, v: 0.18 }, { t: 7, v: 0.08 }, { t: 10.5, v: 0.20 }, { t: 14, v: 0.10 }],
      "smooth",
    ),
  },
  jitter: 0.05,
  preroll: 5,
};

export default spec;
