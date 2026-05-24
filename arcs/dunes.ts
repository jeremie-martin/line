/**
 * Dunes: rolling descend/climb cycles. Speed oscillates between sections —
 * good for tracks where the music has clear dynamic phases.
 */
import type { Arc } from "../scripts/lib/arc.ts";

const arc: Arc = [
  { startSec: 0,  endSec: 5,  intent: "descend" },
  { startSec: 5,  endSec: 10, intent: "climb"   },
  { startSec: 10, endSec: 15, intent: "descend" },
  { startSec: 15, endSec: 20, intent: "climb"   },
  { startSec: 20, endSec: 25, intent: "descend" },
  { startSec: 25, endSec: 30, intent: "climb"   },
];

export default arc;
