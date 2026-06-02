/**
 * v0 substrate — pure, behavior-defining building blocks used by the handoff
 * compiler and optimizer helpers.
 *
 * These functions depend only on `../../lib/*` and `../types.ts`, so they carry
 * no compiler-only state.
 */

import { LineRiderEngine, createLineFromJson } from "../../lib/_lr_engine.ts";
import {
  type Detection, type DetEvent,
} from "../../lib/detector.ts";
import type { TrackJson } from "../../lib/primitive.ts";
import {
  type Spec, type AxisName, type AxisValues,
  type FrameSpanAxisName,
  type Arc, type TrackLine, type DriftReport, type Gap,
  type ContactReport, type GapAxisReport,
  AXES, AXIS_VALUE_MAX, CALIB, FPS, START_DEFAULTS, PREROLL, secToFrame,
} from "../types.ts";
import { measureGapAxes } from "./measure.ts";

export type ResolvedStart = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
};

export type GapFit = {
  arc: Arc;
  lines: TrackLine[];
  /** Achieved axis values for this gap (for the DriftReport). */
  achieved: AxisValues;
  /** Aggregate axis cost (lower = better fit). */
  cost: number;
  /** Sled reference position (lowest sled point) at the gap's landing frame
   *  when this catch was placed. Optional; set by `sampleOneCandidate`. Used to
   *  translate this catch's arc to a different gap's entry state for catch-reuse
   *  on periodic specs (the arc geometry is sled-relative). */
  ref?: { x: number; y: number };
};

type WindowDetection = Detection & { frameOffset?: number };

// ─────────── Gap ownership / windowed measurement helpers ───────────

/** Locate the index of the gap whose fit's `lines` contains the given id. */
export function findGapOwning(lineId: number, fits: (GapFit | null)[]): number {
  for (let i = 0; i < fits.length; i++) {
    const fit = fits[i];
    if (fit === null) continue;
    if (fit.lines.some((l) => l.id === lineId)) return i;
  }
  return -1;
}

export function frameOffset(det: Detection): number {
  return (det as WindowDetection).frameOffset ?? 0;
}

export function measurementIndex(det: Detection, frame: number): number {
  return frame - frameOffset(det);
}

export function measurementLastFrame(det: Detection): number {
  return frameOffset(det) + det.measurements.airborne.length - 1;
}

export function contactLineIdsAt(det: Detection, frame: number): number[] {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.contactLineIds[index] ?? [] : [];
}

export function airborneAt(det: Detection, frame: number): boolean | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.airborne[index] : undefined;
}

export function speedAt(det: Detection, frame: number): number | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.speed[index] : undefined;
}

export function velocityAt(det: Detection, frame: number): { x: number; y: number } | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.velocity[index] : undefined;
}

export function offBeatLandingEvents(det: Detection, contactFrames: number[]): DetEvent[] {
  return det.events.filter((e) =>
    e.type === "landing" && !contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1)
  );
}

export function addMissedContactRetryOwners(
  owners: Set<number>,
  det: Detection,
  gaps: Gap[],
  fits: (GapFit | null)[],
  contactFrames: number[],
): void {
  for (const frame of contactFrames) {
    const hasLanding = det.events.some((e) =>
      e.type === "landing" && Math.abs(e.frame - frame) <= 1
    );
    if (hasLanding) continue;

    const before = owners.size;
    addContactLineOwners(owners, det, fits, frame, 1);
    if (owners.size > before) continue;

    const nearest = nearestLanding(det, frame, 5);
    if (nearest !== null) {
      addContactLineOwners(owners, det, fits, nearest.frame, 0);
      if (owners.size > before) continue;
    }

    const gapIndex = gaps.findIndex((gap) => gap.endsWithContact && gap.endFrame === frame);
    if (gapIndex >= 0) owners.add(gapIndex);
  }
}

export function addContactLineOwners(
  owners: Set<number>,
  det: Detection,
  fits: (GapFit | null)[],
  frame: number,
  radius: number,
): void {
  for (let f = frame - radius; f <= frame + radius; f++) {
    for (const lineId of contactLineIdsAt(det, f)) {
      const owner = findGapOwning(lineId, fits);
      if (owner >= 0) owners.add(owner);
    }
  }
}

export function nearestLanding(det: Detection, frame: number, radius: number): DetEvent | null {
  let best: DetEvent | null = null;
  let bestDistance = Infinity;
  for (const event of det.events) {
    if (event.type !== "landing") continue;
    const distance = Math.abs(event.frame - frame);
    if (distance > radius || distance >= bestDistance) continue;
    best = event;
    bestDistance = distance;
  }
  return best;
}

// ─────────── Engine construction / line conversion ───────────

export function measureFitGrain(fit: GapFit): number {
  const lineLens = fit.lines.map((l) => Math.hypot(l.x2 - l.x1, l.y2 - l.y1));
  return lineLens.length > 0 ? Math.min(1, median(lineLens) / CALIB.LINE_LENGTH_CAP) : 0;
}

// lr-core Line objects snapshot TrackLine geometry at construction. The
// compiler rebuilds engines repeatedly from the same TrackLine objects; cache
// conversions by object plus geometry signature, while still invalidating
// whenever a polish mutates line endpoints.
// deno-lint-ignore no-explicit-any
export const engineLineCache = new WeakMap<TrackLine, Map<string, any>>();

// deno-lint-ignore no-explicit-any
export function engineLineFromTrackLine(line: TrackLine): any {
  const signature = engineLineSignature(line);
  let cachedBySignature = engineLineCache.get(line);
  if (cachedBySignature === undefined) {
    cachedBySignature = new Map();
    engineLineCache.set(line, cachedBySignature);
  }

  const cached = cachedBySignature.get(signature);
  if (cached !== undefined) return cached;

  const converted = createLineFromJson(line);
  cachedBySignature.set(signature, converted);
  return converted;
}

export function engineLineSignature(line: TrackLine): string {
  return [
    line.id,
    line.type,
    line.x1,
    line.y1,
    line.x2,
    line.y2,
    line.flipped ? 1 : 0,
    line.leftExtended ? 1 : 0,
    line.rightExtended ? 1 : 0,
  ].join("|");
}

// deno-lint-ignore no-explicit-any
export function makeBaseEngine(start: ResolvedStart): any {
  // lr-core engines are immutable; setStart returns a new instance.
  return new LineRiderEngine().setStart(start.position, start.velocity);
}

export function resolveStartState(spec: Spec): ResolvedStart {
  if (spec.start === undefined) {
    return {
      position: { ...START_DEFAULTS.POSITION },
      velocity: { ...START_DEFAULTS.VELOCITY },
    };
  }
  return {
    position: {
      x: spec.start.x ?? START_DEFAULTS.POSITION.x,
      y: spec.start.y ?? START_DEFAULTS.POSITION.y,
    },
    velocity: { x: spec.start.vx, y: spec.start.vy },
  };
}

// ─────────── Timeline slicing & per-gap effective axes ───────────

export function sliceTimeline(contactFrames: number[], durationFrames: number): Gap[] {
  const gaps: Gap[] = [];
  let idx = 0;
  let cursor = 0;
  for (const cf of contactFrames) {
    gaps.push({
      index: idx++,
      startFrame: cursor,
      endFrame: cf,
      endsWithContact: true,
      targets: {},
    });
    cursor = cf;
  }
  // Tail gap
  if (cursor < durationFrames) {
    gaps.push({
      index: idx,
      startFrame: cursor,
      endFrame: durationFrames,
      endsWithContact: false,
      targets: {},
    });
  }
  return gaps;
}

export function effectiveAxes(gap: Gap, spec: Spec): AxisValues {
  const sums = zeroAxisRecord();
  const counts = zeroAxisRecord();

  for (let frame = gap.startFrame; frame <= gap.endFrame; frame++) {
    const axes = axesAtFrame(frame, spec);
    for (const key of AXES) {
      const value = axes[key];
      if (value === undefined) continue;
      sums[key] += value;
      counts[key]++;
    }
  }

  const out: AxisValues = {};
  for (const key of AXES) {
    if (counts[key] > 0) out[key] = sums[key] / counts[key];
  }
  return out;
}

function zeroAxisRecord(): Record<AxisName, number> {
  const out = {} as Record<AxisName, number>;
  for (const name of AXES) out[name] = 0;
  return out;
}

export function axesAtFrame(frame: number, spec: Spec): AxisValues {
  const t = frame / FPS;
  // Evaluate each present axis curve at this frame's time.
  const axes: AxisValues = {};
  for (const name of AXES) {
    const v = spec.axes[name]?.(t);
    if (v !== undefined) axes[name] = v;
  }
  return axes;
}

// ─────────── Cross-gap target sampling ───────────

export function sampleGapTargets(
  section: AxisValues,
  sigma: number,
  rng: () => number,
): AxisValues {
  const out: AxisValues = {};
  for (const name of AXES) {
    const value = section[name];
    if (value !== undefined) out[name] = clamp(gauss(rng, value, sigma), 0, AXIS_VALUE_MAX[name]);
  }
  return out;
}

/** Box-Muller Gaussian; mean μ, stdev σ. */
export function gauss(rng: () => number, mu: number, sigma: number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mu + z * sigma;
}

export function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

// ─────────── Spec validation ───────────

export function validateSpec(spec: Spec): void {
  if (spec.duration <= 0) throw new Error("Spec.duration must be > 0");
  for (const c of spec.contacts) {
    if (c.t < 0 || c.t > spec.duration) {
      throw new Error(`Contact.t (${c.t}) out of [0, ${spec.duration}]`);
    }
  }
  validateAxisCurves(spec);
  validateStartSpec(spec.start);
  validatePreroll(spec.preroll);
  if (spec.jitter !== undefined && (!Number.isFinite(spec.jitter) || spec.jitter < 0)) {
    throw new Error(`Spec.jitter must be ≥0 (got ${spec.jitter})`);
  }
}

/**
 * Validate axis curves stay in range across the track. A curve is continuous,
 * so we sample it at every frame (the resolution the compiler actually sees)
 * and bound-check each defined value.
 */
function validateAxisCurves(spec: Spec): void {
  const durationFrames = secToFrame(spec.duration);
  for (const name of AXES) {
    const curve = spec.axes?.[name];
    if (curve === undefined) continue;
    const hi = AXIS_VALUE_MAX[name];
    for (let f = 0; f <= durationFrames; f++) {
      const v = curve(f / FPS);
      if (v === undefined) continue;
      if (!Number.isFinite(v) || v < 0 || v > hi) {
        throw new Error(`axes.${name} (${v}) at t=${(f / FPS).toFixed(3)}s out of [0, ${hi}]`);
      }
    }
  }
}

export function validateStartSpec(start: Spec["start"]): void {
  if (start === undefined) return;
  if (typeof start.vx !== "number" || typeof start.vy !== "number") {
    throw new Error("Spec.start must include numeric vx and vy");
  }
  const cap = START_DEFAULTS.VELOCITY_SANITY_CAP;
  for (const [k, v] of Object.entries(start) as [string, number][]) {
    if (!Number.isFinite(v)) {
      throw new Error(`Spec.start.${k} must be finite (got ${v})`);
    }
    if ((k === "vx" || k === "vy") && Math.abs(v) > cap) {
      throw new Error(`Spec.start.${k} (${v}) exceeds sanity cap ±${cap} px/frame`);
    }
  }
}

export function validatePreroll(preroll: Spec["preroll"]): void {
  if (preroll === undefined) return;
  if (!Number.isFinite(preroll) || preroll < 0) {
    throw new Error(`Spec.preroll must be ≥0 (got ${preroll})`);
  }
  if (preroll > PREROLL.MAX_S) {
    throw new Error(`Spec.preroll (${preroll}s) exceeds sanity cap ${PREROLL.MAX_S}s`);
  }
}

// ─────────── Track JSON assembly ───────────

export function buildTrackJson(
  lines: TrackLine[],
  durationFrames: number,
  start: ResolvedStart,
): TrackJson {
  return {
    label: "v0",
    creator: "line/v0",
    description: "v0 compiler output",
    duration: durationFrames,
    version: "6.2",
    audio: null,
    startPosition: { x: start.position.x, y: start.position.y },
    riders: [
      {
        startPosition: { x: start.position.x, y: start.position.y },
        startVelocity: { x: start.velocity.x, y: start.velocity.y },
        remountable: 1,
      },
    ],
    layers: [
      { id: 0, type: 0, name: "Base Layer", visible: true, editable: true, folderId: -1 },
    ],
    script: "",
    lines,
  };
}

// ─────────── DriftReport assembly ───────────

export function buildDriftReport(
  det: Detection, spec: Spec, gaps: Gap[],
  contactFrames: number[], durationFrames: number,
  gapFailures: number[],
  fits: (GapFit | null)[],
): DriftReport {
  const contacts: ContactReport[] = spec.contacts.map((c) => {
    const target = secToFrame(c.t);
    const matched = det.events.find(
      (e) => e.type === "landing" && Math.abs(e.frame - target) <= 1,
    );
    if (matched) {
      return { t_target: c.t, t_actual: matched.frame / FPS, frame_error: matched.frame - target, status: "hit" };
    }
    // No tight match — find nearest landing within 5 frames (drift) or report missing.
    const near = det.events
      .filter((e) => e.type === "landing")
      .map((e) => ({ e, d: Math.abs(e.frame - target) }))
      .sort((a, b) => a.d - b.d)[0];
    if (near && near.d <= 5) {
      return { t_target: c.t, t_actual: near.e.frame / FPS, frame_error: near.e.frame - target, status: "drift" };
    }
    return { t_target: c.t, t_actual: null, frame_error: null, status: "missing" };
  });

  // Per-gap achieved-vs-target axes. Each contact gap owns exactly one catch,
  // so there is no section-range fit-matching: the target is the gap's resolved
  // curve mean (`effectiveAxes`), the achieved is measured on the final track
  // (`measureGapAxes`) over that gap. Only axes actually targeted are reported.
  const gapReports: GapAxisReport[] = [];
  for (let j = 0; j < gaps.length; j++) {
    const g = gaps[j];
    const f = fits[j];
    if (!g.endsWithContact || f === null) continue;
    const targets = effectiveAxes(g, spec);
    const achievedAll = measureGapAxes(det, g, f.lines, g.endFrame);
    const axes: GapAxisReport["axes"] = {};
    for (const name of AXES) {
      const t = targets[name];
      if (t === undefined) continue;
      const a = achievedAll[name];
      if (a === undefined) continue;
      axes[name] = { target: t, achieved: a, error: Math.abs(t - a) };
    }
    const survived = det.terminus.frame >= g.endFrame
      || det.terminus.reason === "endOfSpec";
    gapReports.push({ gap_index: g.index, t_end: g.endFrame / FPS, survived, axes });
  }

  const off_beat_landings = det.events
    .filter((e) => e.type === "landing"
      && !contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1))
    .map((e) => ({ frame: e.frame }));

  return {
    contacts,
    gaps: gapReports,
    off_beat_landings,
    terminus: { frame: det.terminus.frame, reason: det.terminus.reason },
  };
}

export function measureAxisOverRange(
  det: Detection, f0: number, f1: number,
  axis: FrameSpanAxisName,
): number | null {
  const b = Math.min(f1, measurementLastFrame(det));
  if (axis === "air") {
    let air = 0, total = 0;
    for (let f = f0; f <= b; f++) {
      if (airborneAt(det, f)) air++;
      total++;
    }
    return total > 0 ? air / total : null;
  }
  // axis === "speed"
  let sum = 0, n = 0;
  for (let f = f0; f <= b; f++) {
    const s = speedAt(det, f);
    if (s !== undefined) { sum += s; n++; }
  }
  return n > 0 ? sum / n / CALIB.SPEED_CAP : null;
}
