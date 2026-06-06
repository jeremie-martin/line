/**
 * v0 candidate validation core — geometry validation, anchor-Y bisection,
 * hard-gate evaluation, and axis measurement used by the handoff compiler.
 * These functions depend only on `../../lib/*`, `../types.ts`, `../arc.ts`,
 * and `./substrate.ts`, so they carry no compiler-only state.
 */

import {
  DEFAULT_PARAMS,
  detect, extractCandidateWindow, extractRawTrajectory, extractRawTrajectoryWindow,
  type CandidateWindowRaw, type Detection, type DetEvent, type RawTrajectory,
} from "../../lib/detector.ts";
import { arcToLines, makeSolidLine } from "../arc.ts";
import {
  type ArcPlacementDirectFailureReason,
  type ArcPlacementGeometry,
  type PreTargetSledTrace,
  hasPreTargetSledProximity,
  hasPreTargetSledProximityFromTrace,
  recordArcPlacementDirectAttempt,
  recordArcPlacementDirectFailure,
  recordArcPlacementDirectLanding,
  recordArcPlacementPreclearReject,
} from "../arc_placement.ts";
import {
  AXES,
  type AxisValues,
  type Arc, type TrackLine, type Gap,
  FPS,
  hasExactlyTargetAxes,
  type CandidateSampleMode,
  speedPxToAuthored,
} from "../types.ts";
import {
  type GapFit,
  clamp,
  median,
  engineLineFromTrackLine,
  contactLineIdsAt,
  speedAt,
} from "./substrate.ts";
import { measureGapAxes } from "./measure.ts";

const AIR_POLISH_CONTINUATION_LENGTHS = [50, 300] as const;
const RELEASE_STATE_FRAME_OFFSET = 8;
const RELEASE_STATE_SPEED_WEIGHT = 0.126;

type WindowDetection = Detection & { frameOffset?: number };

type CandidateLinesEvaluation =
  | { fit: GapFit; failure: null }
  | { fit: null; failure: ArcPlacementDirectFailureReason };
type PreTargetSledTraceProvider = () => PreTargetSledTrace;

const EMPTY_CANDIDATE_SUMMARY: Detection["summary"] = {
  liveFrames: 0,
  specFrames: 0,
  contactFrames: 0,
  airborneFrames: 0,
  contactFractionLive: 0,
  contactFractionSpec: 0,
  longestContactRun: 0,
  longestAirborneRun: 0,
  meanSpeedSliding: 0,
  meanSpeedAirborne: 0,
  meanVxSliding: 0,
  meanVxAirborne: 0,
  slideSegments: [],
};
const EMPTY_WINDOW_CONTACT_LINE_IDS = Object.freeze([]) as unknown as number[];

const WINDOW_PX = 0;
const WINDOW_PY = 1;
const WINDOW_VX = 2;
const WINDOW_VY = 3;
const WINDOW_RIDER_FSU = 4;
const WINDOW_SLED_FSU = 5;
const WINDOW_SLED_MASK = 6;
const WINDOW_CONTACT_OFFSET = 7;
const WINDOW_CONTACT_COUNT = 8;

// deno-lint-ignore no-explicit-any
export function detectWindow(engine: any, startFrame: number, endFrame: number): Detection {
  const start = Math.max(0, startFrame);
  const fast = detectCandidateWindowBuffer(extractCandidateWindow(engine, start, endFrame));
  if (fast !== null) {
    fast.frameOffset = start;
    return fast;
  }
  const det = detectCandidateWindowRaw(extractRawTrajectoryWindow(engine, start, endFrame)) as WindowDetection;
  det.frameOffset = start;
  return det;
}

function detectCandidateWindowBuffer(raw: CandidateWindowRaw | null): WindowDetection | null {
  if (raw === null) return null;
  const frameCount = raw.frames;
  if (frameCount === 0) {
    throw new Error("detect: empty trajectory");
  }

  const { data, contacts, stride } = raw;
  const speed: number[] = [];
  const contactLineIds: number[][] = [];
  const airborne: boolean[] = [];
  const events: DetEvent[] = [];

  let stallRun = 0;
  let airborneRun = 0;
  let airborneFrom = -1;
  let terminus: Detection["terminus"] | null = null;

  const frameAt = (index: number): number => raw.startFrame + index;
  const baseAt = (index: number): number => index * stride;
  const sledMaskAt = (index: number): number => data[baseAt(index) + WINDOW_SLED_MASK];
  const contactLineIdsAtIndex = (index: number): number[] => {
    const base = baseAt(index);
    const count = data[base + WINDOW_CONTACT_COUNT] | 0;
    if (count === 0) return EMPTY_WINDOW_CONTACT_LINE_IDS;
    const offset = data[base + WINDOW_CONTACT_OFFSET] | 0;
    const ids = new Array<number>(count);
    for (let i = 0; i < count; i++) ids[i] = contacts[offset + i];
    return ids;
  };

  for (let i = 0; i < frameCount; i++) {
    const base = baseAt(i);
    const frame = frameAt(i);
    const vx = data[base + WINDOW_VX];
    const vy = data[base + WINDOW_VY];
    const sp = Math.hypot(vx, vy);
    speed.push(sp);
    contactLineIds.push(contactLineIdsAtIndex(i));
    const isAir = sledMaskAt(i) === 0;
    airborne.push(isAir);

    if (data[base + WINDOW_RIDER_FSU] !== -1) {
      terminus = { frame, reason: "riderEjected" };
      break;
    }
    if (data[base + WINDOW_SLED_FSU] !== -1) {
      terminus = { frame, reason: "sledBroken" };
      break;
    }
    if (sp < DEFAULT_PARAMS.vStall) {
      stallRun++;
      if (stallRun >= DEFAULT_PARAMS.vStallFrames) {
        terminus = { frame, reason: "rideStalled" };
        break;
      }
    } else {
      stallRun = 0;
    }
    if (
      Math.abs(data[base + WINDOW_PX]) > DEFAULT_PARAMS.worldEnvelope ||
      Math.abs(data[base + WINDOW_PY]) > DEFAULT_PARAMS.worldEnvelope
    ) {
      terminus = { frame, reason: "leftWorld" };
      break;
    }

    if (isAir) {
      if (airborneRun === 0) airborneFrom = frame;
      airborneRun++;
    } else if (airborneRun > 0) {
      const windowEnd = Math.min(frameCount, i + DEFAULT_PARAMS.persistenceFrames);
      const windowLen = windowEnd - i;
      let groundedInWindow = 1;
      for (let j = i + 1; j < windowEnd; j++) {
        if (sledMaskAt(j) !== 0) groundedInWindow++;
      }

      if (airborneRun > DEFAULT_PARAMS.K && groundedInWindow / windowLen >= DEFAULT_PARAMS.persistenceRatio) {
        events.push({ frame, type: "landing", airborneFrom });
      }
      airborneRun = 0;
      airborneFrom = -1;
    }
  }

  if (terminus === null) {
    const lastFrame = raw.startFrame + frameCount - 1;
    terminus = {
      frame: Math.min(lastFrame, raw.duration),
      reason: lastFrame >= raw.duration ? "endOfSpec" : "rideStalled",
    };
  }

  return {
    measurements: {
      position: [],
      velocity: [],
      speed,
      sledContacts: [],
      contactLineIds,
      airborne,
    },
    events,
    terminus,
    params: DEFAULT_PARAMS,
    summary: EMPTY_CANDIDATE_SUMMARY,
  };
}

function detectCandidateWindowRaw(raw: RawTrajectory): Detection {
  const frames = raw.frames;
  if (frames.length === 0) {
    throw new Error("detect: empty trajectory");
  }

  const speed: number[] = [];
  const contactLineIds: number[][] = [];
  const airborne: boolean[] = [];
  const events: DetEvent[] = [];

  let stallRun = 0;
  let airborneRun = 0;
  let airborneFrom = -1;
  let terminus: Detection["terminus"] | null = null;

  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i];
    const sp = Math.hypot(fr.velocity.x, fr.velocity.y);
    speed.push(sp);
    contactLineIds.push(fr.contactLineIds);
    const isAir = fr.sledContacts.length === 0;
    airborne.push(isAir);

    if (fr.riderEjected) {
      terminus = { frame: fr.frame, reason: "riderEjected" };
      break;
    }
    if (fr.sledBroken) {
      terminus = { frame: fr.frame, reason: "sledBroken" };
      break;
    }
    if (sp < DEFAULT_PARAMS.vStall) {
      stallRun++;
      if (stallRun >= DEFAULT_PARAMS.vStallFrames) {
        terminus = { frame: fr.frame, reason: "rideStalled" };
        break;
      }
    } else {
      stallRun = 0;
    }
    if (
      Math.abs(fr.position.x) > DEFAULT_PARAMS.worldEnvelope ||
      Math.abs(fr.position.y) > DEFAULT_PARAMS.worldEnvelope
    ) {
      terminus = { frame: fr.frame, reason: "leftWorld" };
      break;
    }

    if (isAir) {
      if (airborneRun === 0) airborneFrom = fr.frame;
      airborneRun++;
    } else if (airborneRun > 0) {
      const windowEnd = Math.min(frames.length, i + DEFAULT_PARAMS.persistenceFrames);
      const windowLen = windowEnd - i;
      let groundedInWindow = 1;
      for (let j = i + 1; j < windowEnd; j++) {
        if (frames[j].sledContacts.length > 0) groundedInWindow++;
      }

      if (airborneRun > DEFAULT_PARAMS.K && groundedInWindow / windowLen >= DEFAULT_PARAMS.persistenceRatio) {
        events.push({ frame: fr.frame, type: "landing", airborneFrom });
      }
      airborneRun = 0;
      airborneFrom = -1;
    }
  }

  if (terminus === null) {
    const lastFrame = frames[frames.length - 1].frame;
    terminus = {
      frame: Math.min(lastFrame, raw.duration),
      reason: lastFrame >= raw.duration ? "endOfSpec" : "rideStalled",
    };
  }

  return {
    measurements: {
      position: [],
      velocity: [],
      speed,
      sledContacts: [],
      contactLineIds,
      airborne,
    },
    events,
    terminus,
    params: DEFAULT_PARAMS,
    summary: EMPTY_CANDIDATE_SUMMARY,
  };
}

export function makeAirPolishCandidates(
  lineId: number,
  source: TrackLine,
): { line: TrackLine; continuation: boolean }[] {
  const lines: { line: TrackLine; continuation: boolean }[] = [];
  const dx = source.x2 - source.x1;
  const dy = source.y2 - source.y1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    for (const length of AIR_POLISH_CONTINUATION_LENGTHS) {
      lines.push({
        line: makeSolidLine(
          lineId,
          source.x2,
          source.y2,
          source.x2 + (dx / len) * length,
          source.y2 + (dy / len) * length,
        ),
        continuation: true,
      });
    }
  }
  return lines;
}

export function makeContinuationLines(lineId: number, source: TrackLine): TrackLine[] {
  return makeAirPolishCandidates(lineId, source)
    .filter((candidate) => candidate.continuation)
    .map((candidate) => candidate.line);
}

export function tryCandidate(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  candArc: Arc,
  lineIdStart: number,
  allContactFrames: number[],
  axisMeasureEnd: number,
  searchTargets: AxisValues,
  useWindowDetection: boolean,
  sampleMode?: CandidateSampleMode,
  preTargetSledTrace?: PreTargetSledTraceProvider,
): GapFit | null {
  const directLines = arcToLines(candArc, lineIdStart);
  recordArcPlacementDirectAttempt(sampleMode);
  if (preTargetSledProximity(baseEngine, gap, directLines, preTargetSledTrace)) {
    recordArcPlacementPreclearReject(sampleMode);
    return null;
  }

  const direct = evaluateCandidateLines(
    baseEngine, gap, candArc, "arc", directLines, lineIdStart, axisMeasureEnd,
    allContactFrames, searchTargets, useWindowDetection,
  );
  if (direct.fit !== null) {
    recordArcPlacementDirectLanding(sampleMode);
    return direct.fit;
  }
  recordArcPlacementDirectFailure(sampleMode, direct.failure);
  return null;
}

export function tryCandidateGeometry(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  geometry: ArcPlacementGeometry,
  lineIdStart: number,
  allContactFrames: number[],
  axisMeasureEnd: number,
  searchTargets: AxisValues,
  useWindowDetection: boolean,
  sampleMode?: CandidateSampleMode,
  preTargetSledTrace?: PreTargetSledTraceProvider,
): GapFit | null {
  if (geometry.kind === "arc") {
    return tryCandidate(
      baseEngine, gap, geometry.arc, lineIdStart, allContactFrames, axisMeasureEnd,
      searchTargets, useWindowDetection, sampleMode, preTargetSledTrace,
    );
  }
  return tryCandidateLines(
    baseEngine, gap, geometry.lines, lineIdStart, allContactFrames, axisMeasureEnd,
    searchTargets, useWindowDetection, sampleMode, preTargetSledTrace,
  );
}

export function tryCandidateLines(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  lines: TrackLine[],
  lineIdStart: number,
  allContactFrames: number[],
  axisMeasureEnd: number,
  searchTargets: AxisValues,
  useWindowDetection: boolean,
  sampleMode?: CandidateSampleMode,
  preTargetSledTrace?: PreTargetSledTraceProvider,
): GapFit | null {
  recordArcPlacementDirectAttempt(sampleMode);
  if (preTargetSledProximity(baseEngine, gap, lines, preTargetSledTrace)) {
    recordArcPlacementPreclearReject(sampleMode);
    return null;
  }
  const direct = evaluateCandidateLines(
    baseEngine, gap, null, "lines", lines, lineIdStart, axisMeasureEnd,
    allContactFrames, searchTargets, useWindowDetection,
  );
  if (direct.fit !== null) {
    recordArcPlacementDirectLanding(sampleMode);
    return direct.fit;
  }
  recordArcPlacementDirectFailure(sampleMode, direct.failure);
  return null;
}

export function translateTrackLines(
  lines: TrackLine[],
  dx: number,
  dy: number,
  idStart: number,
): TrackLine[] {
  return lines.map((line, index) => ({
    ...line,
    id: idStart + index,
    x1: line.x1 + dx,
    y1: line.y1 + dy,
    x2: line.x2 + dx,
    y2: line.y2 + dy,
  }));
}

function preTargetSledProximity(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  lines: TrackLine[],
  preTargetSledTrace: PreTargetSledTraceProvider | undefined,
): boolean {
  return preTargetSledTrace === undefined
    ? hasPreTargetSledProximity(baseEngine, gap, lines)
    : hasPreTargetSledProximityFromTrace(preTargetSledTrace(), lines);
}

function evaluateCandidateLines(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  arc: Arc | null,
  geometry: GapFit["geometry"],
  lines: TrackLine[],
  lineIdStart: number,
  axisMeasureEnd: number,
  allContactFrames: number[],
  searchTargets: AxisValues,
  useWindowDetection: boolean,
): CandidateLinesEvaluation {
  const scoreReleaseState = geometry === "lines";
  let best = evaluateGapFit(
    baseEngine, gap, lines, axisMeasureEnd, allContactFrames,
    searchTargets, useWindowDetection, scoreReleaseState,
  );
  if (best.fit === null) return best;

  if (shouldTryCandidateRideOut(gap, axisMeasureEnd)) {
    const rideOutId = lineIdStart + lines.length;
    for (const source of rideOutSources(lines)) {
      for (const rideOut of makeContinuationLines(rideOutId, source)) {
        const extendedLines = [...lines, rideOut];
        const extended = evaluateGapFit(
          baseEngine, gap, extendedLines, axisMeasureEnd, allContactFrames,
          searchTargets, useWindowDetection, scoreReleaseState,
        );
        if (extended.fit !== null && extended.fit.cost + 1e-6 < best.fit.cost) {
          best = extended;
        }
      }
    }
  }

  return {
    fit: { arc, geometry, lines: best.fit.lines, achieved: best.fit.achieved, cost: best.fit.cost },
    failure: null,
  };
}

function evaluateGapFit(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  lines: TrackLine[],
  axisMeasureEnd: number,
  allContactFrames: number[],
  searchTargets: AxisValues,
  useWindowDetection: boolean,
  scoreReleaseState: boolean,
): { fit: Pick<GapFit, "lines" | "achieved" | "cost">; failure: null } | {
  fit: null;
  failure: ArcPlacementDirectFailureReason;
} {
  // deno-lint-ignore no-explicit-any
  const eng: any = baseEngine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
  const horizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20);
  const det = useWindowDetection
    ? detectWindow(eng, gap.startFrame, horizon)
    : detect(extractRawTrajectory(eng, horizon));

  // Hard gate 1: rider survived to gap.endFrame + SURVIVAL_MARGIN.
  // Surviving exactly the landing frame isn't enough — many randomly-sampled
  // catch geometries eject the rider on the next frame. Require the rider to
  // remain alive long enough to plausibly bridge into the next gap.
  const SURVIVAL_MARGIN = 16;
  const minSurvival = Math.max(gap.endFrame + SURVIVAL_MARGIN, axisMeasureEnd);
  if (det.terminus.frame < minSurvival && det.terminus.reason !== "endOfSpec") {
    return { fit: null, failure: "survival" };
  }

  // Hard gate 2: a landing event near gap.endFrame ±1.
  const owned = new Set(lines.map((l) => l.id));
  const landingNearTarget = det.events.some(
    (e) => e.type === "landing"
      && Math.abs(e.frame - gap.endFrame) <= 1
      && intersectsLineIds(e, det, owned),
  );
  if (!landingNearTarget) return { fit: null, failure: "landing" };

  // Hard gate 3: no off-beat landings before the next measurement boundary.
  const offBeat = countOffBeatLandings(
    det.events, gap.startFrame, axisMeasureEnd, allContactFrames,
  );
  if (offBeat > 0) return { fit: null, failure: "offbeat" };

  const achieved = measureGapAxes(det, gap, lines, axisMeasureEnd);
  const cost = axisCost(searchTargets, achieved)
    + (scoreReleaseState ? releaseStateCost(det, gap, allContactFrames, searchTargets) : 0);
  return { fit: { lines, achieved, cost }, failure: null };
}

export function releaseStateFrame(gap: Gap, allContactFrames: number[]): number {
  const preferred = gap.endFrame + RELEASE_STATE_FRAME_OFFSET;
  const nextContact = allContactFrames.find((frame) => frame > gap.endFrame);
  if (nextContact === undefined) return preferred;
  const latestBeforeNext = nextContact - 2;
  if (latestBeforeNext <= gap.endFrame) return gap.endFrame;
  return Math.min(preferred, latestBeforeNext);
}

export function releaseSpeedPenalty(
  releaseSpeedPxPerFrame: number | undefined,
  targetSpeed: number | undefined,
): number {
  if (releaseSpeedPxPerFrame === undefined || targetSpeed === undefined) return 0;
  const achieved = speedPxToAuthored(releaseSpeedPxPerFrame);
  const error = targetSpeed - achieved;
  return RELEASE_STATE_SPEED_WEIGHT * error * error;
}

function releaseStateCost(
  det: Detection,
  gap: Gap,
  allContactFrames: number[],
  searchTargets: AxisValues,
): number {
  return releaseSpeedPenalty(
    speedAt(det, releaseStateFrame(gap, allContactFrames)),
    searchTargets.speed,
  );
}

function shouldTryCandidateRideOut(
  gap: Gap,
  axisMeasureEnd: number,
): boolean {
  return hasExactlyTargetAxes(gap.targets, ["air"])
    && axisMeasureEnd > gap.endFrame
    && (
      gap.endFrame - gap.startFrame >= 60
    );
}

function rideOutSources(lines: TrackLine[]): TrackLine[] {
  return lines.slice(Math.max(0, lines.length - 8));
}

export function axisLookaheadEndFrame(gap: Gap, allContactFrames: number[]): number {
  if (gap.targets.air === undefined) return gap.endFrame;
  const nextContact = allContactFrames.find((cf) => cf > gap.endFrame) ?? gap.endFrame;
  const postContactFrames = nextContact - gap.endFrame;
  // For long airborne gaps, the catch at gap.endFrame determines most of the
  // air/contact balance after the beat, not before it. Score those candidates
  // through the next beat so ranking can prefer a catch that keeps riding.
  if (gap.endFrame - gap.startFrame >= 60) return nextContact;
  if (postContactFrames > Math.floor(FPS / 2)) return nextContact;
  return gap.endFrame;
}

// ─────────── Hard-gate helpers ───────────

function intersectsLineIds(
  event: DetEvent, det: Detection, owned: Set<number>,
): boolean {
  const lids = contactLineIdsAt(det, event.frame);
  return lids.some((id) => owned.has(id));
}

export function countOffBeatLandings(
  events: DetEvent[], startFrame: number, endFrame: number,
  contactFrames: number[],
): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== "landing") continue;
    if (e.frame < startFrame || e.frame > endFrame) continue;
    const nearAnyContact = contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1);
    if (!nearAnyContact) n++;
  }
  return n;
}

// ─────────── Axis measurement ───────────
// The per-axis reductions now live in `./measure.ts` (AXIS_MEASURE registry) so
// each axis's achieved value is defined in exactly one place. `measureGapAxes`
// is the verbatim equivalent of the former inline `measureAxes`.

export function axisCost(target: AxisValues, achieved: AxisValues): number {
  // Equal-axis L2 cost. The suite scores axes equally; keeping the local
  // optimizer equal-weighted avoids region-specific ranking bias while
  // preserving a smooth gradient for nearby candidate choices.
  let cost = 0;
  for (const key of AXES) {
    const t = target[key];
    const a = achieved[key];
    if (t !== undefined && a !== undefined) {
      const d = t - a;
      cost += d * d;
    }
  }
  return cost;
}
