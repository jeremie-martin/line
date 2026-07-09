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
  ELEVATION,
  FPS,
  IMPACT_WINDOW,
  impactEnvNum,
  hasExactlyTargetAxes,
  type CandidateSampleMode,
  SPEED_RULER,
  speedPxToAuthored,
} from "../types.ts";
import {
  type GapFit,
  copyOptionalGapFitFields,
  median,
  engineLineFromTrackLine,
  contactLineIdsAt,
  airborneAt,
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

const AIR_POLISH_LOCAL_CONTINUATION_LENGTH_PX = 50;
const AIR_POLISH_RUNWAY_CONTINUATION_LENGTH_PX = 300;
/** Number of recent candidate lines used as anchors for ride-out rescue. With
 *  the two continuation lengths above, this bounds each qualifying candidate at
 *  16 extra full re-evals while still covering the catch/tail geometry most
 *  likely to control the post-contact launch. */
const AIR_POLISH_RIDEOUT_SOURCE_TAIL_LINES = 8;
/** Two-scale ride-out rescue for long pure-air lookahead gaps. These lines are
 *  appended only after a candidate already passed the normal gates, then kept
 *  only when a full re-eval lowers current-gap cost: 50px probes a local
 *  stabilizer, 300px probes a long grounded runway. Dropping either scale is a
 *  real selection change, not a cleanup; prior low-air ride-out trials show
 *  "more/longer" support is narrow and seed-sensitive. */
const AIR_POLISH_CONTINUATION_LENGTHS = [
  AIR_POLISH_LOCAL_CONTINUATION_LENGTH_PX,
  AIR_POLISH_RUNWAY_CONTINUATION_LENGTH_PX,
] as const;
const RELEASE_STATE_FRAME_OFFSET = 8;
const LONG_AIR_GAP_SECONDS = 1.5;
const LONG_AIR_GAP_FRAMES = Math.round(FPS * LONG_AIR_GAP_SECONDS);
const AIR_LOOKAHEAD_POST_CONTACT_FRAMES = Math.floor(FPS / 2);

/** Survival-window margin (frames past a gap's endFrame). The catch/tail-contact
 *  window `[endFrame, endFrame+SURVIVAL_MARGIN]` holds 100% of observed survival
 *  deaths (gate-diagnostic study). Shared by `computeShortGapFitDetection`'s
 *  `survivalFloor` and `evaluateGapFit`'s survival gate so the short-horizon
 *  truncation and the gate never diverge. */
const SURVIVAL_MARGIN = 16;
/** `axisSafeCap` floor (frames past endFrame): minimum truncation cap covering the
 *  survival margin + catch+8 launch read (mirrors arc_probe.ts axisSafeCap `20`). */
const AXIS_SAFE_CAP_MIN_FRAMES = 20;
/** Final completed tracks are scored with a short rideout tail past the authored
 *  duration. A final catch that lands on-beat but immediately re-lands on its
 *  own rideout support is therefore a scorer-visible off-beat. Local candidate
 *  validation must inspect the already-simulated catch tail for the last authored
 *  contact, even though there is no next contact boundary. */
const FINAL_CONTACT_OFFBEAT_TAIL_FRAMES = AXIS_SAFE_CAP_MIN_FRAMES;
/** `axisSafeCap` next-contact offset: `axisMeasureEnd+2` stands in for arc_probe.ts's
 *  `nextFrame+2` lookahead boundary. */
const AXIS_SAFE_CAP_MEASURE_END_OFFSET = 2;

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
/** Generic module-level counter bundle: a mutable `counters` object plus a
 *  `reset` that restores every field to its initial value (via a retained copy
 *  of `initial`, so adding a field can never desync a hand-enumerated reset) and
 *  a spread-copy `snapshot`. Shared by the candidate-side telemetry bundles below;
 *  bespoke "any activity" gating stays in each snapshot wrapper. */
function makeCounterBundle<T extends Record<string, number>>(initial: T): {
  counters: T;
  reset: () => void;
  snapshot: () => T;
} {
  const counters = { ...initial };
  return {
    counters,
    reset: () => { Object.assign(counters, initial); },
    snapshot: () => ({ ...counters }),
  };
}

const releaseExitBundle = makeCounterBundle({
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
});
const releaseExitTotals = releaseExitBundle.counters;
export type ReleaseExitStats = typeof releaseExitTotals;

export function resetReleaseExitStats(): void {
  releaseExitBundle.reset();
}
registerCompileReset(resetReleaseExitStats);

export function snapshotReleaseExitStats(): ReleaseExitStats | null {
  const anyActivity = releaseExitTotals.release_exit_used > 0 ||
    releaseExitTotals.release_exit_fallback_no_exit > 0 ||
    releaseExitTotals.release_exit_fallback_next_contact > 0 ||
    releaseExitTotals.release_exit_fallback_unreadable > 0;
  return anyActivity ? releaseExitBundle.snapshot() : null;
}

/** Telemetry for the short-horizon gap fit. Counts truncated vs full-horizon
 *  candidate evaluations and the frames saved (full-horizon-would-have-been −
 *  actual stop), in the established candidate-side style. Snapshot/reset are
 *  wired through optimizer/handoff.ts into the per-budget compile stats.
 *  NOTE: compactStats may strip these from archives — measure live. */
const gapfitShortBundle = makeCounterBundle({
  /** Candidate evals that truncated at a clean geometric exit (short horizon). */
  gapfit_truncated: 0,
  /** Candidate evals that fell through to the full horizon (no clean exit in cap,
   *  or the short horizon was already ≥ the full horizon — no saving possible). */
  gapfit_full: 0,
  /** Σ (full horizon − truncated horizon) over truncated evals: detection frames
   *  saved vs riding the engine to the former next-gap horizon. */
  gapfit_frames_saved: 0,
});
const gapfitShortTotals = gapfitShortBundle.counters;
export type GapfitShortStats = typeof gapfitShortTotals;

export function resetGapfitShortStats(): void {
  gapfitShortBundle.reset();
}
registerCompileReset(resetGapfitShortStats);

export function snapshotGapfitShortStats(): GapfitShortStats | null {
  const anyActivity = gapfitShortTotals.gapfit_truncated > 0 || gapfitShortTotals.gapfit_full > 0;
  return anyActivity ? gapfitShortBundle.snapshot() : null;
}

/** Weight of the release-speed SETUP term (`releaseSpeedPenalty`). Applied by the
 *  handoff ranker (`candidateReleaseSetupPenalty`) against the NEXT contact gap's
 *  speed target — a forward-looking signal preferring catches whose launch speed
 *  sets up the following span. The landed value preserves the old physical
 *  penalty after the authored-speed ruler narrowed from 12 px/frame to the
 *  current range: `0.35 * (7.2 / 12)^2 = 0.126`. It is deliberately NOT charged
 *  against the current gap's cost: axisCost already scores current-gap speed once
 *  (matching the scorer), and re-charging it there was board-confirmed redundant
 *  (parity → removed). */
const LEGACY_RELEASE_STATE_SPEED_WEIGHT = 0.35;
const LEGACY_RELEASE_SPEED_RANGE_PX_PER_FRAME = 12;
const RELEASE_STATE_SPEED_WEIGHT = LEGACY_RELEASE_STATE_SPEED_WEIGHT *
  (SPEED_RULER.RANGE_PX_PER_FRAME / LEGACY_RELEASE_SPEED_RANGE_PX_PER_FRAME) ** 2;
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
export const LOCAL_IMPACT_COST_WEIGHT = Math.max(0, impactEnvNum("LR_IMPACT_LOCAL_W", 0.5));

// ─────────── Landing-window probe hook (study-only, off by default) ───────────
// Read-only diagnostic seam for the landing-redefinition / impact-funnel studies.
// The full probe apparatus (records, the minimal-W acceptance sweep, arc-angle
// geometry) lives in the study module scripts/v0/landing_probe.ts and installs
// itself here through the single setLandingProbeHook seam. When no study has
// enabled it — always, in production — the hook is null and the hot path pays one
// null check, so compiles are byte-identical.

/** Mutable cost sink the final candidate cost is written back into (see the
 *  `probeRecord.cost = cost` line below). Structurally a slice of the study's
 *  LandingWindowProbeRecord. */
export type LandingProbeCostSink = { cost: number | null };

/** The seam the study apparatus registers through. All methods run only while a
 *  study has installed a hook; production never installs one. */
export type LandingProbeHook = {
  /** Candidate died at the survival gate — geometry is known, no landing data. */
  onSurvivalFailure(gap: Gap, lines: TrackLine[]): void;
  /** Survival-passing candidate — record the minimal acceptance window and return
   *  a handle whose `.cost` is filled in once the candidate is fully costed. */
  onLandingWindow(
    det: Detection,
    gap: Gap,
    lines: TrackLine[],
    allContactFrames: number[],
    axisMeasureEnd: number,
  ): LandingProbeCostSink | null;
  /** Attach a handoff-ranker score to the probe record for `lines`. */
  onHandoffScore(lines: object, score: number): void;
};

let landingProbeHook: LandingProbeHook | null = null;

/** Install (or clear) the study probe hook. Called only by scripts/v0/landing_probe.ts. */
export function setLandingProbeHook(hook: LandingProbeHook | null): void {
  landingProbeHook = hook;
}

/** Study hook for optimizer/handoff.ts — no-op when the probe is disabled. */
export function attachHandoffScoreToProbe(lines: object, score: number): void {
  landingProbeHook?.onHandoffScore(lines, score);
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

type CandidateWindowFrameReader = {
  frameCount: number;
  duration: number;
  frameAt(index: number): number;
  positionXAt(index: number): number;
  positionYAt(index: number): number;
  velocityXAt(index: number): number;
  velocityYAt(index: number): number;
  contactLineIdsAt(index: number): number[];
  isAirAt(index: number): boolean;
  riderEjectedAt(index: number): boolean;
  sledBrokenAt(index: number): boolean;
};

function detectCandidateWindowBuffer(raw: CandidateWindowRaw | null): WindowDetection | null {
  if (raw === null) return null;
  const { data, contacts, stride } = raw;
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
  return detectCandidateWindowFrames({
    frameCount: raw.frames,
    duration: raw.duration,
    frameAt: (index) => raw.startFrame + index,
    positionXAt: (index) => data[baseAt(index) + WINDOW_PX],
    positionYAt: (index) => data[baseAt(index) + WINDOW_PY],
    velocityXAt: (index) => data[baseAt(index) + WINDOW_VX],
    velocityYAt: (index) => data[baseAt(index) + WINDOW_VY],
    contactLineIdsAt: contactLineIdsAtIndex,
    isAirAt: (index) => sledMaskAt(index) === 0,
    riderEjectedAt: (index) => data[baseAt(index) + WINDOW_RIDER_FSU] !== -1,
    sledBrokenAt: (index) => data[baseAt(index) + WINDOW_SLED_FSU] !== -1,
  });
}

function detectCandidateWindowRaw(raw: RawTrajectory): Detection {
  const frames = raw.frames;
  return detectCandidateWindowFrames({
    frameCount: frames.length,
    duration: raw.duration,
    frameAt: (index) => frames[index].frame,
    positionXAt: (index) => frames[index].position.x,
    positionYAt: (index) => frames[index].position.y,
    velocityXAt: (index) => frames[index].velocity.x,
    velocityYAt: (index) => frames[index].velocity.y,
    contactLineIdsAt: (index) => frames[index].contactLineIds,
    isAirAt: (index) => frames[index].sledContacts.length === 0,
    riderEjectedAt: (index) => frames[index].riderEjected,
    sledBrokenAt: (index) => frames[index].sledBroken,
  });
}

function detectCandidateWindowFrames(reader: CandidateWindowFrameReader): WindowDetection {
  const frameCount = reader.frameCount;
  if (frameCount === 0) {
    throw new Error("detect: empty trajectory");
  }

  const speed: number[] = [];
  const velocity: { x: number; y: number }[] = [];
  const contactLineIds: number[][] = [];
  const airborne: boolean[] = [];
  const events: DetEvent[] = [];
  // PREDICTED-ARRIVAL (POOL_MODE): the ranker propagates the release state
  // ballistically and needs position. The window detector otherwise drops
  // position to save memory on the hot path; populate it ONLY when the flag is
  // on so flag-off allocation is unchanged.
  const position: { x: number; y: number }[] = [];

  let stallRun = 0;
  let airborneRun = 0;
  let airborneFrom = -1;
  let terminus: Detection["terminus"] | null = null;

  for (let i = 0; i < frameCount; i++) {
    const frame = reader.frameAt(i);
    const vx = reader.velocityXAt(i);
    const vy = reader.velocityYAt(i);
    const sp = Math.hypot(vx, vy);
    speed.push(sp);
    velocity.push({ x: vx, y: vy });
    if (POOL_MODE) position.push({ x: reader.positionXAt(i), y: reader.positionYAt(i) });
    contactLineIds.push(reader.contactLineIdsAt(i));
    const isAir = reader.isAirAt(i);
    airborne.push(isAir);

    if (reader.riderEjectedAt(i)) {
      terminus = { frame, reason: "riderEjected" };
      break;
    }
    if (reader.sledBrokenAt(i)) {
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
      Math.abs(reader.positionXAt(i)) > DEFAULT_PARAMS.worldEnvelope ||
      Math.abs(reader.positionYAt(i)) > DEFAULT_PARAMS.worldEnvelope
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
        if (!reader.isAirAt(j)) groundedInWindow++;
      }

      if (airborneRun > DEFAULT_PARAMS.K && groundedInWindow / windowLen >= DEFAULT_PARAMS.persistenceRatio) {
        events.push({ frame, type: "landing", airborneFrom });
      }
      airborneRun = 0;
      airborneFrom = -1;
    }
  }

  if (terminus === null) {
    const lastFrame = reader.frameAt(frameCount - 1);
    terminus = {
      frame: Math.min(lastFrame, reader.duration),
      reason: lastFrame >= reader.duration ? "endOfSpec" : "rideStalled",
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
): TrackLine[] {
  const lines: TrackLine[] = [];
  const dx = source.x2 - source.x1;
  const dy = source.y2 - source.y1;
  const len = Math.hypot(dx, dy);
  if (len > 0) {
    for (const length of AIR_POLISH_CONTINUATION_LENGTHS) {
      lines.push(
        makeSolidLine(
          lineId,
          source.x2,
          source.y2,
          source.x2 + (dx / len) * length,
          source.y2 + (dy / len) * length,
        ),
      );
    }
  }
  return lines;
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
      for (const rideOut of makeAirPolishCandidates(rideOutId, source)) {
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
      cost: best.fit.cost,
      ...copyOptionalGapFitFields(best.fit),
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
): { det: Detection; stopHorizon: number; exitFrame: number; suffix: BallisticAxisSuffix } | null {
  const minExit = gap.endFrame;
  // Cap covers the survival margin (endFrame+SURVIVAL_MARGIN), the catch+8 launch read
  // (endFrame+8+LAUNCH_READ_FRAMES), the impact axis window, and the lookahead
  // boundary — mirrors arc_probe.ts axisSafeCap (= endFrame+max(20,IMPACT_WINDOW+2))
  // with axisMeasureEnd+2 standing in for nextFrame+2.
  const axisSafeCap = gap.endFrame + Math.max(AXIS_SAFE_CAP_MIN_FRAMES, IMPACT_WINDOW + 2);
  const cap = Math.min(fullHorizon, Math.max(axisSafeCap, axisMeasureEnd + AXIS_SAFE_CAP_MEASURE_END_OFFSET));
  // Survival floor the truncated prefix MUST cover before a clean exit may
  // truncate: endFrame+SURVIVAL_MARGIN — the catch/tail-contact window where ALL
  // survival deaths occur (gate-diagnostic study: 100% riderEjected at catch ±2
  // or tail +3..16, ZERO clean-airborne-past-exit deaths). Deliberately NOT
  // raised to axisMeasureEnd: for lookahead gaps that would force the prefix to
  // ride to the next contact and forfeit the truncation's entire saving; past
  // this floor, a clean airborne exit certifies survival to the next contact.
  const survivalFloor = Math.min(cap, gap.endFrame + SURVIVAL_MARGIN);
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
  // releaseStateFrame / releaseExitArrivalState nextContact−2 bound). The next
  // contact is `axisMeasureEnd` when it is a lookahead boundary (a later contact,
  // > gap.endFrame), else null (no later contact in view this gap).
  const nextContact = axisMeasureEnd > gap.endFrame ? axisMeasureEnd : null;
  if (nextContact !== null && exitFrame > nextContact - 2) return null;

  const suffix = ballisticSuffixAtExit(det, exitFrame);
  if (suffix === null) return null;
  return { det, stopHorizon: horizon, exitFrame, suffix };
}

/** Shared smoothed ballistic launch read at `frame`, off the detection arrays
 *  (positionAt/velocityAt/airborneAt) via the gravity-corrected launch-average
 *  estimator (core/launch_read.ts). Returns the read position plus the smoothed
 *  {vx,vy}; null when the frame position/velocity is unreadable or the velocity
 *  is non-finite. Callers layer their own extra checks/fields on top. */
function readSmoothedLaunch(
  det: Detection,
  frame: number,
): { pos: { x: number; y: number }; vx: number; vy: number } | null {
  const pos = positionAt(det, frame);
  const v0 = velocityAt(det, frame);
  if (pos === undefined || v0 === undefined) return null;
  if (!Number.isFinite(v0.x) || !Number.isFinite(v0.y)) return null;
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  const { vx, vy } = gravityCorrectedLaunchAverage(
    v0,
    g,
    (k) => airborneAt(det, frame + k) === true,
    (k) => velocityAt(det, frame + k),
  );
  return { pos, vx, vy };
}

/** Smoothed ballistic launch state at the geometric exit frame, read off the
 *  detection (shared estimator, core/launch_read.ts) — the suffix velocity the
 *  axis completion propagates ballistically. Null when the exit-frame
 *  position/velocity is unreadable. */
function ballisticSuffixAtExit(det: Detection, exitFrame: number): BallisticAxisSuffix | null {
  const launch = readSmoothedLaunch(det, exitFrame);
  if (launch === null) return null;
  return { frame: exitFrame, vx: launch.vx, vy: launch.vy };
}

function measureAchieved(
  det: Detection,
  gap: Gap,
  lines: readonly TrackLine[],
  axisMeasureEnd: number,
  ballisticSuffix: BallisticAxisSuffix | null,
): { achieved: AxisValues; achievedAtEnd?: AxisValues } {
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
  if (axisMeasureEnd === gap.endFrame && ballisticSuffix === null) return { achieved };
  return { achieved, achievedAtEnd: measureGapAxes(det, gap, lines, gap.endFrame) };
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
  const offBeatGateEnd = candidateOffBeatGateEndFrame(gap, axisMeasureEnd, allContactFrames);
  const fullHorizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20, offBeatGateEnd);
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
  const needsFinalTailOffBeatGate = offBeatGateEnd > axisMeasureEnd;
  const short = needsFinalTailOffBeatGate
    ? null
    : computeShortGapFitDetection(redetect, lines, gap, axisMeasureEnd, fullHorizon);
  const truncated = short !== null;
  const horizon = truncated ? short.stopHorizon : fullHorizon;
  const det = truncated ? short.det : redetect(fullHorizon);
  // Ballistic suffix for the axis measurement past the truncated detection;
  // null in the full-horizon path (measureGapAxesWithBallisticSuffix degrades to
  // measureGapAxes when rangeEndFrame ≤ the detection's last frame). The survival
  // boundary clamps to the truncated horizon.
  const ballisticSuffix = truncated ? short.suffix : null;
  const ballisticExitFrame = truncated ? short.exitFrame : null;
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
  const minSurvival = truncated
    ? Math.min(horizon, Math.max(gap.endFrame + SURVIVAL_MARGIN, axisMeasureEnd))
    : Math.max(gap.endFrame + SURVIVAL_MARGIN, axisMeasureEnd);
  if (det.terminus.frame < minSurvival && det.terminus.reason !== "endOfSpec") {
    if (landingProbeEligible && landingProbeHook !== null) landingProbeHook.onSurvivalFailure(gap, lines);
    return { fit: null, failure: "survival" };
  }

  // Study-only probe (no-op unless a study script enabled it): record what a
  // widened acceptance window would have admitted. Pure observation — gates
  // below run unchanged. The returned record gets the final cost attached below.
  const probeRecord = landingProbeEligible && landingProbeHook !== null
    ? landingProbeHook.onLandingWindow(det, gap, lines, allContactFrames, axisMeasureEnd)
    : null;

  // Hard gate 2: a landing event near gap.endFrame ±1.
  const owned = new Set(lines.map((l) => l.id));
  const landingNearTarget = det.events.some(
    (e) => e.type === "landing"
      && Math.abs(e.frame - gap.endFrame) <= 1
      && intersectsLineIds(e, det, owned),
  );
  if (!landingNearTarget) return { fit: null, failure: "landing" };

  // Hard gate 3: no off-beat landings before the next measurement boundary. For
  // the final authored contact, extend the gate through the already-simulated
  // rideout tail, matching the final scorer's full-track off-beat visibility.
  const offBeat = countOffBeatLandings(
    det.events, gap.startFrame, offBeatGateEnd, allContactFrames,
  );
  if (offBeat > 0) return { fit: null, failure: "offbeat" };

  const { achieved, achievedAtEnd } = measureAchieved(
    det, gap, lines, axisMeasureEnd, ballisticSuffix,
  );
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
    // The truncated path already found the clean exit for its ballistic suffix;
    // pass it through so the release read does not scan the same window again.
    releaseArrivalState = releaseExitArrivalState(
      det, gap, lines, horizon, allContactFrames, ballisticExitFrame,
    ) ?? releaseArrivalState;
  }
  return {
    fit: {
      lines,
      achieved,
      cost,
      releaseSpeed,
      releaseGroundedFrames,
      ...copyOptionalGapFitFields({
        achievedAtEnd,
        releaseVelocityY: releaseVelocity?.y,
        releaseAirborne,
        releaseArrivalState,
      }),
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
  // Gravity-corrected launch read (shared estimator — core/launch_read.ts).
  // This call site differs from optimizer/arc_probe.ts only in the velocity
  // source (detection arrays vs metered engine) and in having no fork-horizon
  // bound. Additionally require the release position to be finite (the arrival
  // state carries it) before attaching pose/grounded/airborne.
  const launch = readSmoothedLaunch(det, releaseFrame);
  if (launch === null) return undefined;
  const { pos } = launch;
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return undefined;
  return {
    frame: releaseFrame,
    x: pos.x,
    y: pos.y,
    vx: launch.vx,
    vy: launch.vy,
    sledPoseDeg: null,
    sledPoseRateDegPerFrame: null,
    grounded,
    airborne: airborne === true,
  };
}

/** The first contact after `gap.endFrame` and the latest usable
 *  ballistic-launch frame (that contact minus 2 — no ballistic flight may ride
 *  into the next contact). Null when no later contact is in view. Shared by the
 *  release-frame clamp (`releaseStateFrame`) and the exit-into-next-contact
 *  reject (`releaseExitArrivalState`) so the `-2` bound lives in one place.
 *  NOTE: `computeShortGapFitDetection` deliberately does NOT use this — it bounds
 *  against `axisMeasureEnd` (the lookahead boundary), a different frame reference. */
function nextContactBound(
  gap: Gap,
  allContactFrames: number[],
): { nextContact: number; latestBallisticFrame: number } | null {
  const nextContact = allContactFrames.find((frame) => frame > gap.endFrame);
  if (nextContact === undefined) return null;
  return { nextContact, latestBallisticFrame: nextContact - 2 };
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
 *  release fields — only the predicted-arrival ranker state. `knownExitFrame`
 *  skips the scan when short-horizon detection already located the same exit. */
function releaseExitArrivalState(
  det: Detection,
  gap: Gap,
  lines: readonly TrackLine[],
  horizon: number,
  allContactFrames: number[],
  knownExitFrame: number | null = null,
): GapFit["releaseArrivalState"] | null {
  const exitFrame = knownExitFrame ?? firstAirborneExitFrame(
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
  const bound = nextContactBound(gap, allContactFrames);
  if (bound !== null && exitFrame > bound.latestBallisticFrame) {
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
  const bound = nextContactBound(gap, allContactFrames);
  if (bound === null) return preferred;
  const latestBeforeNext = bound.latestBallisticFrame;
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
      gap.endFrame - gap.startFrame >= LONG_AIR_GAP_FRAMES
    );
}

function rideOutSources(lines: TrackLine[]): TrackLine[] {
  return lines.slice(Math.max(0, lines.length - AIR_POLISH_RIDEOUT_SOURCE_TAIL_LINES));
}

export function axisLookaheadEndFrame(gap: Gap, allContactFrames: number[]): number {
  if (gap.targets.air === undefined) return gap.endFrame;
  const nextContact = allContactFrames.find((cf) => cf > gap.endFrame) ?? gap.endFrame;
  const postContactFrames = nextContact - gap.endFrame;
  // For long airborne gaps, the catch at gap.endFrame determines most of the
  // air/contact balance after the beat, not before it. Score those candidates
  // through the next beat so ranking can prefer a catch that keeps riding.
  if (gap.endFrame - gap.startFrame >= LONG_AIR_GAP_FRAMES) return nextContact;
  if (postContactFrames > AIR_LOOKAHEAD_POST_CONTACT_FRAMES) return nextContact;
  return gap.endFrame;
}

// ─────────── Hard-gate helpers ───────────

export function intersectsLineIds(
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

export function candidateOffBeatGateEndFrame(
  gap: Gap,
  measureEnd: number,
  contactFrames: readonly number[],
): number {
  if (!gap.endsWithContact) return measureEnd;
  const lastContactFrame = contactFrames[contactFrames.length - 1];
  if (lastContactFrame !== gap.endFrame) return measureEnd;
  return Math.max(measureEnd, gap.endFrame + FINAL_CONTACT_OFFBEAT_TAIL_FRAMES);
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
