/**
 * Showcase composition — slide → halfPipe → slide.
 * Demonstrates compositional sliding + a valley + a recovery slide.
 *
 *   npm run ride -- --spec=specs/showcase.ts
 *   npm run inspect -- --track=generated/showcase.track.json --1080p --hq
 *
 * Note: this spec uses ≤70-frame gaps between moves. Wider gaps cause
 * vy to accumulate, which makes the next move's catch geometry fail —
 * see PROBLEM.md "Minimum chainable spacing." For wide-spacing support
 * we'd need adaptive curve geometry that scales with incoming speed.
 */
import { slide, halfPipe } from "../scripts/lib/moves.ts";

export default [
  slide({ at: 30 }),
  halfPipe({ at: 90 }),
  slide({ at: 160 }),
];
