import { readFileSync } from "node:fs";
import { placeSlideChain } from "./lib/primitive.ts";
import { simulateTrack, geometricMetrics, behavioralMetrics, coolScore, musicMetrics } from "./lib/metrics.ts";

const raw = JSON.parse(readFileSync("beats/drums_0_30s_60_125.json", "utf8"));
const allBeatTimes: number[] = raw.onsets.map((o: any) => typeof o === "number" ? o : o.t);
const allBeats = allBeatTimes.map((t) => Math.round(t * 40)).sort((a, b) => a - b);

for (const step of [1, 2, 3, 4]) {
  const sub: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < allBeats.length; i += step) {
    const b = allBeats[i];
    if (b < 30) continue;
    if (b - last < 8) continue;
    sub.push(b); last = b;
  }
  if (sub.length === 0) continue;
  const t0 = Date.now();
  let result; try { result = placeSlideChain(sub); } catch (e) { console.log(`step=${step}: THREW ${String(e).slice(0,80)}`); continue; }
  const det = simulateTrack(result.track);
  const m = behavioralMetrics(det);
  const c = coolScore({ ...geometricMetrics(result.track), ...m });
  const mm = musicMetrics(det, allBeats, 2);
  console.log(`step=${step} beats=${sub.length.toString().padStart(2)} ${(Date.now()-t0).toString().padStart(5)}ms surv=${m.survived?"Y":"N"}@${det.terminus.frame.toString().padStart(4)}  onBeat ±1=${mm.onBeat1.toFixed(0)}% ±2=${mm.onBeat2.toFixed(0)}% ±5=${mm.onBeat5.toFixed(0)}% medOff=${mm.medianBeatOffsetFrames.toFixed(0)}f maxOff=${mm.maxBeatOffsetFrames.toFixed(0)}f cool=${c.toFixed(0).padStart(4)}`);
}
