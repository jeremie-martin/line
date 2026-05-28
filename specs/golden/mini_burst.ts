/**
 * mini_burst — short spec (~5s, ~7 contacts) to exercise the per-contact
 * budget floor. Confirms small specs no longer get a free runtime pass under
 * the affine soft/hard budget; gives the optimizer one tiny case where every
 * single contact matters.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";

const contacts: Contact[] = [];
for (let t = 0.60; t < 5.0; t += 0.65) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

const spec: Spec = {
  duration: 5,
  contacts,
  sections: [
    { t0: 0.0, t1: 2.5, air: 0.55, speed: 0.65, grain: 0.50, contact_style: 0.40 },
    { t0: 2.5, t1: 5.0, air: 0.70, speed: 0.55, grain: 0.65, contact_style: 0.70 },
  ],
  preroll: 5,
};

export default spec;
