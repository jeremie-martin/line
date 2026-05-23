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
const MIN_SPACING_FRAMES = 15;
// First slide needs the rider to fall far enough that the adapter can place
// catch geometry — empirically that's around frame 30 from default spawn.
// Beats earlier than this are dropped (acknowledged drift on the audio).
const MIN_FIRST_FRAME = 30;

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
