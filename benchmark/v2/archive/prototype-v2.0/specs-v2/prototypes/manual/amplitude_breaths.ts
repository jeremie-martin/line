/**
 * Hand-authored production-distribution case: a 500ms percussion bed contains
 * selected 1.0-2.0s openings. Amplitude rises only into those openings and stays
 * restrained on the dense contacts.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const intro = pulse(1.00, 5.00, 1.00);
const bedA = pulse(5.50, 18.00, 0.50);
const openingsA = [19.00, 19.50, 21.00, 21.50, 22.50];
const bedB = pulse(23.00, 38.00, 0.50);
const openingsB = [39.00, 40.50, 41.00, 43.00, 43.50];
const bedC = pulse(44.00, 55.00, 0.50);
const outro = [56.00, 57.50, 59.50, 61.00, 63.00];
const openingExits = [19.00, 21.00, 22.50, 39.00, 40.50, 43.00, 56.00, 57.50, 59.50, 61.00, 63.00];
const contacts = authoredContacts(
  mergeTimes(intro, bedA, openingsA, bedB, openingsB, bedC, outro),
  (t, index) => {
    if (near(t, openingExits)) return 0.86;
    if (t < 5.5) return 0.20 + 0.08 * index;
    if (t > 55) return 0.40;
    return index % 4 === 0 ? 0.78 : index % 2 === 0 ? 0.60 : 0.46;
  },
);

const spec: Spec = {
  duration: 64,
  contacts,
  jitter: 0,
  preroll: 5,
  axes: {
    speed: keyframes([
      { t: 0, v: 0.34, ease: "smooth" },
      { t: 5.5, v: 0.54, ease: "smooth" },
      { t: 21, v: 0.70, ease: "smooth" },
      { t: 38, v: 0.80, ease: "smooth" },
      { t: 50, v: 0.74, ease: "smooth" },
      { t: 64, v: 0.52 },
    ]),
    air: keyframes([
      { t: 0, v: 0.46, ease: "smooth" },
      { t: 18, v: 0.58, ease: "smooth" },
      { t: 31, v: 0.68, ease: "smooth" },
      { t: 43, v: 0.72, ease: "smooth" },
      { t: 55, v: 0.62, ease: "smooth" },
      { t: 64, v: 0.52 },
    ]),
    amplitude: keyframes([
      { t: 0, v: 0.28, ease: "smooth" },
      { t: 5.5, v: 0.08, ease: "smooth" },
      { t: 18, v: 0.10, ease: "smooth" },
      { t: 19, v: 0.42, ease: "easeOut" },
      { t: 19.5, v: 0.10, ease: "smooth" },
      { t: 21, v: 0.64, ease: "easeOut" },
      { t: 22.5, v: 0.48, ease: "smooth" },
      { t: 23, v: 0.08, ease: "smooth" },
      { t: 38, v: 0.10, ease: "smooth" },
      { t: 40.5, v: 0.72, ease: "easeOut" },
      { t: 41, v: 0.10, ease: "smooth" },
      { t: 43, v: 0.82, ease: "easeOut" },
      { t: 44, v: 0.08, ease: "smooth" },
      { t: 55, v: 0.10, ease: "smooth" },
      { t: 59.5, v: 0.86, ease: "easeOut" },
      { t: 64, v: 0.44 },
    ]),
  },
};

export default spec;
