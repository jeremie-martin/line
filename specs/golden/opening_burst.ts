/**
 * opening_burst — starts immediately in a high-speed dense rhythm.
 *
 * The first three seconds ask for quarter-second contacts while speed and air
 * are already high. This keeps pre-roll/initial-state quality visible instead
 * of letting the compiler warm up during an easy intro.
 *
 *   [0–3s]  air 0.82  speed 0.94  grain 0.62
 *   [3–8s]  air 0.45  speed 0.72  grain 0.30
 *   [8–14s] air 0.78  speed 0.82  grain 0.72
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

const raw: Contact[] = [];
for (let t = 0.50; t <= 3.00 + 1e-6; t += 0.25) {
  raw.push({ t: Number(t.toFixed(3)) });
}
for (let t = 3.50; t < 14; t += 0.50) {
  raw.push({ t: Number(t.toFixed(3)) });
}
// hard, slamming opening burst that eases off into the quieter mid, then a
// modest lift as air rises again past t≈8.
const contacts: Contact[] = withImpactLegacy(raw, keyframes(
  [{ t: 0, v: 0.95 }, { t: 3, v: 0.85 }, { t: 4, v: 0.25 }, { t: 8, v: 0.3 }, { t: 12, v: 0.55 }],
  "smooth",
));

const spec: Spec = {
  duration: 14,
  contacts,
  axes: {
    air:           keyframes([{ t: 0, v: 0.82 }, { t: 3, v: 0.45 }, { t: 8, v: 0.78 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.94 }, { t: 3, v: 0.72 }, { t: 8, v: 0.82 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.62 }, { t: 3, v: 0.30 }, { t: 8, v: 0.72 }], "hold"),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
