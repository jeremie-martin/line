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
 * hybrid joint response model also used by the study harness; top-k proposals
 * with current k=2 (the measured knee); readiness consumes the full predicted
 * arrival-state boundary, though the current surface still reads speed and
 * CoM angle only (pose parked by R0).
 */

import { getPhysicsFrameCount, getRiderMetered, sledPoseDegFromRider } from "../../lib/detector.ts";
import {
  axisLookaheadEndFrame,
  RANK_PREDICT_ARRIVAL,
  RANK_PREDICT_ARRIVAL_HYBRID,
  RANK_QUALITY_MODE,
  tryCandidateLines,
} from "../core/candidate.ts";
import { engineLineFromTrackLine } from "../core/substrate.ts";
import { authoredSpeedToPx, AXES, CALIB, type TrackLine } from "../types.ts";
import { axisQualityForTargets } from "../score.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./sample.ts";
import {
  applyArcKnobs,
  arcKnobSpan,
  arcProbeDesign,
  fitJointArcResponseModel,
  parseArcProbeDesignName,
  predictedArrivalState,
  propagateBallisticArrivalState,
  predictedCurrentAxes,
  predictJointArcOutputs,
  pitchExitLines,
  rotateArcLines,
  type ArcKnobs,
  type ArcProbeDesignName,
  type JointArcResponseModel,
  type RiderArrivalState,
} from "./arc_model.ts";
import { evaluateJointArcKnobs, type JointArcProbeObservation } from "./arc_probe.ts";
import { readinessCatchState } from "./readiness.ts";
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
 *  impact-feasibility, propose the top-k through the unchanged production
 *  evaluation. Current production k=2. Subsumed and replaced every
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

function aimJointEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_JOINT !== "0";
}

function aimJointProbeDesign(): ArcProbeDesignName {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_JOINT_PROBE_DESIGN ?? "cross5";
  return parseArcProbeDesignName(raw);
}

/** EXPERIMENT (LR_AIM_TOPK_BASES, int >=1, default 3): how many of the
 *  quality-sorted pool's leading candidates the aim lane refines once the
 *  compile is above the maturity threshold. K=1 runs the lane on `sorted[0]`
 *  only. K>1 runs it on the first K distinct candidates, accumulating each
 *  base's lane extras into the pool, so the search refines more than just the
 *  quality-best base. Parsed once at import (env is constant per run; gates a
 *  per-pool-build hot path). Invalid/absent/<1 -> 3. */
export const AIM_TOPK_BASES: number = (() => {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_TOPK_BASES;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 3;
})();

/** Maturity gate for K>1 (LR_AIM_TOPK_BASES). The extra bases find good variants
 *  but cost ~2.5× more probe frames per pool build; at small budgets that probe
 *  cost starves the compile (validity collapses, the per-budget curve goes deeply
 *  negative at 50k/100k and only turns positive at 200k/300k). So gate K>1 on the
 *  compile TARGET budget — the same per-compile-constant maturity signal the
 *  forward-eval gate (usesForwardEvalAtBudget) and the impact-cost ramp
 *  (LOCAL_IMPACT_COST_MATURE_*) use. Target budget is fixed for the whole compile,
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
 *  Threshold 150k: the per-budget curve has 100k still net-negative (−9.1) and
 *  200k net-positive (+1.5). A threshold in (100k, 200k] keeps the 50k/100k
 *  compiles at K=1 and lets the 200k/300k compiles at K>1. 150k matches the
 *  established LOCAL_IMPACT_COST_MATURE_START_FRAMES so the two maturity gates
 *  share one frontier. */
const AIM_TOPK_MATURE_BUDGET_FRAMES = 150_000;

let aimCompileBudgetFrames = 0;
/** Set the compile target budget for the K>1 maturity gate. Called once per
 *  compile at compileHandoff entry, alongside the other budget setters. */
export function setAimCompileBudgetFrames(frames: number): void {
  aimCompileBudgetFrames = Math.max(0, frames | 0);
}

/** Effective lane-base count for the current compile: K below the maturity
 *  threshold collapses to 1 (byte-identical to the K=1 default), the configured
 *  AIM_TOPK_BASES at or above it. */
export function aimTopKBasesEffective(): number {
  return aimCompileBudgetFrames >= AIM_TOPK_MATURE_BUDGET_FRAMES ? AIM_TOPK_BASES : 1;
}

/** Telemetry: a requested top-K base was skipped (duplicate of an
 *  already-refined base, or the pool was shorter than K). */
export function recordLaneBaseSkip(): void {
  aimTotals.enum_lane_base_skips++;
}

/** Quality-objective pool ranking (LR_RANK_QUALITY): make the rich aim objective
 *  — current-axis-quality × readiness × speed-fit × impact-feasibility, computed
 *  from each candidate's ACHIEVED axes and its arrival state at the next contact
 *  — the JUDGE of the per-gap pool sort (node.ts), so the aim lane refines the
 *  quality-best base instead of the cost-best one. Two modes:
 *    "pool" (DEFAULT / any value other than "off"): the per-gap pool sort ranks
 *            by the objective; handoff branch selection stays the unchanged
 *            forward-eval / cost+preview judge.
 *    "off"  (LR_RANK_QUALITY=off): escape hatch — bit-identical to the
 *            pre-ranking path; the ranking helpers below are never called and no
 *            arrival ride is taken.
 *  The env parse lives in core/candidate.ts (single owner, shared with the
 *  free-capture gate there). */
export function rankQualityEnabled(): boolean {
  return RANK_QUALITY_MODE !== "off";
}

// ─────────────────────────── 2 · Telemetry ───────────────────────────

/** Lane telemetry (compile_stats.aim — lab-queryable via json_extract).
 *  Funnel: considered → (no_target | probe_crash | on_target) →
 *  (gate_fail | emitted). Accuracy: |predicted − achieved| readiness of
 *  emitted proposals — the lane's measured value-add per emission. */
export type AimStats = {
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
  /** Quality-objective pool ranking (LR_RANK_QUALITY; absent when off). NOTE: the
   *  `rank_readiness_*` field names are HISTORICAL (the flag was once called
   *  LR_RANK_READINESS) — kept unchanged so existing lab archives stay queryable.
   *  Pool builds where the cost-rank and quality-rank top-3 sets differ, and
   *  where the top-1 differs; physics frames charged by per-candidate
   *  arrival-state rides; candidates with a defined objective vs total scored
   *  (fallback rate = (scored − defined) / scored). free/charged split the
   *  arrival capture: `free` = read off the candidate's own measurement
   *  detection (zero frames), `charged` = a bounded top-M memoized probeRide. */
  rank_readiness_pools: number;
  rank_readiness_top3_disagree: number;
  rank_readiness_top1_disagree: number;
  rank_readiness_arrival_frames_charged: number;
  rank_readiness_candidates_scored: number;
  rank_readiness_objective_defined: number;
  rank_readiness_capture_free: number;
  rank_readiness_capture_charged: number;
  rank_readiness_capture_skipped: number;
  /** PREDICTED-ARRIVAL (LR_RANK_PREDICT_ARRIVAL). Ground-truth prediction error
   *  accumulated on every candidate that HAS a free capture: the ballistic
   *  prediction is computed alongside the exact free read and the absolute
   *  errors summed (`_speed_sum` in px/f, `_angle_sum` in deg, over `_n`
   *  validated candidates) — a zero-cost honest readout of how good the
   *  prediction would be if it replaced the free read. `_bail` counts candidates
   *  where prediction was attempted (no free capture, or validation) but could
   *  not produce a state (missing release state, grounded/non-airborne flight,
   *  or a comAngle-less result). */
  rank_quality_pred_err_speed_sum: number;
  rank_quality_pred_err_angle_sum: number;
  rank_quality_pred_err_n: number;
  /** Prediction bails on the PREDICT path (no free capture, predict couldn't
   *  produce a state → null objective). */
  rank_quality_pred_bail: number;
  /** Prediction bails on the VALIDATION path (a free capture existed but the
   *  parallel prediction couldn't produce a comparable state — excluded from the
   *  error means, counted here). */
  rank_quality_pred_val_bail: number;
  /** Candidates ranked via a ballistic PREDICTION (no free capture, predict
   *  flag on): the prediction-only objective path that replaces the charged
   *  ride. */
  rank_quality_pred_used: number;
  /** HYBRID (LR_RANK_PREDICT_ARRIVAL=hybrid): no-free-capture candidates routed to
   *  the bounded charged probeRide BECAUSE they were not airborne at release (so
   *  ballistic prediction could not serve them). The support-population recovery
   *  the hybrid arm adds; 0 under "1" and predict-off. Charged-vs-predicted split:
   *  predicted = rank_quality_pred_used, charged-fallback = this counter. */
  rank_quality_hybrid_charged: number;
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
  // Quality-objective pool ranking (recordRankQualityPool / candidateRankObjective).
  // Field names are historical (was LR_RANK_READINESS); kept for lab archives.
  rank_readiness_pools: 0, rank_readiness_top3_disagree: 0,
  rank_readiness_top1_disagree: 0, rank_readiness_arrival_frames_charged: 0,
  rank_readiness_candidates_scored: 0, rank_readiness_objective_defined: 0,
  rank_readiness_capture_free: 0, rank_readiness_capture_charged: 0,
  rank_readiness_capture_skipped: 0,
  // Predicted-arrival validation + usage (LR_RANK_PREDICT_ARRIVAL).
  rank_quality_pred_err_speed_sum: 0, rank_quality_pred_err_angle_sum: 0,
  rank_quality_pred_err_n: 0, rank_quality_pred_bail: 0,
  rank_quality_pred_val_bail: 0, rank_quality_pred_used: 0,
  rank_quality_hybrid_charged: 0,
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
 *  targeted axes have NO model prediction ranks on
 *  readiness × speed-fit × impact-feasibility alone (axis quality defaults
 *  to 1 on an empty error set — score.ts axisQualityFromErrors); that is a
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

/** Snapshot for compile stats; null when the lane never ran (flag off /
 *  no pools) so ablation archives carry no aim key at all. */
export function snapshotAimStats(): AimStats | null {
  if (aimTotals.enum_considered === 0) return null;
  const round3 = (x: number): number => Math.round(x * 1000) / 1000;
  return {
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
    rank_readiness_pools: aimTotals.rank_readiness_pools,
    rank_readiness_top3_disagree: aimTotals.rank_readiness_top3_disagree,
    rank_readiness_top1_disagree: aimTotals.rank_readiness_top1_disagree,
    rank_readiness_arrival_frames_charged: aimTotals.rank_readiness_arrival_frames_charged,
    rank_readiness_candidates_scored: aimTotals.rank_readiness_candidates_scored,
    rank_readiness_objective_defined: aimTotals.rank_readiness_objective_defined,
    rank_readiness_capture_free: aimTotals.rank_readiness_capture_free,
    rank_readiness_capture_charged: aimTotals.rank_readiness_capture_charged,
    rank_readiness_capture_skipped: aimTotals.rank_readiness_capture_skipped,
    rank_quality_pred_err_speed_sum: aimTotals.rank_quality_pred_err_speed_sum,
    rank_quality_pred_err_angle_sum: aimTotals.rank_quality_pred_err_angle_sum,
    rank_quality_pred_err_n: aimTotals.rank_quality_pred_err_n,
    rank_quality_pred_bail: aimTotals.rank_quality_pred_bail,
    rank_quality_pred_val_bail: aimTotals.rank_quality_pred_val_bail,
    rank_quality_pred_used: aimTotals.rank_quality_pred_used,
    rank_quality_hybrid_charged: aimTotals.rank_quality_hybrid_charged,
  };
}

// ──────────────────────── 3 · Knob transforms ────────────────────────

/** Probe offsets for the quadratic fit (deg); the base candidate is δ=0. */
const AIM_PROBE_DELTA_DEG = 6;
/** Below this |δ*| the aimed variant would duplicate the base candidate. */
const AIM_MIN_DELTA_DEG = 0.25;
/** Deferred whole-arc-rotation probe span (deg, V0-validated range). */
const AIM_ROT_PROBE_DEG = 3;

/** Safe tail-only knob: it never touches the catch at the arc's head — gap k's
 *  own landing frame and speed shift by exactly 0.00 under it (V1). */
const pitchExit = pitchExitLines;

/** Whole-arc knob: moves the landing surface, so it has higher gate risk. */
const rotateArc = rotateArcLines;

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

// ────────────────────────── 5 · Local models ─────────────────────────

/** Exact quadratic through (−P, lo), (0, mid), (+P, hi). Three points are
 *  the measured accuracy knee for CoM state (V0 probe-count ladder) — an
 *  empirical setting, not a rule; the base candidate's own measurement is
 *  the free δ=0 point where one exists. */
function quadModel(lo: number, mid: number, hi: number, P: number): (d: number) => number {
  return (d: number): number =>
    (lo * d * (d - P)) / (2 * P * P) - (mid * (d + P) * (d - P)) / (P * P) +
    (hi * (d + P) * d) / (2 * P * P);
}

// ───────────────────────────── 6 · Lanes ─────────────────────────────

/** Impact ask below which the impact-feasibility factor stays out of the
 *  objective (asks this small convert without steering). */
const AIM_IMPACT_MIN_ASK = 0.3;

/** The speed target the launch should serve: the NEXT contact gap's authored
 *  speed target (the arrival this launch conditions), in px/f. */
function nextGapSpeedTargetPx(gap: Gap, gaps: Gap[]): number | null {
  const g = nextContactGap(gap, gaps);
  return g === null || g.targets.speed === undefined ? null : authoredSpeedToPx(g.targets.speed);
}

function nextContactGap(gap: Gap, gaps: Gap[]): Gap | null {
  for (let i = gap.index + 1; i < gaps.length; i++) {
    if (gaps[i].endsWithContact) return gaps[i];
  }
  return null;
}

// ──────────────── R2 · Enumerative proposer (LR_AIM_ENUM) ────────────────

/** Proposals per pool (the "1000 variations" live inside the model; only
 *  the top 2 are simulated). k=2 is the measured knee (2026-06-10 sweep vs
 *  600.71: k=1 Δ−1.1 with −2.1…−2.7 at every mature budget — the second
 *  proposal pays; k=3 Δ−4.5 REJECT — the third starves small budgets,
 *  50k −43.8, validity dip). */
const ENUM_TOP_K = 2;
/** Enumeration step (deg) — far below model error; effectively continuous. */
const ENUM_STEP_DEG = 0.25;
/** Minimum spacing between proposed deltas (keep the k proposals distinct
 *  arc shapes, not near-duplicates). */
const ENUM_MIN_SEP_DEG = 1.5;
/** Readiness clamp floor (roadmap: a wrong readiness model must not be
 *  able to veto everything). */
const ENUM_R_MIN = 0.1;
/** Speed-target fit scale (px/f): exp(−|predicted − target|/scale). */
const ENUM_SPEED_SCALE_PXF = 0.75;
/** Legacy deferred-additive rotation path (`LR_AIM_JOINT=0`) constants. The default
 *  path now scores a real joint pitch/rotate grid inside the selected probe span.
 *  Historical context for the legacy path: R3 v2
 *  Δ+0.4 vs 600.57, positive at mature budgets, and it IS the agreed
 *  architecture: the inner model can compose multiple per-knob fits. Grounds:
 *  additivity certified proposer-grade (study_knob_additivity ~10%
 *  median interaction); scout study_joint_enum (289 gaps @300k):
 *  achieved objective gain p50 +0.035, 3× larger where pitch clamps;
 *  v1 eager/always-on/±4°-extrapolated/no-margin REJECT Δ−7.9 — rotated
 *  proposals displaced 92% of pitch proposals and failed the on-beat
 *  landing gate 37% of the time, commits −34%).
 *  Sweep stays INSIDE the probed
 *  span (±3° — v1 extrapolated to ±4° and its argmaxes chased the edge).
 *  Recruit only when the pitch sweep is exhausted: boundary-clamped, or
 *  best pitch gain below NOGAIN (scout: gains are 3× larger at the pitch
 *  boundary; v1's always-on rotation displaced pitch proposals and burned
 *  evals on a 37% gate-fail rate). MARGIN: a rotated proposal must beat
 *  the best pitch proposal by ≥15% predicted objective to pay its higher
 *  gate risk. */
const ENUM_ROT_SPAN_DEG = 3;
const ENUM_ROT_STEP_DEG = 0.5;
const ENUM_ROT_MARGIN = 1.15;
const ENUM_ROT_RECRUIT_NOGAIN = 1.05;
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
 *                      × clamp(readiness(predictedNextState), R_MIN, 1)
 *                      × exp(−|predictedSpeed − nextSpeedTarget| / scale)
 *                      × next-impact-feasibility(predictedNextState)
 *
 *  enumerated inside the models (free), top-k improving deltas proposed
 *  through the unchanged production evaluation (current k=2). The old
 *  per-knob additive proposer remains available with `LR_AIM_JOINT=0`.
 *
 *  The R1 caveat (catchability mis-scores the upward arrivals climbing
 *  wants) needed NO special handling in the end: an elevation climb-defer
 *  was removed at exact parity — the speed-fit and impact-feasibility
 *  factors already cover demanding climbs. */
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
  const speedTarget = nextGapSpeedTargetPx(gap, gaps);
  if (speedTarget === null && nextGap.targets.impact === undefined) {
    aimTotals.enum_no_target++;
    return [];
  }
  if (aimJointEnabled()) {
    return makeJointAimedCandidates(engine, gap, nextGap, ctx, base, lineIdStart, speedTarget);
  }

  const F = nextGap.endFrame;
  const baseOut = probeRide(engine, base.lines, F);
  if (baseOut === null || baseOut.comAngleDeg === null) {
    aimTotals.enum_probe_crash++;
    return [];
  }
  const P = AIM_PROBE_DELTA_DEG;
  const lo = probeRide(engine, pitchExit(base.lines, -P), F);
  if (lo === null || lo.comAngleDeg === null) {
    aimTotals.enum_probe_crash++;
    return [];
  }
  const hi = probeRide(engine, pitchExit(base.lines, P), F);
  if (hi === null || hi.comAngleDeg === null) {
    aimTotals.enum_probe_crash++;
    return [];
  }
  // Both arrival models from the SAME three rides (one ride = the full
  // outcome vector; adding a quantity costs zero probes).
  const speedModel = quadModel(lo.speed, baseOut.speed, hi.speed, P);
  const angleModel = quadModel(lo.comAngleDeg, baseOut.comAngleDeg, hi.comAngleDeg, P);

  // R3 additive two-knob inner model: the rotate knob's models are recruited
  // only where the pitch sweep is exhausted. The joint
  // prediction is the ADDITIVE composition of per-knob quadratics
  // (certified proposer-grade — see ENUM_ROT_SPAN_DEG notes).
  let rotSpeedModel: ((d: number) => number) | null = null;
  let rotAngleModel: ((d: number) => number) | null = null;
  // Impact-feasibility component (roadmap R3, brought forward after enum
  // v2 parity: catchability alone barely differentiates 15° from 25°
  // arrivals, so nothing pushed the steep arrivals conversion needs).
  // Closed form: achievable ask ≈ speed·sin(angle)/REDIR_CAP — the same
  // physics as V4's needed-turn formula, as a smooth factor instead of a
  // hand-clamped target.
  const impactAsk = nextGap.targets.impact;
  const wantImpact = impactAsk !== undefined && impactAsk >= AIM_IMPACT_MIN_ASK;
  // Predicted arrival state at (dp, dr). The dr=0 / no-rot-model branch
  // keeps the pitch-only floating-point path bit-identical to R2.
  const predSpeed = (dp: number, dr: number): number =>
    rotSpeedModel === null || dr === 0 ? speedModel(dp) : speedModel(dp) + rotSpeedModel(dr) - baseOut.speed;
  const predAngle = (dp: number, dr: number): number =>
    rotAngleModel === null || dr === 0
      ? angleModel(dp)
      : angleModel(dp) + rotAngleModel(dr) - (baseOut.comAngleDeg as number);
  const objective = (dp: number, dr: number): number => {
    const s = predSpeed(dp, dr);
    const a = predAngle(dp, dr);
    const r = Math.max(ENUM_R_MIN, readinessCatchState({ speed: s, comAngleDeg: a }));
    const fit = speedTarget === null ? 1 : Math.exp(-Math.abs(s - speedTarget) / ENUM_SPEED_SCALE_PXF);
    const feas = !wantImpact ? 1 : Math.min(
      1,
      Math.max(0, (s * Math.sin((Math.max(0, a) * Math.PI) / 180)) / ((impactAsk as number) * CALIB.REDIR_CAP)),
    );
    return r * fit * feas;
  };

  const deltaMax = aimDeltaMaxDeg();
  const obj0 = objective(0, 0);
  const scoredDeltas: { dp: number; dr: number; val: number }[] = [];
  for (let dp = -deltaMax; dp <= deltaMax + 1e-9; dp += ENUM_STEP_DEG) {
    if (Math.abs(dp) < AIM_MIN_DELTA_DEG) continue;
    const val = objective(dp, 0);
    if (val > obj0 + 1e-4) scoredDeltas.push({ dp, dr: 0, val });
  }
  scoredDeltas.sort((a, b) => b.val - a.val);

  // R3 v2: recruit the rotate knob LAZILY, only where pitch is exhausted.
  // v1 (eager, always-on, span ±4 extrapolated, no margin) was REJECTED
  // Δ−7.9: rotated proposals displaced 92% of pitch proposals and failed
  // the production gates 37% of the time (rotateArc moves the landing
  // surface; the scout's 1.8% "break" rate measured sled survival, not the
  // on-beat-landing gate), and aimed commits dropped 34%. What stands from
  // the scout: gains concentrate 3× where pitch clamps. So: recruit only
  // when the pitch sweep is boundary-clamped or empty-handed, sweep within
  // the PROBED rotate span (no extrapolation), demand a clear predicted
  // margin, and emit at most ONE rotated proposal in its own slot — the
  // top pitch proposal is never displaced.
  let rotInjected: { dp: number; dr: number; val: number } | null = null;
  {
    const pitchBest = scoredDeltas.length > 0 ? scoredDeltas[0] : null;
    const pitchBestVal = pitchBest === null ? obj0 : pitchBest.val;
    const pitchExhausted = pitchBest === null ||
      Math.abs(pitchBest.dp) >= deltaMax - ENUM_STEP_DEG / 2 ||
      pitchBestVal < obj0 * ENUM_ROT_RECRUIT_NOGAIN;
    if (pitchExhausted) {
      aimTotals.enum_rot_recruited++;
      const RP = AIM_ROT_PROBE_DEG;
      const rLo = probeRide(engine, rotateArc(base.lines, -RP), F);
      const rHi = rLo === null ? null : probeRide(engine, rotateArc(base.lines, RP), F);
      if (rLo === null || rLo.comAngleDeg === null || rHi === null || rHi.comAngleDeg === null) {
        aimTotals.enum_rot_probe_crash++;
      } else {
        rotSpeedModel = quadModel(rLo.speed, baseOut.speed, rHi.speed, RP);
        rotAngleModel = quadModel(rLo.comAngleDeg, baseOut.comAngleDeg, rHi.comAngleDeg, RP);
        let best: { dp: number; dr: number; val: number } | null = null;
        for (let dr = -ENUM_ROT_SPAN_DEG; dr <= ENUM_ROT_SPAN_DEG + 1e-9; dr += ENUM_ROT_STEP_DEG) {
          if (Math.abs(dr) < ENUM_ROT_STEP_DEG / 2) continue;
          for (let dp = -deltaMax; dp <= deltaMax + 1e-9; dp += ENUM_STEP_DEG) {
            const val = objective(dp, dr);
            if (best === null || val > best.val) best = { dp, dr, val };
          }
        }
        if (best !== null && best.val > Math.max(obj0 + 1e-4, pitchBestVal * ENUM_ROT_MARGIN)) {
          rotInjected = best;
        }
      }
    }
  }

  const chosen: { dp: number; dr: number; val: number }[] = [];
  if (rotInjected !== null) chosen.push(rotInjected);
  for (const cand of scoredDeltas) {
    if (chosen.length >= ENUM_TOP_K) break;
    // Rotated slot never blocks a pitch proposal (different arc family);
    // among pitch proposals the R2 separation rule applies unchanged.
    const distinct = chosen.every((c) => c.dr !== 0 || Math.abs(c.dp - cand.dp) >= ENUM_MIN_SEP_DEG);
    if (distinct) chosen.push(cand);
  }
  if (chosen.length === 0) {
    aimTotals.enum_on_target++;
    return [];
  }

  const probe = getCandidateProbe(engine, gap, ctx);
  const out: Candidate[] = [];
  for (const { dp, dr, val } of chosen) {
    // All pool candidates are alternatives — they share the same line-ID
    // range (exactly like sampler attempts); only the committed one's ids
    // reach the track. Rotate FIRST then pitch — the composition order the
    // additivity study certified.
    const aimedLines = pitchExit(dr !== 0 ? rotateArc(base.lines, dr) : base.lines, dp)
      .map((l, i) => ({ ...l, id: lineIdStart + i }));
    const fit = tryCandidateLines(
      engine, gap, aimedLines, lineIdStart, ctx.allContactFrames,
      axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
      "normal", probe.preTargetSledTrace,
    ) as Candidate | null;
    if (fit === null) {
      aimTotals.enum_gate_fail++;
      if (dr !== 0) aimTotals.enum_rot_gate_fail++;
      continue;
    }
    aimTotals.enum_emitted++;
    if (dr !== 0) aimTotals.enum_rot_emitted++;
    aimTotals.enumReadinessGainSum += val - obj0;
    const achieved = probeRide(engine, aimedLines, F);
    if (achieved !== null && achieved.comAngleDeg !== null) {
      aimTotals.enumAchieved++;
      aimTotals.enumReadinessErrSum += Math.abs(
        Math.max(ENUM_R_MIN, readinessCatchState({ speed: predSpeed(dp, dr), comAngleDeg: predAngle(dp, dr) })) -
          Math.max(ENUM_R_MIN, readinessCatchState({ speed: achieved.speed, comAngleDeg: achieved.comAngleDeg })),
      );
    }
    fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    fit.aimed = true;
    out.push(fit);
  }
  return out;
}

function makeJointAimedCandidates(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  nextGap: Gap,
  ctx: SpecContext,
  base: Candidate,
  lineIdStart: number,
  speedTarget: number | null,
): Candidate[] {
  const probeDesignName = aimJointProbeDesign();
  const probeKnobs = arcProbeDesign(probeDesignName);
  const span = arcKnobSpan(probeKnobs);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const nextFrame = nextGap.endFrame;
  const framesBeforeProbes = getPhysicsFrameCount();
  const probeRows = probeKnobs.map((knobs) =>
    evaluateJointArcKnobs(engine, base.lines, knobs, gap, ctx.allContactFrames, axisMeasureEnd, nextFrame)
  );
  aimTotals.joint_probe_frames_charged += Math.max(0, getPhysicsFrameCount() - framesBeforeProbes);
  recordJointProbeRows(probeRows, gap, axisMeasureEnd, nextFrame);
  const model = fitJointArcResponseModel(probeRows, probeDesignName, "hybrid", {
    context: { gap, axisMeasureEnd, nextFrame },
  });

  const baseKnobs = { pitchDeg: 0, rotateDeg: 0 };
  recordJointModelCoverage(model, predictJointArcOutputs(model, baseKnobs), gap);
  const baseScore = scoreJointKnobs(model, baseKnobs, gap, nextGap, speedTarget);
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
      if (Math.abs(pitchDeg) < AIM_MIN_DELTA_DEG && Math.abs(rotateDeg) < ENUM_ROT_STEP_DEG / 2) continue;
      const score = scoreJointKnobs(model, { pitchDeg, rotateDeg }, gap, nextGap, speedTarget);
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
    if (achieved !== null && achieved.comAngleDeg !== null) {
      aimTotals.enumAchieved++;
      aimTotals.enumReadinessErrSum += Math.abs(
        Math.max(ENUM_R_MIN, readinessCatchState(cand.state)) -
          Math.max(ENUM_R_MIN, readinessCatchState(achieved)),
      );
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
  gap: Gap,
  nextGap: Gap,
  speedTarget: number | null,
): JointScoreResult {
  const outputs = predictJointArcOutputs(model, knobs);
  const exitFrame = outputs["exit.frame"];
  if (Number.isFinite(exitFrame) && exitFrame > nextGap.endFrame) return "next_before_exit";
  const state = predictedArrivalState(outputs);
  if (state === null || state.comAngleDeg === null) return "model_unscoreable";
  const readiness = Math.max(ENUM_R_MIN, readinessCatchState(state));
  const fit = speedFitFactor(state.speed, speedTarget);
  const feas = impactFeasibility(state, nextGap);
  const currentQuality = predictedCurrentQuality(outputs, gap);
  return { knobs, val: currentQuality * readiness * fit * feas, state, currentQuality };
}

/** Speed-target fit factor exp(−|s − target|/scale); 1 when the next gap has no
 *  speed target. Single source for the objective's speed term (lane + rank). */
function speedFitFactor(speed: number, speedTarget: number | null): number {
  return speedTarget === null ? 1 : Math.exp(-Math.abs(speed - speedTarget) / ENUM_SPEED_SCALE_PXF);
}

function predictedCurrentQuality(outputs: Record<string, number>, gap: Gap): number {
  return axisQualityForTargets(gap.targets, predictedCurrentAxes(outputs)).axis_quality;
}

function impactFeasibility(state: Pick<RiderArrivalState, "speed" | "comAngleDeg">, nextGap: Gap): number {
  const impactAsk = nextGap.targets.impact;
  if (impactAsk === undefined || impactAsk < AIM_IMPACT_MIN_ASK || state.comAngleDeg === null) return 1;
  return Math.min(
    1,
    Math.max(0, (state.speed * Math.sin((Math.max(0, state.comAngleDeg) * Math.PI) / 180)) / (impactAsk * CALIB.REDIR_CAP)),
  );
}

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
// Cost control (vs an unbounded ride-every-candidate judge, 148.4M frames):
//   • MEMOIZE per candidate (objectiveCache) — object identity survives pool
//     rebuilds and branch scoring, so no candidate is ever ridden twice.
//   • FREE CAPTURE — for long air-target gaps the candidate's own measurement
//     ride already reached the next contact; its arrival state rides on
//     candidate.arrivalAtNextContact (core/candidate.ts), so the objective is
//     computed with ZERO charged frames.
//   • BOUNDED CHARGED — candidates without a free capture cost a probeRide;
//     ride only the top-M cost-sorted of those (M = RANK_CHARGE_TOP_M). The
//     rest get a null objective and stay in cost order below the scored ones.

/** Cap on charged arrival rides PER POOL BUILD: only the first M cost-sorted
 *  candidates lacking a free capture pay a probeRide. Because memoized
 *  candidates consume no budget, rebuilds of the same gap's pool (larger nCand,
 *  lane-extra merges) advance the charge frontier cumulatively — across builds
 *  more than M candidates may end up charged. The pool's nominal size is 8, so
 *  M = 8 charges roughly one ride per surviving pool slot per build while
 *  leaving the long tail at cost order. */
const RANK_CHARGE_TOP_M = 8;

/** Per-candidate objective memo (object identity, scoped to live candidates).
 *  null = computed-and-undefined (no forward target / crashed); a number = the
 *  objective. Absent key = not yet computed. */
const objectiveCache = new WeakMap<Candidate, number | null>();

/** A candidate's rank objective: current-axis-quality × readiness × speed-fit ×
 *  impact-feasibility, or null (the next gap has no speed/impact target —
 *  mirrors the lane's enum_no_target bail; the arrival state is unavailable; or
 *  the arrival ride crashed). The arrival state is read FREE off the
 *  candidate's own measurement detection when present; otherwise, when
 *  `mayCharge`, a memoized charged probeRide to the next contact (frames
 *  metered). `mayCharge=false` and no free capture → null (bounded-charge tail).
 *  Memoized so no candidate is ridden twice. */
function candidateRankObjective(
  // deno-lint-ignore no-explicit-any
  engine: any,
  candidate: Candidate,
  gap: Gap,
  gaps: Gap[],
  mayCharge: boolean,
): number | null {
  const cached = objectiveCache.get(candidate);
  if (cached !== undefined) return cached;
  const nextGap = nextContactGap(gap, gaps);
  if (nextGap === null) return memoObjective(candidate, null);
  const speedTarget = nextGapSpeedTargetPx(gap, gaps);
  if (speedTarget === null && nextGap.targets.impact === undefined) return memoObjective(candidate, null);

  // FREE CAPTURE: arrival state already read off the candidate's measurement
  // detection at the next contact frame (no charged frames).
  let arrival: { speed: number; comAngleDeg: number | null } | null = null;
  const free = candidate.arrivalAtNextContact;
  if (free !== undefined && free.frame === nextGap.endFrame) {
    arrival = free;
    aimTotals.rank_readiness_capture_free++;
    // BUILT-IN VALIDATION (LR_RANK_PREDICT_ARRIVAL): a free capture is the exact
    // arrival; predict it TOO and record the ballistic-prediction error. Zero
    // cost, runs on every clean free capture — ground-truth accuracy of the
    // prediction that would otherwise replace the charged ride.
    if (RANK_PREDICT_ARRIVAL) {
      const pred = predictArrivalAtNextContact(candidate, nextGap.endFrame);
      if (pred === null || pred.comAngleDeg === null || free.comAngleDeg === null) {
        aimTotals.rank_quality_pred_val_bail++;
      } else {
        aimTotals.rank_quality_pred_err_speed_sum += Math.abs(pred.speed - free.speed);
        aimTotals.rank_quality_pred_err_angle_sum += Math.abs(
          smallestAngleDiffDeg(pred.comAngleDeg, free.comAngleDeg),
        );
        aimTotals.rank_quality_pred_err_n++;
      }
    }
  } else if (RANK_PREDICT_ARRIVAL && predictedArrivalApplies(candidate)) {
    // PREDICTED ARRIVAL: no free capture, rider airborne at release → propagate the
    // candidate's release state ballistically to the next contact. No charged ride,
    // no top-M bound, no skip. Prediction-impossible AFTER the airborne check
    // (missing release state, comAngle-less propagation result) → null objective, as
    // the charged path's crash did.
    //
    // HYBRID note (LR_RANK_PREDICT_ARRIVAL=hybrid): `predictedArrivalApplies` is the
    // sole gate that routes a NON-airborne-at-release candidate to the charged
    // fallback below INSTEAD of here. Under "1" that gate is always true here (the
    // predict-only path took every no-free candidate and bailed the non-airborne
    // ones to null), so =1 stays byte-identical; under "hybrid" the non-airborne
    // candidates skip this branch and fall to the `mayCharge` / skip arms.
    const pred = predictArrivalAtNextContact(candidate, nextGap.endFrame);
    if (pred === null || pred.comAngleDeg === null) {
      aimTotals.rank_quality_pred_bail++;
      return memoObjective(candidate, null);
    }
    arrival = pred;
    aimTotals.rank_quality_pred_used++;
  } else if (mayCharge) {
    // CHARGED FALLBACK (bounded, memoized, top-M). Reachable in two regimes:
    //  · LR_RANK_QUALITY=pool, predict OFF — the original quality-rank charged ride.
    //  · LR_RANK_PREDICT_ARRIVAL=hybrid — for NON-airborne-at-release candidates that
    //    ballistic prediction can't reach. DEAD under LR_RANK_PREDICT_ARRIVAL=1 (the
    //    predict branch above takes every no-free candidate when the flag is "1").
    const framesBefore = getPhysicsFrameCount();
    arrival = probeRide(engine, candidate.lines, nextGap.endFrame);
    aimTotals.rank_readiness_arrival_frames_charged += Math.max(0, getPhysicsFrameCount() - framesBefore);
    aimTotals.rank_readiness_capture_charged++;
    // Hybrid split: this charged ride is a non-airborne-at-release fallback that the
    // predict branch declined (the support-population recovery). 0 under "1"/off.
    if (RANK_PREDICT_ARRIVAL_HYBRID) aimTotals.rank_quality_hybrid_charged++;
  } else {
    // Bounded-charge tail: not eligible for a charged ride, no free capture.
    // NOT memoized — a later pool build may rank this candidate high enough to
    // afford the charge; caching the skip would freeze it at null forever.
    aimTotals.rank_readiness_capture_skipped++;
    return null;
  }
  if (arrival === null || arrival.comAngleDeg === null) return memoObjective(candidate, null);
  const currentQuality = axisQualityForTargets(gap.targets, candidate.achieved).axis_quality;
  const readiness = Math.max(ENUM_R_MIN, readinessCatchState(arrival));
  const fit = speedFitFactor(arrival.speed, speedTarget);
  const feas = impactFeasibility(arrival, nextGap);
  return memoObjective(candidate, currentQuality * readiness * fit * feas);
}

/** Whether the ballistic-prediction branch should claim a no-free-capture
 *  candidate (vs routing it to the charged fallback). Under "1" (predict-only)
 *  this is ALWAYS true: the predict branch took every no-free candidate and bailed
 *  the prediction-impossible ones to null — so returning true here for every
 *  candidate keeps =1 byte-identical. Under "hybrid" it is true only when the rider
 *  is airborne at the release frame (the lone case prediction can serve); every
 *  non-airborne-at-release candidate falls through to the bounded charged ride.
 *  (Predict still owns missing-release-state / comAngle-less bails inside the
 *  branch — those stay null in both modes, matching the old charged crash.) */
function predictedArrivalApplies(candidate: Candidate): boolean {
  if (!RANK_PREDICT_ARRIVAL_HYBRID) return true;
  return candidate.releaseArrivalState?.airborne === true;
}

/** Ballistic prediction of the rider's arrival state at `nextEndFrame`,
 *  propagating the candidate's captured release/exit state (core/candidate.ts
 *  releaseArrivalState — full position + smoothed launch velocity) with
 *  `propagateBallisticArrivalState` (arc_model.ts; the same pure-readout-gravity
 *  Verlet propagation the short probe's suffix completion uses). Returns null
 *  (caller bails to a null objective) when the release state is missing, the
 *  rider is not airborne at the release frame (not in free flight → the launch
 *  read is not a clean ballistic velocity), or the propagation horizon is
 *  non-positive. Zero charged frames. */
function predictArrivalAtNextContact(
  candidate: Candidate,
  nextEndFrame: number,
): { speed: number; comAngleDeg: number | null } | null {
  const rel = candidate.releaseArrivalState;
  if (rel === undefined) return null;
  // Ballistic validity: the rider must be in free flight at the release frame
  // (so the launch velocity is a clean free-flight read). The grounded-frame
  // count between the catch and the release is NOT a disqualifier — the catch
  // contact itself is grounded; it is the airborne-at-release flag that gates
  // free flight. A ground touch BETWEEN release and the next contact would break
  // the ballistic propagation; that error shows up in the validation stats
  // (pred_err on free captures) rather than being pre-filtered here.
  if (!rel.airborne) return null;
  const dt = nextEndFrame - rel.frame;
  if (dt <= 0) return null;
  const launch: RiderArrivalState = {
    x: rel.x,
    y: rel.y,
    vx: rel.vx,
    vy: rel.vy,
    speed: Math.hypot(rel.vx, rel.vy),
    comAngleDeg: null,
    sledPoseDeg: rel.sledPoseDeg,
    sledPoseRateDegPerFrame: rel.sledPoseRateDegPerFrame,
  };
  const arrived = propagateBallisticArrivalState(launch, dt);
  return { speed: arrived.speed, comAngleDeg: arrived.comAngleDeg };
}

/** Signed smallest difference between two CoM heading angles (deg), in
 *  (−180, 180]. comAngle is atan2-based so a raw subtraction can wrap; this
 *  gives the true angular error for the validation accumulator. */
function smallestAngleDiffDeg(a: number, b: number): number {
  let d = (a - b) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function memoObjective(candidate: Candidate, value: number | null): number | null {
  objectiveCache.set(candidate, value);
  return value;
}

/** Sort a candidate pool by the quality objective DESCENDING; ties (and
 *  undefined-objective candidates relative to each other) break by cost
 *  ascending then sample order (stable). When ANY candidate has a defined
 *  objective the gap genuinely carries a forward target, so defined-objective
 *  candidates rank ABOVE undefined ones; when none do, the whole pool falls back
 *  to the cost order. Free captures are scored for every candidate; charged
 *  rides are bounded to the top-M cost-sorted that lack one. Pool/disagreement
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
): Candidate[] {
  if (costSorted.length === 0) return costSorted;
  const objectives = new Map<Candidate, number>();
  let anyDefined = false;
  // The charge budget is spent on the lowest-cost candidates first (costSorted
  // order). Free captures and already-memoized candidates cost nothing, so they
  // never consume budget; only a fresh charged probeRide does.
  let chargeBudget = RANK_CHARGE_TOP_M;
  for (const cand of costSorted) {
    const chargedBefore = aimTotals.rank_readiness_capture_charged;
    const obj = candidateRankObjective(engine, cand, gap, gaps, chargeBudget > 0);
    if (aimTotals.rank_readiness_capture_charged > chargedBefore) chargeBudget--;
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
 *  charge-skipped candidates are absent and count as undefined). Pure reads —
 *  cannot perturb either ordering or charge frames. */
export function recordRankQualityPool(costSorted: Candidate[], ranked: Candidate[]): void {
  aimTotals.rank_readiness_pools++;
  aimTotals.rank_readiness_candidates_scored += costSorted.length;
  for (const cand of costSorted) {
    if (typeof objectiveCache.get(cand) === "number") aimTotals.rank_readiness_objective_defined++;
  }
  if (costSorted[0] !== ranked[0]) aimTotals.rank_readiness_top1_disagree++;
  const k = Math.min(3, costSorted.length);
  const costTop = new Set(costSorted.slice(0, k));
  let same = true;
  for (let i = 0; i < k; i++) {
    if (!costTop.has(ranked[i])) { same = false; break; }
  }
  if (!same) aimTotals.rank_readiness_top3_disagree++;
}
