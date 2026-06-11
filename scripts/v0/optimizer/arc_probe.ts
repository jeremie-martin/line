import { getRiderMetered, sledPoseDegFromRider } from "../../lib/detector.ts";
import {
  axisCost,
  countOffBeatLandings,
  detectWindow,
  releaseStateFrame,
} from "../core/candidate.ts";
import { measureGapAxes } from "../core/measure.ts";
import {
  contactLineIdsAt,
  engineLineFromTrackLine,
  speedAt,
  velocityAt,
} from "../core/substrate.ts";
import type { Gap, TrackLine } from "../types.ts";
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

export type JointArcProbeResult = JointArcProbeRow & {
  gate: JointArcProbeGate;
  lines: TrackLine[];
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
): JointArcProbeResult {
  const lines = applyArcKnobs(baseLines, knobs);
  return evaluateJointArcLines(engine, lines, knobs, gap, contactFrames, axisMeasureEnd, nextFrame);
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
): JointArcProbeResult {
  const fork = engine.addLine(lines.map((line) => engineLineFromTrackLine(line)));
  const horizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20, nextFrame + 2);
  const det = detectWindow(fork, gap.startFrame, horizon);

  const minSurvival = Math.max(gap.endFrame + 16, axisMeasureEnd);
  const survivedCurrent = det.terminus.frame >= minSurvival || det.terminus.reason === "endOfSpec";
  const owned = new Set(lines.map((line) => line.id));
  const landingOk = det.events.some((e) =>
    e.type === "landing" &&
    Math.abs(e.frame - gap.endFrame) <= 1 &&
    contactLineIdsAt(det, e.frame).some((id) => owned.has(id))
  );
  const offBeatLandings = countOffBeatLandings(det.events, gap.startFrame, axisMeasureEnd, [...contactFrames]);
  const currentOk = survivedCurrent && landingOk && offBeatLandings === 0;
  const nextStateOk = det.terminus.frame >= nextFrame || det.terminus.reason === "endOfSpec";

  const outputs: Record<string, number> = {};
  if (currentOk) {
    const achieved = measureGapAxes(det, gap, lines, axisMeasureEnd);
    Object.assign(outputs, arcResponseOutputs(gap.targets, achieved, axisCost(gap.targets, achieved), null));
    const releaseFrame = releaseStateFrame(gap, [...contactFrames]);
    addFinite(outputs, "current.releaseSpeedPx", speedAt(det, releaseFrame));
    addFinite(outputs, "current.releaseVy", velocityAt(det, releaseFrame)?.y);
  }

  if (nextStateOk) {
    const state = readArrivalState(fork, nextFrame);
    if (state !== null) Object.assign(outputs, stateOutputs(state));
  }

  return {
    knobs,
    outputs,
    lines,
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
