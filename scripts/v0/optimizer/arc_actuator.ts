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

/**
 * Stable name of one atomic geometry transformation.  The compiler's historic
 * terminology called these "actuators"; the control/matrix layer calls them
 * knobs.  They are the same things, and retain one canonical registry.
 */
export type ArcKnobId =
  | "tail_pitch"
  | "whole_rotation"
  | "interior_normal_bow"
  | "post_contact_pitch";
export type ArcActuatorId = ArcKnobId;

/** Ordered, possibly repeated, transform names.  Order is data—not a hidden
 * property of a pair type—so every sequence has the ordinary left-to-right
 * composition meaning. */
export type ArcKnobSequence = readonly ArcKnobId[];
/** Values are positional and align with `ArcKnobSequence`; positional storage
 * deliberately permits sequences such as `[a, a]` without aliasing values. */
export type ArcKnobValues = readonly number[];

export type ArcActuatorContext = Readonly<{
  /** Optional immutable target-frame contact reference for future local
   * contact-point actuators.  Current registered transforms do not need it. */
  contactPoint?: Readonly<{ x: number; y: number }>;
}>;

export type ArcKnobDefinition = Readonly<{
  id: ArcKnobId;
  label: string;
  unit: "deg";
  span: number;
  /** Deterministic inverse-model enumeration resolution in this knob's unit. */
  scanStep: number;
  /** Minimum meaningful difference between two emitted proposals. */
  proposalSeparation: number;
  needsContactPoint: boolean;
  apply(lines: TrackLine[], value: number, context?: ArcActuatorContext): TrackLine[];
}>;
export type ArcActuator = ArcKnobDefinition;

export type ArcActuatorPairId =
  | "tail_pitch__whole_rotation"
  | "tail_pitch__interior_normal_bow"
  | "tail_pitch__post_contact_pitch";

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
  scanStep: 0.25,
  proposalSeparation: 1.5,
  needsContactPoint: false,
  apply: (lines, deg) => pitchExitLines(lines, deg),
};

const wholeRotation: ArcActuator = {
  id: "whole_rotation",
  label: "whole-arc rotation",
  unit: "deg",
  span: 2.5,
  scanStep: 0.5,
  proposalSeparation: 0.5,
  needsContactPoint: false,
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
  scanStep: 0.5,
  proposalSeparation: 0.5,
  needsContactPoint: false,
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

/**
 * Rotate only the candidate-owned branch after the predicted contact vertex.
 * The immutable target-frame sled reference selects the nearest interior
 * vertex; every earlier point is preserved.  Missing context or a malformed
 * polyline means ordinary absence, not an inferred contact repair.
 */
const postContactPitch: ArcActuator = {
  id: "post_contact_pitch",
  label: "post-contact branch pitch",
  unit: "deg",
  span: 2.5,
  scanStep: 0.5,
  proposalSeparation: 0.5,
  needsContactPoint: true,
  apply(lines, deg, context) {
    const contact = context?.contactPoint;
    if (lines.length < 2 || deg === 0 || contact === undefined) return clone(lines);
    const vertices = [{ x: lines[0].x1, y: lines[0].y1 }];
    for (const line of lines) {
      const previous = vertices[vertices.length - 1];
      if (Math.hypot(line.x1 - previous.x, line.y1 - previous.y) > 1e-6) return clone(lines);
      vertices.push({ x: line.x2, y: line.y2 });
    }
    let contactIndex = -1;
    let nearest = Infinity;
    for (let index = 1; index + 1 < vertices.length; index++) {
      const point = vertices[index];
      const distance = Math.hypot(point.x - contact.x, point.y - contact.y);
      if (distance < nearest) {
        nearest = distance;
        contactIndex = index;
      }
    }
    if (contactIndex < 1) return clone(lines);
    const pivot = vertices[contactIndex];
    const radians = deg * Math.PI / 180;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    const rotate = (point: { x: number; y: number }) => {
      const x = point.x - pivot.x;
      const y = point.y - pivot.y;
      return { x: pivot.x + x * c - y * s, y: pivot.y + x * s + y * c };
    };
    const adjusted = vertices.map((point, index) => index > contactIndex ? rotate(point) : point);
    return lines.map((line, index) => ({
      ...line,
      x1: adjusted[index].x,
      y1: adjusted[index].y,
      x2: adjusted[index + 1].x,
      y2: adjusted[index + 1].y,
    }));
  },
};

/** The single source of truth for atomic knob definitions. */
export const ARC_KNOBS: Readonly<Record<ArcKnobId, ArcKnobDefinition>> = {
  tail_pitch: tailPitch,
  whole_rotation: wholeRotation,
  interior_normal_bow: interiorNormalBow,
  post_contact_pitch: postContactPitch,
};

export function getArcKnob(id: ArcKnobId): ArcKnobDefinition {
  return ARC_KNOBS[id];
}

export function arcKnobProbeSpan(id: ArcKnobId): number {
  return getArcKnob(id).span;
}

export function arcKnobScanStep(id: ArcKnobId): number {
  return getArcKnob(id).scanStep;
}

export function arcKnobProposalSeparation(id: ArcKnobId): number {
  return getArcKnob(id).proposalSeparation;
}

export function arcKnobSequenceNeedsContactPoint(sequence: ArcKnobSequence): boolean {
  return sequence.some((id) => getArcKnob(id).needsContactPoint);
}

/**
 * Apply an ordered knob sequence.  This is the generic geometry boundary used
 * by both the normal compiler's legacy-pair adapter and matrix studies.  A
 * value-vector length mismatch is a programmer error, not a physics verdict;
 * every well-formed sequence itself has a deterministic meaning.
 */
export function applyArcKnobSequence(
  lines: TrackLine[],
  sequence: ArcKnobSequence,
  values: ArcKnobValues,
  context?: ArcActuatorContext,
): TrackLine[] {
  if (sequence.length !== values.length) {
    throw new Error(`arc knob sequence has ${sequence.length} steps but ${values.length} values`);
  }
  let out = clone(lines);
  for (let index = 0; index < sequence.length; index++) {
    const value = values[index];
    if (!Number.isFinite(value)) throw new Error(`arc knob ${sequence[index]} has non-finite value`);
    out = getArcKnob(sequence[index]).apply(out, value, context);
  }
  return out;
}

/** Enumerate ordered sequences directly from the registry.  `allowRepeated`
 * is explicit because repeated knobs are a legitimate experimental choice,
 * not an accidental consequence of the enumerator. */
export function enumerateArcKnobSequences(options: Readonly<{
  knobs?: readonly ArcKnobId[];
  maxLength: number;
  allowRepeated?: boolean;
}>): ArcKnobId[][] {
  if (!Number.isInteger(options.maxLength) || options.maxLength < 1) {
    throw new Error(`arc knob maxLength must be a positive integer`);
  }
  const knobs = options.knobs === undefined ? Object.keys(ARC_KNOBS) as ArcKnobId[] : [...options.knobs];
  for (const id of knobs) getArcKnob(id);
  const out: ArcKnobId[][] = [];
  const visit = (prefix: ArcKnobId[]) => {
    if (prefix.length > 0) out.push([...prefix]);
    if (prefix.length === options.maxLength) return;
    for (const id of knobs) {
      if (options.allowRepeated !== true && prefix.includes(id)) continue;
      prefix.push(id);
      visit(prefix);
      prefix.pop();
    }
  };
  visit([]);
  return out;
}

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
  tail_pitch__post_contact_pitch: {
    id: "tail_pitch__post_contact_pitch",
    first: postContactPitch,
    second: tailPitch,
  },
};

export function getArcActuatorPair(id: ArcActuatorPairId): ArcActuatorPair {
  return ARC_ACTUATOR_PAIRS[id];
}

export function arcActuatorPairNeedsContactPoint(pair: ArcActuatorPair | ArcActuatorPairId): boolean {
  const resolved = typeof pair === "string" ? getArcActuatorPair(pair) : pair;
  return arcKnobSequenceNeedsContactPoint([resolved.first.id, resolved.second.id]);
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
  return applyArcKnobSequence(
    lines,
    [resolved.first.id, resolved.second.id],
    [knobs.rotateDeg, knobs.pitchDeg],
    context,
  );
}
