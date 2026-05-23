/**
 * Six chained slides at 50-frame spacing. Regression baseline — should
 * reproduce the slidechain-30-80-...-280 numbers (44% sliding, longest
 * 47f, mean vx 5.70, all survive).
 */
import { slide } from "../scripts/lib/moves.ts";

export default [
  slide({ at: 30 }),
  slide({ at: 80 }),
  slide({ at: 130 }),
  slide({ at: 180 }),
  slide({ at: 230 }),
  slide({ at: 280 }),
];
