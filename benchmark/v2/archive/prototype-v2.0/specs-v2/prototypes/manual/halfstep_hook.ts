/**
 * Hand-authored production-distribution case: 880ms primary beats alternate
 * with bounded 440ms half-pulse passages. Amplitude is deliberately suppressed
 * during the dense passages and opened on the primary-beat stretches.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { alternating, authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const sparseIntro = pulse(0.88, 7.04, 0.88);
const denseA = pulse(7.92, 14.96, 0.44);
const sparseA = pulse(15.84, 22.00, 0.88);
const denseB = pulse(22.88, 30.80, 0.44);
const sparseB = pulse(31.68, 38.72, 0.88);
const denseC = pulse(39.60, 44.88, 0.44);
const outro = pulse(45.76, 52.80, 0.88);
const sectionStarts = [7.92, 15.84, 22.88, 31.68, 39.60, 45.76];
const contacts = authoredContacts(
  mergeTimes(sparseIntro, denseA, sparseA, denseB, sparseB, denseC, outro),
  (t, index) => {
    if (near(t, sectionStarts)) return 0.94;
    if (t < 7.5) return 0.28 + 0.05 * index;
    if ((t >= 7.5 && t < 15.4) || (t >= 22.5 && t < 31.2) || (t >= 39.2 && t < 45.3)) {
      return alternating(index, 0.46, 0.76);
    }
    return index % 4 === 0 ? 0.82 : 0.56;
  },
);

const spec: Spec = {
  duration: 54,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.38, ease: "smooth" },
      { t: 7.92, v: 0.66, ease: "easeIn" },
      { t: 14.96, v: 0.82, ease: "smooth" },
      { t: 22, v: 0.70, ease: "smooth" },
      { t: 30.8, v: 0.88, ease: "smooth" },
      { t: 38.72, v: 0.74, ease: "smooth" },
      { t: 44.88, v: 0.84, ease: "smooth" },
      { t: 54, v: 0.58 },
    ]),
    air: keyframes([
      { t: 0, v: 0.44, ease: "smooth" },
      { t: 7.92, v: 0.68, ease: "smooth" },
      { t: 22, v: 0.72, ease: "smooth" },
      { t: 31.68, v: 0.76, ease: "smooth" },
      { t: 45.76, v: 0.66, ease: "smooth" },
      { t: 54, v: 0.54 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.34, ease: "smooth" },
      { t: 7.92, v: 0.08, ease: "smooth" },
      { t: 15.84, v: 0.48, ease: "smooth" },
      { t: 22.88, v: 0.08, ease: "smooth" },
      { t: 31.68, v: 0.56, ease: "smooth" },
      { t: 39.60, v: 0.10, ease: "smooth" },
      { t: 45.76, v: 0.46, ease: "smooth" },
      { t: 54, v: 0.24 },
    ]),
  },
};

export default spec;
