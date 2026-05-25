/**
 * v0 first milestone — small spec sufficient to validate the architecture
 * end-to-end. 10 seconds, 5 Contacts, one Section with `air = 0.7`.
 * See ../../../DESIGN.md § First milestone.
 */

import type { Spec } from "../types.ts";

const spec: Spec = {
  duration: 10,
  contacts: [
    { t: 2.0 },
    { t: 4.0 },
    { t: 6.0 },
    { t: 8.0 },
    { t: 9.5 },
  ],
  sections: [
    { t0: 0, t1: 10, air: 0.7 },
  ],
};

export default spec;
