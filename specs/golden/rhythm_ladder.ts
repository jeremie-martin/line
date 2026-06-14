/**
 * rhythm_ladder — uneven phrase rhythm with crossed axis changes.
 *
 * Contacts follow a repeating phrase rather than a steady grid. Each block
 * moves a different pair of axes so the optimizer cannot satisfy the spec by
 * leaning on one dominant style knob.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { migrateImpact } from "../../scripts/v0/core/beats.ts";

// stepped rungs: each phrase climbs the ladder soft→hard, then drops to start
// the next rung — a repeating stair-step of landing intensity.
const rungs = [0.2, 0.4, 0.6, 0.8, 0.95];
const contacts: Contact[] = [];
for (let base = 0.65; base < 18; base += 2.4) {
  [0.00, 0.30, 0.82, 1.38, 2.05].forEach((off, i) => {
    const t = base + off;
    if (t < 18) contacts.push({ t: Number(t.toFixed(3)), impact: migrateImpact(rungs[i]) });
  });
}

const spec: Spec = {
  duration: 18,
  contacts,
  axes: {
    air:           keyframes([{ t: 0, v: 0.35 }, { t: 4.5, v: 0.78 }, { t: 9, v: 0.48 }, { t: 13.5, v: 0.82 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.76 }, { t: 4.5, v: 0.50 }, { t: 9, v: 0.86 }, { t: 13.5, v: 0.64 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.65 }, { t: 4.5, v: 0.25 }, { t: 9, v: 0.72 }, { t: 13.5, v: 0.35 }], "hold"),
  },
  preroll: 5,
};

export default spec;
