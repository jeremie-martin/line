/**
 * opening_burst — starts immediately in a high-speed dense rhythm.
 *
 * The first three seconds ask for quarter-second contacts while speed and air
 * are already high. This keeps pre-roll/initial-state quality visible instead
 * of letting the compiler warm up during an easy intro.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";

const contacts: Contact[] = [];
for (let t = 0.50; t <= 3.00 + 1e-6; t += 0.25) {
  contacts.push({ t: Number(t.toFixed(3)) });
}
for (let t = 3.50; t < 14; t += 0.50) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

const spec: Spec = {
  duration: 14,
  contacts,
  sections: [
    { t0: 0, t1: 3, air: 0.82, speed: 0.94, grain: 0.62, contact_style: 0.28 },
    { t0: 3, t1: 8, air: 0.45, speed: 0.72, grain: 0.30, contact_style: 0.70 },
    { t0: 8, t1: 14, air: 0.78, speed: 0.82, grain: 0.72, contact_style: 0.55 },
  ],
  preroll: 5,
};

export default spec;
