/**
 * Dynamics-aware supported trajectory proposals for long, low-air gaps.
 *
 * The sampled candidate supplies only the catch approach. From its contact
 * joint onward, authored grounded time and speed determine a near-linear
 * support boundary. Exact simulation remains the admission judge.
 */
import { MIN_LANDING_AIRBORNE_FRAMES } from "../../lib/detector.ts";
import { makeSolidLine } from "../arc.ts";
import {
  axisLookaheadEndFrame,
  tryCandidateLines,
} from "../core/candidate.ts";
import { registerCompileReset } from "../core/compile_lifecycle.ts";
import { supportExtensionPressure } from "../core/support_geometry.ts";
import {
  ELEVATION,
  authoredSpeedToPx,
  type Gap,
  type TrackLine,
} from "../types.ts";
import { nextContactGap } from "./objective.ts";
import type { SearchNode } from "./node.ts";
import {
  getCandidateProbe,
  type Candidate,
  type SpecContext,
} from "./sample.ts";

const CONTROLS = [
  { lengthScale: 0.94, angleResidualDeg: -0.75 },
  { lengthScale: 0.98, angleResidualDeg: 0 },
  { lengthScale: 1.02, angleResidualDeg: 0.75 },
] as const;

const kinematicCandidates = new WeakSet<Candidate>();

export type KinematicSupportPlan = {
  gapFrames: number;
  targetFlightFrames: number;
  targetGroundFrames: number;
  targetEntrySpeed: number;
  targetExitSpeed: number;
  targetLength: number;
  supportAngleDeg: number;
  extensionPressure: number;
};

export type KinematicSupportStats = {
  eligible_pools: number;
  exact_attempts: number;
  current_fits: number;
  forward_continuation_checks: number;
  emitted: number;
};

const totals: KinematicSupportStats = {
  eligible_pools: 0,
  exact_attempts: 0,
  current_fits: 0,
  forward_continuation_checks: 0,
  emitted: 0,
};

function resetKinematicSupportStats(): void {
  totals.eligible_pools = 0;
  totals.exact_attempts = 0;
  totals.current_fits = 0;
  totals.forward_continuation_checks = 0;
  totals.emitted = 0;
}
registerCompileReset(resetKinematicSupportStats);

export function snapshotKinematicSupportStats(): KinematicSupportStats | null {
  return totals.eligible_pools === 0 ? null : { ...totals };
}

export function kinematicSupportEnabled(): boolean {
  return process.env.LR_KINEMATIC_SUPPORT !== "0";
}

export function isKinematicSupportCandidate(candidate: Candidate | null): boolean {
  return candidate !== null && kinematicCandidates.has(candidate);
}

export function recordKinematicSupportContinuation(
  candidate: Candidate | null,
  reachable: boolean,
): void {
  if (!isKinematicSupportCandidate(candidate)) return;
  totals.forward_continuation_checks++;
  if (reachable) totals.emitted++;
}

export function planKinematicSupport(input: {
  air: number;
  gapFrames: number;
  entrySpeed: number;
  exitSpeed: number;
  referenceLength?: number;
}): KinematicSupportPlan {
  const gapFrames = Math.max(1, input.gapFrames);
  const minimumFlightFrames = MIN_LANDING_AIRBORNE_FRAMES;
  const targetFlightFrames = clamp(
    input.air * gapFrames,
    Math.min(gapFrames, minimumFlightFrames),
    gapFrames,
  );
  const targetGroundFrames = Math.max(0, gapFrames - targetFlightFrames);
  const targetEntrySpeed = Math.max(1, input.entrySpeed);
  const targetExitSpeed = Math.max(1, input.exitSpeed);
  const targetLength = Math.max(
    28,
    0.5 * (targetEntrySpeed + targetExitSpeed) * targetGroundFrames,
  );
  const acceleration = targetGroundFrames <= 0
    ? 0
    : (targetExitSpeed - targetEntrySpeed) / targetGroundFrames;
  const supportAngleDeg = Math.asin(clamp(
    acceleration / ELEVATION.GRAVITY_PX_PER_FRAME2,
    -1,
    1,
  )) * 180 / Math.PI;
  const extensionPressure = supportExtensionPressure({
    air: input.air,
    gapFrames,
    speed: targetEntrySpeed,
    referenceLength: input.referenceLength,
  });
  return {
    gapFrames,
    targetFlightFrames,
    targetGroundFrames,
    targetEntrySpeed,
    targetExitSpeed,
    targetLength,
    supportAngleDeg,
    extensionPressure,
  };
}

export function makeKinematicSupportCandidates(
  node: SearchNode,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
  lineIdStart: number,
  bases: readonly Candidate[],
): Candidate[] {
  if (!kinematicSupportEnabled() || bases.length === 0) return [];
  const nextGap = nextContactGap(gap, gaps);
  if (nextGap === null) return [];
  const nextTargets = ctx.gapAxisTargets?.[nextGap.index] ?? nextGap.targets;
  if (nextTargets.air === undefined) return [];

  const probe = getCandidateProbe(node.prefixEngine, gap, ctx);
  const base = bases[0];
  const joint = closestContactJoint(base.lines, probe.targetState.sledX, probe.targetState.sledY);
  if (joint === null) return [];
  const plan = planKinematicSupport({
    air: nextTargets.air,
    gapFrames: nextGap.endFrame - gap.endFrame,
    entrySpeed: probe.targetState.speed,
    exitSpeed: nextTargets.speed === undefined
      ? probe.targetState.speed
      : authoredSpeedToPx(nextTargets.speed),
    referenceLength: lineLength(base.lines.slice(joint.index)),
  });
  if (plan.extensionPressure <= 0) return [];
  totals.eligible_pools++;

  const prefix = base.lines.slice(0, joint.index);
  const source = base.lines[joint.index];
  const out: Candidate[] = [];
  for (const control of CONTROLS) {
    totals.exact_attempts++;
    const pressure = plan.extensionPressure;
    const lengthScale = 1 + (control.lengthScale - 1) * pressure;
    const angleDeg = plan.supportAngleDeg + control.angleResidualDeg * pressure;
    const lines = buildKinematicSupportLines(
      prefix,
      source.x1,
      source.y1,
      plan.targetLength * lengthScale,
      angleDeg,
      lineIdStart,
    );
    const fit = tryCandidateLines(
      node.prefixEngine,
      gap,
      lines,
      lineIdStart,
      ctx.allContactFrames,
      axisLookaheadEndFrame(gap, ctx.allContactFrames),
      gap.targets,
      true,
      "normal",
      probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit === null) continue;
    fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    kinematicCandidates.add(fit);
    totals.current_fits++;
    out.push(fit);
  }
  return out;
}

function closestContactJoint(
  lines: readonly TrackLine[],
  sledX: number,
  sledY: number,
): { index: number; distancePx: number } | null {
  if (lines.length < 2) return null;
  let best: { index: number; distancePx: number } | null = null;
  for (let index = 1; index < lines.length; index++) {
    const point = lines[index];
    const distancePx = Math.hypot(point.x1 - sledX, point.y1 - sledY);
    if (best === null || distancePx < best.distancePx) best = { index, distancePx };
  }
  return best;
}

function buildKinematicSupportLines(
  prefix: readonly TrackLine[],
  startX: number,
  startY: number,
  supportLength: number,
  supportAngleDeg: number,
  lineIdStart: number,
): TrackLine[] {
  const lines = prefix.map((line, index) => ({ ...line, id: lineIdStart + index }));
  const angle = supportAngleDeg * Math.PI / 180;
  lines.push(makeSolidLine(
    lineIdStart + lines.length,
    startX,
    startY,
    startX + Math.cos(angle) * supportLength,
    startY + Math.sin(angle) * supportLength,
  ));
  return lines;
}

function lineLength(lines: readonly TrackLine[]): number {
  return lines.reduce(
    (sum, line) => sum + Math.hypot(line.x2 - line.x1, line.y2 - line.y1),
    0,
  );
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}
