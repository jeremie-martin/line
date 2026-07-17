/**
 * Local full-sled contact-footprint differential flow.
 *
 * The four-point velocity gradient is transported for exactly one collective
 * footprint traversal time and only within that physical footprint. Unlike an
 * arclength field, no deformation accumulates along the raw candidate curve.
 */
import type { TrackLine } from "../types.ts";

const EPSILON = 64 * Number.EPSILON;

export type ContactFootprintFlowPoint = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
};

export type ContactFootprintFlowUnavailable = {
  status: "unavailable";
  reason:
    | "missing_full_sled_state"
    | "zero_collective_speed"
    | "degenerate_footprint"
    | "singular_velocity_gradient"
    | "disconnected_curve"
    | "outside_footprint"
    | "inert_flow";
};

export type ContactFootprintFlowReady = {
  status: "ready";
  lines: TrackLine[];
  footprintRadiusPx: number;
  traversalFrames: number;
  gradient: { a: number; b: number; c: number; d: number };
  activeVertexCount: number;
  meanVertexDisplacementPx: number;
  maxVertexDisplacementPx: number;
};

export type ContactFootprintFlow = ContactFootprintFlowUnavailable | ContactFootprintFlowReady;

/**
 * Apply exp(A * R / |vbar|) around the full-cloud centroid with the compact
 * C1 footprint weight. `R` is the cloud RMS radius, never a sampled extent.
 */
export function realizeContactFootprintFlowField(
  rawLines: readonly TrackLine[],
  points: readonly ContactFootprintFlowPoint[],
): ContactFootprintFlow {
  if (points.length !== 4 || !points.every(finitePoint)) return { status: "unavailable", reason: "missing_full_sled_state" };
  if (rawLines.length === 0 || !connected(rawLines)) return { status: "unavailable", reason: "disconnected_curve" };
  const center = mean(points.map((point) => point.position));
  const collectiveVelocity = mean(points.map((point) => point.velocity));
  const speed = Math.hypot(collectiveVelocity.x, collectiveVelocity.y);
  if (!(speed > EPSILON)) return { status: "unavailable", reason: "zero_collective_speed" };
  const footprintRadiusPx = Math.sqrt(points.reduce((sum, point) => sum +
    (point.position.x - center.x) ** 2 + (point.position.y - center.y) ** 2,
  0) / points.length);
  if (!(footprintRadiusPx > EPSILON) || !Number.isFinite(footprintRadiusPx)) {
    return { status: "unavailable", reason: "degenerate_footprint" };
  }
  const gradient = fitVelocityGradient(points, center, collectiveVelocity);
  if (gradient === null) return { status: "unavailable", reason: "singular_velocity_gradient" };
  const traversalFrames = footprintRadiusPx / speed;
  const flow = matrixExp({
    a: gradient.a * traversalFrames,
    b: gradient.b * traversalFrames,
    c: gradient.c * traversalFrames,
    d: gradient.d * traversalFrames,
  });
  if (![flow.a, flow.b, flow.c, flow.d].every(Number.isFinite)) {
    return { status: "unavailable", reason: "singular_velocity_gradient" };
  }

  const vertices = [{ x: rawLines[0]!.x1, y: rawLines[0]!.y1 }];
  for (const line of rawLines) vertices.push({ x: line.x2, y: line.y2 });
  let activeVertexCount = 0;
  const transformedVertices = vertices.map((vertex) => {
    const relative = { x: vertex.x - center.x, y: vertex.y - center.y };
    const normalizedDistance = Math.hypot(relative.x, relative.y) / footprintRadiusPx;
    const weight = compactC1Weight(normalizedDistance);
    if (weight > 0) activeVertexCount++;
    const flowed = {
      x: center.x + flow.a * relative.x + flow.b * relative.y,
      y: center.y + flow.c * relative.x + flow.d * relative.y,
    };
    return {
      x: vertex.x + weight * (flowed.x - vertex.x),
      y: vertex.y + weight * (flowed.y - vertex.y),
    };
  });
  if (activeVertexCount === 0) return { status: "unavailable", reason: "outside_footprint" };
  const displacements = vertices.map((vertex, index) => Math.hypot(
    transformedVertices[index]!.x - vertex.x,
    transformedVertices[index]!.y - vertex.y,
  ));
  const maxVertexDisplacementPx = Math.max(...displacements);
  if (!(maxVertexDisplacementPx > EPSILON)) return { status: "unavailable", reason: "inert_flow" };
  const lines = rawLines.map((line, index) => ({
    ...line,
    x1: transformedVertices[index]!.x,
    y1: transformedVertices[index]!.y,
    x2: transformedVertices[index + 1]!.x,
    y2: transformedVertices[index + 1]!.y,
  }));
  if (!lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))) {
    throw new Error("contact-footprint flow emitted non-finite geometry");
  }
  return {
    status: "ready",
    lines,
    footprintRadiusPx,
    traversalFrames,
    gradient,
    activeVertexCount,
    meanVertexDisplacementPx: meanNumber(displacements),
    maxVertexDisplacementPx,
  };
}

function fitVelocityGradient(
  points: readonly ContactFootprintFlowPoint[],
  center: { x: number; y: number },
  collectiveVelocity: { x: number; y: number },
): { a: number; b: number; c: number; d: number } | null {
  let pxx = 0;
  let pxy = 0;
  let pyy = 0;
  let vpx = 0;
  let vpy = 0;
  let wpx = 0;
  let wpy = 0;
  for (const point of points) {
    const px = point.position.x - center.x;
    const py = point.position.y - center.y;
    const vx = point.velocity.x - collectiveVelocity.x;
    const vy = point.velocity.y - collectiveVelocity.y;
    pxx += px * px;
    pxy += px * py;
    pyy += py * py;
    vpx += vx * px;
    vpy += vx * py;
    wpx += vy * px;
    wpy += vy * py;
  }
  const determinant = pxx * pyy - pxy * pxy;
  const scale = Math.max(1, pxx * pyy, pxy * pxy);
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= EPSILON * scale) return null;
  const inverse = { a: pyy / determinant, b: -pxy / determinant, c: -pxy / determinant, d: pxx / determinant };
  return {
    a: vpx * inverse.a + vpy * inverse.c,
    b: vpx * inverse.b + vpy * inverse.d,
    c: wpx * inverse.a + wpy * inverse.c,
    d: wpx * inverse.b + wpy * inverse.d,
  };
}

function matrixExp(matrix: { a: number; b: number; c: number; d: number }): { a: number; b: number; c: number; d: number } {
  const halfTrace = (matrix.a + matrix.d) / 2;
  const ca = matrix.a - halfTrace;
  const cd = matrix.d - halfTrace;
  const discriminant = ca * ca + matrix.b * matrix.c;
  const expTrace = Math.exp(halfTrace);
  if (discriminant >= 0) {
    const root = Math.sqrt(discriminant);
    const factor = Math.abs(root) <= EPSILON ? 1 : Math.sinh(root) / root;
    return {
      a: expTrace * (Math.cosh(root) + factor * ca), b: expTrace * factor * matrix.b,
      c: expTrace * factor * matrix.c, d: expTrace * (Math.cosh(root) + factor * cd),
    };
  }
  const root = Math.sqrt(-discriminant);
  const factor = Math.abs(root) <= EPSILON ? 1 : Math.sin(root) / root;
  return {
    a: expTrace * (Math.cos(root) + factor * ca), b: expTrace * factor * matrix.b,
    c: expTrace * factor * matrix.c, d: expTrace * (Math.cos(root) + factor * cd),
  };
}

function compactC1Weight(normalizedDistance: number): number {
  if (normalizedDistance >= 1) return 0;
  if (!(normalizedDistance > 0)) return 1;
  return Math.cos(Math.PI * normalizedDistance / 2) ** 2;
}

function connected(lines: readonly TrackLine[]): boolean {
  return lines.every((line, index) => {
    if (!(lineLength(line) > EPSILON) || ![line.x1, line.y1, line.x2, line.y2].every(Number.isFinite)) return false;
    const previous = lines[index - 1];
    return previous === undefined || (line.x1 === previous.x2 && line.y1 === previous.y2);
  });
}

function finitePoint(point: ContactFootprintFlowPoint): boolean {
  return [point.position.x, point.position.y, point.velocity.x, point.velocity.y].every(Number.isFinite);
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

function lineLength(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}
