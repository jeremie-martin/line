/**
 * drums chunky — air=0.7 baseline + grain=0.8 (long line segments).
 * Exercises a second axis at the same time as air. Useful comparison against
 * drums_baseline to see whether grain visibly affects shape.
 */
import { drumsSpec } from "./_drums.ts";

const spec = drumsSpec([{ t0: 0, t1: 30, air: 0.7, grain: 0.8 }]);
export default spec;
