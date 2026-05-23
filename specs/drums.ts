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
import { slide, catch_ } from "../scripts/lib/moves.ts";

const FPS = 40;
const MIN_FIRST_FRAME = 30;
const MIN_SPACING_FRAMES = 6;
/** Beats within this many frames of the previous beat get a short
 * `catch_` (single-frame stub) instead of a `slide` (20-frame catch
 * window). Slides overlap at tight spacings; catches don't. */
const TIGHT_SPACING_FRAMES = 15;

const data = JSON.parse(readFileSync(resolve("beats/drums_0_30s.json"), "utf8")) as {
  onsets: number[];
};

type BeatPlan = { frame: number; kind: "slide" | "catch" };
const plan: BeatPlan[] = [];
let last = -Infinity;
for (const t of data.onsets) {
  const f = Math.round(t * FPS);
  if (f < MIN_FIRST_FRAME) continue;
  if (f - last < MIN_SPACING_FRAMES) continue;
  const kind = f - last < TIGHT_SPACING_FRAMES ? "catch" : "slide";
  plan.push({ frame: f, kind });
  last = f;
}

const counts = { slide: plan.filter((p) => p.kind === "slide").length, catch: plan.filter((p) => p.kind === "catch").length };
console.error(`drums spec: ${data.onsets.length} onsets → ${plan.length} kept (${counts.slide} slide + ${counts.catch} catch)`);

export default plan.map(({ frame, kind }) =>
  kind === "slide" ? slide({ at: frame }) : catch_({ at: frame }),
);
