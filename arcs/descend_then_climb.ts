/**
 * User's canonical arc: descend for the first half of the song to gain
 * speed, then climb in the second half to bleed it. Demonstrates energy
 * management via creative-control spec.
 *
 *   npm run bench:music -- --strategies=compose_arc_descend_climb
 */
import type { Arc } from "../scripts/lib/arc.ts";

const arc: Arc = [
  { startSec: 0,  endSec: 15, intent: "descend" },
  { startSec: 15, endSec: 30, intent: "climb"   },
];

export default arc;
