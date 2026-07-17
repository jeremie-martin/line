/**
 * Continuous full-sled affine contact-flow deformation.
 *
 * The field is a physical state-to-geometry map: it fits the unique affine
 * velocity gradient carried by all four native sled points, then transports
 * the raw curve's existing vertices under that flow in raw arclength time.
 * It contains no scoring, sampling, or optimizer policy.
 */
import type { TrackLine } from "../types.ts";

const EPSILON = 64 * Number.EPSILON;

export type AffineContactFlowPoint = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
};

export type AffineContactFlowUnavailable = {
  status: "unavailable";
  reason: "missing_points" | "zero_mean_speed" | "singular_affine_fit" | "disconnected_curve";
};

export type AffineContactFlowReady = {
  status: "ready";
  lines: TrackLine[];
  meanVelocity: { x: number; y: number };
  gradient: { a: number; b: number; c: number; d: number };
  rawLengthPx: number;
  terminalDisplacementPx: number;
};

export type AffineContactFlow = AffineContactFlowUnavailable | AffineContactFlowReady;

/**
 * Preserve the first raw endpoint and evolve every later vertex by exp(A t),
 * where t is its existing cumulative arclength divided by collective speed.
 */
export function realizeAffineContactFlowField(
  rawLines: readonly TrackLine[],
  points: readonly AffineContactFlowPoint[],
): AffineContactFlow {
  if (points.length !== 4 || !points.every(finitePointState)) return { status: "unavailable", reason: "missing_points" };
  if (rawLines.length === 0 || !connected(rawLines)) return { status: "unavailable", reason: "disconnected_curve" };
  const meanPosition = mean(points.map((point) => point.position));
  const meanVelocity = mean(points.map((point) => point.velocity));
  const speed = Math.hypot(meanVelocity.x, meanVelocity.y);
  if (!(speed > EPSILON)) return { status: "unavailable", reason: "zero_mean_speed" };
  const gradient = fitAffineGradient(points, meanPosition, meanVelocity);
  if (gradient === null) return { status: "unavailable", reason: "singular_affine_fit" };
  const rawLengthPx = rawLines.reduce((sum, line) => sum + length(line), 0);
  if (!(rawLengthPx > EPSILON)) return { status: "unavailable", reason: "disconnected_curve" };
  const anchor = { x: rawLines[0]!.x1, y: rawLines[0]!.y1 };
  let arclength = 0;
  const vertices = [{ ...anchor }];
  for (const line of rawLines) {
    arclength += length(line);
    vertices.push(flowPoint({ x: line.x2, y: line.y2 }, anchor, gradient, arclength / speed));
  }
  const lines = rawLines.map((line, index) => ({
    ...line,
    x1: vertices[index]!.x,
    y1: vertices[index]!.y,
    x2: vertices[index + 1]!.x,
    y2: vertices[index + 1]!.y,
  }));
  if (!lines.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))) {
    throw new Error("affine contact-flow field emitted non-finite geometry");
  }
  const rawEnd = rawLines[rawLines.length - 1]!;
  const flowedEnd = lines[lines.length - 1]!;
  return {
    status: "ready",
    lines,
    meanVelocity,
    gradient,
    rawLengthPx,
    terminalDisplacementPx: Math.hypot(flowedEnd.x2 - rawEnd.x2, flowedEnd.y2 - rawEnd.y2),
  };
}

function fitAffineGradient(
  points: readonly AffineContactFlowPoint[],
  meanPosition: { x: number; y: number },
  meanVelocity: { x: number; y: number },
): { a: number; b: number; c: number; d: number } | null {
  let pxx = 0;
  let pxy = 0;
  let pyy = 0;
  let vpx = 0;
  let vpy = 0;
  let wpx = 0;
  let wpy = 0;
  for (const point of points) {
    const px = point.position.x - meanPosition.x;
    const py = point.position.y - meanPosition.y;
    const vx = point.velocity.x - meanVelocity.x;
    const vy = point.velocity.y - meanVelocity.y;
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

function flowPoint(
  point: { x: number; y: number },
  anchor: { x: number; y: number },
  gradient: { a: number; b: number; c: number; d: number },
  time: number,
): { x: number; y: number } {
  const matrix = matrixExp({
    a: gradient.a * time,
    b: gradient.b * time,
    c: gradient.c * time,
    d: gradient.d * time,
  });
  const x = point.x - anchor.x;
  const y = point.y - anchor.y;
  return { x: anchor.x + matrix.a * x + matrix.b * y, y: anchor.y + matrix.c * x + matrix.d * y };
}

/** Exact real 2x2 matrix exponential, including rotation-dominant flows. */
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

function connected(lines: readonly TrackLine[]): boolean {
  return lines.every((line, index) => {
    if (!(length(line) > EPSILON) || ![line.x1, line.y1, line.x2, line.y2].every(Number.isFinite)) return false;
    const prior = lines[index - 1];
    return prior === undefined || (line.x1 === prior.x2 && line.y1 === prior.y2);
  });
}

function finitePointState(point: AffineContactFlowPoint): boolean {
  return [point.position.x, point.position.y, point.velocity.x, point.velocity.y].every(Number.isFinite);
}

function mean(points: readonly { x: number; y: number }[]): { x: number; y: number } {
  return points.reduce((sum, point) => ({ x: sum.x + point.x / points.length, y: sum.y + point.y / points.length }), { x: 0, y: 0 });
}

function length(line: TrackLine): number {
  return Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
}
