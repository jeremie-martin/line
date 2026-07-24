import { getRiderMetered, sledPoseDegFromRider } from "../../lib/detector.ts";
import {
  axisCost,
  countOffBeatLandings,
  detectWindow,
} from "../core/candidate.ts";
import {
  captureBallisticLaunchObservation,
} from "../core/ballistic_launch.ts";
import {
  airFractionWithTerminalOccupancy,
  projectBallisticGap,
  type BallisticGapProjection,
} from "../core/ballistic_projection.ts";
import {
  measureGapAxes,
  summarizeBallisticAxisPrefix,
} from "../core/measure.ts";
import {
  airborneAt,
  contactLineIdsAt,
  engineLineFromTrackLine,
  isAuthoredContactEvent,
  positionAt,
} from "../core/substrate.ts";
import {
  ballisticTraceEnabled,
  captureBallisticTraceObservation,
  recordBallisticTraceCandidate,
} from "../core/ballistic_trace.ts";
import {
  confirmedArcExitFrame,
  growShortHorizon,
} from "../core/exit_read.ts";
import {
  IMPACT_WINDOW,
  netDyToElevation,
  type Gap,
  type TrackLine,
} from "../types.ts";
import {
  addFinite,
  applyArcKnobs,
  arcResponseOutputs,
  normalizeAngleDeg,
  stateOutputs,
  type ArcKnobs,
  type JointArcProbeRow,
  type RiderArrivalState,
} from "./arc_model.ts";
import {
  applyArcActuatorPair,
  applyArcKnobSequence,
  type ArcActuatorContext,
  type ArcActuatorPairId,
  type ArcKnobSequence,
  type ArcKnobValues,
} from "./arc_actuator.ts";

const FULL_PROBE_SURVIVAL_MARGIN_FRAMES = 16;
const PROBE_SETTLE_MARGIN_FRAMES = 20;
const NEXT_CONTACT_READ_SLACK_FRAMES = 2;
const SHORT_AXIS_HORIZON_MARGIN_FRAMES = Math.max(
  PROBE_SETTLE_MARGIN_FRAMES,
  IMPACT_WINDOW + NEXT_CONTACT_READ_SLACK_FRAMES,
);

export type JointArcProbeGate = {
  currentOk: boolean;
  survivedCurrent: boolean;
  landingOk: boolean;
  offBeatLandings: number;
  nextStateOk: boolean;
  terminusFrame: number;
  terminusReason: string;
};

export type JointArcProbeMode = "short" | "full";

export type JointArcProbeObservation = JointArcProbeRow & {
  gate: JointArcProbeGate;
  mode: JointArcProbeMode;
  /** Last simulated frame used by this observation. In short mode this is the
   *  stop frame chosen by the exit detector, not the former full next-gap horizon. */
  horizonFrame: number;
  /** The confirmed geometric arc exit at/after the current catch. This is the
   *  ballistic launch anchor; short-mode completion starts from this frame. */
  suffixFrame: number | null;
  /** True for every emitted suffix; null when no confirmed exit was observed. */
  cleanAirborneSuffix: boolean | null;
};

export type JointArcProbeOptions = {
  mode?: JointArcProbeMode;
  includeTruth?: boolean;
  /** Request the conditional elevation readiness output from both probe modes. */
  includeElevation?: boolean;
  /** Whether the projected scorer interval ends at an authored contact. */
  targetEndsWithContact?: boolean;
};

export type JointArcProbeResult = JointArcProbeObservation & {
  lines: TrackLine[];
  truth?: JointArcProbeObservation;
};

export function evaluateJointArcKnobs(
  // deno-lint-ignore no-explicit-any
  engine: any,
  baseLines: TrackLine[],
  knobs: ArcKnobs,
  gap: Gap,
  contactFrames: readonly number[],
  axisMeasureEnd: number,
  nextFrame: number,
  options: JointArcProbeOptions = {},
): JointArcProbeResult {
  const lines = applyArcKnobs(baseLines, knobs);
  return evaluateJointArcLines(engine, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame, options);
}

/**
 * Evaluate a declared physical two-control policy on the same response-model
 * coordinates as the incumbent joint probe.  This is deliberately a thin
 * adapter: pair choice changes proposed lines only; probe horizon, gate,
 * output measurements, and exact evaluation remain shared.
 */
export function evaluateArcActuatorPair(
  // deno-lint-ignore no-explicit-any
  engine: any,
  baseLines: TrackLine[],
  pair: ArcActuatorPairId,
  knobs: ArcKnobs,
  gap: Gap,
  contactFrames: readonly number[],
  axisMeasureEnd: number,
  nextFrame: number,
  options: JointArcProbeOptions = {},
  context?: ArcActuatorContext,
): JointArcProbeResult {
  const lines = applyArcActuatorPair(baseLines, pair, knobs, context);
  return evaluateJointArcLines(engine, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame, options);
}

/** Evaluate an ordered physical-control sequence through the canonical probe. */
export function evaluateArcKnobSequence(
  // deno-lint-ignore no-explicit-any
  engine: any,
  baseLines: TrackLine[],
  sequence: ArcKnobSequence,
  values: ArcKnobValues,
  knobs: ArcKnobs,
  gap: Gap,
  contactFrames: readonly number[],
  axisMeasureEnd: number,
  nextFrame: number,
  options: JointArcProbeOptions = {},
  context?: ArcActuatorContext,
): JointArcProbeResult {
  const lines = applyArcKnobSequence(baseLines, sequence, values, context);
  return evaluateJointArcLines(engine, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame, options);
}

export function evaluateJointArcLines(
  // deno-lint-ignore no-explicit-any
  engine: any,
  lines: TrackLine[],
  knobs: ArcKnobs,
  gap: Gap,
  contactFrames: readonly number[],
  axisMeasureEnd: number,
  nextFrame: number,
  options: JointArcProbeOptions = {},
): JointArcProbeResult {
  const fork = engine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
  const mode = options.mode ?? "short";
  const observed = mode === "full"
    ? observeFullJointArcLines(
      fork, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame,
      options.includeElevation === true,
      options.targetEndsWithContact !== false,
    )
    : observeShortJointArcLines(
      fork, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame,
      options.includeElevation === true,
      options.targetEndsWithContact !== false,
    );
  const truth = options.includeTruth && mode !== "full"
    ? observeFullJointArcLines(
      fork, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame,
      options.includeElevation === true,
      options.targetEndsWithContact !== false,
    )
    : undefined;
  return { ...observed, lines, ...(truth === undefined ? {} : { truth }) };
}

function observeShortJointArcLines(
  // deno-lint-ignore no-explicit-any
  fork: any,
  lines: TrackLine[],
  knobs: ArcKnobs,
  gap: Gap,
  contactFrames: readonly number[],
  axisMeasureEnd: number,
  nextFrame: number,
  includeElevation: boolean,
  targetEndsWithContact: boolean,
): JointArcProbeObservation {
  const horizon = shortProbeHorizon(fork, lines, gap, nextFrame);
  const det = detectWindow(fork, gap.startFrame, horizon);

  const minSurvival = Math.min(horizon, axisMeasureEnd);
  const survivedCurrent = det.terminus.frame >= minSurvival || det.terminus.reason === "endOfSpec";
  const landingOk = landingOnOwnedArc(det, lines, gap);
  const offBeatEnd = Math.min(axisMeasureEnd, horizon);
  const offBeatLandings = countOffBeatLandings(det.events, gap.startFrame, offBeatEnd, [...contactFrames]);
  const currentOk = survivedCurrent && landingOk && offBeatLandings === 0;
  const suffixFrame = confirmedArcExitFrameAtOrAfter(
    det,
    lines,
    gap.endFrame,
    horizon,
  );
  const launch = suffixFrame === null
    ? null
    : captureBallisticLaunchObservation(fork, det, {
      gapStartFrame: gap.endFrame,
      anchorFrame: suffixFrame,
      targetFrameExclusive: nextFrame,
      groundedFrames: 0,
    });
  const suffixState = launch?.state ?? null;
  const projectionFrame = launch?.anchorFrame ?? null;
  const cleanAirborneSuffix = suffixFrame === null ? null : true;
  const nextProjection = launch === null
    ? null
    : projectBallisticGap(launch, nextFrame, { includeElevation });
  const nextStateOk = nextProjection !== null;
  if (ballisticTraceEnabled() && launch !== null && launch.anchorFrame < nextFrame) {
    recordBallisticTraceCandidate({
      population: "aim_probe",
      gapIndex: gap.index,
      anchorFrame: launch.anchorFrame,
      targetFrame: nextFrame,
      capture: () => captureBallisticTraceObservation({
        population: "aim_probe",
        gapIndex: gap.index,
        anchorFrame: launch.anchorFrame,
        targetFrame: nextFrame,
        // Benchmark-only truth reads are intentionally raw/unmetered: this fork
        // is discarded after the probe, so neither search state nor budget moves.
        readRider: (frame) => fork.getRider(frame),
        readUpdates: (frame) => fork.getUpdatesAtFrame?.(frame),
      }),
    });
  }

  const outputs: Record<string, number> = {};
  if (projectionFrame !== null && suffixState !== null) {
    if (nextProjection !== null) {
      addProjectionOutputs(
        outputs,
        nextProjection,
        targetEndsWithContact,
      );
    }
  }
  if (currentOk) {
    // Current quality is always the exact scorer interval. The ballistic
    // projection above belongs exclusively to next-gap readiness.
    const achieved = measureGapAxes(det, gap, lines, gap.endFrame);
    Object.assign(
      outputs,
      arcResponseOutputs(
        gap.targets,
        achieved,
        axisCost(gap.targets, achieved),
        null,
      ),
    );
    if (suffixState !== null) {
      addFinite(outputs, "current.releaseSpeedPx", suffixState.speed);
      addFinite(outputs, "current.releaseVy", suffixState.vy);
    }
  }

  return {
    knobs,
    outputs,
    mode: "short",
    horizonFrame: horizon,
    suffixFrame,
    cleanAirborneSuffix,
    gate: {
      currentOk,
      survivedCurrent,
      landingOk,
      offBeatLandings,
      nextStateOk,
      terminusFrame: det.terminus.frame,
      terminusReason: det.terminus.reason,
    },
  };
}

function observeFullJointArcLines(
  // deno-lint-ignore no-explicit-any
  fork: any,
  lines: TrackLine[],
  knobs: ArcKnobs,
  gap: Gap,
  contactFrames: readonly number[],
  axisMeasureEnd: number,
  nextFrame: number,
  includeElevation: boolean,
  targetEndsWithContact: boolean,
): JointArcProbeObservation {
  const horizon = fullProbeHorizon(gap, axisMeasureEnd, nextFrame);
  const det = detectWindow(fork, gap.startFrame, horizon);

  const minSurvival = Math.max(gap.endFrame + FULL_PROBE_SURVIVAL_MARGIN_FRAMES, axisMeasureEnd);
  const survivedCurrent = det.terminus.frame >= minSurvival || det.terminus.reason === "endOfSpec";
  const landingOk = landingOnOwnedArc(det, lines, gap);
  const offBeatLandings = countOffBeatLandings(det.events, gap.startFrame, axisMeasureEnd, [...contactFrames]);
  const currentOk = survivedCurrent && landingOk && offBeatLandings === 0;
  const nextStateOk = det.terminus.frame >= nextFrame || det.terminus.reason === "endOfSpec";

  const outputs: Record<string, number> = {};
  if (currentOk) {
    const achieved = measureGapAxes(det, gap, lines, gap.endFrame);
    Object.assign(outputs, arcResponseOutputs(gap.targets, achieved, axisCost(gap.targets, achieved), null));
  }

  if (nextStateOk) {
    const state = readArrivalState(fork, nextFrame);
    if (state !== null) Object.assign(outputs, stateOutputs(state));
    const nextSummary = summarizeBallisticAxisPrefix(
      det,
      { startFrame: gap.endFrame },
      nextFrame,
    );
    if (nextSummary !== null) {
      const nextFrames = nextFrame - gap.endFrame + 1;
      if (nextSummary.speedFrames > 0) {
        addFinite(
          outputs,
          "next.meanSpeedPx",
          nextSummary.speedSumPx / nextSummary.speedFrames,
        );
      }
      if (nextFrames > 0) {
        // The full probe has not constructed the next catch. Readiness is
        // conditional on that authored contact succeeding, so its terminal
        // frame is grounded while its detector velocity remains the incoming
        // velocity used above.
        const terminalAir =
          targetEndsWithContact &&
            airborneAt(det, nextFrame) === true
            ? 1
            : 0;
        addFinite(
          outputs,
          "next.airFraction",
          Math.max(0, nextSummary.airFrames - terminalAir) / nextFrames,
        );
        addFinite(outputs, "next.frameCount", nextFrames);
      }
      if (includeElevation && nextFrame > gap.endFrame) {
        addFinite(
          outputs,
          "next.elevation",
          netDyToElevation(
            nextSummary.dy,
            nextSummary.v0SpeedPx,
            nextFrame - gap.endFrame,
          ),
        );
      }
    }
  }

  return {
    knobs,
    outputs,
    mode: "full",
    horizonFrame: horizon,
    suffixFrame: null,
    cleanAirborneSuffix: null,
    gate: {
      currentOk,
      survivedCurrent,
      landingOk,
      offBeatLandings,
      nextStateOk,
      terminusFrame: det.terminus.frame,
      terminusReason: det.terminus.reason,
    },
  };
}

function landingOnOwnedArc(det: ReturnType<typeof detectWindow>, lines: readonly TrackLine[], gap: Gap): boolean {
  const owned = new Set(lines.map((line) => line.id));
  return det.events.some((e) =>
    isAuthoredContactEvent(e, gap.endFrame - gap.startFrame) &&
    Math.abs(e.frame - gap.endFrame) <= 1 &&
    contactLineIdsAt(det, e.frame).some((id) => owned.has(id))
  );
}

function fullProbeHorizon(gap: Gap, axisMeasureEnd: number, nextFrame: number): number {
  return Math.max(
    gap.endFrame + PROBE_SETTLE_MARGIN_FRAMES,
    axisMeasureEnd + PROBE_SETTLE_MARGIN_FRAMES,
    nextFrame + NEXT_CONTACT_READ_SLACK_FRAMES,
  );
}

// deno-lint-ignore no-explicit-any
function shortProbeHorizon(engine: any, lines: TrackLine[], gap: Gap, nextFrame: number): number {
  const minExit = gap.endFrame;
  const axisSafeCap = gap.endFrame + SHORT_AXIS_HORIZON_MARGIN_FRAMES;
  const cap = Math.max(axisSafeCap, nextFrame + NEXT_CONTACT_READ_SLACK_FRAMES);
  return growShortHorizon(minExit, cap, (horizon) => {
    const det = detectWindow(engine, gap.startFrame, horizon);
    return {
      terminatedEarly: det.terminus.frame < horizon && det.terminus.reason !== "endOfSpec",
      exitFound: confirmedArcExitFrameAtOrAfter(
        det,
        lines,
        minExit,
        horizon,
      ) !== null,
    };
  });
}

function addProjectionOutputs(
  outputs: Record<string, number>,
  projection: BallisticGapProjection,
  targetEndsWithContact: boolean,
): void {
  Object.assign(outputs, stateOutputs(projection.boundary.projectedContact));
  addFinite(outputs, "next.meanSpeedPx", projection.meanSpeedPx);
  addFinite(
    outputs,
    "next.airFraction",
    airFractionWithTerminalOccupancy(
      projection,
      !targetEndsWithContact,
    ),
  );
  addFinite(outputs, "next.frameCount", projection.frameCount);
  addFinite(outputs, "next.elevation", projection.elevation);
}

function confirmedArcExitFrameAtOrAfter(
  det: ReturnType<typeof detectWindow>,
  lines: readonly TrackLine[],
  startFrame: number,
  endFrame: number,
): number | null {
  // Delegates to the shared geometric-exit definition. Position and airborne
  // occupancy both come from the existing causal detection window. The
  // canonical launch capture performs the only rider reconstruction.
  //
  // This probe grows its window without the candidate evaluator's survival
  // floor, and still returns the same exit frame for the same lines: the exit
  // is the first frame confirmable in the window, so a longer window cannot
  // move it.
  return confirmedArcExitFrame(
    lines,
    startFrame,
    endFrame,
    (frame) => airborneAt(det, frame),
    (frame) => positionAt(det, frame),
  );
}

// deno-lint-ignore no-explicit-any
export function readArrivalState(engine: any, frame: number): RiderArrivalState | null {
  const rider = getRiderMetered(engine, frame);
  return arrivalStateFromRider(engine, rider, frame);
}

// deno-lint-ignore no-explicit-any
function arrivalStateFromRider(engine: any, rider: any, frame: number): RiderArrivalState | null {
  if (!riderUsable(rider)) return null;
  const pos = rider.position ?? { x: NaN, y: NaN };
  const v = rider.velocity ?? { x: NaN, y: NaN };
  if (!Number.isFinite(pos.x) || !Number.isFinite(pos.y) || !Number.isFinite(v.x) || !Number.isFinite(v.y)) {
    return null;
  }
  const speed = Math.hypot(v.x, v.y);
  const pose = sledPoseDegFromRider(rider);
  let poseRate: number | null = null;
  if (frame > 0 && pose !== null) {
    const prevPose = sledPoseDegFromRider(getRiderMetered(engine, frame - 1));
    if (prevPose !== null) poseRate = normalizeAngleDeg(pose - prevPose);
  }
  return {
    x: pos.x,
    y: pos.y,
    vx: v.x,
    vy: v.y,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(v.y, v.x) * 180 / Math.PI : null,
    sledPoseDeg: pose,
    sledPoseRateDegPerFrame: poseRate,
  };
}

// deno-lint-ignore no-explicit-any
function riderUsable(rider: any): boolean {
  try {
    if (rider.get?.("SLED_INTACT")?.isBinded?.() === false) return false;
    if (rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false) return false;
  } catch {
    // Treat unreadable flags as usable; this matches the existing probes.
  }
  return true;
}
