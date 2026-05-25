/**
 * Diagnostic: probe the first milestone's first gap directly.
 * Generate K candidates, log what each does, classify failures.
 */

import { LineRiderEngine, createLineFromJson } from "../lib/_lr_engine.ts";
import { detect, extractRawTrajectory } from "../lib/detector.ts";
import { makeRng } from "../lib/rng.ts";
import { arcToLines } from "./arc.ts";
import { CALIB, type Arc } from "./types.ts";

const targetFrame = 80; // first Contact at t=2.0s, fps=40

const baseEngine = new LineRiderEngine();
const rawNoArc = extractRawTrajectory(baseEngine, targetFrame + 20);
const f = rawNoArc.frames[targetFrame];
console.log(`Rider at frame ${targetFrame} (no Arc): pos=(${f.position.x.toFixed(2)}, ${f.position.y.toFixed(2)})  vel=(${f.velocity.x.toFixed(2)}, ${f.velocity.y.toFixed(2)})  |v|=${Math.hypot(f.velocity.x, f.velocity.y).toFixed(2)}`);
console.log("");

const rng = makeRng(42);
const A = CALIB.ARC;

let stats = {
  total: 0,
  noLandingNear: 0,
  landedButDied: 0,
  landedSurvived: 0,
  landedSurvivedPrecise: 0,
};

const K = 80;
for (let i = 0; i < K; i++) {
  const startAngleDeg = A.START_ANGLE_MIN_DEG + rng() * (A.START_ANGLE_MAX_DEG - A.START_ANGLE_MIN_DEG);
  const endAngleDeg = A.END_ANGLE_MIN_DEG + rng() * (A.END_ANGLE_MAX_DEG - A.END_ANGLE_MIN_DEG);
  const length = A.LENGTH_MIN + rng() * (A.LENGTH_MAX - A.LENGTH_MIN);
  const segments = A.SEGMENTS_MIN + Math.floor(rng() * (A.SEGMENTS_MAX - A.SEGMENTS_MIN + 1));
  const curveBias = -1 + 2 * rng();
  const anchorXOffset = A.ANCHOR_X_OFFSET_MIN + rng() * (A.ANCHOR_X_OFFSET_MAX - A.ANCHOR_X_OFFSET_MIN);

  // Sweep Y to find any that catches at frame ~80
  for (let dy = -10; dy <= 20; dy += 2) {
    const arc: Arc = {
      anchor: { x: f.position.x - length / 2 + anchorXOffset, y: f.position.y + dy },
      length, startAngleDeg, endAngleDeg, segments, curveBias,
    };
    const lines = arcToLines(arc, 1);
    // deno-lint-ignore no-explicit-any
    let eng: any = baseEngine;
    for (const ln of lines) eng = eng.addLine(createLineFromJson(ln));
    const raw = extractRawTrajectory(eng, targetFrame + 30);
    const det = detect(raw);
    const owned = new Set(lines.map((l) => l.id));
    const landing = det.events.find(
      (e) => e.type === "landing"
        && Math.abs(e.frame - targetFrame) <= 6
        && (det.measurements.contactLineIds[e.frame] ?? []).some((id) => owned.has(id)),
    );
    if (landing) {
      const diedFrame = det.terminus.frame;
      const lived = diedFrame >= landing.frame + 16 || det.terminus.reason === "endOfSpec";
      if (lived) {
        stats.landedSurvived++;
        if (Math.abs(landing.frame - targetFrame) <= 1) stats.landedSurvivedPrecise++;
        if (stats.landedSurvived <= 3) {
          console.log(`  SURVIVED: arc(start=${startAngleDeg.toFixed(0)}° end=${endAngleDeg.toFixed(0)}° len=${length.toFixed(0)} seg=${segments} dy=${dy})  → landed at frame ${landing.frame}, lived to ${diedFrame} (${det.terminus.reason})`);
        }
      } else {
        stats.landedButDied++;
        if (stats.landedButDied <= 3) {
          console.log(`  DIED:     arc(start=${startAngleDeg.toFixed(0)}° end=${endAngleDeg.toFixed(0)}° len=${length.toFixed(0)} seg=${segments} dy=${dy})  → landed at ${landing.frame}, died at ${diedFrame} (${det.terminus.reason})`);
        }
      }
    } else {
      stats.noLandingNear++;
    }
    stats.total++;
  }
  break; // try just ONE parameter set across the Y sweep first
}

console.log("");
console.log(`Stats over ${stats.total} (arc, dy) combos:`);
console.log(`  no landing near target:        ${stats.noLandingNear}`);
console.log(`  landed but died (within 16f):  ${stats.landedButDied}`);
console.log(`  landed and survived:           ${stats.landedSurvived}`);
console.log(`    of which precise (±1f):      ${stats.landedSurvivedPrecise}`);
