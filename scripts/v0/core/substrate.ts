/**
 * v0 substrate — pure, behavior-defining building blocks shared by the legacy
 * compiler (`../compile.ts`) and the LDS optimizer (`../optimizer/*`).
 *
 * This module is a pure MOVE of a cluster of helpers that previously lived in
 * `../compile.ts`. The dependency direction is one-way: `compile.ts` imports
 * from here, never the reverse. These functions depend only on `../../lib/*`
 * and `../types.ts`, so they carry no compiler-only state.
 */

import { LineRiderEngine, createLineFromJson } from "../../lib/_lr_engine.ts";
import {
  type Detection, type DetEvent,
} from "../../lib/detector.ts";
import type { TrackJson } from "../../lib/primitive.ts";
import {
  type Spec, type SectionAxes,
  type Arc, type TrackLine, type DriftReport, type Gap,
  type ContactReport, type SectionReport,
  CALIB, FPS, START_DEFAULTS, PREROLL, secToFrame,
} from "../types.ts";

export type ResolvedStart = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
};

export type GapFit = {
  arc: Arc;
  lines: TrackLine[];
  /** Achieved axis values for this gap (for the DriftReport). */
  achieved: SectionAxes;
  /** Aggregate axis cost (lower = better fit). */
  cost: number;
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

export function effectiveAxes(gap: Gap, spec: Spec): SectionAxes {
  const sums: Record<keyof SectionAxes, number> = {
    air: 0,
    speed: 0,
    contact_style: 0,
    grain: 0,
  };
  const counts: Record<keyof SectionAxes, number> = {
    air: 0,
    speed: 0,
    contact_style: 0,
    grain: 0,
  };

  for (let frame = gap.startFrame; frame <= gap.endFrame; frame++) {
    const axes = axesAtFrame(frame, spec);
    for (const key of ["air", "speed", "contact_style", "grain"] as const) {
      const value = axes[key];
      if (value === undefined) continue;
      sums[key] += value;
      counts[key]++;
    }
  }

  const out: SectionAxes = {};
  for (const key of ["air", "speed", "contact_style", "grain"] as const) {
    if (counts[key] > 0) out[key] = sums[key] / counts[key];
  }
  return out;
}

export function axesAtFrame(frame: number, spec: Spec): SectionAxes {
  const t = frame / FPS;
  const axes: SectionAxes = { ...(spec.defaults ?? {}) };
  for (const sec of spec.sections) {
    if (sec.t0 > t || sec.t1 < t) continue;
    if (sec.air !== undefined) axes.air = sec.air;
    if (sec.speed !== undefined) axes.speed = sec.speed;
    if (sec.contact_style !== undefined) axes.contact_style = sec.contact_style;
    if (sec.grain !== undefined) axes.grain = sec.grain;
  }
  return axes;
}

// ─────────── Cross-gap target sampling ───────────

export function sampleGapTargets(
  section: SectionAxes,
  sigma: number,
  rng: () => number,
): SectionAxes {
  const out: SectionAxes = {};
  if (section.air !== undefined)           out.air = clamp(gauss(rng, section.air, sigma), 0, 0.99);
  if (section.speed !== undefined)         out.speed = clamp(gauss(rng, section.speed, sigma), 0, 1);
  if (section.contact_style !== undefined) out.contact_style = clamp(gauss(rng, section.contact_style, sigma), 0, 1);
  if (section.grain !== undefined)         out.grain = clamp(gauss(rng, section.grain, sigma), 0, 1);
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
  for (const s of spec.sections) {
    if (s.t0 < 0 || s.t1 > spec.duration || s.t0 >= s.t1) {
      throw new Error(`Section [${s.t0}, ${s.t1}] invalid for duration ${spec.duration}`);
    }
    if (s.air !== undefined && (s.air < 0 || s.air > 0.99)) {
      throw new Error(`Section.air (${s.air}) out of [0, 0.99]`);
    }
    for (const k of ["speed", "contact_style", "grain"] as const) {
      const v = s[k];
      if (v !== undefined && (v < 0 || v > 1)) {
        throw new Error(`Section.${k} (${v}) out of [0, 1]`);
      }
    }
  }
  validateStartSpec(spec.start);
  validatePreroll(spec.preroll);
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

  const sections: SectionReport[] = spec.sections.map((sec, i) => {
    const f0 = secToFrame(sec.t0);
    const f1 = secToFrame(sec.t1);
    const survived = det.terminus.frame >= f1
      || det.terminus.reason === "endOfSpec";

    // Per-gap fits whose end-Contact falls in this section's frame range.
    // Used for axes that are most cleanly measured per-gap and then
    // aggregated (grain, contact_style).
    const fitsInSection: GapFit[] = [];
    for (let j = 0; j < gaps.length; j++) {
      const g = gaps[j];
      const f = fits[j];
      if (!g.endsWithContact || f === null) continue;
      if (g.endFrame >= f0 && g.endFrame <= f1) fitsInSection.push(f);
    }

    const achieved: SectionReport["axes"] = {};

    // air, speed: measured directly from the final-track simulation over the
    // section's frame range (rider-state axes).
    for (const k of ["air", "speed"] as const) {
      const t = sec[k];
      if (t === undefined) continue;
      const av = measureAxisOverRange(det, f0, f1, k);
      if (av !== null) achieved[k] = { target: t, achieved: av, error: Math.abs(t - av) };
    }

    if (sec.grain !== undefined) {
      const vals = fitsInSection.map(measureFitGrain);
      if (vals.length > 0) {
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        achieved.grain = { target: sec.grain, achieved: m, error: Math.abs(sec.grain - m) };
      }
    }

    if (sec.contact_style !== undefined) {
      const vals: number[] = [];
      for (const f of fitsInSection) {
        const v = f.achieved.contact_style;
        if (v !== undefined) vals.push(v);
      }
      if (vals.length > 0) {
        const m = vals.reduce((a, b) => a + b, 0) / vals.length;
        achieved.contact_style = {
          target: sec.contact_style,
          achieved: m,
          error: Math.abs(sec.contact_style - m),
        };
      }
    }

    return { section_index: i, survived, axes: achieved };
  });

  const off_beat_landings = det.events
    .filter((e) => e.type === "landing"
      && !contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1))
    .map((e) => ({ frame: e.frame }));

  return {
    contacts,
    sections,
    off_beat_landings,
    terminus: { frame: det.terminus.frame, reason: det.terminus.reason },
  };
}

export function measureAxisOverRange(
  det: Detection, f0: number, f1: number,
  axis: "air" | "speed",
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
