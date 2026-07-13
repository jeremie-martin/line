/**
 * Exact state-relative proposer for detector-limited contact cadence.
 *
 * A one-frame change in support duration decides whether the detector can
 * observe the next authored landing. The normal sampler remains the primary
 * pool; this lane runs only when its measured releases expose no runway and
 * competes through the unchanged exact evaluator and quality objective.
 */
import {
  getRiderMetered,
  MIN_LANDING_AIRBORNE_FRAMES,
} from "../../lib/detector.ts";
import { makeSolidLine } from "../arc.ts";
import { readTargetStateFromRider } from "../arc_placement.ts";
import {
  axisLookaheadEndFrame,
  tryCandidateLines,
} from "../core/candidate.ts";
import { registerCompileReset } from "../core/compile_lifecycle.ts";
import type { Gap, TrackLine } from "../types.ts";
import { nextContactGap } from "./objective.ts";
import {
  getCandidateProbe,
  type Candidate,
  type SpecContext,
} from "./sample.ts";

const PHASE_FRAMES = 4;
const TURN_DEG = 24;
const PRE_LENGTH_FRAMES = 3.5;
const POST_LENGTH_FRAMES = 1.75;
const POST_SEGMENTS = 8;
const MAX_RUNWAY_SLACK_FRAMES = 3;

const SHALLOW_APPROACH_DELTA_DEG = 3;
const SHALLOW_TANGENT_FRAMES = 1.4;
const STEEP_TANGENT_FRAMES = 2.1;

export type DetectorRunwayControl = {
  approachDeltaDeg: number;
  tangentFrames: number;
};

export type DetectorRunwayStats = {
  eligible_pools: number;
  exact_attempts: number;
  emitted: number;
  pool_entries: number;
  rank0: number;
  top3: number;
  rank_sum: number;
  pool_size_sum: number;
};

const runwayTotals: DetectorRunwayStats = {
  eligible_pools: 0,
  exact_attempts: 0,
  emitted: 0,
  pool_entries: 0,
  rank0: 0,
  top3: 0,
  rank_sum: 0,
  pool_size_sum: 0,
};

function resetDetectorRunwayStats(): void {
  for (const key of Object.keys(runwayTotals) as Array<keyof DetectorRunwayStats>) {
    runwayTotals[key] = 0;
  }
}
registerCompileReset(resetDetectorRunwayStats);

export function snapshotDetectorRunwayStats(): DetectorRunwayStats | null {
  return runwayTotals.eligible_pools === 0 ? null : { ...runwayTotals };
}

export function recordDetectorRunwayPoolRanks(
  candidates: Candidate[],
  sortedPool: Candidate[],
): void {
  for (const candidate of candidates) {
    const rank = sortedPool.indexOf(candidate);
    if (rank < 0) continue;
    runwayTotals.pool_entries++;
    if (rank === 0) runwayTotals.rank0++;
    if (rank < 3) runwayTotals.top3++;
    runwayTotals.rank_sum += rank;
    runwayTotals.pool_size_sum += sortedPool.length;
  }
}

export function detectorRunwayEnabled(): boolean {
  return process.env.LR_DETECTOR_RUNWAY !== "0";
}

export function detectorRunwaySpacingEligible(spacingFrames: number): boolean {
  const slack = spacingFrames - MIN_LANDING_AIRBORNE_FRAMES;
  return slack >= 1 && slack <= MAX_RUNWAY_SLACK_FRAMES;
}

export function makeDetectorRunwayCandidates(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
  lineIdStart: number,
  incumbents: Candidate[],
): Candidate[] {
  if (!detectorRunwayEnabled()) return [];
  const nextGap = nextContactGap(gap, gaps);
  if (nextGap === null) return [];
  const spacingFrames = nextGap.endFrame - gap.endFrame;
  if (!detectorRunwaySpacingEligible(spacingFrames)) return [];
  if (gap.endFrame < PHASE_FRAMES) return [];
  if (incumbents.some((candidate) => leavesDetectorRunway(candidate, nextGap.endFrame))) return [];
  runwayTotals.eligible_pools++;

  const probe = getCandidateProbe(engine, gap, ctx);
  const rider = getRiderMetered(engine, gap.endFrame - PHASE_FRAMES);
  const phaseState = readTargetStateFromRider(rider, probe.targetState.sledX, probe.targetState.sledY);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  runwayTotals.exact_attempts++;
  const lines = buildDetectorRunwayLines(phaseState, lineIdStart);
  const fit = tryCandidateLines(
    engine,
    gap,
    lines,
    lineIdStart,
    ctx.allContactFrames,
    axisMeasureEnd,
    gap.targets,
    true,
    "normal",
    probe.preTargetSledTrace,
  ) as Candidate | null;
  if (fit === null) return [];
  runwayTotals.emitted++;
  return [fit];
}

function leavesDetectorRunway(candidate: Candidate, nextContactFrame: number): boolean {
  const release = candidate.releaseArrivalState;
  return release !== undefined && release.airborne &&
    nextContactFrame - release.frame >= MIN_LANDING_AIRBORNE_FRAMES - 1;
}

function buildDetectorRunwayLines(
  phaseState: ReturnType<typeof readTargetStateFromRider>,
  lineIdStart: number,
): TrackLine[] {
  const speed = Math.max(1, phaseState.speed);
  const { approachDeltaDeg, tangentFrames } = detectorRunwayControl(phaseState.angleDeg);
  const approachAngleDeg = phaseState.angleDeg + approachDeltaDeg;
  const approach = (approachAngleDeg * Math.PI) / 180;
  const tx = Math.cos(approach);
  const ty = Math.sin(approach);
  const nx = -ty;
  const ny = tx;
  const tangentOffset = speed * tangentFrames;
  const contact = {
    x: phaseState.sledX + tx * tangentOffset - nx * 0.5,
    y: phaseState.sledY + ty * tangentOffset - ny * 0.5,
  };
  const lines: TrackLine[] = [makeSolidLine(
    lineIdStart,
    contact.x - tx * speed * PRE_LENGTH_FRAMES,
    contact.y - ty * speed * PRE_LENGTH_FRAMES,
    contact.x,
    contact.y,
  )];
  const segmentLength = speed * POST_LENGTH_FRAMES / POST_SEGMENTS;
  let x = contact.x;
  let y = contact.y;
  for (let segment = 0; segment < POST_SEGMENTS; segment++) {
    const t = (segment + 1) / POST_SEGMENTS;
    const angle = ((approachAngleDeg + TURN_DEG * t) * Math.PI) / 180;
    const nextX = x + Math.cos(angle) * segmentLength;
    const nextY = y + Math.sin(angle) * segmentLength;
    lines.push(makeSolidLine(lineIdStart + segment + 1, x, y, nextX, nextY));
    x = nextX;
    y = nextY;
  }
  return lines;
}

export function detectorRunwayControl(angleDeg: number): DetectorRunwayControl {
  const steepness = smoothstep01(Math.max(0, angleDeg) / (TURN_DEG * 0.75));
  return {
    approachDeltaDeg: SHALLOW_APPROACH_DELTA_DEG * (1 - steepness),
    tangentFrames: SHALLOW_TANGENT_FRAMES +
      (STEEP_TANGENT_FRAMES - SHALLOW_TANGENT_FRAMES) * steepness,
  };
}

function smoothstep01(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}
