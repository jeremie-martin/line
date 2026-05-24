import { readFileSync } from "node:fs";
import { composeWithBeats } from "./lib/route.ts";
import { simulateTrack, geometricMetrics, behavioralMetrics, coolScore, musicMetrics } from "./lib/metrics.ts";

const raw = JSON.parse(readFileSync("beats/drums_0_30s_60_125.json", "utf8"));
const beats = raw.onsets.map((o: any) => Math.round((typeof o === "number" ? o : o.t) * 40)).sort((a,b)=>a-b);

const cfgs = [
  { halfLen: 4, offsetDown: 2, lead: 8 },
  { halfLen: 3, offsetDown: 2, lead: 8 },
  { halfLen: 3, offsetDown: 1, lead: 8 },
  { halfLen: 2, offsetDown: 2, lead: 8 },
  { halfLen: 5, offsetDown: 3, lead: 8 },
];

for (const tplName of ["swooping", "staccato", "aerial"]) {
  const route = (await import(`../templates/${tplName}.ts`)).default;
  console.log(`\n=== ${tplName} ===`);
  for (const c of cfgs) {
    const { track, fit } = composeWithBeats(route, beats, {
      bumpHalfLengthPx: c.halfLen,
      bumpOffsetDownPx: c.offsetDown,
      leadFrames: c.lead,
      label: `${tplName}_fit`,
      durationFrames: 1200,
    });
    const det = simulateTrack(track);
    const m = behavioralMetrics(det);
    const cs = coolScore({ ...geometricMetrics(track), ...m });
    const mm = musicMetrics(det, beats, 2);
    console.log(`  halfLen=${c.halfLen} offsetDown=${c.offsetDown}: surv=${m.survived?"Y":"N"} terminus=${det.terminus.frame.toString().padStart(4)} slowSlide=${m.slowSlideFraction.toFixed(2)} placed=${fit.placedBeats.length}/${fit.attemptedBeats.length} cov=${mm.eventCoveragePct.toFixed(0).padStart(3)}% onBeat=${mm.onBeatAdherencePct.toFixed(0).padStart(3)}% cool=${cs.toFixed(0).padStart(4)}`);
  }
}
