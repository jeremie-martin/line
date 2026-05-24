/**
 * Drum-onset-driven spec — 60-125 BPM variant.
 *
 * Reads beats/drums_0_30s_60_125.json (63 onsets over 30s), same shape
 * as specs/drums.ts but pinned to the BPM-filtered beats file the user
 * is investigating.
 *
 *   npm run ride -- --spec=specs/drums_60_125.ts --search
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { slide, catch_ } from "../scripts/lib/moves.ts";

const FPS = 40;
const MIN_FIRST_FRAME = 30;
const MIN_SPACING_FRAMES = 6;
const TIGHT_SPACING_FRAMES = 15;

const raw = JSON.parse(readFileSync(resolve("beats/drums_0_30s_60_125.json"), "utf8")) as {
  onsets: Array<number | { t: number; votes?: number; sources?: string[] }>;
};
const onsetTimes: number[] = raw.onsets.map((o) =>
  typeof o === "number" ? o : o.t,
);

type BeatPlan = { frame: number; kind: "slide" | "catch" };
const plan: BeatPlan[] = [];
let last = -Infinity;
for (const t of onsetTimes) {
  const f = Math.round(t * FPS);
  if (f < MIN_FIRST_FRAME) continue;
  if (f - last < MIN_SPACING_FRAMES) continue;
  const kind = f - last < TIGHT_SPACING_FRAMES ? "catch" : "slide";
  plan.push({ frame: f, kind });
  last = f;
}

const counts = {
  slide: plan.filter((p) => p.kind === "slide").length,
  catch: plan.filter((p) => p.kind === "catch").length,
};
console.error(`drums_60_125 spec: ${onsetTimes.length} onsets → ${plan.length} kept (${counts.slide} slide + ${counts.catch} catch)`);

export default plan.map(({ frame, kind }) =>
  kind === "slide" ? slide({ at: frame }) : catch_({ at: frame }),
);
