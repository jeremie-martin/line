/**
 * rhythm_ladder — uneven phrase rhythm with crossed axis changes.
 *
 * Contacts follow a repeating phrase rather than a steady grid. Each section
 * moves a different pair of axes so the optimizer cannot satisfy the spec by
 * leaning on one dominant style knob.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";

const contacts: Contact[] = [];
for (let base = 0.65; base < 18; base += 2.4) {
  for (const off of [0.00, 0.30, 0.82, 1.38, 2.05]) {
    const t = base + off;
    if (t < 18) contacts.push({ t: Number(t.toFixed(3)) });
  }
}

const spec: Spec = {
  duration: 18,
  contacts,
  sections: [
    { t0: 0.0, t1: 4.5, air: 0.35, speed: 0.76, grain: 0.65, contact_style: 0.30 },
    { t0: 4.5, t1: 9.0, air: 0.78, speed: 0.50, grain: 0.25, contact_style: 0.72 },
    { t0: 9.0, t1: 13.5, air: 0.48, speed: 0.86, grain: 0.72, contact_style: 0.42 },
    { t0: 13.5, t1: 18.0, air: 0.82, speed: 0.64, grain: 0.35, contact_style: 0.82 },
  ],
  preroll: 5,
};

export default spec;
