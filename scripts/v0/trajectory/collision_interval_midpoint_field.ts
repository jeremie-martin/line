/**
 * Native collision-interval midpoint configuration field.
 *
 * A raw candidate first supplies its own finite sled-contact interval. The
 * component reads the entering and leaving full sled configurations, realizes
 * their unique affine midpoint, and applies it only inside that interval's
 * physical travel neighborhood. It contains no optimizer policy or scoring.
 */
import type { TrackLine } from "../types.ts";

const EPSILON = 64 * Number.EPSILON;

export type CollisionIntervalSledPoint = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
};

export type CollisionIntervalMidpointState = {
  entering: readonly CollisionIntervalSledPoint[];
  leaving: readonly CollisionIntervalSledPoint[];
  intervalFrames: number;
  contactLineIds: ReadonlySet<number>;
};

export type CollisionIntervalMidpointUnavailable = {
  status: "unavailable";
  reason:
    | "missing_full_sled_state"
    | "invalid_interval"
    | "no_contact_line"
    | "disconnected_curve"
    | "singular_configuration_map"
    | "zero_collective_speed";
};

export type CollisionIntervalMidpointReady = {
  status: "ready";
  lines: TrackLine[];
  intervalFrames: number;
  contactCenterArclengthPx: number;
  supportRadiusPx: number;
  midpointMap: { a: number; b: number; c: number; d: number };
  configurationDisplacementFrobenius: number;
  meanVertexDisplacementPx: number;
  maxVertexDisplacementPx: number;
};

export type CollisionIntervalMidpointField =
  | CollisionIntervalMidpointUnavailable
  | CollisionIntervalMidpointReady;

/**
 * The map is the first-order discrete midpoint of the observed configuration
 * transition: I + (F - I)/2. Its compact C1 spatial weight has no tunable
 * extent: the entering collective travel over exactly the contact interval is
 * the support radius.
 */
export function realizeCollisionIntervalMidpointField(
  rawLines: readonly TrackLine[],
  state: CollisionIntervalMidpointState,
): CollisionIntervalMidpointField {
  if (!validPointCloud(state.entering) || !validPointCloud(state.leaving)) {
    return { status: "unavailable", reason: "missing_full_sled_state" };
  }
  if (!Number.isSafeInteger(state.intervalFrames) || state.intervalFrames <= 0) {
    return { status: "unavailable", reason: "invalid_interval" };
  }
  if (rawLines.length === 0 || !connected(rawLines)) {
    return { status: "unavailable", reason: "disconnected_curve" };
  }
  const contactIndices = rawLines.flatMap((line, index) => state.contactLineIds.has(line.id) ? [index] : []);
  if (contactIndices.length === 0) return { status: "unavailable", reason: "no_contact_line" };

  const enteringCenter = mean(state.entering.map((point) => point.position));
  const leavingCenter = mean(state.leaving.map((point) => point.position));
  const enteringVelocity = mean(state.entering.map((point) => point.velocity));
  const collectiveSpeed = Math.hypot(enteringVelocity.x, enteringVelocity.y);
  if (!(collectiveSpeed > EPSILON)) return { status: "unavailable", reason: "zero_collective_speed" };
  const configurationMap = fitConfigurationMap(state.entering, state.leaving, enteringCenter, leavingCenter);
  if (configurationMap === null) return { status: "unavailable", reason: "singular_configuration_map" };
  const midpointMap = {
    a: (1 + configurationMap.a) / 2,
    b: configurationMap.b / 2,
    c: configurationMap.c / 2,
    d: (1 + configurationMap.d) / 2,
  };
  if (![midpointMap.a, midpointMap.b, midpointMap.c, midpointMap.d].every(Number.isFinite)) {
    return { status: "unavailable", reason: "singular_configuration_map" };
  }

  const lengths = rawLines.map(length);
  const starts: number[] = [];
  let totalLength = 0;
  for (const lineLength of lengths) {
    starts.push(totalLength);
    totalLength += lineLength;
  }
  const contactLength = contactIndices.reduce((sum, index) => sum + lengths[index]!, 0);
  if (!(contactLength > EPSILON)) return { status: "unavailable", reason: "disconnected_curve" };
  const contactCenterArclengthPx = contactIndices.reduce(
    (sum, index) => sum + (starts[index]! + lengths[index]! / 2) * lengths[index]! / contactLength,
    0,
  );
  const supportRadiusPx = collectiveSpeed * state.intervalFrames;
  if (!(supportRadiusPx > EPSILON) || !Number.isFinite(supportRadiusPx)) {
    return { status: "unavailable", reason: "zero_collective_speed" };
  }

  const center = {
    x: (enteringCenter.x + leavingCenter.x) / 2,
    y: (enteringCenter.y + leavingCenter.y) / 2,
  };
  const vertices = [{ x: rawLines[0]!.x1, y: rawLines[0]!.y1 }];
  for (const line of rawLines) vertices.push({ x: line.x2, y: line.y2 });
  const transformedVertices = vertices.map((vertex, index) => {
    const arclength = index === rawLines.length ? totalLength : starts[index]!;
    const weight = compactC1Weight(Math.abs(arclength - contactCenterArclengthPx) / supportRadiusPx);
    const relative = { x: vertex.x - center.x, y: vertex.y - center.y };
    const midpoint = {
      x: center.x + midpointMap.a * relative.x + midpointMap.b * relative.y,
      y: center.y + midpointMap.c * relative.x + midpointMap.d * relative.y,
    };
    return {
      x: vertex.x + weight * (midpoint.x - vertex.x),
      y: vertex.y + weight * (midpoint.y - vertex.y),
    };
  });
  const lines = rawLines.map((line, index) => ({
    ...line,
    x1: transformedVertices[index]!.x,
    y1: transformedVertices[index]!.y,
    x2: transformedVertices[index + 1]!.x,
    y2: transformedVertices[index + 1]!.y,
  }));
  if (!lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))) {
    throw new Error("collision-interval midpoint field emitted non-finite geometry");
  }
  const displacements = vertices.map((vertex, index) => Math.hypot(
    transformedVertices[index]!.x - vertex.x,
    transformedVertices[index]!.y - vertex.y,
  ));
  return {
    status: "ready",
    lines,
    intervalFrames: state.intervalFrames,
    contactCenterArclengthPx,
    supportRadiusPx,
    midpointMap,
    configurationDisplacementFrobenius: Math.hypot(
      configurationMap.a - 1, configurationMap.b, configurationMap.c, configurationMap.d - 1,
    ),
    meanVertexDisplacementPx: meanNumber(displacements),
    maxVertexDisplacementPx: Math.max(...displacements),
  };
}

function fitConfigurationMap(
  entering: readonly CollisionIntervalSledPoint[],
  leaving: readonly CollisionIntervalSledPoint[],
  enteringCenter: { x: number; y: number },
  leavingCenter: { x: number; y: number },
): { a: number; b: number; c: number; d: number } | null {
  let pxx = 0;
  let pxy = 0;
  let pyy = 0;
  let qpx = 0;
  let qpy = 0;
  let rpx = 0;
  let rpy = 0;
  for (let index = 0; index < entering.length; index++) {
    const p = entering[index]!.position;
    const q = leaving[index]!.position;
    const px = p.x - enteringCenter.x;
    const py = p.y - enteringCenter.y;
    const qx = q.x - leavingCenter.x;
    const qy = q.y - leavingCenter.y;
    pxx += px * px;
    pxy += px * py;
    pyy += py * py;
    qpx += qx * px;
    qpy += qx * py;
    rpx += qy * px;
    rpy += qy * py;
  }
  const determinant = pxx * pyy - pxy * pxy;
  const scale = Math.max(1, pxx * pyy, pxy * pxy);
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= EPSILON * scale) return null;
  const inverse = { a: pyy / determinant, b: -pxy / determinant, c: -pxy / determinant, d: pxx / determinant };
  return {
    a: qpx * inverse.a + qpy * inverse.c,
    b: qpx * inverse.b + qpy * inverse.d,
    c: rpx * inverse.a + rpy * inverse.c,
    d: rpx * inverse.b + rpy * inverse.d,
  };
}

function compactC1Weight(normalizedDistance: number): number {
  if (normalizedDistance >= 1) return 0;
  if (!(normalizedDistance > 0)) return 1;
  return Math.cos(Math.PI * normalizedDistance / 2) ** 2;
}

function connected(lines: readonly TrackLine[]): boolean {
  return lines.every((line, index) => {
    if (!(length(line) > EPSILON) || ![line.x1, line.y1, line.x2, line.y2].every(Number.isFinite)) return false;
    const previous = lines[index - 1];
    return previous === undefined || (line.x1 === previous.x2 && line.y1 === previous.y2);
  });
}

function validPointCloud(points: readonly CollisionIntervalSledPoint[]): boolean {
  return points.length === 4 && points.every((point) => [
    point.position.x, point.position.y, point.velocity.x, point.velocity.y,
  ].every(Number.isFinite));
}

function mean(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  return points.reduce(
    (sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }),
    { x: 0, y: 0 },
  );
}

function meanNumber(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value / values.length, 0);
}

function length(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}
