/**
 * tiny_dance — minimum-size spec (3s, 4 contacts). Anchors the runtime
 * cost floor: the elapsed time here is almost pure fixed overhead (worker
 * startup, lr-core init, preroll setup), with negligible per-contact work.
 *
 *   [0.0–1.5s]  air 0.45  speed 0.50  grain 0.45
 *   [1.5–3.0s]  air 0.55  speed 0.55  grain 0.55
 */
import type { Spec } from "../../scripts/v0/types.ts";
import { keyframes } from "../../scripts/v0/core/curves.ts";
import { migrateImpact } from "../../scripts/v0/core/beats.ts";

const spec: Spec = {
  duration: 3,
  // per-beat impact: a little dance — soft, lift, soft, accent on the last.
  contacts: [{ t: 0.55, impact: migrateImpact(0.2) }, { t: 1.15, impact: migrateImpact(0.5) }, { t: 1.85, impact: migrateImpact(0.3) }, { t: 2.55, impact: migrateImpact(0.85) }],
  axes: {
    air:           keyframes([{ t: 0, v: 0.45 }, { t: 1.5, v: 0.55 }], "hold"),
    speed:         keyframes([{ t: 0, v: 0.50 }, { t: 1.5, v: 0.55 }], "hold"),
    grain:         keyframes([{ t: 0, v: 0.45 }, { t: 1.5, v: 0.55 }], "hold"),
  },
  jitter: 0,
  preroll: 5,
};

export default spec;
