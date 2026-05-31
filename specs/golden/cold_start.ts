/**
 * cold_start — preroll=0, no initial-velocity optimization affordance.
 *
 * Exercises the only spec path where the compiler must hit the first
 * contacts from the engine's default initial state. Per design, low air and
 * low speed are used so the cold-start regime is recoverable (a high-energy
 * cold start would be a different test entirely). Most production specs use
 * preroll>0; this spec exists so cold-start behavior is at least covered.
 *
 *   [0–4s]  air 0.30  speed 0.35  grain 0.40  contact 0.45
 *   [4–8s]  air 0.38  speed 0.42  grain 0.55  contact 0.55
 *   [8–12s] air 0.32  speed 0.40  grain 0.45  contact 0.40
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const contacts: Contact[] = [];
for (let t = 0.75; t < 12; t += 0.75) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

const spec: Spec = {
  duration: 12,
  contacts,
  axes: {
    air:           keyframes([{ t: 0, v: 0.30 }, { t: 4, v: 0.38 }, { t: 8, v: 0.32 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.35 }, { t: 4, v: 0.42 }, { t: 8, v: 0.40 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.40 }, { t: 4, v: 0.55 }, { t: 8, v: 0.45 }], "hold"),
    contact_style: keyframes([{ t: 0, v: 0.45 }, { t: 4, v: 0.55 }, { t: 8, v: 0.40 }], "hold"),
  },
  preroll: 0,
};

export default spec;
