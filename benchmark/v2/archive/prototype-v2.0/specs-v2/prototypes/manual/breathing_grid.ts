/**
 * Hand-authored production-distribution case: a 600ms bed alternates with
 * deliberate 1.2s omissions and five isolated 1.8s breaths. Amplitude follows
 * the available musical space rather than remaining high on the dense grid.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const intro = pulse(0.60, 9.00, 1.20);
const bedA = pulse(10.20, 28.20, 0.60);
const breathA = [30.00];
const selectedA = [30.60, 31.20, 32.40, 33.00, 34.20, 34.80, 35.40, 36.60, 37.20, 37.80, 39.60];
const bedB = pulse(40.20, 53.40, 0.60);
const breathB = [55.20];
const selectedB = [55.80, 56.40, 57.60, 58.20, 60.00, 61.20, 62.40, 64.20];
const breathExits = [30.00, 39.60, 55.20, 60.00, 64.20];
const contacts = authoredContacts(
  mergeTimes(intro, bedA, breathA, selectedA, bedB, breathB, selectedB),
  (t, index) => {
    if (near(t, breathExits)) return 0.92;
    if (t < 10) return 0.22 + 0.05 * (index % 4);
    if (t > 54) return index % 3 === 0 ? 0.78 : 0.42;
    return index % 4 === 0 ? 0.82 : index % 2 === 0 ? 0.64 : 0.50;
  },
);

const spec: Spec = {
  duration: 66,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.36, ease: "smooth" },
      { t: 10.2, v: 0.58, ease: "smooth" },
      { t: 24, v: 0.70, ease: "smooth" },
      { t: 39.6, v: 0.78, ease: "smooth" },
      { t: 53.4, v: 0.68, ease: "easeOut" },
      { t: 60, v: 0.74, ease: "smooth" },
      { t: 66, v: 0.52 },
    ]),
    air: keyframes([
      { t: 0, v: 0.46, ease: "smooth" },
      { t: 10.2, v: 0.56, ease: "smooth" },
      { t: 28.2, v: 0.64, ease: "smooth" },
      { t: 39.6, v: 0.72, ease: "smooth" },
      { t: 53.4, v: 0.60, ease: "smooth" },
      { t: 60, v: 0.74, ease: "smooth" },
      { t: 66, v: 0.56 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.24, ease: "smooth" },
      { t: 9, v: 0.46, ease: "easeOut" },
      { t: 10.2, v: 0.08, ease: "smooth" },
      { t: 28.2, v: 0.12, ease: "smooth" },
      { t: 30, v: 0.68, ease: "easeOut" },
      { t: 31.2, v: 0.14, ease: "smooth" },
      { t: 39.6, v: 0.72, ease: "easeOut" },
      { t: 40.2, v: 0.10, ease: "smooth" },
      { t: 53.4, v: 0.12, ease: "smooth" },
      { t: 55.2, v: 0.82, ease: "easeOut" },
      { t: 57.6, v: 0.34, ease: "smooth" },
      { t: 60, v: 0.74, ease: "easeOut" },
      { t: 66, v: 0.28 },
    ]),
  },
};

export default spec;
