/**
 * Two slides 200 frames apart. Tests how strategies handle accumulated
 * vy from a long airborne gap. Expected: ALL strategies struggle here —
 * this is the physical-limit case where Phase C (composition-level
 * intervention) would be needed.
 *
 * Useful as a regression: if a future change suddenly makes wide gaps
 * work, that's a notable improvement; if a change makes the easy specs
 * regress while this one stays the same, that's a red flag.
 */
import { slide } from "../scripts/lib/moves.ts";
export default [
  slide({ at: 30 }),
  slide({ at: 230 }),
];
