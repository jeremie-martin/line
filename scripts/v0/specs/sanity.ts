/**
 * Diagnostic spec — first Contact at t=0.5s so the rider has only 20 frames
 * of free fall before the first catch. Used to verify the v0 algorithm works
 * on physics-feasible specs, while the canonical first milestone (longer
 * initial fall) is studied separately.
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
    { t0: 0, t1: 6, air: 0.7 },
  ],
};

export default spec;
