/**
 * Target-state arc placement.
 *
 * This file intentionally keeps only the reliable part of the former placement
 * stack: reading the rider state at the target beat. Geometry generation starts
 * from that state, emits one small line-native catch fragment, and lets
 * `core/candidate.ts` validate landing, survival, off-beat behavior, and axis
 * quality in the engine.
 */

import { appendSledPointPositionsRangeMetered, getRiderMetered } from "../lib/detector.ts";
import { registerCompileReset } from "./core/compile_lifecycle.ts";
import { makeSolidLine } from "./arc.ts";
import {
  CALIB,
  CANDIDATE_SAMPLE_MODES,
  FPS,
  IMPACT,
  type ArcPlacementCounter,
  type ArcPlacementMode,
  type AxisValues,
  type CandidateSampleMode,
  type CompileStats,
  type Gap,
  type TrackLine,
  authoredSpeedToPx,
  elevationToLaunchVy,
  impactCeiling,
  impactToRedirArcPx,
  normImpact,
} from "./types.ts";

const SLED_POINTS = ["PEG", "TAIL", "NOSE", "STRING"] as const;

const GEOMETRY_RNG_DRAWS = 7;
const CONTACT_POINT_JITTER = 3.5;
const TARGET_GRAIN_LINE_LENGTH_PX = 49;
const PLACEMENT_SPEED_SPAN_PX = authoredSpeedToPx(1) - authoredSpeedToPx(0);
const PLACEMENT_SPEED_MIN_PX = authoredSpeedToPx(0);
const PRE_TARGET_PRECLEAR_DISTANCE = 2.5;
const SEGMENT_COLLISION_RISK_STRIDE = 7;
const TARGET_STATE_PRE_LENGTH_PRECLEAR_REDUCTION = 0.88;
const TARGET_STATE_POST_TARGET_BLEND = 0.72;
const TARGET_STATE_POST_GROUND_ROOM_BASE = 0.72;
const TARGET_STATE_POST_GROUND_ROOM_DENSE_REDUCTION = 0.22;
const TARGET_STATE_POST_SAMPLE_SPEED_REDUCTION = 0.34;
const TARGET_STATE_POST_SAMPLE_BRAKE_REDUCTION = 0.18;
const TARGET_STATE_POST_STARTUP_SAMPLE_REDUCTION = 0.28;
const TARGET_STATE_POST_SAFE_CAP_BASE = 0.34;
const TARGET_STATE_POST_SAFE_CAP_LOW_AIR_BONUS = 0.26;
const TARGET_STATE_POST_SAFE_CAP_DENSE_PENALTY = 0.08;
const TARGET_STATE_POST_SAFE_CAP_SPEED_REDUCTION = 0.30;
const TARGET_STATE_POST_SAFE_CAP_BRAKE_REDUCTION = 0.18;
const TARGET_STATE_POST_SAFE_CAP_STARTUP_REDUCTION = 0.30;
const TARGET_STATE_POST_MIN_TARGET_PX = 18;
const TARGET_STATE_POST_UNBOUNDED_CAP_PX = 220;
const TARGET_STATE_POST_MAX_CAP_PX = 260;
const TARGET_STATE_POST_MIN_CAP_PX = 14;
const TARGET_STATE_POST_BASE_FLOOR_HIGH_PX = 18;
const TARGET_STATE_POST_BASE_FLOOR_LOW_PX = 8;
const TARGET_STATE_POST_STARTUP_FLOOR_LOW_AIR_BONUS = 10;

// ── work-new contact-centered line family (energy-launch + air-length + 2D span) ──
// Ported from the work-new compiler (HEADLINE 579), whose `continuous` mode routed
// every NORMAL contact through this family. It is the principled trajectory-shaping
// generator the target_state rewrite simplified away: the post-contact launch angle
// is derived from energy conservation so the track UNDULATES to hit the speed target,
// the grounded ride-out length is sized to hit the air target, and both are SPANNED
// across the per-gap attempt batch (the cost-sorted handoff keeps the best valid
// catch) — that span is the generation diversity the search lacked.
// DEFAULT family. The old target_state A/B gate was removed after this family
// became the accepted production normal stream.
//
// SPEED_AXIS pressure/carry breakpoints are inlined here as locals because the
// SPEED_AXIS object lives inside the fingerprint-hashed types.ts slice and must not
// change. speedAuthoredBreakpointToPx is an alias of authoredSpeedToPx on work-new.
const CC_PRESSURE_START_PX = 7.8;
const CC_PRESSURE_SPAN_PX = 6.6;
const CC_CARRY_START_PX = authoredSpeedToPx(0.55);
const CC_CARRY_SPAN_PX = authoredSpeedToPx(0.95) - authoredSpeedToPx(0.55);
const CC_CARRY_FADE_START_PX = authoredSpeedToPx(0.78);
const CC_CARRY_FADE_SPAN_PX = authoredSpeedToPx(0.90) - authoredSpeedToPx(0.78);
// Impact carrier tuning is fixed in production; study harnesses should test
// alternate constants explicitly rather than relying on ambient compiler env.
const CONTACT_CENTERED_POINT_JITTER = 4;
const CONTACT_CENTERED_GUIDED_DECAY_ATTEMPTS = 4;
const CONTACT_CENTERED_GUIDED_ROLL_SPREAD = 0.18;
const CONTACT_CENTERED_GUIDED_POINT_SPREAD = 0.08;
// The old one-frame impact contact-angle / lip / dense-mature steering constants
// were removed when impact became the windowed redirection metric (the analytic
// one-frame steering was neutralized — see the call sites below). Recover from git
// (commit d3e4973^) if a redir-aware steering follow-up wants them as a starting
// point.
const CONTACT_CENTERED_REDIR_CONTACT_SHIFT_MAX_DEG = 4;
// NOTE (2026-06-10): widening these target ramps to the envelope-ruler ask
// distribution (0.25/0.40, matching IMPACT_CURVE) was TESTED and REGRESSED
// (canonical 578.15 vs 580.83) with zero movement in selected geometry — the
// angle-shift mechanisms are marginal (ablations: ±2); the curvature modulation
// below is the carrier (+53). Don't re-widen without new evidence.
const CONTACT_CENTERED_REDIR_CONTACT_TARGET_START = 0.55;
const CONTACT_CENTERED_REDIR_CONTACT_TARGET_SPAN = 0.35;
const CONTACT_CENTERED_REDIR_CONTACT_SPEED_START_PX = 6;
const CONTACT_CENTERED_REDIR_CONTACT_SPEED_SPAN_PX = 4;
const CONTACT_CENTERED_REDIR_CONTACT_BUDGET_START_FRAMES = 125_000;
const CONTACT_CENTERED_REDIR_CONTACT_BUDGET_SPAN_FRAMES = 75_000;
const CONTACT_CENTERED_REDIR_ENTRY_SHIFT_MAX_DEG = 10;
const CONTACT_CENTERED_REDIR_ENTRY_TARGET_START = 0.30;
const CONTACT_CENTERED_REDIR_ENTRY_TARGET_SPAN = 0.25;
const CONTACT_CENTERED_REDIR_ENTRY_BUDGET_START_FRAMES = 125_000;
const CONTACT_CENTERED_REDIR_ENTRY_BUDGET_SPAN_FRAMES = 50_000;
// Impact-driven post-contact CURVATURE. The redir metric rewards
// the catch surface ROTATING the CoM velocity through the ~6-frame window
// (empirically: achieved impact ≈ turnNetDeg ρ0.98, driven by tangentChangeDeg +
// tangentDeltaDeg; catchability is NOT the limiter up to ~36° turn). The shipped ±4°
// contact-angle nudge moves the contact INSTANT, not the through-window rotation, so it
// leaves achieved impact flat. This third modulation (alongside elevation/amplitude)
// instead drives the SUSTAINED curvature: it flattens the contact angle into a scoop
// (raises tangentDelta), FRONT-LOADS the contact→post rotation into the window (negative
// curveBias), and overrides the high-budget curvature fade for impact beats. RNG-neutral
// (curvature uses the deterministic low-discrepancy roll, not the rng() stream).
// Ramp retuned for the envelope ruler (2026-06-09): scored targets on previously
// conflicted beats now sit at 0.45-0.65 (was ~0.85), where the old 0.45-start ramp
// delivered ~zero pressure. Start 0.25 puts ~0.7 pressure at a 0.5 ask.
const IMPACT_CURVE_TARGET_START = 0.25;
const IMPACT_CURVE_TARGET_SPAN = 0.40;
const IMPACT_CURVE_ELEVATION_ROOM_TARGET_START = 0.20;
const IMPACT_CURVE_ELEVATION_ROOM_BUDGET_START_FRAMES = 125_000;
const IMPACT_CURVE_ELEVATION_ROOM_BUDGET_SPAN_FRAMES = 125_000;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_TARGET_START = 0.52;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_TARGET_SPAN = 0.10;
const IMPACT_CURVE_SPEED_START_PX = 6;
const IMPACT_CURVE_SPEED_SPAN_PX = 4;
// Ablation (2026-06-10): this curvature modulation is THE impact carrier (+53
// headline; the angle-shift mechanisms are ±2). On the OLD saturating v·sinΔθ metric the
// surface peaked at flatten 12° / frontload 1.2 (flatten 18 → 579, frontload 1.4 → 581 —
// deeper was WORSE, because sin saturated near 90° so extra scoop bought nothing).
// RE-FIT 2026-06-15 for the LINEAR redirArc = v·Δθ metric (SOFT=0/VSTRONG=7.29): with no
// angular saturation, deeper scoop now PAYS. eval_impact board (13 specs × 9 seeds, 150k/300k)
// brackets BOTH knobs with overshoot on each side — flatten {0:−36.6, 12:base, 18:+2.4,
// 24:−12.1}, frontload {1.2:+2.4, 1.6:+4.1, 2.0:+2.7} — so the peak moved up to flatten 18 /
// frontload 1.6 (Δ+4.1 vs old 12/1.2, positive at both budgets, 100% validity; INDICATIVE
// probe tier, canonical run to promote). Onset held at 0.25 (start 0.10 → −9.6, over-scoops).
const IMPACT_CURVE_FLATTEN_DEG = 18;
const IMPACT_CURVE_FRONTLOAD = 1.6;
// Mature-budget impact POST-TURN sampler.
// The curve modulation can only front-load whatever contact→post rotation already
// exists. Remaining mature misses show contact runs are long enough but
// tangentChangeDeg is near zero, so add a normal candidate-family variant that
// widens the post-contact angle by the ceiling-aware missing redirection angle.
// Spanned by attempt and mature-budget gated: selection can keep normal launches,
// while 50k completion remains protected.
const IMPACT_POST_TURN_BUDGET_START_FRAMES = 100_000;
const IMPACT_POST_TURN_BUDGET_SPAN_FRAMES = 100_000;
const IMPACT_POST_TURN_MAX_EXTRA_DEG = 28;
const IMPACT_POST_TURN_MIN_MISSING_DEG = 2;
const IMPACT_POST_TURN_TARGET_START = 0.60;
const IMPACT_POST_TURN_TARGET_SPAN = 0.20;
// Impact redirect-catch TEMPLATE LANES. The curve
// modulation above can only REDISTRIBUTE the existing contact→launch rotation, so
// flat-launch beats (launch ≈ contact angle) have nothing to front-load — exactly the
// beats stuck at achieved ~0.35 vs targets ~0.85 (canonical anatomy: high band mean
// err 0.48, only 1% ceiling-infeasible — the pool simply lacks 25-40° sustained turns).
// On pressured beats, a controlled fraction of tail attempts replaces the post
// profile with a purpose-built VALLEY: scoop down by the ceiling-aware needed turn
// over the ~6-frame redir window, then return to the normal launch angle (downstream
// energy/elevation/amplitude launch preserved). POOL INJECTION, not forcing — normal
// candidates remain, cost ranking adopts templates only where they win (the forced
// early-bend variant of this idea washed and regressed 50k; lanes are the
// selection-protected retry). RNG-neutral: rolls are always drawn, lanes only
// override the built lines; deterministic per attempt (low-discrepancy salts).
// Impact-ARRIVAL launch ramp: pressure on the BOUNDED next-beat ask. Bounded
// dense asks sit at 0.35-0.55 ⇒ pressure 0.1-0.6 there, 1.0 at 0.7+.
const IMPACT_ARRIVAL_TARGET_START = 0.30;
const IMPACT_ARRIVAL_TARGET_SPAN = 0.40;
const IMPACT_ARRIVAL_BUDGET_FADE_START_FRAMES = 50_000;
const IMPACT_ARRIVAL_BUDGET_FADE_SPAN_FRAMES = 50_000;

const IMPACT_TEMPLATE_MIN_PRESSURE = 0.35;
const IMPACT_TEMPLATE_LANE_RATE = 1 / 3;
const IMPACT_TEMPLATE_ATTEMPT_RAMP_START = 6;
const IMPACT_TEMPLATE_ATTEMPT_RAMP_SPAN = 4;
const IMPACT_TEMPLATE_PRESSURE_RAMP_SPAN = 0.10;
const IMPACT_TEMPLATE_ROOM_SPAN_FRAMES = 12;
const IMPACT_TEMPLATE_TARGET_TURN_MARGIN_DEG = 4;
const IMPACT_TEMPLATE_MAX_TURN_DEG = 40;
const IMPACT_TEMPLATE_FULL_TURN_DEG = 8;
const IMPACT_TEMPLATE_ROLL_SALT = 9;
const IMPACT_TEMPLATE_HOP_SCALE = 0.72;
const IMPACT_TEMPLATE_SCOOP_SEG_PX = 10;
const IMPACT_TEMPLATE_SCOOP_BASE_FRAMES = 6;
const IMPACT_TEMPLATE_SCOOP_SHORT_FRAMES = 5;
const IMPACT_TEMPLATE_SCOOP_BUDGET_START_FRAMES = 100_000;
const IMPACT_TEMPLATE_SCOOP_BUDGET_SPAN_FRAMES = 100_000;
const IMPACT_TEMPLATE_SCOOP_MIN_SPEC_MEAN_IMPACT = 0.55;
const IMPACT_TEMPLATE_END_ANGLE_MIN_DEG = -28;
const IMPACT_TEMPLATE_BUDGET_START_FRAMES = 50_000;
const IMPACT_TEMPLATE_BUDGET_SPAN_FRAMES = 50_000;
const IMPACT_TEMPLATE_HOP_MIN_ROOM_FRAMES = Math.round(FPS * 1.25);
const IMPACT_TEMPLATE_HOLD_BUDGET_START_FRAMES = 125_000;
const IMPACT_TEMPLATE_HOLD_BUDGET_SPAN_FRAMES = 125_000;
const IMPACT_TEMPLATE_HOLD_AIR_START = 0.22;
const IMPACT_TEMPLATE_HOLD_AIR_SPAN = 0.22;
const IMPACT_TEMPLATE_HOLD_IMPACT_START = 0.42;
const IMPACT_TEMPLATE_HOLD_IMPACT_SPAN = 0.23;
const IMPACT_TEMPLATE_HOLD_ROOM_START_FRAMES = 10;
const IMPACT_TEMPLATE_HOLD_ROOM_SPAN_FRAMES = 18;
const IMPACT_TEMPLATE_HOLD_MIN_FRAMES = 1.2;
const IMPACT_TEMPLATE_HOLD_MAX_FRAMES = 3.6;
const IMPACT_TEMPLATE_HOLD_SEG_PX = 12;

// M3 k-1 steep-arrival span. Later attempts on gaps whose NEXT beat wants impact
// pitch the final launch downward by a measured delivery-efficiency inverse,
// keeping attempt 0 byte-identical so the default shape remains in every pool.
const STEEP_ARRIVAL_MIN_ASK = 0.30;
const STEEP_ARRIVAL_DELIVERY_EFFICIENCY = 0.68;
const STEEP_ARRIVAL_DELTA_MAX_DEG = 15;
const STEEP_ARRIVAL_ABS_CAP_DEG = 40;
const STEEP_ARRIVAL_SPAN_SALT = 11;
const STEEP_ARRIVAL_ZERO_BAND = 0.8;
const STEEP_ARRIVAL_SCARCE_BUDGET_MAX_FRAMES = 200_000;
const STEEP_ARRIVAL_SCARCE_ZERO_BAND = 0.25;
const STEEP_ARRIVAL_HARD_IMPACT_PROFILE_MIN = 0.68;
const STEEP_ARRIVAL_HARD_IMPACT_ZERO_BAND = 0.7;

// Study-only marker: was the LAST geometry produced by sampleContactCenteredLines an
// impact template lane? Read by the landing-window probe (core/candidate.ts) to
// attribute pool/selection stats per lane. One module-level assignment per sample —
// no behavioral effect.
let lastGeometryWasImpactTemplate = false;
export function wasLastGeometryImpactTemplate(): boolean {
  return lastGeometryWasImpactTemplate;
}
let currentSteepArrivalSpecMaxImpact = 0;
export function setSteepArrivalSpecMaxImpact(maxImpact: number): void {
  currentSteepArrivalSpecMaxImpact = Number.isFinite(maxImpact)
    ? clamp(maxImpact, 0, 1)
    : 0;
}
const HIGH_AIR_LENGTH_BLEND_PRESSURE_START = 0.68;
const HIGH_AIR_LENGTH_BLEND_PRESSURE_SPAN = 0.24;
const HIGH_AIR_LENGTH_BLEND_EXTRA = 0.28;
const DENSE_SPACING_POST_LENGTH_NEUTRAL_CAP = 220;
const DENSE_SPACING_POST_LENGTH_MIN_CAP = 36;
const DENSE_SPACING_POST_LENGTH_MAX_CAP = 180;
const DENSE_SPACING_POST_LENGTH_SPEED_SCALE = 0.52;
const DENSE_SPACING_POST_LENGTH_LOW_AIR_SCALE = 0.16;
const CONTACT_CENTERED_RNG_DRAWS = 8;
const LAUNCH_GRAVITY_PX_PER_FRAME2 = 0.175;
/** Budget-aware post-contact ride-out CURVATURE. The ride-out angle was lerped
 *  linearly start→end; biasing the interpolation makes the path concave/convex — a
 *  new shape dimension across the attempt batch that the cost-sorted handoff selects
 *  from. Measured: full curvature lifts scarce-budget COMPLETION a lot (25k +19, 50k
 *  +54 — more shapes to find a valid chain) but DILUTES the converged high-budget
 *  quality. So fade the span out as the compile budget grows: full ≤50k, off ≥100k.
 *  Deterministic per attempt (low-discrepancy salt, no rng draw). */
const CONTACT_CENTERED_POST_CURVE_BIAS_SPAN = 0.6;
const CONTACT_CENTERED_POST_CURVE_FADE_START_FRAMES = 50_000;
const CONTACT_CENTERED_POST_CURVE_FADE_SPAN_FRAMES = 50_000;

/** Elevation steering. The post-contact ride-out angle decides where the rider
 *  goes next; up is −angle (screen y points down). When `elevation` is targeted
 *  we set that launch from the speed-relative elevation band (see types.ts
 *  `elevationToLaunchVy`): the authored value resolves to a launch vy against the
 *  vertical-velocity budget the current speed supports. The MIN/MAX widen the
 *  post-angle range past its speed/air defaults so a real climb is reachable. */
const ELEVATION_POST_ANGLE_MIN = -62;
const ELEVATION_POST_ANGLE_MAX = 70;
/** Strength of the elevation ride-out shortening (climb arcs): 1 = shorten fully to
 *  the airborne minimum at the steepest climb ask, 0 = off. The grounded ride-out
 *  otherwise eats a climb gap, leaving the rider net-descending on an up ask. */
const ELEVATION_RIDEOUT_SHORTEN = 1.0;

/** Arc-length degree of freedom — the campaign lever for arc placement. The
 *  ride-out length sets how long an arc the rider rides before going airborne.
 *  This spans it across the per-gap attempt batch (factor `lowDiscrepancyRoll`,
 *  no rng draw, deterministic) so the candidate pool can contain shorter AND
 *  longer arcs; the forward-eval keeps whatever scores. SPAN/FLOOR/CAP below are
 *  the knob.
 *
 *  Shipped at NEUTRAL (1.0/1.0/28/220 = the historical behavior, byte-identical
 *  baseline) on purpose: an *active* widening to 0.6–1.6 / 16–320 was measured at
 *  HEADLINE 611.6 vs 624.6 (Δ−13, decide REJECT) — the wider pool dilutes quality
 *  faster than the forward-eval recovers it. The campaign's job is to OPEN this
 *  range AND add the supporting arc-placement work (better landing setup for long
 *  ride-outs, selection/budget so longer arcs are kept only where they pay) until
 *  the canonical decide ACCEPTs. (Arc-placement campaign log: git history.) */
const ARC_LEN_SPAN_LO = 0.80;
const ARC_LEN_SPAN_HI = 1.45;
const ARC_LEN_FLOOR = 28;
const ARC_LEN_CAP = 260;
const ARC_LEN_SPAN_SALT = 9;
/** Room-gating for the arc-length HIGH end: a longer ride-out is only safe when
 *  the next contact is far (else it crowds the next landing — the failure that
 *  sank the earlier uniform widening). The LOW (shorter) end is always allowed
 *  (a shorter ride-out leaves MORE room). `room` = 0 at/below DENSE frames (HI
 *  collapses to neutral 1.0 → dense gaps keep historical behavior), ramping to 1
 *  at/above SPARSE frames (full HI). Smooth, deterministic, no spec-name branch. */
const ARC_LEN_ROOM_DENSE_FRAMES = 26;
const ARC_LEN_ROOM_SPARSE_FRAMES = 46;
const ARC_LEN_ROOM_SMOOTH_BUDGET_START_FRAMES = 50_000;
const ARC_LEN_ROOM_SMOOTH_BUDGET_SPAN_FRAMES = 50_000;

/** Per-compile frame budget, set once at compileHandoff entry (each compile is a
 *  single independent budget, run in its own worker / sequentially), read by the
 *  budget-aware geometry. A per-compile constant, so determinism stays per
 *  (spec, seed, budget) and the per-node candidate cache remains valid. */
let currentCompileBudgetFrames = 0;
export function setCompileBudgetFrames(frames: number): void {
  currentCompileBudgetFrames = Math.max(0, frames | 0);
}

function compileBudgetPressure(startFrames: number, spanFrames: number): number {
  return smoothstep((currentCompileBudgetFrames - startFrames) / spanFrames);
}

function compileBudgetFade(startFrames: number, spanFrames: number): number {
  return 1 - compileBudgetPressure(startFrames, spanFrames);
}

let currentImpactTemplateSpecMeanImpact = 0;
export function setImpactTemplateSpecMeanImpact(meanImpact: number): void {
  currentImpactTemplateSpecMeanImpact = Number.isFinite(meanImpact)
    ? clamp(meanImpact, 0, 1)
    : 0;
}

type ImpactProfilePressures = {
  elevationRoom: number;
  highSpeedRelief: number;
  templateHold: number;
};

let currentImpactProfilePressures: ImpactProfilePressures = {
  elevationRoom: 0,
  highSpeedRelief: 0,
  templateHold: 0,
};

function normalizedProfilePressure(pressure: number): number {
  return Number.isFinite(pressure) ? clamp(pressure, 0, 1) : 0;
}

export function setImpactProfilePressures(pressures: ImpactProfilePressures): void {
  currentImpactProfilePressures = {
    elevationRoom: normalizedProfilePressure(pressures.elevationRoom),
    highSpeedRelief: normalizedProfilePressure(pressures.highSpeedRelief),
    templateHold: normalizedProfilePressure(pressures.templateHold),
  };
}

type SegmentCollisionRiskLines = number[];

export type ArcPlacementStats = NonNullable<CompileStats["arc_placement"]>;
export type ArcPlacementDirectFailureReason = "survival" | "landing" | "offbeat";

export type ImpactTargetPointState = {
  sledX: number;
  sledY: number;
};

export type ImpactFrameTargetState = ImpactTargetPointState & {
  velocity: { x: number; y: number };
  speed: number;
  angleDeg: number;
};

export type PreTargetSledTrace = number[];

export type ArcPlacementRuntimeMode = ArcPlacementMode;

export type ArcPlacementGeometry = { kind: "lines"; lines: TrackLine[] };

type PlacementRolls = {
  segmentLength: number;
  contactAngle: number;
  preLength: number;
  postLength: number;
  preAngle: number;
  postAngle: number;
  point: number;
};

export function arcPlacementMode(): ArcPlacementRuntimeMode {
  return "target_state";
}

function makeArcPlacementCounter(): ArcPlacementCounter {
  return {
    sampled: 0,
    preclear_rejected: 0,
    direct_attempted: 0,
    direct_landed: 0,
    direct_failed: 0,
    direct_survival_failed: 0,
    direct_landing_failed: 0,
    direct_offbeat_failed: 0,
    fallback_attempted: 0,
    fallback_landed: 0,
  };
}

function makeArcPlacementStats(): ArcPlacementStats {
  return {
    mode: arcPlacementMode(),
    ...makeArcPlacementCounter(),
    by_sample_mode: Object.fromEntries(
      CANDIDATE_SAMPLE_MODES.map((mode) => [mode, makeArcPlacementCounter()]),
    ) as Record<CandidateSampleMode, ArcPlacementCounter>,
  };
}

const arcPlacementStats: ArcPlacementStats = makeArcPlacementStats();

export function resetArcPlacementStats(): void {
  const fresh = makeArcPlacementStats();
  arcPlacementStats.mode = fresh.mode;
  resetCounter(arcPlacementStats, fresh);
  for (const mode of CANDIDATE_SAMPLE_MODES) {
    resetCounter(arcPlacementStats.by_sample_mode[mode], fresh.by_sample_mode[mode]);
  }
}
registerCompileReset(resetArcPlacementStats);

export function snapshotArcPlacementStats(): ArcPlacementStats {
  return {
    ...arcPlacementStats,
    by_sample_mode: Object.fromEntries(
      CANDIDATE_SAMPLE_MODES.map((mode) => [
        mode,
        { ...arcPlacementStats.by_sample_mode[mode] },
      ]),
    ) as Record<CandidateSampleMode, ArcPlacementCounter>,
  };
}

export function recordArcPlacementSample(mode?: CandidateSampleMode): void {
  incrementCounter("sampled", mode);
}

export function recordArcPlacementPreclearReject(mode?: CandidateSampleMode): void {
  incrementCounter("preclear_rejected", mode);
}

export function recordArcPlacementDirectAttempt(mode?: CandidateSampleMode): void {
  incrementCounter("direct_attempted", mode);
}

export function recordArcPlacementDirectLanding(mode?: CandidateSampleMode): void {
  incrementCounter("direct_landed", mode);
}

export function recordArcPlacementDirectFailure(
  mode?: CandidateSampleMode,
  reason?: ArcPlacementDirectFailureReason,
): void {
  incrementCounter("direct_failed", mode);
  if (reason === "survival") incrementCounter("direct_survival_failed", mode);
  if (reason === "landing") incrementCounter("direct_landing_failed", mode);
  if (reason === "offbeat") incrementCounter("direct_offbeat_failed", mode);
}

export function readTargetState(
  // deno-lint-ignore no-explicit-any
  engine: any,
  frame: number,
  fallbackX: number,
  fallbackY: number,
): ImpactFrameTargetState {
  const rider = getRiderMetered(engine, frame);
  return readTargetStateFromRider(rider, fallbackX, fallbackY);
}

// deno-lint-ignore no-explicit-any
export function readTargetStateFromRider(
  rider: any,
  fallbackX: number,
  fallbackY: number,
): ImpactFrameTargetState {
  let sledX = fallbackX;
  let sledY = fallbackY;
  for (const name of SLED_POINTS) {
    const p = rider.get(name);
    if (p?.pos && p.pos.y > sledY) {
      sledY = p.pos.y;
      sledX = p.pos.x;
    }
  }
  const velocity = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(velocity.x, velocity.y);
  const angleDeg = speed > 0
    ? (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI
    : 0;
  return { sledX, sledY, velocity, speed, angleDeg };
}

export function sampleArcPlacementGeometry(
  rng: () => number,
  _refX: number,
  _refY: number,
  targets: AxisValues,
  targetState: ImpactFrameTargetState,
  attempt: number,
  gap: Gap,
  lineIdStart: number,
  mode: CandidateSampleMode = "normal",
  allContactFrames: readonly number[] = [],
): ArcPlacementGeometry {
  recordArcPlacementSample(mode);
  lastGeometryWasImpactTemplate = false;
  if (mode === "normal") {
    return {
      kind: "lines",
      lines: sampleContactCenteredLines(
        rng, targetState, targets, gap, lineIdStart, allContactFrames, attempt,
      ),
    };
  }
  return {
    kind: "lines",
    lines: sampleTargetStateLines(
      drawPlacementRolls(rng), targetState, targets, gap, lineIdStart, allContactFrames, attempt,
      mode,
    ),
  };
}

export function sampleArcParamsRngDraws(
  _targetState: { speed: number; angleDeg: number },
  _gap: Gap,
  _attempt: number,
  mode: CandidateSampleMode = "normal",
): number {
  if (mode === "normal") return CONTACT_CENTERED_RNG_DRAWS;
  return GEOMETRY_RNG_DRAWS;
}

function drawPlacementRolls(rng: () => number): PlacementRolls {
  return {
    segmentLength: rng(),
    contactAngle: rng(),
    preLength: rng(),
    postLength: rng(),
    preAngle: rng(),
    postAngle: rng(),
    point: rng(),
  };
}

function sampleTargetStateLines(
  rawRolls: PlacementRolls,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  lineIdStart: number,
  allContactFrames: readonly number[],
  attempt: number,
  mode: CandidateSampleMode,
): TrackLine[] {
  const rolls = guidedRolls(rawRolls, attempt, targetState, targets, gap, allContactFrames);
  const controls = targetStateControls(targetState, targets, gap, allContactFrames, rolls, mode);
  const contactAngleRad = (controls.contactAngleDeg * Math.PI) / 180;
  const tangentX = Math.cos(contactAngleRad);
  const tangentY = Math.sin(contactAngleRad);
  const normalX = -tangentY;
  const normalY = tangentX;
  const pointTangent = (rolls.point - 0.5) * controls.contactJitter;
  const pointNormal = (lowDiscrepancyRoll(attempt, 6) - 0.5) * controls.contactJitter;
  const contactPoint = {
    x: targetState.sledX + tangentX * pointTangent + normalX * pointNormal,
    y: targetState.sledY + tangentY * pointTangent + normalY * pointNormal,
  };

  const preLines = buildPreContactLines(
    lineIdStart,
    contactPoint,
    controls.preAngleDeg,
    controls.contactAngleDeg,
    controls.preLength,
    controls.preSegments,
  );
  const postLines = buildPostContactLines(
    lineIdStart + preLines.length,
    contactPoint,
    controls.contactAngleDeg,
    controls.postAngleDeg,
    controls.postLength,
    controls.postSegments,
  );
  return [...preLines, ...postLines];
}

function targetStateControls(
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
  rolls: PlacementRolls,
  mode: CandidateSampleMode,
): {
  segmentLength: number;
  contactAngleDeg: number;
  preAngleDeg: number;
  postAngleDeg: number;
  preLength: number;
  postLength: number;
  preSegments: number;
  postSegments: number;
  contactJitter: number;
} {
  const gapFrames = Math.max(1, gap.endFrame - gap.startFrame);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  const targetSpeedPx = targets.speed === undefined
    ? targetState.speed
    : authoredSpeedToPx(targets.speed);
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const lowAir = clamp((0.55 - air) / 0.55, 0, 1);
  const highAir = clamp((air - 0.45) / 0.55, 0, 1);
  const targetPace = clamp(
    (targetSpeedPx - PLACEMENT_SPEED_MIN_PX) / PLACEMENT_SPEED_SPAN_PX,
    0,
    1,
  );
  const speedError = clamp(
    (targetSpeedPx - targetState.speed) / PLACEMENT_SPEED_SPAN_PX,
    -1,
    1,
  );
  const overspeed = clamp(-speedError, 0, 1);
  const brakeModePressure = mode === "brake" && targets.speed !== undefined
    ? smoothstep(overspeed)
    : 0;
  // speed_drag / low_air_settle: retired candidate-sample modes (axis-quality streams ablated in
  // Phase 2). Never generated → these pressures were always 0; their ×0 terms have been folded out.
  const startupCatchPressure = mode === "startup_catch"
    ? smoothstep(1 / (1 + Math.pow(gap.startFrame / (FPS * 0.75), 2)))
    : 0;
  const startupLandingPressure = startupCatchPressure * clamp(
    0.35 + 0.35 * highAir + 0.30 * targetPace,
    0,
    1,
  );
  const deadline = clamp((18 - gapFrames) / 12, 0, 1);
  const dense = nextGapFrames === null ? 0 : clamp((18 - nextGapFrames) / 14, 0, 1);
  const denseFastAir = highAir * dense * targetPace;
  const brakeLandingUncertainty = brakeModePressure * clamp(
    0.35 + 0.35 * targetPace + 0.30 * highAir,
    0,
    1,
  );
  const contactJitter = CONTACT_POINT_JITTER *
    lerp(1, 1.5, brakeLandingUncertainty) *
    lerp(1, 2.2, startupLandingPressure);
  const preclearPressure = clamp(
    0.35 * deadline + denseFastAir + 0.32 * overspeed +
      0.18 * brakeModePressure +
      0.42 * startupLandingPressure,
    0,
    1,
  );
  const speedControlPressure = clamp(
    overspeed + 0.55 * denseFastAir + 0.38 * brakeModePressure,
    0,
    1,
  );

  const segmentLength = targets.grain === undefined
    ? 12 + rolls.segmentLength * 28
    : clamp(targets.grain * TARGET_GRAIN_LINE_LENGTH_PX + (rolls.segmentLength - 0.5) * 8, 5, 49);

  const baseAngle = clamp(targetState.angleDeg, -25, 75);
  const contactAngleDeg = clamp(
    baseAngle
      + 12 * speedError
      - 14 * lowAir
      + 10 * highAir
      + 4 * dense
      - 10 * preclearPressure
      - 5 * brakeModePressure
      - 5 * startupLandingPressure
      + (rolls.contactAngle - 0.5) * lerp(14, 24, startupLandingPressure),
    -22,
    74,
  );
  const preAngleDeg = clamp(
    contactAngleDeg
      - 5
      - 8 * deadline
      + 3 * lowAir
      - 6 * brakeModePressure
      - 10 * startupLandingPressure
      + (rolls.preAngle - 0.5) * lerp(10, 18, startupLandingPressure),
    -28,
    78,
  );
  const postAngleMin = -26;
  const postAngleDeg = clamp(
    contactAngleDeg
      + 14 * speedError
      - 18 * lowAir
      + 20 * highAir
      - 8 * dense
      - 18 * speedControlPressure
      - 12 * brakeModePressure
      - 8 * startupLandingPressure
      + (rolls.postAngle - 0.5) * 14,
    postAngleMin,
    78,
  );

  const preLength = clamp(
    (6 + rolls.preLength * 32) *
      (1 - 0.45 * deadline) *
      (1 + 0.25 * lowAir) *
      (1 - TARGET_STATE_PRE_LENGTH_PRECLEAR_REDUCTION * preclearPressure) *
      (1 - 0.24 * brakeModePressure) *
      (1 - 0.92 * startupLandingPressure),
    0,
    50,
  );
  const postLength = targetStatePostLength({
    roll: rolls.postLength,
    targetStateSpeed: targetState.speed,
    air,
    lowAir,
    highAir,
    dense,
    denseFastAir,
    overspeed,
    speedControlPressure,
    brakeModePressure,
    startupLandingPressure,
    nextGapFrames,
  });

  return {
    segmentLength,
    contactAngleDeg,
    preAngleDeg,
    postAngleDeg,
    preLength,
    postLength,
    preSegments: preLength <= 1 ? 0 : clampInt(Math.round(preLength / segmentLength), 1, 6),
    postSegments: clampInt(Math.round(postLength / segmentLength), 2, 18),
    contactJitter,
  };
}

type TargetStatePostLengthParams = {
  roll: number;
  targetStateSpeed: number;
  air: number;
  lowAir: number;
  highAir: number;
  dense: number;
  denseFastAir: number;
  overspeed: number;
  speedControlPressure: number;
  brakeModePressure: number;
  startupLandingPressure: number;
  nextGapFrames: number | null;
};

function targetStatePostLength(params: TargetStatePostLengthParams): number {
  const sampledPost =
    (28 + params.roll * 140) *
    (1 + 0.20 * params.lowAir + 0.12 * params.highAir) *
    (1 - TARGET_STATE_POST_SAMPLE_SPEED_REDUCTION * params.speedControlPressure) *
    (1 - TARGET_STATE_POST_SAMPLE_BRAKE_REDUCTION * params.brakeModePressure) *
    (1 - TARGET_STATE_POST_STARTUP_SAMPLE_REDUCTION * params.startupLandingPressure);
  const targetGroundFrames = params.nextGapFrames === null
    ? 6 + 18 * params.lowAir
    : clamp(
      (1 - params.air) * params.nextGapFrames,
      2,
      params.nextGapFrames *
        (TARGET_STATE_POST_GROUND_ROOM_BASE - TARGET_STATE_POST_GROUND_ROOM_DENSE_REDUCTION * params.dense),
    );
  const safePostCap = targetStateSafePostCap(params);
  const capPost = (value: number) => Math.min(safePostCap, value);
  const targetPost = capPost(
    Math.max(TARGET_STATE_POST_MIN_TARGET_PX, Math.max(1, params.targetStateSpeed) * targetGroundFrames),
  );
  const basePostFloor = capPost(
    lerp(
      TARGET_STATE_POST_BASE_FLOOR_HIGH_PX,
      TARGET_STATE_POST_BASE_FLOOR_LOW_PX,
      clamp(params.denseFastAir + params.overspeed + 0.6 * params.brakeModePressure, 0, 1),
    ),
  );
  const startupPostFloor = capPost(
    TARGET_STATE_POST_BASE_FLOOR_HIGH_PX +
      TARGET_STATE_POST_STARTUP_FLOOR_LOW_AIR_BONUS * params.lowAir,
  );
  const postFloor = capPost(
    lerp(basePostFloor, startupPostFloor, params.startupLandingPressure),
  );
  return clamp(
    lerp(sampledPost, targetPost, TARGET_STATE_POST_TARGET_BLEND),
    postFloor,
    safePostCap,
  );
}

function targetStateSafePostCap(params: TargetStatePostLengthParams): number {
  if (params.nextGapFrames === null) return TARGET_STATE_POST_UNBOUNDED_CAP_PX;
  return clamp(
    Math.max(1, params.targetStateSpeed) *
      params.nextGapFrames *
      (
        TARGET_STATE_POST_SAFE_CAP_BASE +
        TARGET_STATE_POST_SAFE_CAP_LOW_AIR_BONUS * params.lowAir -
        TARGET_STATE_POST_SAFE_CAP_DENSE_PENALTY * params.dense
      ) *
      (1 - TARGET_STATE_POST_SAFE_CAP_SPEED_REDUCTION * params.speedControlPressure) *
      (1 - TARGET_STATE_POST_SAFE_CAP_BRAKE_REDUCTION * params.brakeModePressure) *
      (1 - TARGET_STATE_POST_SAFE_CAP_STARTUP_REDUCTION * params.startupLandingPressure),
    TARGET_STATE_POST_MIN_CAP_PX,
    TARGET_STATE_POST_MAX_CAP_PX,
  );
}

function guidedRolls(
  rolls: PlacementRolls,
  attempt: number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
): PlacementRolls {
  const guide = placementGuideWeight(attempt, targetState, targets, gap, allContactFrames);
  return {
    segmentLength: guidedRoll(rolls.segmentLength, attempt, 0, guide),
    contactAngle: guidedRoll(rolls.contactAngle, attempt, 1, guide),
    preLength: guidedRoll(rolls.preLength, attempt, 2, guide),
    postLength: guidedRoll(rolls.postLength, attempt, 3, guide),
    preAngle: guidedRoll(rolls.preAngle, attempt, 4, guide),
    postAngle: guidedRoll(rolls.postAngle, attempt, 5, guide),
    point: guidedRoll(rolls.point, attempt, 6, guide),
  };
}

function placementGuideWeight(
  attempt: number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
): number {
  const baseGuide = 1 / (1 + Math.pow(Math.max(0, attempt) / 6, 2));
  const targetSpeedPx = targets.speed === undefined
    ? targetState.speed
    : authoredSpeedToPx(targets.speed);
  const targetPace = clamp(
    (targetSpeedPx - PLACEMENT_SPEED_MIN_PX) / PLACEMENT_SPEED_SPAN_PX,
    0,
    1,
  );
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const highAir = clamp((air - 0.45) / 0.55, 0, 1);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  const cadencePressure = nextGapFrames === null
    ? 0
    : 1 / (1 + Math.pow(nextGapFrames / (FPS * 0.55), 2));
  const startupPressure = 1 / (1 + Math.pow(gap.startFrame / (FPS * 1.25), 2));
  const explorationPressure = clamp(
    targetPace * (0.50 * startupPressure + 0.35 * cadencePressure + 0.15 * highAir),
    0,
    1,
  );
  return baseGuide * lerp(1, 0.35, explorationPressure);
}

function guidedRoll(raw: number, attempt: number, salt: number, weight: number): number {
  return clamp(lerp(raw, lowDiscrepancyRoll(attempt, salt), weight), 0, 1);
}

function lowDiscrepancyRoll(attempt: number, salt: number): number {
  const stride = 0.6180339887498949;
  const offset = (salt + 1) * 0.137503523749935;
  return fract((Math.max(0, attempt) + 1) * stride + offset);
}

type ContactCenteredRolls = {
  segmentLengthRoll: number;
  contactAngleRoll: number;
  preLengthRoll: number;
  postLengthRoll: number;
  preAngleRoll: number;
  postAngleRoll: number;
  tangentJitterRoll: number;
  normalJitterRoll: number;
};

/** Shared speed/dense/deadline pressure derivation for the contact-centered
 *  sampler. `sampleContactCenteredLines` and `guideContactCenteredRolls` both
 *  need the same block of derived pressures from the identical inputs, so it
 *  lives here as one source of truth for the 20/12, 18/10, and `CC_PRESSURE_*`
 *  constants. Each caller layers its own site-specific terms on top of the
 *  returned bundle. */
interface ContactCenteredPressures {
  targetSpeedPx: number;
  air: number;
  nextGapFrames: number | null;
  gapFrames: number;
  denseContactPressure: number;
  deadlinePressure: number;
  absoluteSpeedPressure: number;
  brakePressure: number;
  accelPressure: number;
  speedCarryPressure: number;
}

function contactCenteredPressures(
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
): ContactCenteredPressures {
  const targetSpeedPx = targets.speed === undefined
    ? targetState.speed
    : authoredSpeedToPx(targets.speed);
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const nextGapFrames = framesUntilNextContact(gap, allContactFrames);
  const gapFrames = Math.max(1, gap.endFrame - gap.startFrame);
  const denseContactPressure = nextGapFrames === null
    ? 0
    : clamp((20 - nextGapFrames) / 12, 0, 1);
  const deadlinePressure = clamp((18 - gapFrames) / 10, 0, 1);
  const absoluteSpeedPressure = clamp(
    (targetState.speed - CC_PRESSURE_START_PX) / CC_PRESSURE_SPAN_PX, 0, 1,
  );
  const brakePressure = clamp((targetState.speed - targetSpeedPx) / CC_PRESSURE_SPAN_PX, 0, 1);
  const accelPressure = clamp((targetSpeedPx - targetState.speed) / CC_PRESSURE_SPAN_PX, 0, 1);
  const speedCarryPressure = clamp((targetSpeedPx - CC_CARRY_START_PX) / CC_CARRY_SPAN_PX, 0, 1)
    * (1 - clamp((targetSpeedPx - CC_CARRY_FADE_START_PX) / CC_CARRY_FADE_SPAN_PX, 0, 1));
  return {
    targetSpeedPx,
    air,
    nextGapFrames,
    gapFrames,
    denseContactPressure,
    deadlinePressure,
    absoluteSpeedPressure,
    brakePressure,
    accelPressure,
    speedCarryPressure,
  };
}

/** Blend the post-contact launch toward the symmetric pop arc (vy0 = −½·g·N,
 *  vx = current horizontal speed) that fills the gap of `nextGapFrames`, and
 *  shorten the grounded ride-out toward the 28px floor so the airborne arc has
 *  more of the gap to express. Shared by the amplitude and impact-arrival launch
 *  lanes: they compute the identical pop-arc geometry and differ only in the
 *  `blend` pressure fed in and the ride-out `shortenFactor` (amplitude 1.0,
 *  impact-arrival 0.6). Returns the updated angle/length. */
function blendPostTowardPopArc(
  postAngleDeg: number,
  postLength: number,
  nextGapFrames: number,
  vx: number,
  blend: number,
  shortenFactor: number,
): { postAngleDeg: number; postLength: number } {
  const vyArc = -0.5 * LAUNCH_GRAVITY_PX_PER_FRAME2 * nextGapFrames; // fills the gap
  const vxArc = Math.max(1, vx);
  const arcLaunchDeg = (Math.atan2(vyArc, vxArc) * 180) / Math.PI;
  return {
    postAngleDeg: clamp(
      lerp(postAngleDeg, arcLaunchDeg, blend),
      ELEVATION_POST_ANGLE_MIN,
      ELEVATION_POST_ANGLE_MAX,
    ),
    postLength: lerp(postLength, 28, blend * shortenFactor),
  };
}

/** Ported from work-new `sampleContactCenteredLinesWithDiagnostics`. Emits one
 *  pre+post line catch through the predicted sled position, but the post-contact
 *  launch angle and grounded ride-out length are physically shaped (energy launch
 *  + air-targeted length) and SPANNED across the per-gap attempt batch so the
 *  cost-sorted handoff can keep the best valid trajectory. Consumes exactly
 *  CONTACT_CENTERED_RNG_DRAWS (8) rng() draws — must match sampleArcParamsRngDraws. */
function sampleContactCenteredLines(
  rng: () => number,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  lineIdStart: number,
  allContactFrames: readonly number[],
  attempt: number,
): TrackLine[] {
  const rawRolls: ContactCenteredRolls = {
    segmentLengthRoll: rng(),
    contactAngleRoll: rng(),
    preLengthRoll: rng(),
    postLengthRoll: rng(),
    preAngleRoll: rng(),
    postAngleRoll: rng(),
    tangentJitterRoll: rng(),
    normalJitterRoll: rng(),
  };
  const sampledRolls = guideContactCenteredRolls(
    rawRolls, targetState, targets, gap, allContactFrames, attempt,
  );

  const {
    targetSpeedPx,
    air,
    nextGapFrames,
    gapFrames,
    denseContactPressure,
    deadlinePressure,
    absoluteSpeedPressure,
    brakePressure,
    accelPressure,
    speedCarryPressure,
  } = contactCenteredPressures(targetState, targets, gap, allContactFrames);
  const sustainedContactCarryPressure = speedCarryPressure
    * (nextGapFrames === null ? 0 : clamp((15 - nextGapFrames) / 2, 0, 1))
    * (1 - clamp((air - 0.62) / 0.12, 0, 1));
  const clearancePressure = Math.max(deadlinePressure, absoluteSpeedPressure * 0.6);

  const segmentLength = targets.grain !== undefined
    ? clamp(targets.grain * CALIB.LINE_LENGTH_CAP + (sampledRolls.segmentLengthRoll - 0.5) * 8, 4, 49)
    : clamp(16 + sampledRolls.segmentLengthRoll * 28, 4, 60);
  let contactAngleDeg = clamp(
    targetState.angleDeg
      - (2 + 5 * air)
      - 18 * brakePressure
      + 16 * accelPressure
      + 8 * speedCarryPressure
      + 2 * sustainedContactCarryPressure
      + (sampledRolls.contactAngleRoll - 0.5) * 12,
    -12, 65,
  );
  // Keep lip/bevel steering neutral under the redir-impact metric; the subtle
  // contact-angle bias below uses the new windowed redirection scale directly.
  if (targets.impact !== undefined) {
    contactAngleDeg = clamp(
      contactAngleDeg + contactCenteredRedirAngleShiftDeg({
        kind: "contact",
        targetState,
        targetImpact: targets.impact,
        contactAngleDeg,
        attempt,
      }),
      -14,
      65,
    );
  }
  // Impact-driven curvature modulation. Flatten the contact angle into
  // a scoop so the descending entry meets a surface angled across its path (raises
  // tangentDelta); the front-loaded curvature below then sustains the rotation through
  // the redir window.
  const impactCurveP = impactCurvePressure(targetState, targets.impact);
  if (impactCurveP > 0) {
    contactAngleDeg = clamp(
      contactAngleDeg - impactCurveP * IMPACT_CURVE_FLATTEN_DEG, -14, 65,
    );
  }
  const preLength = clamp(
    (6 + sampledRolls.preLengthRoll * 28)
      * (1 - 0.45 * clearancePressure)
      * (1 + 0.35 * brakePressure),
    4, 44,
  );
  const rawPostLength = (45 + sampledRolls.postLengthRoll * 135)
    * (0.95 + 0.25 * (1 - air) + 0.20 * absoluteSpeedPressure
      + 0.18 * sustainedContactCarryPressure + 0.12 * brakePressure);
  const denseScaledPostLength = rawPostLength * (1 - 0.55 * denseContactPressure);
  const arcLenRoom = nextGapFrames === null
    ? 1
    : (() => {
      const linearRoom = clamp(
        (nextGapFrames - ARC_LEN_ROOM_DENSE_FRAMES) /
          (ARC_LEN_ROOM_SPARSE_FRAMES - ARC_LEN_ROOM_DENSE_FRAMES),
        0, 1,
      );
      const smoothRoom = smoothstep(linearRoom);
      const smoothBudgetPressure = compileBudgetPressure(
        ARC_LEN_ROOM_SMOOTH_BUDGET_START_FRAMES,
        ARC_LEN_ROOM_SMOOTH_BUDGET_SPAN_FRAMES,
      );
      return lerp(linearRoom, smoothRoom, smoothBudgetPressure);
    })();
  const spacingPostLengthCap = denseSpacingPostLengthCap(
    targetState.speed,
    nextGapFrames,
    air,
    denseContactPressure,
    arcLenRoom,
  );
  // Both ends fade to the neutral 1.0 as room→0, so dense gaps (the original
  // suite) stay byte-identical and only gaps with room get the wider pool.
  const arcLenLo = 1 + (ARC_LEN_SPAN_LO - 1) * arcLenRoom;
  const arcLenHi = 1 + (ARC_LEN_SPAN_HI - 1) * arcLenRoom;
  const arcLenFactor = arcLenLo
    + (arcLenHi - arcLenLo) * lowDiscrepancyRoll(attempt, ARC_LEN_SPAN_SALT);
  const sampledPostLength = clamp(
    Math.min(denseScaledPostLength, spacingPostLengthCap) * arcLenFactor,
    ARC_LEN_FLOOR, ARC_LEN_CAP,
  );
  const preAngleDeg = clamp(
    contactAngleDeg
      - (4 + 8 * clearancePressure + 4 * brakePressure)
      + (sampledRolls.preAngleRoll - 0.5) * 12,
    -20, 70,
  );
  const nonBrakePostAngleDeg = contactAngleDeg
    - (3 + 6 * air)
    + 10 * accelPressure
    + 6 * speedCarryPressure
    + 6 * sustainedContactCarryPressure
    + (sampledRolls.postAngleRoll - 0.5) * 10;
  const brakeRideOutAngleDeg = clamp(
    contactAngleDeg + 8 + (sampledRolls.postAngleRoll - 0.5) * 10, -8, 18,
  );
  const angledPostAngleDeg = clamp(
    lerp(nonBrakePostAngleDeg, brakeRideOutAngleDeg, brakePressure), -8, 65,
  );

  // Energy-targeted launch: height shapes speed. dh = (vT²−vIn²)/2g is the drop
  // that converts the rider's pace to the gap target; vy = dh/N − ½gN lands it that
  // far below current height after N frames (clamped so it is still descending at
  // the next contact). Spanned from the local ride-out to the fully energy-shaped.
  let postAngleDeg = angledPostAngleDeg;
  if (nextGapFrames !== null) {
    const blend = clamp(ccSpanBlends(attempt).launch, 0, 1);
    const g = LAUNCH_GRAVITY_PX_PER_FRAME2;
    const N = nextGapFrames;
    const vIn = Math.max(1, targetState.velocity.x);
    const vT = Math.max(1, targetSpeedPx);
    const dhDown = (vT * vT - vIn * vIn) / (2 * g);
    const vyLevel = -0.5 * g * N;
    const vyTarget = dhDown / N + vyLevel;
    const vyClamped = clamp(vyTarget, -0.92 * g * N, 0.45 * g * N);
    const energyLaunchDeg = (Math.atan2(vyClamped, vIn) * 180) / Math.PI;
    postAngleDeg = lerp(angledPostAngleDeg, energyLaunchDeg, blend);
  }

  // Elevation-targeted launch (speed-relative). Gated on the axis being targeted
  // so specs that never set elevation stay byte-identical. The authored elevation
  // resolves against the vertical-velocity band the current speed supports, so
  // climb is "as steep as this speed allows" rather than a fixed angle. Up is −y.
  if (targets.elevation !== undefined && nextGapFrames !== null) {
    const elevationLaunchSpeed = Math.max(targetState.speed, targetSpeedPx);
    const vy = elevationToLaunchVy(targets.elevation, elevationLaunchSpeed, nextGapFrames);
    const vx = Math.sqrt(Math.max(1, elevationLaunchSpeed * elevationLaunchSpeed - vy * vy));
    const elevationLaunchDeg = (Math.atan2(vy, vx) * 180) / Math.PI;
    // Span the climb aggressiveness across the attempt batch rather than forcing
    // it every candidate: blend 0 keeps the speed-preserving ride-out, blend 1 is
    // the full band launch. Survival gates drop the stallers and the cost ranks
    // the rest, so the rider gets the steepest *surviving* climb.
    const blend = clamp(ccSpanBlends(attempt).launch, 0, 1);
    postAngleDeg = clamp(
      lerp(postAngleDeg, elevationLaunchDeg, blend),
      ELEVATION_POST_ANGLE_MIN, ELEVATION_POST_ANGLE_MAX,
    );
  }

  // Air-targeted grounded ride-out length: longer grounded ride ⇒ less air. Size
  // toward (1−air) of the span to the next contact, capped so it never reaches the
  // next beat. Spanned across the attempt batch.
  let postLength = clamp(sampledPostLength, 28, 220);
  if (nextGapFrames !== null && targets.air !== undefined) {
    const speed = Math.max(1, targetState.speed);
    const groundedTargetLen = speed * clamp(1 - air, 0, 1) * nextGapFrames;
    const safeCap = speed * nextGapFrames * 0.55;
    const targetLen = clamp(Math.min(groundedTargetLen, safeCap), 28, 360);
    const blend = clamp(ccSpanBlends(attempt).length, 0, 1);
    const highAirPressure = clamp(
      (air - HIGH_AIR_LENGTH_BLEND_PRESSURE_START) / HIGH_AIR_LENGTH_BLEND_PRESSURE_SPAN, 0, 1,
    );
    const blendStrength = 0.6 + HIGH_AIR_LENGTH_BLEND_EXTRA * highAirPressure;
    postLength = clamp(lerp(sampledPostLength, targetLen, blend * blendStrength), 28, 360);
  }

  // Elevation ride-out shortening. A steep launch ANGLE alone does not climb if the
  // grounded ride-out eats the gap (the rider rides flat then launches with no
  // airborne time left — measured: achieved elevation ≈0.43 net-DESCENT vs ≈0.55
  // climb ask). For an upward ask (elevation > 0.5) shorten the ride-out so the climb
  // arc has the gap to express — the lever amplitude already uses. Spanned by the
  // attempt blend, scaled by how much climb is asked; cost/survival rank the rest.
  // Deferred when a meaningful amplitude pop is ALSO asked (≥ the amplitude block's
  // own 0.30 pressure threshold): that ask needs the airborne time the shortening
  // would steal (board: shortening regressed skyline_push −11 there, +10 terrace).
  if (targets.elevation !== undefined && targets.elevation > 0.5 && nextGapFrames !== null
      && (targets.amplitude === undefined || targets.amplitude < 0.30)) {
    const climbP = clamp((targets.elevation - 0.5) / 0.5, 0, 1);
    const blend = clamp(ccSpanBlends(attempt).launch, 0, 1);
    postLength = lerp(postLength, 28, blend * climbP * ELEVATION_RIDEOUT_SHORTEN);
  }

  // Amplitude-targeted ballistic arc. Gated on the axis being targeted so specs
  // that never set amplitude stay byte-identical. Amplitude is the *height* of the
  // airborne arc (pop above the takeoff→landing chord); for a ballistic arc that
  // lands N frames later it is ≈ g·N²/8, maximized by launching the symmetric arc
  // (vy = −½gN) that fills the whole gap AND shortening the grounded ride-out so
  // the rider is aloft longer. This is bounded by gap length — big airs need long
  // gaps — but it consolidates the per-gap arc into one clean pop instead of a
  // flutter, and scales up naturally where contacts are sparse.
  if (targets.amplitude !== undefined && nextGapFrames !== null) {
    const amp = clamp(targets.amplitude, 0, 1);
    const amplitudePressure = smoothstep((amp - 0.30) / 0.45);
    const blend = clamp(ccSpanBlends(attempt).launch, 0, 1) * amplitudePressure;
    // Shorten the grounded ride-out so the airborne arc fills more of the gap.
    ({ postAngleDeg, postLength } = blendPostTowardPopArc(
      postAngleDeg, postLength, nextGapFrames, targetState.velocity.x, blend, 1,
    ));
  }

  ({ postAngleDeg, postLength } = impactDeliveryAdjustment({
    targetState,
    targets,
    gap,
    nextGapFrames,
    contactAngleDeg,
    postAngleDeg,
    postLength,
    impactCurveP,
    attempt,
  }));

  const preSegments = clampInt(Math.round(preLength / segmentLength), 1, 6);
  const postSegments = clampInt(Math.round(postLength / segmentLength), 2, 16);

  const contactAngleRad = (contactAngleDeg * Math.PI) / 180;
  const tangentX = Math.cos(contactAngleRad);
  const tangentY = Math.sin(contactAngleRad);
  const normalX = -tangentY;
  const normalY = tangentX;
  const tangentJitter = (sampledRolls.tangentJitterRoll - 0.5) * CONTACT_CENTERED_POINT_JITTER;
  const normalJitter = (sampledRolls.normalJitterRoll - 0.5) * CONTACT_CENTERED_POINT_JITTER;
  const contactPoint = {
    x: targetState.sledX + tangentX * tangentJitter + normalX * normalJitter,
    y: targetState.sledY + tangentY * tangentJitter + normalY * normalJitter,
  };

  const curveFadeBase = compileBudgetFade(
    CONTACT_CENTERED_POST_CURVE_FADE_START_FRAMES,
    CONTACT_CENTERED_POST_CURVE_FADE_SPAN_FRAMES,
  );
  // Impact beats keep full curvature authority at every budget (the through-window
  // rotation IS the redirection; the budget fade would suppress it exactly where impact
  // steering matters most). Non-impact beats are untouched.
  const curveFade = Math.max(curveFadeBase, impactCurveP > 0 ? 1 : 0);
  let postCurveBias = curveFade <= 0 ? 0
    : (lowDiscrepancyRoll(attempt, 8) - 0.5) * 2 *
      CONTACT_CENTERED_POST_CURVE_BIAS_SPAN * curveFade;
  if (impactCurveP > 0) {
    // Front-load (negative bias) concentrates the contact→post rotation into the early
    // segments the rider hugs during the redir window, scaled by impact pressure.
    postCurveBias = lerp(postCurveBias, -IMPACT_CURVE_FRONTLOAD, impactCurveP);
  }

  // The old lip/bevel path is gone (neutralized by the redir-impact migration). A
  // separate redir-aware entry adjustment below only changes the final approach
  // segment: if first contact happens on that segment, the fired surface now
  // participates in the same velocity-redirection contract as the post-contact
  // curvature.
  const entryRedirShiftDeg = contactCenteredRedirAngleShiftDeg({
    kind: "entry",
    targetState,
    targetImpact: targets.impact,
    contactAngleDeg,
    gapFrames,
    nextGapFrames,
    attempt,
  });
  const entryBevelAngleDeg = clamp(
    contactAngleDeg - entryRedirShiftDeg,
    -30,
    65,
  );
  const preLines = buildPreContactLines(
    lineIdStart, contactPoint, preAngleDeg, contactAngleDeg, preLength, preSegments,
    entryBevelAngleDeg,
  );

  // Impact redirect-catch template lane (see the const block). Replaces only the
  // post profile with a two-phase valley sized from the ceiling-aware needed turn.
  // The attempt/pressure/room ramps keep the guided prefix mostly normal, then let
  // the wide random tail spend a controlled fraction of samples on templates.
  lastGeometryWasImpactTemplate = false;
  const impactTemplate = impactTemplateDescriptor({
    targets,
    targetState,
    gapFrames,
    nextGapFrames,
    impactCurveP,
    attempt,
    contactAngleDeg,
  });
  if (impactTemplate !== null) {
    lastGeometryWasImpactTemplate = true;
    const scoopLines = buildPostContactLines(
      lineIdStart + preLines.length,
      contactPoint,
      contactAngleDeg,
      impactTemplate.scoop.endAngleDeg,
      impactTemplate.scoop.length,
      impactTemplate.scoop.segments,
    );
    const holdLines = buildImpactTemplateHoldLines(
      lineIdStart + preLines.length + scoopLines.length,
      scoopLines,
      contactPoint,
      impactTemplate.scoop.endAngleDeg,
      impactTemplate.speed,
      impactTemplate.hold.pressure,
    );
    return [...preLines, ...scoopLines, ...holdLines];
  }

  const postLines = buildPostContactLines(
    lineIdStart + preLines.length, contactPoint, contactAngleDeg, postAngleDeg,
    postLength, postSegments, postCurveBias, contactAngleDeg,
  );
  return [...preLines, ...postLines];
}

type ImpactTemplateDescriptor = {
  speed: number;
  scoop: {
    endAngleDeg: number;
    length: number;
    segments: number;
  };
  hold: {
    pressure: number;
  };
};

function impactTemplateDescriptor(params: {
  targets: AxisValues;
  targetState: ImpactFrameTargetState;
  gapFrames: number;
  nextGapFrames: number | null;
  impactCurveP: number;
  attempt: number;
  contactAngleDeg: number;
}): ImpactTemplateDescriptor | null {
  const impactTemplateBudgetP = impactTemplateBudgetPressure();
  const impactTemplateEligibility = impactTemplateLaneEligibility(
    params.targets,
    params.gapFrames,
    params.nextGapFrames,
    params.impactCurveP,
    impactTemplateBudgetP,
    params.attempt,
  );
  if (lowDiscrepancyRoll(params.attempt, IMPACT_TEMPLATE_ROLL_SALT) >= impactTemplateEligibility) {
    return null;
  }
  if (params.nextGapFrames === null || params.nextGapFrames <= 4) return null;

  // SLAM-HOP: a single concave scoop from the contact angle down to a ballistic
  // hop launch sized to land the NEXT beat (vy ~= -g*N/2, lane-spanned 0.7-1.2x),
  // then the surface STOPS -- the rider launches from the valley bottom. Physics
  // forces this shape: a big redirection cannot exit at a descending launch
  // without a convex crest (the rider flies off it early with an unplanned
  // trajectory -- the documented early-bend failure; the two-phase return variant
  // of this lane reproduced it: templates won local cost on 88% of pressured
  // beats yet forward-eval rejected every one). The hop exit is the redirection
  // AND the next-beat delivery in one arc, so the rollout stays coherent.
  const speed = Math.max(1, params.targetState.speed);
  const hopScale = IMPACT_TEMPLATE_HOP_SCALE;
  const vyHop = -0.5 * LAUNCH_GRAVITY_PX_PER_FRAME2 * params.nextGapFrames * hopScale;
  const hopAngleDeg = Math.max(
    (Math.atan2(vyHop, speed) * 180) / Math.PI,
    IMPACT_TEMPLATE_END_ANGLE_MIN_DEG,
  );
  const targetImpact = params.targets.impact;
  if (targetImpact === undefined) return null;
  const targetSizedTurnDeg = Math.min(
    IMPACT_TEMPLATE_MAX_TURN_DEG,
    neededTurnDegForImpact(targetImpact, speed) + IMPACT_TEMPLATE_TARGET_TURN_MARGIN_DEG,
  );
  const hopTurnDeg = params.contactAngleDeg - hopAngleDeg;
  const requestedTurnDeg = Math.max(hopTurnDeg, targetSizedTurnDeg);
  const endAngleDeg = Math.max(
    params.contactAngleDeg - requestedTurnDeg,
    IMPACT_TEMPLATE_END_ANGLE_MIN_DEG,
  );
  const turnDeg = params.contactAngleDeg - endAngleDeg;
  const turnPressure = smoothstep(turnDeg / IMPACT_TEMPLATE_FULL_TURN_DEG);
  const effectiveTurnDeg = turnDeg >= IMPACT_TEMPLATE_FULL_TURN_DEG
    ? turnDeg
    : turnDeg * Math.sqrt(turnPressure);
  if (effectiveTurnDeg <= 0) return null;

  const scoopLength = clamp(speed * impactTemplateScoopFrames(), 28, 120);
  return {
    speed,
    scoop: {
      endAngleDeg: params.contactAngleDeg - effectiveTurnDeg,
      length: scoopLength,
      segments: clampInt(Math.round(scoopLength / IMPACT_TEMPLATE_SCOOP_SEG_PX), 3, 12),
    },
    hold: {
      pressure: impactTemplateHoldPressure(params.targets, params.nextGapFrames),
    },
  };
}

function impactTemplateBudgetPressure(): number {
  return compileBudgetPressure(
    IMPACT_TEMPLATE_BUDGET_START_FRAMES,
    IMPACT_TEMPLATE_BUDGET_SPAN_FRAMES,
  );
}

function impactTemplateScoopFrames(): number {
  if (currentImpactTemplateSpecMeanImpact < IMPACT_TEMPLATE_SCOOP_MIN_SPEC_MEAN_IMPACT) {
    return IMPACT_TEMPLATE_SCOOP_BASE_FRAMES;
  }
  return lerp(
    IMPACT_TEMPLATE_SCOOP_BASE_FRAMES,
    IMPACT_TEMPLATE_SCOOP_SHORT_FRAMES,
    compileBudgetPressure(
      IMPACT_TEMPLATE_SCOOP_BUDGET_START_FRAMES,
      IMPACT_TEMPLATE_SCOOP_BUDGET_SPAN_FRAMES,
    ),
  );
}

function impactTemplateHoldPressure(
  targets: AxisValues,
  nextGapFrames: number | null,
): number {
  if (currentImpactProfilePressures.templateHold <= 0 || nextGapFrames === null) {
    return 0;
  }
  if (targets.impact === undefined) return 0;
  const air = clamp(targets.air ?? 0.5, 0, 1);
  const lowAirPressure = 1 - smoothstep(
    (air - IMPACT_TEMPLATE_HOLD_AIR_START) / IMPACT_TEMPLATE_HOLD_AIR_SPAN,
  );
  const impactPressure = smoothstep(
    (targets.impact - IMPACT_TEMPLATE_HOLD_IMPACT_START) / IMPACT_TEMPLATE_HOLD_IMPACT_SPAN,
  );
  const roomPressure = smoothstep(
    (nextGapFrames - IMPACT_TEMPLATE_HOLD_ROOM_START_FRAMES) /
      IMPACT_TEMPLATE_HOLD_ROOM_SPAN_FRAMES,
  );
  const budgetPressure = compileBudgetPressure(
    IMPACT_TEMPLATE_HOLD_BUDGET_START_FRAMES,
    IMPACT_TEMPLATE_HOLD_BUDGET_SPAN_FRAMES,
  );
  return clamp(
    currentImpactProfilePressures.templateHold * lowAirPressure * impactPressure *
      roomPressure * budgetPressure,
    0,
    1,
  );
}

function buildImpactTemplateHoldLines(
  lineIdStart: number,
  scoopLines: readonly TrackLine[],
  contactPoint: { x: number; y: number },
  angleDeg: number,
  speed: number,
  pressure: number,
): TrackLine[] {
  if (pressure <= 0) return [];
  const start = scoopLines.length === 0
    ? contactPoint
    : {
      x: scoopLines[scoopLines.length - 1].x2,
      y: scoopLines[scoopLines.length - 1].y2,
    };
  const holdFrames = lerp(
    IMPACT_TEMPLATE_HOLD_MIN_FRAMES,
    IMPACT_TEMPLATE_HOLD_MAX_FRAMES,
    smoothstep(pressure),
  );
  const holdLength = clamp(speed * holdFrames, 8, 42);
  const holdSegments = clampInt(
    Math.round(holdLength / IMPACT_TEMPLATE_HOLD_SEG_PX),
    1,
    4,
  );
  return buildPostContactLines(lineIdStart, start, angleDeg, angleDeg, holdLength, holdSegments);
}

function impactDeliveryAdjustment(params: {
  targetState: ImpactFrameTargetState;
  targets: AxisValues;
  gap: Gap;
  nextGapFrames: number | null;
  contactAngleDeg: number;
  postAngleDeg: number;
  postLength: number;
  impactCurveP: number;
  attempt: number;
}): { postAngleDeg: number; postLength: number } {
  let postAngleDeg = params.postAngleDeg;
  let postLength = params.postLength;

  // Impact-ARRIVAL launch. The feasibility
  // bound says a hard beat needs a steep arrival: the crossing angle is capped
  // by the vertical velocity built falling INTO it (vy_in <= g*N/2). Today the
  // launch toward a hard beat is shaped by speed/elevation/amplitude but never
  // by the NEXT beat's impact ask -- so the rider often arrives flat and the
  // catch has nothing to redirect. Blend the launch toward the symmetric pop
  // arc (vy0 = -g*N/2 => arrival vy = +g*N/2, the bound's assumed maximum),
  // spanned across the attempt batch and cost-ranked like every other launch
  // lever. Same formula as the amplitude arc -- they agree when both fire.
  if (params.gap.nextImpact !== undefined && params.nextGapFrames !== null) {
    // Scarce-budget only: the pop arrivals add COMPLETABLE shapes at 50k
    // (slice: +50.5) but dilute converged high-budget quality (-8..-36) --
    // the same profile as the post-curve span. Fade full <=50k -> off >=100k.
    const budgetFade = compileBudgetFade(
      IMPACT_ARRIVAL_BUDGET_FADE_START_FRAMES,
      IMPACT_ARRIVAL_BUDGET_FADE_SPAN_FRAMES,
    );
    const arrivalPressure = budgetFade
      * smoothstep((params.gap.nextImpact - IMPACT_ARRIVAL_TARGET_START) / IMPACT_ARRIVAL_TARGET_SPAN);
    if (arrivalPressure > 0) {
      const blend = clamp(ccSpanBlends(params.attempt).launch, 0, 1) * arrivalPressure;
      // Shorten the grounded ride-out so the flight has the gap to build vy.
      ({ postAngleDeg, postLength } = blendPostTowardPopArc(
        postAngleDeg,
        postLength,
        params.nextGapFrames,
        params.targetState.velocity.x,
        blend,
        0.6,
      ));
    }
  }

  if (params.impactCurveP > 0) {
    const extraTurnDeg = impactPostTurnExtraDeg(
      params.targetState,
      params.targets.impact,
      params.contactAngleDeg,
      postAngleDeg,
      params.impactCurveP,
      params.attempt,
    );
    if (extraTurnDeg > 0) {
      postAngleDeg = clamp(
        postAngleDeg - extraTurnDeg,
        ELEVATION_POST_ANGLE_MIN,
        ELEVATION_POST_ANGLE_MAX,
      );
    }
  }

  if (
    params.attempt > 0
    && params.gap.nextImpact !== undefined
    && params.gap.nextImpact >= STEEP_ARRIVAL_MIN_ASK
    && params.nextGapFrames !== null
    && params.nextGapFrames > 4
  ) {
    const deltaMax = steepArrivalDeltaMaxDeg(
      params.targetState,
      params.gap.nextImpact,
      postAngleDeg,
      postLength,
      params.nextGapFrames,
    );
    if (deltaMax > 0.01) {
      const zeroBand =
        currentCompileBudgetFrames > 0 &&
          currentCompileBudgetFrames < STEEP_ARRIVAL_SCARCE_BUDGET_MAX_FRAMES
          ? STEEP_ARRIVAL_SCARCE_ZERO_BAND
          : steepArrivalMatureZeroBand();
      const spanRoll = Math.max(
        0,
        (lowDiscrepancyRoll(params.attempt, STEEP_ARRIVAL_SPAN_SALT) - zeroBand) /
          (1 - zeroBand),
      );
      const delta = deltaMax * spanRoll;
      if (delta > 0.01) {
        postAngleDeg = Math.min(postAngleDeg + delta, ELEVATION_POST_ANGLE_MAX);
      }
    }
  }

  return { postAngleDeg, postLength };
}

function steepArrivalDeltaMaxDeg(
  targetState: ImpactFrameTargetState,
  nextAsk: number,
  postAngleDeg: number,
  postLength: number,
  nextGapFrames: number,
): number {
  const v = Math.max(1, targetState.speed);
  const rideFrames = clamp(postLength / v, 0, nextGapFrames - 1);
  const flightFrames = nextGapFrames - rideFrames;
  const launchRad = (postAngleDeg * Math.PI) / 180;
  const vx = Math.max(1, v * Math.cos(launchRad));
  const vyArr = v * Math.sin(launchRad) + LAUNCH_GRAVITY_PX_PER_FRAME2 * flightFrames;
  const vArr = Math.max(1, Math.hypot(vx, vyArr));
  const arrDeg = (Math.atan2(vyArr, vx) * 180) / Math.PI;
  const needRad = Math.min(
    impactToRedirArcPx(nextAsk) / (STEEP_ARRIVAL_DELIVERY_EFFICIENCY * vArr),
    Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
  );
  const needDeg = Math.min((needRad * 180) / Math.PI, STEEP_ARRIVAL_ABS_CAP_DEG);
  return clamp(needDeg - arrDeg, 0, STEEP_ARRIVAL_DELTA_MAX_DEG);
}

function steepArrivalMatureZeroBand(): number {
  if (currentSteepArrivalSpecMaxImpact >= STEEP_ARRIVAL_HARD_IMPACT_PROFILE_MIN) {
    return STEEP_ARRIVAL_HARD_IMPACT_ZERO_BAND;
  }
  return STEEP_ARRIVAL_ZERO_BAND;
}

function impactTemplateLaneEligibility(
  targets: AxisValues,
  gapFrames: number,
  nextGapFrames: number | null,
  impactCurveP: number,
  budgetPressure: number,
  attempt: number,
): number {
  if (targets.impact === undefined) return 0;
  if (!impactTemplateVerticalCompatible(targets, gapFrames, nextGapFrames)) return 0;
  const pressureP = smoothstep(
    (impactCurveP - (IMPACT_TEMPLATE_MIN_PRESSURE - IMPACT_TEMPLATE_PRESSURE_RAMP_SPAN)) /
      IMPACT_TEMPLATE_PRESSURE_RAMP_SPAN,
  );
  const attemptP = smoothstep(
    (attempt - IMPACT_TEMPLATE_ATTEMPT_RAMP_START) / IMPACT_TEMPLATE_ATTEMPT_RAMP_SPAN,
  );
  const roomP = nextGapFrames === null
    ? 0
    : smoothstep((nextGapFrames - 4) / IMPACT_TEMPLATE_ROOM_SPAN_FRAMES);
  return clamp(
    IMPACT_TEMPLATE_LANE_RATE * budgetPressure * pressureP * attemptP * roomP,
    0,
    1,
  );
}

function impactTemplateVerticalCompatible(
  targets: AxisValues,
  gapFrames: number,
  nextGapFrames: number | null,
): boolean {
  const hasAmplitude = targets.amplitude !== undefined;
  const hasElevation = targets.elevation !== undefined;
  if (!hasAmplitude && !hasElevation) return true;
  if (hasAmplitude && hasElevation) return true;
  if (hasAmplitude) return impactTemplateHasHopRoom(gapFrames, nextGapFrames);
  return false;
}

function impactTemplateHasHopRoom(gapFrames: number, nextGapFrames: number | null): boolean {
  return nextGapFrames !== null
    && gapFrames >= IMPACT_TEMPLATE_HOP_MIN_ROOM_FRAMES
    && nextGapFrames >= IMPACT_TEMPLATE_HOP_MIN_ROOM_FRAMES;
}

type ContactCenteredRedirAngleShiftBase = {
  targetState: ImpactFrameTargetState;
  targetImpact: number | undefined;
  contactAngleDeg: number;
  attempt: number;
};

type ContactCenteredRedirAngleShiftParams =
  | (ContactCenteredRedirAngleShiftBase & { kind: "contact" })
  | (ContactCenteredRedirAngleShiftBase & {
    kind: "entry";
    gapFrames: number;
    nextGapFrames: number | null;
  });

function contactCenteredRedirAngleShiftDeg(params: ContactCenteredRedirAngleShiftParams): number {
  if (params.targetImpact === undefined) return 0;

  const entryShift = params.kind === "entry";
  const mature = compileBudgetPressure(
    entryShift
      ? CONTACT_CENTERED_REDIR_ENTRY_BUDGET_START_FRAMES
      : CONTACT_CENTERED_REDIR_CONTACT_BUDGET_START_FRAMES,
    entryShift
      ? CONTACT_CENTERED_REDIR_ENTRY_BUDGET_SPAN_FRAMES
      : CONTACT_CENTERED_REDIR_CONTACT_BUDGET_SPAN_FRAMES,
  );
  const speedPressure = smoothstep(
    (params.targetState.speed - CONTACT_CENTERED_REDIR_CONTACT_SPEED_START_PX) /
      CONTACT_CENTERED_REDIR_CONTACT_SPEED_SPAN_PX,
  );
  if (mature <= 0 || speedPressure <= 0) return 0;

  let densePressure = 1;
  if (entryShift) {
    const spacingFrames = Math.min(
      Math.max(1, params.gapFrames),
      params.nextGapFrames === null ? ARC_LEN_ROOM_SPARSE_FRAMES : Math.max(1, params.nextGapFrames),
    );
    densePressure = 1 - smoothstep(
      (spacingFrames - ARC_LEN_ROOM_DENSE_FRAMES) /
        (ARC_LEN_ROOM_SPARSE_FRAMES - ARC_LEN_ROOM_DENSE_FRAMES),
    );
    if (densePressure <= 0) return 0;
  }

  const deltaDeg = normalizeAngleDeg(params.contactAngleDeg - params.targetState.angleDeg);
  const turn = redirMissingTurnDeg(params.targetState, params.targetImpact, Math.abs(deltaDeg), {
    targetStart: entryShift
      ? CONTACT_CENTERED_REDIR_ENTRY_TARGET_START
      : CONTACT_CENTERED_REDIR_CONTACT_TARGET_START,
    targetSpan: entryShift
      ? CONTACT_CENTERED_REDIR_ENTRY_TARGET_SPAN
      : CONTACT_CENTERED_REDIR_CONTACT_TARGET_SPAN,
    predictedDeltaDeg: deltaDeg,
  });
  if (turn === null) return 0;

  const cappedShiftDeg = clamp(
    turn.missingDeltaDeg,
    0,
    entryShift
      ? CONTACT_CENTERED_REDIR_ENTRY_SHIFT_MAX_DEG
      : CONTACT_CENTERED_REDIR_CONTACT_SHIFT_MAX_DEG,
  );
  const shiftDeg = cappedShiftDeg
    * mature * speedPressure * densePressure * turn.targetPressure * clamp(ccSpanBlends(params.attempt).launch, 0, 1);
  return entryShift ? shiftDeg : -shiftDeg;
}

/** Pressure [0,1] for the impact-driven curvature modulation: ramps with the
 *  ceiling-saturated impact target and gates on having enough incoming speed for a
 *  redirection to read as impact (redir = speed·sin(turn)). No budget gate — unlike the
 *  contact-angle nudge this is meant to work at every budget, and it explicitly overrides
 *  the high-budget curvature fade. Returns 0 when no impact is authored. */
function impactCurvePressure(
  targetState: ImpactFrameTargetState,
  targetImpact: number | undefined,
): number {
  if (targetImpact === undefined) return 0;
  const target = Math.min(targetImpact, impactCeiling(targetState.speed));
  const targetStart = impactCurveTargetStart(target);
  const targetPressure = smoothstep(
    (target - targetStart) / IMPACT_CURVE_TARGET_SPAN,
  );
  const speedPressure = smoothstep(
    (targetState.speed - IMPACT_CURVE_SPEED_START_PX) / IMPACT_CURVE_SPEED_SPAN_PX,
  );
  return clamp(targetPressure * speedPressure, 0, 1);
}

function impactCurveTargetStart(targetImpact: number): number {
  const maturePressure = compileBudgetPressure(
    IMPACT_CURVE_ELEVATION_ROOM_BUDGET_START_FRAMES,
    IMPACT_CURVE_ELEVATION_ROOM_BUDGET_SPAN_FRAMES,
  );
  const localReliefPressure = smoothstep(
    (targetImpact - IMPACT_CURVE_HIGH_SPEED_RELIEF_TARGET_START) /
      IMPACT_CURVE_HIGH_SPEED_RELIEF_TARGET_SPAN,
  );
  const profilePressure = currentImpactProfilePressures.elevationRoom *
    (1 - currentImpactProfilePressures.highSpeedRelief * localReliefPressure) *
    maturePressure;
  return lerp(IMPACT_CURVE_TARGET_START, IMPACT_CURVE_ELEVATION_ROOM_TARGET_START, profilePressure);
}

function predictedRedirImpactAtAngleDelta(speedPx: number, deltaDeg: number): number {
  const deltaRad = (deltaDeg * Math.PI) / 180;
  return normImpact(Math.abs(deltaRad) * Math.max(0, speedPx)); // redirArc = v·Δθ → felt [0,1]
}

/** Inverse of the redirArc metric: the CoM turn (degrees) a landing must deliver to achieve
 *  `target` impact at `speed` — Δθ = (target redirArc px)/speed, clamped to the catchable
 *  turn (`asin(CATCHABLE_REDIR_FRACTION)`, same ceiling impactCeiling uses). Single source
 *  for the three redir levers (contact-shift, entry-shift, post-turn). */
function neededTurnDegForImpact(target: number, speedPx: number): number {
  const turnRad = clamp(
    impactToRedirArcPx(target) / Math.max(1, speedPx),
    0,
    Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
  );
  return (turnRad * 180) / Math.PI;
}

function axisDeltaDeg(aDeg: number, bDeg: number): number {
  const d = Math.abs(normalizeAngleDeg(aDeg - bDeg));
  return d > 90 ? 180 - d : d;
}

type RedirMissingTurnConfig = {
  targetStart: number;
  targetSpan: number;
  minMissingDeg?: number;
  predictedDeltaDeg?: number;
};

function redirMissingTurnDeg(
  targetState: ImpactFrameTargetState,
  targetImpact: number,
  currentDeltaDeg: number,
  config: RedirMissingTurnConfig,
): { missingDeltaDeg: number; targetPressure: number } | null {
  const target = Math.min(targetImpact, impactCeiling(targetState.speed));
  const targetPressure = smoothstep((target - config.targetStart) / config.targetSpan);
  if (targetPressure <= 0) return null;

  if (config.predictedDeltaDeg !== undefined) {
    const currentPredicted = predictedRedirImpactAtAngleDelta(targetState.speed, config.predictedDeltaDeg);
    const missingImpact = target - currentPredicted;
    if (missingImpact <= 0) return null;
  }

  const neededDeltaDeg = neededTurnDegForImpact(target, targetState.speed);
  const missingDeltaDeg = neededDeltaDeg - currentDeltaDeg;
  if (missingDeltaDeg <= (config.minMissingDeg ?? 0)) return null;
  return { missingDeltaDeg, targetPressure };
}

function impactPostTurnExtraDeg(
  targetState: ImpactFrameTargetState,
  targetImpact: number | undefined,
  contactAngleDeg: number,
  postAngleDeg: number,
  impactCurveP: number,
  attempt: number,
): number {
  if (targetImpact === undefined) return 0;
  const mature = compileBudgetPressure(
    IMPACT_POST_TURN_BUDGET_START_FRAMES,
    IMPACT_POST_TURN_BUDGET_SPAN_FRAMES,
  );
  if (mature <= 0) return 0;

  const currentDeltaDeg = Math.max(
    axisDeltaDeg(contactAngleDeg, targetState.angleDeg),
    axisDeltaDeg(postAngleDeg, targetState.angleDeg),
  );
  const turn = redirMissingTurnDeg(targetState, targetImpact, currentDeltaDeg, {
    targetStart: IMPACT_POST_TURN_TARGET_START,
    targetSpan: IMPACT_POST_TURN_TARGET_SPAN,
    minMissingDeg: IMPACT_POST_TURN_MIN_MISSING_DEG,
  });
  if (turn === null) return 0;

  const span = clamp(ccSpanBlends(attempt).launch, 0, 1);
  const sampleStrength = 0.25 + 0.75 * span;
  const pressure = mature * turn.targetPressure * Math.sqrt(clamp(impactCurveP, 0, 1));
  return clamp(turn.missingDeltaDeg * sampleStrength * pressure, 0, IMPACT_POST_TURN_MAX_EXTRA_DEG);
}

function normalizeAngleDeg(deg: number): number {
  let out = deg % 360;
  if (out > 180) out -= 360;
  if (out < -180) out += 360;
  return out;
}

function guideContactCenteredRolls(
  rolls: ContactCenteredRolls,
  targetState: ImpactFrameTargetState,
  targets: AxisValues,
  gap: Gap,
  allContactFrames: readonly number[],
  attempt: number,
): ContactCenteredRolls {
  const {
    air,
    denseContactPressure,
    deadlinePressure,
    absoluteSpeedPressure,
    brakePressure,
    accelPressure,
    speedCarryPressure,
  } = contactCenteredPressures(targetState, targets, gap, allContactFrames);
  const scarcity = Math.max(deadlinePressure, denseContactPressure);

  const guided: ContactCenteredRolls = {
    segmentLengthRoll: targets.grain === undefined
      ? clamp(0.42 + 0.12 * denseContactPressure - 0.08 * air, 0.20, 0.80)
      : 0.50,
    contactAngleRoll: clamp(
      0.50 - 0.08 * brakePressure + 0.06 * accelPressure + 0.04 * denseContactPressure, 0.24, 0.76,
    ),
    preLengthRoll: clamp(
      0.36 + 0.18 * brakePressure - 0.18 * scarcity + 0.08 * absoluteSpeedPressure, 0.10, 0.82,
    ),
    postLengthRoll: clamp(
      0.24 + 0.48 * (1 - air) + 0.14 * speedCarryPressure
        + 0.08 * brakePressure - 0.22 * denseContactPressure, 0.08, 0.90,
    ),
    preAngleRoll: clamp(0.50 - 0.10 * deadlinePressure - 0.06 * brakePressure, 0.22, 0.78),
    postAngleRoll: clamp(
      0.48 + 0.10 * accelPressure + 0.08 * speedCarryPressure
        - 0.06 * air + 0.04 * denseContactPressure, 0.22, 0.82,
    ),
    tangentJitterRoll: 0.50,
    normalJitterRoll: 0.50,
  };

  const guide = contactCenteredGuideWeight(attempt);
  return {
    segmentLengthRoll: ccGuidedRoll(rolls.segmentLengthRoll, guided.segmentLengthRoll, attempt, 0, guide),
    contactAngleRoll: ccGuidedRoll(rolls.contactAngleRoll, guided.contactAngleRoll, attempt, 1, guide),
    preLengthRoll: ccGuidedRoll(rolls.preLengthRoll, guided.preLengthRoll, attempt, 2, guide),
    postLengthRoll: ccGuidedRoll(rolls.postLengthRoll, guided.postLengthRoll, attempt, 3, guide),
    preAngleRoll: ccGuidedRoll(rolls.preAngleRoll, guided.preAngleRoll, attempt, 4, guide),
    postAngleRoll: ccGuidedRoll(rolls.postAngleRoll, guided.postAngleRoll, attempt, 5, guide),
    tangentJitterRoll: ccGuidedRoll(
      rolls.tangentJitterRoll, guided.tangentJitterRoll, attempt, 6, guide,
      CONTACT_CENTERED_GUIDED_POINT_SPREAD,
    ),
    normalJitterRoll: ccGuidedRoll(
      rolls.normalJitterRoll, guided.normalJitterRoll, attempt, 7, guide,
      CONTACT_CENTERED_GUIDED_POINT_SPREAD,
    ),
  };
}

function contactCenteredGuideWeight(attempt: number): number {
  const scaled = Math.max(0, attempt) / CONTACT_CENTERED_GUIDED_DECAY_ATTEMPTS;
  return 1 / (1 + scaled * scaled);
}

function ccGuidedRoll(
  raw: number,
  center: number,
  attempt: number,
  salt: number,
  weight: number,
  spread = CONTACT_CENTERED_GUIDED_ROLL_SPREAD,
): number {
  const guided = clamp(center + (lowDiscrepancyRoll(attempt, salt) - 0.5) * spread, 0, 1);
  return clamp(lerp(raw, guided, weight), 0, 1);
}

/** Per-attempt span blends for launch shaping and ride-out length. 2-D (work-new
 *  default): launch and length vary INDEPENDENTLY over a 16-step grid (8 coupled
 *  diagonal + 8 anti-diagonal) so the pool covers off-diagonal (launch × length)
 *  points the 1-D diagonal never reaches — more diverse valid continuations per gap. */
function ccSpanBlends(attempt: number): { launch: number; length: number } {
  const a = ((attempt % 4096) + 4096) % 4096;
  const k = a % 16;
  if (k < 8) {
    const b = k / 7;
    return { launch: b, length: b };
  }
  const b = (k - 8) / 7;
  return { launch: b, length: clamp(1 - b, 0, 1) };
}

function denseSpacingPostLengthCap(
  targetSpeed: number,
  nextGapFrames: number | null,
  air: number,
  denseContactPressure: number,
  arcLenRoom: number,
): number {
  if (nextGapFrames === null) return DENSE_SPACING_POST_LENGTH_NEUTRAL_CAP;
  const capPressure = clamp(denseContactPressure * (1 - arcLenRoom), 0, 1);
  if (capPressure <= 0) return DENSE_SPACING_POST_LENGTH_NEUTRAL_CAP;
  const denseCap = clamp(
    targetSpeed *
      nextGapFrames *
      (
        DENSE_SPACING_POST_LENGTH_SPEED_SCALE +
        DENSE_SPACING_POST_LENGTH_LOW_AIR_SCALE * (1 - air)
      ),
    DENSE_SPACING_POST_LENGTH_MIN_CAP,
    DENSE_SPACING_POST_LENGTH_MAX_CAP,
  );
  return lerp(DENSE_SPACING_POST_LENGTH_NEUTRAL_CAP, denseCap, capPressure);
}

function buildPreContactLines(
  lineIdStart: number,
  contactPoint: { x: number; y: number },
  startAngleDeg: number,
  endAngleDeg: number,
  length: number,
  segments: number,
  finalSegmentAngleDeg = endAngleDeg,
): TrackLine[] {
  if (segments <= 0 || length <= 0) return [];
  const segLen = length / segments;
  const dxs = new Array<number>(segments);
  const dys = new Array<number>(segments);
  let totalX = 0;
  let totalY = 0;
  for (let i = 0; i < segments; i++) {
    const t = segments === 1 ? 1 : i / (segments - 1);
    const angleDeg = i === segments - 1 ? finalSegmentAngleDeg : lerp(startAngleDeg, endAngleDeg, t);
    const a = (angleDeg * Math.PI) / 180;
    const dx = Math.cos(a) * segLen;
    const dy = Math.sin(a) * segLen;
    dxs[i] = dx;
    dys[i] = dy;
    totalX += dx;
    totalY += dy;
  }

  let x = contactPoint.x - totalX;
  let y = contactPoint.y - totalY;
  const lines = new Array<TrackLine>(segments);
  for (let i = 0; i < segments; i++) {
    const x2 = i === segments - 1 ? contactPoint.x : x + dxs[i];
    const y2 = i === segments - 1 ? contactPoint.y : y + dys[i];
    lines[i] = makeSolidLine(lineIdStart + i, x, y, x2, y2);
    x = x2;
    y = y2;
  }
  return lines;
}

function buildPostContactLines(
  lineIdStart: number,
  contactPoint: { x: number; y: number },
  startAngleDeg: number,
  endAngleDeg: number,
  length: number,
  segments: number,
  curveBias = 0,
  firstSegmentAngleDeg = startAngleDeg,
): TrackLine[] {
  const segLen = length / segments;
  let x = contactPoint.x;
  let y = contactPoint.y;
  const lines = new Array<TrackLine>(segments);
  for (let i = 0; i < segments; i++) {
    const t = segments === 1 ? 1 : i / (segments - 1);
    const ft = curveBias === 0 ? t : applyArcCurveBias(t, curveBias);
    const angleDeg = i === 0 ? firstSegmentAngleDeg : lerp(startAngleDeg, endAngleDeg, ft);
    const a = (angleDeg * Math.PI) / 180;
    const x2 = x + Math.cos(a) * segLen;
    const y2 = y + Math.sin(a) * segLen;
    lines[i] = makeSolidLine(lineIdStart + i, x, y, x2, y2);
    x = x2;
    y = y2;
  }
  return lines;
}

export function hasPreTargetSledProximity(
  // deno-lint-ignore no-explicit-any
  baseEngine: any,
  gap: Gap,
  lines: TrackLine[],
): boolean {
  return hasPreTargetSledProximityFromTrace(
    readPreTargetSledTrace(baseEngine, gap),
    lines,
  );
}

// deno-lint-ignore no-explicit-any
export function readPreTargetSledTrace(
  baseEngine: any,
  gap: Gap,
): PreTargetSledTrace {
  const firstFrame = Math.max(0, gap.startFrame);
  const lastFrame = gap.endFrame - 2;
  return appendSledPointPositionsRangeMetered(baseEngine, firstFrame, lastFrame, []);
}

export function hasPreTargetSledProximityFromTrace(
  trace: PreTargetSledTrace,
  lines: TrackLine[],
): boolean {
  if (lines.length === 0) return false;
  const riskLines = makeSegmentCollisionRiskLines(lines);
  for (let i = 0; i < trace.length; i += 2) {
    const px = trace[i];
    const py = trace[i + 1];
    for (let j = 0; j < riskLines.length; j += SEGMENT_COLLISION_RISK_STRIDE) {
      const x1 = riskLines[j];
      const y1 = riskLines[j + 1];
      const dx = riskLines[j + 2];
      const dy = riskLines[j + 3];
      const len = riskLines[j + 4];
      const lenSq = riskLines[j + 5];
      const ox = px - x1;
      const oy = py - y1;
      const along = (ox * dx + oy * dy) / lenSq;
      if (along < 0 || along > 1) continue;
      const signedDistance = (dx * oy - dy * ox) / len;
      const collidableSideDistance = riskLines[j + 6] !== 0 ? signedDistance : -signedDistance;
      if (
        collidableSideDistance >= 0 &&
        Math.abs(signedDistance) <= PRE_TARGET_PRECLEAR_DISTANCE
      ) {
        return true;
      }
    }
  }
  return false;
}

function makeSegmentCollisionRiskLines(lines: TrackLine[]): SegmentCollisionRiskLines {
  const riskLines: SegmentCollisionRiskLines = [];
  for (const line of lines) {
    const dx = line.x2 - line.x1;
    const dy = line.y2 - line.y1;
    const len = Math.hypot(dx, dy);
    if (len <= 0) continue;
    riskLines.push(
      line.x1,
      line.y1,
      dx,
      dy,
      len,
      len * len,
      line.flipped ? 1 : 0,
    );
  }
  return riskLines;
}

function framesUntilNextContact(gap: Gap, allContactFrames: readonly number[]): number | null {
  const next = allContactFrames.find((frame) => frame > gap.endFrame);
  return next === undefined ? null : next - gap.endFrame;
}

function applyArcCurveBias(t: number, bias: number): number {
  if (bias === 0) return t;
  if (bias > 0) return Math.pow(t, 1 + bias);
  return 1 - Math.pow(1 - t, 1 - bias);
}

function incrementCounter(key: keyof ArcPlacementCounter, mode?: CandidateSampleMode): void {
  arcPlacementStats[key]++;
  if (mode !== undefined) arcPlacementStats.by_sample_mode[mode][key]++;
}

// Field-agnostic so a counter added to ArcPlacementCounter + makeArcPlacementCounter
// is reset automatically (no third edit site to forget — cf. resetAimStats). `fresh`
// carries the all-zero source and the full key set; ArcPlacementCounter is a flat
// numeric record.
function resetCounter(target: ArcPlacementCounter, fresh: ArcPlacementCounter): void {
  for (const key of Object.keys(fresh) as (keyof ArcPlacementCounter)[]) {
    target[key] = fresh[key];
  }
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

function clampInt(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.floor(x)));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(t: number): number {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
}

function fract(x: number): number {
  return x - Math.floor(x);
}
