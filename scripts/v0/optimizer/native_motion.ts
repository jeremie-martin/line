/** ARCHIVED RESEARCH — outside the current coherent-arc product constraint.
 * Uses acceleration and point controls; retained for reproducing the archived proof of concept.
 * Production routing is in handoff.ts; current construction is in connected_arcs.ts. */
/** Physical native motion construction. Authored targets and the evaluation
 * engine remain unchanged. No benchmark source identity enters this compiler. */
import { createHash } from "node:crypto";
import { LineRiderEngine as NativeEngine, disposeAllWasmEnginesForStudy as disposeSearch } from "../../lib/native_motion/engine.ts";
import { LineRiderEngine as Judge, disposeAllWasmEnginesForStudy } from "../../lib/_lr_engine_wasm.ts";
import { getRiderMetered, getPhysicsFrameCount, extractRawTrajectory, detect, setPhysicsFrameLimit, PhysicsFrameLimitExceeded, resetFrameCount } from "../../lib/detector.ts";
import { sliceTimeline, effectiveAxes, buildDriftReport, buildTrackJson, resolveStartState, validateSpec, sampleGapTargets } from "../core/substrate.ts";
import { resetPerCompileState } from "../core/compile_lifecycle.ts";
import { makeRng } from "../../lib/rng.ts";
import { CompileBudgetTelemetryRecorder, type BudgetTelemetryLevel } from "./budget_telemetry.ts";
import { pointwiseEnergyPulse } from "./native_pointwise_energy.ts";
import { nativeMotionSchedule, scheduleNativeContacts } from "./native_motion_schedule.ts";
import { impactToRawPx, wrapPi, CALIB, type TrackLine, type Spec } from "../types.ts";
import type { CompileCheckpoint } from "./types.ts";
const Engine: any = NativeEngine;
const hash = (b: string) => createHash("sha256").update(b).digest("hex");
export function compileNativeMotion(spec: Spec, seed: number,
  options: { budget: number; budgetTelemetry?: BudgetTelemetryLevel; onProgress?: (frame: number, frames: number) => void }): CompileCheckpoint {
  const budget = options.budget, poseGain = 0.15, feedbackImpact = true;
  if (!Number.isSafeInteger(seed) || !Number.isSafeInteger(budget) || budget <= 0) throw new Error("invalid native compiler input");
  validateSpec(spec);
  resetPerCompileState();
  resetFrameCount();
  try {
const contactFrames = spec.contacts.map(c => Math.round(c.t * 40)), duration = Math.round(spec.duration * 40);
const motionDuration = Math.max(duration, (contactFrames.at(-1) ?? 0) + 7);
const gaps = sliceTimeline(contactFrames, duration);
for (const gap of gaps) {
  gap.targets = effectiveAxes(gap, spec);
  if (gap.endsWithContact && spec.contacts[gap.index].impact !== undefined) gap.targets.impact = spec.contacts[gap.index].impact;
}
const scheduleOptions = { drift: 0.15, amplitudeScale: 1, impact: false };
const rng = makeRng(seed);
const motionGapInputs = gaps.map(g => ({ ...g }));
if (motionDuration > duration) {
  const last = motionGapInputs.at(-1);
  if (last && !last.endsWithContact) last.endFrame = motionDuration;
  else motionGapInputs.push({ index: gaps.length, startFrame: duration, endFrame: motionDuration, endsWithContact: false, targets: {} });
}
const motionGaps = scheduleNativeContacts(motionGapInputs.map(g => ({ ...g,
  targets: { ...g.targets, ...sampleGapTargets(g.targets, spec.jitter ?? CALIB.SIGMA, rng) } })));

const schedule = nativeMotionSchedule(motionGaps, motionDuration, scheduleOptions);
const fixedStart = spec.start || !(spec.preroll && spec.preroll > 0) ? resolveStartState(spec) : null;
const startPosition = fixedStart?.position ?? { x: 0, y: 0 }, startVelocity = fixedStart?.velocity ?? schedule.desired[0];
const rows: any[] = [], lines: TrackLine[] = [], banned = new Map<string, Set<string>>();
let lineage = hash("[]"), failure: any = null, backtracks = 0, trajectory: any = null;
const started = getPhysicsFrameCount();
let candidateSamples = 0, viableCandidates = 0, constructionFrames = 0;
const recorder = new CompileBudgetTelemetryRecorder({ level: options.budgetTelemetry ?? "summary", gaps, durationFrames: duration,
  hardBudgetFrames: budget, policyBudgetFrames: budget,
  model: { name: "native-motion-structural/v1", source: "native_motion.ts nominal two-frame proposal evaluation", interceptFrames: 0,
    contactFrames: 0, durationFrameScale: 120 } });
const episode = recorder.startEpisode({ lane: "initial", searchSeed: seed, frontierHasFallbackLane: false,
  anchorGapIndex: 0, startTotalSpentFrames: 0, ceilingTotalSpentFrames: budget, includeStartup: false });
const controls = [0, 1, 3, 5].flatMap(iteration => [0.005, 0.0005, 0.00005].flatMap(width =>
  [1, 0.5, 0.75, 1.25, 1.5].map(forceScale => ({ iteration, width, forceScale }))));
const proposalLimit = Math.max(4, Math.min(controls.length, Math.floor((budget - 2 * (duration + 20)) /
  Math.max(1, 2.5 * schedule.grounded.filter(Boolean).length))));
const proposals = proposalLimit === controls.length ? controls : Array.from({ length: proposalLimit }, (_, i) =>
  controls[Math.floor(i * controls.length / proposalLimit)]);
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
    for (let frame = 1; frame <= motionDuration; frame++) {
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
        const owningGap = motionGaps.find(g => g.endsWithContact && g.endFrame <= frame && frame < g.endFrame + 6);
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
      for (const { iteration, width, forceScale } of proposals) {
        const choice = `${iteration}:${width}:${forceScale}`;
        if (banned.get(prefixKey)?.has(choice)) continue;
        candidateSamples++;
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
        viableCandidates++;
        const error = Object.values(result.points).reduce((sum: number, p: any, i) => sum + (p.vx - pointTargets[i].x) ** 2 + (p.vy - pointTargets[i].y) ** 2, 0) as number;
        if (!best || error < best.error) best = { engine: child, lines: added, error, iteration, width, forceScale, choice };
      }
      if (!best) { failure = { frame, failures }; const retry = rollback(); if (retry !== null) { frame = retry; continue; } break; }
      const lineStart = lines.length, oldLineage = lineage;
      engine = best.engine; lines.push(...best.lines); lineage = hash(lineage + JSON.stringify(best.lines));
      rows.push({ frame, lines: best.lines.length, error: best.error, lineStart, prefixKey, lineage: oldLineage, choice: best.choice });
      if (frame % 8 === 0) { engine = engine.detach(); Engine.retainOnly([engine]); }
      if (contactFrames.includes(frame)) recorder.observeActiveEpisode(contactFrames.indexOf(frame) + 1, getPhysicsFrameCount() - started);
      options.onProgress?.(frame, getPhysicsFrameCount() - started);
    }
  } catch (error) {
    if (!(error instanceof PhysicsFrameLimitExceeded)) throw error;
    failure = { frame: rows.length + 1, reason: "budget", previous: failure };
  }
  constructionFrames = getPhysicsFrameCount() - started;
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

const track = buildTrackJson(lines, duration + 20, { position: startPosition, velocity: startVelocity });
const total = getPhysicsFrameCount() - started, exhausted = failure?.reason === "budget";
const valid = report.contacts.every(c => c.status === "hit") && !report.off_beat_landings.length && report.terminus.reason === "endOfSpec";
recorder.setActiveCandidateWork({ actualCandidateSamples: candidateSamples, viableCandidates, candidateSamplesByStream: { normal: candidateSamples } });
recorder.recordEvaluation({ totalSpentFrames: total, gapIndex: rows.length === motionDuration ? gaps.length : gaps.findIndex(g => g.endFrame >= rows.length),
  terminal: rows.length === motionDuration, origin: "frontier", firstTimeSearchNode: true, terminalTrackKey: hash(JSON.stringify(track)), registerImproved: valid });
recorder.endEpisode(total, exhausted ? "budget_capture" : "compile_finished");
recorder.recordSegment("initial_search", 0, constructionFrames, "construction_complete", episode);
recorder.recordSegment("finalization", constructionFrames, total, "cold_replay_complete", episode);
const costs = gaps.map(g => report.gaps.find(r => r.gap_index === g.index)?.axes)
  .map(axes => axes ? Object.values(axes).reduce((sum, axis) => sum + (axis?.error ?? 0) ** 2, 0) : null);
return { budget, track, report, budgetTelemetry: recorder.snapshot(total, exhausted, valid ? total : null, valid ? total : null),
  stats: { actual_candidate_samples: candidateSamples, viable_candidate_samples: viableCandidates,
    engine_rebuilds: backtracks + 2, gap_commits: report.contacts.filter(c => c.status === "hit").length,
    gap_backtracks: backtracks, validation_retries: 0, polish_iterations: 0,
    total_committed_cost: costs.reduce<number>((sum, cost) => sum + (cost ?? 0), 0), committed_costs_per_gap: costs,
    sim_frames: total, ballistic_micro_sim_frames: 0, budget_exhausted: exhausted,
    first_completion_frame: valid ? total : null } };
  } finally { disposeSearch(); disposeAllWasmEnginesForStudy(); setPhysicsFrameLimit(null); }
}
