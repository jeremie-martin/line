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
  AXES, TARGET_AXES, AXIS_VALUE_MAX, FPS, IMPACT, IMPACT_WINDOW, START_DEFAULTS, PREROLL,
  secToFrame,
  authoredSpeedToPx, elevationCeiling, impactCeiling, normImpact, wrapPi,
} from "../types.ts";
import { measureGapAxes, AXIS_MEASURE, type GapMeasureCtx } from "./measure.ts";

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
  /** Achieved axis values measured over the LOOKAHEAD window
   *  [gap.start, axisLookaheadEndFrame] — for air gaps this runs through the NEXT
   *  contact (core/candidate.ts axisLookaheadEndFrame), so the local feasibility
   *  ranker (axisCost) can prefer a catch that "keeps riding". This is the single
   *  ballistic measurement (engine through the arc, ballistic suffix past the exit). */
  achieved: AxisValues;
  /** Achieved axis values measured over the GAP window [gap.start, gap.endFrame] —
   *  the SAME window the true scorer uses (buildDriftReport `measureGapAxes(det, g,
   *  …, g.endFrame)`). For non-air gaps the lookahead window IS the gap window, so
   *  this equals `achieved` and is left undefined (read `achievedAtEnd ?? achieved`).
   *  Present only for air/lookahead gaps where the two windows differ. PURE ENGINE
   *  (gap.endFrame is inside the already-simulated prefix — zero ballistic, zero
   *  extra frames); it lets the objective leaf reproduce the true scorer's axis
   *  factor for committed gaps instead of scoring the wrong (lookahead) window. */
  achievedAtEnd?: AxisValues;
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
  /** PREDICTED-ARRIVAL (LR_RANK_PREDICT_ARRIVAL pool sort): the rider's full
   *  launch/exit state at the post-catch release probe frame, read off the SAME
   *  detection the candidate evaluation already ran (zero extra frames, zero
   *  RNG). Carries position+velocity (smoothed launch read, arc_probe.ts launch
   *  fix) so the quality ranker can propagate it BALLISTICALLY to the next
   *  contact instead of charging a probe ride. `frame` is the release frame the
   *  state was read at; `airborne` is whether the rider is in free flight at the
   *  release frame (the ranker's ballistic-validity gate); `grounded` is the
   *  grounded-frame count between catch and release (diagnostic — the catch
   *  contact itself is grounded, so this is normally ≥1 even for clean launches).
   *  Present ONLY when the predict flag is on; never set otherwise (flag-off path
   *  is bit-identical). */
  releaseArrivalState?: {
    frame: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    sledPoseDeg: number | null;
    sledPoseRateDegPerFrame: number | null;
    grounded: number;
    airborne: boolean;
  };
};

type GapFitOptionalFields = Pick<
  GapFit,
  | "achievedAtEnd"
  | "releaseSpeed"
  | "aimed"
  | "releaseVelocityY"
  | "releaseGroundedFrames"
  | "releaseAirborne"
  | "ref"
  | "releaseArrivalState"
>;

export function copyOptionalGapFitFields(
  fit: Partial<GapFitOptionalFields>,
  opts: { cloneObjects?: boolean } = {},
): Partial<GapFitOptionalFields> {
  const cloneObjects = opts.cloneObjects === true;
  const out: Partial<GapFitOptionalFields> = {};
  if (fit.achievedAtEnd !== undefined) {
    out.achievedAtEnd = cloneObjects ? { ...fit.achievedAtEnd } : fit.achievedAtEnd;
  }
  if (fit.releaseSpeed !== undefined) out.releaseSpeed = fit.releaseSpeed;
  if (fit.aimed !== undefined) out.aimed = fit.aimed;
  if (fit.releaseVelocityY !== undefined) out.releaseVelocityY = fit.releaseVelocityY;
  if (fit.releaseGroundedFrames !== undefined) out.releaseGroundedFrames = fit.releaseGroundedFrames;
  if (fit.releaseAirborne !== undefined) out.releaseAirborne = fit.releaseAirborne;
  if (fit.ref !== undefined) out.ref = cloneObjects ? { ...fit.ref } : fit.ref;
  if (fit.releaseArrivalState !== undefined) {
    out.releaseArrivalState = cloneObjects ? { ...fit.releaseArrivalState } : fit.releaseArrivalState;
  }
  return out;
}

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

export function positionAt(det: Detection, frame: number): { x: number; y: number } | undefined {
  const index = measurementIndex(det, frame);
  return index >= 0 ? det.measurements.position[index] : undefined;
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
 * Redirection ARC `redirArc = v·Δθ` (px/frame, UNNORMALIZED) — the SCORED production
 * definition of impact (LOCKED 2026-06-14). `v` = incoming CoM speed; `Δθ` = net heading
 * change of the CoM velocity over the `window`-frame (~0.15s) episode after the landing.
 * It is the arc the velocity vector sweeps as the surface bends the path — speed-weighted
 * ("at speed hits harder") with no sin-compression of the biggest slams (which is why it
 * beats `redir` and generalizes where the force metric overfit; see
 * docs/impact_problem_statement.md). Callers normalize via `normImpact` (types.ts).
 *
 * CoM-velocity-only (immune to sled rotation / limb whip), needs no catch-line geometry,
 * cheap on the hot path. The incoming heading is the velocity one frame before the landing;
 * `Δθ` is the net (last in-window frame) wrapped angle from it. Shared by the scored
 * reduction (`measureImpact`), the report, the dashboard, and — by delegation — the study
 * harnesses' `redirArcPx`. `undefined` when no incoming velocity; `0` when ~stationary.
 */
export function redirArcPxAtLanding(
  det: Detection,
  landingFrame: number,
  window: number = IMPACT_WINDOW,
): number | undefined {
  const v0 = velocityAt(det, landingFrame - 1) ?? velocityAt(det, landingFrame);
  if (v0 === undefined) return undefined;
  const speed = Math.hypot(v0.x, v0.y);
  if (speed <= 1e-9) return 0;
  const aIn = Math.atan2(v0.y, v0.x);
  const end = Math.min(measurementLastFrame(det), landingFrame + Math.max(0, window));
  let turn = 0;
  for (let f = landingFrame; f <= end; f++) {
    const v = velocityAt(det, f);
    if (v === undefined) continue;
    turn = Math.abs(wrapPi(Math.atan2(v.y, v.x) - aIn)); // net heading change at the last valid in-window frame
  }
  return speed * turn;
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
 * DERIVED per-beat diagnostic for the scored impact request (part of the
 * evaluator report — this function is inside the fingerprinted source slice).
 *
 * Impact is the redirection arc: redirArc = v·Δθ. The turn a catch can
 * deliver is bounded by pure ballistics around the beat:
 *   - arrival crossing angle: falling for at most the previous beat gap gives
 *     vy_in ≤ g·N_prev/2, so θ_in ≤ atan(g·N_prev/2 ÷ v);
 *   - exit allowance: the redirected motion must fit before the next beat,
 *     vy_out ≤ g·N_next/2, so θ_out ≤ atan(g·N_next/2 ÷ v);
 *   - catchability: total turn ≤ asin(CATCHABLE_REDIR_FRACTION) — beyond it the
 *     hit ejects (the impactCeiling bound).
 * bound = normImpact(v·min(θ_in+θ_out, asin(0.9))). In the small-angle
 * (dense-beat) regime the redirArc reduces to ≈ g·(N_prev+N_next)/2 — the
 * total vertical-velocity budget around the beat — which is why dense grooves
 * physically cap near 0.45-0.5 regardless of speed. Validated against the
 * canonical-archive frontier: p95 achieved tracks this bound within a few
 * percent across density × speed strata (dense/fast bound 0.474 vs p95 0.480;
 * mixed 0.67 vs 0.66; sparse 0.85 vs 0.72 — stretch where the search has room).
 *
 * This estimate is diagnostic only. Authored impact keeps its absolute musical
 * meaning ("how hard the music wants this hit") in both optimization and scoring;
 * a bound below the request describes a difficult or inconsistent ask without
 * silently rewriting it.
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
  return normImpact(v * maxTurn); // redirArc = v·Δθ, felt-anchored normalization
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
  validateCameraSpec(spec.camera, spec.duration);
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

function validateCameraSpec(camera: Spec["camera"], duration: number): void {
  if (camera?.zoom === undefined) return;
  const lane = camera.zoom;
  if (!Array.isArray(lane.keyframes) || lane.keyframes.length === 0) {
    throw new Error("Spec.camera.zoom.keyframes must contain at least one keyframe");
  }
  if (
    lane.smoothingFrames !== undefined &&
    (!Number.isInteger(lane.smoothingFrames) || lane.smoothingFrames < 0)
  ) {
    throw new Error(`Spec.camera.zoom.smoothingFrames must be an integer ≥0 (got ${lane.smoothingFrames})`);
  }
  for (const point of lane.keyframes) {
    if (!Number.isFinite(point.t) || point.t < 0 || point.t > duration) {
      throw new Error(`Spec.camera.zoom keyframe t (${point.t}) out of [0, ${duration}]`);
    }
    if (!Number.isFinite(point.zoom) || point.zoom <= 0) {
      throw new Error(`Spec.camera.zoom keyframe zoom (${point.zoom}) at t=${point.t} must be > 0`);
    }
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
      axes[name] = { target: t, achieved: a, error: Math.abs(t - a) };
      if (name === "elevation") {
        const v0 = velocityAt(det, g.startFrame);
        const speed = v0 !== undefined ? Math.hypot(v0.x, v0.y) : 0;
        axes[name].ceiling = elevationCeiling(speed, g.endFrame - g.startFrame);
      }
      if (name === "impact") {
        const nextContact = contactFrames.find((frame) => frame > g.endFrame);
        const nextGapSeconds = nextContact === undefined ? 1.5 : (nextContact - g.endFrame) / FPS;
        const prevGapSeconds = (g.endFrame - g.startFrame) / FPS;
        axes[name].feasibility_bound = impactFeasibilityBound(
          targets.speed,
          prevGapSeconds,
          nextGapSeconds,
        );
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
  // Route through the single AXIS_MEASURE registry (measure.ts) rather than
  // hand-inlining a third copy of the air/speed reductions. The span reductions
  // read only `gap.startFrame` and `rangeEndFrame` and clamp the end to
  // `measurementLastFrame` identically, so this is byte-identical to the former
  // inline `if (axis === "air") … else speed` branch.
  const ctx: GapMeasureCtx = {
    det,
    gap: { startFrame: f0 } as Gap,
    gapLines: [],
    rangeEndFrame: f1,
  };
  return AXIS_MEASURE[axis](ctx) ?? null;
}
