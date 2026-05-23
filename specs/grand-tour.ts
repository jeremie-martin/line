/**
 * 30-second grand tour through the move catalog.
 *
 * Structure: tight 50-frame slide-chain anchors with occasional textural
 * moves where the rider's state permits. Glide stretches bleed speed so
 * the chain doesn't accumulate too much vy.
 *
 *   npm run ride -- --spec=specs/grand-tour.ts
 *   npm run inspect -- --track=generated/grand-tour.track.json --1080p --hq --render
 */
import {
  slide,
  halfPipe,
  sigmoid,
  wave,
  kicker,
  glide,
} from "../scripts/lib/moves.ts";

export default [
  // Act I — Open with slide chain, dip into a halfPipe
  slide   ({ at: 30 }),
  slide   ({ at: 80 }),
  halfPipe({ at: 130 }),
  slide   ({ at: 230 }),
  // Act II — Glide to bleed speed, then sigmoid surge
  glide   ({ at: 280 }),
  slide   ({ at: 420 }),
  sigmoid ({ at: 470 }),
  // Act III — Texture, sharp turn
  slide   ({ at: 570 }),
  wave    ({ at: 620 }),
  slide   ({ at: 700 }),
  kicker  ({ at: 750 }),
  slide   ({ at: 800 }),
  // Act IV — Slow back down and finish
  glide   ({ at: 850 }),
  slide   ({ at: 990 }),
  slide   ({ at: 1040 }),
  slide   ({ at: 1090 }),
  slide   ({ at: 1140 }),
];
