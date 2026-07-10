/**
 * Hand-authored production-distribution frontier: an ordinary 550ms groove
 * opens into 2.2s and 3.3s omissions whose target is low-air riding, not a jump.
 * The separate capability case remains responsible for the 5s boundary.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const grooveA = pulse(0.55, 13.20, 0.55);
const exitA = [15.40];
const grooveB = pulse(15.95, 29.15, 0.55);
const exitB = [32.45];
const grooveC = pulse(33.00, 47.30, 0.55);
const exitC = [49.50];
const tail = pulse(50.05, 56.10, 0.55);
const exits = [15.40, 32.45, 49.50];
const contacts = authoredContacts(
  mergeTimes(grooveA, exitA, grooveB, exitB, grooveC, exitC, tail),
  (t, index) => {
    if (near(t, exits)) return 0.84;
    if (t > 50) return 0.34;
    return index % 8 === 0 ? 0.74 : index % 2 === 0 ? 0.56 : 0.46;
  },
);

const spec: Spec = {
  duration: 58,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.50, ease: "smooth" },
      { t: 10, v: 0.68, ease: "smooth" },
      { t: 15.40, v: 0.72, ease: "smooth" },
      { t: 26, v: 0.78, ease: "smooth" },
      { t: 32.45, v: 0.76, ease: "smooth" },
      { t: 44, v: 0.82, ease: "smooth" },
      { t: 49.50, v: 0.70, ease: "easeOut" },
      { t: 58, v: 0.58 },
    ]),
    air: keyframes([
      { t: 0, v: 0.36, ease: "smooth" },
      { t: 12.65, v: 0.34, ease: "smooth" },
      { t: 13.20, v: 0.07, ease: "easeOut" },
      { t: 15.39, v: 0.07 },
      { t: 15.40, v: 0.30, ease: "smooth" },
      { t: 28.60, v: 0.32, ease: "smooth" },
      { t: 29.15, v: 0.04, ease: "easeOut" },
      { t: 32.44, v: 0.04 },
      { t: 32.45, v: 0.32, ease: "smooth" },
      { t: 46.75, v: 0.30, ease: "smooth" },
      { t: 47.30, v: 0.06, ease: "easeOut" },
      { t: 49.49, v: 0.06 },
      { t: 49.50, v: 0.34, ease: "smooth" },
      { t: 58, v: 0.42 },
    ]),
  },
};

export default spec;
