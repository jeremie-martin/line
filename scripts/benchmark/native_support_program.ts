/** Construct a physical support program directly, with no saved catch template. */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { LineRiderEngine as Judge, disposeAllWasmEnginesForStudy } from "../lib/_lr_engine_wasm.ts";
import { getRiderMetered, getPhysicsFrameCount, extractRawTrajectory, detect, setPhysicsFrameLimit } from "../lib/detector.ts";
import { pointwiseEnergyPulse } from "./pointwise_energy_pulse.ts";
import type { TrackLine } from "../v0/types.ts";
const arg = (name: string) => process.argv.find(a => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const backendPath = resolve(arg("backend") ?? "generated/benchmark-v2/unrestricted-650/planner-trace-backend");
const out = resolve(arg("out")!), frames = Number(arg("frames") ?? 100), angle = Number(arg("angle") ?? 0.15);
const wide = arg("wide") === "on", causalLag = Number(arg("causal-lag") ?? 1);
const period = Number(arg("period") ?? 0), airFraction = Number(arg("air") ?? 0.5);
const turnAmplitude = Number(arg("turn-amplitude") ?? 0);
const poseGain = Number(arg("pose-gain") ?? 0);
const backtrack = arg("backtrack") === "on", budget = Number(arg("budget") ?? 750000);
const hash = (b: string | Buffer) => createHash("sha256").update(b).digest("hex");
const read = (p: string) => {
  const b = readFileSync(p);
  if (hash(b) !== readFileSync(p + ".sha256", "utf8").split(/\s/)[0]) throw new Error("checksum mismatch");
  return JSON.parse(b.toString());
};
const manifest = read(resolve(backendPath, "manifest.json"));
for (const [p, h] of Object.entries(manifest.generated)) if (hash(readFileSync(resolve(backendPath, p))) !== h) throw new Error("backend changed");
const { LineRiderEngine: Engine, disposeAllWasmEnginesForStudy: disposeSearch } = await import(pathToFileURL(resolve(backendPath, "engine.ts")).href);
const startPosition = { x: 0, y: 0 }, startVelocity = { x: 10, y: 0 };
const desired = { x: 10 * Math.cos(angle), y: 10 * Math.sin(angle) }, rows: any[] = [], lines: TrackLine[] = [];
const started = getPhysicsFrameCount();
setPhysicsFrameLimit(started + budget - 2 * (frames + 20));
let failure: any = null, det: any = null, trajectory: any = null;
let backtracks = 0;
const banned = new Map<string, Set<string>>();
try {
  let engine = new Engine().setStart(startPosition, startVelocity);
  const initialPoints: any[] = Object.values(getRiderMetered(engine, 0).ballisticState().points);
  const initialMean = { x: initialPoints.reduce((s, p) => s + p.x, 0) / 10, y: initialPoints.reduce((s, p) => s + p.y, 0) / 10 };
  const shape = initialPoints.map(p => ({ x: p.x - initialMean.x, y: p.y - initialMean.y }));
  const rollback = () => {
    if (!backtrack) return null;
    let rowIndex = rows.length - 1;
    while (rowIndex >= 0 && rows[rowIndex].airborne) rowIndex--;
    if (rowIndex < 0) return null;
    const row = rows[rowIndex];
    const choices = banned.get(row.prefixKey) ?? new Set<string>();
    choices.add(row.choice); banned.set(row.prefixKey, choices);
    lines.length = row.lineStart; rows.length = rowIndex;
    disposeSearch(); engine = new Engine().setStart(startPosition, startVelocity).addLine(lines);
    backtracks++; failure = null;
    return row.frame - 1;
  };
  for (let frame = 1; frame <= frames; frame++) {
    const phase = period > 0 ? (frame - 1) % period : 0;
    if (period > 0 && phase >= Math.round(period * (1 - airFraction))) {
      const rider = getRiderMetered(engine, frame), state = rider.ballisticState();
      const contacted = engine.getUpdatesAtFrame(frame).some((u: any) => u.type === "CollisionUpdate" &&
        u.updated.some((p: any) => ["PEG", "TAIL", "NOSE", "STRING"].includes(p.id)));
      if (!state.riderMounted || !state.sledIntact || contacted) {
        failure = { frame, reason: !state.riderMounted || !state.sledIntact ? "airborne_binding" : "unplanned_contact" };
        const retry = rollback(); if (retry !== null) { frame = retry; continue; } break;
      }
      rows.push({ frame, lines: 0, error: 0, airborne: true });
      continue;
    }
    const requestedAngle = angle + turnAmplitude * (period > 0 ? Math.sin(2 * Math.PI * phase / period) : Math.sin(frame / 20));
    const desired = { x: 10 * Math.cos(requestedAngle), y: 10 * Math.sin(requestedAngle) };
    const preservedFrame = Math.max(0, frame - causalLag);
    const preserve = JSON.stringify(getRiderMetered(engine, preservedFrame).ballisticState());
    const predicted = getRiderMetered(engine, frame + 1), future = predicted.ballisticState();
    engine.prepareCollisionTrace(frame); getRiderMetered(engine, frame);
    const trace = engine.readCollisionTrace();
    const prefixKey = `${frame}:${hash(JSON.stringify(lines))}`;
    let best: any = null;
    const failures: Record<string, number> = {};
    for (const iteration of (wide ? [0, 1, 3, 5] : [0, 5])) for (const width of (wide ? [0.005, 0.0005, 0.00005] : [0.05, 0.005]))
      for (const forceScale of (wide ? [1, 0.5, 0.75, 1.25, 1.5] : [1, 0.75, 1.25])) {
      const choice = `${iteration}:${width}:${forceScale}`;
      if (banned.get(prefixKey)?.has(choice)) continue;
      const points = Object.keys(trace[iteration]).map(id => ({ ...trace[iteration][id],
        nextVx: future.points[id].vx, nextVy: future.points[id].vy }));
      const center = { x: points.reduce((s, p) => s + p.x, 0) / 10, y: points.reduce((s, p) => s + p.y, 0) / 10 };
      const pointTargets = points.map((p, i) => ({ x: desired.x + poseGain * (shape[i].x - p.x + center.x),
        y: desired.y + poseGain * (shape[i].y - p.y + center.y) }));
      const added = pointwiseEnergyPulse(points, desired, predicted.velocity, true, 0.0001, width, 1000 + frame * 10000,
        { forceScale, spacing: 0.00001, pointTargets });
      const child = engine.addLine(added);
      if (JSON.stringify(getRiderMetered(child, preservedFrame).ballisticState()) !== preserve) {
        failures.prefix = (failures.prefix ?? 0) + 1; continue;
      }
      const result = getRiderMetered(child, frame + 1).ballisticState();
      if (!result.riderMounted || !result.sledIntact) { failures.binding = (failures.binding ?? 0) + 1; continue; }
      let grounded = true;
      for (let contactFrame = Math.max(1, preservedFrame + 1); contactFrame <= frame; contactFrame++) grounded &&=
        child.getUpdatesAtFrame(contactFrame).some((u: any) => u.type === "CollisionUpdate" &&
          u.updated.some((p: any) => ["PEG", "TAIL", "NOSE", "STRING"].includes(p.id)));
      if (!grounded) { failures.airborne = (failures.airborne ?? 0) + 1; continue; }
      const error = Object.values(result.points).reduce((sum: number, p: any, i) =>
        sum + (p.vx - pointTargets[i].x) ** 2 + (p.vy - pointTargets[i].y) ** 2, 0) as number;
      if (!best || error < best.error) best = { engine: child, lines: added, error, iteration, width, forceScale, choice };
    }
    if (!best) { failure = { frame, failures }; const retry = rollback(); if (retry !== null) { frame = retry; continue; } break; }
    const lineStart = lines.length;
    engine = best.engine; lines.push(...best.lines);
    rows.push({ frame, lines: best.lines.length, error: best.error, iteration: best.iteration, width: best.width, forceScale: best.forceScale,
      lineStart, prefixKey, choice: best.choice });
    if (frame % 8 === 0) { engine = engine.detach(); Engine.retainOnly([engine]); }
  }
  setPhysicsFrameLimit(started + budget);
  trajectory = extractRawTrajectory(engine, rows.length + 20);
  det = detect(trajectory);
} finally { disposeSearch(); }
try {
  const replay = extractRawTrajectory(new Judge().setStart(startPosition, startVelocity).addLine(lines), rows.length + 20);
  if (JSON.stringify(replay) !== JSON.stringify(trajectory)) throw new Error("fixed-engine replay mismatch");
} finally { disposeAllWasmEnginesForStudy(); }
const report = { schema: "line.native-support-program.v1", researchOnly: true, angle, requestedFrames: frames,
  wide, causalLag, period, airFraction, turnAmplitude, poseGain, backtrack, backtracks, budget,
  implementation: [fileURLToPath(import.meta.url), "scripts/benchmark/pointwise_energy_pulse.ts"].map(p => hash(readFileSync(p))),
  backendManifestSha256: hash(readFileSync(resolve(backendPath, "manifest.json"))),
  frames: getPhysicsFrameCount() - started, completedFrames: rows.length, failure, rows, terminus: det.terminus,
  events: det.events, meanPointVelocityError: Math.sqrt(rows.reduce((s, r) => s + r.error, 0) / Math.max(1, rows.length) / 10),
  track: { startPosition, riders: [{ startVelocity }], lines, duration: rows.length + 20 } };
const body = JSON.stringify(report) + "\n";
writeFileSync(out, body); writeFileSync(out + ".sha256", hash(body) + "\n");
console.log(JSON.stringify({ ...report, rows: undefined, track: { lines: lines.length } }));
