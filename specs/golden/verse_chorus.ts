/**
 * verse_chorus — 24s, ~30 contacts spread across 8 short sections (song
 * structure: verse-chorus-verse-chorus with bridge). Disambiguates whether
 * runtime cost is driven by section count vs contact count — current suite
 * has section counts bunched in 3-4.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";

const contacts: Contact[] = [];
for (let t = 0.55; t < 24; t += 0.78) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

const spec: Spec = {
  duration: 24,
  contacts,
  sections: [
    { t0: 0,  t1: 3,  air: 0.45, speed: 0.55, grain: 0.50, contact_style: 0.50 },
    { t0: 3,  t1: 6,  air: 0.60, speed: 0.68, grain: 0.55, contact_style: 0.45 },
    { t0: 6,  t1: 9,  air: 0.50, speed: 0.60, grain: 0.45, contact_style: 0.55 },
    { t0: 9,  t1: 12, air: 0.65, speed: 0.72, grain: 0.60, contact_style: 0.45 },
    { t0: 12, t1: 15, air: 0.50, speed: 0.55, grain: 0.50, contact_style: 0.50 },
    { t0: 15, t1: 18, air: 0.60, speed: 0.70, grain: 0.55, contact_style: 0.45 },
    { t0: 18, t1: 21, air: 0.55, speed: 0.62, grain: 0.50, contact_style: 0.55 },
    { t0: 21, t1: 24, air: 0.62, speed: 0.68, grain: 0.58, contact_style: 0.45 },
  ],
  preroll: 5,
};

export default spec;
