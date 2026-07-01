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
  IMPACT_WINDOW,
  impactEnvNum,
  hasExactlyTargetAxes,
  normImpact,
  type CandidateSampleMode,
  speedPxToAuthored,
} from "../types.ts";
import {
  type GapFit,
  median,
  engineLineFromTrackLine,
  contactLineIdsAt,
  airborneAt,
  redirArcPxAtLanding,
  speedAt,
  velocityAt,
  positionAt,
} from "./substrate.ts";
import {
  measureGapAxes,
  measureGapAxesWithBallisticSuffix,
  type BallisticAxisSuffix,
} from "./measure.ts";
import { gravityCorrectedLaunchAverage } from "./launch_read.ts";
import { firstAirborneExitFrame, growShortHorizon } from "./exit_read.ts";
import { registerCompileReset } from "./compile_lifecycle.ts";

const AIR_POLISH_CONTINUATION_LENGTHS = [50, 300] as const;
const RELEASE_STATE_FRAME_OFFSET = 8;

/** Single parse of LR_RANK_QUALITY (the quality-objective pool-sort mode switch),
 *  collapsed to the one bit it structurally is. POOL_MODE is true — the shipped
 *  quality-objective pool sort — for every value except LR_RANK_QUALITY=off, the
 *  study-only escape hatch (never set in production) that keeps the pool-mode
 *  captures fully gated OFF, bit-identical to the pre-ranking path. Owned here in
 *  core (single owner, shared with the pool ranker in optimizer/aim.ts so a mode
 *  change can't desync) and read once at import (env is constant per run).
 *  This one flag gates three things that ALWAYS move together — they share it
 *  rather than aliasing it under separate names:
 *    · PREDICTED-ARRIVAL capture — the detection loops below record the rider's
 *      position so `evaluateGapFit` can hand the ranker a full launch/exit state
 *      to propagate ballistically to the next contact (vs charging a probe ride);
 *    · the pool-time `releaseArrivalState` field that carries it; and
 *    · the GEOMETRIC ARC-EXIT release read (see the `evaluateGapFit` call site)
 *      that supplies that state from the arc-exit frame instead of catch+8. */
export const POOL_MODE: boolean =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_RANK_QUALITY !== "off";

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
registerCompileReset(resetReleaseExitStats);

export function snapshotReleaseExitStats(): ReleaseExitStats | null {
  const anyActivity = releaseExitTotals.release_exit_used > 0 ||
    releaseExitTotals.release_exit_fallback_no_exit > 0 ||
    releaseExitTotals.release_exit_fallback_next_contact > 0 ||
    releaseExitTotals.release_exit_fallback_unreadable > 0;
  return anyActivity ? { ...releaseExitTotals } : null;
}

/** Telemetry for the short-horizon gap fit. Counts truncated vs full-horizon
 *  candidate evaluations and the frames saved (full-horizon-would-have-been −
 *  actual stop), in the established candidate-side style. Snapshot/reset are
 *  wired through optimizer/handoff.ts into the per-budget compile stats.
 *  NOTE: compactStats may strip these from archives — measure live. */
const gapfitShortTotals = {
  /** Candidate evals that truncated at a clean geometric exit (short horizon). */
  gapfit_truncated: 0,
  /** Candidate evals that fell through to the full horizon (no clean exit in cap,
   *  or the short horizon was already ≥ the full horizon — no saving possible). */
  gapfit_full: 0,
  /** Σ (full horizon − truncated horizon) over truncated evals: detection frames
   *  saved vs riding the engine to the former next-gap horizon. */
  gapfit_frames_saved: 0,
};
export type GapfitShortStats = typeof gapfitShortTotals;

export function resetGapfitShortStats(): void {
  gapfitShortTotals.gapfit_truncated = 0;
  gapfitShortTotals.gapfit_full = 0;
  gapfitShortTotals.gapfit_frames_saved = 0;
}
registerCompileReset(resetGapfitShortStats);

export function snapshotGapfitShortStats(): GapfitShortStats | null {
  const anyActivity = gapfitShortTotals.gapfit_truncated > 0 || gapfitShortTotals.gapfit_full > 0;
  return anyActivity ? { ...gapfitShortTotals } : null;
}

/** Weight of the release-speed SETUP term (`releaseSpeedPenalty`). Applied by the
 *  handoff ranker (`candidateReleaseSetupPenalty`) against the NEXT contact gap's
 *  speed target — a forward-looking signal preferring catches whose launch speed
 *  sets up the following span. It is deliberately NOT charged against the current
 *  gap's cost: axisCost already scores current-gap speed once (matching the scorer),
 *  and re-charging it there was board-confirmed redundant (parity → removed). */
const RELEASE_STATE_SPEED_WEIGHT = 0.126;
/** Local candidate-cost weight of the `impact` axis (`axisCost`), a flat 0.5 —
 *  deliberately BELOW the scorer's equal weighting (every scored axis effectively
 *  weight 1): full impact weight regressed mature budgets (impact campaign log, git history:
 *  "full impact weight had a slightly lower focused headline (382.2) and a 100k
 *  -16.3 point-estimate regression"), so the cheap candidate prefix must not
 *  over-prioritize impact over air/speed/elevation/amplitude. A former 0.5->0.75
 *  budget ramp (commit 8446817) was REMOVED: a canonical A/B (40 specs × 12 seeds,
 *  100k/200k/300k) showed it no longer pays — dead-flat parity, validity unchanged —
 *  its original suite-wide win having eroded as the baseline moved. Removing it also
 *  de-couples candidate cost from per-compile budget state. LR_IMPACT_LOCAL_W
 *  overrides the weight for studies. */
const LOCAL_IMPACT_COST_WEIGHT = Math.max(0, impactEnvNum("LR_IMPACT_LOCAL_W", 0.5));

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
  /** Achieved impact (redirArc = v·Δθ → normImpact, felt [0,1]) at that landing. */
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
  const impactPx = chosen === null ? undefined : redirArcPxAtLanding(det, chosen.frame);
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
    impactAchieved: impactPx === undefined ? null : normImpact(impactPx),
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
  // PREDICTED-ARRIVAL (POOL_MODE): the ranker propagates the release state
  // ballistically and needs position. The window detector otherwise drops
  // position to save memory on the hot path; populate it ONLY when the flag is
  // on so flag-off allocation is unchanged.
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
    if (POOL_MODE) position.push({ x: data[base + WINDOW_PX], y: data[base + WINDOW_PY] });
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
  // only when POOL_MODE is on.
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
    if (POOL_MODE) position.push({ x: fr.position.x, y: fr.position.y });
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
  let best = evaluateGapFit(
    baseEngine, gap, lines, axisMeasureEnd, allContactFrames,
    searchTargets, useWindowDetection,
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
          searchTargets, useWindowDetection,
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
      ...(best.fit.achievedAtEnd === undefined ? {} : { achievedAtEnd: best.fit.achievedAtEnd }),
      cost: best.fit.cost,
      ...(best.fit.releaseSpeed === undefined ? {} : { releaseSpeed: best.fit.releaseSpeed }),
      ...(best.fit.releaseVelocityY === undefined ? {} : { releaseVelocityY: best.fit.releaseVelocityY }),
      ...(best.fit.releaseGroundedFrames === undefined
        ? {}
        : { releaseGroundedFrames: best.fit.releaseGroundedFrames }),
      ...(best.fit.releaseAirborne === undefined ? {} : { releaseAirborne: best.fit.releaseAirborne }),
      ...(best.fit.releaseArrivalState === undefined
        ? {}
        : { releaseArrivalState: best.fit.releaseArrivalState }),
    },
    failure: null,
  };
}

/**
 * Short-horizon detection for a candidate gap fit (the minimal-simulation
 * principle): grow the detection window in 4-frame chunks (shared schedule,
 * core/exit_read.ts `growShortHorizon`) until a CLEAN airborne geometric arc
 * exit (shared detector, core/exit_read.ts `firstAirborneExitFrame`) is found,
 * then read the smoothed launch state at the exit frame (shared estimator,
 * core/launch_read.ts) for the ballistic axis-suffix completion.
 *
 * Mirrors optimizer/arc_probe.ts short mode exactly, except this reads off the
 * DETECTION arrays (positionAt/airborneAt/velocityAt) where arc_probe reads the
 * metered engine. Returns null — meaning "use the full horizon, byte-identical
 * to the former behavior" — when:
 *   - the growth loop stopped on an early termination (a ride-out / death the
 *     caller must see in full), or hit the cap with no exit;
 *   - the exit frame would ride into the next contact (no ballistic flight);
 *   - the exit-frame launch state is unreadable;
 *   - the truncated horizon is not below the full horizon (no frames to save).
 */
function computeShortGapFitDetection(
  redetect: (horizon: number) => Detection,
  lines: readonly TrackLine[],
  gap: Gap,
  axisMeasureEnd: number,
  fullHorizon: number,
): { det: Detection; stopHorizon: number; suffix: BallisticAxisSuffix } | null {
  const minExit = gap.endFrame;
  // Cap covers the survival margin (endFrame+16), the catch+8 launch read
  // (endFrame+8+LAUNCH_READ_FRAMES), the impact axis window, and the lookahead
  // boundary — mirrors arc_probe.ts axisSafeCap (= endFrame+max(20,IMPACT_WINDOW+2))
  // with axisMeasureEnd+2 standing in for nextFrame+2.
  const axisSafeCap = gap.endFrame + Math.max(20, IMPACT_WINDOW + 2);
  const cap = Math.min(fullHorizon, Math.max(axisSafeCap, axisMeasureEnd + 2));
  // Survival floor the truncated prefix MUST cover before a clean exit may
  // truncate: endFrame+SURVIVAL_MARGIN — the catch/tail-contact window where ALL
  // survival deaths occur (gate-diagnostic study: 100% riderEjected at catch ±2
  // or tail +3..16, ZERO clean-airborne-past-exit deaths). Deliberately NOT
  // raised to axisMeasureEnd: for lookahead gaps that would force the prefix to
  // ride to the next contact and forfeit the truncation's entire saving; past
  // this floor, a clean airborne exit certifies survival to the next contact.
  const survivalFloor = Math.min(cap, gap.endFrame + 16);
  let exitStop: { det: Detection; horizon: number; exitFrame: number } | null = null;
  const stopHorizon = growShortHorizon(minExit, cap, (horizon) => {
    const det = redetect(horizon);
    const terminatedEarly = det.terminus.frame < horizon && det.terminus.reason !== "endOfSpec";
    const exitFrame = (!terminatedEarly && horizon >= survivalFloor)
      ? firstAirborneExitFrame(
        lines, minExit, horizon,
        (frame) => airborneAt(det, frame),
        (frame) => positionAt(det, frame),
      )
      : null;
    const exitFound = exitFrame !== null;
    if (exitFound) exitStop = { det, horizon, exitFrame };
    return { terminatedEarly, exitFound };
  });
  // Only a CLEAN-EXIT stop truncates. Cap/early-termination ⇒ fall back to full.
  if (exitStop === null || exitStop.horizon !== stopHorizon || stopHorizon >= fullHorizon) return null;
  // exitFrame was already located by the stopping probe — reuse it instead of re-scanning.
  const { det, horizon, exitFrame } = exitStop;
  // No ballistic flight if the exit would ride into the next contact (mirror the
  // releaseStateFrame / releaseExitArrivalState nextContact−2 bound).
  const nextContact = allContactFramesFor(gap, axisMeasureEnd);
  if (nextContact !== null && exitFrame > nextContact - 2) return null;

  const suffix = ballisticSuffixAtExit(det, exitFrame);
  if (suffix === null) return null;
  return { det, stopHorizon: horizon, suffix };
}

/** The next-contact frame the truncation must not ride into: `axisMeasureEnd`
 *  when it is a lookahead boundary (the next contact, > gap.endFrame), else null
 *  (no later contact in view this gap). */
function allContactFramesFor(gap: Gap, axisMeasureEnd: number): number | null {
  return axisMeasureEnd > gap.endFrame ? axisMeasureEnd : null;
}

/** Smoothed ballistic launch state at the geometric exit frame, read off the
 *  detection (shared estimator, core/launch_read.ts) — the suffix velocity the
 *  axis completion propagates ballistically. Null when the exit-frame
 *  position/velocity is unreadable. */
function ballisticSuffixAtExit(det: Detection, exitFrame: number): BallisticAxisSuffix | null {
  const pos = positionAt(det, exitFrame);
  const v0 = velocityAt(det, exitFrame);
  if (pos === undefined || v0 === undefined) return null;
  if (!Number.isFinite(v0.x) || !Number.isFinite(v0.y)) return null;
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  const { vx, vy } = gravityCorrectedLaunchAverage(
    v0,
    g,
    (k) => airborneAt(det, exitFrame + k) === true,
    (k) => velocityAt(det, exitFrame + k),
  );
  return { frame: exitFrame, vx, vy };
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
  /** True only for the per-candidate BASE evaluation (not ride-out re-evals);
   *  gates the landing-window probe so each candidate is recorded once. */
  landingProbeEligible = false,
): {
  fit: Pick<
    GapFit,
    | "lines"
    | "achieved"
    | "achievedAtEnd"
    | "cost"
    | "releaseSpeed"
    | "releaseVelocityY"
    | "releaseGroundedFrames"
    | "releaseAirborne"
    | "releaseArrivalState"
  >;
  failure: null;
} | {
  fit: null;
  failure: ArcPlacementDirectFailureReason;
} {
  // deno-lint-ignore no-explicit-any
  const eng: any = baseEngine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
  const fullHorizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20);
  const redetect = (h: number): Detection =>
    useWindowDetection ? detectWindow(eng, gap.startFrame, h) : detect(extractRawTrajectory(eng, h));

  // SHORT-HORIZON GAP FIT (the minimal-simulation principle — same conversion the
  // probe ride does in optimizer/arc_probe.ts short mode, via the shared
  // core/exit_read.ts helpers). Grow the detection window in 4-frame chunks until
  // a clean airborne arc exit is found, then complete the axis measurement
  // ballistically from the exit-frame launch state — instead of riding the engine
  // through the next gap to `axisMeasureEnd`. Falls back to the full horizon when
  // no clean exit is found within the cap (ride-outs / tail-riders), which is
  // byte-identical to the former behavior.
  const short = computeShortGapFitDetection(redetect, lines, gap, axisMeasureEnd, fullHorizon);
  const truncated = short !== null;
  const horizon = truncated ? short.stopHorizon : fullHorizon;
  const det = truncated ? short.det : redetect(fullHorizon);
  // Ballistic suffix for the axis measurement past the truncated detection;
  // null in the full-horizon path (measureGapAxesWithBallisticSuffix degrades to
  // measureGapAxes when rangeEndFrame ≤ the detection's last frame). The off-beat
  // / survival measurement boundary clamps to the truncated horizon.
  const ballisticSuffix = truncated ? short.suffix : null;
  const measureEnd = truncated ? Math.min(axisMeasureEnd, horizon) : axisMeasureEnd;
  if (truncated) {
    gapfitShortTotals.gapfit_truncated++;
    gapfitShortTotals.gapfit_frames_saved += Math.max(0, fullHorizon - horizon);
  } else {
    gapfitShortTotals.gapfit_full++;
  }

  // Hard gate 1: rider survived to gap.endFrame + SURVIVAL_MARGIN.
  // Surviving exactly the landing frame isn't enough — many randomly-sampled
  // catch geometries eject the rider on the next frame. Require the rider to
  // remain alive long enough to plausibly bridge into the next gap. Under
  // truncation the prefix always covers endFrame+SURVIVAL_MARGIN — the window
  // holding 100% of observed survival deaths (computeShortGapFitDetection
  // survivalFloor) — and the gate clamps to the truncated horizon: for lookahead
  // gaps the prefix stops at the clean exit instead of the next contact, and the
  // exit certifies the rest (gate-diagnostic study: ZERO clean-airborne-past-exit
  // deaths).
  const SURVIVAL_MARGIN = 16;
  const minSurvival = truncated
    ? Math.min(horizon, Math.max(gap.endFrame + SURVIVAL_MARGIN, axisMeasureEnd))
    : Math.max(gap.endFrame + SURVIVAL_MARGIN, axisMeasureEnd);
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
  // Under truncation the boundary clamps to the truncated horizon (off-beat fires
  // on 0.1% of evals, own-arc double-touches within +16, captured by the prefix).
  const offBeat = countOffBeatLandings(
    det.events, gap.startFrame, measureEnd, allContactFrames,
  );
  if (offBeat > 0) return { fit: null, failure: "offbeat" };

  // Axis measurement: engine prefix + ballistic suffix when truncated (the
  // shared measure.ts completion), the verbatim full-detection read otherwise.
  const achieved = ballisticSuffix === null
    ? measureGapAxes(det, gap, lines, axisMeasureEnd)
    : measureGapAxesWithBallisticSuffix(det, gap, lines, axisMeasureEnd, ballisticSuffix);
  // GAP-WINDOW achieved (the true scorer's window): when the lookahead window
  // extends past gap.endFrame (air/lookahead gaps), `achieved` above is measured
  // over the wrong window to reproduce the scorer, so also read the [start, endFrame]
  // axes — PURE ENGINE off the SAME det (gap.endFrame is inside the prefix the survival
  // floor already guarantees; zero ballistic, zero extra frames). For non-lookahead,
  // non-truncated gaps the two windows coincide, so `achieved` already IS the gap-window
  // value and we leave achievedAtEnd undefined (the objective leaf falls back to achieved).
  const achievedAtEnd = (axisMeasureEnd === gap.endFrame && ballisticSuffix === null)
    ? undefined
    : measureGapAxes(det, gap, lines, gap.endFrame);
  const releaseFrame = releaseStateFrame(gap, allContactFrames);
  const releaseSpeed = speedAt(det, releaseFrame);
  const releaseVelocity = velocityAt(det, releaseFrame);
  const releaseGroundedFrames = groundedFramesInRange(det, gap.endFrame, releaseFrame);
  const releaseAirborne = airborneAt(det, releaseFrame);
  // Local candidate cost == the scorer's per-gap axis error (axisCost), so the pool
  // sort mirrors the scorer for the CURRENT gap (modulo the intentional impact
  // down-weight). Forward-looking release-speed setup — against the NEXT gap's speed
  // target — is added separately by the handoff ranker (candidateReleaseSetupPenalty),
  // not re-charged here: one current-gap cost term + one next-gap setup term, instead
  // of double-charging current-gap speed (board-confirmed redundant: parity, removed).
  const cost = axisCost(searchTargets, achieved);
  if (probeRecord !== null) probeRecord.cost = cost;
  // PREDICTED-ARRIVAL: full launch/exit state for the ranker to propagate
  // ballistically to the next contact instead of charging a probe ride, read off
  // the SAME detection (zero extra frames). Gated on pool mode so the
  // LR_RANK_QUALITY=off path never allocates the field. The catch+8 read is the
  // load-bearing FALLBACK; the geometric arc-exit read below is the default.
  let releaseArrivalState = POOL_MODE
    ? releaseArrivalStateAt(det, gap.endFrame, releaseFrame, releaseGroundedFrames, releaseAirborne)
    : undefined;
  // GEOMETRIC EXIT READ (pool mode): re-read the BALLISTIC release state at the
  // geometric arc-exit frame instead of catch+8, so the predict-arrival ranker
  // sees an airborne launch. Cost-term fields above are untouched. The exit frame
  // is read off the SAME detection (positions/airborne already computed) — zero
  // extra physics frames. Falls back to the catch+8 read above when there is no
  // exit, the exit rides into the next contact, or the exit state is unreadable.
  // That fallback is load-bearing: short rides legitimately never exit (~25%
  // no_exit on tiny_dance) and must keep the catch+8 capture, not be discarded.
  if (POOL_MODE) {
    releaseArrivalState = releaseExitArrivalState(
      det, gap, lines, horizon, allContactFrames,
    ) ?? releaseArrivalState;
  }
  return {
    fit: {
      lines,
      achieved,
      ...(achievedAtEnd === undefined ? {} : { achievedAtEnd }),
      cost,
      releaseSpeed,
      ...(releaseVelocity === undefined ? {} : { releaseVelocityY: releaseVelocity.y }),
      releaseGroundedFrames,
      ...(releaseAirborne === undefined ? {} : { releaseAirborne }),
      ...(releaseArrivalState === undefined ? {} : { releaseArrivalState }),
    },
    failure: null,
  };
}

/** Full launch/exit state at `releaseFrame`, read off an existing detection for
 *  ballistic propagation by the quality ranker (POOL_MODE). The
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

/** Penalty on the launch speed at the release frame (catch+8, `releaseStateFrame`)
 *  against a speed target. Used by the handoff ranker's forward-looking setup term
 *  (`candidateReleaseSetupPenalty`) with the NEXT gap's speed target, to prefer
 *  catches whose launch speed sets up the following span. Uses the release-INSTANT
 *  speed (a launch-readiness proxy), distinct from the window-MEAN `speed` axis that
 *  axisCost already scores for the current gap. */
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
  // All axes are weighted 1 to mirror the scorer's equal pooling, EXCEPT `impact`,
  // which is deliberately down-weighted (LOCAL_IMPACT_COST_WEIGHT, flat 0.5) so the
  // cheap candidate prefix does not over-prioritize the newly-scored impact axis
  // over air/speed/elevation/amplitude — a known, intentional divergence from the
  // scorer's equal weighting. impact draws no sampling RNG, so its presence in the
  // sort never perturbs candidate generation.
  let cost = 0;
  for (const key of AXES) {
    const t = target[key];
    const a = achieved[key];
    if (t !== undefined && a !== undefined) {
      const d = t - a;
      cost += (key === "impact" ? LOCAL_IMPACT_COST_WEIGHT : 1) * d * d;
    }
  }
  return cost;
}
