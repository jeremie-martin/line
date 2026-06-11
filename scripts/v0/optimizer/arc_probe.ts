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
import { ELEVATION, IMPACT_WINDOW, type Gap, type TrackLine } from "../types.ts";
import {
  applyArcKnobs,
  arcResponseOutputs,
  normalizeAngleDeg,
  stateOutputs,
  type ArcKnobs,
  type JointArcProbeRow,
  type RiderArrivalState,
} from "./arc_model.ts";

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
  const observed = observeJointArcLines(fork, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame, mode);
  const truth = options.includeTruth && mode !== "full"
    ? observeJointArcLines(fork, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame, "full")
    : undefined;
  return { ...observed, lines, ...(truth === undefined ? {} : { truth }) };
}

function observeJointArcLines(
  // deno-lint-ignore no-explicit-any
  fork: any,
  lines: TrackLine[],
  knobs: ArcKnobs,
  gap: Gap,
  contactFrames: readonly number[],
  axisMeasureEnd: number,
  nextFrame: number,
  mode: JointArcProbeMode,
): JointArcProbeObservation {
  const horizon = mode === "full"
    ? fullProbeHorizon(gap, axisMeasureEnd, nextFrame)
    : shortProbeHorizon(fork, lines, gap, nextFrame);
  const det = detectWindow(fork, gap.startFrame, horizon);

  const minSurvival = mode === "full"
    ? Math.max(gap.endFrame + 16, axisMeasureEnd)
    : Math.min(horizon, axisMeasureEnd);
  const survivedCurrent = det.terminus.frame >= minSurvival || det.terminus.reason === "endOfSpec";
  const owned = new Set(lines.map((line) => line.id));
  const landingOk = det.events.some((e) =>
    e.type === "landing" &&
    Math.abs(e.frame - gap.endFrame) <= 1 &&
    contactLineIdsAt(det, e.frame).some((id) => owned.has(id))
  );
  const offBeatEnd = mode === "full" ? axisMeasureEnd : Math.min(axisMeasureEnd, horizon);
  const offBeatLandings = countOffBeatLandings(det.events, gap.startFrame, offBeatEnd, [...contactFrames]);
  const currentOk = survivedCurrent && landingOk && offBeatLandings === 0;
  const suffixFrame = mode === "full"
    ? null
    : firstAirborneExitFrameAtOrAfter(fork, det, lines, gap.endFrame, horizon);
  const suffixRead = suffixFrame === null ? null : readLaunchState(fork, det, suffixFrame, horizon);
  const suffixState = suffixRead?.state ?? null;
  const cleanAirborneSuffix = suffixFrame === null ? null : cleanAirborneRange(det, suffixFrame, horizon);
  const nextStateOk = mode === "full"
    ? det.terminus.frame >= nextFrame || det.terminus.reason === "endOfSpec"
    : suffixState !== null && suffixFrame !== null && suffixFrame <= nextFrame;

  const outputs: Record<string, number> = {};
  const latentOutputs: Record<string, number> = {};
  if (mode === "short" && suffixFrame !== null && suffixState !== null) {
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
    const suffix = mode === "full" || suffixState === null || suffixFrame === null
      ? null
      : ballisticAxisSuffix(suffixFrame, suffixState);
    const achieved = mode === "full"
      ? measureGapAxes(det, gap, lines, axisMeasureEnd)
      : measureGapAxesWithBallisticSuffix(det, gap, lines, axisMeasureEnd, suffix);
    Object.assign(outputs, arcResponseOutputs(gap.targets, achieved, axisCost(gap.targets, achieved), null));
    if (suffixState !== null) {
      addFinite(outputs, "current.releaseSpeedPx", suffixState.speed);
      addFinite(outputs, "current.releaseVy", suffixState.vy);
    }
  }

  if (nextStateOk && mode === "full") {
    const state = readArrivalState(fork, nextFrame);
    if (state !== null) Object.assign(outputs, stateOutputs(state));
  }

  return {
    knobs,
    outputs,
    ...(Object.keys(latentOutputs).length === 0 ? {} : { latentOutputs }),
    mode,
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

function fullProbeHorizon(gap: Gap, axisMeasureEnd: number, nextFrame: number): number {
  return Math.max(gap.endFrame + 20, axisMeasureEnd + 20, nextFrame + 2);
}

// deno-lint-ignore no-explicit-any
function shortProbeHorizon(engine: any, lines: TrackLine[], gap: Gap, nextFrame: number): number {
  const minExit = gap.endFrame;
  const axisSafeCap = gap.endFrame + Math.max(20, IMPACT_WINDOW + 2);
  const cap = Math.max(axisSafeCap, nextFrame + 2);
  for (let horizon = minExit; horizon < cap; horizon = Math.min(cap, horizon + 4)) {
    const det = detectWindow(engine, gap.startFrame, horizon);
    if (det.terminus.frame < horizon && det.terminus.reason !== "endOfSpec") return horizon;
    if (firstAirborneExitFrameAtOrAfter(engine, det, lines, minExit, horizon) !== null) return horizon;
  }
  return cap;
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
  const exit = arcExitPlane(lines);
  for (let frame = startFrame; frame <= endFrame; frame++) {
    if (airborneAt(det, frame) === true && riderPastArcExit(engine, frame, exit)) return frame;
  }
  return null;
}

type ArcExitPlane = {
  end: { x: number; y: number };
  dir: { x: number; y: number };
};

function arcExitPlane(lines: readonly TrackLine[]): ArcExitPlane | null {
  if (lines.length === 0) return null;
  const first = lines[0];
  const last = lines[lines.length - 1];
  const start = { x: first.x1, y: first.y1 };
  const end = { x: last.x2, y: last.y2 };
  const chord = normalizeVec(end.x - start.x, end.y - start.y);
  if (chord !== null) return { end, dir: chord };
  const tail = normalizeVec(last.x2 - last.x1, last.y2 - last.y1);
  return tail === null ? null : { end, dir: tail };
}

function riderPastArcExit(
  // deno-lint-ignore no-explicit-any
  engine: any,
  frame: number,
  exit: ArcExitPlane | null,
): boolean {
  if (exit === null) return true;
  const rider = getRiderMetered(engine, frame);
  const pos = rider?.position;
  if (pos === undefined || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
  const along = (pos.x - exit.end.x) * exit.dir.x + (pos.y - exit.end.y) * exit.dir.y;
  return along > 0;
}

function normalizeVec(x: number, y: number): { x: number; y: number } | null {
  const length = Math.hypot(x, y);
  return length <= 1e-9 ? null : { x: x / length, y: y / length };
}

function cleanAirborneRange(det: ReturnType<typeof detectWindow>, startFrame: number, endFrame: number): boolean {
  for (let frame = startFrame; frame <= endFrame; frame++) {
    if (airborneAt(det, frame) !== true) return false;
  }
  return true;
}

/** Frames averaged by the gravity-corrected launch-velocity estimator. */
const LAUNCH_READ_FRAMES = 4;

/** Constant correction to the launch vy read (px/f). The velocity readout
 *  at the first airborne frames after a catch UNDERESTIMATES vy by a
 *  roughly constant amount (post-impact transient of the constrained body):
 *  signed prediction error vs full-sim truth is flat across dt buckets, so
 *  this is a read offset, not an acceleration. Fitted on 22.7k probe rows
 *  across 6 golden specs (smoothed read: +0.0345; raw read: +0.0265) and
 *  validated out-of-sample — see the calibration note in
 *  docs/ARC_AIMING_FORMALIZATION.md and study_latent_decomposition.ts. */
const LAUNCH_VY_OFFSET_PX = 0.0345;

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
  let sx = base.vx;
  let sy = base.vy;
  let n = 1;
  for (let k = 1; k < LAUNCH_READ_FRAMES; k++) {
    const f = frame + k;
    if (f > horizon || airborneAt(det, f) !== true) break;
    const rider = getRiderMetered(engine, f);
    const v = rider?.velocity;
    if (v === undefined || !Number.isFinite(v.x) || !Number.isFinite(v.y)) break;
    sx += v.x;
    sy += v.y - g * k;
    n++;
  }
  const vx = sx / n;
  const vy = sy / n + LAUNCH_VY_OFFSET_PX;
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

function addFinite(outputs: Record<string, number>, key: string, value: number | null | undefined): void {
  if (value !== null && value !== undefined && Number.isFinite(value)) outputs[key] = value;
}
