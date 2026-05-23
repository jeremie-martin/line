/**
 * Drum-onset-driven spec.
 *
 * Reads beats/drums_0_30s.json (90 onsets over 30s), filters to onsets
 * at least MIN_SPACING_FRAMES apart so the geometry has a fighting
 * chance, and emits a slide for each kept beat.
 *
 *   npm run ride -- --spec=specs/drums.ts --search
 *   npm run inspect -- --track=generated/drums.track.json --1080p --hq --render
 *
 * The filtering is necessary because the song has tight drum fills
 * (~0.16s gaps = 6 frames apart) that physics can't honor with the
 * current primitive set. Keeping only beats ≥ 15 frames apart preserves
 * the main pulse and drops the inner ornaments.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { slide } from "../scripts/lib/moves.ts";

const FPS = 40;
// Minimum frame the first move can target. Slide can't catch a rider that
// hasn't fallen far enough; empirically that's around frame 30 from spawn.
const MIN_FIRST_FRAME = 30;
// Minimum frame gap between beats. The detector's persistence rule requires
// ≥3 frames of contact for a landing event, so two distinct landings need
// at least ~5 frames separation. We use 6 to give a little margin — this
// keeps the fast drum-fill beats *in the spec* so the search has a chance
// at them (and so misses surface honestly).
const MIN_SPACING_FRAMES = 6;

const data = JSON.parse(readFileSync(resolve("beats/drums_0_30s.json"), "utf8")) as {
  onsets: number[];
};

const frames: number[] = [];
let last = -Infinity;
for (const t of data.onsets) {
  const f = Math.round(t * FPS);
  if (f < MIN_FIRST_FRAME) continue;
  if (f - last < MIN_SPACING_FRAMES) continue;
  frames.push(f);
  last = f;
}

console.error(`drums spec: ${data.onsets.length} onsets → ${frames.length} kept (≥${MIN_SPACING_FRAMES}-frame spacing)`);

export default frames.map((at) => slide({ at }));
