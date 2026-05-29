import type {
  Arc,
} from "../v0/types.ts";
import type {
  CandidateKey,
  CandidateStreamName,
  NormalizedGap,
  NormalizedSpecContext,
  SectionAxes,
} from "./types.ts";
import { clamp, roundToGrid, stableHash } from "./deterministic_math.ts";
import { randomFloat, randomInt, randomRange } from "./rng.ts";
import { CALIB } from "./normalize.ts";

export type CandidateArc = {
  key: CandidateKey;
  arc: Arc;
  geometryHash: string;
};

export type TargetState = {
  sledX: number;
  sledY: number;
  velocity: { x: number; y: number };
  speed: number;
  angleDeg: number;
};

export type CandidateArcInput = {
  context: NormalizedSpecContext;
  gap: NormalizedGap;
  prefixHash: string;
  stream: CandidateStreamName;
  ordinal: number;
  refX: number;
  refY: number;
  targets: SectionAxes;
  targetState: TargetState;
};

export function candidateKey(
  context: NormalizedSpecContext,
  gapIndex: number,
  prefixHash: string,
  stream: CandidateStreamName,
  ordinal: number,
): CandidateKey {
  return {
    specHash: context.specHash,
    seed: context.seed,
    gapIndex,
    prefixHash,
    stream,
    ordinal,
  };
}

export function candidateForOrdinal(
  context: NormalizedSpecContext,
  gapIndex: number,
  prefixHash: string,
  stream: CandidateStreamName,
  ordinal: number,
): CandidateArc {
  const gap = context.gaps[gapIndex];
  if (gap === undefined) {
    throw new Error(`gapIndex ${gapIndex} out of range`);
  }

  const key = candidateKey(context, gapIndex, prefixHash, stream, ordinal);
  const duration = Math.max(1, gap.endFrame - gap.startFrame);
  const baseX = gap.endFrame * START_X_PER_FRAME;
  const streamBias = streamBiasFor(stream);
  const length = randomRange(dim(key, 0), CALIB.ARC.LENGTH_MIN, CALIB.ARC.LENGTH_MAX)
    * streamBias.length;
  const startAngleDeg = randomRange(
    dim(key, 1),
    CALIB.ARC.START_ANGLE_MIN_DEG + streamBias.startAngleShift,
    CALIB.ARC.START_ANGLE_MAX_DEG + streamBias.startAngleShift,
  );
  const endAngleDeg = randomRange(
    dim(key, 2),
    CALIB.ARC.END_ANGLE_MIN_DEG + streamBias.endAngleShift,
    CALIB.ARC.END_ANGLE_MAX_DEG + streamBias.endAngleShift,
  );
  const segments = randomInt(dim(key, 3), CALIB.ARC.SEGMENTS_MIN, CALIB.ARC.SEGMENTS_MAX);
  const curveBias = randomRange(dim(key, 4), -1, 1);
  const anchorX = baseX + randomRange(
    dim(key, 5),
    CALIB.ARC.ANCHOR_X_OFFSET_MIN,
    CALIB.ARC.ANCHOR_X_OFFSET_MAX,
  );
  const anchorY = duration * 0.5 + randomRange(
    dim(key, 6),
    CALIB.ARC.ANCHOR_Y_OFFSET_MIN,
    CALIB.ARC.ANCHOR_Y_OFFSET_MAX,
  );

  const arc: Arc = {
    anchor: {
      x: roundToGrid(anchorX),
      y: roundToGrid(anchorY),
    },
    length: roundToGrid(clamp(length, CALIB.ARC.LENGTH_MIN, CALIB.ARC.LENGTH_MAX * 1.5)),
    startAngleDeg: roundToGrid(startAngleDeg),
    endAngleDeg: roundToGrid(endAngleDeg),
    segments,
    curveBias: roundToGrid(curveBias),
  };
  return {
    key,
    arc,
    geometryHash: stableHash(arc),
  };
}

export function stateAwareCandidateForOrdinal(input: CandidateArcInput): CandidateArc {
  const key = candidateKey(
    input.context,
    input.gap.index,
    input.prefixHash,
    input.stream,
    input.ordinal,
  );
  const arc = sampleArcParams(input, key);
  return {
    key,
    arc,
    geometryHash: stableHash(arc),
  };
}

export function firstNCandidates(
  context: NormalizedSpecContext,
  gapIndex: number,
  prefixHash: string,
  stream: CandidateStreamName,
  count: number,
): CandidateArc[] {
  const out: CandidateArc[] = [];
  for (let ordinal = 0; ordinal < count; ordinal++) {
    out.push(candidateForOrdinal(context, gapIndex, prefixHash, stream, ordinal));
  }
  return out;
}

const START_X_PER_FRAME = 0.4;
const COVERAGE_PREFIX_JITTER_START_ORDINAL = 1024;

function dim(key: CandidateKey, dimension: number) {
  return {
    seed: key.seed,
    purpose: "candidate",
    prefixHash: `${key.specHash}:${key.prefixHash}:${key.stream}`,
    gapIndex: key.gapIndex,
    ordinal: key.ordinal,
    dimension,
  };
}

function streamBiasFor(stream: CandidateStreamName): {
  length: number;
  startAngleShift: number;
  endAngleShift: number;
} {
  switch (stream) {
    case "coverage":
      return { length: 1, startAngleShift: 0, endAngleShift: 0 };
    case "quality":
      return { length: 1.1, startAngleShift: -5, endAngleShift: -2 };
    case "recovery":
      return { length: 0.9, startAngleShift: 8, endAngleShift: 4 };
    case "polish":
      return { length: 0.65, startAngleShift: -8, endAngleShift: -5 };
  }
}

const CATCH_TEMPLATES = [
  { startDelta: -8, end: 45, segments: 14, segmentLength: 34, lead: 9, offset: 13 },
  { startDelta: -8, end: 45, segments: 14, segmentLength: 34, lead: 9, offset: -4 },
  { startDelta: -8, end: 45, segments: 14, segmentLength: 34, lead: 9, offset: 4 },
  { startDelta: -8, end: 45, segments: 14, segmentLength: 34, lead: 9, offset: -8 },
  { startDelta: -3, end: 47, segments: 15, segmentLength: 33, lead: 3, offset: -6 },
  { startDelta: -3, end: 47, segments: 15, segmentLength: 33, lead: 3, offset: 7 },
  { startDelta: -3, end: 47, segments: 15, segmentLength: 33, lead: 3, offset: 4 },
  { startDelta: -3, end: 47, segments: 15, segmentLength: 33, lead: 3, offset: 13 },
  { startDelta: -10, end: 2, segments: 20, segmentLength: 30, lead: 17, offset: 13 },
  { startDelta: -10, end: 2, segments: 20, segmentLength: 30, lead: 17, offset: 4 },
  { startDelta: -10, end: 30, segments: 16, segmentLength: 35, lead: 1, offset: 16 },
  { startDelta: -12, end: 3, segments: 18, segmentLength: 26, lead: 12, offset: 10 },
  { startDelta: -7, end: 14, segments: 18, segmentLength: 46, lead: 13, offset: 13 },
  { startDelta: -5, end: 25, segments: 12, segmentLength: 35, lead: 8, offset: 0 },
  { startDelta: -15, end: -5, segments: 22, segmentLength: 28, lead: 16, offset: 8 },
  { startDelta: -10, end: 45, segments: 12, segmentLength: 40, lead: 12, offset: -10 },
] as const;

function sampleArcParams(input: CandidateArcInput, key: CandidateKey): Arc {
  if (shouldUseSteepCatch(input.targetState, input.gap) && input.ordinal < CATCH_TEMPLATES.length) {
    return sampleSteepCatchArc(input.targetState, CATCH_TEMPLATES[input.ordinal]);
  }
  if (shouldUseDenseShortCatch(input)) {
    return sampleDenseShortCatchArc(input, key);
  }
  if (input.stream === "coverage") {
    return sampleCoverageArcParams(input, key);
  }

  const A = CALIB.ARC;
  const streamBias = streamBiasFor(input.stream);
  const lengthRoll = randomFloat(dim(key, 10));
  const segRoll = randomFloat(dim(key, 11));
  const length = (A.LENGTH_MIN + lengthRoll * (A.LENGTH_MAX - A.LENGTH_MIN)) * streamBias.length;
  let segments: number;
  if (input.targets.grain !== undefined && segRoll < 0.7) {
    const targetSegLen = Math.max(3, input.targets.grain * CALIB.LINE_LENGTH_CAP);
    const jitter = Math.floor(segRoll * 3) - 1;
    const ideal = Math.round(length / targetSegLen) + jitter;
    segments = Math.max(A.SEGMENTS_MIN, Math.min(A.SEGMENTS_MAX, ideal));
  } else {
    segments = randomInt(dim(key, 12), A.SEGMENTS_MIN, A.SEGMENTS_MAX);
  }

  const startRoll = randomFloat(dim(key, 13));
  const endRoll = randomFloat(dim(key, 14));
  const curveRoll = randomFloat(dim(key, 15));
  const anchorXRoll = randomFloat(dim(key, 16));
  const anchorYRoll = randomFloat(dim(key, 17));
  const startAngleDeg = A.START_ANGLE_MIN_DEG + streamBias.startAngleShift
    + startRoll * (A.START_ANGLE_MAX_DEG - A.START_ANGLE_MIN_DEG);
  const endAngleDeg = A.END_ANGLE_MIN_DEG + streamBias.endAngleShift
    + endRoll * (A.END_ANGLE_MAX_DEG - A.END_ANGLE_MIN_DEG);
  const curveBias = -1 + 2 * curveRoll;
  const anchorXOffset = A.ANCHOR_X_OFFSET_MIN
    + anchorXRoll * (A.ANCHOR_X_OFFSET_MAX - A.ANCHOR_X_OFFSET_MIN);
  const anchorYOffset = A.ANCHOR_Y_OFFSET_MIN
    + anchorYRoll * (A.ANCHOR_Y_OFFSET_MAX - A.ANCHOR_Y_OFFSET_MIN);

  return {
    anchor: {
      x: roundToGrid(input.refX - length / 2 + anchorXOffset),
      y: roundToGrid(input.refY + anchorYOffset),
    },
    length: roundToGrid(clamp(length, A.LENGTH_MIN, A.LENGTH_MAX * 1.5)),
    startAngleDeg: roundToGrid(startAngleDeg),
    endAngleDeg: roundToGrid(endAngleDeg),
    segments,
    curveBias: roundToGrid(curveBias),
  };
}

function sampleCoverageArcParams(input: CandidateArcInput, key: CandidateKey): Arc {
  const A = CALIB.ARC;
  const steepTemplates = shouldUseSteepCatch(input.targetState, input.gap)
    ? CATCH_TEMPLATES.length
    : 0;
  const generalOrdinal = Math.max(0, input.ordinal - steepTemplates);
  const roll = (offset: number) => legacyCoverageRoll(input.context.seed, input.gap.index, generalOrdinal, offset);
  const jitterScale = input.ordinal < COVERAGE_PREFIX_JITTER_START_ORDINAL ? 0 : 1;

  const length = A.LENGTH_MIN + roll(0) * (A.LENGTH_MAX - A.LENGTH_MIN)
    + prefixJitter(key, 120, 0.001 * jitterScale);
  const segRoll = roll(1);
  let segments: number;
  if (input.targets.grain !== undefined && segRoll < 0.7) {
    const targetSegLen = Math.max(3, input.targets.grain * CALIB.LINE_LENGTH_CAP);
    const jitter = Math.floor(segRoll * 3) - 1;
    const ideal = Math.round(length / targetSegLen) + jitter;
    segments = Math.max(A.SEGMENTS_MIN, Math.min(A.SEGMENTS_MAX, ideal));
  } else {
    segments = A.SEGMENTS_MIN + Math.floor(segRoll * (A.SEGMENTS_MAX - A.SEGMENTS_MIN + 1));
  }

  const startAngleDeg = A.START_ANGLE_MIN_DEG
    + roll(2) * (A.START_ANGLE_MAX_DEG - A.START_ANGLE_MIN_DEG)
    + prefixJitter(key, 121, 0.001 * jitterScale);
  const endAngleDeg = A.END_ANGLE_MIN_DEG
    + roll(3) * (A.END_ANGLE_MAX_DEG - A.END_ANGLE_MIN_DEG)
    + prefixJitter(key, 122, 0.001 * jitterScale);
  const curveBias = -1 + 2 * roll(4) + prefixJitter(key, 123, 0.0001 * jitterScale);
  const anchorXOffset = A.ANCHOR_X_OFFSET_MIN
    + roll(5) * (A.ANCHOR_X_OFFSET_MAX - A.ANCHOR_X_OFFSET_MIN)
    + prefixJitter(key, 124, 0.001 * jitterScale);
  const anchorYOffset = A.ANCHOR_Y_OFFSET_MIN
    + roll(6) * (A.ANCHOR_Y_OFFSET_MAX - A.ANCHOR_Y_OFFSET_MIN)
    + prefixJitter(key, 125, 0.001 * jitterScale);

  return {
    anchor: {
      x: roundToGrid(input.refX - length / 2 + anchorXOffset),
      y: roundToGrid(input.refY + anchorYOffset),
    },
    length: roundToGrid(length),
    startAngleDeg: roundToGrid(startAngleDeg),
    endAngleDeg: roundToGrid(endAngleDeg),
    segments,
    curveBias: roundToGrid(curveBias),
  };
}

function legacyCoverageRoll(seed: number, gapIndex: number, ordinal: number, offset: number): number {
  const sequenceSeed = (seed | 0) * 1000003 + gapIndex + 1;
  return mulberry32At(sequenceSeed, ordinal * 7 + offset);
}

function mulberry32At(seed: number, index: number): number {
  const step = Math.max(0, Math.floor(index)) + 1;
  let s = (seed + Math.imul(0x6D2B79F5, step)) | 0;
  let t = Math.imul(s ^ (s >>> 15), 1 | s);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function prefixJitter(key: CandidateKey, dimension: number, amplitude: number): number {
  return (randomFloat(dim(key, dimension)) - 0.5) * 2 * amplitude;
}

function shouldUseDenseShortCatch(input: CandidateArcInput): boolean {
  const gapFrames = input.gap.endFrame - input.gap.startFrame;
  const dense = input.context.contactFrames.length * 40 > input.context.durationFrames;
  return dense
    && input.stream === "recovery"
    && gapFrames <= 16
    && ((input.targets.air ?? 0) >= 0.6 || (input.targets.contact_style ?? 1) <= 0.45);
}

function sampleDenseShortCatchArc(input: CandidateArcInput, key: CandidateKey): Arc {
  const length = 7 + randomFloat(dim(key, 30)) * 24;
  const segments = 1 + Math.floor(randomFloat(dim(key, 31)) * 3);
  const startAngleDeg = -8 + randomFloat(dim(key, 32)) * 36;
  const endAngleDeg = -12 + randomFloat(dim(key, 33)) * 28;
  const anchorXOffset = -length / 2 - 3 + randomFloat(dim(key, 34)) * 10;
  const anchorYOffset = -3 + randomFloat(dim(key, 35)) * 9;
  return {
    anchor: {
      x: roundToGrid(input.refX + anchorXOffset),
      y: roundToGrid(input.refY + anchorYOffset),
    },
    length: roundToGrid(length),
    startAngleDeg: roundToGrid(startAngleDeg),
    endAngleDeg: roundToGrid(endAngleDeg),
    segments,
    curveBias: roundToGrid(-0.25 + randomFloat(dim(key, 36)) * 0.5),
  };
}


function shouldUseSteepCatch(targetState: TargetState, gap: NormalizedGap): boolean {
  const gapFrames = gap.endFrame - gap.startFrame;
  return gapFrames >= 60 && (targetState.speed >= 10 || targetState.angleDeg >= 55);
}

function sampleSteepCatchArc(
  targetState: TargetState,
  template: typeof CATCH_TEMPLATES[number],
): Arc {
  const startAngleDeg = clamp(targetState.angleDeg + template.startDelta, 20, 88);
  const endAngleDeg = clamp(template.end, -15, 55);
  const angle = (startAngleDeg * Math.PI) / 180;
  const dx = Math.cos(angle);
  const dy = Math.sin(angle);
  const perpX = -dy;
  const perpY = dx;
  return {
    anchor: {
      x: roundToGrid(targetState.sledX - dx * template.lead + perpX * template.offset),
      y: roundToGrid(targetState.sledY - dy * template.lead + perpY * template.offset),
    },
    length: roundToGrid(template.segments * template.segmentLength),
    startAngleDeg: roundToGrid(startAngleDeg),
    endAngleDeg: roundToGrid(endAngleDeg),
    segments: template.segments,
    curveBias: 0,
  };
}
