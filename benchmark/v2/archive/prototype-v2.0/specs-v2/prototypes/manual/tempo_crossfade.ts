/**
 * Hand-authored production-distribution case: four local pulses progressively
 * tighten from 720ms to 480ms, then relax to 620ms. Axis targets remain smooth
 * through the cadence transitions rather than changing on every boundary.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const slow = pulse(0.72, 11.52, 0.72);
const medium = pulse(12.24, 24.40, 0.64);
const driving = pulse(25.04, 36.24, 0.56);
const fast = pulse(36.80, 48.32, 0.48);
const release = pulse(49.00, 59.54, 0.62);
const transitions = [12.24, 25.04, 36.80, 49.00];
const contacts = authoredContacts(
  mergeTimes(slow, medium, driving, fast, release),
  (t, index) => {
    if (near(t, transitions)) return 0.94;
    if (t < 12) return index % 4 === 0 ? 0.66 : 0.42;
    if (t >= 36.5 && t < 48.6) return index % 4 === 0 ? 0.84 : index % 2 === 0 ? 0.62 : 0.50;
    if (t > 49) return index % 4 === 0 ? 0.70 : 0.40;
    return index % 4 === 0 ? 0.78 : 0.50;
  },
);

const spec: Spec = {
  duration: 62,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.36, ease: "smooth" },
      { t: 12.24, v: 0.52, ease: "smooth" },
      { t: 25.04, v: 0.70, ease: "smooth" },
      { t: 36.80, v: 0.86, ease: "smooth" },
      { t: 45, v: 0.90, ease: "easeOut" },
      { t: 49, v: 0.74, ease: "smooth" },
      { t: 62, v: 0.56 },
    ]),
    air: keyframes([
      { t: 0, v: 0.44, ease: "smooth" },
      { t: 18, v: 0.62, ease: "smooth" },
      { t: 32, v: 0.70, ease: "smooth" },
      { t: 45, v: 0.64, ease: "smooth" },
      { t: 55, v: 0.76, ease: "smooth" },
      { t: 62, v: 0.58 },
    ]),
  },
};

export default spec;
