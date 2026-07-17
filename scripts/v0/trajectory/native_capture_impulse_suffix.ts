/**
 * Native-capture impulse-latched suffix transport.
 *
 * The raw candidate owns the target collision. Once that collision has been
 * resolved, the exact change in aggregate zero-friction sled velocity defines
 * a unique physical displacement field for the already-existing suffix. This
 * module is deliberately free of optimizer or scoring policy.
 */
import type { TrackLine } from "../types.ts";

const EPSILON = 1e-9;

export type NativeCaptureImpulseSuffixState = {
  preVelocity: { x: number; y: number };
  postVelocity: { x: number; y: number };
};

export type NativeCaptureImpulseSuffixUnavailable = {
  status: "unavailable";
  reason: "no_target_contact_line" | "no_downstream_suffix" | "invalid_velocity";
};

export type NativeCaptureImpulseSuffixReady = {
  status: "ready";
  lines: TrackLine[];
  lastTargetContactIndex: number;
  transportedSuffixStartIndex: number;
  impulse: { x: number; y: number };
  postSpeed: number;
  rawSuffixLengthPx: number;
  terminalDisplacement: { x: number; y: number };
};

export type NativeCaptureImpulseSuffix =
  | NativeCaptureImpulseSuffixUnavailable
  | NativeCaptureImpulseSuffixReady;

/**
 * Preserve every line through the last raw target-contact line. The remaining
 * line endpoints are shifted by integral(Δv dt), where raw arclength divided
 * by exact post-capture aggregate speed supplies the physical time coordinate.
 */
export function realizeNativeCaptureImpulseSuffix(
  rawLines: readonly TrackLine[],
  targetContactLineIds: ReadonlySet<number>,
  state: NativeCaptureImpulseSuffixState,
): NativeCaptureImpulseSuffix {
  const lastTargetContactIndex = rawLines.reduce(
    (last, line, index) => targetContactLineIds.has(line.id) ? index : last,
    -1,
  );
  if (lastTargetContactIndex < 0) return { status: "unavailable", reason: "no_target_contact_line" };
  const transportedSuffixStartIndex = lastTargetContactIndex + 1;
  if (transportedSuffixStartIndex >= rawLines.length) {
    return { status: "unavailable", reason: "no_downstream_suffix" };
  }
  const postSpeed = Math.hypot(state.postVelocity.x, state.postVelocity.y);
  if (!finiteVector(state.preVelocity) || !finiteVector(state.postVelocity) || !(postSpeed > EPSILON)) {
    return { status: "unavailable", reason: "invalid_velocity" };
  }
  const impulse = {
    x: state.postVelocity.x - state.preVelocity.x,
    y: state.postVelocity.y - state.preVelocity.y,
  };
  const suffix = rawLines.slice(transportedSuffixStartIndex);
  const rawSuffixLengthPx = suffix.reduce((sum, line) => sum + lineLength(line), 0);
  if (!(rawSuffixLengthPx > EPSILON)) return { status: "unavailable", reason: "no_downstream_suffix" };

  let arclength = 0;
  const lines = rawLines.map((line, index) => {
    if (index < transportedSuffixStartIndex) return { ...line };
    const length = lineLength(line);
    const startShift = displacement(impulse, arclength / postSpeed);
    arclength += length;
    const endShift = displacement(impulse, arclength / postSpeed);
    return {
      ...line,
      x1: line.x1 + startShift.x,
      y1: line.y1 + startShift.y,
      x2: line.x2 + endShift.x,
      y2: line.y2 + endShift.y,
    };
  });
  if (!lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))) {
    throw new Error("native-capture impulse suffix emitted non-finite geometry");
  }
  return {
    status: "ready",
    lines,
    lastTargetContactIndex,
    transportedSuffixStartIndex,
    impulse,
    postSpeed,
    rawSuffixLengthPx,
    terminalDisplacement: displacement(impulse, rawSuffixLengthPx / postSpeed),
  };
}

function displacement(impulse: { x: number; y: number }, seconds: number): { x: number; y: number } {
  return { x: impulse.x * seconds, y: impulse.y * seconds };
}

function lineLength(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}

function finiteVector(value: { x: number; y: number }): boolean {
  return Number.isFinite(value.x) && Number.isFinite(value.y);
}
