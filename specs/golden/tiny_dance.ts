/**
 * tiny_dance — minimum-size spec (3s, 4 contacts). Anchors the runtime
 * cost floor: the elapsed time here is almost pure fixed overhead (worker
 * startup, lr-core init, preroll setup), with negligible per-contact work.
 */
import type { Spec } from "../../scripts/v0/types.ts";

const spec: Spec = {
  duration: 3,
  contacts: [{ t: 0.55 }, { t: 1.15 }, { t: 1.85 }, { t: 2.55 }],
  sections: [
    { t0: 0, t1: 1.5, air: 0.45, speed: 0.50, grain: 0.45, contact_style: 0.50 },
    { t0: 1.5, t1: 3.0, air: 0.55, speed: 0.55, grain: 0.55, contact_style: 0.45 },
  ],
  preroll: 5,
};

export default spec;
