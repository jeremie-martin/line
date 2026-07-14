/**
 * Descriptive profile of the exact proposed line(s) involved in a detected
 * owned contact. This module does not generate terrain or infer controls.
 */
import type { TrackLine } from "../types.ts";
import type { TargetFrame } from "./target_frame.ts";

export type OwnedContactLineProfile = {
  id: number;
  lineIndex: number;
  lengthPx: number;
  angleRelativeDeg: number;
  flipped: boolean;
  closestPointToTarget: {
    fraction: number;
    distancePx: number;
    tangentOffsetPx: number;
    normalOffsetPx: number;
  };
  adjacentTurnsDeg: { fromPrevious: number | null; toNext: number | null };
};

export type OwnedContactGeometryProfile = {
  requestedLineIds: number[];
  missingLineIds: number[];
  lines: OwnedContactLineProfile[];
};

/**
 * Describe only line IDs attributed by an exact detector event. The closest
 * point is evaluated continuously along each segment, not approximated by a
 * nearest polyline vertex.
 */
export function profileOwnedContactLines(
  frame: TargetFrame,
  lines: readonly TrackLine[],
  ownedLineIds: readonly number[],
): OwnedContactGeometryProfile {
  const uniqueIds = [...new Set(ownedLineIds)].sort((left, right) => left - right);
  const byId = new Map(lines.map((line, index) => [line.id, { line, index }]));
  const angle = radians(finite("frame.headingDeg", frame.headingDeg));
  const tangent = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -tangent.y, y: tangent.x };
  const missingLineIds: number[] = [];
  const profiles: OwnedContactLineProfile[] = [];
  for (const id of uniqueIds) {
    const found = byId.get(id);
    if (found === undefined) {
      missingLineIds.push(id);
      continue;
    }
    const { line, index } = found;
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const lengthPx = Math.hypot(dx, dy);
    if (!(lengthPx > 0) || !Number.isFinite(lengthPx)) throw new Error(`line ${id} has invalid length`);
    const fraction = clamp(
      ((frame.reference.x - line.x1) * dx + (frame.reference.y - line.y1) * dy) / (lengthPx * lengthPx),
      0,
      1,
    );
    const closest = { x: line.x1 + dx * fraction, y: line.y1 + dy * fraction };
    const delta = { x: closest.x - frame.reference.x, y: closest.y - frame.reference.y };
    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    const previous = lines[index - 1];
    const next = lines[index + 1];
    profiles.push({
      id,
      lineIndex: index,
      lengthPx,
      angleRelativeDeg: normalizeAngleDeg(angleDeg - frame.headingDeg),
      flipped: line.flipped,
      closestPointToTarget: {
        fraction,
        distancePx: Math.hypot(delta.x, delta.y),
        tangentOffsetPx: dot(delta, tangent),
        normalOffsetPx: dot(delta, normal),
      },
      adjacentTurnsDeg: {
        fromPrevious: previous === undefined ? null : normalizeAngleDeg(angleDeg - lineAngleDeg(previous)),
        toNext: next === undefined ? null : normalizeAngleDeg(lineAngleDeg(next) - angleDeg),
      },
    });
  }
  return { requestedLineIds: uniqueIds, missingLineIds, lines: profiles };
}

function lineAngleDeg(line: TrackLine): number {
  return Math.atan2(line.y2 - line.y1, line.x2 - line.x1) * 180 / Math.PI;
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
}

function clamp(value: number, lower: number, upper: number): number {
  return Math.max(lower, Math.min(upper, value));
}

function radians(value: number): number {
  return value * Math.PI / 180;
}

function normalizeAngleDeg(value: number): number {
  let normalized = (value + 180) % 360;
  if (normalized < 0) normalized += 360;
  return normalized - 180;
}

function finite(name: string, value: number): number {
  if (!Number.isFinite(value)) throw new Error(`${name} must be finite`);
  return value;
}
