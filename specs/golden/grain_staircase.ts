/**
 * grain_staircase — isolates grain as direct arc-size intent.
 *
 * Speed, air, and contact style stay moderate while grain walks short → medium
 * → long → short. The intended pressure is visible line scale, not solving an
 * inverse timing problem through unrelated axes.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";

const contacts: Contact[] = [];
for (let t = 0.75; t < 20; t += 0.50) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

const spec: Spec = {
  duration: 20,
  contacts,
  sections: [
    { t0: 0, t1: 5, air: 0.55, speed: 0.58, grain: 0.18, contact_style: 0.48 },
    { t0: 5, t1: 10, air: 0.55, speed: 0.58, grain: 0.45, contact_style: 0.48 },
    { t0: 10, t1: 15, air: 0.55, speed: 0.58, grain: 0.82, contact_style: 0.48 },
    { t0: 15, t1: 20, air: 0.55, speed: 0.58, grain: 0.28, contact_style: 0.48 },
  ],
  preroll: 5,
};

export default spec;
