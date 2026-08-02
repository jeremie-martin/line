/**
 * Target-state arc placement.
 *
 * This file intentionally keeps only the reliable part of the former placement
 * stack: reading the rider state at the target beat. Geometry generation starts
 * from that state, emits one small line-native catch fragment, and lets
 * `core/candidate.ts` validate landing, survival, off-beat behavior, and axis
 * quality in the engine.
 *
 * NOT BUDGET-AWARE. Geometry here is a pure function of the beat, the arriving
 * rider state and the attempt index — the compile budget is not an input.
 *
 * It used to be. Eleven reads of a per-compile budget global fed ten smoothstep
 * ramps and one hard `< 200_000` threshold, and every one of them was pinned at
 * its mature value at or below 250k frames: identical geometry from the
 * benchmark's lowest tier all the way to 5M, differing only across 50k–200k,
 * a band nothing but the golden v1 evidence tiers and dev iteration still
 * visits. They presented as adaptive and were constants. Deleted in the 2026-08
 * budget-unification Phase 3; the mature branch now ships unconditionally.
 *
 * Evidence for the deletion, as one bundle (`arc_placement.ts` only):
 *  - byte-identity at the budgets that decide — 40/40 golden track hashes
 *    unchanged at 250k and 750k over 10 specs × 2 seeds, all scores identical
 *    to the digit. 20/20 hashes DID change at 150k, so the instrument was live.
 *  - sub-250k behaviour change, golden v1 {75k, 150k, 225k} × 40 specs × 12
 *    seeds (1440 paired compiles): pooled Δ −0.18 points, spec-clustered
 *    bootstrap SE 0.98, 95% CI [−2.11, +1.72]; per tier −0.28 / +0.07 / −0.33.
 *    Zero contract-pass flips, identical validity, identical missing-contact
 *    counts at every tier. Parity, and the eleven ramps bought nothing there.
 *
 * If a future controller genuinely needs geometry to see the budget, add one
 * signal with a stated law and a measurement — do not resurrect a ramp.
 */

import {
  appendSledPointPositionsRangeMetered,
  getRiderMetered,
  MIN_LANDING_AIRBORNE_FRAMES,
} from "../lib/detector.ts";
import { registerCompileReset } from "./core/compile_lifecycle.ts";
import { makeSolidLine } from "./arc.ts";
import {
  planSupportGeometry,
  supportReferenceLength,
  supportGeometryMode,
  type SupportGeometryMode,
  type SupportGeometryPlan,
} from "./core/support_geometry.ts";
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
  IMPACT_WINDOW,
  impactEnvNum,
  impactToRawPx,
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
const CONTACT_CENTERED_REDIR_ENTRY_SHIFT_MAX_DEG = 10;
const CONTACT_CENTERED_REDIR_ENTRY_TARGET_START = 0.30;
const CONTACT_CENTERED_REDIR_ENTRY_TARGET_SPAN = 0.25;
// Impact-driven post-contact CURVATURE. The redir metric rewards
// the catch surface ROTATING the CoM velocity through the ~6-frame window
// (empirically: achieved impact ≈ turnNetDeg ρ0.98, driven by tangentChangeDeg +
// tangentDeltaDeg; catchability is NOT the limiter up to ~36° turn). The shipped ±4°
// contact-angle nudge moves the contact INSTANT, not the through-window rotation, so it
// leaves achieved impact flat. This third modulation (alongside elevation/amplitude)
// instead drives the SUSTAINED curvature: it flattens the contact angle into a scoop
// (raises tangentDelta) and FRONT-LOADS the contact→post rotation into the window
// (negative curveBias) — impact beats are the only beats that get any curve bias at
// all. RNG-neutral (curvature uses the deterministic low-discrepancy roll, not the
// rng() stream).
// Ramp retuned for the envelope ruler (2026-06-09): scored targets on previously
// conflicted beats now sit at 0.45-0.65 (was ~0.85), where the old 0.45-start ramp
// delivered ~zero pressure. Start 0.25 puts ~0.7 pressure at a 0.5 ask.
//
// The onset was swept in both directions on 2026-07-26 and 0.25 is a real
// optimum, not an inherited guess: at N=8 against the closed-form baseline, an
// onset of 0 with full pressure at 0.65 / 0.45 / 0.30 gives -0.83 / -20.68 /
// -38.77, and onsets of 0.35 / 0.45 / off give -6.69 / -12.50 / -69.55. More
// pressure lifts a mid-band ask exactly as intended (delivered +0.014 to +0.053)
// and costs more than it gains: the scoop BRAKES (speed bias -0.026 to -0.080)
// and flattens the launch the next contact must arrive on (its impact -0.043 to
// -0.076). Less pressure trades the other way. The ablation also prices the
// whole carrier at +69.5 headline and shows its scoop is what costs
// frontier_dense_recovery its validity (0 -> 14 of 24 with the carrier off).
// RE-SWEPT 2026-07-27 on top of the steep-arrival defaults, because the scoop's
// cost is arrival-dependent — bending a flat trajectory brakes, converting an
// already-vertical one need not — so the optimum could have moved. It did not:
// onset 0.15 is -0.23 and onset 0 with full pressure at 0.65 is +0.54, both with
// representative -10.66 and -13.20. The ramp is closed at 0.25.
const IMPACT_CURVE_TARGET_START = 0.25;
const IMPACT_CURVE_TARGET_SPAN = 0.40;
const IMPACT_CURVE_ELEVATION_ROOM_TARGET_START = 0.20;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_TARGET_START = 0.52;
const IMPACT_CURVE_HIGH_SPEED_RELIEF_TARGET_SPAN = 0.10;
const IMPACT_CURVE_SPEED_START_PX = 6;
const IMPACT_CURVE_SPEED_SPAN_PX = 4;
// Ablation (2026-06-10): this curvature modulation is THE impact carrier (+53
// headline; the angle-shift mechanisms are ±2). On the OLD saturating v·sinΔθ metric the
// surface peaked at flatten 12° / frontload 1.2 (flatten 18 → 579, frontload 1.4 → 581 —
// deeper was WORSE, because sin saturated near 90° so extra scoop bought nothing).
// RE-FIT 2026-06-15 for the LINEAR redirArc = v·Δθ metric (SOFT=0, VSTRONG=7.29 at the
// time; the scored metric has since been promoted to the accumulated impulse and VSTRONG
// to the live IMPACT_RULER.VERY_STRONG — the numbers below are the measurements as taken): with no
// angular saturation, deeper scoop now PAYS. eval_impact board (13 specs × 9 seeds, 150k/300k)
// brackets BOTH knobs with overshoot on each side — flatten {0:−36.6, 12:base, 18:+2.4,
// 24:−12.1}, frontload {1.2:+2.4, 1.6:+4.1, 2.0:+2.7} — so the peak moved up to flatten 18 /
// frontload 1.6 (Δ+4.1 vs old 12/1.2, positive at both budgets, 100% validity; INDICATIVE
// probe tier, canonical run to promote). Onset held at 0.25 (start 0.10 → −9.6, over-scoops).
// Re-measured 2026-07-27 against the steep-arrival defaults, on the argument
// that impact is scored over a 6-frame window so a turn taken sharply scores
// more than the same turn spread out. Both are still at their optimum:
// front-load 2.0 is +1.75 and 2.4 is -2.13 (noise either side), flatten 22 is
// -13.56 with representative -17.76, and the pair together -13.03. The limit is
// not how the existing rotation is distributed.
/**
 * Divisor on the sampled arc segment length where grain is unauthored, so the
 * WHOLE arc is built from finer lines. Off, and it bounds the refinement lever:
 * the accepted post-contact subdivision does not generalise. Measured 2026-07-27
 * at 1.5 / 2 / 3 against `segment-refine`: -1.89 / -2.40 / -0.79 headline with
 * representative -0.37 / -0.46 / +0.09 and the axis biases unmoved to three
 * decimals. Refining the segments the rider rides BEFORE and BETWEEN contacts
 * buys nothing; only the ones that carry the redirection do.
 */
const SEGMENT_LENGTH_REFINE = 1;
/**
 * Degrees of incidence the contact surface must make across the arrival heading,
 * applied as a one-sided FLOOR so it binds only on glancing contacts. OFF, and
 * it closes the glancing population as a lever.
 *
 * The floor binds as designed — mid-band incidence 1.78 -> 3.07 -> 6.61 -> 10.29
 * degrees at caps of off / 5 / 8 / 12 — and delivered impact FALLS with it,
 * 0.291 -> 0.260 -> 0.247 -> 0.234, while the measured turn also falls
 * (11.3 -> 10.2 degrees) DESPITE the incidence rising. The mechanism is visible
 * in the window: give-back climbs 0.002 -> 0.012 and the peak stops being at the
 * deadline, 90% -> 63%. Forcing a surface across the arrival makes those contacts
 * EJECT rather than redirect — the rider is thrown and free-flight rotation
 * unwinds the turn before it is read.
 *
 * So the ~1 degree the glancing 22% meet their surface at is what those contacts
 * can sustain, not a command the compiler failed to give.
 */
const IMPACT_MIN_INCIDENCE_DEG = 0;
/**
 * Amplitude ask below which the pop-arc shaping is not commanded at all, and the
 * share of the commanded blend every pool member carries. Both shipped, and they
 * settle whether the 2026-07-27 dive result was a PATTERN or a fact about that
 * one lever.
 *
 * It was the lever. Deleting the dive's ask floor was +19.09 and lifting its
 * attempt span to 0.5..1 was +21.36; the same two moves here are -1.16 and -0.85,
 * with `development_music` significantly negative in both (-3.93, -4.69), even
 * though the amplitude bias does improve slightly (-0.1251 -> -0.1207). The
 * ride-out length's analogue behaved the same way (+5.00 at a 0.5 span floor,
 * -2.02 at full blend strength).
 *
 * So "the physically-derived shape is reserved to part of the attempt span, and
 * should not be" is NOT a general principle of this sampler. Only the arrival
 * carried it, which is consistent with the arrival being the one input the scored
 * impact reads directly.
 */
const AMP_ONSET = 0.30;
const AMP_SPAN_FLOOR = 0;
/**
 * Extra post-contact subdivision per unit of the contact's impact ask, so the
 * commanded turn arrives through more and smaller collision impulses.
 *
 * Measured 2026-07-27 at N=8 against `dive-span-floor`, the ladder separates by
 * SHAPE rather than by headline: 1 / 2 / 3 give +6.42 / +3.70 / +0.82 overall,
 * while `representative` rises monotonically +1.33 / +3.83 / +5.09 and
 * `development_music` with it +5.00 / +8.09 / +9.06, and `capability` — the
 * stratum whose interval spans +/-90 at this seed count — falls +36.05 / +3.62 /
 * -23.84 and carries the headline with it. 2 is the only rung with no stratum
 * negative and two significantly positive.
 *
 * It is also the only arm in the campaign that moves EVERY axis the same way:
 * speed bias -0.0226 -> -0.0124 and its rms 0.0985 -> 0.0841, air, impact and
 * amplitude all better, and the contact speed measured by
 * `npm run study:impact-window` rises 10.55 -> 10.72 while the turn holds. That
 * is what the frontier predicts a smoother turn should do, and it is why this
 * lever is not the eleven that came before it.
 */
const IMPACT_SEGMENT_REFINE = 2;
/**
 * Upper bound on the energy-targeted launch's downward velocity, as a fraction
 * of `g * N`. It is what BINDS on dense specs, and opening it changes nothing.
 *
 * Measured 2026-07-27 at 0.45 / 0.7 / 1.0: delivered impact 0.283 / 0.284 /
 * 0.289 and the speed one frame before the contact 10.55 / 10.54 / 10.49. The
 * pool gains steeper-launch candidates and the SEARCH does not commit them.
 *
 * With the turn side near-conserved (see `IMPACT_INCIDENCE_AIM`), that closes
 * both factors of `v * dtheta` from opposite directions: pushing the angle is
 * cancelled by braking, pushing the speed is cancelled by selection. The
 * compiler sits on the efficient frontier of this metric, and moving it needs
 * something other than a stronger single-axis command.
 */
const LAUNCH_DESCENT_CAP = 0.45;
/**
 * Fraction of the gap's speed ask added to the ENERGY target per unit of the
 * next contact's impact ask, so the rider would arrive above its own gap mean —
 * impact the gap-mean speed axis cannot see. OFF, and byte-identical at 0.15 and
 * 0.30 because the launch is already saturated at `LAUNCH_DESCENT_CAP`: the
 * energy target wants vy ~= 1.46 on a dense gap against a cap of 0.79, so
 * raising it only pushes further past a clamp. Kept at 0 with the reason
 * recorded, because the idea is sound and the obstacle is the cap below.
 */
const IMPACT_ARRIVAL_SPEED_GAIN = 0;
/**
 * Strength of the incidence-targeted contact angle. OFF — and the reason is the
 * most useful thing measured on 2026-07-27.
 *
 * It does what it says: aiming the contact surface at the incidence the ask
 * needs raises the engaged incidence from 13.26 to 14.98 degrees at strength 0.5
 * and the turn at the deadline from 11.1 to 13.1. The speed one frame before the
 * contact falls from 10.16 to 8.13 in the same arm, and the scored impact is
 * `v * dtheta`, so the product is flat to negative (0.283 -> 0.275). At strength
 * 1 the compiler stops hitting its contacts at all: 41 of 240 authored contacts
 * still land.
 *
 * Bending the trajectory costs speed at close to the rate it buys angle, so
 * `redirArc` is near-conserved along this axis. That is one frontier, and it is
 * why the carrier ramp (both directions, twice), the flatten, the front-load,
 * the post-turn widening, the template gates and this all measure flat or
 * negative: they are the same trade found repeatedly.
 *
 * What it does NOT close: `v` here is the speed one frame before the contact,
 * while the speed AXIS scores the mean over the gap. Arriving above one's own
 * gap mean is impact the speed axis cannot see, and nothing in the compiler
 * aims for it.
 */
const IMPACT_INCIDENCE_AIM = 0;
const IMPACT_CURVE_FLATTEN_DEG = 18;
const IMPACT_CURVE_FRONTLOAD = 1.6;
// Impact POST-TURN sampler.
// The curve modulation can only front-load whatever contact→post rotation already
// exists. Remaining misses show contact runs are long enough but
// tangentChangeDeg is near zero, so add a normal candidate-family variant that
// widens the post-contact angle by the ceiling-aware missing redirection angle.
// Spanned by attempt, so selection can keep normal launches.
// Widening the post-contact launch angle does NOT manufacture redirection, and
// the 0.60 restriction below is therefore not the limit it looks like. Measured
// 2026-07-26: opening this lever to mid-band asks (onset 0.15) and removing its
// carrier-pressure factor moves the impact bias by 0.004 and costs 21.93
// headline with 20 lost valid runs. The reason is physical and rules out a whole
// family of ideas — after the catch the rider LEAVES the surface, so a wider
// post-contact angle just drops the line away beneath it. Redirection can only
// come from velocity the surface can still turn, which means it must come from
// the ARRIVAL (see the steep-arrival block below).
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

// The template is the CONVERTING half of the impact mechanism: the dive supplies
// the vertical velocity and this valley is the surface that turns it. Its gates
// were re-measured on 2026-07-27 against the steep-arrival defaults, on the
// theory that steeper arrivals should want more converting catches. They do not:
// lane rate 0.66 is -4.06, attempt ramp 2 is -6.63, arrival angle 4 is -5.50,
// all three together -17.47, and dropping the pressure gate to 0.2 is inert
// (+0.34, SE 0.38). Every gate is at or past its optimum.
const IMPACT_TEMPLATE_MIN_PRESSURE = 0.35;
const IMPACT_TEMPLATE_LANE_RATE = 1 / 3;
const IMPACT_TEMPLATE_ATTEMPT_RAMP_START = 6;
const IMPACT_TEMPLATE_ATTEMPT_RAMP_SPAN = 4;
// Arrival-conditioned firing path (2026-07-15). The carrier-pressure gate
// above makes the template a hard-ask lane (impactCurveP > 0.25 ⇒ ask ≥
// ~0.45), and the late attempt ramp keeps it invisible to branch-1 rollouts.
// The V1 funnel evidence (docs/IMPACT_PAIR_PLANNING.md) and five fresh V2
// scope falsifications agree: commanded turn converts to windowed redirection
// only when the arrival is actually steep (vy at contact), and steep launches
// keep losing forward-eval because no converting catch exists downstream at
// moderate asks. This second eligibility path therefore fires the SAME
// template on the measured arrival state — a real dive into an authored
// impact — at early attempts, independent of the carrier's ask ramp. Normal
// candidates remain; the exact evaluator and ranker still choose.
const IMPACT_TEMPLATE_ARRIVAL_ANGLE_START_DEG = 8;
const IMPACT_TEMPLATE_ARRIVAL_ANGLE_SPAN_DEG = 8;
const IMPACT_TEMPLATE_ARRIVAL_ASK_START = 0.12;
const IMPACT_TEMPLATE_ARRIVAL_ASK_SPAN = 0.12;
const IMPACT_TEMPLATE_ARRIVAL_ATTEMPT_RAMP_START = 1;
const IMPACT_TEMPLATE_ARRIVAL_ATTEMPT_RAMP_SPAN = 2;
const IMPACT_TEMPLATE_ARRIVAL_SPEED_START_PX = 6;
const IMPACT_TEMPLATE_ARRIVAL_SPEED_SPAN_PX = 4;
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
const IMPACT_TEMPLATE_SCOOP_MIN_SPEC_MEAN_IMPACT = 0.55;
const IMPACT_TEMPLATE_END_ANGLE_MIN_DEG = -28;
const IMPACT_TEMPLATE_HOP_MIN_ROOM_FRAMES = Math.round(FPS * 1.25);
const IMPACT_TEMPLATE_HOLD_AIR_START = 0.22;
const IMPACT_TEMPLATE_HOLD_AIR_SPAN = 0.22;
const IMPACT_TEMPLATE_HOLD_IMPACT_START = 0.42;
const IMPACT_TEMPLATE_HOLD_IMPACT_SPAN = 0.23;
const IMPACT_TEMPLATE_HOLD_ROOM_START_FRAMES = 10;
const IMPACT_TEMPLATE_HOLD_ROOM_SPAN_FRAMES = 18;
const IMPACT_TEMPLATE_HOLD_MIN_FRAMES = 1.2;
const IMPACT_TEMPLATE_HOLD_MAX_FRAMES = 3.6;
const IMPACT_TEMPLATE_HOLD_SEG_PX = 12;

// Rung release lane constants (see the lane comment at the postLength
// assembly point). Full pressure while the next interval cannot contain a
// distinct landing plus more than ~2 grounded frames; fades out by ~15 frames.
const RUNG_RELEASE_FULL_FRAMES = 9;
const RUNG_RELEASE_SPAN_FRAMES = 6;
const RUNG_RELEASE_MIN_GROUNDED_FRAMES = 1;
const RUNG_RELEASE_SPAN_SALT = 13;

// STEEP ARRIVAL. On a gap whose NEXT beat wants impact, pitch the final launch
// downward by the measured delivery-efficiency inverse of what that ask needs.
//
// This is the only mechanism that raises the arrival's vertical velocity, and
// the arrival is the only source of redirection that does not BRAKE the rider: a
// scoop drags the centre of mass around a curve and pays in speed (the carrier
// block above prices that at 0.026-0.080 of speed bias), while a steep arrival
// hands the catch a vertical component to convert. Read the feasibility bound
// under a flat launch — fall for the whole airborne share of the gap instead of
// rising and returning — and the mean reachable impact is 0.650 against the
// symmetric-pop bound's 0.575 and an achieved 0.374, with 66% of authored asks
// reachable instead of 54%. Elevation is unauthored in the canonical
// distribution, so the altitude a dive spends is free, and air OVERSHOOTS by
// +0.048, so spending airtime falling rather than rising helps that axis too.
//
// Measured 2026-07-26 at N=8 against `accept-2026-07-25T15-30-00Z-closed-form`:
// the dive was reserved to attempt > 0 and to half the attempt span at mature
// budgets. Applying it across the whole span and at every attempt is +8.42
// headline with representative +10.64 [+8.14, +13.14], legacy_regression +12.71
// [+6.33, +19.08], development_music +10.76 [+5.81, +15.72], 10 valid runs
// gained, and the impact and speed biases improving together (-0.1713 ->
// -0.1660, -0.0446 -> -0.0370) for the first time in the campaign. Span only
// (attempt 0 still exempt) is +5.87; half the span is +7.13. Raising the 15
// degree delta cap to 30 is NEGATIVE (-4.33 and -3.90) because it buys the
// arrival with air.
// The ask floor is GONE (2026-07-27). It suppressed the dive below a 0.30 next
// beat ask, and removing it entirely is worth +19.09 headline at N=8 —
// indistinguishable from lowering it to 0.15 (+19.00), which is what should
// happen if the floor was only ever suppression: `needed arrival angle minus
// predicted arrival angle` already goes to zero on its own for a small ask, so
// the constant did nothing but stop the formula being consulted. The gain is
// mostly NOT impact (bias -0.1660 -> -0.1673); it is TIMING. On a short gap a
// flat or rising launch flies past the beat, and a small downward pitch lands
// the rider on it: dense_dialogue +112.19 and 20->24 of 24 valid, its contrast
// variant +108.83 and 18->24, frontier_pickup_progression +167.13 and 16->19.
// Delivery efficiency 0.5 was +23.93 BEFORE the span floor and is -0.86 after
// it: commanding a bigger turn and carrying more of the commanded one are two
// ways to spend the same budget, so only one of them pays.
//
// RE-FITTED 2026-07-29, UPWARD. Every earlier sweep of this constant ran DOWN
// (0.4/0.5/0.6), because they all predate the span floor. Once the floor makes
// every pool member carry at least half the command, the command itself is
// over-sized, and the untested direction is the one that pays: 0.76 -0.84,
// 0.85 +2.88, 1.00 +4.44, **1.10 +3.62 alone and +7.44 with the fitted breadth
// law**, 1.30 +0.05, 1.50 -9.61. The two mechanisms are complements at their
// peak rather than substitutes: 1.10 alone costs 250k (-3.7) and the breadth
// law's anchor pays for exactly that (+7.0 there), so together every budget is
// positive.
const STEEP_ARRIVAL_DELIVERY_EFFICIENCY = 1.10;
const STEEP_ARRIVAL_DELTA_MAX_DEG = 15;
/**
 * Share of the commanded dive that EVERY pool member carries; the attempt span
 * varies the rest. At 0 the span ran 0..1 of the command, so the pool's mean
 * member took half of what the ask needs.
 *
 * Measured 2026-07-27 at N=8 on top of the removed ask floor, against
 * `steep-arrival-default`: +21.36 headline with representative
 * +18.08 [+15.43, +20.73] and legacy_regression +8.37 [+3.46, +13.27], 35 valid
 * runs gained and 7 lost, every budget positive. Three other ways of deepening
 * the same dive land within one standard error of it on the headline —
 * delivery efficiency 0.4 (+24.67) and 0.5 (+23.93), and the floor combined with
 * efficiency 0.5 (+20.50) — but all of them buy it from `capability`, whose
 * interval spans ±100 at these seed counts, while this one is the only arm whose
 * `representative` reading (70% of the headline) is above +13. Efficiency 0.6 is
 * +13.29 and the ride-out span's own analogue at full strength is -2.02, so the
 * neighbourhood is bracketed rather than open-ended.
 */
// Bracketed on both sides: 0 is the pre-2026-07-27 default, 0.75 is -10.42 and
// 1 is -14.34 (representative -12.97), so the pool still needs members that
// carry less than the full command.
const STEEP_ARRIVAL_SPAN_FLOOR = 0.5;
/**
 * Strength of an impact-window support floor on the post-contact ride, scaled by
 * the contact's own ask. OFF, and the measurement that turned it off is the
 * useful part.
 *
 * The idea was that the turn accrues only while the rider is supported, so an
 * arc whose contact asks for impact should hold the rider for the scoring
 * window — `IMPACT_WINDOW * speed`, about 60px. Forcing exactly that as a hard
 * floor changes the separation distribution by NOTHING: median distance
 * travelled before separation stays 43px, airborne share at the deadline stays
 * ~50%, achieved impact 0.283 -> 0.291. The rider is not running out of line.
 *
 * It leaves a surface that is still there. And the metric requires contact at no
 * frame at all — it is the heading at +W against the heading at -1 — so a turn
 * delivered early and coasted loses only `g/|v|`, about 1 degree per airborne
 * frame. Measuring the turn AFTER separation shows that rate IS the whole story
 * for early separations: contacts that leave at +1 to +3 carry 1.5-4.7 degrees
 * and gain 0.8-1.05 per frame afterwards, which is exactly free fall steepening
 * a heading the absolute-value metric reads as redirection. 22% of scored
 * contacts are therefore GLANCING — they touch, are not turned, and deliver
 * ~0.15 against asks of ~0.3-0.4 — while the ones supported past +4 have real
 * 12-17 degree turns. Lengthening the ride cannot fix a catch that never
 * engages.
 *
 * At full strength this measured +6.85 headline at N=8 (and +6.60 with the
 * flight knee), but entirely through `capability`, whose interval spans +/-110
 * at that seed count, with `representative` +0.81 and the impact bias unmoved.
 * An unexplained gain on the one stratum that cannot rank arms is exactly the
 * shape this campaign has promoted twice and lost at N=48, so it is recorded
 * rather than shipped.
 */
const IMPACT_SUPPORT_WINDOW = 0;
/**
 * Flight share at or above which the dive is applied in full; below it the pitch
 * is scaled down proportionally. `0` disables the gate exactly.
 *
 * A downward pitch only becomes arrival velocity while the rider is in the AIR.
 * On a gap the rider spends mostly grounded it just tilts the ride-out downhill,
 * which costs the supported character the low-air specs are scored on and buys
 * no arrival angle, because the surface holds the trajectory.
 *
 * The KNEE matters, not the shape. Scaling the dive by the flight share
 * proportionally recovers the one group the accepted dive regressed —
 * `sparse_lowline` +23.80 and its variant +23.81 at N=8, against the -18.12 and
 * -10.58 they had lost — and pays for it everywhere else, monotonically:
 * exponent 0.5 is -10.08, 1 is -26.97, 2 is -53.09. The gate has to bind ONLY
 * where there is no flight for the dive to act on, which is what a knee does and
 * a power does not.
 *
 * Left OFF: a knee of 0.3 is inert (-0.04, and `sparse_lowline_air_minus_4`
 * recovers only +4.14 of its -10.58), because almost every gap's flight share is
 * already above it. The knee that would bind is between 0.3 and the proportional
 * form, and finding it is tuning a constant for at most the ~+2 headline that
 * group is worth. Recorded as a lead, not shipped.
 */
const STEEP_ARRIVAL_FLIGHT_KNEE = 0;
const STEEP_ARRIVAL_ABS_CAP_DEG = 40;
const STEEP_ARRIVAL_SPAN_SALT = 11;
// There is no zero band: every pool member carries at least SPAN_FLOOR of the
// commanded dive. Two reservations were removed for the same reason — each was
// unreachable in everything that decides. The impact-conditioned one branched on
// the spec's authored max impact above 0.68, which all 44 development cases
// exceed. The budget-conditioned one — a 0.25 band below a hard 200_000-frame
// threshold, this file's only hard threshold — never fired at any benchmark or
// production budget, and its stated purpose (protect completion where the search
// cannot recover) was never measured in the eight months it stood. It is
// measured now, with the rest of the group: see the file header. Parity below
// 250k, zero completion losses.

// Study-only marker: was the LAST geometry produced by sampleContactCenteredLines an
// impact template lane? Read by the landing-window probe (core/candidate.ts) to
// attribute pool/selection stats per lane. One module-level assignment per sample —
// no behavioral effect.
let lastGeometryWasImpactTemplate = false;
export function wasLastGeometryImpactTemplate(): boolean {
  return lastGeometryWasImpactTemplate;
}

/** Direct-geometry studies bypass the sampler, so they must not inherit the
 * provenance of the previous sampled arc in landing-probe metadata. */
export function clearImpactTemplateMarker(): void {
  lastGeometryWasImpactTemplate = false;
}
const HIGH_AIR_LENGTH_BLEND_PRESSURE_START = 0.68;
const HIGH_AIR_LENGTH_BLEND_PRESSURE_SPAN = 0.24;
const HIGH_AIR_LENGTH_BLEND_EXTRA = 0.28;
/* The grounded ride-out has its own closed-form inversion of the air ask
 * (`supportReferenceLength`), reserved to part of the attempt span exactly as
 * the steep-arrival dive was. The analogy was measured on 2026-07-27 and does
 * NOT carry: a span floor of 0.5 is +5.00 headline against the dive's +21.36,
 * and taking the blend strength to 1 is -2.02. Air is already the axis the
 * compiler overshoots by only +0.048, so there is little there to win. */
const LENGTH_BLEND_BASE = 0.6;
const LENGTH_BLEND_FLOOR = 0;
const DENSE_SPACING_POST_LENGTH_NEUTRAL_CAP = 220;
const DENSE_SPACING_POST_LENGTH_MIN_CAP = 36;
const DENSE_SPACING_POST_LENGTH_MAX_CAP = 180;
const DENSE_SPACING_POST_LENGTH_SPEED_SCALE = 0.52;
const DENSE_SPACING_POST_LENGTH_LOW_AIR_SCALE = 0.16;
const CONTACT_CENTERED_RNG_DRAWS = 8;
const LAUNCH_GRAVITY_PX_PER_FRAME2 = 0.175;
/** Post-contact ride-out CURVATURE, on IMPACT beats only. The ride-out angle is
 *  otherwise lerped linearly start→end; biasing the interpolation makes the path
 *  concave/convex. The span is the exploration width around the front-load the
 *  impact carrier commands; non-impact beats get no bias at all.
 *  Deterministic per attempt (low-discrepancy salt, no rng draw).
 *  History: this used to be a random shape dimension on EVERY beat, faded out by
 *  compile budget (full ≤50k, off ≥100k) because it lifted scarce-budget
 *  COMPLETION (25k +19, 50k +54 — more shapes to find a valid chain) while
 *  DILUTING converged quality. The fade is exactly 0 from 100k frames up, so the
 *  random arm was already dead at every budget the benchmark, production and dev
 *  loops use; the golden v1 75k evidence tier was its last half-strength
 *  foothold, and removing it there measured at parity (file header). Impact-beat
 *  behaviour is unchanged at every budget. */
const CONTACT_CENTERED_POST_CURVE_BIAS_SPAN = 0.6;
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
 *  RE-WIDENED 2026-07-28: the high end goes 1.45 -> 1.85. Air is the one axis
 *  that OVERSHOOTS (bias +0.066, 75% of gaps over the ask), the low-ask band is
 *  23.3% of gaps but 71.1% of all air error, and the ride-out length is the
 *  lever that sets it. Bracketed N=8: 1.65 -0.28, 1.85 +0.65, 2.30 +0.21.
 *  Raising `targetStateSafePostCap` instead — the constraint that actually
 *  binds a low-air ask — costs -37.77 on `capability`: widening the SPAN adds
 *  long arcs to the pool while leaving the short ones in it, so a dense gap
 *  keeps the candidate it needs and the ranker chooses.
 *
 *  OPENED and ACCEPTED (35b5a4f, +7.7 headline): the span is 0.80-1.45 with a
 *  28-260 px clamp, room-gated so both ends fade to neutral 1.0 as room -> 0,
 *  which keeps dense gaps byte-identical. This paragraph previously said
 *  "shipped at NEUTRAL (1.0/1.0/28/220)" and quoted the pre-widening values,
 *  which stopped being true when the campaign it describes succeeded. */
const ARC_LEN_SPAN_LO = 0.80;
const ARC_LEN_SPAN_HI = 1.85;
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

export type SupportGeometryProbeRecord = {
  gapIndex: number;
  attempt: number;
  mode: string;
  gapFrames: number | null;
  targetAir: number | null;
  targetLength: number | null;
  extensionPressure: number | null;
  postLength: number;
  postSegments: number;
};

let supportGeometryProbeHook:
  ((record: SupportGeometryProbeRecord) => void) | null = null;

/** Observation-only geometry hook for the supported-rideout study. */
export function setSupportGeometryProbeHook(
  hook: ((record: SupportGeometryProbeRecord) => void) | null,
): void {
  supportGeometryProbeHook = hook;
}

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
  geometryModeOverride?: SupportGeometryMode,
): ArcPlacementGeometry {
  recordArcPlacementSample(mode);
  lastGeometryWasImpactTemplate = false;
  if (mode === "normal") {
    return {
      kind: "lines",
      lines: sampleContactCenteredLines(
        rng, targetState, targets, gap, lineIdStart, allContactFrames, attempt,
        geometryModeOverride ?? supportGeometryMode(),
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

  /*
   * The arc is a POLYLINE and every vertex is a collision impulse the rider pays
   * for in speed. Subdividing the POST-CONTACT branch in proportion to the
   * impact ask was accepted on 2026-07-27 (N=48 +2.01, representative
   * +3.78 [+0.88, +6.67], contact speed 10.55 -> 10.72 with the turn held), and
   * the same argument applies to every segment the rider rides, not only the
   * ones after a scored contact. Grain is unauthored in the canonical
   * distribution, so this length is free there; where grain IS authored it is a
   * scored target and must not be touched. `1` is the shipped behaviour.
   */
  const segmentLength = targets.grain === undefined
    ? (12 + rolls.segmentLength * 28) / SEGMENT_LENGTH_REFINE
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

/**
 * Study-only resolution override for the ordinary post-contact curve.  The
 * default compiler path leaves this unset and therefore retains its exact
 * historical line count.  An override may refine, but never coarsen, the
 * sampled curve; it is intentionally not a source-selection or target hook.
 */
export type NormalPostCurveResolutionInput = Readonly<{
  attempt: number;
  gapIndex: number;
  postLengthPx: number;
  startAngleDeg: number;
  endAngleDeg: number;
  curveBias: number;
  nominalSegments: number;
}>;

type NormalPostCurveResolutionHook = (input: NormalPostCurveResolutionInput) => number;
let normalPostCurveResolutionHook: NormalPostCurveResolutionHook | null = null;

export function setNormalPostCurveResolutionHook(hook: NormalPostCurveResolutionHook | null): void {
  normalPostCurveResolutionHook = hook;
}

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
  geometryMode: ReturnType<typeof supportGeometryMode>,
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
  /*
   * INCIDENCE-TARGETED CONTACT ANGLE.
   *
   * The scored turn is the CoM heading at +W against the heading one frame
   * before the contact, and the rider leaves along the surface it met, so what
   * the ask actually requires is an INCIDENCE — the angle between the contact
   * surface and the ARRIVAL heading — of `neededTurnDegForImpact(ask, speed)`.
   * The flatten above commands a WORLD-frame nudge instead, so the delivered
   * incidence tracks the carrier's pressure ramp rather than the ask, and
   * whatever angle the arrival happens to bring is uncorrected.
   *
   * Measured 2026-07-27 over 383 committed contacts (`npm run
   * study:impact-window`), incidence at the touched surface against delivered
   * impact, controlled within ask bands:
   *
   *   ask 0.20-0.35   glancing  1.53 deg -> 0.107     engaged  5.26 deg -> 0.154
   *   ask 0.35-0.50   glancing  0.96 deg -> 0.117     engaged 11.50 deg -> 0.262
   *   ask 0.50-0.70   glancing 18.39 deg -> 0.339     engaged 19.21 deg -> 0.491
   *   ask 0.70-1.01   glancing 16.51 deg -> 0.357     engaged 21.56 deg -> 0.596
   *
   * Delivered impact tracks incidence across bands, and 22% of scored contacts
   * are GLANCING — they meet the surface at about one degree, are not turned at
   * all, and free-fall through the window while gravity steepens the heading by
   * the `g/|v|` the absolute-value metric reads as redirection.
   *
   * This blends the contact angle toward the one the ask requires relative to
   * the arrival. `0` is the shipped behaviour exactly.
   */
  /*
   * MINIMUM INCIDENCE, one-sided.
   *
   * A catch can only redirect what it intercepts. Measured over 383 committed
   * contacts (`npm run study:impact-window`), 22% are GLANCING: they meet the
   * surface at about ONE degree, are not turned at all, and free-fall through
   * the scoring window while gravity steepens the heading by the `g/|v|` the
   * absolute-value metric reads as redirection. Within the same ask band they
   * sit at 0.96-1.78 degrees of incidence and deliver 0.107-0.118, against
   * 2.83-11.50 degrees for the contacts that engage.
   *
   * Aiming every contact at the incidence its ask needs is the arm below, and it
   * fails: it moves all of them and pays the speed cost everywhere, because turn
   * and speed trade at close to 1:1. A FLOOR does not. It binds only where the
   * surface would otherwise lie along the arrival — the population getting
   * nothing for its trouble — and leaves the contacts already turning untouched,
   * so the trade is paid only where there is nothing to lose.
   */
  if (IMPACT_MIN_INCIDENCE_DEG > 0 && targets.impact !== undefined) {
    /* The floor is the incidence the ask NEEDS, capped — not a fraction of the
     * cap scaled by the ask. Scaling by the ask defeats the floor exactly where
     * the glancing population lives: at a 0.25 ask a 6-degree cap becomes 1.5
     * degrees, and the mid-band incidence stayed at 1.07 degrees when that form
     * was measured. `neededTurnDegForImpact` is the metric's own inverse and
     * returns 10.4 degrees for that same ask. */
    const floorDeg = targetState.angleDeg - Math.min(
      neededTurnDegForImpact(
        targets.impact,
        targetState.speed,
      ),
      IMPACT_MIN_INCIDENCE_DEG,
    );
    contactAngleDeg = clamp(Math.min(contactAngleDeg, floorDeg), -14, 65);
  }
  if (IMPACT_INCIDENCE_AIM > 0 && targets.impact !== undefined) {
    const needed = neededTurnDegForImpact(
      targets.impact,
      targetState.speed,
    );
    contactAngleDeg = clamp(
      lerp(contactAngleDeg, targetState.angleDeg - needed, IMPACT_INCIDENCE_AIM),
      -14,
      65,
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
    : smoothstep(
      (nextGapFrames - ARC_LEN_ROOM_DENSE_FRAMES) /
        (ARC_LEN_ROOM_SPARSE_FRAMES - ARC_LEN_ROOM_DENSE_FRAMES),
    );
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
    /*
     * The upper bound is how hard the launch may DIVE, and it is what actually
     * binds. On a dense spec (N about 10) the energy target wants vy ~= 1.46
     * against a cap of 0.79, so it is already saturated and raising the energy
     * target above changes nothing — measured byte-identical at gains of 0.15
     * and 0.30. Both factors of the scored impact sit behind this one cap: a
     * harder dive arrives FASTER (the `v` in `v * dtheta`, which the gap-mean
     * speed axis does not see) and STEEPER (the "from" end of the turn).
     */
    const vyClamped = clamp(
      vyTarget,
      -0.92 * g * N,
      LAUNCH_DESCENT_CAP * g * N,
    );
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
  let supportPlan: SupportGeometryPlan | null = null;
  if (nextGapFrames !== null && targets.air !== undefined) {
    const speed = Math.max(1, targetState.speed);
    const targetLen = supportReferenceLength({ air, gapFrames: nextGapFrames, speed });
    const spanBlend = clamp(ccSpanBlends(attempt).length, 0, 1);
    const blend = LENGTH_BLEND_FLOOR + (1 - LENGTH_BLEND_FLOOR) * spanBlend;
    const highAirPressure = clamp(
      (air - HIGH_AIR_LENGTH_BLEND_PRESSURE_START) / HIGH_AIR_LENGTH_BLEND_PRESSURE_SPAN, 0, 1,
    );
    const blendStrength = LENGTH_BLEND_BASE + HIGH_AIR_LENGTH_BLEND_EXTRA * highAirPressure;
    postLength = clamp(lerp(sampledPostLength, targetLen, blend * blendStrength), 28, 360);
    supportPlan = planSupportGeometry({
      mode: geometryMode,
      air,
      gapFrames: nextGapFrames,
      speed,
      legacyPostLength: postLength,
      shapeReferenceLength: targetLen,
      coordinate: lowDiscrepancyRoll(attempt, 17),
      shapeTimeBlend: supportScaleCoordinate(attempt),
    });
    postLength = supportPlan.postLength;
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
    /*
     * The same DOUBLE RESERVATION the steep-arrival dive carried until
     * 2026-07-27: a hand-placed onset below which the physically-derived shape is
     * not commanded at all, and an attempt span whose mean member takes half of
     * what is commanded. Deleting the dive's ask floor was +19.09 headline and
     * lifting its span to 0.5..1 was +21.36, so the pattern is worth measuring
     * wherever it appears — and here it is on an axis nothing in this campaign
     * has touched, whose bias is -0.124. Roughly two thirds of authored
     * amplitude sits at or below the 0.30 onset and therefore receives nothing.
     */
    const amplitudePressure = smoothstep((amp - AMP_ONSET) / 0.45);
    const spanned = clamp(ccSpanBlends(attempt).launch, 0, 1);
    const blend = (AMP_SPAN_FLOOR + (1 - AMP_SPAN_FLOOR) * spanned) *
      amplitudePressure;
    // Shorten the grounded ride-out so the airborne arc fills more of the gap.
    ({ postAngleDeg, postLength } = blendPostTowardPopArc(
      postAngleDeg, postLength, nextGapFrames, targetState.velocity.x, blend, 1,
    ));
  }

  /*
   * SUPPORT THROUGH THE SCORING WINDOW.
   *
   * [The measurement below was taken under the PRE-2026-07-31 metric, which was
   * endpoint-to-endpoint — the retired net metric assigned rather than accumulated,
   * so it read the CoM heading at exactly `IMPACT_WINDOW` frames after the contact
   * against the heading one frame before it. The scored metric is now the
   * CONTACTED-frame accumulation `contactRedirArcPxAtLanding`, which only
   * STRENGTHENS this lever: airborne frames now contribute exactly zero instead of
   * merely failing to add turn, so separating early costs more than measured here.
   * The give-back argument below is moot under accumulation.]
   *
   * Measured over 417 committed contacts on six specs
   * (`npm run study:impact-window`), the turn accrues steadily while the rider
   * is SUPPORTED and stops when it separates:
   *
   *   frame   +0     +1     +2     +3     +4     +5     +6
   *   turn   0.91   1.98   6.10   9.81  12.89  14.61  15.83   deg
   *   air     0%     3%     6%     7%    18%    25%    32%
   *
   * It is a truncation, not a give-back: the mean turn GIVEN BACK before the
   * deadline is 0.002 impact units and the peak is at the deadline itself on 89%
   * of contacts. Split by whether the rider held contact through the window, at
   * an identical mean ask of 0.539/0.540, the supported half delivers 0.449 and
   * the separating half 0.358 — 25% more impact for the same request.
   *
   * The post-contact ride is otherwise sized from the AIR ask alone and knows
   * nothing about the window, so on a gap that wants air the rider separates
   * around frame +4 and the turn stops two frames before it is read. This lifts
   * the ride toward the length that holds the rider for the whole window,
   * `IMPACT_WINDOW * speed`, in proportion to what the contact actually asks
   * for. It never shortens the ride, and it trades against exactly one axis.
   */
  if (IMPACT_SUPPORT_WINDOW > 0 && targets.impact !== undefined) {
    const ask = clamp(targets.impact, 0, 1);
    const windowPx = IMPACT_WINDOW * Math.max(1, targetState.speed);
    postLength = Math.max(
      postLength,
      lerp(postLength, windowPx, clamp(IMPACT_SUPPORT_WINDOW * ask, 0, 1)),
    );
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

  // Rung release lane (2026-07-16). Two landings N frames apart leave the
  // rider at most N − MIN_LANDING_AIRBORNE_FRAMES − 1 grounded frames at the
  // first (each landing needs the detector's airborne run before it) — on the
  // 8-12-frame rungs where pickup rows die that is 1-5 frames, while the
  // sampled ride-out distribution never drops below ~28-36px (~4+ grounded
  // frames at ordinary speeds), so the closing touch-and-go geometry is
  // structurally absent from every pool. For gaps whose NEXT interval is that
  // short, a spanned share of attempts sizes the grounded ride-out to the
  // interval's airborne requirement; attempt 0 and the unspanned share keep
  // the default shape, and the exact evaluator and ranker choose as always.
  if (nextGapFrames !== null && attempt > 0) {
    const rungShortness = 1 - smoothstep(
      (nextGapFrames - RUNG_RELEASE_FULL_FRAMES) / RUNG_RELEASE_SPAN_FRAMES,
    );
    if (rungShortness > 0) {
      const groundedBudgetFrames = Math.max(
        RUNG_RELEASE_MIN_GROUNDED_FRAMES,
        nextGapFrames - MIN_LANDING_AIRBORNE_FRAMES - 1,
      );
      const rungLength = Math.max(8, targetState.speed * groundedBudgetFrames);
      if (rungLength < postLength) {
        const roll = lowDiscrepancyRoll(attempt, RUNG_RELEASE_SPAN_SALT);
        postLength = lerp(postLength, rungLength, rungShortness * roll);
      }
    }
  }

  const preSegments = clampInt(Math.round(preLength / segmentLength), 1, 6);
  /*
   * SEGMENT REFINEMENT ON IMPACT CONTACTS.
   *
   * The turn is delivered by a POLYLINE, and every vertex is a discrete
   * direction change the collision response pays for in speed. At the sampled
   * `segmentLength` of 12-40px the whole six-frame window — about 60px — spans
   * only two or three vertices, so the redirection arrives as a few impulses
   * rather than a curve. That is the measured frontier's mechanism: turn and
   * speed trade at close to 1:1 along every angle lever, and `v * dtheta` is
   * what is scored.
   *
   * Grain is UNAUTHORED in the canonical distribution, so line length is a free
   * axis here exactly as elevation is — and spending a free axis is what the two
   * accepted changes of 2026-07-27 did. Subdividing the post-contact branch in
   * proportion to what the contact asks for delivers the same commanded turn
   * through more, smaller impulses.
   */
  const segmentRefinement = 1 +
    IMPACT_SEGMENT_REFINE * clamp(targets.impact ?? 0, 0, 1);
  const nominalPostSegments = clampInt(
    Math.round(postLength * segmentRefinement / segmentLength),
    2,
    16,
  );
  supportGeometryProbeHook?.({
    gapIndex: gap.index,
    attempt,
    mode: geometryMode,
    gapFrames: nextGapFrames,
    targetAir: targets.air ?? null,
    targetLength: supportPlan?.targetLength ?? null,
    extensionPressure: supportPlan?.extensionPressure ?? null,
    postLength,
    postSegments: nominalPostSegments,
  });

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

  // Curvature authority belongs to impact beats: the through-window rotation IS
  // the redirection. Non-impact beats keep the plain start→end interpolation.
  // Front-load (negative bias) concentrates the contact→post rotation into the early
  // segments the rider hugs during the redir window, scaled by impact pressure;
  // the span is the exploration width around it.
  const postCurveBias = impactCurveP <= 0 ? 0 : lerp(
    (lowDiscrepancyRoll(attempt, 8) - 0.5) * 2 * CONTACT_CENTERED_POST_CURVE_BIAS_SPAN,
    -IMPACT_CURVE_FRONTLOAD,
    impactCurveP,
  );

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

  const postSegments = resolveNormalPostCurveSegments({
    attempt,
    gapIndex: gap.index,
    postLengthPx: postLength,
    startAngleDeg: contactAngleDeg,
    endAngleDeg: postAngleDeg,
    curveBias: postCurveBias,
    nominalSegments: nominalPostSegments,
  });

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
  const impactTemplateEligibility = impactTemplateLaneEligibility(
    params.targets,
    params.targetState,
    params.gapFrames,
    params.nextGapFrames,
    params.impactCurveP,
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

/** Impact-heavy specs get the shorter scoop; everything else keeps the base one.
 *  Two hand-picked frame counts, never a law — the compile budget used to lerp
 *  between them (6 → 5 over 100k…200k frames), which resolved to a flat 5 at
 *  every budget from 200k up and was the only thing the ramp ever did. */
function impactTemplateScoopFrames(): number {
  return currentImpactTemplateSpecMeanImpact < IMPACT_TEMPLATE_SCOOP_MIN_SPEC_MEAN_IMPACT
    ? IMPACT_TEMPLATE_SCOOP_BASE_FRAMES
    : IMPACT_TEMPLATE_SCOOP_SHORT_FRAMES;
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
  return clamp(
    currentImpactProfilePressures.templateHold * lowAirPressure * impactPressure *
      roomPressure,
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

  // REMOVED (Phase 3, geometry group): the impact-ARRIVAL pop-arc blend. It
  // shaped the launch toward the symmetric pop arc (vy0 = -g*N/2) when the NEXT
  // beat authored impact, behind a fade that was full at ≤50k frames and exactly
  // 0 from 100k up — so it was already dead at every budget the benchmark,
  // production, dev and golden v1 evidence tiers run at. Its scarce-budget value
  // (+50.5 on a 50k slice) never coexisted with its mature cost (-8..-36), and
  // forcing it on at every budget was re-measured on Benchmark V2 (2026-07-26) at
  // **-10.59 headline** with the impact bias unmoved (-0.1713 → -0.1738).
  // Superseded by the steep-arrival dive below, which owns the same physical
  // lever — supplying arrival vy — at every budget. Removing its last live
  // foothold (half strength at the golden v1 75k tier) measured at parity with
  // the rest of the group; see the file header. Recover from git if a sub-50k
  // regime ever becomes a real operating point.

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
    params.gap.nextImpact !== undefined
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
      const spanRoll = lowDiscrepancyRoll(params.attempt, STEEP_ARRIVAL_SPAN_SALT);
      /* The span currently runs 0..1 of the computed dive, so the pool's MEAN
       * member carries half of what the ask needs. A floor raises the whole
       * span toward the command while keeping variation below it. */
      const spanned = STEEP_ARRIVAL_SPAN_FLOOR +
        (1 - STEEP_ARRIVAL_SPAN_FLOOR) * spanRoll;
      /* `steepArrivalDeltaMaxDeg` already derives the ride/flight split from the
       * same post length and speed, so the share costs no new state. It is
       * conditioned per GAP rather than per spec deliberately: the per-spec air
       * mean cannot separate the group this protects (`sparse_lowline` 0.265)
       * from the one that gained most from the dive
       * (`frontier_pickup_progression` 0.235, +115.75). */
      const rideFrames = clamp(
        postLength / Math.max(1, params.targetState.speed),
        0,
        params.nextGapFrames - 1,
      );
      const flightShare = clamp(
        (params.nextGapFrames - rideFrames) / Math.max(1, params.nextGapFrames),
        0,
        1,
      );
      const flightGate = STEEP_ARRIVAL_FLIGHT_KNEE <= 0
        ? 1
        : clamp(flightShare / STEEP_ARRIVAL_FLIGHT_KNEE, 0, 1);
      const delta = deltaMax * spanned * flightGate;
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
    impactToRawPx(nextAsk) / (STEEP_ARRIVAL_DELIVERY_EFFICIENCY * vArr),
    Math.asin(IMPACT.CATCHABLE_REDIR_FRACTION),
  );
  const needDeg = Math.min((needRad * 180) / Math.PI, STEEP_ARRIVAL_ABS_CAP_DEG);
  return clamp(needDeg - arrDeg, 0, STEEP_ARRIVAL_DELTA_MAX_DEG);
}

function impactTemplateLaneEligibility(
  targets: AxisValues,
  targetState: ImpactFrameTargetState,
  gapFrames: number,
  nextGapFrames: number | null,
  impactCurveP: number,
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
  // Arrival-conditioned path: the rider is measurably DIVING into an authored
  // impact (steep incoming velocity), so the converting catch is offered
  // regardless of the carrier's ask ramp, and early enough for branch-1
  // rollouts to see it (see the constants block).
  const arrivalP = smoothstep(
    (targetState.angleDeg - IMPACT_TEMPLATE_ARRIVAL_ANGLE_START_DEG) /
      IMPACT_TEMPLATE_ARRIVAL_ANGLE_SPAN_DEG,
  ) * smoothstep(
    (targets.impact - IMPACT_TEMPLATE_ARRIVAL_ASK_START) / IMPACT_TEMPLATE_ARRIVAL_ASK_SPAN,
  ) * smoothstep(
    (targetState.speed - IMPACT_TEMPLATE_ARRIVAL_SPEED_START_PX) /
      IMPACT_TEMPLATE_ARRIVAL_SPEED_SPAN_PX,
  );
  const arrivalAttemptP = smoothstep(
    (attempt - IMPACT_TEMPLATE_ARRIVAL_ATTEMPT_RAMP_START) /
      IMPACT_TEMPLATE_ARRIVAL_ATTEMPT_RAMP_SPAN,
  );
  const firing = Math.max(pressureP * attemptP, arrivalP * arrivalAttemptP);
  const roomP = nextGapFrames === null
    ? 0
    : smoothstep((nextGapFrames - 4) / IMPACT_TEMPLATE_ROOM_SPAN_FRAMES);
  return clamp(
    IMPACT_TEMPLATE_LANE_RATE * firing * roomP,
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
  const speedPressure = smoothstep(
    (params.targetState.speed - CONTACT_CENTERED_REDIR_CONTACT_SPEED_START_PX) /
      CONTACT_CENTERED_REDIR_CONTACT_SPEED_SPAN_PX,
  );
  if (speedPressure <= 0) return 0;

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
    * speedPressure * densePressure * turn.targetPressure * clamp(ccSpanBlends(params.attempt).launch, 0, 1);
  return entryShift ? shiftDeg : -shiftDeg;
}

/** Pressure [0,1] for the impact-driven curvature modulation: ramps with the
 *  ceiling-saturated impact target and gates on having enough incoming speed for a
 *  redirection to read as impact (redir = speed·sin(turn)).
 *  Returns 0 when no impact is authored. */
function impactCurvePressure(
  targetState: ImpactFrameTargetState,
  targetImpact: number | undefined,
): number {
  if (targetImpact === undefined) return 0;
  const target = targetImpact;
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
  const localReliefPressure = smoothstep(
    (targetImpact - IMPACT_CURVE_HIGH_SPEED_RELIEF_TARGET_START) /
      IMPACT_CURVE_HIGH_SPEED_RELIEF_TARGET_SPAN,
  );
  const profilePressure = currentImpactProfilePressures.elevationRoom *
    (1 - currentImpactProfilePressures.highSpeedRelief * localReliefPressure);
  return lerp(IMPACT_CURVE_TARGET_START, IMPACT_CURVE_ELEVATION_ROOM_TARGET_START, profilePressure);
}

function predictedRedirImpactAtAngleDelta(speedPx: number, deltaDeg: number): number {
  const deltaRad = (deltaDeg * Math.PI) / 180;
  // Single-bend model of the scored impulse (cArc = Σ v̄·|Δθ| collapses to v·|Δθ| when the
  // whole turn is taken in one monotone bend) → felt [0,1].
  return normImpact(Math.abs(deltaRad) * Math.max(0, speedPx));
}

/** Inverse of the scored impact metric under the single-bend model: the CoM turn (degrees)
 *  a landing must deliver to achieve `target` impact at `speed` — Δθ = (target arc px)/speed,
 *  clamped to `IMPACT.MAX_RELIABLE_TURN_RAD` (spelled `asin(CATCHABLE_REDIR_FRACTION)`, which
 *  is the same bound — see types.ts; the ceiling impactCeiling uses). Single source
 *  for the three redir levers (contact-shift, entry-shift, post-turn). */
function neededTurnDegForImpact(target: number, speedPx: number): number {
  const turnRad = clamp(
    impactToRawPx(target) / Math.max(1, speedPx),
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
  const target = targetImpact;
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
  const pressure = turn.targetPressure * Math.sqrt(clamp(impactCurveP, 0, 1));
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

/** Four support scales sampled alongside the established 16-step launch path. */
function supportScaleCoordinate(attempt: number): number {
  const k = ((attempt % 4) + 4) % 4;
  return k / 3;
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

function resolveNormalPostCurveSegments(input: NormalPostCurveResolutionInput): number {
  const hook = normalPostCurveResolutionHook;
  if (hook === null) return input.nominalSegments;
  const resolved = hook(Object.freeze({ ...input }));
  if (!Number.isSafeInteger(resolved) || resolved < input.nominalSegments) {
    throw new Error(
      "normal post-curve resolution hook must return a safe integer no smaller than the nominal segment count",
    );
  }
  return resolved;
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
