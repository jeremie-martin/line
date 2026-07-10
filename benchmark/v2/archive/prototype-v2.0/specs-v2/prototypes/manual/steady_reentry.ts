/**
 * Hand-authored production-distribution case: an irregular percussion arrival
 * settles into a 560ms body. Two omitted windows make the drop and re-entry
 * meaningful without copying any reference timeline.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const intro = [0.55, 1.14, 1.74, 2.38, 3.02, 3.68];
const burst = [4.52, 5.09, 5.63, 6.18, 6.73, 7.17, 7.48];
const firstBody = pulse(9.02, 25.82, 0.56);
const secondBody = pulse(26.96, 45.44, 0.56);
const fade = [46.30, 47.45, 49.00, 50.20];
const drops = [9.02, 26.96];
const contacts = authoredContacts(
  mergeTimes(intro, burst, firstBody, secondBody, fade),
  (t, index) => {
    if (near(t, drops)) return 1;
    if (t < 4) return 0.08 + 0.025 * index;
    if (t < 8) return near(t, [4.52, 7.17]) ? 0.82 : 0.58 + 0.06 * (index % 3);
    if (t < 45.5) return index % 8 === 0 ? 0.78 : index % 2 === 0 ? 0.58 : 0.48;
    return t < 47 ? 0.28 : 0.10;
  },
);

const spec: Spec = {
  duration: 52,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.34, ease: "smooth" },
      { t: 4.52, v: 0.48, ease: "easeIn" },
      { t: 9.02, v: 0.72, ease: "smooth" },
      { t: 18, v: 0.82, ease: "smooth" },
      { t: 25.82, v: 0.70, ease: "easeOut" },
      { t: 26.96, v: 0.84, ease: "smooth" },
      { t: 40, v: 0.78, ease: "smooth" },
      { t: 52, v: 0.52 },
    ]),
    air: keyframes([
      { t: 0, v: 0.48, ease: "smooth" },
      { t: 7.48, v: 0.62, ease: "smooth" },
      { t: 9.02, v: 0.72, ease: "smooth" },
      { t: 22, v: 0.66, ease: "smooth" },
      { t: 26.96, v: 0.72, ease: "smooth" },
      { t: 42, v: 0.78, ease: "smooth" },
      { t: 52, v: 0.84 },
    ]),
  },
};

export default spec;
