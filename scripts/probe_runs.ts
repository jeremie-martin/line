import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { simulateTrack, behavioralMetrics } from "./lib/metrics.ts";
import type { TrackJson } from "./lib/primitive.ts";

for (const dir of ["eval/references/cool", "eval/references/bland", "generated"]) {
  for (const f of readdirSync(dir).sort()) {
    if (!f.endsWith(".track.json")) continue;
    const p = resolve(dir, f);
    const t = JSON.parse(readFileSync(p, "utf8")) as TrackJson;
    if (t.lines.length === 0) continue;
    const d = simulateTrack(t);
    const m = behavioralMetrics(d);
    const longestAirFrac = m.longestAirborneRun / m.specFrames;
    console.log(`${dir}/${f.padEnd(40)} survived=${m.survived?"Y":"N"} contactFrac=${m.contactFractionLive.toFixed(2)} longestAirRun=${m.longestAirborneRun.toString().padStart(4)} (${(longestAirFrac*100).toFixed(0)}% of spec)`);
  }
}
