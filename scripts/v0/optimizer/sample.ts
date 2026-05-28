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
 * For now we use `gap.targets` directly as the cost target — no
 * residual-targeting / look-ahead. Multi-gap residual logic is a
 * Step 5+ concern.
 */

import {
  type GapFit,
  axisLookaheadEndFrame,
  readTargetState,
  sampleArcParams,
  tryCandidate,
} from "../compile.ts";
import type { Gap } from "./types.ts";

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
};

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
): Candidate | null {
  const rider = engine.getRider(gap.endFrame);
  const refX = rider.position.x;
  const refY = rider.position.y;
  const targetState = readTargetState(engine, gap.endFrame, refX, refY);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);

  // attempt=0 because we only sample one. Note: when called repeatedly
  // (Step 2's K-candidate solver), the RNG state advances each call so
  // arc parameters differ, even with attempt fixed at 0. The
  // attempt-indexed CATCH_TEMPLATES branch in sampleArcParams only
  // fires for "steep catch" gaps; for non-steep gaps the attempt arg
  // is unused. Setting it to 0 means: each call samples uniformly
  // from the full parameter space, with no template-driven first
  // pick.
  const arc = sampleArcParams(rng, refX, refY, gap.targets, targetState, 0, gap);

  // searchTargets defaults to gap.targets here. Multi-gap residual
  // targeting is a higher-level concern (Step 5+); the atomic
  // sample uses the gap's own targets directly.
  const fit = tryCandidate(
    engine, gap, arc, lineIdStart, ctx.allContactFrames,
    axisMeasureEnd, gap.targets, true,
  );

  return fit;
}
