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
  wasLastGeometryImpactTemplate,
} from "../arc_placement.ts";
import {
  AXES,
  type AxisValues,
  type Arc, type TrackLine, type Gap,
  CALIB,
  ELEVATION,
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
  airborneAt,
  redirImpactPxAtLanding,
  speedAt,
  velocityAt,
  positionAt,
} from "./substrate.ts";
import { measureGapAxes } from "./measure.ts";
import { gravityCorrectedLaunchAverage } from "./launch_read.ts";
import { firstAirborneExitFrame } from "./exit_read.ts";

const AIR_POLISH_CONTINUATION_LENGTHS = [50, 300] as const;
const RELEASE_STATE_FRAME_OFFSET = 8;

/** Single parse of LR_RANK_QUALITY (the quality-objective pool-sort mode
 *  switch). Owned here in core so the free-capture gate below and the pool
 *  ranker (optimizer/aim.ts) cannot desync — a new mode must be added in
 *  exactly one place. DEFAULT is "pool" (the shipped quality-objective pool sort);
 *  LR_RANK_QUALITY=off is the escape hatch — any other/unset value → "pool".
 *  Read once at import (env is constant per run; this gates pool-time free
 *  capture/prediction fields, not every possible objective consumer). */
export type RankQualityMode = "off" | "pool";
export const RANK_QUALITY_MODE: RankQualityMode = (() => {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_RANK_QUALITY;
  if (raw === "off") return "off";
  return "pool";
})();

/** FREE-CAPTURE gate (pool mode). When set, `evaluateGapFit` reads the rider's
 *  arrival state at `axisMeasureEnd` off the detection it already computed and
 *  stows it on the fit (see GapFit `arrivalAtNextContact`). OFF → the read is
 *  skipped and the field is never set. */
const CAPTURE_ARRIVAL_AT_NEXT_CONTACT = RANK_QUALITY_MODE !== "off";

/** PREDICTED-ARRIVAL capture (pool mode). When the quality sort is active,
 *  `evaluateGapFit` captures the rider's full launch/exit state (position +
 *  smoothed launch velocity) off the detection it already computed, so the ranker
 *  can propagate it ballistically to the next contact instead of charging a probe
 *  ride. Collapsed into the pool-mode gate (RANK_QUALITY_MODE !== "off"):
 *  prediction is unconditional under pool mode, and LR_RANK_QUALITY=off — which
 *  keeps every capture field and the exit read fully gated — is the single escape
 *  hatch. */
export const RANK_PREDICT_ARRIVAL: boolean = RANK_QUALITY_MODE !== "off";

/** GEOMETRIC EXIT RELEASE READ (pool mode). `evaluateGapFit` reads the ballistic
 *  release/launch state (`releaseArrivalState`) at the GEOMETRIC ARC-EXIT frame —
 *  the first frame at/after gap.endFrame where the rider is airborne AND past the
 *  arc-end plane (core/exit_read.ts) — instead of the fixed catch+8 release frame.
 *  This is the unconditional capture behavior under pool mode. The cost-term fields
 *  (releaseSpeed, releaseVelocityY, releaseGroundedFrames, releaseAirborne,
 *  releaseSpeedPenalty) stay on catch+8 — only the predicted-arrival ranker state
 *  moves. The geometric exit lands at +9..16 frames for the majority of passes,
 *  where catch+8 reads a still-non-airborne rider and starves the ballistic ranker
 *  (predictArrivalAtNextContact bails on non-airborne releases). Falls back to the
 *  catch+8 read when no exit is found, the exit would ride into the next contact
 *  (no ballistic flight), or the exit-frame state is unreadable — all load-bearing
 *  (short rides legitimately never exit, e.g. ~25% no_exit on tiny_dance; those
 *  candidates must keep the catch+8 capture, not be discarded). */
const RELEASE_EXIT_READ: boolean = RANK_PREDICT_ARRIVAL;

/** Telemetry for the geometric-exit release read. Module-level counters in the
 *  established candidate-side style; snapshot/reset are wired through
 *  optimizer/handoff.ts into the per-budget compile stats so the `release_exit_*`
 *  names stay greppable in golden output (the fallback-rate monitor). All zero
 *  under LR_RANK_QUALITY=off. */
const releaseExitTotals = {
  /** Candidates where the exit read replaced the catch+8 release frame. */
  release_exit_used: 0,
  /** Fallback: no geometric exit frame found within the detection horizon. */
  release_exit_fallback_no_exit: 0,
  /** Fallback: exit frame > nextContact−2 (rider rides into the next contact,
   *  no ballistic flight) — keep the catch+8 read. */
  release_exit_fallback_next_contact: 0,
  /** Fallback: exit-frame launch state unreadable → catch+8 read. */
  release_exit_fallback_unreadable: 0,
  /** Of the exit-read releases that were USED, how many are airborne (should be
   *  all, by construction — the exit predicate requires airborne). */
  release_exit_airborne: 0,
};
export type ReleaseExitStats = typeof releaseExitTotals;

export function resetReleaseExitStats(): void {
  releaseExitTotals.release_exit_used = 0;
  releaseExitTotals.release_exit_fallback_no_exit = 0;
  releaseExitTotals.release_exit_fallback_next_contact = 0;
  releaseExitTotals.release_exit_fallback_unreadable = 0;
  releaseExitTotals.release_exit_airborne = 0;
}

export function snapshotReleaseExitStats(): ReleaseExitStats | null {
  const anyActivity = releaseExitTotals.release_exit_used > 0 ||
    releaseExitTotals.release_exit_fallback_no_exit > 0 ||
    releaseExitTotals.release_exit_fallback_next_contact > 0 ||
    releaseExitTotals.release_exit_fallback_unreadable > 0;
  return anyActivity ? { ...releaseExitTotals } : null;
}

const RELEASE_STATE_SPEED_WEIGHT = 0.126;
const LOCAL_IMPACT_COST_WEIGHT = 0.5;
const LOCAL_IMPACT_COST_MATURE_EXTRA = 0.25;
const LOCAL_IMPACT_COST_MATURE_START_FRAMES = 150_000;
const LOCAL_IMPACT_COST_MATURE_SPAN_FRAMES = 50_000;

let currentCandidateCompileBudgetFrames = 0;
export function setCandidateCompileBudgetFrames(frames: number): void {
  currentCandidateCompileBudgetFrames = Math.max(0, frames | 0);
}

// ─────────── Landing-window probe (study-only, off by default) ───────────
// Read-only diagnostic for the landing-redefinition project: for every candidate
// that passes the survival gate, compute the minimal acceptance half-width
// W ∈ [1, LANDING_PROBE_MAX_W] at which the candidate would be admitted if BOTH
// timing rules widened in lockstep (a landing on an owned line within ±W of the
// beat AND zero off-beat landings at tolerance W). W=1 reproduces today's hard
// gates exactly. Enabled only by study scripts via `enableLandingWindowProbe`;
// when disabled (always, in production) the hot path pays one null check.

export const LANDING_PROBE_MAX_W = 5;
const LANDING_PROBE_RECORD_CAP = 1_000_000;

export type LandingWindowProbeRecord = {
  gapIndex: number;
  endFrame: number;
  /** Authored per-beat impact target of this gap, if any. */
  targetImpact?: number;
  /** Candidate-arc geometry (from its lines, independent of simulation):
   *  entry tangent angle (deg, positive = descending) and total signed turn
   *  (deg, negative = scooping/flattening). Funnel-study fields. */
  entryAngleDeg: number | null;
  turnDeg: number | null;
  /** Set when the candidate died at the survival gate (rider didn't live to
   *  endFrame + margin) — such records carry geometry but no landing data. */
  failure?: "survival";
  /** Minimal lockstep half-width that admits the candidate; null if none ≤ MAX_W. */
  acceptedAtW: number | null;
  /** Signed landing offset (landingFrame − endFrame) at that W; null if rejected. */
  offset: number | null;
  /** Achieved redirection impact (normalized by REDIR_CAP) at that landing. */
  impactAchieved: number | null;
  /** Incoming speed (px/frame) one frame before that landing. */
  incomingSpeed: number | null;
  /** True if the geometry came from an impact template lane. */
  isTemplate: boolean;
  /** Final axisCost of the candidate; null if it failed a hard gate. */
  cost: number | null;
  /** Handoff ranking score (lower = better; −forwardArcValue at ≥75k, else the
   *  composite local score). Attached by scoreCandidateForHandoff when probing. */
  handoffScore?: number;
};

/** lines-array → probe record, so the handoff ranker can attach its score to the
 *  record for the same candidate (object identity survives evaluateGapFit→Candidate). */
const landingProbeByLines = new WeakMap<object, LandingWindowProbeRecord>();

/** Study hook for optimizer/handoff.ts — no-op when the probe is disabled. */
export function attachHandoffScoreToProbe(lines: object, score: number): void {
  if (landingProbeRecords === null) return;
  const rec = landingProbeByLines.get(lines);
  if (rec !== undefined && rec.handoffScore === undefined) rec.handoffScore = score;
}

let landingProbeRecords: LandingWindowProbeRecord[] | null = null;
let landingProbeDropped = 0;

export function enableLandingWindowProbe(): void {
  landingProbeRecords = [];
  landingProbeDropped = 0;
}

export function disableLandingWindowProbe(): void {
  landingProbeRecords = null;
  landingProbeDropped = 0;
}

/** Drain accumulated records (caller owns the array); probe stays enabled. */
export function drainLandingWindowProbe(): { records: LandingWindowProbeRecord[]; dropped: number } {
  const records = landingProbeRecords ?? [];
  const dropped = landingProbeDropped;
  if (landingProbeRecords !== null) landingProbeRecords = [];
  landingProbeDropped = 0;
  return { records, dropped };
}

/** Entry tangent + total signed turn of a candidate's line chain (degrees;
 *  positive entry = descending, negative turn = scoop). Probe-only — never on
 *  the production hot path. */
function probeArcAngles(lines: TrackLine[]): { entryAngleDeg: number | null; turnDeg: number | null } {
  let entry: number | null = null;
  let prev: number | null = null;
  let turn = 0;
  for (const l of lines) {
    const dx = l.x2 - l.x1;
    const dy = l.y2 - l.y1;
    if (dx === 0 && dy === 0) continue;
    const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (entry === null) entry = angle;
    if (prev !== null) {
      let d = (angle - prev) % 360;
      if (d > 180) d -= 360;
      if (d <= -180) d += 360;
      turn += d;
    }
    prev = angle;
  }
  return { entryAngleDeg: entry, turnDeg: entry === null ? null : turn };
}

/** Record a survival-gate death (probe only): geometry is known, landing data is not. */
function probeSurvivalFailure(gap: Gap, lines: TrackLine[]): void {
  if (landingProbeRecords === null) return;
  if (landingProbeRecords.length >= LANDING_PROBE_RECORD_CAP) {
    landingProbeDropped++;
    return;
  }
  landingProbeRecords.push({
    gapIndex: gap.index,
    endFrame: gap.endFrame,
    ...(gap.targets.impact === undefined ? {} : { targetImpact: gap.targets.impact }),
    ...probeArcAngles(lines),
    failure: "survival",
    acceptedAtW: null,
    offset: null,
    impactAchieved: null,
    incomingSpeed: null,
    isTemplate: wasLastGeometryImpactTemplate(),
    cost: null,
  });
}

function probeLandingWindow(
  det: Detection,
  gap: Gap,
  lines: TrackLine[],
  allContactFrames: number[],
  axisMeasureEnd: number,
): LandingWindowProbeRecord | null {
  if (landingProbeRecords === null) return null;
  if (landingProbeRecords.length >= LANDING_PROBE_RECORD_CAP) {
    landingProbeDropped++;
    return null;
  }
  const owned = new Set(lines.map((l) => l.id));
  let acceptedAtW: number | null = null;
  let chosen: DetEvent | null = null;
  for (let w = 1; w <= LANDING_PROBE_MAX_W; w++) {
    let best: DetEvent | null = null;
    for (const e of det.events) {
      if (e.type !== "landing") continue;
      const d = Math.abs(e.frame - gap.endFrame);
      if (d > w) continue;
      if (!intersectsLineIds(e, det, owned)) continue;
      if (best === null || d < Math.abs(best.frame - gap.endFrame)) best = e;
    }
    if (best === null) continue;
    if (countOffBeatLandings(det.events, gap.startFrame, axisMeasureEnd, allContactFrames, w) > 0) {
      continue;
    }
    acceptedAtW = w;
    chosen = best;
    break;
  }
  const impactPx = chosen === null ? undefined : redirImpactPxAtLanding(det, chosen.frame);
  const incomingSpeed = chosen === null
    ? undefined
    : (speedAt(det, chosen.frame - 1) ?? speedAt(det, chosen.frame));
  const record: LandingWindowProbeRecord = {
    gapIndex: gap.index,
    endFrame: gap.endFrame,
    ...(gap.targets.impact === undefined ? {} : { targetImpact: gap.targets.impact }),
    ...probeArcAngles(lines),
    acceptedAtW,
    offset: chosen === null ? null : chosen.frame - gap.endFrame,
    impactAchieved: impactPx === undefined ? null : impactPx / CALIB.REDIR_CAP,
    incomingSpeed: incomingSpeed ?? null,
    isTemplate: wasLastGeometryImpactTemplate(),
    cost: null,
  };
  landingProbeRecords.push(record);
  landingProbeByLines.set(lines, record);
  return record;
}

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
  const velocity: { x: number; y: number }[] = [];
  const contactLineIds: number[][] = [];
  const airborne: boolean[] = [];
  // PREDICTED-ARRIVAL (LR_RANK_PREDICT_ARRIVAL): the ranker propagates the
  // release state ballistically and needs position. The window detector
  // otherwise drops position to save memory on the hot path; populate it ONLY
  // when the flag is on so flag-off allocation is unchanged.
  const position: { x: number; y: number }[] = [];
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
    velocity.push({ x: vx, y: vy });
    if (RANK_PREDICT_ARRIVAL) position.push({ x: data[base + WINDOW_PX], y: data[base + WINDOW_PY] });
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
      position,
      velocity,
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
  const velocity: { x: number; y: number }[] = [];
  const contactLineIds: number[][] = [];
  const airborne: boolean[] = [];
  const events: DetEvent[] = [];
  // PREDICTED-ARRIVAL: see detectCandidateWindowBuffer — position is populated
  // only when LR_RANK_PREDICT_ARRIVAL is on.
  const position: { x: number; y: number }[] = [];

  let stallRun = 0;
  let airborneRun = 0;
  let airborneFrom = -1;
  let terminus: Detection["terminus"] | null = null;

  for (let i = 0; i < frames.length; i++) {
    const fr = frames[i];
    const sp = Math.hypot(fr.velocity.x, fr.velocity.y);
    speed.push(sp);
    velocity.push({ x: fr.velocity.x, y: fr.velocity.y });
    if (RANK_PREDICT_ARRIVAL) position.push({ x: fr.position.x, y: fr.position.y });
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
      position,
      velocity,
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
    /* landingProbeEligible */ true,
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
    fit: {
      arc,
      geometry,
      lines: best.fit.lines,
      achieved: best.fit.achieved,
      cost: best.fit.cost,
      ...(best.fit.releaseSpeed === undefined ? {} : { releaseSpeed: best.fit.releaseSpeed }),
      ...(best.fit.releaseVelocityY === undefined ? {} : { releaseVelocityY: best.fit.releaseVelocityY }),
      ...(best.fit.releaseGroundedFrames === undefined
        ? {}
        : { releaseGroundedFrames: best.fit.releaseGroundedFrames }),
      ...(best.fit.releaseAirborne === undefined ? {} : { releaseAirborne: best.fit.releaseAirborne }),
      ...(best.fit.arrivalAtNextContact === undefined
        ? {}
        : { arrivalAtNextContact: best.fit.arrivalAtNextContact }),
      ...(best.fit.releaseArrivalState === undefined
        ? {}
        : { releaseArrivalState: best.fit.releaseArrivalState }),
    },
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
  /** True only for the per-candidate BASE evaluation (not ride-out re-evals);
   *  gates the landing-window probe so each candidate is recorded once. */
  landingProbeEligible = false,
): {
  fit: Pick<
    GapFit,
    | "lines"
    | "achieved"
    | "cost"
    | "releaseSpeed"
    | "releaseVelocityY"
    | "releaseGroundedFrames"
    | "releaseAirborne"
    | "arrivalAtNextContact"
    | "releaseArrivalState"
  >;
  failure: null;
} | {
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
    if (landingProbeEligible && landingProbeRecords !== null) probeSurvivalFailure(gap, lines);
    return { fit: null, failure: "survival" };
  }

  // Study-only probe (no-op unless a study script enabled it): record what a
  // widened acceptance window would have admitted. Pure observation — gates
  // below run unchanged. The returned record gets the final cost attached below.
  const probeRecord = landingProbeEligible && landingProbeRecords !== null
    ? probeLandingWindow(det, gap, lines, allContactFrames, axisMeasureEnd)
    : null;

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
  const releaseFrame = releaseStateFrame(gap, allContactFrames);
  const releaseSpeed = speedAt(det, releaseFrame);
  const releaseVelocity = velocityAt(det, releaseFrame);
  const releaseGroundedFrames = groundedFramesInRange(det, gap.endFrame, releaseFrame);
  const releaseAirborne = airborneAt(det, releaseFrame);
  const cost = axisCost(searchTargets, achieved)
    + (scoreReleaseState ? releaseSpeedPenalty(releaseSpeed, searchTargets.speed) : 0);
  if (probeRecord !== null) probeRecord.cost = cost;
  // FREE-CAPTURE (LR_RANK_QUALITY): when the lookahead measurement reached the
  // next contact (axisMeasureEnd > gap.endFrame ⟺ axisLookaheadEndFrame returned
  // that contact), the rider's arrival state there is already in `det`. Read it
  // off — a pure read of state already computed; no extra frames, no RNG. Gated
  // so the flag-off path never even allocates the field.
  const arrivalAtNextContact = CAPTURE_ARRIVAL_AT_NEXT_CONTACT && axisMeasureEnd > gap.endFrame
    ? arrivalStateAt(det, axisMeasureEnd)
    : undefined;
  // PREDICTED-ARRIVAL: full launch/exit state for the ranker to propagate
  // ballistically to the next contact instead of charging a probe ride, read off
  // the SAME detection (zero extra frames). Gated on pool mode so the
  // LR_RANK_QUALITY=off path never allocates the field. The catch+8 read is the
  // load-bearing FALLBACK; the geometric arc-exit read below is the default.
  let releaseArrivalState = RANK_PREDICT_ARRIVAL
    ? releaseArrivalStateAt(det, gap.endFrame, releaseFrame, releaseGroundedFrames, releaseAirborne)
    : undefined;
  // GEOMETRIC EXIT READ (pool mode): re-read the BALLISTIC release state at the
  // geometric arc-exit frame instead of catch+8, so the predict-arrival ranker
  // sees an airborne launch. Cost-term fields above are untouched. The exit frame
  // is read off the SAME detection (positions/airborne already computed) — zero
  // extra physics frames. Falls back to the catch+8 read above when there is no
  // exit, the exit rides into the next contact, or the exit state is unreadable.
  if (RELEASE_EXIT_READ) {
    releaseArrivalState = releaseExitArrivalState(
      det, gap, lines, horizon, allContactFrames,
    ) ?? releaseArrivalState;
  }
  return {
    fit: {
      lines,
      achieved,
      cost,
      releaseSpeed,
      ...(releaseVelocity === undefined ? {} : { releaseVelocityY: releaseVelocity.y }),
      releaseGroundedFrames,
      ...(releaseAirborne === undefined ? {} : { releaseAirborne }),
      ...(arrivalAtNextContact === undefined ? {} : { arrivalAtNextContact }),
      ...(releaseArrivalState === undefined ? {} : { releaseArrivalState }),
    },
    failure: null,
  };
}

/** Rider arrival state {speed, comAngleDeg} at `frame`, read off an existing
 *  detection (the candidate's own measurement ride). comAngleDeg is the CoM
 *  velocity heading in degrees (+down), null when stationary; mirrors
 *  aim.ts probeRide. Returns undefined when the frame is past the detection. */
function arrivalStateAt(
  det: Detection,
  frame: number,
): { frame: number; speed: number; comAngleDeg: number | null } | undefined {
  const v = velocityAt(det, frame);
  if (v === undefined) return undefined;
  const speed = Math.hypot(v.x, v.y);
  if (!Number.isFinite(speed)) return undefined;
  return {
    frame,
    speed,
    comAngleDeg: speed > 0 ? (Math.atan2(v.y, v.x) * 180) / Math.PI : null,
  };
}

/** Full launch/exit state at `releaseFrame`, read off an existing detection for
 *  ballistic propagation by the quality ranker (LR_RANK_PREDICT_ARRIVAL). The
 *  velocity is the gravity-corrected average of up to LAUNCH_READ_FRAMES
 *  consecutive AIRBORNE frames starting at `releaseFrame` plus the constant
 *  LAUNCH_VY_OFFSET_PX — the same smoothed launch read the short probe uses
 *  (arc_probe.ts readLaunchState, commit f23ef60), computed here from the
 *  detection's per-frame velocity/airborne arrays instead of re-metering the
 *  engine (zero extra frames). `pose` is not carried in detection measurements
 *  and the rank objective does not consume it, so it is left null. Returns
 *  undefined when the release-frame position/velocity is unreadable. `grounded`
 *  / `airborne` are passed through so the ranker can reject non-ballistic
 *  (ground-touching) post-catch segments. */
function releaseArrivalStateAt(
  det: Detection,
  catchFrame: number,
  releaseFrame: number,
  grounded: number,
  airborne: boolean | undefined,
): GapFit["releaseArrivalState"] | undefined {
  const pos = positionAt(det, releaseFrame);
  const v0 = velocityAt(det, releaseFrame);
  if (pos === undefined || v0 === undefined) return undefined;
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(v0.x) || !Number.isFinite(v0.y)) {
    return undefined;
  }
  // Gravity-corrected average of consecutive airborne velocity reads
  // (shared estimator — core/launch_read.ts). This call site differs from
  // optimizer/arc_probe.ts only in the velocity source (detection arrays vs
  // metered engine) and in having no fork-horizon bound.
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  const { vx, vy } = gravityCorrectedLaunchAverage(
    v0,
    g,
    (k) => airborneAt(det, releaseFrame + k) === true,
    (k) => velocityAt(det, releaseFrame + k),
  );
  return {
    frame: releaseFrame,
    x: pos.x,
    y: pos.y,
    vx,
    vy,
    sledPoseDeg: null,
    sledPoseRateDegPerFrame: null,
    grounded,
    airborne: airborne === true,
  };
}

/** Geometric-exit release-read helper (pool mode). Reads the ballistic
 *  launch/exit state at the GEOMETRIC arc-exit frame — the first frame in
 *  [gap.endFrame, horizon] where the rider is airborne AND past the arc-end
 *  plane (shared detector, core/exit_read.ts) — off the already-computed
 *  detection. Returns the exit-frame release state (with `airborne: true` and
 *  `grounded: 0` set consistently with that airborne-by-construction read) when
 *  a valid ballistic exit exists, or null to signal "fall back to the catch+8
 *  read" (no exit found, exit rides into the next contact, or unreadable). Every
 *  return path bumps a `release_exit_*` counter. Does NOT touch the cost-term
 *  release fields — only the predicted-arrival ranker state. */
function releaseExitArrivalState(
  det: Detection,
  gap: Gap,
  lines: readonly TrackLine[],
  horizon: number,
  allContactFrames: number[],
): GapFit["releaseArrivalState"] | null {
  const exitFrame = firstAirborneExitFrame(
    lines,
    gap.endFrame,
    horizon,
    (frame) => airborneAt(det, frame),
    (frame) => positionAt(det, frame),
  );
  if (exitFrame === null) {
    releaseExitTotals.release_exit_fallback_no_exit++;
    return null;
  }
  // No ballistic flight if the rider would ride into the next contact: mirror
  // releaseStateFrame's nextContact−2 latest-before-next bound.
  const nextContact = allContactFrames.find((frame) => frame > gap.endFrame);
  if (nextContact !== undefined && exitFrame > nextContact - 2) {
    releaseExitTotals.release_exit_fallback_next_contact++;
    return null;
  }
  // Ballistic launch state ONLY at the exit frame. grounded=0 / airborne=true are
  // consistent with the airborne-by-construction exit read, so
  // predictedArrivalApplies / the predict branch in optimizer/aim.ts and
  // predictArrivalAtNextContact (objective.ts, propagating from rel.frame) behave
  // correctly with the later, shorter-dt launch.
  const state = releaseArrivalStateAt(det, gap.endFrame, exitFrame, 0, true);
  if (state === undefined) {
    releaseExitTotals.release_exit_fallback_unreadable++;
    return null;
  }
  releaseExitTotals.release_exit_used++;
  if (state.airborne) releaseExitTotals.release_exit_airborne++;
  return state;
}

function groundedFramesInRange(det: Detection, startFrame: number, endFrame: number): number {
  let frames = 0;
  for (let frame = startFrame; frame <= endFrame; frame++) {
    if (airborneAt(det, frame) === false) frames++;
  }
  return frames;
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
  tol = 1,
): number {
  let n = 0;
  for (const e of events) {
    if (e.type !== "landing") continue;
    if (e.frame < startFrame || e.frame > endFrame) continue;
    const nearAnyContact = contactFrames.some((cf) => Math.abs(cf - e.frame) <= tol);
    if (!nearAnyContact) n++;
  }
  return n;
}

// ─────────── Axis measurement ───────────
// The per-axis reductions now live in `./measure.ts` (AXIS_MEASURE registry) so
// each axis's achieved value is defined in exactly one place. `measureGapAxes`
// is the verbatim equivalent of the former inline `measureAxes`.

export function axisCost(target: AxisValues, achieved: AxisValues): number {
  // Equal-target L2 cost over every resolved scalar that was actually measured.
  // `impact` is not curve-authored and still draws no sampling RNG, but once it
  // is present on a beat the local candidate sort should see the same error the
  // scorer sees.
  let cost = 0;
  for (const key of AXES) {
    const t = target[key];
    const a = achieved[key];
    if (t !== undefined && a !== undefined) {
      const d = t - a;
      cost += (key === "impact" ? localImpactCostWeight() : 1) * d * d;
    }
  }
  return cost;
}

// Experiment override for the local impact cost weight (LR_IMPACT_LOCAL_W=<float>,
// flat — replaces the base+maturity ramp). Read once at import: env is constant per
// run and axisCost is the per-candidate hot path.
const LOCAL_IMPACT_COST_WEIGHT_OVERRIDE = (() => {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_IMPACT_LOCAL_W;
  if (raw === undefined || raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
})();

function localImpactCostWeight(): number {
  if (LOCAL_IMPACT_COST_WEIGHT_OVERRIDE !== null) return LOCAL_IMPACT_COST_WEIGHT_OVERRIDE;
  const mature = smoothstepLocal(
    (currentCandidateCompileBudgetFrames - LOCAL_IMPACT_COST_MATURE_START_FRAMES) /
      LOCAL_IMPACT_COST_MATURE_SPAN_FRAMES,
  );
  return LOCAL_IMPACT_COST_WEIGHT + LOCAL_IMPACT_COST_MATURE_EXTRA * mature;
}

function smoothstepLocal(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}
