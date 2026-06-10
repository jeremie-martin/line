/**
 * The aiming layer — probe, fit, propose (docs/ARC_STATE_CONTROL.md).
 *
 * Turns arc placement from sample-and-hope into aim: perturb a candidate
 * slightly, probe the simulated response of the rider's next-gap state, fit a
 * local model, and solve the perturbation that hits what the next gap wants.
 * The file is organized as the layers of that idea:
 *
 *   1. flags            — per-call env reads (tests pin them dynamically)
 *   2. telemetry        — lane funnels + live prediction-accuracy stats
 *   3. knob transforms  — chain-continuity-preserving line edits
 *   4. probes           — forked metered rides reading state at a frame
 *   5. local models     — exact 3-point quadratics, scan-solved
 *   6. lanes            — proposal builders emitting ≤1 extra candidate each
 *
 * Invariants (each bought with a measured failure — verdicts inline + doc):
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
 *   I4 TAIL-ONLY KNOBS. Never move the catch surface of a selected arc: ±2°
 *      of whole-arc rotation breaks the committed on-beat landing at 79% of
 *      gaps (V2 coupling law; rot-fallback verdict below).
 *   I5 NO CHARGED-ROLLOUT MULTIPLICATION. A lane must not add per-rollout
 *      eval cost (v4-01 −3.8; scoop-rollout −9.0; attempt-0 −29.5).
 *
 * Models are LOCAL — per gap, per arc, fitted from probes at compile time.
 * Local linearity is near-perfect while global curvature is real (V0).
 */

import { getRiderMetered } from "../../lib/detector.ts";
import {
  axisLookaheadEndFrame,
  releaseStateFrame,
  tryCandidateLines,
} from "../core/candidate.ts";
import { engineLineFromTrackLine } from "../core/substrate.ts";
import { authoredSpeedToPx, CALIB, type TrackLine } from "../types.ts";
import { buildArrivalScoopLines } from "../arc_placement.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./sample.ts";
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
 *  rotation is the wrong fallback knob for a committed catch; default OFF
 *  (invariant I4 exists because of this verdict). */
function aimRotFallbackEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_ROT_FALLBACK === "1";
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
};

export function resetAimStats(): void {
  for (const key of Object.keys(aimTotals) as (keyof typeof aimTotals)[]) {
    aimTotals[key] = 0;
  }
}

/** Snapshot for compile stats; null when the lane never ran (flag off /
 *  no pools) so ablation archives carry no aim key at all. */
export function snapshotAimStats(): AimStats | null {
  if (aimTotals.considered === 0) return null;
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
 *  screen +y). The safe tail-only knob (invariant I4): it never touches the
 *  catch at the arc's head — gap k's own landing frame and speed shift by
 *  exactly 0.00 under it (V1). */
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

/** Ride the perturbed candidate on a forked engine and read the rider's CoM
 *  velocity state at `frame`. Returns null when the probe ride breaks the
 *  sled / ejects the rider (don't fit through a crash) or speed is not
 *  finite; `angleDeg` (deg, +down) is null at zero speed. Frames are metered
 *  via getRiderMetered (invariant I3). */
function probeRideState(
  // deno-lint-ignore no-explicit-any
  engine: any,
  lines: TrackLine[],
  frame: number,
): { speed: number; angleDeg: number | null } | null {
  const fork = engine.addLine(lines.map((l) => engineLineFromTrackLine(l)));
  const rider = getRiderMetered(fork, frame);
  try {
    if (rider.get?.("SLED_INTACT")?.isBinded?.() === false) return null;
    if (rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false) return null;
  } catch { /* treat as intact */ }
  const v = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(v.x, v.y);
  if (!Number.isFinite(speed)) return null;
  return { speed, angleDeg: speed > 0 ? (Math.atan2(v.y, v.x) * 180) / Math.PI : null };
}

/** Speed (px/f) at the release frame riding the perturbed candidate. */
function probeReleaseSpeed(
  // deno-lint-ignore no-explicit-any
  engine: any,
  lines: TrackLine[],
  releaseFrame: number,
): number | null {
  const state = probeRideState(engine, lines, releaseFrame);
  return state === null ? null : state.speed;
}

/** CoM velocity angle (deg, +down) at `frame` riding the perturbed
 *  candidate. Used by the angle-aim mode, probed at the NEXT beat's frame
 *  (the arrival the scoop will receive). */
function probeArrivalAngle(
  // deno-lint-ignore no-explicit-any
  engine: any,
  lines: TrackLine[],
  frame: number,
): number | null {
  const state = probeRideState(engine, lines, frame);
  return state === null ? null : state.angleDeg;
}

// ────────────────────────── 5 · Local models ─────────────────────────

/** Exact quadratic through (−P, lo), (0, mid), (+P, hi). Three probes are
 *  the accuracy knee for CoM state (V0 probe-count ladder); the base
 *  candidate's own measurement is the free δ=0 point. */
function quadModel(lo: number, mid: number, hi: number, P: number): (d: number) => number {
  return (d: number): number =>
    (lo * d * (d - P)) / (2 * P * P) - (mid * (d + P) * (d - P)) / (P * P) +
    (hi * (d + P) * d) / (2 * P * P);
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
  const P = AIM_PROBE_DELTA_DEG;
  const lo = probeReleaseSpeed(engine, pitchExit(base.lines, -P), releaseFrame);
  const hi = lo === null ? null : probeReleaseSpeed(engine, pitchExit(base.lines, P), releaseFrame);
  if (lo === null || hi === null) {
    aimTotals.probe_crash++;
    return null;
  }

  const model = quadModel(lo, mid, hi, P);
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
    const R = AIM_ROT_PROBE_DEG;
    const rlo = probeReleaseSpeed(engine, rotateArc(base.lines, -R), releaseFrame);
    const rhi = rlo === null ? null : probeReleaseSpeed(engine, rotateArc(base.lines, R), releaseFrame);
    if (rlo !== null && rhi !== null) {
      const rotModel = quadModel(rlo, mid, rhi, R);
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
  const baseAngle = probeArrivalAngle(engine, base.lines, F);
  if (baseAngle === null) {
    aimTotals.probe_crash++;
    return null;
  }
  if (baseAngle >= targetDeg - 0.5) {
    aimTotals.on_target++;
    return null;
  }
  const P = AIM_PROBE_DELTA_DEG;
  const lo = probeArrivalAngle(engine, pitchExit(base.lines, -P), F);
  const hi = lo === null ? null : probeArrivalAngle(engine, pitchExit(base.lines, P), F);
  if (lo === null || hi === null) {
    aimTotals.probe_crash++;
    return null;
  }
  const model = quadModel(lo, baseAngle, hi, P);
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
  const achievedAngle = probeArrivalAngle(engine, aimedLines, F);
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
