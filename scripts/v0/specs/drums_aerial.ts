/**
 * drums aerial — air=0.85. Rider should spend most time airborne, contacts
 * are brief taps. Exercises the high end of the air axis.
 */
import { drumsSpec } from "./_drums.ts";

const spec = drumsSpec([{ t0: 0, t1: 30, air: 0.85 }]);
export default spec;
