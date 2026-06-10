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
  AXES, TARGET_AXES, AXIS_VALUE_MAX, CALIB, FPS, IMPACT, IMPACT_WINDOW, START_DEFAULTS, PREROLL,
  secToFrame,
  authoredSpeedToPx, speedPxToAuthored, elevationCeiling, impactCeiling,
} from "../types.ts";
import { measureGapAxes } from "./measure.ts";

export type ResolvedStart = {
  position: { x: number; y: number };
  velocity: { x: number; y: number };
};

export type GapFit = {
  /** Arc-backed candidates keep the source arc; line-native placement stores null. */
  arc: Arc | null;
  /** Source geometry family for diagnostics/reuse. Evaluation always uses `lines`. */
  geometry: "arc" | "lines";
  lines: TrackLine[];
  /** Achieved axis values for this gap (for the DriftReport). */
  achieved: AxisValues;
  /** Aggregate axis cost (lower = better fit). */
  cost: number;
  /** Rider speed at the post-catch release probe frame, in raw px/frame.
   *  Used by compiler rankers to set up the next contact's speed target. */
  releaseSpeed?: number;
  /** True when this fit was proposed by the enumerative proposer
   *  (optimizer/aim.ts). Telemetry only — never read by ranking. */
  aimed?: boolean;
  /** Rider vertical velocity at the post-catch release probe frame, in raw px/frame.
   *  Used by quality search to avoid launchy exits before tight/low-air contacts. */
  releaseVelocityY?: number;
  /** Grounded frames between the target contact and post-catch release probe.
   *  Diagnostic-only coverage signal for separating low-air/support futures. */
  releaseGroundedFrames?: number;
  /** Whether the sled is airborne at the post-catch release probe frame.
   *  Diagnostic-only coverage signal for release-state diversity. */
  releaseAirborne?: boolean;
  /** Sled reference position (lowest sled point) at the gap's landing frame
   *  when this catch was placed. Optional; set by `sampleOneCandidate`. Used to
   *  translate this catch's geometry to a different gap's entry state for
   *  catch-reuse on periodic specs (the geometry is sled-relative). */
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

export function meanSpeedPxOverRange(det: Detection, f0: number, f1: number): number | null {
  const b = Math.min(f1, measurementLastFrame(det));
  let sum = 0, n = 0;
  for (let f = f0; f <= b; f++) {
    const s = speedAt(det, f);
    if (s !== undefined) {
      sum += s;
      n++;
    }
  }
  return n > 0 ? sum / n : null;
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

/**
 * The `landing` event that registers a contact at `targetFrame`: the first (in
 * event order) within `tol` frames. This is the single definition of "the landing
 * for this beat" — `buildDriftReport`'s contact match and `measureImpact` share it
 * so the ±1 rule lives in one place. (The candidate gate in core/candidate.ts uses
 * a related but distinct check — *any* such landing that also fired an owned line —
 * and stays separate to avoid a measure↔candidate import cycle.)
 */
export function findLandingNearFrame(det: Detection, targetFrame: number, tol = 1): DetEvent | undefined {
  return det.events.find((e) => e.type === "landing" && Math.abs(e.frame - targetFrame) <= tol);
}

/**
 * LEGACY one-frame "normal impact speed" (px/frame, UNNORMALIZED): the magnitude of
 * the rider's PRE-impact velocity component perpendicular to the catch surface it
 * fired against, ÷ `CALIB.IMPACT_CAP`. This was the OLD impact metric; it is NO
 * LONGER the scored definition — landing intensity is now the velocity REDIRECTION
 * (`redirImpactPxAtLanding`, used by `measureImpact`/`buildDriftReport`/`inspect`).
 * Kept only as the comparison "point" baseline in the study harnesses
 * (`study_support.ts pointImpactPx`) and the study overlay's reference lane.
 *
 * `lineFor(id)` resolves a fired line id to its endpoints — the per-gap scored
 * reduction passes a resolver that returns ONLY this gap's owned lines (so a
 * stray foreign line firing at the same frame is ignored); the full-track
 * read-outs pass a resolver over all track lines. The surface tangent is the
 * average of the fired lines' unit tangents (robust to a multi-segment catch).
 * Returns `undefined` when there's no usable fired-line geometry or no velocity.
 */
export function normalImpactPxAtLanding(
  det: Detection,
  landingFrame: number,
  lineFor: (id: number) => { x1: number; y1: number; x2: number; y2: number } | undefined,
): number | undefined {
  let tx = 0, ty = 0;
  for (const id of contactLineIdsAt(det, landingFrame)) {
    const ln = lineFor(id);
    if (ln === undefined) continue;
    const dx = ln.x2 - ln.x1, dy = ln.y2 - ln.y1, len = Math.hypot(dx, dy);
    if (len > 1e-9) { tx += dx / len; ty += dy / len; }
  }
  const tl = Math.hypot(tx, ty);
  if (tl <= 1e-9) return undefined;
  tx /= tl; ty /= tl;
  // Pre-impact velocity (frame before the landing); fall back to the landing frame
  // only if that's out of range. lr-core's collision smears the velocity *change*
  // over several frames, so we read the incoming velocity, not a Δv.
  const vIn = velocityAt(det, landingFrame - 1) ?? velocityAt(det, landingFrame);
  if (vIn === undefined) return undefined;
  // |v ⊥ t̂| = |t̂.x·v.y − t̂.y·v.x| — the speed the surface kills.
  return Math.abs(tx * vIn.y - ty * vIn.x);
}

/**
 * Redirection impact (px/frame, UNNORMALIZED) of a landing: the peak magnitude of
 * the rider's CoM velocity component PERPENDICULAR to its incoming heading, over the
 * `window`-frame episode after the landing. This is "how hard the catch bends the
 * rider's path" ("claquage") — the felt landing intensity (callers divide by
 * `CALIB.REDIR_CAP` to normalize). It is the SINGLE production definition of impact,
 * shared by the scored reduction (`measureImpact`, core/measure.ts), the report
 * (`buildDriftReport`), the dashboard annotation (scripts/inspect.ts), and — by
 * delegation — the study harnesses' `redirPx` (scripts/v0/study_support.ts).
 *
 * CoM-velocity-only: unlike `normalImpactPxAtLanding` it needs NO catch-line tangent
 * or owned-line geometry, which makes it immune to sled rotation / limb whip (those
 * look violent but aren't felt) and cheap on the per-candidate hot path. The incoming
 * heading is the velocity one frame before the landing (the frame the rider arrives);
 * the perpendicular component grows as the surface turns the path. Uses the
 * offset-aware accessors so it is correct under `detectWindow`. Returns `undefined`
 * when there's no usable incoming velocity; `0` when the rider is essentially
 * stationary (no heading to redirect off of).
 */
export function redirImpactPxAtLanding(
  det: Detection,
  landingFrame: number,
  window: number = IMPACT_WINDOW,
): number | undefined {
  const v0 = velocityAt(det, landingFrame - 1) ?? velocityAt(det, landingFrame);
  if (v0 === undefined) return undefined;
  const speed = Math.hypot(v0.x, v0.y);
  if (speed <= 1e-9) return 0;
  const hx = v0.x / speed, hy = v0.y / speed;
  const end = Math.min(measurementLastFrame(det), landingFrame + Math.max(0, window));
  let peak = 0;
  for (let f = landingFrame; f <= end; f++) {
    const v = velocityAt(det, f);
    if (v === undefined) continue;
    // |v ⊥ ĥ| = |ĥ.x·v.y − ĥ.y·v.x| — lateral speed acquired off the incoming heading.
    const perp = Math.abs(hx * v.y - hy * v.x);
    if (perp > peak) peak = perp;
  }
  return peak;
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

type EngineLineCacheEntry = {
  id: number;
  type: number;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  flipped: boolean;
  leftExtended: boolean;
  rightExtended: boolean;
  // deno-lint-ignore no-explicit-any
  converted: any;
};

// lr-core Line objects snapshot TrackLine geometry at construction. The
// compiler rebuilds engines repeatedly from the same TrackLine objects, so keep
// the last converted geometry on the object without constructing a string key on
// every cache hit. If polish mutates any geometry field, the snapshot misses and
// is refreshed.
const ENGINE_LINE_CACHE = Symbol("engineLineCache");
type CachedTrackLine = TrackLine & { [ENGINE_LINE_CACHE]?: EngineLineCacheEntry };

// deno-lint-ignore no-explicit-any
export function engineLineFromTrackLine(line: TrackLine): any {
  const flipped = !!line.flipped;
  const leftExtended = !!line.leftExtended;
  const rightExtended = !!line.rightExtended;
  const cachedLine = line as CachedTrackLine;
  const cached = cachedLine[ENGINE_LINE_CACHE];
  if (
    cached !== undefined &&
    cached.id === line.id &&
    cached.type === line.type &&
    cached.x1 === line.x1 &&
    cached.y1 === line.y1 &&
    cached.x2 === line.x2 &&
    cached.y2 === line.y2 &&
    cached.flipped === flipped &&
    cached.leftExtended === leftExtended &&
    cached.rightExtended === rightExtended
  ) {
    return cached.converted;
  }

  const converted = createLineFromJson(line);
  cachedLine[ENGINE_LINE_CACHE] = {
    id: line.id,
    type: line.type,
    x1: line.x1,
    y1: line.y1,
    x2: line.x2,
    y2: line.y2,
    flipped,
    leftExtended,
    rightExtended,
    converted,
  };
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
    for (const key of TARGET_AXES) {
      const value = axes[key];
      if (value === undefined) continue;
      sums[key] += value;
      counts[key]++;
    }
  }

  const out: AxisValues = {};
  for (const key of TARGET_AXES) {
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
  for (const name of TARGET_AXES) {
    const v = spec.axes[name]?.(t);
    if (v !== undefined) axes[name] = v;
  }
  return axes;
}

/** Gravity used by the impact feasibility bound (matches the generation-side
 *  launch model, LAUNCH_GRAVITY_PX_PER_FRAME2 in arc_placement.ts). */
const IMPACT_BOUND_GRAVITY_PX_PER_FRAME2 = 0.175;

/**
 * DERIVED per-beat feasibility bound on the SCORED impact target (part of the
 * evaluator ruler — this function is inside the fingerprinted source slice).
 *
 * Impact is a velocity redirection: redir = v·sin(turn). The turn a catch can
 * deliver is bounded by pure ballistics around the beat:
 *   - arrival crossing angle: falling for at most the previous beat gap gives
 *     vy_in ≤ g·N_prev/2, so θ_in ≤ atan(g·N_prev/2 ÷ v);
 *   - exit allowance: the redirected motion must fit before the next beat,
 *     vy_out ≤ g·N_next/2, so θ_out ≤ atan(g·N_next/2 ÷ v);
 *   - catchability: total turn ≤ asin(CATCHABLE_REDIR_FRACTION) — beyond it the
 *     hit ejects (the impactCeiling bound).
 * bound = v·sin(min(θ_in+θ_out, asin(0.9))) / REDIR_CAP. In the small-angle
 * (dense-beat) regime this reduces to ≈ g·(N_prev+N_next)/2 / REDIR_CAP — the
 * total vertical-velocity budget around the beat — which is why dense grooves
 * physically cap near 0.45-0.5 regardless of speed. Validated against the
 * canonical-archive frontier: p95 achieved tracks this bound within a few
 * percent across density × speed strata (dense/fast bound 0.474 vs p95 0.480;
 * mixed 0.67 vs 0.66; sparse 0.85 vs 0.72 — stretch where the search has room).
 *
 * The scored target is min(authored, bound): authored impact keeps its absolute
 * musical meaning ("how hard the music wants this hit"); the ruler grades the
 * compiler on the hardest PHYSICAL version of that ask. The bound only ever
 * lowers targets — soft asks are untouched.
 */
export function impactFeasibilityBound(
  speedTarget: number | undefined,
  prevGapSeconds: number,
  nextGapSeconds: number,
): number {
  const v = Math.max(1, authoredSpeedToPx(speedTarget === undefined ? 0.55 : speedTarget));
  const g = IMPACT_BOUND_GRAVITY_PX_PER_FRAME2;
  const thetaIn = Math.atan2(g * Math.max(0, prevGapSeconds) * FPS / 2, v);
  const thetaOut = Math.atan2(g * Math.max(0, nextGapSeconds) * FPS / 2, v);
  const maxTurn = Math.min(thetaIn + thetaOut, Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION));
  return Math.max(0, Math.min(1, (v * Math.sin(maxTurn)) / CALIB.REDIR_CAP));
}

// ─────────── Cross-gap target sampling ───────────

export function sampleGapTargets(
  section: AxisValues,
  sigma: number,
  rng: () => number,
): AxisValues {
  const out: AxisValues = {};
  for (const name of TARGET_AXES) {
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
    if (c.impact !== undefined && (!Number.isFinite(c.impact) || c.impact < 0 || c.impact > 1)) {
      throw new Error(`Contact.impact (${c.impact}) at t=${c.t} out of [0, 1]`);
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
 * and bound-check each defined value. Axes outside TARGET_AXES are deliberately
 * skipped here, so authored `grain` curves are ignored instead of validated.
 */
function validateAxisCurves(spec: Spec): void {
  const durationFrames = secToFrame(spec.duration);
  for (const name of TARGET_AXES) {
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
  gapAxisTargets?: AxisValues[],
): DriftReport {
  const contacts: ContactReport[] = spec.contacts.map((c) => {
    const target = secToFrame(c.t);
    const matched = findLandingNearFrame(det, target, 1);
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
    const targets = gapAxisTargets?.[g.index] ?? effectiveAxes(g, spec);
    const achievedAll = measureGapAxes(det, g, f.lines, g.endFrame);
    const axes: GapAxisReport["axes"] = {};
    for (const name of AXES) {
      let t = targets[name];
      if (t === undefined) continue;
      const a = achievedAll[name];
      if (a === undefined) continue;
      if (name === "impact") {
        // Scored impact target = min(authored, derived feasibility bound).
        // Applied HERE (fingerprinted ruler authority) as well as at the
        // compiler's target resolution, so the two cannot drift apart.
        const nextContact = contactFrames.find((f) => f > g.endFrame);
        const nextGapSeconds = nextContact === undefined ? 1.5 : (nextContact - g.endFrame) / FPS;
        const prevGapSeconds = (g.endFrame - g.startFrame) / FPS;
        t = Math.min(t, impactFeasibilityBound(targets.speed, prevGapSeconds, nextGapSeconds));
      }
      axes[name] = { target: t, achieved: a, error: Math.abs(t - a) };
      if (name === "elevation") {
        const v0 = velocityAt(det, g.startFrame);
        const speed = v0 !== undefined ? Math.hypot(v0.x, v0.y) : 0;
        axes[name].ceiling = elevationCeiling(speed, g.endFrame - g.startFrame);
      }
      if (name === "impact") {
        // Speed entering the landing bounds the catchable redirection (you can't
        // acquire more perpendicular velocity than you carry, and beyond the
        // catchable ceiling the hit ejects). Use the speed at the contact frame.
        const vEnd = velocityAt(det, g.endFrame);
        const speed = vEnd !== undefined ? Math.hypot(vEnd.x, vEnd.y) : 0;
        axes[name].ceiling = impactCeiling(speed);
      }
      if (name === "speed") {
        const targetRaw = authoredSpeedToPx(t);
        const achievedRaw = authoredSpeedToPx(a);
        axes[name].raw = {
          unit: "px/frame",
          target: targetRaw,
          achieved: achievedRaw,
          error: Math.abs(targetRaw - achievedRaw),
        };
      }
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
  const speedPx = meanSpeedPxOverRange(det, f0, b);
  return speedPx !== null ? speedPxToAuthored(speedPx) : null;
}
