/**
 * Easiest possible spec: a single slide from spawn. Used as a benchmark
 * lower-bound — should survive cleanly under every strategy.
 */
import { slide } from "../scripts/lib/moves.ts";
export default [slide({ at: 30 })];
