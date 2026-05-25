/**
 * drums grounded — air=0.45. Rider spends more time in contact than airborne.
 * Exercises the low end of the air axis; complements drums_aerial.
 */
import { drumsSpec } from "./_drums.ts";

const spec = drumsSpec([{ t0: 0, t1: 30, air: 0.45 }]);
export default spec;
