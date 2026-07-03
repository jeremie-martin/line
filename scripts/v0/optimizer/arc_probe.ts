import { getRiderMetered, sledPoseDegFromRider } from "../../lib/detector.ts";
import {
  axisCost,
  countOffBeatLandings,
  detectWindow,
} from "../core/candidate.ts";
import {
  measureGapAxes,
  measureGapAxesWithBallisticSuffix,
  summarizeBallisticAxisPrefix,
  type BallisticAxisSuffix,
} from "../core/measure.ts";
import {
  airborneAt,
  contactLineIdsAt,
  engineLineFromTrackLine,
} from "../core/substrate.ts";
import { gravityCorrectedLaunchAverage } from "../core/launch_read.ts";
import { firstAirborneExitFrame, growShortHorizon } from "../core/exit_read.ts";
import { ELEVATION, IMPACT_WINDOW, type Gap, type TrackLine } from "../types.ts";
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
  /** First airborne frame at/after the current catch exit margin where the rider
   *  has also crossed the arc-end plane in the arc's travel direction.
   *  Short-mode ballistic completion starts from this frame. */
  suffixFrame: number | null;
  /** True iff every observed frame from suffixFrame through horizonFrame is
   *  airborne. False means the row found an airborne frame but observed later
   *  contact inside the same short-probe chunk; the row is still emitted, and
   *  harness diagnostics report clean-only vs all-row error separately. */
  cleanAirborneSuffix: boolean | null;
  /** Number of airborne velocity reads averaged into the launch/exit state. */
  launchReadFrames: number | null;
};

export type JointArcProbeOptions = {
  mode?: JointArcProbeMode;
  includeTruth?: boolean;
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
    ? observeFullJointArcLines(fork, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame)
    : observeShortJointArcLines(fork, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame);
  const truth = options.includeTruth && mode !== "full"
    ? observeFullJointArcLines(fork, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame)
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
): JointArcProbeObservation {
  const horizon = shortProbeHorizon(fork, lines, gap, nextFrame);
  const det = detectWindow(fork, gap.startFrame, horizon);

  const minSurvival = Math.min(horizon, axisMeasureEnd);
  const survivedCurrent = det.terminus.frame >= minSurvival || det.terminus.reason === "endOfSpec";
  const landingOk = landingOnOwnedArc(det, lines, gap);
  const offBeatEnd = Math.min(axisMeasureEnd, horizon);
  const offBeatLandings = countOffBeatLandings(det.events, gap.startFrame, offBeatEnd, [...contactFrames]);
  const currentOk = survivedCurrent && landingOk && offBeatLandings === 0;
  const suffixFrame = firstAirborneExitFrameAtOrAfter(fork, det, lines, gap.endFrame, horizon);
  const suffixRead = suffixFrame === null ? null : readLaunchState(fork, det, suffixFrame, horizon);
  const suffixState = suffixRead?.state ?? null;
  const cleanAirborneSuffix = suffixFrame === null ? null : cleanAirborneRange(det, suffixFrame, horizon);
  const nextStateOk = suffixState !== null && suffixFrame !== null && suffixFrame <= nextFrame;

  const outputs: Record<string, number> = {};
  const latentOutputs: Record<string, number> = {};
  if (suffixFrame !== null && suffixState !== null) {
    addLatentSuffixOutputs(latentOutputs, suffixFrame, suffixState);
    const summary = summarizeBallisticAxisPrefix(det, gap, Math.min(suffixFrame, axisMeasureEnd));
    if (summary !== null) {
      const prefixFrames = Math.max(0, summary.prefixEndFrame - summary.startFrame + 1);
      addFinite(latentOutputs, "latent.prefix.airFrames", summary.airFrames);
      if (prefixFrames > 0) addFinite(latentOutputs, "latent.prefix.airFraction", summary.airFrames / prefixFrames);
      addFinite(latentOutputs, "latent.prefix.speedSumPx", summary.speedSumPx);
      addFinite(latentOutputs, "latent.prefix.speedFrames", summary.speedFrames);
      if (summary.speedFrames > 0) {
        addFinite(latentOutputs, "latent.prefix.speedMeanPx", summary.speedSumPx / summary.speedFrames);
      }
      addFinite(latentOutputs, "latent.prefix.dy", summary.dy);
      addFinite(latentOutputs, "latent.prefix.v0SpeedPx", summary.v0SpeedPx);
    }
  }
  if (currentOk) {
    const suffix = suffixState === null || suffixFrame === null ? null : ballisticAxisSuffix(suffixFrame, suffixState);
    const achieved = measureGapAxesWithBallisticSuffix(det, gap, lines, axisMeasureEnd, suffix);
    Object.assign(outputs, arcResponseOutputs(gap.targets, achieved, axisCost(gap.targets, achieved), null));
    if (suffixState !== null) {
      addFinite(outputs, "current.releaseSpeedPx", suffixState.speed);
      addFinite(outputs, "current.releaseVy", suffixState.vy);
    }
  }

  return {
    knobs,
    outputs,
    ...(Object.keys(latentOutputs).length === 0 ? {} : { latentOutputs }),
    mode: "short",
    horizonFrame: horizon,
    suffixFrame,
    cleanAirborneSuffix,
    launchReadFrames: suffixRead?.readFrames ?? null,
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
    const achieved = measureGapAxes(det, gap, lines, axisMeasureEnd);
    Object.assign(outputs, arcResponseOutputs(gap.targets, achieved, axisCost(gap.targets, achieved), null));
  }

  if (nextStateOk) {
    const state = readArrivalState(fork, nextFrame);
    if (state !== null) Object.assign(outputs, stateOutputs(state));
  }

  return {
    knobs,
    outputs,
    mode: "full",
    horizonFrame: horizon,
    suffixFrame: null,
    cleanAirborneSuffix: null,
    launchReadFrames: null,
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
    e.type === "landing" &&
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
      exitFound: firstAirborneExitFrameAtOrAfter(engine, det, lines, minExit, horizon) !== null,
    };
  });
}

function ballisticAxisSuffix(frame: number, state: RiderArrivalState): BallisticAxisSuffix {
  return { frame, vx: state.vx, vy: state.vy };
}

function addLatentSuffixOutputs(outputs: Record<string, number>, frame: number, state: RiderArrivalState): void {
  addFinite(outputs, "latent.suffix.frame", frame);
  addFinite(outputs, "latent.suffix.x", state.x);
  addFinite(outputs, "latent.suffix.y", state.y);
  addFinite(outputs, "latent.suffix.vx", state.vx);
  addFinite(outputs, "latent.suffix.vy", state.vy);
  addFinite(outputs, "latent.suffix.sledPoseDeg", state.sledPoseDeg);
  addFinite(outputs, "latent.suffix.sledPoseRateDegPerFrame", state.sledPoseRateDegPerFrame);
}

function firstAirborneExitFrameAtOrAfter(
  // deno-lint-ignore no-explicit-any
  engine: any,
  det: ReturnType<typeof detectWindow>,
  lines: readonly TrackLine[],
  startFrame: number,
  endFrame: number,
): number | null {
  // Delegates to the shared geometric exit detector (core/exit_read.ts). The
  // engine call site reads the rider POSITION from the metered engine; airborne
  // from the detection. Position is only read when airborne === true (the
  // shared scanner short-circuits exactly as the former inlined loop did).
  return firstAirborneExitFrame(
    lines,
    startFrame,
    endFrame,
    (frame) => airborneAt(det, frame),
    (frame) => getRiderMetered(engine, frame)?.position,
  );
}

function cleanAirborneRange(det: ReturnType<typeof detectWindow>, startFrame: number, endFrame: number): boolean {
  for (let frame = startFrame; frame <= endFrame; frame++) {
    if (airborneAt(det, frame) !== true) return false;
  }
  return true;
}

/** The short probe's launch state: `readArrivalState` at the suffix frame,
 *  with the velocity replaced by a gravity-corrected average of up to
 *  LAUNCH_READ_FRAMES consecutive airborne velocity reads. The single-frame
 *  velocity readout oscillates with internal constraint dynamics (rms ~0.02
 *  px/f per frame increment in free flight — study_exit_readout.ts), and the
 *  ballistic completion amplifies that launch error over dt frames; averaging
 *  engine states (each compensated by g·k) removes most of it. The averaged
 *  frames are already simulated on the fork (≤ horizon), so this charges no
 *  extra physics frames. Falls back to the plain single read when later
 *  frames are not airborne or unreadable. */
// deno-lint-ignore no-explicit-any
function readLaunchState(
  engine: any,
  det: ReturnType<typeof detectWindow>,
  frame: number,
  horizon: number,
): { state: RiderArrivalState; readFrames: number } | null {
  const base = readArrivalState(engine, frame);
  if (base === null) return base;
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  const { vx, vy, n } = gravityCorrectedLaunchAverage(
    { x: base.vx, y: base.vy },
    g,
    (k) => {
      const f = frame + k;
      return f <= horizon && airborneAt(det, f) === true;
    },
    (k) => getRiderMetered(engine, frame + k)?.velocity,
  );
  const speed = Math.hypot(vx, vy);
  return {
    state: {
      ...base,
      vx,
      vy,
      speed,
      comAngleDeg: speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null,
    },
    readFrames: n,
  };
}

// deno-lint-ignore no-explicit-any
export function readArrivalState(engine: any, frame: number): RiderArrivalState | null {
  const rider = getRiderMetered(engine, frame);
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
