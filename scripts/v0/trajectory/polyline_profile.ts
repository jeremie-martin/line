/**
 * Descriptive target-frame profile of an already generated connected polyline.
 *
 * This is an observation aid only. It neither reconstructs legacy controls nor
 * produces geometry, so its output cannot become a candidate source by
 * accident.
 */
import type { TrackLine } from "../types.ts";
import type { IncomingTargetFrame } from "./envelope/model.ts";

export type TargetFramePolylineProfile = {
  connected: boolean;
  lineCount: number;
  totalLengthPx: number;
  /** Nearest connected vertex to the frozen target reference; descriptive only. */
  targetJunction: {
    vertexIndex: number;
    distanceToTargetPx: number;
    tangentOffsetPx: number;
    normalOffsetPx: number;
  } | null;
  entry: { lengthPx: number; angleRelativeDeg: number } | null;
  post: Array<{ lengthPx: number; angleRelativeDeg: number }>;
};

export function profilePolylineInTargetFrame(
  frame: IncomingTargetFrame,
  lines: readonly TrackLine[],
): TargetFramePolylineProfile {
  if (lines.length === 0) {
    return { connected: true, lineCount: 0, totalLengthPx: 0, targetJunction: null, entry: null, post: [] };
  }
  finite("frame.headingDeg", frame.headingDeg);
  const angle = radians(frame.headingDeg);
  const tangent = { x: Math.cos(angle), y: Math.sin(angle) };
  const normal = { x: -tangent.y, y: tangent.x };
  const first = lines[0]!;
  let connected = true;
  let totalLengthPx = 0;
  const segment = (line: TrackLine) => {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const lengthPx = Math.hypot(dx, dy);
    totalLengthPx += lengthPx;
    return {
      lengthPx,
      angleRelativeDeg: normalizeAngleDeg(Math.atan2(dy, dx) * 180 / Math.PI - frame.headingDeg),
    };
  };
  const profiles = lines.map(segment);
  const vertices = [
    { x: first.x1, y: first.y1 },
    ...lines.map((line) => ({ x: line.x2, y: line.y2 })),
  ];
  let targetVertexIndex = 0;
  let targetDistanceSq = Number.POSITIVE_INFINITY;
  for (const [index, vertex] of vertices.entries()) {
    const dx = vertex.x - frame.reference.x;
    const dy = vertex.y - frame.reference.y;
    const distanceSq = dx * dx + dy * dy;
    if (distanceSq < targetDistanceSq) {
      targetDistanceSq = distanceSq;
      targetVertexIndex = index;
    }
  }
  const targetVertex = vertices[targetVertexIndex]!;
  const junctionDelta = { x: targetVertex.x - frame.reference.x, y: targetVertex.y - frame.reference.y };
  const entry = targetVertexIndex === 0 ? null : profiles[targetVertexIndex - 1]!;
  const post: Array<{ lengthPx: number; angleRelativeDeg: number }> = [];
  for (let index = 1; index < lines.length; index++) {
    const prior = lines[index - 1]!;
    const line = lines[index]!;
    if (Math.hypot(line.x1 - prior.x2, line.y1 - prior.y2) > 1e-8) connected = false;
  }
  for (let index = targetVertexIndex; index < profiles.length; index++) {
    post.push(profiles[index]!);
  }
  return {
    connected,
    lineCount: lines.length,
    totalLengthPx,
    targetJunction: {
      vertexIndex: targetVertexIndex,
      distanceToTargetPx: Math.sqrt(targetDistanceSq),
      tangentOffsetPx: dot(junctionDelta, tangent),
      normalOffsetPx: dot(junctionDelta, normal),
    },
    entry,
    post,
  };
}

function dot(left: { x: number; y: number }, right: { x: number; y: number }): number {
  return left.x * right.x + left.y * right.y;
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
