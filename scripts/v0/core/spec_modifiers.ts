import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  AXES,
  AXIS_VALUE_MAX,
  TARGET_AXES,
  type AxisCurves,
  type AxisName,
  type Curve,
  type Spec,
  type TargetAxisName,
} from "../types.ts";
import { median } from "./substrate.ts";

export type CalibrationSelection = {
  version: 1;
  enabled: boolean;
  selected: string;
  updatedAt?: string;
  sourceReport?: string;
};

export type CalibrationCandidate = {
  id: string;
  label: string;
  description?: string;
  apply: (spec: Spec) => Spec;
};

export type CalibrationObjective =
  | { kind: "global-score" }
  | {
      kind: "weighted";
      score?: number;
      axes?: Partial<Record<AxisName, number>>;
      distortionPenalty?: number;
    };

export type SpecCalibration = {
  candidates: CalibrationCandidate[];
  objective: CalibrationObjective;
};

export type AxisTargetAudit = {
  axis: AxisName | "impact";
  before: AxisStats;
  after: AxisStats;
  delta: AxisStats;
  changed_fraction: number;
};

export type AxisStats = {
  count: number;
  min: number | null;
  p50: number | null;
  max: number | null;
  mean: number | null;
  mean_abs: number | null;
};

export type ImpactBandAudit = {
  band: "soft" | "mid" | "hard";
  count: number;
  before: AxisStats;
  after: AxisStats;
  delta: AxisStats;
  changed_fraction: number;
};

export type TargetAudit = {
  axes: AxisTargetAudit[];
  impact_bands: ImpactBandAudit[];
  distortion: {
    changed_fraction: number;
    mean_abs_delta: number;
    max_abs_delta: number;
  };
};

export function defineCalibration(config: {
  candidates: CalibrationCandidate[];
  objective?: CalibrationObjective;
}): SpecCalibration {
  const candidates = dedupeCandidates(config.candidates);
  if (!candidates.some((c) => c.id === "identity")) {
    candidates.unshift(identity());
  }
  return {
    candidates,
    objective: config.objective ?? { kind: "global-score" },
  };
}

export function applyCalibrationSelection(
  baseSpec: Spec,
  calibration: SpecCalibration | undefined,
  moduleUrl: string,
): Spec {
  if (calibration === undefined) return baseSpec;
  const selection = readCalibrationSelection(calibrationSelectionPath(moduleUrl));
  if (selection === null || !selection.enabled || selection.selected === "identity") {
    return baseSpec;
  }
  const candidate = calibration.candidates.find((c) => c.id === selection.selected);
  if (candidate === undefined) return baseSpec;
  return candidate.apply(baseSpec);
}

export function readCalibrationSelection(path: string): CalibrationSelection | null {
  if (!existsSync(path)) return null;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as Partial<CalibrationSelection>;
    if (parsed.version !== 1) return null;
    if (typeof parsed.enabled !== "boolean" || typeof parsed.selected !== "string") return null;
    return {
      version: 1,
      enabled: parsed.enabled,
      selected: parsed.selected,
      ...(typeof parsed.updatedAt === "string" ? { updatedAt: parsed.updatedAt } : {}),
      ...(typeof parsed.sourceReport === "string" ? { sourceReport: parsed.sourceReport } : {}),
    };
  } catch {
    return null;
  }
}

export function calibrationSelectionPath(moduleUrlOrPath: string): string {
  const path = moduleUrlOrPath.startsWith("file:")
    ? fileURLToPath(moduleUrlOrPath)
    : resolve(moduleUrlOrPath);
  return resolve(dirname(path), `${path.split(/[\\/]/).pop()!.replace(/\.ts$/, "")}.calibration.json`);
}

export function identity(): CalibrationCandidate {
  return {
    id: "identity",
    label: "identity",
    description: "No modifier.",
    apply: cloneSpec,
  };
}

export function axisShift(axis: TargetAxisName, delta: number): CalibrationCandidate {
  const signed = signedLabel(delta);
  return {
    id: `${axis}.shift.${signed}`,
    label: `${axis} ${signed}`,
    description: `Shift ${axis} by ${signed}.`,
    apply: (spec) => mapAxis(spec, axis, (v) => v + delta),
  };
}

// Linear remap of an axis around `center` by `factor`: factor>1 expands (pushes
// values away from center), factor<1 compresses (pulls toward it). The verb is
// derived from the factor so the id/label can never disagree with the effect.
export function axisScale(axis: TargetAxisName, factor: number, center = 0.5): CalibrationCandidate {
  const verb = factor >= 1 ? "expand" : "compress";
  const dir = factor >= 1 ? "away from" : "toward";
  return {
    id: `${axis}.${verb}.${compactNumber(factor)}@${compactNumber(center)}`,
    label: `${axis} ${verb} ${compactNumber(factor)}x`,
    description: `Remap ${axis} ${dir} ${center}.`,
    apply: (spec) => mapAxis(spec, axis, (v) => center + (v - center) * factor),
  };
}

export function axisFloor(axis: TargetAxisName, floor: number): CalibrationCandidate {
  return {
    id: `${axis}.floor.${compactNumber(floor)}`,
    label: `${axis} floor ${compactNumber(floor)}`,
    description: `Raise ${axis} targets below ${floor}.`,
    apply: (spec) => mapAxis(spec, axis, (v) => Math.max(v, floor)),
  };
}

export function impactHighCompress(opts: {
  threshold: number;
  amount: number;
}): CalibrationCandidate {
  const threshold = opts.threshold;
  const amount = opts.amount;
  return {
    id: `impact.high-compress.t${compactNumber(threshold)}.a${compactNumber(amount)}`,
    label: `impact high -${compactNumber(amount)}`,
    description: `Compress authored impact above ${threshold}; low impacts are unchanged.`,
    apply: (spec) => mapImpact(spec, (v) => v <= threshold ? v : threshold + (v - threshold) * (1 - amount)),
  };
}

export function composeCalibration(
  id: string,
  label: string,
  candidates: CalibrationCandidate[],
  description?: string,
): CalibrationCandidate {
  return {
    id,
    label,
    description,
    apply: (spec) => candidates.reduce((current, candidate) => candidate.apply(current), spec),
  };
}

export function cloneSpec(spec: Spec): Spec {
  return {
    ...spec,
    contacts: spec.contacts.map((c) => ({ ...c })),
    axes: { ...spec.axes },
    ...(spec.music ? { music: structuredCloneSafe(spec.music) } : {}),
    ...(spec.camera ? { camera: structuredCloneSafe(spec.camera) } : {}),
    ...(spec.start ? { start: { ...spec.start } } : {}),
  };
}

export function auditTargetChanges(base: Spec, modified: Spec, samples = 800): TargetAudit {
  const axisAudits: AxisTargetAudit[] = [];
  const allDeltas: number[] = [];
  const sampleCount = Math.max(2, Math.trunc(samples));
  for (const axis of TARGET_AXES) {
    const values: Array<[number | null, number | null]> = [];
    for (let i = 0; i < sampleCount; i++) {
      const t = sampleCount === 1 ? 0 : (base.duration * i) / (sampleCount - 1);
      values.push([valueAt(base, axis, t), valueAt(modified, axis, t)]);
    }
    if (values.some(([a, b]) => a !== null || b !== null)) {
      axisAudits.push(axisAudit(axis, values));
      allDeltas.push(...pairedDeltas(values));
    }
  }

  const impactPairs = base.contacts.map((contact, index) => {
    const after = modified.contacts[index];
    return [
      numberOrNull(contact.impact),
      numberOrNull(after?.impact),
    ] as [number | null, number | null];
  }).filter(([a, b]) => a !== null || b !== null);
  if (impactPairs.length > 0) axisAudits.push(axisAudit("impact", impactPairs));
  allDeltas.push(...pairedDeltas(impactPairs));

  const impactBands: ImpactBandAudit[] = [
    impactBandAudit("soft", impactPairs.filter(([before]) => before !== null && before <= 0.3)),
    impactBandAudit("mid", impactPairs.filter(([before]) => before !== null && before > 0.3 && before < 0.7)),
    impactBandAudit("hard", impactPairs.filter(([before]) => before !== null && before >= 0.7)),
  ];

  return {
    axes: axisAudits,
    impact_bands: impactBands,
    distortion: {
      changed_fraction: allDeltas.length === 0 ? 0 : allDeltas.filter((d) => Math.abs(d) > 1e-9).length / allDeltas.length,
      mean_abs_delta: mean(allDeltas.map(Math.abs)),
      max_abs_delta: allDeltas.reduce((m, d) => Math.max(m, Math.abs(d)), 0),
    },
  };
}

function mapAxis(spec: Spec, axis: TargetAxisName, f: (v: number) => number): Spec {
  const out = cloneSpec(spec);
  const axes: AxisCurves = { ...out.axes };
  const curve = axes[axis];
  if (curve !== undefined) axes[axis] = wrapCurve(curve, axis, f);
  out.axes = axes;
  return out;
}

function mapImpact(spec: Spec, f: (v: number) => number): Spec {
  const out = cloneSpec(spec);
  out.contacts = out.contacts.map((contact) => {
    if (contact.impact === undefined) return contact;
    return { ...contact, impact: clampAxis("impact", f(contact.impact)) };
  });
  return out;
}

function wrapCurve(curve: Curve, axis: AxisName, f: (v: number) => number): Curve {
  const wrapped = ((t: number) => {
    const v = curve(t);
    return v === undefined ? undefined : clampAxis(axis, f(v));
  }) as Curve;
  if (curve.meta !== undefined) {
    Object.defineProperty(wrapped, "meta", {
      value: {
        ...curve.meta,
        points: curve.meta.points.map((p) => ({ ...p, v: clampAxis(axis, f(p.v)) })),
      },
      enumerable: false,
      configurable: true,
      writable: false,
    });
  }
  return wrapped;
}

function clampAxis(axis: AxisName, value: number): number {
  const hi = AXIS_VALUE_MAX[axis];
  return Math.max(0, Math.min(hi, value));
}

function valueAt(spec: Spec, axis: AxisName, t: number): number | null {
  const value = spec.axes?.[axis]?.(t);
  return numberOrNull(value);
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function axisAudit(axis: AxisName | "impact", values: Array<[number | null, number | null]>): AxisTargetAudit {
  const before = values.map(([v]) => v).filter((v): v is number => v !== null);
  const after = values.map(([, v]) => v).filter((v): v is number => v !== null);
  const deltas = values
    .filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null)
    .map(([a, b]) => b - a);
  return {
    axis,
    before: stats(before),
    after: stats(after),
    delta: stats(deltas),
    changed_fraction: deltas.length === 0 ? 0 : deltas.filter((d) => Math.abs(d) > 1e-9).length / deltas.length,
  };
}

function impactBandAudit(band: ImpactBandAudit["band"], pairs: Array<[number | null, number | null]>): ImpactBandAudit {
  const audit = axisAudit("impact", pairs);
  return {
    band,
    count: pairs.length,
    before: audit.before,
    after: audit.after,
    delta: audit.delta,
    changed_fraction: audit.changed_fraction,
  };
}

function pairedDeltas(values: Array<[number | null, number | null]>): number[] {
  return values
    .filter((pair): pair is [number, number] => pair[0] !== null && pair[1] !== null)
    .map(([before, after]) => after - before);
}

function stats(values: number[]): AxisStats {
  const finite = values.filter(Number.isFinite);
  if (finite.length === 0) {
    return { count: 0, min: null, p50: null, max: null, mean: null, mean_abs: null };
  }
  // min/max in one pass; median() does its own sort, so don't pre-sort a second copy.
  let min = finite[0], max = finite[0];
  for (const v of finite) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return {
    count: finite.length,
    min,
    p50: median(finite),
    max,
    mean: mean(finite),
    mean_abs: mean(finite.map(Math.abs)),
  };
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, v) => sum + v, 0) / values.length;
}

function dedupeCandidates(candidates: CalibrationCandidate[]): CalibrationCandidate[] {
  const seen = new Set<string>();
  const out: CalibrationCandidate[] = [];
  for (const candidate of candidates) {
    if (!candidate.id.trim()) throw new Error("calibration candidate id must not be empty");
    if (seen.has(candidate.id)) throw new Error(`duplicate calibration candidate id: ${candidate.id}`);
    seen.add(candidate.id);
    out.push(candidate);
  }
  return out;
}

function compactNumber(value: number): string {
  return Number(value.toFixed(4)).toString();
}

function signedLabel(value: number): string {
  return `${value >= 0 ? "+" : ""}${compactNumber(value)}`;
}

function structuredCloneSafe<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export const DEFAULT_CALIBRATION_CANDIDATES = [
  identity(),
  axisShift("speed", 0.03),
  axisShift("speed", 0.06),
  axisScale("speed", 1.08),
  axisFloor("air", 0.35),
  axisScale("elevation", 0.9),
  axisScale("amplitude", 0.9),
  impactHighCompress({ threshold: 0.4, amount: 0.1 }),
] satisfies CalibrationCandidate[];

export function axisNamesForAudit(): readonly AxisName[] {
  return AXES;
}
