/**
 * Sanity: build a small chain of landAt moves and verify each landing
 * fires AT the target frame.
 */
import { ride } from "./lib/ride.ts";
import { landAt } from "./lib/moves.ts";

const targets = [30, 60, 100, 140, 180, 230, 280, 340, 410, 480];
const HW = Number(process.env.HW ?? 8);
console.log(`halfWidth=${HW}`);
const moves = targets.map((f) => landAt({ at: f, halfWidth: HW }));

console.log(`Running ride() over ${moves.length} landAt moves...`);
const t0 = Date.now();
const result = ride(moves);
const ms = Date.now() - t0;

console.log(`survived=${result.survived ? "Y" : "N"} terminus=${result.detection.terminus.reason}@${result.detection.terminus.frame}  (${ms}ms)`);
console.log(`steps:`);
for (const step of result.steps) {
  const v = step.verdict;
  if (!v) { console.log(`  ${step.move.atFrame}: skipped (${step.skipReason ?? "?"})`); continue; }
  const obs = v.observed as any;
  const drift = v.drift.length > 0 ? `DRIFT: ${v.drift.map((d) => `${d.metric}=${d.actual}`).join(", ")}` : "";
  console.log(`  at=${step.move.atFrame.toString().padStart(4)} actual=${obs.actualLandingFrame.toString().padStart(4)} offset=${obs.offset.toString().padStart(2)} iters=${obs.bisectionIters}  ${drift}`);
}
