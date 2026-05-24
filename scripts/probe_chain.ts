/**
 * Probe: run placeChain directly on the drums beat frames. This is the
 * "use the existing optimizer" strategy — bisect-on-y until each landing
 * fires AT the exact target frame.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { placeChain } from "./lib/primitive.ts";
import { simulateTrack, geometricMetrics, behavioralMetrics, coolScore, musicMetrics } from "./lib/metrics.ts";

const raw = JSON.parse(readFileSync("beats/drums_0_30s_60_125.json", "utf8"));
const onsetTimes: number[] = raw.onsets.map((o: any) => typeof o === "number" ? o : o.t);
const allBeats = onsetTimes.map((t) => Math.round(t * 40)).sort((a, b) => a - b);

// placeChain requires beats > 5. Also drop beats too close to each other (the
// rider can't physically land twice in <12 frames at sane speeds).
const MIN_FIRST = 30;
const MIN_GAP = 12;
const filtered: number[] = [];
let last = -Infinity;
for (const b of allBeats) {
  if (b < MIN_FIRST) continue;
  if (b - last < MIN_GAP) continue;
  filtered.push(b); last = b;
}
console.log(`beats: ${allBeats.length} total → ${filtered.length} after filter (min frame ${MIN_FIRST}, min gap ${MIN_GAP})`);

const t0 = Date.now();
const result = placeChain(filtered);
const elapsedMs = Date.now() - t0;
console.log(`placeChain: ${elapsedMs}ms, ${result.steps.length} landings attempted, all landings? ${result.allLandings}`);

// Per-beat exact alignment
const exact = result.steps.filter(s => s.actualFrame === s.targetFrame && s.eventType === "landing").length;
const eventTypes: Record<string, number> = {};
for (const s of result.steps) eventTypes[s.eventType] = (eventTypes[s.eventType] ?? 0) + 1;
console.log(`exact-frame landings: ${exact} / ${result.steps.length}`);
console.log(`event types: ${JSON.stringify(eventTypes)}`);

// Bench-style metrics
const det = simulateTrack(result.track);
const geom = geometricMetrics(result.track);
const behav = behavioralMetrics(det);
const cool = coolScore({ ...geom, ...behav });
const music = musicMetrics(det, allBeats, 2);
console.log(``);
console.log(`survived:           ${behav.survived ? "Y" : "N"} (${det.terminus.reason} @ ${det.terminus.frame})`);
console.log(`contactFraction:    ${behav.contactFractionLive.toFixed(2)}`);
console.log(`slowSlideFraction:  ${behav.slowSlideFraction.toFixed(2)}`);
console.log(`meanVxSliding:      ${behav.meanVxSliding.toFixed(2)}`);
console.log(`coolScore:          ${cool.toFixed(0)}`);
console.log(``);
console.log(`Music sync (vs ${allBeats.length} beats):`);
console.log(`  coverage:         ${music.eventCoveragePct.toFixed(1)}%`);
console.log(`  on-beat ±1:       ${music.onBeat1.toFixed(1)}%`);
console.log(`  on-beat ±2:       ${music.onBeat2.toFixed(1)}%`);
console.log(`  on-beat ±5:       ${music.onBeat5.toFixed(1)}%`);
console.log(`  on-beat ±10:      ${music.onBeat10.toFixed(1)}%`);
console.log(`  median offset:    ${music.medianBeatOffsetFrames.toFixed(1)}f`);
console.log(`  mean offset:      ${music.meanBeatOffsetFrames.toFixed(1)}f`);
console.log(`  p90 offset:       ${music.p90BeatOffsetFrames.toFixed(1)}f`);
console.log(`  max offset:       ${music.maxBeatOffsetFrames.toFixed(1)}f`);

const outPath = "generated/drums_60_125.landing_chain.track.json";
writeFileSync(outPath, JSON.stringify(result.track, null, 2));
console.log(`\nwrote ${outPath}`);
