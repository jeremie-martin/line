/**
 * cold_start — low-energy opening: very low air and speed at the first
 * contacts, ramping up. Stresses the compiler's ability to arrive gently and
 * stay slow early (the opposite of the dense high-speed specs).
 *
 * Uses the default preroll like every production spec: no real spec omits
 * preroll, so the compiler is given the usual permission to choose an initial
 * velocity that arrives at the first contact already in stride rather than
 * spinning up violently from the engine's rest state. (The former preroll=0
 * "from-default" variant was removed as an unrealistic scenario.)
 *
 *   [0–4s]  air 0.30  speed 0.35  grain 0.40
 *   [4–8s]  air 0.38  speed 0.42  grain 0.55
 *   [8–12s] air 0.32  speed 0.40  grain 0.45
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

const raw: Contact[] = [];
for (let t = 0.75; t < 12; t += 0.75) {
  raw.push({ t: Number(t.toFixed(3)) });
}
// impact warms up from a cold open: barely-there graze landings that ramp to firm by the end
const contacts = withImpact(raw, (t) => 0.1 + 0.65 * (t / 12));

const spec: Spec = {
  duration: 12,
  contacts,
  axes: {
    air:           keyframes([{ t: 0, v: 0.30 }, { t: 4, v: 0.38 }, { t: 8, v: 0.32 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.35 }, { t: 4, v: 0.42 }, { t: 8, v: 0.40 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.40 }, { t: 4, v: 0.55 }, { t: 8, v: 0.45 }], "hold"),
  },
  // Inherits the default preroll (PREROLL.DEFAULT_S) like every other spec.
};

export default spec;
