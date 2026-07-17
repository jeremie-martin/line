/**
 * Physical actuator registry for the response-model aiming lane.
 *
 * An actuator is a deterministic, local transformation of an already sampled
 * candidate arc.  It is a proposer input, never a judge: callers must still
 * send every resulting line set through the normal exact evaluator.  Pairs
 * intentionally retain the existing two-coordinate response-model shape.  A
 * future three-control policy must declare its additional probe plan instead
 * of silently treating an unobserved coordinate as additive.
 */
import { type TrackLine } from "../types.ts";
import {
  pitchExitLines,
  rotateArcLines,
  type ArcKnobs,
} from "./arc_model.ts";

export type ArcActuatorId =
  | "tail_pitch"
  | "whole_rotation"
  | "interior_normal_bow";

export type ArcActuatorContext = Readonly<{
  /** Optional immutable target-frame contact reference for future local
   * contact-point actuators.  Current registered transforms do not need it. */
  contactPoint?: Readonly<{ x: number; y: number }>;
}>;

export type ArcActuator = Readonly<{
  id: ArcActuatorId;
  label: string;
  unit: "deg";
  span: number;
  apply(lines: TrackLine[], value: number, context?: ArcActuatorContext): TrackLine[];
}>;

export type ArcActuatorPairId =
  | "tail_pitch__whole_rotation"
  | "tail_pitch__interior_normal_bow";

export type ArcActuatorPair = Readonly<{
  id: ArcActuatorPairId;
  /** The first physical operation.  It maps the existing `rotateDeg` response
   * coordinate to a named physical control; the model itself stays unchanged. */
  first: ArcActuator;
  /** The second operation maps the existing `pitchDeg` coordinate. */
  second: ArcActuator;
}>;

function clone(lines: TrackLine[]): TrackLine[] {
  return lines.map((line) => ({ ...line }));
}

const tailPitch: ArcActuator = {
  id: "tail_pitch",
  label: "tail pitch",
  unit: "deg",
  span: 8.5,
  apply: (lines, deg) => pitchExitLines(lines, deg),
};

const wholeRotation: ArcActuator = {
  id: "whole_rotation",
  label: "whole-arc rotation",
  unit: "deg",
  span: 2.5,
  apply: (lines, deg) => rotateArcLines(lines, deg),
};

/**
 * Smooth endpoint-preserving interior normal displacement.  The coordinate
 * is expressed in degrees only to share the incumbent second-axis probe span:
 * its peak displacement is arcLength * tan(value), matching whole rotation's
 * first-order transverse scale.  It is not itself a rotation.
 */
const interiorNormalBow: ArcActuator = {
  id: "interior_normal_bow",
  label: "endpoint-preserving interior normal bow",
  unit: "deg",
  span: 2.5,
  apply(lines, equivalentDeg) {
    if (lines.length < 2 || equivalentDeg === 0) return clone(lines);
    const vertices = [{ x: lines[0].x1, y: lines[0].y1 }];
    let arcLength = 0;
    for (const line of lines) {
      const previous = vertices[vertices.length - 1];
      if (Math.hypot(line.x1 - previous.x, line.y1 - previous.y) > 1e-6) return clone(lines);
      const length = Math.hypot(line.x2 - line.x1, line.y2 - line.y1);
      if (!(length > 1e-9)) return clone(lines);
      arcLength += length;
      vertices.push({ x: line.x2, y: line.y2 });
    }
    const start = vertices[0];
    const end = vertices[vertices.length - 1];
    const chordX = end.x - start.x;
    const chordY = end.y - start.y;
    const chordLength = Math.hypot(chordX, chordY);
    if (!(chordLength > 1e-9) || !(arcLength > 1e-9)) return clone(lines);
    const amplitude = arcLength * Math.tan(equivalentDeg * Math.PI / 180);
    const normalX = -chordY / chordLength;
    const normalY = chordX / chordLength;
    const adjusted = vertices.map((vertex, index) => {
      const s = index / (vertices.length - 1);
      // Zero value and zero continuous derivative at both endpoints.
      const weight = Math.sin(Math.PI * s) ** 2;
      return { x: vertex.x + normalX * amplitude * weight, y: vertex.y + normalY * amplitude * weight };
    });
    return lines.map((line, index) => ({
      ...line,
      x1: adjusted[index].x,
      y1: adjusted[index].y,
      x2: adjusted[index + 1].x,
      y2: adjusted[index + 1].y,
    }));
  },
};

export const ARC_ACTUATOR_PAIRS: Readonly<Record<ArcActuatorPairId, ArcActuatorPair>> = {
  tail_pitch__whole_rotation: {
    id: "tail_pitch__whole_rotation",
    first: wholeRotation,
    second: tailPitch,
  },
  tail_pitch__interior_normal_bow: {
    id: "tail_pitch__interior_normal_bow",
    first: interiorNormalBow,
    second: tailPitch,
  },
};

export function getArcActuatorPair(id: ArcActuatorPairId): ArcActuatorPair {
  return ARC_ACTUATOR_PAIRS[id];
}

/**
 * Apply a declared ordered two-control policy.  `rotateDeg` / `pitchDeg`
 * remain the response-model coordinate names for compatibility; the pair
 * descriptor is the sole authority for their physical meaning.
 */
export function applyArcActuatorPair(
  lines: TrackLine[],
  pair: ArcActuatorPair | ArcActuatorPairId,
  knobs: ArcKnobs,
  context?: ArcActuatorContext,
): TrackLine[] {
  const resolved = typeof pair === "string" ? getArcActuatorPair(pair) : pair;
  return resolved.second.apply(resolved.first.apply(lines, knobs.rotateDeg, context), knobs.pitchDeg, context);
}
