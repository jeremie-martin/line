import { readFileSync } from "node:fs";
import { simulateTrack, musicMetrics } from "./lib/metrics.ts";

const raw = JSON.parse(readFileSync("beats/drums_0_30s_60_125.json", "utf8"));
const beats = raw.onsets.map((o: any) => Math.round((typeof o === "number" ? o : o.t) * 40)).sort((a: number, b: number) => a - b);

for (const path of [
  "bench/music/drums_0_30s_60_125_compose_drop_brake_search.track.json",
  "bench/music/drums_0_30s_60_125_compose_drop_search.track.json",
  "bench/music/drums_0_30s_60_125_baseline_old.track.json",
]) {
  const t = JSON.parse(readFileSync(path, "utf8"));
  const det = simulateTrack(t);
  const mm = musicMetrics(det, beats, 2);
  console.log(`\n=== ${path.split("/").pop()} ===`);
  console.log(`beats: ${mm.beatCount}`);
  console.log(`coverage: ${mm.eventCoveragePct.toFixed(1)}%`);
  console.log(`on-beat at tolerance:`);
  console.log(`  ±0f (exact):     ${(mm.perBeatSignedOffsets.filter(x => x === 0).length / mm.beatCount * 100).toFixed(1)}%`);
  console.log(`  ±1f (25ms):      ${mm.onBeat1.toFixed(1)}%`);
  console.log(`  ±2f (50ms):      ${mm.onBeat2.toFixed(1)}%`);
  console.log(`  ±5f (125ms):     ${mm.onBeat5.toFixed(1)}%`);
  console.log(`  ±10f (250ms):    ${mm.onBeat10.toFixed(1)}%`);
  console.log(`offsets (frames):`);
  console.log(`  median:    ${mm.medianBeatOffsetFrames.toFixed(1)}f (${(mm.medianBeatOffsetFrames * 25).toFixed(0)} ms)`);
  console.log(`  mean:      ${mm.meanBeatOffsetFrames.toFixed(1)}f (${(mm.meanBeatOffsetFrames * 25).toFixed(0)} ms)`);
  console.log(`  p90:       ${mm.p90BeatOffsetFrames.toFixed(1)}f (${(mm.p90BeatOffsetFrames * 25).toFixed(0)} ms)`);
  console.log(`  max:       ${mm.maxBeatOffsetFrames.toFixed(1)}f (${(mm.maxBeatOffsetFrames * 25).toFixed(0)} ms)`);
  // Distribution of signed offsets (negative = early, positive = late)
  const matched = mm.perBeatSignedOffsets.filter((x): x is number => x !== null);
  const missed = mm.perBeatSignedOffsets.filter(x => x === null).length;
  console.log(`matched: ${matched.length}/${mm.beatCount} (${missed} beats had no event within ±20f)`);
  // histogram
  const buckets: Record<string, number> = {};
  for (const o of matched) {
    let key: string;
    if (Math.abs(o) === 0) key = "exact";
    else if (Math.abs(o) <= 1) key = "±1";
    else if (Math.abs(o) <= 2) key = "±2";
    else if (Math.abs(o) <= 5) key = "±3..5";
    else if (Math.abs(o) <= 10) key = "±6..10";
    else key = "±11..20";
    buckets[key] = (buckets[key] ?? 0) + 1;
  }
  console.log(`distribution of |offset|: ${JSON.stringify(buckets)}`);
  // Early vs late
  const early = matched.filter(o => o < 0).length;
  const late = matched.filter(o => o > 0).length;
  const exact = matched.filter(o => o === 0).length;
  console.log(`bias: ${early} early, ${exact} exact, ${late} late`);
}
