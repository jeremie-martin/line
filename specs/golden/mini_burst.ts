/**
 * mini_burst — short spec (~5s, ~7 contacts) to exercise the per-contact
 * budget floor. Confirms small specs no longer get a free runtime pass under
 * the affine soft/hard budget; gives the optimizer one tiny case where every
 * single contact matters.
 *
 *   [0.0–2.5s]  air 0.55  speed 0.65  grain 0.50
 *   [2.5–5.0s]  air 0.70  speed 0.55  grain 0.65
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpact } from "../../scripts/v0/core/beats.ts";

// a short burst: soft ramp-in to one hard mid-phrase accent, then back off.
const burst = [0.2, 0.4, 0.6, 0.95, 0.55, 0.35, 0.25];
const raw: Contact[] = [];
for (let t = 0.60; t < 5.0; t += 0.65) {
  raw.push({ t: Number(t.toFixed(3)) });
}
const contacts: Contact[] = withImpact(raw, (_t, i) => burst[i] ?? 0.3);

const spec: Spec = {
  duration: 5,
  contacts,
  axes: {
    air:           keyframes([{ t: 0, v: 0.55 }, { t: 2.5, v: 0.70 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.65 }, { t: 2.5, v: 0.55 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.50 }, { t: 2.5, v: 0.65 }], "hold"),
  },
  preroll: 5,
};

export default spec;
