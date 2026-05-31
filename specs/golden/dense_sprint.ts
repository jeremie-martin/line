/**
 * dense_sprint — explicit-contact timing stressor with a hot start.
 *
 * The first real section starts fast and immediately asks for quarter-second
 * beat spacing. That makes preroll matter: the compiler has to arrive at
 * spec-frame 0 with enough useful velocity and contact history to survive a
 * dense opening burst, not gradually warm up during an easy intro.
 *
 *   [ 0– 4s]  sprint   high air, very fast, short contact, compact lines
 *   [ 4–10s]  brake    lower air, medium speed, short lines, long contact
 *   [10–20s]  carry    airy medium speed, long lines, long contact
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const contactTimes = [
  0.75, 1.00, 1.25, 1.50, 1.75,
];
for (let t = 2.25; t < 20; t += 0.5) {
  contactTimes.push(Number(t.toFixed(3)));
}

const spec: Spec = {
  duration: 20,
  contacts: contactTimes.map((t) => ({ t })),
  axes: {
    air:           keyframes([{ t: 0, v: 0.85 }, { t: 4, v: 0.35 }, { t: 10, v: 0.75 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.95 }, { t: 4, v: 0.55 }, { t: 10, v: 0.65 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.35 }, { t: 4, v: 0.25 }, { t: 10, v: 0.75 }], "hold"),
    contact_style: keyframes([{ t: 0, v: 0.20 }, { t: 4, v: 0.65 }, { t: 10, v: 0.75 }], "hold"),
  },
  preroll: 5,
};

export default spec;
