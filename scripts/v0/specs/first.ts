/**
 * v0 first milestone — small spec sufficient to validate the architecture
 * end-to-end. 10 seconds, 5 Contacts, a constant `air = 0.7` target.
 */

import type { Spec } from "../types.ts";
import { constant } from "../core/curves.ts";

const spec: Spec = {
  duration: 10,
  contacts: [
    { t: 2.0 },
    { t: 4.0 },
    { t: 6.0 },
    { t: 8.0 },
    { t: 9.5 },
  ],
  axes: { air: constant(0.7) },
};

export default spec;
