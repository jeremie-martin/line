import type { TrackLine } from "../types.ts";

export type ArcKnobs = {
  /** Rotate the last third of the arc about the suffix joint, in degrees. */
  pitchDeg: number;
  /** Rotate the whole arc about its entry point, in degrees. */
  rotateDeg: number;
};

export type RiderArrivalState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  /** CoM velocity direction in degrees, positive = screen-down. */
  comAngleDeg: number | null;
  /** Sled TAIL->NOSE pose in degrees, positive = screen-down. */
  sledPoseDeg: number | null;
  /** Frame-to-frame sled-pose angular velocity in degrees/frame. */
  sledPoseRateDegPerFrame: number | null;
};

export type LinearModel = {
  coefficients: number[];
};

export type KnobSurfaceModel = {
  samples: Array<{ knobs: ArcKnobs; value: number }>;
};

export function rotateLinesAbout(
  lines: TrackLine[],
  pivot: { x: number; y: number },
  deg: number,
): TrackLine[] {
  if (deg === 0) return lines.map((line) => ({ ...line }));
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return lines.map((l) => {
    const dx1 = l.x1 - pivot.x;
    const dy1 = l.y1 - pivot.y;
    const dx2 = l.x2 - pivot.x;
    const dy2 = l.y2 - pivot.y;
    return {
      ...l,
      x1: pivot.x + dx1 * c - dy1 * s,
      y1: pivot.y + dx1 * s + dy1 * c,
      x2: pivot.x + dx2 * c - dy2 * s,
      y2: pivot.y + dx2 * s + dy2 * c,
    };
  });
}

/** Rotate the last ~third of the candidate's segments about that suffix's
 * first point. Positive = exit pitched down, screen +y. */
export function pitchExitLines(lines: TrackLine[], deg: number): TrackLine[] {
  if (lines.length === 0) return [];
  const m = Math.max(1, Math.ceil(lines.length / 3));
  const head = lines.slice(0, lines.length - m).map((line) => ({ ...line }));
  const tail = lines.slice(lines.length - m);
  const pivot = { x: tail[0].x1, y: tail[0].y1 };
  return [...head, ...rotateLinesAbout(tail, pivot, deg)];
}

/** Rotate the whole candidate about its entry point. */
export function rotateArcLines(lines: TrackLine[], deg: number): TrackLine[] {
  if (lines.length === 0) return [];
  return rotateLinesAbout(lines, { x: lines[0].x1, y: lines[0].y1 }, deg);
}

/** Apply whole-arc rotation first, then exit pitch. This is the knob order used
 * by the production proposer and the joint-model studies. */
export function applyArcKnobs(lines: TrackLine[], knobs: ArcKnobs): TrackLine[] {
  const rotated = knobs.rotateDeg === 0 ? lines.map((line) => ({ ...line })) : rotateArcLines(lines, knobs.rotateDeg);
  return knobs.pitchDeg === 0 ? rotated : pitchExitLines(rotated, knobs.pitchDeg);
}

export function additiveQuadraticFeatures(knobs: ArcKnobs): number[] {
  const p = knobs.pitchDeg;
  const r = knobs.rotateDeg;
  return [1, p, r, p * p, r * r];
}

export function jointQuadraticFeatures(knobs: ArcKnobs): number[] {
  const p = knobs.pitchDeg;
  const r = knobs.rotateDeg;
  return [1, p, r, p * p, p * r, r * r];
}

export function biquadraticFeatures(knobs: ArcKnobs): number[] {
  const p = knobs.pitchDeg / 9;
  const r = knobs.rotateDeg / 3;
  return [1, p, r, p * p, p * r, r * r, p * p * r, p * r * r, p * p * r * r];
}

export function predictLinearModel(model: LinearModel, features: readonly number[]): number {
  let y = 0;
  for (let i = 0; i < model.coefficients.length; i++) y += model.coefficients[i] * features[i];
  return y;
}

export function fitKnobSurfaceModel(rows: Array<{ knobs: ArcKnobs; value: number }>, minRows: number): KnobSurfaceModel | null {
  if (rows.length < minRows) return null;
  const samples = rows
    .filter((row) => Number.isFinite(row.value))
    .map((row) => ({ knobs: { ...row.knobs }, value: row.value }));
  return samples.length >= minRows ? { samples } : null;
}

export function predictKnobSurfaceModel(model: KnobSurfaceModel, knobs: ArcKnobs): number {
  const exact = surfaceValueAt(model.samples, knobs.pitchDeg, knobs.rotateDeg);
  if (exact !== null) return exact;

  const pitches = sortedUnique(model.samples.map((sample) => sample.knobs.pitchDeg));
  const rotates = sortedUnique(model.samples.map((sample) => sample.knobs.rotateDeg));
  if (pitches.length >= 2 && rotates.length >= 2) {
    const [p0, p1] = bounds(pitches, knobs.pitchDeg);
    const [r0, r1] = bounds(rotates, knobs.rotateDeg);
    const v00 = surfaceValueAt(model.samples, p0, r0);
    const v01 = surfaceValueAt(model.samples, p0, r1);
    const v10 = surfaceValueAt(model.samples, p1, r0);
    const v11 = surfaceValueAt(model.samples, p1, r1);
    if (v00 !== null && v01 !== null && v10 !== null && v11 !== null) {
      const pt = p1 === p0 ? 0 : (knobs.pitchDeg - p0) / (p1 - p0);
      const rt = r1 === r0 ? 0 : (knobs.rotateDeg - r0) / (r1 - r0);
      const lo = v00 * (1 - rt) + v01 * rt;
      const hi = v10 * (1 - rt) + v11 * rt;
      return lo * (1 - pt) + hi * pt;
    }
  }

  const center = surfaceValueAt(model.samples, 0, 0);
  const pitch = interpolateAxis(model.samples, "pitch", knobs.pitchDeg);
  const rotate = interpolateAxis(model.samples, "rotate", knobs.rotateDeg);
  if (center !== null && pitch !== null && rotate !== null) return pitch + rotate - center;
  return nearestSurfaceValue(model.samples, knobs);
}

function sortedUnique(xs: number[]): number[] {
  return [...new Set(xs.map((x) => x.toFixed(6)))].map(Number).sort((a, b) => a - b);
}

function bounds(xs: number[], x: number): [number, number] {
  let lo = xs[0];
  let hi = xs[xs.length - 1];
  for (const v of xs) {
    if (v <= x) lo = v;
    if (v >= x) {
      hi = v;
      break;
    }
  }
  return [lo, hi];
}

function surfaceValueAt(samples: Array<{ knobs: ArcKnobs; value: number }>, pitchDeg: number, rotateDeg: number): number | null {
  const sample = samples.find((s) =>
    s.knobs.pitchDeg.toFixed(6) === pitchDeg.toFixed(6) &&
    s.knobs.rotateDeg.toFixed(6) === rotateDeg.toFixed(6)
  );
  return sample?.value ?? null;
}

function interpolateAxis(
  samples: Array<{ knobs: ArcKnobs; value: number }>,
  axis: "pitch" | "rotate",
  value: number,
): number | null {
  const axisSamples = samples
    .filter((sample) => axis === "pitch" ? sample.knobs.rotateDeg === 0 : sample.knobs.pitchDeg === 0)
    .map((sample) => ({ x: axis === "pitch" ? sample.knobs.pitchDeg : sample.knobs.rotateDeg, value: sample.value }))
    .sort((a, b) => a.x - b.x);
  if (axisSamples.length === 0) return null;
  if (value <= axisSamples[0].x) return axisSamples[0].value;
  for (let i = 1; i < axisSamples.length; i++) {
    const a = axisSamples[i - 1];
    const b = axisSamples[i];
    if (value <= b.x) {
      const t = (value - a.x) / (b.x - a.x);
      return a.value * (1 - t) + b.value * t;
    }
  }
  return axisSamples[axisSamples.length - 1].value;
}

function nearestSurfaceValue(samples: Array<{ knobs: ArcKnobs; value: number }>, knobs: ArcKnobs): number {
  let best = samples[0];
  let bestD = Infinity;
  for (const sample of samples) {
    const dp = sample.knobs.pitchDeg - knobs.pitchDeg;
    const dr = sample.knobs.rotateDeg - knobs.rotateDeg;
    const d = dp * dp + dr * dr;
    if (d < bestD) {
      best = sample;
      bestD = d;
    }
  }
  return best.value;
}

export function fitLinearLeastSquares(
  rows: Array<{ features: readonly number[]; value: number }>,
  ridge = 1e-9,
): LinearModel | null {
  if (rows.length === 0) return null;
  const dim = rows[0].features.length;
  if (rows.length < dim) return null;
  const ata = Array.from({ length: dim }, () => Array.from({ length: dim }, () => 0));
  const atb = Array.from({ length: dim }, () => 0);
  for (const row of rows) {
    if (row.features.length !== dim || !Number.isFinite(row.value)) return null;
    for (let i = 0; i < dim; i++) {
      const fi = row.features[i];
      atb[i] += fi * row.value;
      for (let j = 0; j < dim; j++) ata[i][j] += fi * row.features[j];
    }
  }
  for (let i = 0; i < dim; i++) ata[i][i] += ridge;
  const coefficients = solveLinearSystem(ata, atb);
  return coefficients === null ? null : { coefficients };
}

function solveLinearSystem(aIn: number[][], bIn: number[]): number[] | null {
  const n = bIn.length;
  const a = aIn.map((row, i) => [...row, bIn[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-12) return null;
    if (pivot !== col) [a[pivot], a[col]] = [a[col], a[pivot]];
    const scale = a[col][col];
    for (let j = col; j <= n; j++) a[col][j] /= scale;
    for (let row = 0; row < n; row++) {
      if (row === col) continue;
      const f = a[row][col];
      if (f === 0) continue;
      for (let j = col; j <= n; j++) a[row][j] -= f * a[col][j];
    }
  }
  return a.map((row) => row[n]);
}
