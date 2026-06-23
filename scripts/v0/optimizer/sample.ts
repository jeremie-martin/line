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
  readPreTargetSledTrace,
  readTargetStateFromRider,
  sampleArcPlacementGeometry,
  type ImpactFrameTargetState,
  type PreTargetSledTrace,
} from "../arc_placement.ts";
import { getPhysicsFrameCount, getRiderMetered, sledPoseDegFromRider } from "../../lib/detector.ts";
import { registerCompileReset } from "../core/compile_lifecycle.ts";
import type { AxisValues, CandidateSampleMode, Gap } from "../types.ts";
import { aimTargets } from "./planning.ts";

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
  /** Unjittered per-gap targets, when callers need stable authored target patterns. */
  gapAxisTargets?: AxisValues[];
  /** Per-compile, per-engine/gap probe cache. The engine objects are immutable
   *  prefix states, so a WeakMap keeps the cache scoped to live search nodes. */
  probeCache?: WeakMap<object, Map<string, CandidateProbe>>;
};

export type CandidateProbe = {
  refX: number;
  refY: number;
  targetState: ImpactFrameTargetState;
  preTargetSledTrace: () => PreTargetSledTrace;
  /** Sled pose / "internal rotation" (TAIL→NOSE, deg, +down) at gap.endFrame
   *  — where the rider is POINTING, distinct from targetState.angleDeg (CoM
   *  velocity direction, where the mass is GOING). Deferred + memoized like
   *  preTargetSledTrace; zero metered frames (endFrame is already simulated
   *  by this probe's construction). An available model output — consumed by
   *  no decision yet. */
  sledPoseDeg: () => number | null;
};

let candidateSampleCount = 0;
let viableCandidateCount = 0;
/** Physics frames charged INSIDE pool-candidate evaluation rides
 *  (`sampleOneCandidate` → `tryCandidateGeometry`). This isolates the
 *  dominant per-node cost — the exact-evaluation rides through each sampled
 *  geometry — from aim-lane probes and forward-eval rollouts, which charge
 *  frames elsewhere. Pure telemetry; reset by compile entry points. */
let poolEvalFrames = 0;

export function resetCandidateSamples(): void {
  candidateSampleCount = 0;
  viableCandidateCount = 0;
  poolEvalFrames = 0;
}
registerCompileReset(resetCandidateSamples);

export function getCandidateSamples(): number {
  return candidateSampleCount;
}

export function getPoolEvalFrames(): number {
  return poolEvalFrames;
}

export function getViableCandidates(): number {
  return viableCandidateCount;
}

// deno-lint-ignore no-explicit-any
export function getCandidateProbe(engine: any, gap: Gap, ctx: SpecContext): CandidateProbe {
  const key = `${gap.index}:${gap.startFrame}:${gap.endFrame}`;
  const cache = ctx.probeCache ??= new WeakMap<object, Map<string, CandidateProbe>>();
  let byGap = cache.get(engine);
  if (byGap === undefined) {
    byGap = new Map<string, CandidateProbe>();
    cache.set(engine, byGap);
  }
  const cached = byGap.get(key);
  if (cached !== undefined) return cached;

  // Use the METERED rider read for the first probe: a raw engine.getRider
  // advances lr-core to gap.endFrame without charging the physics-frame counter.
  const rider = getRiderMetered(engine, gap.endFrame);
  const refX = rider.position.x;
  const refY = rider.position.y;
  const targetState = readTargetStateFromRider(rider, refX, refY);
  let preTargetTrace: PreTargetSledTrace | undefined;
  let sledPose: number | null | undefined;
  const probe: CandidateProbe = {
    refX,
    refY,
    targetState,
    preTargetSledTrace: () => preTargetTrace ??= readPreTargetSledTrace(engine, gap),
    // Re-fetches the rider at the already-simulated endFrame (zero metered
    // frames) rather than capturing the rider handle in this closure.
    sledPoseDeg: () =>
      sledPose !== undefined
        ? sledPose
        : (sledPose = sledPoseDegFromRider(getRiderMetered(engine, gap.endFrame))),
  };
  byGap.set(key, probe);
  return probe;
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
  /** Optional geometry-only target override. Candidate scoring and hard gates
   *  still use `gap.targets`; this only shapes the sampled line fragment. Defaults
   *  to the planned aim (`aimTargets` = gap.targets unless the planning pre-pass
   *  re-aimed this gap), so generation pursues the plan while cost/gates use truth. */
  geometryTargets: AxisValues = aimTargets(gap),
): Candidate | null {
  candidateSampleCount++;
  const probe = getCandidateProbe(engine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  // Pass the real attempt index: on steep-catch gaps the geometry sampler
  // interleaves template catches with normal random samples. For non-steep gaps
  // the attempt arg is unused and the RNG drives diversity.
  const geometry = sampleArcPlacementGeometry(
    rng, probe.refX, probe.refY, geometryTargets, probe.targetState, attempt, gap, lineIdStart, mode,
    ctx.allContactFrames,
  );

  const framesBeforeRide = getPhysicsFrameCount();
  const fit = tryCandidateGeometry(
    engine, gap, geometry, lineIdStart, ctx.allContactFrames,
    axisMeasureEnd, gap.targets, true, mode, probe.preTargetSledTrace,
  ) as Candidate | null;
  poolEvalFrames += Math.max(0, getPhysicsFrameCount() - framesBeforeRide);

  // Record the sled reference used to place this catch, so a later gap with a
  // similar entry state can translate this geometry and reuse it (catch-reuse
  // on periodic specs). Sled-relative geometry → translating by the sled delta
  // reproduces the same catch shape at the new entry.
  if (fit !== null) {
    viableCandidateCount++;
    fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    fit.sampleAttempt = attempt;
  }
  return fit;
}
