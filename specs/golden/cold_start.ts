/**
 * cold_start — preroll=0, no initial-velocity optimization affordance.
 *
 * Exercises the only spec path where the compiler must hit the first
 * contacts from the engine's default initial state. Per design, low air and
 * low speed are used so the cold-start regime is recoverable (a high-energy
 * cold start would be a different test entirely). Most production specs use
 * preroll>0; this spec exists so cold-start behavior is at least covered.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";

const contacts: Contact[] = [];
for (let t = 0.75; t < 12; t += 0.75) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

const spec: Spec = {
  duration: 12,
  contacts,
  sections: [
    { t0: 0, t1: 4, air: 0.30, speed: 0.35, grain: 0.40, contact_style: 0.45 },
    { t0: 4, t1: 8, air: 0.38, speed: 0.42, grain: 0.55, contact_style: 0.55 },
    { t0: 8, t1: 12, air: 0.32, speed: 0.40, grain: 0.45, contact_style: 0.40 },
  ],
  preroll: 0,
};

export default spec;
