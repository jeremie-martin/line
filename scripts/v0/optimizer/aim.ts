/**
 * V3 aimed-attempt lane (docs/ARC_STATE_CONTROL.md) — LR_AIM_LAUNCH=1,
 * default OFF (byte-identical off: no RNG draws, no probes, no pool change).
 *
 * Closes the loop on the energy launch shaper: instead of only PENALIZING a
 * mismatched release speed (releaseSpeedPenalty), aim it. For the lowest-cost
 * candidate of a gap's pool, probe two exit-pitch perturbations (±6°), fit a
 * quadratic on release speed (the candidate's own releaseSpeed is the free
 * δ=0 point), solve the pitch that hits the NEXT gap's speed target, and emit
 * ONE aimed variant through the unchanged production evaluation path
 * (tryCandidateLines: survival / landing ±1f / off-beat / measure / cost).
 *
 * The aimer is a PROPOSER, never a judge: the aimed candidate competes in the
 * pool on cost and forward-eval like any other. Probes are metered engine
 * frames (honest budget). Validated basis: arc→next-state map is locally
 * smooth and 3-probe aimable (V0/V1 studies, 0.01–0.08 px/f speed error,
 * ~100% gate compliance, zero side-effects on the gap's own catch — exit
 * pitch rotates the arc tail, the catch is at its head).
 */

import { getRiderMetered } from "../../lib/detector.ts";
import {
  axisLookaheadEndFrame,
  releaseStateFrame,
  tryCandidateLines,
} from "../core/candidate.ts";
import { engineLineFromTrackLine } from "../core/substrate.ts";
import { authoredSpeedToPx, type TrackLine } from "../types.ts";
import { getCandidateProbe, type Candidate, type SpecContext } from "./sample.ts";
import type { Gap } from "../types.ts";

/** Default ON (promoted 2026-06-10: ACCEPT Δ+6.0 vs 586.53, CI [1.4, 11.2],
 *  positive at every budget). LR_AIM_LAUNCH=0 disables (ablation). Read per
 *  call (once per pool build, cold path) so tests can pin it dynamically. */
export function aimLaunchEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_LAUNCH !== "0";
}

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
};

const aimTotals = {
  considered: 0, no_target: 0, no_release: 0, probe_crash: 0,
  on_target: 0, clamped: 0, rot_fallback: 0, gate_fail: 0, emitted: 0,
  predAbsErrSum: 0, baseMissSum: 0, aimedMissSum: 0,
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
  };
}

/** Probe offsets for the quadratic fit (deg); the base candidate is δ=0. */
const AIM_PROBE_DELTA_DEG = 6;
/** Solve range (deg). ±10 is the span validated by the sensitivity studies;
 *  LR_AIM_SPAN widens it (authority experiment — the quadratic extrapolates
 *  beyond the ±6 probe span, the verification eval prices the model error).
 *  VERDICT (2026-06-10, span=14 vs default): clamp 27%→17%, miss 0.57→0.54,
 *  Δheadline +0.3 INCONCLUSIVE — extra speed authority converts to ~no score.
 *  Speed-aiming is saturated at the default span; don't widen without a new
 *  target (angle/impact). */
function aimDeltaMaxDeg(): number {
  const raw = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_SPAN;
  const n = raw === undefined || raw === "" ? NaN : Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 10;
}
/** Below this |δ*| the aimed variant would duplicate the base candidate. */
const AIM_MIN_DELTA_DEG = 0.25;
/** Rotate-fallback knob (LR_AIM_ROT_FALLBACK=1, authority experiment): when
 *  the pitch solve clamps, recruit whole-arc rotation for the residual.
 *  Probe span ±ROT_PROBE, solve span ±ROT_MAX (V0-validated range). Effects
 *  compose additively at the median (study_knob_additivity); the tail is
 *  caught by the mandatory production evaluation.
 *  VERDICT (2026-06-10): engaged 19k times, best speed miss (0.47) — but
 *  gate_fail 1.2%→10.9% (rotating the arc moves the CATCH surface → on-beat
 *  landing breaks, the V2 coupling law) and Δheadline −2.2. Whole-arc
 *  rotation is the wrong fallback knob for a committed catch; default OFF. */
const AIM_ROT_PROBE_DEG = 3;
const AIM_ROT_MAX_DEG = 4;
function aimRotFallbackEnabled(): boolean {
  return (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_AIM_ROT_FALLBACK === "1";
}

/** Rotate the last ~third of the candidate's segments about that suffix's
 *  first point (chain-continuity preserving; positive = exit pitched down,
 *  screen +y). Same knob the V0/V1/V2 studies validated. */
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
 *  shift the landing frame — the production evaluation re-gates it. */
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

/** Speed (px/f) at the release frame riding the perturbed candidate, or null
 *  when the probe ride breaks the sled / ejects the rider (don't fit through
 *  a crash). Forked engine; frames metered via getRiderMetered. */
function probeReleaseSpeed(
  // deno-lint-ignore no-explicit-any
  engine: any,
  lines: TrackLine[],
  releaseFrame: number,
): number | null {
  const fork = engine.addLine(lines.map((l) => engineLineFromTrackLine(l)));
  const rider = getRiderMetered(fork, releaseFrame);
  try {
    if (rider.get?.("SLED_INTACT")?.isBinded?.() === false) return null;
    if (rider.get?.("RIDER_MOUNTED")?.isBinded?.() === false) return null;
  } catch { /* treat as intact */ }
  const v = rider.velocity ?? { x: 0, y: 0 };
  const speed = Math.hypot(v.x, v.y);
  return Number.isFinite(speed) ? speed : null;
}

/** The speed target the launch should serve: the NEXT contact gap's authored
 *  speed target (the arrival this launch conditions), in px/f. */
function nextGapSpeedTargetPx(gap: Gap, gaps: Gap[]): number | null {
  for (let i = gap.index + 1; i < gaps.length; i++) {
    const g = gaps[i];
    if (!g.endsWithContact) continue;
    return g.targets.speed === undefined ? null : authoredSpeedToPx(g.targets.speed);
  }
  return null;
}

/** Build the aimed variant of `base`, or null when: no next speed target, the
 *  base has no releaseSpeed, a probe crashes, the base is already on target,
 *  or the aimed lines fail the production gates. */
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

  // Quadratic through (−P, lo), (0, mid), (+P, hi); solve δ* by scan so the
  // mild curvature and unreachable targets (clamp to span edge) are handled
  // uniformly. 0.1° steps ≈ 0.01 px/f resolution — below the model's error.
  const model = (d: number): number =>
    (lo * d * (d - P)) / (2 * P * P) - (mid * (d + P) * (d - P)) / (P * P) +
    (hi * (d + P) * d) / (2 * P * P);
  const deltaMax = aimDeltaMaxDeg();
  let bestDelta = 0;
  let bestErr = Math.abs(mid - targetPx);
  for (let d = -deltaMax; d <= deltaMax + 1e-9; d += 0.1) {
    const err = Math.abs(model(d) - targetPx);
    if (err < bestErr - 1e-12) {
      bestErr = err;
      bestDelta = d;
    }
  }
  if (Math.abs(bestDelta) < AIM_MIN_DELTA_DEG) {
    aimTotals.on_target++;
    return null;
  }
  const clamped = Math.abs(bestDelta) > deltaMax - 0.11;
  if (clamped) aimTotals.clamped++;

  // Rotate fallback: pitch ran out of throw — solve the residual with the
  // whole-arc rotation knob, composed additively (the production evaluation
  // below re-gates the joint geometry, catching the additivity tail).
  let rotDelta = 0;
  let predicted = model(bestDelta);
  if (clamped && aimRotFallbackEnabled()) {
    const R = AIM_ROT_PROBE_DEG;
    const rlo = probeReleaseSpeed(engine, rotateArc(base.lines, -R), releaseFrame);
    const rhi = rlo === null ? null : probeReleaseSpeed(engine, rotateArc(base.lines, R), releaseFrame);
    if (rlo !== null && rhi !== null) {
      const rotModel = (d: number): number =>
        (rlo * d * (d - R)) / (2 * R * R) - (mid * (d + R) * (d - R)) / (R * R) +
        (rhi * (d + R) * d) / (2 * R * R);
      const residTarget = targetPx - predicted;
      let bestRot = 0;
      let bestRotErr = Math.abs(residTarget);
      for (let d = -AIM_ROT_MAX_DEG; d <= AIM_ROT_MAX_DEG + 1e-9; d += 0.1) {
        const err = Math.abs(rotModel(d) - mid - residTarget);
        if (err < bestRotErr - 1e-12) {
          bestRotErr = err;
          bestRot = d;
        }
      }
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
  // Deliberately NO sampleAttempt: the aimed candidate is not part of the
  // deterministic attempt prefix (samplePrefix must exclude it when a smaller
  // nCand re-reads the cache — the smaller pool's best may differ).
  return fit;
}
