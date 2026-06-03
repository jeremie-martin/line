/**
 * tiny_dance — minimum-size spec (3s, 4 contacts). Anchors the runtime
 * cost floor: the elapsed time here is almost pure fixed overhead (worker
 * startup, lr-core init, preroll setup), with negligible per-contact work.
 *
 *   [0.0–1.5s]  air 0.45  speed 0.50  grain 0.45  contact 0.50
 *   [1.5–3.0s]  air 0.55  speed 0.55  grain 0.55  contact 0.45
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";

const spec: Spec = {
  duration: 3,
  contacts: [{ t: 0.55 }, { t: 1.15 }, { t: 1.85 }, { t: 2.55 }],
  axes: {
    air:           keyframes([{ t: 0, v: 0.45 }, { t: 1.5, v: 0.55 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.50 }, { t: 1.5, v: 0.55 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.45 }, { t: 1.5, v: 0.55 }], "hold"),
  },
  preroll: 5,
};

export default spec;
