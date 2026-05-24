/**
 * Sanity probe for landUp() — does it actually place a bisected landing
 * after an upward ramp?
 */
import { ride } from "./lib/ride.ts";
import { landUp, drop } from "./lib/moves.ts";

import { slide } from "./lib/moves.ts";

// Realistic drum-beat context (~19-frame spacing): descend (drops with
// brake every 3rd), then climb (drops alternating with landUps — the drop
// keeps the rider airborne after each landUp's terminal slide, so the
// next landUp has the airborne approach it needs to fire a landing).
const moves: any[] = [];
let f = 40;
// Descend
for (let i = 0; i < 8; i++) {
  moves.push((i + 1) % 3 === 0 ? slide({ at: f }) : drop({ at: f }));
  f += 19;
}
// Climb: drop → landUp → drop → landUp ...
for (let i = 0; i < 8; i++) {
  moves.push(i % 2 === 0 ? drop({ at: f }) : landUp({ at: f, slopeAngleDeg: -5 }));
  f += 19;
}

console.log(`Running ride() over ${moves.length} moves (3 drops + 5 landUps)...`);
const t0 = Date.now();
const result = ride(moves);
const ms = Date.now() - t0;

console.log(`survived=${result.survived ? "Y" : "N"} terminus=${result.detection.terminus.reason}@${result.detection.terminus.frame}  (${ms}ms)`);
console.log(`steps:`);
for (const step of result.steps) {
  const v = step.verdict;
  if (!v) { console.log(`  ${step.move.atFrame.toString().padStart(4)} ${step.move.type.padEnd(8)}: skipped (${step.skipReason ?? "?"})`); continue; }
  const obs = v.observed as any;
  const drift = v.drift.length > 0 ? `DRIFT: ${v.drift.map((d) => `${d.metric}=${d.actual}`).join(", ")}` : "";
  if (step.move.type === "landUp" || step.move.type === "landAt") {
    console.log(`  ${step.move.atFrame.toString().padStart(4)} ${step.move.type.padEnd(8)} actual=${obs.actualLandingFrame?.toString().padStart(4) ?? "—"} offset=${obs.offset?.toString().padStart(2) ?? "—"} iters=${obs.bisectionIters ?? "—"}  ${drift}`);
  } else {
    console.log(`  ${step.move.atFrame.toString().padStart(4)} ${step.move.type.padEnd(8)} ${JSON.stringify(obs)}  ${drift}`);
  }
}
