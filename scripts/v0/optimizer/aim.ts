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

/** Probe offsets for the quadratic fit (deg); the base candidate is δ=0. */
const AIM_PROBE_DELTA_DEG = 6;
/** Solve range (deg) — the span validated by the sensitivity studies. */
const AIM_DELTA_MAX_DEG = 10;
/** Below this |δ*| the aimed variant would duplicate the base candidate. */
const AIM_MIN_DELTA_DEG = 0.25;

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
  const mid = base.releaseSpeed;
  if (mid === undefined) return null;
  const targetPx = nextGapSpeedTargetPx(gap, gaps);
  if (targetPx === null) return null;

  const releaseFrame = releaseStateFrame(gap, ctx.allContactFrames);
  const P = AIM_PROBE_DELTA_DEG;
  const lo = probeReleaseSpeed(engine, pitchExit(base.lines, -P), releaseFrame);
  if (lo === null) return null;
  const hi = probeReleaseSpeed(engine, pitchExit(base.lines, P), releaseFrame);
  if (hi === null) return null;

  // Quadratic through (−P, lo), (0, mid), (+P, hi); solve δ* by scan so the
  // mild curvature and unreachable targets (clamp to span edge) are handled
  // uniformly. 0.1° steps ≈ 0.01 px/f resolution — below the model's error.
  const model = (d: number): number =>
    (lo * d * (d - P)) / (2 * P * P) - (mid * (d + P) * (d - P)) / (P * P) +
    (hi * (d + P) * d) / (2 * P * P);
  let bestDelta = 0;
  let bestErr = Math.abs(mid - targetPx);
  for (let d = -AIM_DELTA_MAX_DEG; d <= AIM_DELTA_MAX_DEG + 1e-9; d += 0.1) {
    const err = Math.abs(model(d) - targetPx);
    if (err < bestErr - 1e-12) {
      bestErr = err;
      bestDelta = d;
    }
  }
  if (Math.abs(bestDelta) < AIM_MIN_DELTA_DEG) return null;

  const aimedLines = pitchExit(base.lines, bestDelta)
    .map((l, i) => ({ ...l, id: lineIdStart + i }));
  const probe = getCandidateProbe(engine, gap, ctx);
  const fit = tryCandidateLines(
    engine, gap, aimedLines, lineIdStart, ctx.allContactFrames,
    axisLookaheadEndFrame(gap, ctx.allContactFrames), gap.targets, true,
    "normal", probe.preTargetSledTrace,
  ) as Candidate | null;
  if (fit === null) return null;
  fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
  // Deliberately NO sampleAttempt: the aimed candidate is not part of the
  // deterministic attempt prefix (samplePrefix must exclude it when a smaller
  // nCand re-reads the cache — the smaller pool's best may differ).
  return fit;
}
