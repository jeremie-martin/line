/** Research compiler from authored targets to ordinary native geometry. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { LineRiderEngine as Judge, disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { getRiderMetered, getPhysicsFrameCount, extractRawTrajectory, detect, setPhysicsFrameLimit, PhysicsFrameLimitExceeded } from "../lib/detector.ts";
import { sliceTimeline, effectiveAxes, buildDriftReport } from "../v0/core/substrate.ts";
import { buildAxisContract, scoreV2Report } from "../v0/benchmark_v2/evaluator.ts";
import { pointwiseEnergyPulse } from "./pointwise_energy_pulse.ts";
import { nativeMotionSchedule } from "./native_motion_schedule.ts";
import { impactToRawPx, wrapPi, type TrackLine } from "../v0/types.ts";

const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const backendPath = resolve(arg("backend") ?? "generated/benchmark-v2/unrestricted-650/planner-trace-backend");
const sourceId = arg("source")!, out = resolve(arg("out")!);
const budget = Number(arg("budget") ?? 750000), poseGain = Number(arg("pose-gain") ?? 0.15);
const feedbackImpact = arg("feedback-impact") === "on";
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const implementation = [fileURLToPath(import.meta.url), "scripts/benchmark/native_motion_schedule.ts", "scripts/benchmark/pointwise_energy_pulse.ts"]
  .map(p => hash(readFileSync(p)));
const read = (p: string) => {
  const b = readFileSync(p);
  if (hash(b) !== readFileSync(p + ".sha256", "utf8").split(/\s/)[0]) throw new Error("checksum mismatch");
  return JSON.parse(b.toString());
};
const manifest = read(resolve(backendPath, "manifest.json"));
for (const [p, h] of Object.entries(manifest.generated)) if (hash(readFileSync(resolve(backendPath, p))) !== h) throw new Error("backend changed");
const { LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: disposeSearch } = await import(pathToFileURL(resolve(backendPath, "engine.ts")).href);
const spec = applyJolt(developmentCases.find(e => e.case.metadata.id === sourceId)!.case.spec, benchmarkPolicy.transform.joltMs);
const contactFrames = spec.contacts.map(c => Math.round(c.t * 40)), duration = Math.round(spec.duration * 40);
const gaps = sliceTimeline(contactFrames, duration);
for (const gap of gaps) {
  gap.targets = effectiveAxes(gap, spec);
  if (gap.endsWithContact && spec.contacts[gap.index].impact !== undefined) gap.targets.impact = spec.contacts[gap.index].impact;
}
const scheduleOptions = { drift: Number(arg("drift") ?? 0.15), amplitudeScale: Number(arg("amplitude-scale") ?? 1), impact: arg("impact") === "on" };
const schedule = nativeMotionSchedule(gaps, duration, scheduleOptions);
const startPosition = { x: 0, y: 0 }, startVelocity = schedule.desired[0];
const rows: any[] = [], lines: TrackLine[] = [], banned = new Map<string, Set<string>>();
let lineage = hash("[]"), failure: any = null, backtracks = 0, trajectory: any = null;
const started = getPhysicsFrameCount(), wallStart = performance.now();
setPhysicsFrameLimit(started + budget - 2 * (duration + 20));
const contacted = (engine: any, frame: number) => engine.getUpdatesAtFrame(frame).some((u: any) => u.type === "CollisionUpdate" &&
  u.updated.some((p: any) => ["PEG", "TAIL", "NOSE", "STRING"].includes(p.id)));
try {
  let engine = new Engine().setStart(startPosition, startVelocity);
  const initialPoints: any[] = Object.values(getRiderMetered(engine, 0).ballisticState().points);
  const mean = { x: initialPoints.reduce((s, p) => s + p.x, 0) / 10, y: initialPoints.reduce((s, p) => s + p.y, 0) / 10 };
  const shape = initialPoints.map(p => ({ x: p.x - mean.x, y: p.y - mean.y }));
  const rollback = () => {
    let rowIndex = rows.length - 1;
    while (rowIndex >= 0 && rows[rowIndex].airborne) rowIndex--;
    if (rowIndex < 0) return null;
    const row = rows[rowIndex], choices = banned.get(row.prefixKey) ?? new Set<string>();
    choices.add(row.choice); banned.set(row.prefixKey, choices);
    lines.length = row.lineStart; rows.length = rowIndex; lineage = row.lineage;
    disposeSearch(); engine = new Engine().setStart(startPosition, startVelocity).addLine(lines);
    backtracks++; failure = null;
    return row.frame - 1;
  };
  try {
    for (let frame = 1; frame <= duration; frame++) {
      if (!schedule.grounded[frame]) {
        const state = getRiderMetered(engine, frame).ballisticState();
        if (!state.riderMounted || !state.sledIntact || contacted(engine, frame)) {
          failure = { frame, reason: !state.riderMounted || !state.sledIntact ? "airborne_binding" : "unplanned_contact" };
          const retry = rollback(); if (retry !== null) { frame = retry; continue; } break;
        }
        rows.push({ frame, lines: 0, airborne: true }); continue;
      }
      const preserve = JSON.stringify(getRiderMetered(engine, frame - 1).ballisticState());
      const predicted = getRiderMetered(engine, frame + 1), future = predicted.ballisticState();
      engine.prepareCollisionTrace(frame); getRiderMetered(engine, frame);
      const trace = engine.readCollisionTrace(), prefixKey = `${frame}:${lineage}`;
      let desired = schedule.desired[frame];
      if (feedbackImpact && schedule.grounded[frame + 1]) {
        const owningGap = gaps.find(g => g.endsWithContact && g.endFrame <= frame && frame < g.endFrame + 6);
        if (owningGap?.targets.impact !== undefined) {
          let previous = getRiderMetered(engine, owningGap.endFrame - 1).velocity, raw = 0;
          for (let f = owningGap.endFrame; f <= frame; f++) {
            const v = getRiderMetered(engine, f).velocity;
            if (contacted(engine, f)) raw += (Math.hypot(previous.x, previous.y) + Math.hypot(v.x, v.y)) / 2 *
              Math.abs(wrapPi(Math.atan2(v.y, v.x) - Math.atan2(previous.y, previous.x)));
            previous = v;
          }
          const remaining = Math.max(0, impactToRawPx(owningGap.targets.impact) - raw);
          const slots = schedule.grounded.slice(frame + 1, owningGap.endFrame + 7).filter(Boolean).length;
          const pace = Math.hypot(desired.x, desired.y), angle = Math.atan2(previous.y, previous.x);
          const delta = Math.min(0.7, remaining / Math.max(1, slots) / ((pace + Math.hypot(previous.x, previous.y)) / 2));
          const intended = Math.atan2(desired.y, desired.x), sign = wrapPi(intended - angle) >= 0 ? 1 : -1;
          desired = { x: pace * Math.cos(angle + sign * delta), y: pace * Math.sin(angle + sign * delta) };
        }
      }
      let best: any = null;
      const failures: Record<string, number> = {};
      for (const iteration of [0, 1, 3, 5]) for (const width of [0.005, 0.0005, 0.00005]) for (const forceScale of [1, 0.5, 0.75, 1.25, 1.5]) {
        const choice = `${iteration}:${width}:${forceScale}`;
        if (banned.get(prefixKey)?.has(choice)) continue;
        const points = Object.keys(trace[iteration]).map(id => ({ ...trace[iteration][id], nextVx: future.points[id].vx, nextVy: future.points[id].vy }));
        const center = { x: points.reduce((s, p) => s + p.x, 0) / 10, y: points.reduce((s, p) => s + p.y, 0) / 10 };
        const pointTargets = points.map((p, i) => ({ x: desired.x + poseGain * (shape[i].x - p.x + center.x), y: desired.y + poseGain * (shape[i].y - p.y + center.y) }));
        const added = pointwiseEnergyPulse(points, desired, predicted.velocity, true, 0.0001, width, 1000 + frame * 10000,
          { forceScale, spacing: 0.00001, pointTargets });
        if (added.length >= 10000) throw new Error("geometry id range exhausted");
        const child = engine.addLine(added);
        if (JSON.stringify(getRiderMetered(child, frame - 1).ballisticState()) !== preserve) { failures.prefix = (failures.prefix ?? 0) + 1; continue; }
        const result = getRiderMetered(child, frame + 1).ballisticState();
        if (!result.riderMounted || !result.sledIntact) { failures.binding = (failures.binding ?? 0) + 1; continue; }
        if (!contacted(child, frame)) { failures.airborne = (failures.airborne ?? 0) + 1; continue; }
        const error = Object.values(result.points).reduce((sum: number, p: any, i) => sum + (p.vx - pointTargets[i].x) ** 2 + (p.vy - pointTargets[i].y) ** 2, 0) as number;
        if (!best || error < best.error) best = { engine: child, lines: added, error, iteration, width, forceScale, choice };
      }
      if (!best) { failure = { frame, failures }; const retry = rollback(); if (retry !== null) { frame = retry; continue; } break; }
      const lineStart = lines.length, oldLineage = lineage;
      engine = best.engine; lines.push(...best.lines); lineage = hash(lineage + JSON.stringify(best.lines));
      rows.push({ frame, lines: best.lines.length, error: best.error, lineStart, prefixKey, lineage: oldLineage, choice: best.choice });
      if (frame % 8 === 0) { engine = engine.detach(); Engine.retainOnly([engine]); }
      if (contactFrames.includes(frame)) process.stderr.write(`${sourceId}: ${frame}/${duration}, ${getPhysicsFrameCount() - started} frames, ${backtracks} backtracks\n`);
    }
  } catch (error) {
    if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
    failure = { frame: rows.length + 1, reason: "budget", previous: failure };
  }
  setPhysicsFrameLimit(started + budget);
  trajectory = extractRawTrajectory(engine, duration + 20);
} finally { disposeSearch(); }
try {
  const replay = extractRawTrajectory(new Judge().setStart(startPosition, startVelocity).addLine(lines), duration + 20);
  if (JSON.stringify(replay) !== JSON.stringify(trajectory)) throw new Error("fixed-engine replay mismatch");
} finally { disposeAllWasmEnginesForStudy(); }
const det = detect(trajectory);
const fits = gaps.map(gap => ({ lines: lines.filter(l => Math.floor((l.id - 1000) / 10000) > gap.startFrame && Math.floor((l.id - 1000) / 10000) <= gap.endFrame) }));
const report = buildDriftReport(det, spec, gaps, contactFrames, duration, [], fits as any, gaps.map(g => g.targets));
const suite = JSON.parse(readFileSync("benchmark/v2/compat/suite-manifest.json", "utf8"));
const contract = buildAxisContract(spec, Object.keys(benchmarkPolicy.componentWeights) as any);
const score = scoreV2Report(report, spec.contacts.length, contract, suite);
const track = { startPosition, riders: [{ startVelocity }], lines, duration: duration + 20 };
const record = { schema: "line.direct-native-compiler.v1", researchOnly: true, sourceId, implementation,
  backendManifestSha256: hash(readFileSync(resolve(backendPath, "manifest.json"))), scheduleOptions, feedbackImpact, poseGain, budget,
  frames: getPhysicsFrameCount() - started, elapsedMs: performance.now() - wallStart, completedFrames: rows.length,
  failure, backtracks, score, schedule: schedule.rows, rows, track, report };
const body = JSON.stringify(record) + "\n";
writeFileSync(out, body); writeFileSync(out + ".sha256", hash(body) + "\n");
console.log(JSON.stringify({ ...record, schedule: undefined, rows: undefined, track: { lines: lines.length }, report: undefined }));
