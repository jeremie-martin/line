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
 * rather than rewrites. The file is organized as the layers of the idea:
 *
 *   1. flags            — per-call env reads (tests pin them dynamically)
 *   2. telemetry        — lane funnels + live prediction-accuracy stats
 *   3. knob transforms  — chain-continuity-preserving line edits (inputs)
 *   4. probes           — one forked metered ride = the full ProbeOutcome
 *                         vector at a frame (outputs)
 *   5. local models     — per (knob, frame, quantity) quadratic fits,
 *                         scan-solved (fitKnobQuantity)
 *   6. lanes            — proposal builders feeding the candidate pool
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
 * tail-only knob for production aiming (whole-arc rotation moves the catch
 * surface; what failed was using it as a BLIND fallback behind an
 * already-evaluated catch — verdict below); 3 probes per fit (the measured
 * accuracy knee; one ride reads ALL outputs, so probe count scales with
 * model order, never with output count); one extra candidate per lane (cost
 * control); single-target solving (the validated increment).
 */

import { getRiderMetered, sledPoseDegFromRider } from "../../lib/detector.ts";
import {
  axisLookaheadEndFrame,
  releaseStateFrame,
  tryCandidateLines,
} from "../core/candidate.ts";
import { engineLineFromTrackLine } from "../core/substrate.ts";
import { authoredSpeedToPx, CALIB, type TrackLine } from "../types.ts";
import { buildArrivalScoopLines } from "../arc_placement.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./sample.ts";
import { readinessCatch } from "./readiness.ts";
import type { Gap } from "../types.ts";

// ───────────────────────────── 1 · Flags ─────────────────────────────
// All read per call (once per pool build, cold path) so tests can pin them.

/** Speed-aimed launch lane. Default ON (V3, promoted 2026-06-10: ACCEPT
 *  Δ+6.0 vs 586.53, CI [1.4, 11.2], positive at every budget).
 *  LR_AIM_LAUNCH=0 disables (ablation). */
export function aimLaunchEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_LAUNCH !== "0";
}

/** Dive-scoop pair: angle-aim mode + scoop lane on impact-ask gaps. The two
 *  MUST ship together — a steep arrival without its matched catch is the
 *  failed arrival-unfade experiment (V2 coupling law). Default ON (V4,
 *  promoted 2026-06-10: ACCEPT Δ+5.4 vs 592.57, positive every budget,
 *  P(Δ≤0)=3.6%; impact |err| 0.1468→0.1430, other axes flat).
 *  LR_AIM_IMPACT=0 disables both halves (ablation). */
export function aimImpactEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_IMPACT !== "0";
}

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

/** Rotate-fallback knob (LR_AIM_ROT_FALLBACK=1): when the pitch solve clamps,
 *  recruit whole-arc rotation for the residual.
 *  VERDICT (2026-06-10): engaged 19k times, best speed miss (0.47) — but
 *  gate_fail 1.2%→10.9% (rotating the arc moves the CATCH surface → on-beat
 *  landing breaks, the V2 coupling law) and Δheadline −2.2. Whole-arc
 *  rotation is the wrong BLIND fallback behind an already-evaluated catch;
 *  default OFF (the tail-only current-instance choice comes from this). */
function aimRotFallbackEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_ROT_FALLBACK === "1";
}

/** R2 enumerative proposer (docs/READINESS_ROADMAP.md). Replaces the
 *  launch lane's hand-tuned triggers (V3 speed solve, V4 steep-arrival
 *  formula) with: fit BOTH next-beat arrival models (speed, CoM angle)
 *  from the same 3 probes, enumerate the whole pitch span inside the
 *  models (free), score each delta as readiness(predicted arrival) ×
 *  speed-target fit × impact-feasibility, propose the top-k through the
 *  unchanged production evaluation.
 *  Default ON (PROMOTED 2026-06-10: ACCEPT Δ+3.3 vs 597.41 → 600.71,
 *  P(Δ≤0)=7.3%, positive every budget; commits +45% vs legacy; iteration
 *  history: v1 wrong elevation test (lane never ran, −0.2), v2 catchability
 *  + speed-fit only (parity +0.3 — nothing pushed steep arrivals), v3
 *  added the closed-form impact-feasibility factor → ACCEPT; the elevation
 *  climb-defer to legacy was later removed at exact parity, Δ−0.1).
 *  LR_AIM_ENUM=0 disables (ablation → legacy V3/V4 lane; ablation flag and
 *  legacy lane are slated for deletion after the soak period). */
export function aimEnumEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_ENUM !== "0";
}

/** Scoop lane in branch=1 rollout pools (LR_AIM_SCOOP_ROLLOUT=1).
 *  VERDICT (2026-06-10): rollout visibility for the scoop was falsified
 *  three ways — fresh eval per pool rebuild (v4-01, −3.8), per-node cached
 *  eval (−9.0: rollout nodes are distinct prefixes, the cache can't help),
 *  attempt-0 replacement (−29.5: attempt 0 is the guided best sample).
 *  Default OFF; the per-node scoop cache (node.ts _scoopCache) is kept
 *  because real-pool rebuilds also reuse it. */
export function scoopRolloutEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_SCOOP_ROLLOUT === "1";
}

// ─────────────────────────── 2 · Telemetry ───────────────────────────

/** Lane telemetry (compile_stats.aim — lab-queryable via json_extract).
 *  Funnel: considered → (no_target | no_release | probe_crash | on_target) →
 *  solved → (gate_fail | emitted). Accuracy: |model-predicted − actually
 *  simulated| release speed of emitted variants, plus the target miss before
 *  (base) and after (aimed) — the lane's measured value-add per emission. */
export type AimStats = {
  considered: number;
  no_target: number;
  no_release: number;
  probe_crash: number;
  on_target: number;
  clamped: number;
  /** Clamped solves where the rotate fallback engaged (LR_AIM_ROT_FALLBACK). */
  rot_fallback: number;
  gate_fail: number;
  emitted: number;
  /** Mean |predicted(δ*) − fit.releaseSpeed| over emitted (px/f). */
  pred_abs_err_mean: number;
  /** Mean |releaseSpeed − target| before/after aiming, over emitted (px/f). */
  base_target_miss_mean: number;
  aimed_target_miss_mean: number;
  /** V4 angle-aim mode (LR_AIM_IMPACT): counts + accuracy in DEGREES. */
  angle_aims: number;
  angle_pred_abs_err_mean: number;
  angle_base_miss_mean: number;
  angle_aimed_miss_mean: number;
  /** V4 scoop lane funnel. */
  scoop_considered: number;
  scoop_shallow: number;
  scoop_no_geometry: number;
  scoop_gate_fail: number;
  scoop_emitted: number;
  /** Selection-rank telemetry: where a lane extra landed in the cost-sorted
   *  pool it was emitted into (rank 0 = pool best), recorded once per pool
   *  BUILD (node.ts sortWithLaneExtras). Counts/sums only — the lab derives
   *  means. The instrument for "are aimed/scoop candidates winning selection
   *  → should budget shift from sampling toward aiming?";
   *  handoff_aimed_selected/_scoop_selected remain the commit-level answer. */
  aimed_pool_entries: number;
  aimed_rank0: number;
  aimed_top3: number;
  aimed_rank_sum: number;
  aimed_pool_size_sum: number;
  scoop_pool_entries: number;
  scoop_rank0: number;
  scoop_top3: number;
  scoop_rank_sum: number;
  scoop_pool_size_sum: number;
  /** R2 enumerative-proposer funnel + readiness accuracy (LR_AIM_ENUM).
   *  Optional: present only when the lane ran, so legacy-mode snapshots
   *  stay byte-identical. */
  enum_considered?: number;
  enum_no_target?: number;
  enum_probe_crash?: number;
  enum_on_target?: number;
  enum_gate_fail?: number;
  enum_emitted?: number;
  /** Mean |predicted − achieved| arrival readiness over emitted. */
  enum_readiness_err_mean?: number;
  /** Mean predicted readiness gain over δ=0, over emitted. */
  enum_readiness_gain_mean?: number;
  /** R3 joint-model split: rotate recruit rate, rotate-probe failures
   *  (lane falls back to pitch-only), and how rotated (dr≠0) proposals
   *  fare at the production gates vs emitted. */
  enum_rot_probe_crash?: number;
  enum_rot_recruited?: number;
  enum_rot_emitted?: number;
  enum_rot_gate_fail?: number;
};

const aimTotals = {
  considered: 0, no_target: 0, no_release: 0, probe_crash: 0,
  on_target: 0, clamped: 0, rot_fallback: 0, gate_fail: 0, emitted: 0,
  predAbsErrSum: 0, baseMissSum: 0, aimedMissSum: 0,
  // V4 angle-aim mode (deg units) + scoop lane funnel.
  angle_aims: 0,
  anglePredErrSum: 0, angleBaseMissSum: 0, angleAimedMissSum: 0, angleEmitted: 0,
  scoop_considered: 0, scoop_shallow: 0, scoop_no_geometry: 0,
  scoop_gate_fail: 0, scoop_emitted: 0,
  // Selection-rank telemetry (recordLanePoolRank).
  aimed_pool_entries: 0, aimed_rank0: 0, aimed_top3: 0,
  aimed_rank_sum: 0, aimed_pool_size_sum: 0,
  scoop_pool_entries: 0, scoop_rank0: 0, scoop_top3: 0,
  scoop_rank_sum: 0, scoop_pool_size_sum: 0,
  // R2 enumerative-proposer funnel (LR_AIM_ENUM).
  enum_considered: 0, enum_no_target: 0,
  enum_probe_crash: 0, enum_on_target: 0, enum_gate_fail: 0, enum_emitted: 0,
  enumReadinessErrSum: 0, enumReadinessGainSum: 0, enumAchieved: 0,
  enum_rot_probe_crash: 0, enum_rot_recruited: 0, enum_rot_emitted: 0,
  enum_rot_gate_fail: 0,
};

/** Record where a lane extra ranked in the cost-sorted pool it entered, and
 *  that pool's size. Called by node.ts once per pool build (cache hits do
 *  not re-record; one lane candidate can therefore be ranked in several
 *  rebuilt pools — same semantics as the funnel counters). */
export function recordLanePoolRank(
  kind: "aimed" | "scoop",
  rank: number,
  poolSize: number,
): void {
  if (kind === "aimed") {
    aimTotals.aimed_pool_entries++;
    if (rank === 0) aimTotals.aimed_rank0++;
    if (rank < 3) aimTotals.aimed_top3++;
    aimTotals.aimed_rank_sum += rank;
    aimTotals.aimed_pool_size_sum += poolSize;
  } else {
    aimTotals.scoop_pool_entries++;
    if (rank === 0) aimTotals.scoop_rank0++;
    if (rank < 3) aimTotals.scoop_top3++;
    aimTotals.scoop_rank_sum += rank;
    aimTotals.scoop_pool_size_sum += poolSize;
  }
}

export function resetAimStats(): void {
  for (const key of Object.keys(aimTotals) as (keyof typeof aimTotals)[]) {
    aimTotals[key] = 0;
  }
}

/** Snapshot for compile stats; null when the lane never ran (flag off /
 *  no pools) so ablation archives carry no aim key at all. */
export function snapshotAimStats(): AimStats | null {
  // Null only when NO lane ran at all. Gating on the legacy counter alone
  // (the original quirk) silently dropped the whole aim block — incl. the
  // enum funnel and the pool-rank instrument — from any compile where the
  // legacy lane never fired (most of them once enum was promoted, ALL of
  // them once the climb-defer was removed).
  if (
    aimTotals.considered === 0 && aimTotals.scoop_considered === 0 &&
    aimTotals.enum_considered === 0
  ) return null;
  const round3 = (x: number): number => Math.round(x * 1000) / 1000;
  const per = (sum: number): number => (aimTotals.emitted > 0 ? round3(sum / aimTotals.emitted) : 0);
  return {
    considered: aimTotals.considered,
    no_target: aimTotals.no_target,
    no_release: aimTotals.no_release,
    probe_crash: aimTotals.probe_crash,
    on_target: aimTotals.on_target,
    clamped: aimTotals.clamped,
    rot_fallback: aimTotals.rot_fallback,
    gate_fail: aimTotals.gate_fail,
    emitted: aimTotals.emitted,
    pred_abs_err_mean: per(aimTotals.predAbsErrSum),
    base_target_miss_mean: per(aimTotals.baseMissSum),
    aimed_target_miss_mean: per(aimTotals.aimedMissSum),
    angle_aims: aimTotals.angle_aims,
    angle_pred_abs_err_mean: aimTotals.angleEmitted > 0
      ? round3(aimTotals.anglePredErrSum / aimTotals.angleEmitted) : 0,
    angle_base_miss_mean: aimTotals.angleEmitted > 0
      ? round3(aimTotals.angleBaseMissSum / aimTotals.angleEmitted) : 0,
    angle_aimed_miss_mean: aimTotals.angleEmitted > 0
      ? round3(aimTotals.angleAimedMissSum / aimTotals.angleEmitted) : 0,
    scoop_considered: aimTotals.scoop_considered,
    scoop_shallow: aimTotals.scoop_shallow,
    scoop_no_geometry: aimTotals.scoop_no_geometry,
    scoop_gate_fail: aimTotals.scoop_gate_fail,
    scoop_emitted: aimTotals.scoop_emitted,
    aimed_pool_entries: aimTotals.aimed_pool_entries,
    aimed_rank0: aimTotals.aimed_rank0,
    aimed_top3: aimTotals.aimed_top3,
    aimed_rank_sum: aimTotals.aimed_rank_sum,
    aimed_pool_size_sum: aimTotals.aimed_pool_size_sum,
    scoop_pool_entries: aimTotals.scoop_pool_entries,
    scoop_rank0: aimTotals.scoop_rank0,
    scoop_top3: aimTotals.scoop_top3,
    scoop_rank_sum: aimTotals.scoop_rank_sum,
    scoop_pool_size_sum: aimTotals.scoop_pool_size_sum,
    ...(aimTotals.enum_considered > 0
      ? {
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
      }
      : {}),
  };
}

// ──────────────────────── 3 · Knob transforms ────────────────────────

/** Probe offsets for the quadratic fit (deg); the base candidate is δ=0. */
const AIM_PROBE_DELTA_DEG = 6;
/** Below this |δ*| the aimed variant would duplicate the base candidate. */
const AIM_MIN_DELTA_DEG = 0.25;
/** Rotate-fallback probe/solve spans (deg, V0-validated range). */
const AIM_ROT_PROBE_DEG = 3;
const AIM_ROT_MAX_DEG = 4;

/** Rotate the last ~third of the candidate's segments about that suffix's
 *  first point (chain-continuity preserving; positive = exit pitched down,
 *  screen +y). The safe tail-only knob (current-instance choice): it never
 *  touches the catch at the arc's head — gap k's own landing frame and speed
 *  shift by exactly 0.00 under it (V1). */
function pitchExit(lines: TrackLine[], deg: number): TrackLine[] {
  const m = Math.max(1, Math.ceil(lines.length / 3));
  const head = lines.slice(0, lines.length - m);
  const tail = lines.slice(lines.length - m);
  const pivot = { x: tail[0].x1, y: tail[0].y1 };
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [
    ...head,
    ...tail.map((l) => {
      const dx1 = l.x1 - pivot.x;
      const dy1 = l.y1 - pivot.y;
      const dx2 = l.x2 - pivot.x;
      const dy2 = l.y2 - pivot.y;
      return {
        ...l,
        x1: pivot.x + dx1 * c - dy1 * s,
        y1: pivot.y + dx1 * s + dy1 * c,
        x2: pivot.x + dx2 * c - dy2 * s,
        y2: pivot.y + dx2 * s + dy2 * c,
      };
    }),
  ];
}

/** Rotate the whole candidate about its entry point (the catch head). Unlike
 *  pitchExit this DOES move the late surface the rider lands on, so it can
 *  shift the landing frame — kept only for the parked rotate fallback. */
function rotateArc(lines: TrackLine[], deg: number): TrackLine[] {
  const pivot = { x: lines[0].x1, y: lines[0].y1 };
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return lines.map((l) => {
    const dx1 = l.x1 - pivot.x;
    const dy1 = l.y1 - pivot.y;
    const dx2 = l.x2 - pivot.x;
    const dy2 = l.y2 - pivot.y;
    return {
      ...l,
      x1: pivot.x + dx1 * c - dy1 * s,
      y1: pivot.y + dx1 * s + dy1 * c,
      x2: pivot.x + dx2 * c - dy2 * s,
      y2: pivot.y + dx2 * s + dy2 * c,
    };
  });
}

// ───────────────────────────── 4 · Probes ────────────────────────────

/** The output vector of one probe ride: the full rider state readable at one
 *  frame. One ride yields ALL quantities at once — probe count scales with
 *  model order per knob, never with the number of predicted outputs. Future
 *  quantities (e.g. measured axis values via a full candidate evaluation per
 *  probe — expensive, see V2 study) extend this type; consumers fit per
 *  quantity via `fitKnobQuantity` unchanged. */
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

/** A controllable arc modification: chain-continuity-preserving line edit,
 *  parameterized by one scalar (deg). Current knobs: pitchExit, rotateArc. */
type KnobTransform = (lines: TrackLine[], deg: number) => TrackLine[];

/** Exact quadratic through (−P, lo), (0, mid), (+P, hi). Three points are
 *  the measured accuracy knee for CoM state (V0 probe-count ladder) — an
 *  empirical setting, not a rule; the base candidate's own measurement is
 *  the free δ=0 point where one exists. */
function quadModel(lo: number, mid: number, hi: number, P: number): (d: number) => number {
  return (d: number): number =>
    (lo * d * (d - P)) / (2 * P * P) - (mid * (d + P) * (d - P)) / (P * P) +
    (hi * (d + P) * d) / (2 * P * P);
}

/** Fit one scalar quantity along one knob at one frame — the honest unit of
 *  the local model is per (knob, frame, quantity): outputs live at different
 *  frames (release vs next beat) and δ=0 sources differ per lane, so there
 *  is deliberately no vector-valued predict(δ). Probes δ=−P then δ=+P; the
 *  +P probe is SKIPPED when −P fails (crash or unreadable quantity), which
 *  preserves the metered-frame schedule exactly. `mid` is the caller's δ=0
 *  value (the speed lane's is the candidate's own free releaseSpeed; the
 *  angle lane probes it). `lo`/`hi` carry full outcomes, so a second
 *  quantity along the same knob/frame fits with ZERO extra probes. */
function fitKnobQuantity(
  // deno-lint-ignore no-explicit-any
  engine: any,
  lines: TrackLine[],
  knob: KnobTransform,
  frame: number,
  P: number,
  quantity: (o: ProbeOutcome) => number | null,
  mid: number,
): { model: (d: number) => number; lo: ProbeOutcome; hi: ProbeOutcome } | null {
  const lo = probeRide(engine, knob(lines, -P), frame);
  const loQ = lo === null ? null : quantity(lo);
  if (loQ === null) return null;
  const hi = probeRide(engine, knob(lines, P), frame);
  const hiQ = hi === null ? null : quantity(hi);
  if (hiQ === null) return null;
  return { model: quadModel(loQ, mid, hiQ, P), lo, hi };
}

/** Scan-solve model(δ)=target over ±deltaMax; returns the argmin (clamps at
 *  the span edges, so unreachable targets and mild curvature are handled
 *  uniformly). 0.1° steps ≈ 0.01 px/f / 0.1° resolution — below the model's
 *  own error. `startErr` is the do-nothing miss: a solve only wins if it
 *  beats δ=0. */
function solveDelta(
  model: (d: number) => number,
  target: number,
  startErr: number,
  deltaMax: number,
): number {
  let best = 0;
  let bestErr = startErr;
  for (let d = -deltaMax; d <= deltaMax + 1e-9; d += 0.1) {
    const err = Math.abs(model(d) - target);
    if (err < bestErr - 1e-12) {
      bestErr = err;
      best = d;
    }
  }
  return best;
}

// ───────────────────────────── 6 · Lanes ─────────────────────────────

/** Impact ask below which the dive-scoop machinery stays out of the way. */
const AIM_IMPACT_MIN_ASK = 0.3;
/** Arrival steepness the scoop needs (deg; a dive is actually happening). */
const AIM_IMPACT_MIN_ARRIVAL_DEG = 12;
/** Angle-aim target clamp (deg) + relief above the scoop's entry. */
const AIM_ANGLE_TARGET_MIN_DEG = 12;
const AIM_ANGLE_TARGET_MAX_DEG = 28;
const AIM_ANGLE_RELIEF_DEG = 4; // scoop entry relief — aim the arrival above it

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

/** Speed-aimed launch (V3, default on): aim the pool's lowest-cost candidate
 *  at the NEXT gap's speed target. Probe two exit-pitch perturbations (±6°),
 *  fit the quadratic (the base's own releaseSpeed is the free δ=0 point),
 *  solve the pitch, and emit ONE aimed variant through the unchanged
 *  production evaluation path. Returns null when: no next speed target, the
 *  base has no releaseSpeed, a probe crashes, the base is already on target,
 *  or the aimed lines fail the production gates.
 *
 *  When the NEXT beat asks for impact (and LR_AIM_IMPACT is on), the lane
 *  switches target: the launch's job is then a STEEP arrival — the scoop
 *  lane's precondition — not a matched speed (V4 angle-aim mode). */
export function makeAimedCandidate(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  gaps: Gap[],
  ctx: SpecContext,
  base: Candidate,
  lineIdStart: number,
): Candidate | null {
  aimTotals.considered++;
  if (aimImpactEnabled()) {
    const nextGap = nextContactGap(gap, gaps);
    const ask = nextGap?.targets.impact;
    if (nextGap !== null && ask !== undefined && ask >= AIM_IMPACT_MIN_ASK) {
      return makeAngleAimedCandidate(engine, gap, nextGap, ask, ctx, base, lineIdStart);
    }
  }
  const mid = base.releaseSpeed;
  if (mid === undefined) {
    aimTotals.no_release++;
    return null;
  }
  const targetPx = nextGapSpeedTargetPx(gap, gaps);
  if (targetPx === null) {
    aimTotals.no_target++;
    return null;
  }

  const releaseFrame = releaseStateFrame(gap, ctx.allContactFrames);
  const speedFit = fitKnobQuantity(
    engine, base.lines, pitchExit, releaseFrame, AIM_PROBE_DELTA_DEG, (o) => o.speed, mid,
  );
  if (speedFit === null) {
    aimTotals.probe_crash++;
    return null;
  }

  const model = speedFit.model;
  const deltaMax = aimDeltaMaxDeg();
  const bestDelta = solveDelta(model, targetPx, Math.abs(mid - targetPx), deltaMax);
  if (Math.abs(bestDelta) < AIM_MIN_DELTA_DEG) {
    aimTotals.on_target++;
    return null;
  }
  const clamped = Math.abs(bestDelta) > deltaMax - 0.11;
  if (clamped) aimTotals.clamped++;

  // Rotate fallback (parked, LR_AIM_ROT_FALLBACK): pitch ran out of throw —
  // solve the residual with the whole-arc rotation knob, composed additively
  // (the production evaluation below re-gates the joint geometry, catching
  // the additivity tail).
  let rotDelta = 0;
  let predicted = model(bestDelta);
  if (clamped && aimRotFallbackEnabled()) {
    // A crashed rot probe silently skips the fallback (no probe_crash count —
    // the pitch solve above still emits).
    const rotFit = fitKnobQuantity(
      engine, base.lines, rotateArc, releaseFrame, AIM_ROT_PROBE_DEG, (o) => o.speed, mid,
    );
    if (rotFit !== null) {
      const rotModel = rotFit.model;
      const residTarget = targetPx - predicted;
      const bestRot = solveDelta(rotModel, mid + residTarget, Math.abs(residTarget), AIM_ROT_MAX_DEG);
      if (Math.abs(bestRot) >= AIM_MIN_DELTA_DEG) {
        rotDelta = bestRot;
        predicted += rotModel(bestRot) - mid;
        aimTotals.rot_fallback++;
      }
    }
  }

  const aimedLines = pitchExit(rotDelta !== 0 ? rotateArc(base.lines, rotDelta) : base.lines, bestDelta)
    .map((l, i) => ({ ...l, id: lineIdStart + i }));
  const probe = getCandidateProbe(engine, gap, ctx);
  const fit = tryCandidateLines(
    engine, gap, aimedLines, lineIdStart, ctx.allContactFrames,
    axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
    "normal", probe.preTargetSledTrace,
  ) as Candidate | null;
  if (fit === null) {
    aimTotals.gate_fail++;
    return null;
  }
  aimTotals.emitted++;
  if (fit.releaseSpeed !== undefined) {
    aimTotals.predAbsErrSum += Math.abs(predicted - fit.releaseSpeed);
    aimTotals.baseMissSum += Math.abs(mid - targetPx);
    aimTotals.aimedMissSum += Math.abs(fit.releaseSpeed - targetPx);
  }
  fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
  fit.aimed = true;
  // Deliberately NO sampleAttempt (invariant I2): the aimed candidate is not
  // part of the deterministic attempt prefix (samplePrefix must exclude it
  // when a smaller nCand re-reads the cache — the smaller pool's best may
  // differ).
  return fit;
}

/** Angle-aim mode (V4 half 1): solve exit pitch for a steep CoM arrival
 *  angle at the next beat's frame, sized from the impact ask:
 *  needed turn = asin(ask·REDIR_CAP/speed), aimed above the scoop's entry
 *  relief. Probes at the NEXT beat (the arrival the scoop receives). */
function makeAngleAimedCandidate(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  nextGap: Gap,
  ask: number,
  ctx: SpecContext,
  base: Candidate,
  lineIdStart: number,
): Candidate | null {
  const speedRef = Math.max(1, base.releaseSpeed ?? 10);
  const needTurnDeg =
    (Math.asin(Math.min(0.95, (ask * CALIB.REDIR_CAP) / speedRef)) * 180) / Math.PI;
  const targetDeg = Math.min(
    AIM_ANGLE_TARGET_MAX_DEG,
    Math.max(AIM_ANGLE_TARGET_MIN_DEG, needTurnDeg + AIM_ANGLE_RELIEF_DEG),
  );
  const F = nextGap.endFrame;
  // Crash and zero-speed both read as null (can't aim a direction without one).
  const baseAngle = probeRide(engine, base.lines, F)?.comAngleDeg ?? null;
  if (baseAngle === null) {
    aimTotals.probe_crash++;
    return null;
  }
  if (baseAngle >= targetDeg - 0.5) {
    aimTotals.on_target++;
    return null;
  }
  const angleFit = fitKnobQuantity(
    engine, base.lines, pitchExit, F, AIM_PROBE_DELTA_DEG, (o) => o.comAngleDeg, baseAngle,
  );
  if (angleFit === null) {
    aimTotals.probe_crash++;
    return null;
  }
  const model = angleFit.model;
  const deltaMax = aimDeltaMaxDeg();
  const bestDelta = solveDelta(model, targetDeg, Math.abs(baseAngle - targetDeg), deltaMax);
  if (Math.abs(bestDelta) < AIM_MIN_DELTA_DEG) {
    aimTotals.on_target++;
    return null;
  }
  if (Math.abs(bestDelta) > deltaMax - 0.11) aimTotals.clamped++;
  aimTotals.angle_aims++;

  const aimedLines = pitchExit(base.lines, bestDelta)
    .map((l, i) => ({ ...l, id: lineIdStart + i }));
  const probe = getCandidateProbe(engine, gap, ctx);
  const fit = tryCandidateLines(
    engine, gap, aimedLines, lineIdStart, ctx.allContactFrames,
    axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
    "normal", probe.preTargetSledTrace,
  ) as Candidate | null;
  if (fit === null) {
    aimTotals.gate_fail++;
    return null;
  }
  aimTotals.emitted++;
  const achievedAngle = probeRide(engine, aimedLines, F)?.comAngleDeg ?? null;
  if (achievedAngle !== null) {
    aimTotals.angleEmitted++;
    aimTotals.anglePredErrSum += Math.abs(model(bestDelta) - achievedAngle);
    aimTotals.angleBaseMissSum += Math.abs(baseAngle - targetDeg);
    aimTotals.angleAimedMissSum += Math.abs(achievedAngle - targetDeg);
  }
  fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
  fit.aimed = true;
  return fit;
}

/** Scoop lane (V4 half 2): a deterministic catch built from the ACTUAL
 *  arrival vector (buildArrivalScoopLines). Cheap — no model probes, the
 *  arrival comes from the cached gap probe; one production evaluation per
 *  node, memoized in node.ts (_scoopCache). This is what turned the steep
 *  arrival from "exploited where it happens" into a converting pair. */
export function makeScoopCandidate(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  ctx: SpecContext,
  lineIdStart: number,
): Candidate | null {
  if (!aimImpactEnabled()) return null;
  if ((gap.targets.impact ?? 0) < AIM_IMPACT_MIN_ASK) return null;
  aimTotals.scoop_considered++;
  const probe = getCandidateProbe(engine, gap, ctx);
  if (probe.targetState.angleDeg < AIM_IMPACT_MIN_ARRIVAL_DEG) {
    aimTotals.scoop_shallow++;
    return null;
  }
  const nextContact = ctx.allContactFrames.find((f) => f > gap.endFrame);
  const lines = buildArrivalScoopLines(
    lineIdStart,
    probe.targetState,
    nextContact === undefined ? null : nextContact - gap.endFrame,
  );
  if (lines === null) {
    aimTotals.scoop_no_geometry++;
    return null;
  }
  const fit = tryCandidateLines(
    engine, gap, lines, lineIdStart, ctx.allContactFrames,
    axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
    "normal", probe.preTargetSledTrace,
  ) as Candidate | null;
  if (fit === null) {
    aimTotals.scoop_gate_fail++;
    return null;
  }
  aimTotals.scoop_emitted++;
  fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
  fit.aimed = true;
  fit.scooped = true;
  return fit;
}

// ──────────────── R2 · Enumerative proposer (LR_AIM_ENUM) ────────────────

/** Proposals per pool (the "1000 variations" live inside the model; only
 *  the top-k are simulated). k=2 is the measured knee (2026-06-10 sweep vs
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
/** Joint-model rotate axis (R3, default-on — PROMOTED 2026-06-10: v2
 *  Δ+0.4 vs 600.57, positive at mature budgets, and it IS the agreed
 *  architecture: the inner model takes multiple knobs. Grounds:
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

/** R2 enumerative proposer: one knob (exit pitch — the validated tail-only
 *  family), two fitted models (arrival speed + CoM angle at the NEXT beat,
 *  from the same 3 probes), one objective:
 *
 *    objective(δ) = clamp(readiness(speed(δ), angle(δ)), R_MIN, 1)
 *                 × exp(−|speed(δ) − nextSpeedTarget| / scale)
 *
 *  enumerated over the whole solve span (free — model evaluations), top-k
 *  improving deltas proposed through the unchanged production evaluation.
 *  The hand-tuned V3/V4 launch triggers (speed solve; steep-arrival target
 *  formula) dissolve into the readiness surface's own gradient — the
 *  subsumption claim this lane exists to test (ablation matrix vs
 *  LR_AIM_LAUNCH). The scoop lane is orthogonal and unaffected.
 *
 *  The R1 caveat (catchability mis-scores the upward arrivals climbing
 *  wants) needed NO special handling in the end: an elevation climb-defer
 *  to the legacy lane was removed at exact parity — the speed-fit and
 *  impact-feasibility factors already cover demanding climbs. */
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

  // R3 joint inner model: the rotate knob's models are recruited LAZILY
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
    const r = Math.max(ENUM_R_MIN, readinessCatch(s, a));
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
        Math.max(ENUM_R_MIN, readinessCatch(predSpeed(dp, dr), predAngle(dp, dr))) -
          Math.max(ENUM_R_MIN, readinessCatch(achieved.speed, achieved.comAngleDeg)),
      );
    }
    fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    fit.aimed = true;
    out.push(fit);
  }
  return out;
}
