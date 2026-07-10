/**
 * Hand-authored production-distribution case: irregular quiet support carries
 * the opening before a regular 540ms percussion bed. A short off-grid breakdown
 * replaces, rather than layers on top of, the nominal pulse.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const voice = [0.42, 0.86, 1.39, 1.98, 2.72, 3.31, 4.57, 5.79, 6.46, 7.03, 7.57, 8.10];
const bodyA = pulse(8.64, 35.10, 0.54);
const breakdown = [35.72, 36.14, 36.56, 37.22, 37.64];
const bodyB = pulse(38.18, 47.36, 0.54);
const tail = [48.20, 49.10];
const contacts = authoredContacts(
  mergeTimes(voice, bodyA, breakdown, bodyB, tail),
  (t, index) => {
    if (near(t, [8.64, 38.18])) return 1;
    if (t < 8.2) return t < 5.8 ? 0.06 : 0.10 + 0.08 * (t - 5.8);
    if (t >= 35.5 && t < 38) return near(t, [35.72, 36.56, 37.64]) ? 0.82 : 0.48;
    if (t > 47.5) return 0.12;
    return index % 4 === 0 ? 0.76 : index % 2 === 0 ? 0.58 : 0.44;
  },
);

const spec: Spec = {
  duration: 50,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.36, ease: "smooth" },
      { t: 5.8, v: 0.44, ease: "easeIn" },
      { t: 8.64, v: 0.70, ease: "smooth" },
      { t: 19, v: 0.78, ease: "smooth" },
      { t: 27, v: 0.88, ease: "easeOut" },
      { t: 36.5, v: 0.72, ease: "smooth" },
      { t: 42, v: 0.80, ease: "smooth" },
      { t: 50, v: 0.54 },
    ]),
    air: keyframes([
      { t: 0, v: 0.58, ease: "smooth" },
      { t: 8.64, v: 0.70, ease: "smooth" },
      { t: 25, v: 0.64, ease: "smooth" },
      { t: 36.5, v: 0.78, ease: "smooth" },
      { t: 47.36, v: 0.82, ease: "smooth" },
      { t: 50, v: 0.84 },
    ]),
  },
};

export default spec;
