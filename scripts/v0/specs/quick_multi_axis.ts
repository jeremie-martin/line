/**
 * Fast multi-axis goal spec.
 *
 * Same contact cadence as sanity.ts, but asks for multiple section axes so
 * the goal output exercises axis reporting without running a 30-second song.
 */

import type { Spec } from "../types.ts";

const spec: Spec = {
  duration: 6,
  contacts: [
    { t: 0.5 },
    { t: 1.5 },
    { t: 2.5 },
    { t: 3.5 },
    { t: 4.5 },
    { t: 5.5 },
  ],
  sections: [
    { t0: 0, t1: 6, air: 0.7, grain: 0.8, speed: 0.5 },
  ],
};

export default spec;
