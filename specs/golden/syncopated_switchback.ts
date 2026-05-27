/**
 * syncopated_switchback — explicit non-uniform rhythm with axis reversals.
 *
 * Contacts follow a repeating 2s phrase with uneven offsets rather than a
 * steady drum-grid. The opening section is already fast and grippy, then the
 * axes cross over each other: long/low-contact, short/high-contact, and airy
 * skip. This exercises timing irregularity plus transitions that are not a
 * simple monotonic build.
 *
 * Phrase: t = base + [0.00, 0.35, 0.95], base += 2s.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";

const contacts: Contact[] = [];
for (let base = 0.75; base < 16; base += 2) {
  for (const off of [0, 0.35, 0.95]) {
    const t = base + off;
    if (t < 16) contacts.push({ t: Number(t.toFixed(3)) });
  }
}

const spec: Spec = {
  duration: 16,
  contacts,
  sections: [
    { t0:  0, t1:  4, air: 0.75, speed: 0.82, grain: 0.70, contact_style: 0.70 },
    { t0:  4, t1:  8, air: 0.25, speed: 0.65, grain: 0.65, contact_style: 0.25 },
    { t0:  8, t1: 12, air: 0.55, speed: 0.45, grain: 0.20, contact_style: 0.75 },
    { t0: 12, t1: 16, air: 0.80, speed: 0.70, grain: 0.35, contact_style: 0.35 },
  ],
  preroll: 5,
};

export default spec;
