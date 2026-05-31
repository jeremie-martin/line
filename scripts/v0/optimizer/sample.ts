/**
 * Step 1 — atomic per-candidate operation.
 *
 * Given an engine state at the START of a gap, a gap, an RNG callable
 * (each call consumes one random number), and a small per-spec context,
 * sample ONE candidate arc + try to fit it + return a Candidate or
 * null if the candidate doesn't survive the hard gates inside
 * `tryCandidate` (survival, on-beat landing, no off-beat).
 *
 * This is the smallest verifiable unit of the rebuild: a pure function
 * with no module-level state. Same inputs → same output, every time.
 *
 * The chainer in Step 3+ wraps this call in a per-gap loop. The
 * solver in Step 2 wraps it in a "sample K then sort" pattern.
 *
 * By default we use `gap.targets` directly as the cost target. Callers that
 * provide full spec/gap context can opt into prefix-residual cost targets
 * without changing candidate sampling or hard-gate validation.
 */

import {
  clamp,
  measureFitGrain,
  type GapFit,
} from "../core/substrate.ts";
import {
  axisLookaheadEndFrame,
  readTargetState,
  sampleArcParams,
  searchTargetsForCost,
  tryCandidate,
} from "../core/candidate.ts";
import { getRiderMetered } from "../../lib/detector.ts";
import { FPS, secToFrame, type Gap, type SectionAxes, type Spec } from "../types.ts";

/** A Candidate is exactly the existing `GapFit` shape: arc + lines
 *  + achieved-axes + cost. Re-exported here to keep the optimizer
 *  surface self-contained. */
export type Candidate = GapFit;

/** Context that is constant across all gaps of a single compile call.
 *  Computed once by the chainer (Step 3) from the spec; passed
 *  unchanged into every per-gap call. */
export type SpecContext = {
  /** All Contact frames of the spec, in time order. Used by
   *  `axisLookaheadEndFrame` and by `tryCandidate`'s off-beat check. */
  allContactFrames: number[];
  /** Total frames in the spec. Used in survival checks downstream. */
  durationFrames: number;
  /** Optional full-spec context for prefix-residual candidate costing. */
  spec?: Spec;
  /** Optional timeline context matching the current compile's gap list. */
  gaps?: Gap[];
};

const AIR_RESIDUAL_TARGET_GAIN = 0.25;
const GRAIN_RESIDUAL_TARGET_GAIN = 0.15;

/** Sample exactly one candidate at the given gap from the given
 *  engine state. Pure function: same `(engine, gap, rng-state, ctx,
 *  lineIdStart)` → identical output (Candidate or null).
 *
 *  The `rng` parameter is a callable RNG; one call to this function
 *  may consume one or more RNG draws (via `sampleArcParams`). After
 *  this call returns, the rng is in a deterministic post-state.
 *
 *  `lineIdStart` is the next available line ID for this candidate's
 *  geometry. The chainer is responsible for incrementing it across
 *  per-gap calls.
 */
export function sampleOneCandidate(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  rng: () => number,
  ctx: SpecContext,
  lineIdStart: number,
  /** Attempt index within a gap's K-sample loop. Drives the steep-catch
   *  CATCH_TEMPLATES selection in sampleArcParams; the K-candidate solver passes
   *  0..K-1 so the templates are actually swept rather than all collapsing to
   *  template 0 (review P2). Defaults to 0 for single-sample callers. */
  attempt = 0,
  prefixFits?: (GapFit | null)[],
): Candidate | null {
  // Use the METERED rider read for the first probe: the raw engine.getRider
  // advances lr-core to gap.endFrame without charging the physics-frame counter,
  // and the subsequent readTargetState (getRiderMetered) then hits the cached
  // frame for zero — so candidate-generation work went uncounted (review P2).
  const rider = getRiderMetered(engine, gap.endFrame);
  const refX = rider.position.x;
  const refY = rider.position.y;
  const targetState = readTargetState(engine, gap.endFrame, refX, refY);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  const searchTargets = prefixFits === undefined || ctx.spec === undefined || ctx.gaps === undefined
    ? searchTargetsForCost(gap.targets, gap, axisMeasureEnd, ctx.allContactFrames)
    : optimizerSearchTargetsForCost(
      gap.targets, gap, axisMeasureEnd, ctx.allContactFrames,
      ctx, prefixFits,
    );

  // Pass the real attempt index: on steep-catch gaps sampleArcParams selects
  // CATCH_TEMPLATES[attempt] (before consuming RNG), so threading 0..K-1 sweeps
  // the templates instead of every K sample reusing template 0 (review P2). For
  // non-steep gaps the attempt arg is unused and the RNG drives diversity.
  const arc = sampleArcParams(rng, refX, refY, gap.targets, targetState, attempt, gap);

  // Residual targets only affect cost ranking. Candidate geometry still samples
  // from the gap's authored targets, and hard gates remain unchanged.
  const fit = tryCandidate(
    engine, gap, arc, lineIdStart, ctx.allContactFrames,
    axisMeasureEnd, searchTargets, true,
  );

  return fit;
}

function optimizerSearchTargetsForCost(
  targets: SectionAxes,
  gap: Gap,
  axisMeasureEnd: number,
  allContactFrames: number[],
  ctx: SpecContext,
  prefixFits: (GapFit | null)[] | undefined,
): SectionAxes {
  const residualAir = residualAirTargetForGap(gap, ctx, prefixFits);
  const airTargets = residualAir === undefined ? targets : { ...targets, air: residualAir };
  const baseTargets = searchTargetsForCost(airTargets, gap, axisMeasureEnd, allContactFrames);
  const residualGrain = residualGrainTargetForGap(gap, ctx, prefixFits);
  return residualGrain === undefined ? baseTargets : { ...baseTargets, grain: residualGrain };
}

function residualAirTargetForGap(
  gap: Gap,
  ctx: SpecContext,
  prefixFits: (GapFit | null)[] | undefined,
): number | undefined {
  if (ctx.spec === undefined || ctx.gaps === undefined || prefixFits === undefined) {
    return undefined;
  }
  const window = airTargetWindow(gap, ctx.spec);
  if (window === null) return undefined;

  let totalFrames = 0;
  let prefixFrames = 0;
  let prefixAirFrames = 0;
  for (const other of ctx.gaps) {
    if (!other.endsWithContact) continue;
    const frames = gapWindowFrameCount(other, window.startFrame, window.endFrame);
    if (frames <= 0) continue;
    totalFrames += frames;
    if (other.index >= gap.index) continue;
    const fit = prefixFits[other.index];
    if (fit?.achieved.air === undefined) continue;
    prefixFrames += frames;
    prefixAirFrames += fit.achieved.air * frames;
  }
  if (prefixFrames <= 0 || totalFrames <= prefixFrames) return undefined;

  const remainingFrames = totalFrames - prefixFrames;
  const neededMean = clamp(
    (window.air * totalFrames - prefixAirFrames) / remainingFrames,
    0,
    0.99,
  );
  const current = gap.targets.air ?? window.air;
  const residualPressure = Math.min(1, Math.abs(window.air - 0.5) * 2);
  const gain = AIR_RESIDUAL_TARGET_GAIN * residualPressure;
  return clamp(current + gain * (neededMean - current), 0, 0.99);
}

function residualGrainTargetForGap(
  gap: Gap,
  ctx: SpecContext,
  prefixFits: (GapFit | null)[] | undefined,
): number | undefined {
  if (ctx.spec === undefined || ctx.gaps === undefined || prefixFits === undefined) {
    return undefined;
  }
  const window = grainTargetWindow(gap, ctx.spec);
  if (window === null) return undefined;

  let total = 0;
  let prefixCount = 0;
  let prefixSum = 0;
  for (const other of ctx.gaps) {
    if (!other.endsWithContact) continue;
    if (other.endFrame < window.startFrame || other.endFrame > window.endFrame) continue;
    total++;
    if (other.index >= gap.index) continue;
    const fit = prefixFits[other.index];
    if (fit === undefined || fit === null) continue;
    prefixSum += measureFitGrain(fit);
    prefixCount++;
  }
  if (prefixCount <= 0 || total <= prefixCount) return undefined;

  const remaining = total - prefixCount;
  const neededMean = clamp((window.grain * total - prefixSum) / remaining, 0, 1);
  const current = gap.targets.grain ?? window.grain;
  const residualPressure = Math.min(1, Math.abs(neededMean - current) / 0.25);
  const gain = GRAIN_RESIDUAL_TARGET_GAIN * residualPressure;
  return clamp(current + gain * (neededMean - current), 0, 1);
}

function airTargetWindow(
  gap: Gap,
  spec: Spec,
): { air: number; startFrame: number; endFrame: number } | null {
  const t = gap.endFrame / FPS;
  let out: { air: number; startFrame: number; endFrame: number } | null = null;
  if (spec.defaults?.air !== undefined) {
    out = {
      air: spec.defaults.air,
      startFrame: 0,
      endFrame: secToFrame(spec.duration),
    };
  }
  for (const sec of spec.sections) {
    if (sec.air === undefined || sec.t0 > t || sec.t1 < t) continue;
    out = {
      air: sec.air,
      startFrame: secToFrame(sec.t0),
      endFrame: secToFrame(sec.t1),
    };
  }
  return out;
}

function grainTargetWindow(
  gap: Gap,
  spec: Spec,
): { grain: number; startFrame: number; endFrame: number } | null {
  const t = gap.endFrame / FPS;
  let out: { grain: number; startFrame: number; endFrame: number } | null = null;
  if (spec.defaults?.grain !== undefined) {
    out = {
      grain: spec.defaults.grain,
      startFrame: 0,
      endFrame: secToFrame(spec.duration),
    };
  }
  for (const sec of spec.sections) {
    if (sec.grain === undefined || sec.t0 > t || sec.t1 < t) continue;
    out = {
      grain: sec.grain,
      startFrame: secToFrame(sec.t0),
      endFrame: secToFrame(sec.t1),
    };
  }
  return out;
}

function gapWindowFrameCount(gap: Gap, startFrame: number, endFrame: number): number {
  const start = Math.max(gap.startFrame, startFrame);
  const end = Math.min(gap.endFrame, endFrame);
  return end >= start ? end - start + 1 : 0;
}
