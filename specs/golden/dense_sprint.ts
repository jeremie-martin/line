/**
 * dense_sprint — explicit-contact timing stressor with a hot start.
 *
 * The first real section starts fast and immediately asks for quarter-second
 * beat spacing. That makes preroll matter: the compiler has to arrive at
 * spec-frame 0 with enough useful velocity and contact history to survive a
 * dense opening burst, not gradually warm up during an easy intro.
 *
 *   §0 [ 0– 4s]  sprint   high air, very fast, short contact, compact lines
 *   §1 [ 4–10s]  brake    lower air, medium speed, short lines, long contact
 *   §2 [10–20s]  carry    airy medium speed, long lines, long contact
 */
import type { Spec } from "../../scripts/v0/types.ts";

const contactTimes = [
  0.75, 1.00, 1.25, 1.50, 1.75,
];
for (let t = 2.25; t < 20; t += 0.5) {
  contactTimes.push(Number(t.toFixed(3)));
}

const spec: Spec = {
  duration: 20,
  contacts: contactTimes.map((t) => ({ t })),
  sections: [
    { t0:  0, t1:  4, air: 0.85, speed: 0.95, grain: 0.35, contact_style: 0.20 },
    { t0:  4, t1: 10, air: 0.35, speed: 0.55, grain: 0.25, contact_style: 0.65 },
    { t0: 10, t1: 20, air: 0.75, speed: 0.65, grain: 0.75, contact_style: 0.75 },
  ],
  preroll: 5,
};

export default spec;
