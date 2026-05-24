/**
 * Diagnostic: profile rider speed and contact over a track's lifetime to
 * detect "stuck in pit" failure modes.
 */
import { readFileSync } from "node:fs";
import { simulateTrack } from "./lib/metrics.ts";

for (const path of process.argv.slice(2)) {
  const t = JSON.parse(readFileSync(path, "utf8"));
  const d = simulateTrack(t);
  const m = d.measurements;
  const lastF = d.terminus.frame;

  // Bin frames into 10 equal time slices.
  const BINS = 10;
  const slice = Math.ceil((lastF + 1) / BINS);
  console.log(`\n${path}`);
  console.log(`  terminus: ${d.terminus.reason} @ frame ${d.terminus.frame}`);
  console.log(`  contactFractionLive: ${d.summary.contactFractionLive.toFixed(3)}`);
  console.log(`  meanVxSliding (full): ${d.summary.meanVxSliding.toFixed(2)}`);
  console.log(`  bin   contactPct  meanVxInContact  meanSpeed  netDx`);
  for (let b = 0; b < BINS; b++) {
    const a = b * slice;
    const z = Math.min((b + 1) * slice, lastF + 1);
    let contact = 0, sumVx = 0, sumSpeed = 0, cFrames = 0;
    for (let f = a; f < z; f++) {
      if (!m.airborne[f]) { contact++; sumVx += m.velocity[f].x; cFrames++; }
      sumSpeed += Math.hypot(m.velocity[f].x, m.velocity[f].y);
    }
    const netDx = m.position[z - 1].x - m.position[a].x;
    const dur = z - a;
    console.log(
      `  ${b}    ${((contact / dur) * 100).toFixed(0).padStart(3)}%      ` +
      `${(cFrames > 0 ? sumVx / cFrames : 0).toFixed(2).padStart(7)}        ` +
      `${(sumSpeed / dur).toFixed(2).padStart(7)}   ${netDx.toFixed(0).padStart(6)}`,
    );
  }
}
