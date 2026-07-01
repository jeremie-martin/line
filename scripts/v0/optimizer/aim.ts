/**
 * The aiming layer — probe, fit, propose (docs/ARC_STATE_CONTROL.md).
 *
 * Turns arc placement from sample-and-hope into aim. The concept: a LOCAL
 * PREDICTIVE MODEL whose inputs are the current state plus controllable arc
 * modifications (knobs), whose outputs are predicted quantities of interest
 * (rider state, sled pose, in principle score components), fitted per gap,
 * per arc, at compile time from a few probe rides — then inverted to propose
 * aimed candidates, which the unchanged search measures and ranks. What is
 * implemented here is one deliberately simple instance of that concept; the
 * structure is meant to make richer instances (more outputs, more knobs,
 * several aimed candidates, multi-target solves, learned priors) additive
 * rather than rewrites.
 *
 * There is ONE lane: the enumerative proposer (makeEnumAimedCandidates) —
 * joint knob deltas → local response model over current axes and next rider
 * state → current axis-quality × readiness objective swept in-model → top-k
 * proposals through exact production evaluation. Its
 * hand-tuned predecessors (V3 speed-aim, V4 angle-aim +
 * arrival-conditioned scoop, rotate fallback, climb defer) were each
 * subsumed and deleted once their ablation priced at ~zero.
 * The file is organized as the layers of the idea:
 *
 *   1. flags            — per-call env reads (tests pin them dynamically)
 *   2. telemetry        — proposer funnel + live prediction-accuracy stats
 *   3. knob transforms  — chain-continuity-preserving line edits (inputs)
 *   4. probes           — one forked metered ride = current-axis outputs
 *                         plus next-arrival rider state
 *   5. local models     — per-output joint pitch/rotate response fits
 *   6. the lane         — the enumerative proposer
 *
 * INVARIANTS (architecture rules, each bought with a measured failure):
 *
 *   I1 PROPOSER, NEVER JUDGE. Predictions only choose what to propose; every
 *      proposal is simulated exactly (tryCandidateLines: survival, landing
 *      ±1f, off-beat, axis measurement, cost); ranking and commits consume
 *      only measurements. A wrong prediction costs one wasted candidate
 *      evaluation, never a wrong track.
 *   I2 DETERMINISM. Lanes consume ZERO rng draws; lane candidates carry no
 *      sampleAttempt and live outside sampleOrder, so the attempt-prefix
 *      property of the candidate cache stays intact.
 *   I3 BUDGET HONESTY. Probe frames are metered (getRiderMetered).
 *   I4 NO HIDDEN CHARGED-ROLLOUT COST. A lane must not silently multiply the
 *      evals billed inside forward-eval rollouts (v4-01 −3.8; scoop-rollout
 *      −9.0; attempt-0 −29.5). This is NOT "don't simulate more".
 *   I5 DON'T COLLAPSE POOL DIVERSITY. Aiming refines sampled families; the
 *      rest of the pool still competes.
 *
 * CURRENT-INSTANCE CHOICES (defaults, not rules — revisitable with evidence):
 * two knobs (exit pitch + whole-arc rotation); default 5-probe cross design
 * with optional 9-probe grid (`LR_AIM_JOINT_PROBE_DESIGN=grid9`); a shared
 * hybrid joint response model also used by the study harness; top-2 emitted
 * proposals per refined base; readiness consumes the full predicted
 * arrival-state boundary, though the current surface still reads speed and
 * CoM angle only (pose parked by R0).
 */

import { getPhysicsFrameCount, getRiderMetered, sledPoseDegFromRider } from "../../lib/detector.ts";
import {
  axisLookaheadEndFrame,
  RANK_PREDICT_ARRIVAL,
  RANK_QUALITY_MODE,
  tryCandidateLines,
} from "../core/candidate.ts";
import { engineLineFromTrackLine } from "../core/substrate.ts";
import { registerCompileReset } from "../core/compile_lifecycle.ts";
import { AXES, type AxisName, type TrackLine } from "../types.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./sample.ts";
import {
  applyArcKnobs,
  arcKnobSpan,
  arcProbeDesign,
  fitJointArcResponseModel,
  parseArcProbeDesignName,
  predictedArrivalState,
  predictedCurrentAxes,
  predictJointArcOutputs,
  type ArcKnobs,
  type ArcProbeDesignName,
  type JointArcResponseModel,
  type RiderArrivalState,
} from "./arc_model.ts";
import {
  evaluateJointArcKnobs,
  type JointArcProbeMode,
  type JointArcProbeObservation,
} from "./arc_probe.ts";
import {
  nextContactGap,
  predictArrivalAtNextContact,
  scoreGapObjectiveForTargets,
  scoreNextTargetReadiness,
} from "./objective.ts";
import { aimTargets } from "./planning.ts";
import type { Gap } from "../types.ts";

// ───────────────────────────── 1 · Flags ─────────────────────────────
// All read per call (once per pool build, cold path) so tests can pin them.

/** Solve range (deg). ±10 is the span validated by the sensitivity studies;
 *  LR_AIM_SPAN widens it (the quadratic extrapolates beyond the ±6 probe
 *  span; the verification eval prices the model error).
 *  VERDICT (2026-06-10, span=14 vs default): clamp 27%→17%, miss 0.57→0.54,
 *  Δheadline +0.3 INCONCLUSIVE — extra speed authority converts to ~no
 *  score. Speed-aiming is saturated at the default span; don't widen
 *  without a new target. */
function aimDeltaMaxDeg(): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_SPAN;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

/** The enumerative proposer — THE aiming lane (docs/READINESS_ROADMAP.md).
 *  Fit per-knob arrival models (speed, CoM angle at the next beat) from
 *  shared probes, enumerate the knob space inside the models (free), score
 *  each variation as readiness(predicted arrival) × speed-target fit ×
 *  impact-feasibility, propose the top-2 through the unchanged production
 *  evaluation. Subsumed and replaced every
 *  hand-tuned predecessor:
 *  V3 speed-aim + V4 angle-aim triggers (ACCEPT Δ+3.3 → 600.71), the
 *  elevation climb-defer (removed at parity Δ−0.1 → 600.57), and the V4
 *  arrival-conditioned scoop lane (ablation priced at Δ−0.0 under this
 *  lane — deleted 2026-06-10; its deep-catch geometry can return as a
 *  sampler template if the impact axis ever wants it back).
 *  LR_AIM_ENUM=0 disables (ablation; also the budget-arithmetic test pin). */
export function aimEnumEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_ENUM !== "0";
}

function aimJointProbeDesign(): ArcProbeDesignName {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_JOINT_PROBE_DESIGN ?? "cross5";
  return parseArcProbeDesignName(raw);
}

/** Joint arc-probe horizon mode (LR_AIM_PROBE_MODE):
 *    "short" (DEFAULT): probes stop at the geometric arc exit; the model
 *            predicts the exit state and a reducer derives current axes +
 *            ballistic arrival from latent rows (today's production path).
 *    "full"  : each probe rides to the full next-gap horizon, measures
 *            current-gap axes with the engine, and reads the rider state at
 *            the next contact directly (the original direct per-output fits).
 *  Threaded into evaluateJointArcKnobs as `{ mode }`. Throws on any other
 *  value (tests pin it dynamically). */
function aimProbeMode(): JointArcProbeMode {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_PROBE_MODE;
  if (raw === undefined || raw === "" || raw === "short") return "short";
  if (raw === "full") return "full";
  throw new Error(`unknown LR_AIM_PROBE_MODE "${raw}" (expected short or full)`);
}

export type AimModelSpace = "latent" | "direct";

/** Model space the short-probe fit runs in (LR_AIM_MODEL_SPACE):
 *    "latent" (DEFAULT / unset / empty): probes carry latent suffix/prefix rows;
 *            `fitJointArcResponseModel` fits knobs → latents and
 *            `predictJointArcOutputs` applies the ballistic reducer to the
 *            PREDICTED latents — reduce(fit(knobs)). Today's production path.
 *    "direct": probes ask for `directOutputs` (each row's ballistic exit-dot and
 *            next-dot outputs derived from its MEASURED exit state) and the latent rows are
 *            stripped before the fit, so the model fits knobs → the reduced
 *            outputs directly — fit(reduce(row)). No latent models at predict
 *            time, zero extra engine frames vs latent.
 *  Only meaningful under short probe mode. Under full mode the rows have no
 *  latents and already read exit/next directly, so direct is REDUNDANT there;
 *  we THROW on direct+full rather than silently ignoring it — the two are
 *  mutually-exclusive comparison arms and a silent no-op would corrupt an A/B.
 *  Throws on any other value (tests pin it dynamically). */
function aimModelSpace(): AimModelSpace {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_MODEL_SPACE;
  let space: AimModelSpace;
  if (raw === undefined || raw === "" || raw === "latent") space = "latent";
  else if (raw === "direct") space = "direct";
  else throw new Error(`unknown LR_AIM_MODEL_SPACE "${raw}" (expected latent or direct)`);
  if (space === "direct" && aimProbeMode() === "full") {
    throw new Error("LR_AIM_MODEL_SPACE=direct is incompatible with LR_AIM_PROBE_MODE=full (full rows carry no latents and read exit/next directly)");
  }
  return space;
}

/** EXPERIMENT (LR_AIM_TOPK_BASES, int >=1, default 4): how many of the
 *  quality-sorted pool's leading candidates the aim lane refines once the
 *  compile is above the maturity threshold. K=1 runs the lane on `sorted[0]`
 *  only. K>1 runs it on the first K distinct candidates, accumulating each
 *  base's lane extras into the pool, so the search refines more than just the
 *  quality-best base. Parsed once at import (env is constant per run; gates a
 *  per-pool-build hot path). Invalid/absent/<1 -> 4. Low-air gaps cap the
 *  effective mature K at 3 below. */
const AIM_TOPK_BASES_RAW = (globalThis as { process?: { env?: Record<string, string | undefined> } })
  .process?.env?.LR_AIM_TOPK_BASES;
const AIM_TOPK_BASES_EXPLICIT = AIM_TOPK_BASES_RAW !== undefined && AIM_TOPK_BASES_RAW !== "";

export const AIM_TOPK_BASES: number = (() => {
  const raw = AIM_TOPK_BASES_RAW;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 4;
})();

/** Maturity gate for K>1 (LR_AIM_TOPK_BASES). The extra bases find good variants
 *  but cost ~2.5× more probe frames per pool build; at small budgets that probe
 *  cost starves the compile (validity collapses, the per-budget curve goes deeply
 *  negative at 50k/100k and only turns positive at 200k/300k). So gate K>1 on the
 *  compile TARGET budget — the same per-compile-constant maturity signal the
 *  forward-eval gate (usesForwardEvalAtBudget) uses. Target budget is fixed for the whole compile,
 *  so K_effective never changes mid-node and the per-node _candidatesCache (which
 *  may rebuild a node at a larger nCand) stays deterministic — exactly why
 *  consumed-frame signals are unusable here.
 *
 *  Each golden checkpoint is an INDEPENDENT full compile at its own target budget
 *  (golden.ts: "Each budget is an INDEPENDENT full run"), NOT a snapshot of one
 *  300k compile — so this gate makes the 50k/100k compiles run fully at K=1
 *  (byte-identical to the K=1 default) while the 200k/300k compiles run fully at
 *  K>1 and collect the late-budget gain.
 *
 *  Threshold 100k: after start max-width and tighter repair feasibility, the accepted
 *  top-4 non-low-air aim lane pays even at the canonical scarce tier. Canonical
 *  2026-06-23 accepted the 150k -> 100k gate move (+2.9 headline, entirely at 100k).
 */
const AIM_TOPK_MATURE_BUDGET_FRAMES = 100_000;
const AIM_LOW_AIR_TOPK_MAX = 3;
const AIM_LOW_AIR_TOPK_AIR_MAX = 0.30;
const AIM_EXTRA_TOPK_BASES_DEFAULT = 5;
// High-budget UNIFORM aim-base count. A uniform LR_AIM_TOPK_BASES=6 (every mature
// gap, 100k+) canonically gained the mature budgets (250k +0.5, 375k +1.6, 500k
// +0.8) but cratered 125k (-18.9): the extra probe cost starves the scarce tier
// where ~50-93% of the budget already goes just to first completion. The mature
// gain is BROAD (not the spec-gated extra tier — bumping AIM_EXTRA 5->6 was -0.5),
// so raise the uniform base from AIM_TOPK_BASES (4) to AIM_TOPK_BASES_HIGH (6) only
// on compiles whose TARGET budget clears AIM_TOPK_HIGH_BUDGET_FRAMES, leaving 125k
// at 4. Per-compile-constant budget (each golden checkpoint is an independent full
// compile) so K_effective never changes mid-node — same determinism contract as the
// K>1 maturity gate above.
const AIM_TOPK_BASES_HIGH = 6;
const AIM_TOPK_HIGH_BUDGET_FRAMES = 200_000;
// Air-range gate for the high-K bump. Uniform K=6 at mature budgets is a broad win on
// STEADY dense specs (drums_tide +27, drums_swell +25, drums_zigzag/crosscut, narrow
// air range 0.26-0.35) but a sharp LOSS on syncopated/search-sensitive specs (wide air
// range: syncopated_switchback 0.55 -> -29, dense_sprint 0.50, drums_dropout 0.40) where
// the extra aim probes steal the search budget those specs convert best. The two
// populations separate cleanly at air-target RANGE ~0.38, so only bump K where the spec's
// air range is narrow; wide-air-range specs stay at the byte-identical K=4 default.
const AIM_TOPK_HIGH_AIR_RANGE_MAX = 0.38;
const AIM_EXTRA_TOPK_BUDGET_START_FRAMES = 225_000;
const AIM_EXTRA_TOPK_BUDGET_SPAN_FRAMES = 75_000;
const AIM_EXTRA_TOPK_SPEED_RANGE_START = 0.10;
const AIM_EXTRA_TOPK_SPEED_RANGE_SPAN = 0.10;
const AIM_EXTRA_TOPK_AIR_MEAN_START = 0.35;
const AIM_EXTRA_TOPK_AIR_MEAN_SPAN = 0.20;
const AIM_EXTRA_TOPK_AIR_RANGE_START = 0.45;
const AIM_EXTRA_TOPK_AIR_RANGE_SPAN = 0.25;
const AIM_EXTRA_TOPK_CONTACT_START = 8;
const AIM_EXTRA_TOPK_CONTACT_SPAN = 8;
const AIM_EXTRA_TOPK_SLACK_START = 2.75;
const AIM_EXTRA_TOPK_SLACK_SPAN = 1.25;
const AIM_EXTRA_TOPK_AIR_VALLEY_SLACK_SPAN = 3.25;
const AIM_EXTRA_TOPK_AIR_VALLEY_RANGE_START = 0.24;
const AIM_EXTRA_TOPK_AIR_VALLEY_RANGE_SPAN = 0.16;
const AIM_EXTRA_TOPK_AIR_VALLEY_GRAIN_RANGE_START = 0.05;
const AIM_EXTRA_TOPK_AIR_VALLEY_GRAIN_RANGE_SPAN = 0.10;
const AIM_EXTRA_TOPK_AIR_VALLEY_SPEED_RANGE_START = 0.08;
const AIM_EXTRA_TOPK_AIR_VALLEY_SPEED_RANGE_SPAN = 0.08;

let aimCompileBudgetFrames = 0;
let aimCompileBudgetSlack = Number.POSITIVE_INFINITY;
/** Set the compile target budget for the K>1 maturity gate. Called once per
 *  compile at compileHandoff entry, alongside the other budget setters. */
export function setAimCompileBudgetFrames(frames: number): void {
  aimCompileBudgetFrames = Math.max(0, frames | 0);
}

export function setAimCompileBudgetSlack(slack: number): void {
  aimCompileBudgetSlack = Number.isFinite(slack) ? Math.max(0, slack) : Number.POSITIVE_INFINITY;
}

/** Effective lane-base count for the current compile/gap: K below the maturity
 *  threshold collapses to 1 (byte-identical to the K=1 default). Mature low-air
 *  gaps keep the accepted top-3 behavior; other mature gaps use the configured
 *  AIM_TOPK_BASES. */
export function aimTopKBasesEffective(gap?: Gap, gaps?: readonly Gap[], ctx?: SpecContext): number {
  if (aimCompileBudgetFrames < AIM_TOPK_MATURE_BUDGET_FRAMES) return 1;
  // High-budget uniform bump: at mature TARGET budgets the broader base count pays
  // (canonical: K=6 at 250k/375k/500k = +0.5/+1.6/+0.8) but starves 125k (-18.9), so
  // gate the rise on the compile budget. Not applied when LR_AIM_TOPK_BASES is set
  // explicitly (the env override owns the count). Above the gate the uniform high K
  // already exceeds the spec-gated extra tier, so that lane is subsumed.
  const highBudget = !AIM_TOPK_BASES_EXPLICIT
    && aimCompileBudgetFrames >= AIM_TOPK_HIGH_BUDGET_FRAMES;
  // Gate the high-K bump to narrow-air-range (steady, non-syncopated) specs: the wide
  // ones are search-sensitive and the extra aim probes regress them. Needs gaps+ctx to
  // measure the range; without them, fall back to the safe K=4 default (no bump).
  const narrowAirRange = highBudget && gaps !== undefined && ctx !== undefined
    && targetAxisRange(gaps, ctx, "air") < AIM_TOPK_HIGH_AIR_RANGE_MAX;
  const baseK = narrowAirRange ? AIM_TOPK_BASES_HIGH : AIM_TOPK_BASES;
  if (gap?.targets.air !== undefined && gap.targets.air <= AIM_LOW_AIR_TOPK_AIR_MAX) {
    return Math.min(baseK, AIM_LOW_AIR_TOPK_MAX);
  }
  if (
    !AIM_TOPK_BASES_EXPLICIT &&
    baseK < AIM_EXTRA_TOPK_BASES_DEFAULT &&
    gap !== undefined &&
    gaps !== undefined &&
    ctx !== undefined &&
    shouldUseDefaultExtraAimBase(gap, gaps, ctx)
  ) {
    return AIM_EXTRA_TOPK_BASES_DEFAULT;
  }
  return baseK;
}

function shouldUseDefaultExtraAimBase(gap: Gap, gaps: readonly Gap[], ctx: SpecContext): boolean {
  const pressure = defaultExtraAimBasePressure(gap, gaps, ctx);
  if (pressure <= 0) return false;
  return unitHash(defaultExtraAimBaseSeed(gap)) < pressure;
}

function defaultExtraAimBasePressure(gap: Gap, gaps: readonly Gap[], ctx: SpecContext): number {
  if (!gap.endsWithContact) return 0;
  const gapAir = targetForGap(gap, ctx, "air");
  if (gapAir !== null && gapAir <= AIM_LOW_AIR_TOPK_AIR_MAX) return 0;
  const airMean = targetAxisMean(gaps, ctx, "air");
  if (airMean === null) return 0;

  const budgetPressure = smoothstep(
    (aimCompileBudgetFrames - AIM_EXTRA_TOPK_BUDGET_START_FRAMES) /
      AIM_EXTRA_TOPK_BUDGET_SPAN_FRAMES,
  );
  const speedSteadiness = 1 - smoothstep(
    (targetAxisRange(gaps, ctx, "speed") - AIM_EXTRA_TOPK_SPEED_RANGE_START) /
      AIM_EXTRA_TOPK_SPEED_RANGE_SPAN,
  );
  const airMeanPressure = smoothstep(
    (airMean - AIM_EXTRA_TOPK_AIR_MEAN_START) / AIM_EXTRA_TOPK_AIR_MEAN_SPAN,
  );
  const airRangePressure = 1 - smoothstep(
    (targetAxisRange(gaps, ctx, "air") - AIM_EXTRA_TOPK_AIR_RANGE_START) /
      AIM_EXTRA_TOPK_AIR_RANGE_SPAN,
  );
  const contactPressure = smoothstep(
    (contactGapCount(gaps) - AIM_EXTRA_TOPK_CONTACT_START) / AIM_EXTRA_TOPK_CONTACT_SPAN,
  );
  const slackPressure = defaultExtraAimBaseSlackPressure(gaps, ctx);
  return clamp01(
    budgetPressure * speedSteadiness * airMeanPressure * airRangePressure *
      contactPressure * slackPressure,
  );
}

function defaultExtraAimBaseSlackPressure(gaps: readonly Gap[], ctx: SpecContext): number {
  if (!Number.isFinite(aimCompileBudgetSlack)) return 1;
  const narrow = smoothstep(
    (aimCompileBudgetSlack - AIM_EXTRA_TOPK_SLACK_START) /
      AIM_EXTRA_TOPK_SLACK_SPAN,
  );
  const wide = smoothstep(
    (aimCompileBudgetSlack - AIM_EXTRA_TOPK_SLACK_START) /
      AIM_EXTRA_TOPK_AIR_VALLEY_SLACK_SPAN,
  );
  return narrow + (wide - narrow) * defaultExtraAimBaseAirValleyPressure(gaps, ctx);
}

function defaultExtraAimBaseAirValleyPressure(gaps: readonly Gap[], ctx: SpecContext): number {
  const airRange = targetAxisRange(gaps, ctx, "air");
  const grainRange = targetAxisRange(gaps, ctx, "grain");
  const speedRange = targetAxisRange(gaps, ctx, "speed");
  const airValley = smoothstep(
    (airRange - AIM_EXTRA_TOPK_AIR_VALLEY_RANGE_START) /
      AIM_EXTRA_TOPK_AIR_VALLEY_RANGE_SPAN,
  );
  const flatGrain = 1 - smoothstep(
    (grainRange - AIM_EXTRA_TOPK_AIR_VALLEY_GRAIN_RANGE_START) /
      AIM_EXTRA_TOPK_AIR_VALLEY_GRAIN_RANGE_SPAN,
  );
  const steadySpeed = 1 - smoothstep(
    (speedRange - AIM_EXTRA_TOPK_AIR_VALLEY_SPEED_RANGE_START) /
      AIM_EXTRA_TOPK_AIR_VALLEY_SPEED_RANGE_SPAN,
  );
  return clamp01(airValley * flatGrain * steadySpeed);
}

function defaultExtraAimBaseSeed(gap: Gap): number {
  return (
    Math.imul(gap.index + 1, 0x9e3779b1) ^
    Math.imul(aimCompileBudgetFrames | 0, 0x85ebca6b) ^
    0x61c88647
  ) | 0;
}

function contactGapCount(gaps: readonly Gap[]): number {
  let contacts = 0;
  for (const gap of gaps) if (gap.endsWithContact) contacts++;
  return contacts;
}

function targetAxisRange(gaps: readonly Gap[], ctx: SpecContext, axis: AxisName): number {
  let lo = Infinity;
  let hi = -Infinity;
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    const target = targetForGap(gap, ctx, axis);
    if (target === null) continue;
    lo = Math.min(lo, target);
    hi = Math.max(hi, target);
  }
  return hi >= lo ? hi - lo : 0;
}

function targetAxisMean(gaps: readonly Gap[], ctx: SpecContext, axis: AxisName): number | null {
  let sum = 0;
  let count = 0;
  for (const gap of gaps) {
    if (!gap.endsWithContact) continue;
    const target = targetForGap(gap, ctx, axis);
    if (target === null) continue;
    sum += target;
    count++;
  }
  return count > 0 ? sum / count : null;
}

function targetForGap(gap: Gap, ctx: SpecContext, axis: AxisName): number | null {
  const target = objectiveTargetsForGap(gap, ctx)[axis];
  return typeof target === "number" && Number.isFinite(target) ? target : null;
}

function unitHash(seed: number): number {
  let x = seed | 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return (x >>> 0) / 0x100000000;
}

function clamp01(x: number): number {
  return Math.max(0, Math.min(1, x));
}

function smoothstep(x: number): number {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
}

/** Telemetry: a requested top-K base was skipped (duplicate of an
 *  already-refined base, or the pool was shorter than K). */
export function recordLaneBaseSkip(): void {
  aimTotals.enum_lane_base_skips++;
}

/** Quality-objective pool ranking (LR_RANK_QUALITY): make the shared objective
 *  — current-axis-quality × composite next-gap readiness, computed from each
 *  candidate's ACHIEVED axes and its arrival state at the next contact — the
 *  JUDGE of the per-gap pool sort (node.ts), so the aim lane refines the
 *  quality-best base instead of the cost-best one. Two modes:
 *    "pool" (DEFAULT / any value other than "off"): the per-gap pool sort ranks
 *            by the objective; handoff branch selection still uses mature
 *            forward eval or the measured handoff score.
 *    "off"  (LR_RANK_QUALITY=off): escape hatch — bit-identical to the
 *            pre-ranking path; the ranking helpers below are never called and no
 *            arrival ride is taken.
 *  The env parse lives in core/candidate.ts (single owner, shared with the
 *  predict-arrival capture gate there). */
export function rankQualityEnabled(): boolean {
  return RANK_QUALITY_MODE !== "off";
}

// ─────────────────────────── 2 · Telemetry ───────────────────────────

/** Lane telemetry (compile_stats.aim — lab-queryable via json_extract).
 *  Funnel: considered → (no_target | probe_crash | on_target) →
 *  (gate_fail | emitted). Accuracy: |predicted − achieved| readiness of
 *  emitted proposals — the lane's measured value-add per emission. */
export type AimStats = {
  /** The arc-probe design this compile ran (LR_AIM_JOINT_PROBE_DESIGN, default
   *  "cross5"). Lets archives distinguish runs by probe design. */
  probe_design: ArcProbeDesignName;
  /** The joint arc-probe horizon mode this compile ran (LR_AIM_PROBE_MODE,
   *  default "short"). Lets archives distinguish latent vs direct probe runs. */
  probe_mode: JointArcProbeMode;
  /** Short-probe fit model space this compile ran (LR_AIM_MODEL_SPACE, default
   *  "latent"): "latent" = reduce(fit(knobs)); "direct" = fit(reduce(row)). */
  model_space: AimModelSpace;
  /** Enumerative-proposer funnel + readiness accuracy. */
  enum_considered: number;
  enum_no_target: number;
  enum_probe_crash: number;
  enum_model_unscoreable: number;
  enum_next_before_exit: number;
  enum_on_target: number;
  enum_gate_fail: number;
  enum_emitted: number;
  /** Mean |predicted − achieved| arrival readiness over emitted. */
  enum_readiness_err_mean: number;
  /** Mean predicted readiness gain over δ=0, over emitted. */
  enum_readiness_gain_mean: number;
  /** Deferred additive rotate-knob split: rotate recruit rate, rotate-probe failures
   *  (lane falls back to pitch-only), and how rotated (dr≠0) proposals
   *  fare at the production gates vs emitted. */
  enum_rot_probe_crash: number;
  enum_rot_recruited: number;
  enum_rot_emitted: number;
  enum_rot_gate_fail: number;
  /** Selection-rank telemetry: where a lane proposal landed in the
   *  cost-sorted pool it was emitted into (rank 0 = pool best), recorded
   *  once per pool BUILD (node.ts sortWithLaneExtras). Counts/sums only —
   *  the lab derives means. The instrument for "are proposed candidates
   *  winning selection → should budget shift from sampling toward the
   *  proposer?"; handoff_aimed_selected is the commit-level answer. */
  aimed_pool_entries: number;
  aimed_rank0: number;
  aimed_top3: number;
  aimed_rank_sum: number;
  aimed_pool_size_sum: number;
  /** Joint short-probe telemetry. Means are frame numbers/counts over probe
   *  rows; estimated saved frames are relative to the former full next-gap
   *  observation horizon. A clean suffix stays airborne from suffixFrame
   *  through horizonFrame; dirty rows are still modeled and audited. */
  joint_probe_rows: number;
  joint_probe_clean_suffix: number;
  joint_probe_horizon_mean: number;
  joint_probe_suffix_mean: number;
  joint_probe_full_horizon_mean: number;
  joint_probe_saved_frames_mean: number;
  joint_probe_suffix_after_current_mean: number;
  joint_probe_suffix_after_next: number;
  joint_probe_launch_read_frames_mean: number;
  /** Per-row hard-gate outcomes over short probe rows. Gate-failed rows carry
   *  no current-gap outputs, which thins the per-output fit data — the
   *  upstream cause of every degradation counter below. */
  joint_probe_current_ok: number;
  joint_probe_next_state_ok: number;
  /** Physics frames actually CHARGED by joint probe rides (newly simulated
   *  on the fork, getPhysicsFrameCount delta around the probe batch). The
   *  honest probe cost: divide by joint_probe_rows for per-row cost, or by
   *  compile sim_frames for the budget share spent probing. */
  joint_probe_frames_charged: number;
  /** EXPERIMENT (LR_AIM_TOPK_BASES): how many distinct pool bases the aim lane
   *  was actually run on, summed over all pool builds (K=1 → one per build that
   *  ran the lane). Per-base probe cost = joint_probe_frames_charged /
   *  enum_lane_bases. `enum_lane_base_skips` counts duplicate/short-pool bases
   *  skipped (a requested base already refined this build, or the pool ran out),
   *  so requested−skipped = enum_lane_bases over those builds. */
  enum_lane_bases: number;
  enum_lane_base_skips: number;
  /** Output models the hybrid identifiability ladder fitted BELOW their
   *  first-choice functional form (too few gate-clean rows). The model still
   *  exists — the ladder floor is linear — but with less curvature. */
  joint_fit_degraded_outputs: number;
  /** Per-sweep current-gap term coverage: of the gap's targeted axes, how
   *  many had a model prediction at the base knobs (sums), and how many
   *  sweeps had NONE — i.e. the objective degraded to
   *  readiness × speed-fit × impact-feasibility with axis quality pinned
   *  at its empty-default 1. Before the identifiability ladder this
   *  degradation was silent; it must stay observable. */
  enum_current_axes_targeted: number;
  enum_current_axes_modeled: number;
  enum_current_term_missing: number;
  /** Quality-objective pool ranking (LR_RANK_QUALITY; absent when off).
   *  Pool builds where the cost-rank and quality-rank top-3 sets differ, and
   *  where the top-1 differs; candidates with a defined objective vs total scored
   *  (fallback rate = (scored − defined) / scored). All arrivals are served by
   *  ballistic prediction (rank_quality_pred_used). */
  rank_quality_pools: number;
  rank_quality_top3_disagree: number;
  rank_quality_top1_disagree: number;
  rank_quality_candidates_scored: number;
  rank_quality_objective_defined: number;
  /** Prediction bails on the PREDICT path (predict couldn't produce a state →
   *  null objective → cost order). */
  rank_quality_pred_bail: number;
  /** Candidates ranked via a ballistic PREDICTION: the prediction-only objective
   *  path (now every scored candidate that produces an arrival). */
  rank_quality_pred_used: number;
};

const aimTotals = {
  enum_considered: 0, enum_no_target: 0,
  enum_probe_crash: 0, enum_on_target: 0, enum_gate_fail: 0, enum_emitted: 0,
  enum_model_unscoreable: 0, enum_next_before_exit: 0,
  enumReadinessErrSum: 0, enumReadinessGainSum: 0, enumAchieved: 0,
  enum_rot_probe_crash: 0, enum_rot_recruited: 0, enum_rot_emitted: 0,
  enum_rot_gate_fail: 0,
  // Selection-rank telemetry (recordLanePoolRank).
  aimed_pool_entries: 0, aimed_rank0: 0, aimed_top3: 0,
  aimed_rank_sum: 0, aimed_pool_size_sum: 0,
  // Joint short-probe telemetry.
  joint_probe_rows: 0, joint_probe_clean_suffix: 0,
  jointProbeHorizonSum: 0, jointProbeSuffixSum: 0, jointProbeSuffixRows: 0,
  jointProbeFullHorizonSum: 0, jointProbeSavedFramesSum: 0,
  jointProbeSuffixAfterCurrentSum: 0, jointProbeSuffixAfterNext: 0,
  jointProbeLaunchReadFramesSum: 0, jointProbeLaunchReadFrameRows: 0,
  joint_probe_current_ok: 0, joint_probe_next_state_ok: 0,
  joint_probe_frames_charged: 0,
  // Top-K base refinement (LR_AIM_TOPK_BASES).
  enum_lane_bases: 0, enum_lane_base_skips: 0,
  // Fit/objective degradation telemetry (recordJointModelCoverage).
  joint_fit_degraded_outputs: 0,
  enum_current_axes_targeted: 0, enum_current_axes_modeled: 0,
  enum_current_term_missing: 0,
  // Quality-objective pool ranking (recordRankQualityPool / candidateQualityObjective).
  rank_quality_pools: 0, rank_quality_top3_disagree: 0,
  rank_quality_top1_disagree: 0,
  rank_quality_candidates_scored: 0, rank_quality_objective_defined: 0,
  // Predicted-arrival usage.
  rank_quality_pred_bail: 0, rank_quality_pred_used: 0,
};

/** Record where a lane proposal ranked in the cost-sorted pool it entered,
 *  and that pool's size. Called by node.ts once per pool build (cache hits
 *  do not re-record; one lane candidate can therefore be ranked in several
 *  rebuilt pools — same semantics as the funnel counters). */
export function recordLanePoolRank(
  _kind: "aimed",
  rank: number,
  poolSize: number,
): void {
  aimTotals.aimed_pool_entries++;
  if (rank === 0) aimTotals.aimed_rank0++;
  if (rank < 3) aimTotals.aimed_top3++;
  aimTotals.aimed_rank_sum += rank;
  aimTotals.aimed_pool_size_sum += poolSize;
}

function recordJointProbeRows(
  rows: readonly JointArcProbeObservation[],
  gap: Gap,
  axisMeasureEnd: number,
  nextFrame: number,
): void {
  const fullHorizon = Math.max(gap.endFrame + 20, axisMeasureEnd + 20, nextFrame + 2);
  for (const row of rows) {
    if (row.mode !== "short") continue;
    aimTotals.joint_probe_rows++;
    if (row.gate.currentOk) aimTotals.joint_probe_current_ok++;
    if (row.gate.nextStateOk) aimTotals.joint_probe_next_state_ok++;
    if (row.cleanAirborneSuffix === true) aimTotals.joint_probe_clean_suffix++;
    aimTotals.jointProbeHorizonSum += row.horizonFrame;
    aimTotals.jointProbeFullHorizonSum += fullHorizon;
    aimTotals.jointProbeSavedFramesSum += Math.max(0, fullHorizon - row.horizonFrame);
    if (row.suffixFrame !== null) {
      aimTotals.jointProbeSuffixRows++;
      aimTotals.jointProbeSuffixSum += row.suffixFrame;
      aimTotals.jointProbeSuffixAfterCurrentSum += row.suffixFrame - gap.endFrame;
      if (row.suffixFrame > nextFrame) aimTotals.jointProbeSuffixAfterNext++;
    }
    if (row.launchReadFrames !== null) {
      aimTotals.jointProbeLaunchReadFrameRows++;
      aimTotals.jointProbeLaunchReadFramesSum += row.launchReadFrames;
    }
  }
}

/** Record, once per joint sweep, how much of the objective's current-gap term
 *  the fitted model actually covers at the base knobs, plus how many output
 *  models the identifiability ladder fitted below first choice. A sweep whose
 *  targeted axes have NO model prediction ranks on composite next-gap
 *  readiness alone (axis quality defaults to 1 on an empty error set —
 *  score.ts axisQualityFromErrors); that is a
 *  legitimate degraded mode, but it must never again be invisible. */
function recordJointModelCoverage(
  model: JointArcResponseModel,
  baseOutputs: Record<string, number>,
  gap: Gap,
): void {
  const axes = predictedCurrentAxes(baseOutputs);
  let targeted = 0;
  let modeled = 0;
  for (const axis of AXES) {
    if (gap.targets[axis] === undefined) continue;
    targeted++;
    if (axes[axis] !== undefined) modeled++;
  }
  aimTotals.enum_current_axes_targeted += targeted;
  aimTotals.enum_current_axes_modeled += modeled;
  if (targeted > 0 && modeled === 0) aimTotals.enum_current_term_missing++;
  let degraded = 0;
  for (const fitted of model.outputModels.values()) {
    if (fitted.model.degraded) degraded++;
  }
  for (const fitted of model.latentModels.values()) {
    if (fitted.model.degraded) degraded++;
  }
  aimTotals.joint_fit_degraded_outputs += degraded;
}

export function resetAimStats(): void {
  for (const key of Object.keys(aimTotals) as (keyof typeof aimTotals)[]) {
    aimTotals[key] = 0;
  }
}
registerCompileReset(resetAimStats);

/** Snapshot for compile stats; null when the lane never ran (flag off /
 *  no pools) so ablation archives carry no aim key at all. */
export function snapshotAimStats(): AimStats | null {
  if (aimTotals.enum_considered === 0) return null;
  const round3 = (x: number): number => Math.round(x * 1000) / 1000;
  return {
    probe_design: aimJointProbeDesign(),
    probe_mode: aimProbeMode(),
    model_space: aimModelSpace(),
    enum_considered: aimTotals.enum_considered,
    enum_no_target: aimTotals.enum_no_target,
    enum_probe_crash: aimTotals.enum_probe_crash,
    enum_model_unscoreable: aimTotals.enum_model_unscoreable,
    enum_next_before_exit: aimTotals.enum_next_before_exit,
    enum_on_target: aimTotals.enum_on_target,
    enum_gate_fail: aimTotals.enum_gate_fail,
    enum_emitted: aimTotals.enum_emitted,
    enum_readiness_err_mean: aimTotals.enumAchieved > 0
      ? round3(aimTotals.enumReadinessErrSum / aimTotals.enumAchieved) : 0,
    enum_readiness_gain_mean: aimTotals.enum_emitted > 0
      ? round3(aimTotals.enumReadinessGainSum / aimTotals.enum_emitted) : 0,
    enum_rot_probe_crash: aimTotals.enum_rot_probe_crash,
    enum_rot_recruited: aimTotals.enum_rot_recruited,
    enum_rot_emitted: aimTotals.enum_rot_emitted,
    enum_rot_gate_fail: aimTotals.enum_rot_gate_fail,
    aimed_pool_entries: aimTotals.aimed_pool_entries,
    aimed_rank0: aimTotals.aimed_rank0,
    aimed_top3: aimTotals.aimed_top3,
    aimed_rank_sum: aimTotals.aimed_rank_sum,
    aimed_pool_size_sum: aimTotals.aimed_pool_size_sum,
    joint_probe_rows: aimTotals.joint_probe_rows,
    joint_probe_clean_suffix: aimTotals.joint_probe_clean_suffix,
    joint_probe_horizon_mean: aimTotals.joint_probe_rows > 0
      ? round3(aimTotals.jointProbeHorizonSum / aimTotals.joint_probe_rows) : 0,
    joint_probe_suffix_mean: aimTotals.jointProbeSuffixRows > 0
      ? round3(aimTotals.jointProbeSuffixSum / aimTotals.jointProbeSuffixRows) : 0,
    joint_probe_full_horizon_mean: aimTotals.joint_probe_rows > 0
      ? round3(aimTotals.jointProbeFullHorizonSum / aimTotals.joint_probe_rows) : 0,
    joint_probe_saved_frames_mean: aimTotals.joint_probe_rows > 0
      ? round3(aimTotals.jointProbeSavedFramesSum / aimTotals.joint_probe_rows) : 0,
    joint_probe_suffix_after_current_mean: aimTotals.jointProbeSuffixRows > 0
      ? round3(aimTotals.jointProbeSuffixAfterCurrentSum / aimTotals.jointProbeSuffixRows) : 0,
    joint_probe_suffix_after_next: aimTotals.jointProbeSuffixAfterNext,
    joint_probe_launch_read_frames_mean: aimTotals.jointProbeLaunchReadFrameRows > 0
      ? round3(aimTotals.jointProbeLaunchReadFramesSum / aimTotals.jointProbeLaunchReadFrameRows) : 0,
    joint_probe_current_ok: aimTotals.joint_probe_current_ok,
    joint_probe_next_state_ok: aimTotals.joint_probe_next_state_ok,
    joint_probe_frames_charged: aimTotals.joint_probe_frames_charged,
    enum_lane_bases: aimTotals.enum_lane_bases,
    enum_lane_base_skips: aimTotals.enum_lane_base_skips,
    joint_fit_degraded_outputs: aimTotals.joint_fit_degraded_outputs,
    enum_current_axes_targeted: aimTotals.enum_current_axes_targeted,
    enum_current_axes_modeled: aimTotals.enum_current_axes_modeled,
    enum_current_term_missing: aimTotals.enum_current_term_missing,
    rank_quality_pools: aimTotals.rank_quality_pools,
    rank_quality_top3_disagree: aimTotals.rank_quality_top3_disagree,
    rank_quality_top1_disagree: aimTotals.rank_quality_top1_disagree,
    rank_quality_candidates_scored: aimTotals.rank_quality_candidates_scored,
    rank_quality_objective_defined: aimTotals.rank_quality_objective_defined,
    rank_quality_pred_bail: aimTotals.rank_quality_pred_bail,
    rank_quality_pred_used: aimTotals.rank_quality_pred_used,
  };
}

/** Below this |δ*| the aimed variant would duplicate the base candidate.
 *  NOTE: this is the pitch half-window of the *near-base* duplicate skip
 *  (the axis-aligned box test at the enumeration loop below). That is a
 *  DIFFERENT test from `distinctJointKnobs` (the ellipse separation between
 *  two proposals): different shape (box vs ellipse), different reference
 *  point (base 0,0 vs an arbitrary peer proposal) and different scales
 *  (0.25/0.25 here vs ENUM_MIN_SEP_DEG=1.5 / ENUM_ROT_STEP_DEG=0.5 there).
 *  Its numeric coincidence with ENUM_STEP_DEG (both 0.25) is not a shared
 *  quantity — they are independent knobs that happen to agree. */
const AIM_MIN_DELTA_DEG = 0.25;

// ───────────────────────────── 4 · Probes ────────────────────────────

/** The output vector of one probe ride: the full rider state readable at one
 *  frame. One ride yields ALL quantities at once — probe count scales with
 *  model order per knob, never with the number of predicted outputs. Future
 *  quantities (e.g. measured axis values via a full candidate evaluation per
 *  probe — expensive, see V2 study) extend this type; consumers fit per
 *  quantity from the same outcomes unchanged. */
export type ProbeOutcome = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** CoM speed (px/f). */
  speed: number;
  /** CoM VELOCITY direction (deg, +down) — where the mass is GOING.
   *  Null at zero speed. */
  comAngleDeg: number | null;
  /** Sled pose / "internal rotation" (TAIL→NOSE, deg, +down) — where the
   *  rider is POINTING. A different quantity from comAngleDeg. Null when
   *  unreadable. Free to read (same frame); consumed by no decision yet. */
  sledPoseDeg: number | null;
};

/** Ride the perturbed candidate on a forked engine and read the full
 *  ProbeOutcome at `frame`. Returns null when the probe ride breaks the
 *  sled / ejects the rider (don't fit through a crash) or speed is not
 *  finite. Frames are metered via getRiderMetered (invariant I3); the pose
 *  read is a same-frame property read costing zero metered frames. */
function probeRide(
  // deno-lint-ignore no-explicit-any
  engine: any,
  lines: TrackLine[],
  frame: number,
): ProbeOutcome | null {
  const fork = engine.addLine(lines.map((l) => engineLineFromTrackLine(l)));
  const rider = getRiderMetered(fork, frame);
  try {
    if (rider.get?.("SLED_INTACT")?.isBinded?.() === false) return null;
    if (rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false) return null;
  } catch { /* treat as intact */ }
  const pos = rider.position ?? { x: NaN, y: NaN };
  const v = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(v.x, v.y);
  if (!Number.isFinite(speed)) return null;
  return {
    x: pos.x,
    y: pos.y,
    vx: v.x,
    vy: v.y,
    speed,
    comAngleDeg: speed > 0 ? (Math.atan2(v.y, v.x) * 180) / Math.PI : null,
    sledPoseDeg: sledPoseDegFromRider(rider),
  };
}

// ───────────────────────────── 6 · Lanes ─────────────────────────────

// ──────────────── R2 · Enumerative proposer (LR_AIM_ENUM) ────────────────

/** Emitted proposals per refined base (the "1000 variations" live inside the
 *  model; only the top 2 are simulated). k=2 is the measured knee under the
 *  current budget economics: k=3 spends the third proposal before low-budget
 *  compiles have enough room for it. */
const ENUM_TOP_K = 2;
/** Enumeration step (deg) — far below model error; effectively continuous. */
const ENUM_STEP_DEG = 0.25;
/** Minimum spacing between proposed deltas (keep the k proposals distinct
 *  arc shapes, not near-duplicates). */
const ENUM_MIN_SEP_DEG = 1.5;
/** Rotation enumeration step (deg). */
const ENUM_ROT_STEP_DEG = 0.5;
// FALSIFIED SHAPES (2026-06-10, both vs aim-enum-r2-03 = 600.71):
//  · elevation climb-defer to the legacy lane: removal = exact parity
//    (Δ−0.1, CI [−0.6, 0.2]) — the speed-fit and impact-feasibility terms
//    already steer demanding climbs; the defer was dead weight (deleted).
//  · sigmoid-reshaped readiness (σ((r−0.55)/0.10), the "smooth veto"):
//    REJECT Δ−2.0, negative every budget. Flattening the plateau discards
//    the surface's high-end gradient — the very signal that pushes steep
//    fast arrivals (v2→v3 lesson). The raw surface IS the right shape:
//    veto at the low end (0.2–0.4), informative slope at the top.

/** The enumerative proposer. Shared joint response model fitted from
 *  `cross5`/`grid9` probe rides, predicting current-gap axes, exit state, and
 *  eligible next-arrival rider state; one objective over the knob space:
 *
 *    objective(δp, δr) = current-axis-quality(predictedCurrentAxes, targets)
 *                      × next-gap-readiness(predictedNextState, next targets)
 *
 *  The readiness term is owned by optimizer/objective.ts and decomposes into
 *  catchability × speed-fit × impact-feasibility. */
export function makeEnumAimedCandidates(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
  base: Candidate,
  lineIdStart: number,
): Candidate[] {
  aimTotals.enum_considered++;
  aimTotals.enum_lane_bases++; // one base actually refined (LR_AIM_TOPK_BASES)
  const nextGap = nextContactGap(gap, gaps);
  if (nextGap === null) {
    aimTotals.enum_no_target++;
    return [];
  }
  if (nextGap.targets.speed === undefined && nextGap.targets.impact === undefined) {
    aimTotals.enum_no_target++;
    return [];
  }
  return makeJointAimedCandidates(engine, gap, nextGap, ctx, base, lineIdStart);
}

function makeJointAimedCandidates(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  nextGap: Gap,
  ctx: SpecContext,
  base: Candidate,
  lineIdStart: number,
): Candidate[] {
  const probeDesignName = aimJointProbeDesign();
  const mode = aimProbeMode();
  const modelSpace = aimModelSpace();
  const directOutputs = modelSpace === "direct";
  const probeKnobs = arcProbeDesign(probeDesignName);
  const span = arcKnobSpan(probeKnobs);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const nextFrame = nextGap.endFrame;
  const framesBeforeProbes = getPhysicsFrameCount();
  const probeRows = probeKnobs.map((knobs) =>
    evaluateJointArcKnobs(engine, base.lines, knobs, gap, ctx.allContactFrames, axisMeasureEnd, nextFrame, { mode, directOutputs })
  );
  aimTotals.joint_probe_frames_charged += Math.max(0, getPhysicsFrameCount() - framesBeforeProbes);
  recordJointProbeRows(probeRows, gap, axisMeasureEnd, nextFrame);
  // DIRECT model space: strip the latent rows at the FIT BOUNDARY only — probe
  // row telemetry above (recordJointProbeRows) sees unchanged rows — so the fit
  // runs knobs → the per-row ballistic outputs directly (no latent models;
  // predictJointArcOutputs then uses the direct fits since latentModels.size===0).
  // NB: stripping latents forfeits the latent reducer's prefix-derived
  // current-axis fallback on gate-failed rows — direct rows score only off
  // their own exit.*/next.* outputs. A real A/B semantic difference (measured
  // harmless: direct×cross5 +0.6 INCONCLUSIVE, 2026-06-12).
  const fitRows = directOutputs
    ? probeRows.map(({ latentOutputs: _drop, ...row }) => row)
    : probeRows;
  const model = fitJointArcResponseModel(fitRows, probeDesignName, "hybrid", {
    context: { gap, axisMeasureEnd, nextFrame },
  });

  const baseKnobs = { pitchDeg: 0, rotateDeg: 0 };
  recordJointModelCoverage(model, predictJointArcOutputs(model, baseKnobs), gap);
  const currentTargets = objectiveTargetsForGap(gap, ctx);
  const nextTargets = objectiveTargetsForGap(nextGap, ctx);
  const baseScore = scoreJointKnobs(
    model,
    baseKnobs,
    currentTargets,
    nextTargets,
    nextGap.endFrame,
  );
  if (baseScore === "next_before_exit") {
    aimTotals.enum_next_before_exit++;
    return [];
  }
  if (baseScore === "model_unscoreable") {
    aimTotals.enum_model_unscoreable++;
    return [];
  }

  if (span.rotateDeg > 0) aimTotals.enum_rot_recruited++;
  const pitchSpan = Math.min(aimDeltaMaxDeg(), span.pitchDeg);
  const rotateSpan = span.rotateDeg;
  const scored: JointScoredKnobs[] = [];
  for (let pitchDeg = -pitchSpan; pitchDeg <= pitchSpan + 1e-9; pitchDeg += ENUM_STEP_DEG) {
    for (let rotateDeg = -rotateSpan; rotateDeg <= rotateSpan + 1e-9; rotateDeg += ENUM_ROT_STEP_DEG) {
      // Near-base duplicate skip: an axis-aligned BOX around the base (0,0)
      // — drop grid points that reproduce the base candidate. Distinct from
      // the inter-proposal ellipse in distinctJointKnobs (see notes there).
      if (Math.abs(pitchDeg) < AIM_MIN_DELTA_DEG && Math.abs(rotateDeg) < ENUM_ROT_STEP_DEG / 2) continue;
      const score = scoreJointKnobs(
        model,
        { pitchDeg, rotateDeg },
        currentTargets,
        nextTargets,
        nextGap.endFrame,
      );
      if (typeof score !== "string" && score.val > baseScore.val + 1e-4) scored.push(score);
    }
  }
  scored.sort((a, b) =>
    b.val - a.val ||
    b.currentQuality - a.currentQuality ||
    Math.abs(a.knobs.rotateDeg) - Math.abs(b.knobs.rotateDeg) ||
    Math.abs(a.knobs.pitchDeg) - Math.abs(b.knobs.pitchDeg)
  );

  const chosen: JointScoredKnobs[] = [];
  for (const cand of scored) {
    if (chosen.length >= ENUM_TOP_K) break;
    if (chosen.every((prev) => distinctJointKnobs(prev.knobs, cand.knobs))) chosen.push(cand);
  }
  if (chosen.length === 0) {
    aimTotals.enum_on_target++;
    return [];
  }

  const probe = getCandidateProbe(engine, gap, ctx);
  const out: Candidate[] = [];
  for (const cand of chosen) {
    const aimedLines = applyArcKnobs(base.lines, cand.knobs)
      .map((l, i) => ({ ...l, id: lineIdStart + i }));
    const fit = tryCandidateLines(
      engine, gap, aimedLines, lineIdStart, ctx.allContactFrames,
      axisMeasureEnd, gap.targets, true,
      "normal", probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit === null) {
      aimTotals.enum_gate_fail++;
      if (cand.knobs.rotateDeg !== 0) aimTotals.enum_rot_gate_fail++;
      continue;
    }
    aimTotals.enum_emitted++;
    if (cand.knobs.rotateDeg !== 0) aimTotals.enum_rot_emitted++;
    aimTotals.enumReadinessGainSum += cand.val - baseScore.val;
    const achieved = probeRide(engine, aimedLines, nextFrame);
    const nextAimTargets = aimTargets(nextGap);
    const predictedReadiness = scoreNextTargetReadiness(cand.state, nextAimTargets);
    const achievedReadiness = achieved === null ? null : scoreNextTargetReadiness(achieved, nextAimTargets);
    if (predictedReadiness !== null && achievedReadiness !== null) {
      aimTotals.enumAchieved++;
      aimTotals.enumReadinessErrSum += Math.abs(predictedReadiness.readiness - achievedReadiness.readiness);
    }
    fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    fit.aimed = true;
    out.push(fit);
  }
  return out;
}

type JointScoredKnobs = {
  knobs: ArcKnobs;
  val: number;
  state: RiderArrivalState;
  currentQuality: number;
};

type JointScoreResult = JointScoredKnobs | "next_before_exit" | "model_unscoreable";

function scoreJointKnobs(
  model: ReturnType<typeof fitJointArcResponseModel>,
  knobs: ArcKnobs,
  currentTargets: AxisValues,
  nextTargets: AxisValues,
  nextEndFrame: number,
): JointScoreResult {
  const outputs = predictJointArcOutputs(model, knobs);
  const exitFrame = outputs["exit.frame"];
  if (Number.isFinite(exitFrame) && exitFrame > nextEndFrame) return "next_before_exit";
  const state = predictedArrivalState(outputs);
  if (state === null) return "model_unscoreable";
  // Align the sweep's speed-fit with the pool sort (objective.ts H4): score against the predicted
  // MEAN-of-flight speed (trapezoidal of exit + next), the statistic the speed target authors,
  // not the catch-instant arrival. Falls back to catch-instant when the exit speed is unavailable.
  const exitSpeed = outputs["exit.speed"];
  const arrival = Number.isFinite(exitSpeed) && Number.isFinite(state.speed)
    ? { ...state, meanSpeed: (exitSpeed + state.speed) / 2 }
    : state;
  const objective = scoreGapObjectiveForTargets(
    currentTargets,
    predictedCurrentAxes(outputs),
    arrival,
    nextTargets,
  );
  if (objective === null) return "model_unscoreable";
  return { knobs, val: objective.value, state, currentQuality: objective.currentQuality };
}

/** Inter-proposal separation: an ELLIPSE (Mahalanobis-style) distance test
 *  between two arbitrary proposals — keep the top-K chosen proposals as
 *  distinct arc shapes. This is a DIFFERENT test from the near-base box skip
 *  at the enumeration loop (which uses AIM_MIN_DELTA_DEG): different shape
 *  (ellipse vs box), reference point (peer proposal vs base 0,0) and scales
 *  (ENUM_MIN_SEP_DEG=1.5 / ENUM_ROT_STEP_DEG=0.5 here vs 0.25/0.25 there).
 *  They share the "minimum meaningful knob separation" notion but not a
 *  formula; do not collapse them. */
function distinctJointKnobs(a: ArcKnobs, b: ArcKnobs): boolean {
  const dp = Math.abs(a.pitchDeg - b.pitchDeg) / ENUM_MIN_SEP_DEG;
  const dr = Math.abs(a.rotateDeg - b.rotateDeg) / ENUM_ROT_STEP_DEG;
  return dp * dp + dr * dr >= 1;
}

// ─────────── 7 · Quality-objective pool sort (LR_RANK_QUALITY) ───────────
//
// Same objective the aim lane optimizes, but evaluated on each candidate's
// ACHIEVED axes and its arrival state at the next contact — used to RANK the
// per-gap candidate pool (node.ts) instead of cost. Handoff branch selection
// stays forward-eval. All dead code unless rankQualityEnabled().
//
// Cost control (vs an unbounded ride-every-candidate judge, 148.4M frames) —
// the objective NEVER charges a physics frame:
//   • MEMOIZE per candidate (objectiveCache) — object identity survives pool
//     rebuilds and branch scoring, so no candidate is ever scored twice.
//   • PREDICTED ARRIVAL — candidates propagate their captured release state
//     ballistically to the next contact (zero frames). Prediction-impossible →
//     null objective → cost order.

/** Per-candidate objective memo (object identity, scoped to live candidates).
 *  null = computed-and-undefined (no next contact / unreadable arrival / prediction
 *  impossible); a number = the objective. Absent key = not yet computed. */
const objectiveCache = new WeakMap<Candidate, number | null>();

/** A candidate's rank objective: current-axis-quality × next-gap-readiness, or
 *  null (there is no next contact, the arrival state is unavailable, or
 *  prediction is impossible). The candidate's release state is propagated
 *  ballistically to the next contact (predict-only — no charged ride is ever
 *  taken). Prediction-impossible (missing release state, comAngle-less
 *  propagation) → null objective (cost order). Memoized so no candidate is scored
 *  twice. */
export function candidateQualityObjective(
  // deno-lint-ignore no-explicit-any
  _engine: any,
  candidate: Candidate,
  gap: Gap,
  gaps: Gap[],
  ctx?: SpecContext,
): number | null {
  const cached = objectiveCache.get(candidate);
  if (cached !== undefined) return cached;
  const nextGap = nextContactGap(gap, gaps);
  if (nextGap === null) return memoObjective(candidate, null);

  // PREDICTED ARRIVAL: propagate the candidate's release state ballistically to
  // the next contact. No charged ride. Prediction-impossible (missing release
  // state, non-airborne release, comAngle-less propagation result) → null
  // objective (cost order).
  const arrival = predictArrivalAtNextContact(candidate, nextGap.endFrame);
  if (arrival === null || arrival.comAngleDeg === null) {
    aimTotals.rank_quality_pred_bail++;
    return memoObjective(candidate, null);
  }
  aimTotals.rank_quality_pred_used++;
  const objective = scoreGapObjectiveForTargets(
    objectiveTargetsForGap(gap, ctx),
    candidate.achieved,
    arrival,
    objectiveTargetsForGap(nextGap, ctx),
  );
  return memoObjective(candidate, objective === null ? null : objective.value);
}

function objectiveTargetsForGap(gap: Gap, ctx?: SpecContext): AxisValues {
  return ctx?.gapAxisTargets?.[gap.index] ?? gap.targets;
}

function memoObjective(candidate: Candidate, value: number | null): number | null {
  objectiveCache.set(candidate, value);
  return value;
}

/** Sort a candidate pool by the quality objective DESCENDING; ties (and
 *  undefined-objective candidates relative to each other) break by cost
 *  ascending then sample order (stable). When ANY candidate has a defined
 *  objective the gap has a readable next-contact frontier, so defined-objective
 *  candidates rank ABOVE undefined ones; when none do, the whole pool falls back
 *  to the cost order. Every candidate's objective is scored by ballistic
 *  prediction (no charged rides). Pool/disagreement
 *  telemetry is recorded only when `record` is set: a pool build may sort twice
 *  (pre-lane, then merged with lane extras) and the counters must reflect the
 *  FINAL ordering once per build — when the merged re-sort never happens, the
 *  caller records the pre-lane ordering itself via `recordRankQualityPool`. */
export function sortCandidatesByQuality(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  gaps: Gap[],
  costSorted: Candidate[],
  record: boolean,
  ctx?: SpecContext,
): Candidate[] {
  if (costSorted.length === 0) return costSorted;
  const objectives = new Map<Candidate, number>();
  let anyDefined = false;
  for (const cand of costSorted) {
    const obj = candidateQualityObjective(engine, cand, gap, gaps, ctx);
    if (obj !== null) {
      objectives.set(cand, obj);
      anyDefined = true;
    }
  }
  if (!anyDefined) {
    if (record) recordRankQualityPool(costSorted, costSorted);
    return costSorted;
  }
  // `costSorted` is already cost-then-sample-order; a stable sort therefore
  // breaks objective ties by cost then sample order for free.
  const ranked = [...costSorted].sort((a, b) => {
    const oa = objectives.get(a);
    const ob = objectives.get(b);
    if (oa !== undefined && ob !== undefined) return ob - oa;
    if (oa !== undefined) return -1; // defined ranks above undefined
    if (ob !== undefined) return 1;
    return 0; // both undefined: keep cost/sample order
  });
  if (record) recordRankQualityPool(costSorted, ranked);
  return ranked;
}

/** Once-per-pool-build telemetry over the FINAL ordering: pool count, top-3 /
 *  top-1 disagreement vs the cost order, and scored/defined tallies for the
 *  fallback rate. Defined-ness is read off the objective memo (a cached number;
 *  prediction-impossible candidates memo null and count as undefined). Pure
 *  reads — cannot perturb the ordering. */
export function recordRankQualityPool(costSorted: Candidate[], ranked: Candidate[]): void {
  aimTotals.rank_quality_pools++;
  aimTotals.rank_quality_candidates_scored += costSorted.length;
  for (const cand of costSorted) {
    if (typeof objectiveCache.get(cand) === "number") aimTotals.rank_quality_objective_defined++;
  }
  if (costSorted[0] !== ranked[0]) aimTotals.rank_quality_top1_disagree++;
  const k = Math.min(3, costSorted.length);
  const costTop = new Set(costSorted.slice(0, k));
  let same = true;
  for (let i = 0; i < k; i++) {
    if (!costTop.has(ranked[i])) { same = false; break; }
  }
  if (!same) aimTotals.rank_quality_top3_disagree++;
}
