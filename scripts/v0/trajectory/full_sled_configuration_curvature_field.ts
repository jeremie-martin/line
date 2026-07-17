/**
 * Full-sled configuration-curvature contact field.
 *
 * The four instantaneous native sled positions form a second-order contact
 * manifold in their collective-motion frame.  This realization makes that
 * manifold the raw curve's contact boundary condition: its tangent and
 * curvature are imposed at the raw contact, while a cubic-Hermite field fades
 * both corrections exactly to the untouched raw terminal tangent/curvature.
 *
 * It is deliberately not a pose frame (all four points contribute to a
 * quadratic fit), a support surface, a velocity-flow field, or a prior-contact
 * transport.  The ordinary exact evaluator remains the only judge.
 */
import type { TrackLine } from "../types.ts";
import type { PlanningState, Vec2 } from "./state.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;
const EPSILON = 1e-8;

export type FullSledConfigurationCurvatureUnavailable = {
  status: "unavailable";
  reason:
    | "missing_full_sled_state"
    | "degenerate_collective_speed"
    | "degenerate_configuration_fit"
    | "missing_contact_curve"
    | "degenerate_post_curve";
};

export type FullSledConfigurationCurvatureReady = {
  status: "ready";
  lines: TrackLine[];
  contactIndex: number;
  field: {
    bodyTangentShiftDeg: number;
    bodyCurvatureRadPerPx: number;
    rawContactCurvatureRadPerPx: number;
    meanVertexDisplacementPx: number;
    maxVertexDisplacementPx: number;
  };
  protocol: "full-sled-configuration-curvature-contact-field.v1";
};

export type FullSledConfigurationCurvatureField =
  | FullSledConfigurationCurvatureUnavailable
  | FullSledConfigurationCurvatureReady;

/**
 * Fit `normal = a0 + a1*tangent + a2*tangent²` to the complete instantaneous
 * sled cloud in its collective velocity frame.  The fit determines both the
 * contact tangent (`a1`) and contact curvature (`2a2/(1+a1²)^(3/2)`) without
 * choosing a named point or a response parameter.
 */
export function realizeFullSledConfigurationCurvatureField(
  lines: readonly TrackLine[],
  state: PlanningState,
  contactAnchor: Vec2,
): FullSledConfigurationCurvatureField {
  const manifold = configurationManifold(state);
  if ("status" in manifold) return manifold;
  const contactIndex = nearestPostStart(lines, contactAnchor);
  if (contactIndex < 0 || contactIndex >= lines.length - 1) {
    return { status: "unavailable", reason: "missing_contact_curve" };
  }
  const lengths = lines.map(lineLength);
  if (lengths.some((length) => !Number.isFinite(length) || length <= EPSILON) || !connected(lines)) {
    return { status: "unavailable", reason: "degenerate_post_curve" };
  }
  const angles = unwrap(lines.map((line) => Math.atan2(line.y2 - line.y1, line.x2 - line.x1)));
  const rawContactAngle = angles[contactIndex]!;
  const nextLength = (lengths[contactIndex]! + lengths[contactIndex + 1]!) / 2;
  if (!(nextLength > EPSILON)) return { status: "unavailable", reason: "degenerate_post_curve" };
  const rawContactCurvature = angleDelta(angles[contactIndex]!, angles[contactIndex + 1]!) / nextLength;
  const tangentShift = unorientedAngleDelta(rawContactAngle, manifold.tangentAngle);
  const curvatureShift = manifold.curvature - rawContactCurvature;
  const postLength = lengths.slice(contactIndex).reduce((sum, length) => sum + length, 0);
  if (!(postLength > EPSILON)) return { status: "unavailable", reason: "degenerate_post_curve" };

  const adjustedAngles = [...angles];
  let arclength = 0;
  for (let index = contactIndex; index < lines.length; index++) {
    const x = arclength / postLength;
    // Cubic Hermite boundary: value and derivative match the body manifold at
    // contact, and both return to the raw curve at release.
    const h00 = 2 * x ** 3 - 3 * x ** 2 + 1;
    const h10 = x ** 3 - 2 * x ** 2 + x;
    adjustedAngles[index] = angles[index]! + tangentShift * h00 + curvatureShift * postLength * h10;
    arclength += lengths[index]!;
  }

  const rebuilt = lines.slice(0, contactIndex).map(copyLine);
  let start = { x: lines[contactIndex]!.x1, y: lines[contactIndex]!.y1 };
  for (let index = contactIndex; index < lines.length; index++) {
    const end = {
      x: start.x + Math.cos(adjustedAngles[index]!) * lengths[index]!,
      y: start.y + Math.sin(adjustedAngles[index]!) * lengths[index]!,
    };
    rebuilt.push({ ...copyLine(lines[index]!), x1: start.x, y1: start.y, x2: end.x, y2: end.y });
    start = end;
  }
  if (!connected(rebuilt) || !rebuilt.every((line) => [line.x1, line.y1, line.x2, line.y2].every(Number.isFinite))) {
    throw new Error("configuration-curvature field emitted non-finite or disconnected geometry");
  }
  const rawVertices = vertices(lines);
  const transformedVertices = vertices(rebuilt);
  const displacement = rawVertices.map((point, index) => Math.hypot(
    point.x - transformedVertices[index]!.x,
    point.y - transformedVertices[index]!.y,
  ));
  return {
    status: "ready",
    lines: rebuilt,
    contactIndex,
    field: {
      bodyTangentShiftDeg: tangentShift * 180 / Math.PI,
      bodyCurvatureRadPerPx: manifold.curvature,
      rawContactCurvatureRadPerPx: rawContactCurvature,
      meanVertexDisplacementPx: mean(displacement),
      maxVertexDisplacementPx: Math.max(...displacement),
    },
    protocol: "full-sled-configuration-curvature-contact-field.v1",
  };
}

function configurationManifold(
  state: PlanningState,
): { tangentAngle: number; curvature: number } | FullSledConfigurationCurvatureUnavailable {
  const points = SLED_POINTS.map((name) => state.points[name]);
  if (points.some((point) => point === undefined || point.velocity === null)) {
    return { status: "unavailable", reason: "missing_full_sled_state" };
  }
  const readable = points as Array<NonNullable<typeof points[number]>>;
  const center = readable.reduce(
    (sum, point) => ({ x: sum.x + point.position.x / readable.length, y: sum.y + point.position.y / readable.length }),
    { x: 0, y: 0 },
  );
  const velocity = readable.reduce(
    (sum, point) => ({ x: sum.x + point.velocity!.x / readable.length, y: sum.y + point.velocity!.y / readable.length }),
    { x: 0, y: 0 },
  );
  const speed = Math.hypot(velocity.x, velocity.y);
  if (!Number.isFinite(speed) || speed <= EPSILON) {
    return { status: "unavailable", reason: "degenerate_collective_speed" };
  }
  const tangent = { x: velocity.x / speed, y: velocity.y / speed };
  const normal = { x: -tangent.y, y: tangent.x };
  const samples = readable.map((point) => {
    const dx = point.position.x - center.x;
    const dy = point.position.y - center.y;
    return { u: dx * tangent.x + dy * tangent.y, w: dx * normal.x + dy * normal.y };
  });
  const coefficients = solveQuadratic(samples);
  if (coefficients === null) return { status: "unavailable", reason: "degenerate_configuration_fit" };
  const [, slope, quadratic] = coefficients;
  const tangentAngle = Math.atan2(tangent.y, tangent.x) + Math.atan(slope);
  const curvature = 2 * quadratic / Math.pow(1 + slope * slope, 1.5);
  if (![tangentAngle, curvature].every(Number.isFinite)) {
    return { status: "unavailable", reason: "degenerate_configuration_fit" };
  }
  return { tangentAngle, curvature };
}

function solveQuadratic(samples: readonly { u: number; w: number }[]): [number, number, number] | null {
  const sums = samples.reduce((sum, { u, w }) => ({
    u0: sum.u0 + 1,
    u1: sum.u1 + u,
    u2: sum.u2 + u * u,
    u3: sum.u3 + u * u * u,
    u4: sum.u4 + u * u * u * u,
    w0: sum.w0 + w,
    w1: sum.w1 + u * w,
    w2: sum.w2 + u * u * w,
  }), { u0: 0, u1: 0, u2: 0, u3: 0, u4: 0, w0: 0, w1: 0, w2: 0 });
  const matrix = [
    [sums.u0, sums.u1, sums.u2, sums.w0],
    [sums.u1, sums.u2, sums.u3, sums.w1],
    [sums.u2, sums.u3, sums.u4, sums.w2],
  ];
  for (let pivot = 0; pivot < 3; pivot++) {
    let best = pivot;
    for (let row = pivot + 1; row < 3; row++) if (Math.abs(matrix[row]![pivot]!) > Math.abs(matrix[best]![pivot]!)) best = row;
    if (Math.abs(matrix[best]![pivot]!) <= EPSILON) return null;
    [matrix[pivot], matrix[best]] = [matrix[best]!, matrix[pivot]!];
    const divisor = matrix[pivot]![pivot]!;
    for (let column = pivot; column <= 3; column++) matrix[pivot]![column] /= divisor;
    for (let row = 0; row < 3; row++) {
      if (row === pivot) continue;
      const factor = matrix[row]![pivot]!;
      for (let column = pivot; column <= 3; column++) matrix[row]![column] -= factor * matrix[pivot]![column]!;
    }
  }
  return [matrix[0]![3]!, matrix[1]![3]!, matrix[2]![3]!];
}

function nearestPostStart(lines: readonly TrackLine[], anchor: Vec2): number {
  let index = -1;
  let distance = Infinity;
  for (let candidate = 0; candidate < lines.length; candidate++) {
    const line = lines[candidate]!;
    const candidateDistance = (line.x1 - anchor.x) ** 2 + (line.y1 - anchor.y) ** 2;
    if (candidateDistance < distance) { index = candidate; distance = candidateDistance; }
  }
  return index;
}

function lineLength(line: TrackLine): number { return Math.hypot(line.x2 - line.x1, line.y2 - line.y1); }
function copyLine(line: TrackLine): TrackLine { return { ...line }; }
function vertices(lines: readonly TrackLine[]): Vec2[] { return [{ x: lines[0]!.x1, y: lines[0]!.y1 }, ...lines.map((line) => ({ x: line.x2, y: line.y2 }))]; }
function connected(lines: readonly TrackLine[]): boolean { return lines.every((line, index) => index === 0 || (line.x1 === lines[index - 1]!.x2 && line.y1 === lines[index - 1]!.y2)); }
function mean(values: readonly number[]): number { return values.reduce((sum, value) => sum + value, 0) / values.length; }
function angleDelta(from: number, to: number): number { return ((to - from + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; }
function unorientedAngleDelta(from: number, to: number): number { const delta = angleDelta(from, to); return delta <= -Math.PI / 2 ? delta + Math.PI : delta > Math.PI / 2 ? delta - Math.PI : delta; }
function unwrap(angles: readonly number[]): number[] { const out: number[] = []; for (const angle of angles) { const prior = out.at(-1); out.push(prior === undefined ? angle : prior + angleDelta(prior, angle)); } return out; }
