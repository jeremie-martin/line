import { readFileSync } from "node:fs";
import { simulateTrack } from "./lib/metrics.ts";

for (const path of process.argv.slice(2)) {
  const t = JSON.parse(readFileSync(path, "utf8"));
  const d = simulateTrack(t);
  const lastF = d.terminus.frame;
  console.log(`${path}`);
  console.log(`  terminus: ${JSON.stringify(d.terminus)}`);
  console.log(`  liveFrames=${d.summary.liveFrames}, specFrames=${d.summary.specFrames}`);
  console.log(`  lastPos: ${JSON.stringify(d.measurements.position[lastF])}`);
  console.log(`  lastVel: ${JSON.stringify(d.measurements.velocity[lastF])}`);
  console.log(`  events: ${d.events.length} (${d.events.filter(e => e.type === "landing").length} L, ${d.events.filter(e => e.type === "bounce").length} B, ${d.events.filter(e => e.type === "kick").length} K)`);
}
