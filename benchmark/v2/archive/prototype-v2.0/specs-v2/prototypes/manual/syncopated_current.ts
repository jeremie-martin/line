/**
 * Hand-authored production-distribution case: a 680ms backbone carries isolated
 * anticipations plus one three-contact run. The exceptions are sparse enough to
 * remain musical events rather than a permanent high-density stream.
 */
import { keyframes } from "../../../../../../../scripts/v0/core/curves.ts";
import type { Spec } from "../../../../../../../scripts/v0/types.ts";
import { authoredContacts, mergeTimes, near, pulse } from "./_score.ts";

const backboneA = pulse(0.68, 16.32, 0.68);
const pickupsA = [5.84, 10.60, 14.00];
const breath = [17.34, 18.36];
const backboneB = pulse(19.04, 35.36, 0.68)
  .filter((t) => !near(t, [32.64, 33.32]));
const pickupsB = [21.48, 25.56, 29.64, 32.72, 33.00, 33.28];
const backboneC = pulse(36.72, 52.36, 0.68);
const pickupsC = [40.48, 45.92, 49.32];
const outro = [53.38, 54.74];
const emphasized = [19.04, 33.28, 36.72];
const pickupSet = [...pickupsA, ...pickupsB, ...pickupsC];
const contacts = authoredContacts(
  mergeTimes(backboneA, pickupsA, breath, backboneB, pickupsB, backboneC, pickupsC, outro),
  (t, index) => {
    if (near(t, emphasized)) return 0.96;
    if (near(t, pickupSet)) return near(t, [32.72, 33.00]) ? 0.42 : 0.68;
    if (t > 52.5) return 0.18;
    return index % 4 === 0 ? 0.78 : index % 2 === 0 ? 0.58 : 0.48;
  },
);

const spec: Spec = {
  duration: 56,
  contacts,
  jitter: 0,
  preroll: 5,
  start: { vx: 4.5, vy: 0, y: -160 },
  axes: {
    speed: keyframes([
      { t: 0, v: 0.58, ease: "smooth" },
      { t: 8, v: 0.76, ease: "smooth" },
      { t: 16.32, v: 0.84, ease: "easeOut" },
      { t: 18.36, v: 0.68, ease: "smooth" },
      { t: 27, v: 0.88, ease: "smooth" },
      { t: 35.36, v: 0.78, ease: "smooth" },
      { t: 44, v: 0.90, ease: "smooth" },
      { t: 56, v: 0.70 },
    ]),
    air: keyframes([
      { t: 0, v: 0.40, ease: "smooth" },
      { t: 10, v: 0.58, ease: "smooth" },
      { t: 18.36, v: 0.46, ease: "smooth" },
      { t: 27, v: 0.68, ease: "smooth" },
      { t: 35.36, v: 0.56, ease: "smooth" },
      { t: 46, v: 0.72, ease: "smooth" },
      { t: 56, v: 0.52 },
    ]),
  },
};

export default spec;
