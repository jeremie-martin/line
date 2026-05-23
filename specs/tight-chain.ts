/**
 * 30-frame spacing slide chain — the established "tight" pattern that
 * still survives. Stress-tests how strategies handle accumulated speed
 * across many quick landings.
 */
import { slide } from "../scripts/lib/moves.ts";
export default [
  slide({ at: 30 }),
  slide({ at: 60 }),
  slide({ at: 90 }),
  slide({ at: 120 }),
  slide({ at: 150 }),
  slide({ at: 180 }),
  slide({ at: 210 }),
  slide({ at: 240 }),
];
