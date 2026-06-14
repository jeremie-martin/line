/**
 * grain_staircase — isolates grain as direct arc-size intent.
 *
 * Speed and air stay constant while grain walks short → medium
 * → long → short. The intended pressure is visible line scale, not solving an
 * inverse timing problem through unrelated axes.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";
import { withImpactLegacy } from "../../scripts/v0/core/beats.ts";

const raw: Contact[] = [];
for (let t = 0.75; t < 20; t += 0.50) {
  raw.push({ t: Number(t.toFixed(3)) });
}
// impact climbs the same staircase as grain: stepped landing levels short→med→long→short
const contacts = withImpactLegacy(raw, (t) => (t < 5 ? 0.2 : t < 10 ? 0.45 : t < 15 ? 0.85 : 0.3));

const spec: Spec = {
  duration: 20,
  contacts,
  axes: {
    air: constant(0.55),
    speed: constant(0.58),
    grain: keyframes(
      [{ t: 0, v: 0.18 }, { t: 5, v: 0.45 }, { t: 10, v: 0.82 }, { t: 15, v: 0.28 }],
      "hold",
    ),
  },
  preroll: 5,
};

export default spec;
