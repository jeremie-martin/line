/**
 * Hand-authored production-distribution case: a 720ms pulse deliberately omits
 * one or two beats at a time, yielding 1.44s and 2.16s musical openings. The
 * gaps remain part of an ordinary ride rather than a standalone boundary test.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const intro = pulse(0.72, 8.64, 0.72);
const bodyA = pulse(9.36, 23.04, 0.72)
  .filter((t) => !near(t, [13.68, 19.44, 20.16]));
const reset = [24.48];
const bodyB = pulse(25.20, 43.92, 0.72)
  .filter((t) => !near(t, [31.68, 38.16, 38.88]));
const outro = pulse(45.36, 56.88, 1.44);
const arcExits = [14.40, 20.88, 24.48, 32.40, 39.60, 45.36];
const contacts = authoredContacts(
  mergeTimes(intro, bodyA, reset, bodyB, outro),
  (t, index) => {
    if (near(t, arcExits)) return 0.88;
    if (t < 9) return 0.24 + 0.04 * (index % 5);
    if (t > 44) return 0.38;
    return index % 4 === 0 ? 0.74 : 0.52;
  },
);

const spec: Spec = {
  duration: 58,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.38, ease: "smooth" },
      { t: 9.36, v: 0.56, ease: "smooth" },
      { t: 20.88, v: 0.70, ease: "smooth" },
      { t: 32.40, v: 0.78, ease: "smooth" },
      { t: 43.92, v: 0.72, ease: "smooth" },
      { t: 58, v: 0.54 },
    ]),
    air: keyframes([
      { t: 0, v: 0.42, ease: "smooth" },
      { t: 9.36, v: 0.56, ease: "smooth" },
      { t: 24.48, v: 0.68, ease: "smooth" },
      { t: 39.60, v: 0.62, ease: "smooth" },
      { t: 45.36, v: 0.72, ease: "smooth" },
      { t: 58, v: 0.54 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.16, ease: "smooth" },
      { t: 13.0, v: 0.18, ease: "smooth" },
      { t: 14.40, v: 0.52, ease: "easeOut" },
      { t: 18.72, v: 0.20, ease: "smooth" },
      { t: 20.88, v: 0.74, ease: "easeOut" },
      { t: 24.48, v: 0.62, ease: "smooth" },
      { t: 31.0, v: 0.18, ease: "smooth" },
      { t: 32.40, v: 0.56, ease: "easeOut" },
      { t: 37.44, v: 0.20, ease: "smooth" },
      { t: 39.60, v: 0.78, ease: "easeOut" },
      { t: 45.36, v: 0.68, ease: "smooth" },
      { t: 58, v: 0.30 },
    ]),
  },
};

export default spec;
