/**
 * grain_staircase — isolates grain as direct arc-size intent.
 *
 * Speed, air, and contact style stay constant while grain walks short → medium
 * → long → short. The intended pressure is visible line scale, not solving an
 * inverse timing problem through unrelated axes.
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { constant, keyframes } from "../../scripts/v0/core/curves.ts";

const contacts: Contact[] = [];
for (let t = 0.75; t < 20; t += 0.50) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

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
