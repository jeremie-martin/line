import {
  detect,
  extractRawTrajectory,
  extractRawTrajectoryWindow,
  K_BOUNCE_LANDING,
  PERSISTENCE_FRAMES,
  PERSISTENCE_RATIO,
  type Detection,
  type DetEvent,
} from "../lib/detector.ts";
import { arcToLines } from "../v0/arc.ts";
import type { TrackLine } from "../lib/primitive.ts";
import type { CandidateArc } from "./candidate_stream.ts";
import {
  stateAwareCandidateForOrdinal,
  type TargetState,
} from "./candidate_stream.ts";
import { addTrackLines, type WorkMeteredEngine } from "./engine_adapter.ts";
import { axisCost, CALIB } from "./normalize.ts";
import { CompileStatsBuilder } from "./stats.ts";
import type {
  CandidateStreamName,
  NormalizedGap,
  NormalizedSpecContext,
  SectionAxes,
} from "./types.ts";
import type { GapFit } from "./search_state.ts";
import { compareNumber, compareString, compareTuple, stableHash } from "./deterministic_math.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
const SURVIVAL_MARGIN = 16;
const BISect_SEARCH_RADIUS = 14;
const BISECT_MAX_ITERS = 18;
const BISECT_GRID_STEPS = 16;
const PREVIOUS_CONTACT_GUARD_MAX_FRAMES = 24;

type WindowDetection = Detection & { frameOffset?: number };

export type GapEvaluationResult =
  | { kind: "accepted"; fit: GapFit; candidate: CandidateArc }
  | { kind: "rejected"; candidate: CandidateArc; reason: string };

export type EvaluateGapCandidateInput = {
  context: NormalizedSpecContext;
  baseEngine: WorkMeteredEngine;
  gap: NormalizedGap;
  prefixHash: string;
  stream: CandidateStreamName;
  ordinal: number;
  lineIdStart: number;
  searchTargets?: SectionAxes;
  stats: CompileStatsBuilder;
};

export function evaluateGapCandidate(input: EvaluateGapCandidateInput): GapEvaluationResult {
  const riderAtTarget = input.baseEngine.raw().getRider(input.gap.endFrame);
  const refX = riderAtTarget.position.x;
  const refY = riderAtTarget.position.y;
  const targetState = readTargetState(input.baseEngine, input.gap.endFrame, refX, refY);
  const axisMeasureEnd = axisLookaheadEndFrame(input.gap, input.context.contactFrames);
  const searchTargets = searchTargetsForCost(
    input.searchTargets ?? input.gap.targets,
    input.gap,
    axisMeasureEnd,
    input.context.contactFrames,
  );
  const candidate = stateAwareCandidateForOrdinal({
    context: input.context,
    gap: input.gap,
    prefixHash: input.prefixHash,
    stream: input.stream,
    ordinal: input.ordinal,
    refX,
    refY,
    targets: input.gap.targets,
    targetState,
  });
  input.stats.recordCandidateSampled();

  const fit = tryCandidate({
    baseEngine: input.baseEngine,
    gap: input.gap,
    candidate,
    lineIdStart: input.lineIdStart,
    allContactFrames: input.context.contactFrames,
    axisMeasureEnd,
    searchTargets,
    stats: input.stats,
  });

  if (fit === null) return { kind: "rejected", candidate, reason: "hard_gate" };
  return { kind: "accepted", fit, candidate };
}

export function compareGapFits(a: GapFit, b: GapFit): number {
  return compareTuple([
    compareNumber(a.cost, b.cost, 5e-3),
    a.lines.length - b.lines.length,
    compareString(a.candidateKey.stream, b.candidateKey.stream),
    a.candidateKey.ordinal - b.candidateKey.ordinal,
    compareString(a.geometryHash, b.geometryHash),
  ]);
}

export function localAxisCost(target: SectionAxes, achieved: SectionAxes): number {
  return axisCost(target, achieved);
}

function tryCandidate(input: {
  baseEngine: WorkMeteredEngine;
  gap: NormalizedGap;
  candidate: CandidateArc;
  lineIdStart: number;
  allContactFrames: readonly number[];
  axisMeasureEnd: number;
  searchTargets: SectionAxes;
  stats: CompileStatsBuilder;
}): GapFit | null {
  const bisected = bisectAnchorY(
    input.baseEngine,
    input.candidate,
    input.gap.endFrame,
    input.lineIdStart,
    input.stats,
  );
  if (bisected === null) return null;

  const evaluated = evaluateGapFit(
    input.baseEngine,
    input.gap,
    bisected.lines,
    input.axisMeasureEnd,
    input.allContactFrames,
    input.searchTargets,
    input.stats,
  );
  if (evaluated === null) return null;

  return {
    candidateKey: input.candidate.key,
    lines: evaluated.lines,
    achieved: evaluated.achieved,
    cost: evaluated.cost,
    geometryHash: stableHash(evaluated.lines),
  };
}

function evaluateGapFit(
  baseEngine: WorkMeteredEngine,
  gap: NormalizedGap,
  lines: TrackLine[],
  axisMeasureEnd: number,
  allContactFrames: readonly number[],
  searchTargets: SectionAxes,
  stats: CompileStatsBuilder,
): Pick<GapFit, "lines" | "achieved" | "cost"> | null {
  const engine = addTrackLines(baseEngine, lines);

  const previousDenseContact = previousDenseContactFrame(gap, allContactFrames);
  const horizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20);
  const windowStart = previousDenseContact === null
    ? gap.startFrame
    : Math.max(0, previousDenseContact - K_BOUNCE_LANDING - PERSISTENCE_FRAMES - 2);
  const det = detectWindow(engine.raw(), windowStart, horizon, stats);

  const minSurvival = Math.max(gap.endFrame + SURVIVAL_MARGIN, axisMeasureEnd);
  if (det.terminus.frame < minSurvival && det.terminus.reason !== "endOfSpec") return null;

  if (
    previousDenseContact !== null
    && !hasLandingNearFrame(det.events, previousDenseContact)
  ) {
    return null;
  }

  const owned = new Set(lines.map((line) => line.id));
  const landingNearTarget = det.events.some(
    (event) => event.type === "landing"
      && Math.abs(event.frame - gap.endFrame) <= 1
      && intersectsLineIds(event, det, owned),
  );
  if (!landingNearTarget) return null;

  const offBeat = countOffBeatLandings(
    det.events,
    gap.startFrame,
    axisMeasureEnd,
    allContactFrames,
  );
  if (offBeat > 0) return null;

  const achieved = measureAxes(det, gap, lines, axisMeasureEnd);
  const cost = axisCost(searchTargets, achieved);
  return { lines, achieved, cost };
}

function previousDenseContactFrame(
  gap: NormalizedGap,
  allContactFrames: readonly number[],
): number | null {
  let previous: number | null = null;
  for (const frame of allContactFrames) {
    if (frame >= gap.endFrame) break;
    previous = frame;
  }
  if (previous === null) return null;
  return gap.endFrame - previous <= PREVIOUS_CONTACT_GUARD_MAX_FRAMES ? previous : null;
}

function hasLandingNearFrame(events: readonly DetEvent[], frame: number): boolean {
  return events.some((event) => event.type === "landing" && Math.abs(event.frame - frame) <= 1);
}

function bisectAnchorY(
  baseEngine: WorkMeteredEngine,
  candidate: CandidateArc,
  targetFrame: number,
  lineIdStart: number,
  stats: CompileStatsBuilder,
): { lines: TrackLine[] } | null {
  const windowStart = Math.max(
    0,
    targetFrame - BISect_SEARCH_RADIUS - K_BOUNCE_LANDING - PERSISTENCE_FRAMES - 2,
  );
  const windowEnd = targetFrame + PERSISTENCE_FRAMES + 1;

  const evalAt = (y: number): { frame: number | null; lines: TrackLine[] } => {
    const arc = {
      ...candidate.arc,
      anchor: { x: candidate.arc.anchor.x, y },
    };
    const lines = arcToLines(arc, lineIdStart);
    const engine = addTrackLines(baseEngine, lines);
    const det = detectWindow(engine.raw(), windowStart, windowEnd, stats);
    const owned = new Set(lines.map((line) => line.id));
    const landing = det.events.find(
      (event) => event.type === "landing"
        && Math.abs(event.frame - targetFrame) <= BISect_SEARCH_RADIUS
        && intersectsLineIds(event, det, owned),
    );
    return { frame: landing ? landing.frame : null, lines };
  };

  let lo = candidate.arc.anchor.y - BISect_SEARCH_RADIUS;
  let hi = candidate.arc.anchor.y + BISect_SEARCH_RADIUS;
  let best = evalAt(candidate.arc.anchor.y);
  let bestErr = best.frame !== null ? Math.abs(best.frame - targetFrame) : Infinity;
  if (bestErr <= 1) return { lines: best.lines };

  for (let i = 0; i < BISECT_MAX_ITERS; i++) {
    const mid = (lo + hi) / 2;
    const result = evalAt(mid);
    if (result.frame !== null) {
      const err = Math.abs(result.frame - targetFrame);
      if (err < bestErr) {
        bestErr = err;
        best = result;
      }
      if (err <= 1) return { lines: result.lines };
      if (result.frame > targetFrame) hi = mid;
      else lo = mid;
    } else {
      lo = mid;
    }
    if (hi - lo < 0.05) break;
  }

  if (bestErr > 1) {
    for (let i = 0; i <= BISECT_GRID_STEPS; i++) {
      const y = candidate.arc.anchor.y - BISect_SEARCH_RADIUS
        + (2 * BISect_SEARCH_RADIUS * i) / BISECT_GRID_STEPS;
      const result = evalAt(y);
      if (result.frame === null) continue;
      const err = Math.abs(result.frame - targetFrame);
      if (err < bestErr) {
        bestErr = err;
        best = result;
      }
      if (err <= 1) return { lines: result.lines };
    }
  }

  return bestErr <= 1 ? { lines: best.lines } : null;
}

export function readTargetState(
  engine: WorkMeteredEngine,
  frame: number,
  fallbackX: number,
  fallbackY: number,
): TargetState {
  const rider = engine.raw().getRider(frame);
  let sledX = fallbackX;
  let sledY = fallbackY;
  for (const name of SLED_POINTS) {
    const point = rider.get(name);
    if (point?.pos && point.pos.y > sledY) {
      sledY = point.pos.y;
      sledX = point.pos.x;
    }
  }
  const velocity = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(velocity.x, velocity.y);
  const angleDeg = (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI;
  return { sledX, sledY, velocity, speed, angleDeg };
}

export function detectWindow(
  engine: any,
  startFrame: number,
  endFrame: number,
  stats?: CompileStatsBuilder,
): Detection {
  const start = Math.max(0, startFrame);
  const raw = extractRawTrajectoryWindow(engine, start, endFrame);
  stats?.recordDetectorWindow(raw.frames.length);
  const det = detect(raw) as WindowDetection;
  det.frameOffset = start;
  return det;
}

export function detectFull(
  engine: any,
  durationFrames: number,
  stats?: CompileStatsBuilder,
): Detection {
  const raw = extractRawTrajectory(engine, durationFrames);
  stats?.recordDetectorWindow(raw.frames.length);
  return detect(raw);
}

export function frameOffset(det: Detection): number {
  return (det as WindowDetection).frameOffset ?? 0;
}

export function measurementIndex(det: Detection, frame: number): number {
  return frame - frameOffset(det);
}

export function measurementLastFrame(det: Detection): number {
  return frameOffset(det) + det.measurements.airborne.length - 1;
}

export function contactLineIdsAt(det: Detection, frame: number): number[] {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.contactLineIds[index] ?? [] : [];
}

export function airborneAt(det: Detection, frame: number): boolean | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.airborne[index] : undefined;
}

export function speedAt(det: Detection, frame: number): number | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.speed[index] : undefined;
}

export function intersectsLineIds(event: DetEvent, det: Detection, owned: Set<number>): boolean {
  return contactLineIdsAt(det, event.frame).some((lineId) => owned.has(lineId));
}

export function countOffBeatLandings(
  events: readonly DetEvent[],
  startFrame: number,
  endFrame: number,
  contactFrames: readonly number[],
): number {
  let count = 0;
  for (const event of events) {
    if (event.type !== "landing") continue;
    if (event.frame < startFrame || event.frame > endFrame) continue;
    const nearAnyContact = contactFrames.some((contactFrame) => Math.abs(contactFrame - event.frame) <= 1);
    if (!nearAnyContact) count++;
  }
  return count;
}

export function measureAxes(
  det: Detection,
  gap: NormalizedGap,
  gapLines: readonly TrackLine[],
  rangeEndFrame = gap.endFrame,
): SectionAxes {
  const out: SectionAxes = {};
  const start = gap.startFrame;
  const end = Math.min(rangeEndFrame, measurementLastFrame(det));

  let airFrames = 0;
  let total = 0;
  for (let frame = start; frame <= end; frame++) {
    if (airborneAt(det, frame)) airFrames++;
    total++;
  }
  if (total > 0) out.air = airFrames / total;

  let speedSum = 0;
  let speedCount = 0;
  for (let frame = start; frame <= end; frame++) {
    const speed = speedAt(det, frame);
    if (speed !== undefined) {
      speedSum += speed;
      speedCount++;
    }
  }
  if (speedCount > 0) out.speed = speedSum / speedCount / CALIB.SPEED_CAP;

  const lineLens = gapLines.map((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
  const medianLen = median(lineLens);
  if (medianLen > 0) {
    let contactFramesAtArc = 0;
    for (let frame = gap.endFrame; frame <= measurementLastFrame(det); frame++) {
      if (airborneAt(det, frame) === false) contactFramesAtArc++;
      else break;
    }
    const meanSpeed = (out.speed ?? 0) * CALIB.SPEED_CAP || 1;
    const traversed = meanSpeed * contactFramesAtArc;
    out.contact_style = Math.min(1, traversed / medianLen);
    out.grain = Math.min(1, medianLen / CALIB.LINE_LENGTH_CAP);
  }

  return out;
}

export function measureFitGrain(fit: GapFit): number {
  const lineLens = fit.lines.map((line) => Math.hypot(line.x2 - line.x1, line.y2 - line.y1));
  return lineLens.length > 0 ? Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP) : 0;
}

function searchTargetsForCost(
  targets: SectionAxes,
  gap: NormalizedGap,
  axisMeasureEnd: number,
  allContactFrames: readonly number[],
): SectionAxes {
  if (targets.air === undefined) return targets;
  const band = airFeasibleBand(gap.startFrame, axisMeasureEnd, allContactFrames);
  const air = Math.max(band.lo, Math.min(band.hi, targets.air));
  return air === targets.air ? targets : { ...targets, air };
}

function airFeasibleBand(
  startFrame: number,
  endFrame: number,
  contactFrames: readonly number[],
): { lo: number; hi: number } {
  const totalFrames = endFrame - startFrame + 1;
  if (totalFrames <= 0) return { lo: 0, hi: 1 };

  const requiredAir = new Set<number>();
  const requiredContact = new Set<number>();
  const contactPersistenceFrames = Math.ceil(PERSISTENCE_FRAMES * PERSISTENCE_RATIO);
  for (const contactFrame of contactFrames) {
    if (contactFrame < startFrame || contactFrame > endFrame) continue;
    for (let frame = contactFrame - K_BOUNCE_LANDING - 1; frame < contactFrame; frame++) {
      if (frame >= startFrame && frame <= endFrame) requiredAir.add(frame);
    }
    for (let frame = contactFrame; frame < contactFrame + contactPersistenceFrames; frame++) {
      if (frame >= startFrame && frame <= endFrame) requiredContact.add(frame);
    }
  }

  const lo = requiredAir.size / totalFrames;
  const hi = 1 - requiredContact.size / totalFrames;
  return { lo: Math.min(lo, hi), hi: Math.max(lo, hi) };
}

function axisLookaheadEndFrame(gap: NormalizedGap, allContactFrames: readonly number[]): number {
  if (gap.targets.air === undefined) return gap.endFrame;
  const nextContact = allContactFrames.find((contactFrame) => contactFrame > gap.endFrame) ?? gap.endFrame;
  const postContactFrames = nextContact - gap.endFrame;
  if (gap.endFrame - gap.startFrame >= 60) return nextContact;
  if (postContactFrames > Math.floor(40 / 2)) return nextContact;
  return gap.endFrame;
}

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}
