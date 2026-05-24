/**
 * Swooping peak: build speed, hold level, peak (climb), then drop. A
 * three-act song arc: setup → tension → resolution.
 */
import type { Arc } from "../scripts/lib/arc.ts";

const arc: Arc = [
  { startSec: 0,  endSec: 10, intent: "descend" },
  { startSec: 10, endSec: 18, intent: "level"   },
  { startSec: 18, endSec: 24, intent: "climb"   },
  { startSec: 24, endSec: 30, intent: "descend" },
];

export default arc;
