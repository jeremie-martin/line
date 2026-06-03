/**
 * Step 1 — atomic per-candidate operation.
 *
 * Given an engine state at the START of a gap, a gap, an RNG callable
 * (each call consumes one random number), and a small per-spec context,
 * sample ONE candidate geometry + try to fit it + return a Candidate or
 * null if the candidate doesn't survive the hard gates inside
 * `tryCandidateGeometry` (survival, on-beat landing, no off-beat).
 *
 * This is the smallest verifiable unit of the rebuild: same inputs produce the
 * same output every time. The only module-level state is non-behavioral work
 * instrumentation, reset by compiler entry points before each compile.
 *
 * The chainer in Step 3+ wraps this call in a per-gap loop. The
 * solver in Step 2 wraps it in a "sample K then sort" pattern.
 *
 * For now we use `gap.targets` directly as the cost target — no
 * residual-targeting / look-ahead. Multi-gap residual logic is a
 * Step 5+ concern.
 */

import { type GapFit } from "../core/substrate.ts";
import {
  axisLookaheadEndFrame,
  tryCandidateGeometry,
} from "../core/candidate.ts";
import {
  readTargetState,
  sampleArcPlacementGeometry,
} from "../arc_placement.ts";
import { getRiderMetered } from "../../lib/detector.ts";
import type { CandidateSampleMode, Gap } from "../types.ts";

/** A Candidate is exactly the existing `GapFit` shape: geometry + lines
 *  + achieved-axes + cost. Re-exported here to keep the optimizer
 *  surface self-contained. */
export type Candidate = GapFit & {
  /** Attempt index inside the deterministic per-gap sample prefix. This lets a
   *  larger cached prefix answer a later smaller-K request exactly. */
  sampleAttempt?: number;
};

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

let candidateSampleCount = 0;
let viableCandidateCount = 0;

export function resetCandidateSamples(): void {
  candidateSampleCount = 0;
  viableCandidateCount = 0;
}

export function getCandidateSamples(): number {
  return candidateSampleCount;
}

export function getViableCandidates(): number {
  return viableCandidateCount;
}

/** Sample exactly one candidate at the given gap from the given
 *  engine state. Pure function: same `(engine, gap, rng-state, ctx,
 *  lineIdStart)` → identical output (Candidate or null).
 *
 *  The `rng` parameter is a callable RNG; one call to this function
 *  may consume one or more RNG draws (via `sampleArcPlacementGeometry`). After
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
  /** Attempt index within a gap's K-sample loop. Drives the steep-catch template
   *  interleave in sampleArcPlacementGeometry; the K-candidate solver passes 0..K-1 so
   *  templates and normal random samples are swept deterministically. Defaults to
   *  0 for single-sample callers. */
  attempt = 0,
  /** Sampling mode. Extra compiler streams use non-normal modes; the main
   *  K-prefix remains normal and deterministic. */
  mode: CandidateSampleMode = "normal",
): Candidate | null {
  candidateSampleCount++;
  // Use the METERED rider read for the first probe: the raw engine.getRider
  // advances lr-core to gap.endFrame without charging the physics-frame counter,
  // and the subsequent readTargetState (getRiderMetered) then hits the cached
  // frame for zero — so candidate-generation work went uncounted (review P2).
  const rider = getRiderMetered(engine, gap.endFrame);
  const refX = rider.position.x;
  const refY = rider.position.y;
  const targetState = readTargetState(engine, gap.endFrame, refX, refY);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);

  // Pass the real attempt index: on steep-catch gaps the geometry sampler
  // interleaves template catches with normal random samples. For non-steep gaps
  // the attempt arg is unused and the RNG drives diversity.
  const geometry = sampleArcPlacementGeometry(
    rng, refX, refY, gap.targets, targetState, attempt, gap, lineIdStart, mode,
    ctx.allContactFrames,
  );

  // The atomic sample uses the gap's own targets directly (multi-gap residual
  // targeting is a higher-level concern).
  const fit = tryCandidateGeometry(
    engine, gap, geometry, lineIdStart, ctx.allContactFrames,
    axisMeasureEnd, gap.targets, true, mode,
  ) as Candidate | null;

  // Record the sled reference used to place this catch, so a later gap with a
  // similar entry state can translate this geometry and reuse it (catch-reuse
  // on periodic specs). Sled-relative geometry → translating by the sled delta
  // reproduces the same catch shape at the new entry.
  if (fit !== null) {
    viableCandidateCount++;
    fit.ref = { x: targetState.sledX, y: targetState.sledY };
    fit.sampleAttempt = attempt;
  }

  return fit;
}
