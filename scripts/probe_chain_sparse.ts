import { readFileSync } from "node:fs";
import { placeChain } from "./lib/primitive.ts";
import { simulateTrack, geometricMetrics, behavioralMetrics, coolScore, musicMetrics } from "./lib/metrics.ts";

const raw = JSON.parse(readFileSync("beats/drums_0_30s_60_125.json", "utf8"));
const allBeatTimes: number[] = raw.onsets.map((o: any) => typeof o === "number" ? o : o.t);
const allBeats = allBeatTimes.map((t) => Math.round(t * 40)).sort((a, b) => a - b);

for (const step of [1, 2, 3, 4, 6, 8]) {
  // Take every Nth beat starting from frame >= 30
  const sub: number[] = [];
  let last = -Infinity;
  for (let i = 0; i < allBeats.length; i += step) {
    const b = allBeats[i];
    if (b < 30) continue;
    if (b - last < 8) continue;
    sub.push(b); last = b;
  }
  if (sub.length === 0) { console.log(`step=${step}: 0 beats`); continue; }
  const t0 = Date.now();
  let result; try { result = placeChain(sub); } catch (e) { console.log(`step=${step}: THREW ${String(e).slice(0,80)}`); continue; }
  const exact = result.steps.filter(s => s.actualFrame === s.targetFrame && s.eventType === "landing").length;
  const close = result.steps.filter(s => s.eventType === "landing" && Math.abs(s.actualFrame - s.targetFrame) <= 2).length;
  const det = simulateTrack(result.track);
  const m = behavioralMetrics(det);
  const c = coolScore({ ...geometricMetrics(result.track), ...m });
  const mm = musicMetrics(det, allBeats, 2);
  console.log(`step=${step} beats=${sub.length.toString().padStart(2)} ${(Date.now()-t0).toString().padStart(5)}ms surv=${m.survived?"Y":"N"}@${det.terminus.frame.toString().padStart(4)} exact=${exact}/${sub.length} within±2=${close}  onBeat1=${mm.onBeat1.toFixed(0)}% ±2=${mm.onBeat2.toFixed(0)}% ±5=${mm.onBeat5.toFixed(0)}% cool=${c.toFixed(0).padStart(4)}`);
}
