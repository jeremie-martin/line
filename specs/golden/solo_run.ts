/**
 * solo_run — sustained dense passage (~25s, ~80 contacts). Pushes contact
 * count well beyond the current suite max (55) to test whether per-contact
 * compile cost stays small or starts to grow nonlinearly.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";

const contacts: Contact[] = [];
for (let t = 0.40; t < 25; t += 0.32) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

const spec: Spec = {
  duration: 25,
  contacts,
  sections: [
    { t0: 0, t1: 8, air: 0.50, speed: 0.65, grain: 0.45, contact_style: 0.50 },
    { t0: 8, t1: 17, air: 0.55, speed: 0.72, grain: 0.55, contact_style: 0.45 },
    { t0: 17, t1: 25, air: 0.50, speed: 0.68, grain: 0.50, contact_style: 0.55 },
  ],
  preroll: 5,
};

export default spec;
