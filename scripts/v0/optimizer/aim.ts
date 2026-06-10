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
 * knob deltas → per-knob quadratic arrival models (additively composed) →
 * readiness × target-fit objective swept in-model → top-k proposals through
 * exact production evaluation. This file implements the current special
 * case: k=2, per-knob quadratic fits, and lazy additive rotation. Its
 * hand-tuned predecessors (V3 speed-aim, V4 angle-aim +
 * arrival-conditioned scoop, rotate fallback, climb defer) were each
 * subsumed and deleted once their ablation priced at ~zero.
 * The file is organized as the layers of the idea:
 *
 *   1. flags            — per-call env reads (tests pin them dynamically)
 *   2. telemetry        — proposer funnel + live prediction-accuracy stats
 *   3. knob transforms  — chain-continuity-preserving line edits (inputs)
 *   4. probes           — one forked metered ride = the full ProbeOutcome
 *                         vector at a frame (outputs)
 *   5. local models     — per (knob, frame, quantity) quadratic fits
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
 * two knobs (exit pitch everywhere + whole-arc rotation recruited lazily at
 * pitch exhaustion — rotation moves the catch surface, so it pays a gate
 * risk and must clear a margin); 3 probes per knob fit (the measured
 * accuracy knee; one ride reads ALL outputs, so probe count scales with
 * model order, never with output count); additive per-knob composition
 * (the current instance of the joint model interface; certified ~10%
 * median interaction); top-k proposals with current k=2 (the measured
 * knee); readiness over (speed, comAngle) only (pose parked by R0).
 */

import { getRiderMetered, sledPoseDegFromRider } from "../../lib/detector.ts";
import { axisLookaheadEndFrame, tryCandidateLines } from "../core/candidate.ts";
import { engineLineFromTrackLine } from "../core/substrate.ts";
import { authoredSpeedToPx, CALIB, type TrackLine } from "../types.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./sample.ts";
import { pitchExitLines, rotateArcLines } from "./arc_model.ts";
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
  enum_on_target: number;
  enum_gate_fail: number;
  enum_emitted: number;
  /** Mean |predicted − achieved| arrival readiness over emitted. */
  enum_readiness_err_mean: number;
  /** Mean predicted readiness gain over δ=0, over emitted. */
  enum_readiness_gain_mean: number;
  /** Lazy additive rotate-knob split: rotate recruit rate, rotate-probe failures
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
};

const aimTotals = {
  enum_considered: 0, enum_no_target: 0,
  enum_probe_crash: 0, enum_on_target: 0, enum_gate_fail: 0, enum_emitted: 0,
  enumReadinessErrSum: 0, enumReadinessGainSum: 0, enumAchieved: 0,
  enum_rot_probe_crash: 0, enum_rot_recruited: 0, enum_rot_emitted: 0,
  enum_rot_gate_fail: 0,
  // Selection-rank telemetry (recordLanePoolRank).
  aimed_pool_entries: 0, aimed_rank0: 0, aimed_top3: 0,
  aimed_rank_sum: 0, aimed_pool_size_sum: 0,
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
  };
}

// ──────────────────────── 3 · Knob transforms ────────────────────────

/** Probe offsets for the quadratic fit (deg); the base candidate is δ=0. */
const AIM_PROBE_DELTA_DEG = 6;
/** Below this |δ*| the aimed variant would duplicate the base candidate. */
const AIM_MIN_DELTA_DEG = 0.25;
/** Lazy whole-arc-rotation probe span (deg, V0-validated range). */
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
/** Joint multi-knob axis, current lazy-additive implementation (R3,
 *  default-on — PROMOTED 2026-06-10: v2
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

/** The enumerative proposer. Per-knob arrival models (speed + CoM angle at
 *  the NEXT beat) fitted from shared probe rides, additively composed; one
 *  objective over the knob space:
 *
 *    objective(δp, δr) = clamp(readiness(speed, angle), R_MIN, 1)
 *                      × exp(−|speed − nextSpeedTarget| / scale)
 *                      × impact-feasibility(speed, angle)
 *
 *  enumerated inside the models (free), top-k improving deltas proposed
 *  through the unchanged production evaluation (current k=2). Exit pitch
 *  sweeps everywhere; whole-arc rotation is recruited lazily at pitch
 *  exhaustion (see ENUM_ROT_* notes).
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

  // R3 additive two-knob inner model: the rotate knob's models are recruited LAZILY
  // further down, only where the pitch sweep is exhausted. The joint
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
