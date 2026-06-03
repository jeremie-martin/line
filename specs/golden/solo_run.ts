/**
 * solo_run — sustained dense passage (~25s, ~80 contacts). Pushes contact
 * count well beyond the current suite max (55) to test whether per-contact
 * compile cost stays small or starts to grow nonlinearly.
 *
 *   [ 0– 8s]  air 0.50  speed 0.65  grain 0.45  contact 0.50
 *   [ 8–17s]  air 0.55  speed 0.72  grain 0.55  contact 0.45
 *   [17–25s]  air 0.50  speed 0.68  grain 0.50  contact 0.55
 */
import type { Contact, Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const contacts: Contact[] = [];
for (let t = 0.40; t < 25; t += 0.32) {
  contacts.push({ t: Number(t.toFixed(3)) });
}

const spec: Spec = {
  duration: 25,
  contacts,
  axes: {
    air:           keyframes([{ t: 0, v: 0.50 }, { t: 8, v: 0.55 }, { t: 17, v: 0.50 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.65 }, { t: 8, v: 0.72 }, { t: 17, v: 0.68 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.45 }, { t: 8, v: 0.55 }, { t: 17, v: 0.50 }], "hold"),
  },
  preroll: 5,
};

export default spec;
