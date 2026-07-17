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
  type CandidateLineEvaluationOptions,
} from "../core/candidate.ts";
import {
  readPreTargetSledTrace,
  readTargetStateFromRider,
  sampleArcPlacementGeometry,
  type ArcPlacementGeometry,
  type ImpactFrameTargetState,
  type PreTargetSledTrace,
} from "../arc_placement.ts";
import { getRiderMetered } from "../../lib/detector.ts";
import { registerCompileReset } from "../core/compile_lifecycle.ts";
import type { AxisValues, CandidateSampleMode, Gap } from "../types.ts";
import type { SupportGeometryMode } from "../core/support_geometry.ts";

/** A Candidate is exactly the existing `GapFit` shape: geometry + lines
 *  + achieved-axes + cost. Re-exported here to keep the optimizer
 *  surface self-contained. */
export type Candidate = GapFit & {
  /** Attempt index inside the deterministic per-gap sample prefix. This lets a
   *  larger cached prefix answer a later smaller-K request exactly. */
  sampleAttempt?: number;
};

/**
 * Trace of one exact normal sampling operation. This is an observation API for
 * studies: `fit` is exactly what `sampleOneCandidate` returns, while `geometry`
 * exposes the pre-gate proposal so failed attempts are not invisible.
 */
export type SampledCandidateObservation = {
  geometry: ArcPlacementGeometry;
  fit: Candidate | null;
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
  probeCache?: WeakMap<object, Map<number, CandidateProbe>>;
};

export type CandidateProbe = {
  refX: number;
  refY: number;
  targetState: ImpactFrameTargetState;
  preTargetSledTrace: () => PreTargetSledTrace;
};

let candidateSampleCount = 0;
let viableCandidateCount = 0;

export function resetCandidateSamples(): void {
  candidateSampleCount = 0;
  viableCandidateCount = 0;
}
registerCompileReset(resetCandidateSamples);

export function getCandidateSamples(): number {
  return candidateSampleCount;
}

export function getViableCandidates(): number {
  return viableCandidateCount;
}

// deno-lint-ignore no-explicit-any
export function getCandidateProbe(engine: any, gap: Gap, ctx: SpecContext): CandidateProbe {
  const cache = ctx.probeCache ??= new WeakMap<object, Map<number, CandidateProbe>>();
  let byGap = cache.get(engine);
  if (byGap === undefined) {
    byGap = new Map<number, CandidateProbe>();
    cache.set(engine, byGap);
  }
  const cached = byGap.get(gap.index);
  if (cached !== undefined) return cached;

  // Use the METERED rider read for the first probe: a raw engine.getRider
  // advances lr-core to gap.endFrame without charging the physics-frame counter.
  const rider = getRiderMetered(engine, gap.endFrame);
  const refX = rider.position.x;
  const refY = rider.position.y;
  const targetState = readTargetStateFromRider(rider, refX, refY);
  let preTargetTrace: PreTargetSledTrace | undefined;
  const probe: CandidateProbe = {
    refX,
    refY,
    targetState,
    preTargetSledTrace: () => preTargetTrace ??= readPreTargetSledTrace(engine, gap),
  };
  byGap.set(gap.index, probe);
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
   *  to `gap.targets`, so generation pursues the literal per-gap target. */
  geometryTargets: AxisValues = gap.targets,
  /** Optional normal-stream support envelope for a compiler-owned specialist
   *  lane. It changes geometry only; hard gates and scoring remain literal. */
  supportGeometryMode?: SupportGeometryMode,
  /** Terminal terrain grade from the immediately preceding committed fit.  It
   * is optional so non-prefix study callers retain the historical stream. */
  previousCommittedTerminalGradeDeg?: number | null,
): Candidate | null {
  return observeOneCandidate(
    engine,
    gap,
    rng,
    ctx,
    lineIdStart,
    attempt,
    mode,
    geometryTargets,
    supportGeometryMode,
    undefined,
    previousCommittedTerminalGradeDeg,
  ).fit;
}

/**
 * Execute the same atomic operation as `sampleOneCandidate`, retaining the
 * raw generated geometry for audit studies. It does not retry, rank, or alter
 * the candidate path; callers that only need production behavior should use
 * `sampleOneCandidate`.
 */
export function observeOneCandidate(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  rng: () => number,
  ctx: SpecContext,
  lineIdStart: number,
  attempt = 0,
  mode: CandidateSampleMode = "normal",
  geometryTargets: AxisValues = gap.targets,
  supportGeometryMode?: SupportGeometryMode,
  /** Study-only evaluator override. Omitted in production, preserving the
   * normal candidate path exactly; useful when an attribution study must
   * disable optional post-fit continuation on both compared families. */
  evaluationOptions?: CandidateLineEvaluationOptions,
  /** Optional committed predecessor grade for an attempt-spanned normal
   * sampler source.  Omitted paths remain byte-identical. */
  previousCommittedTerminalGradeDeg?: number | null,
): SampledCandidateObservation {
  candidateSampleCount++;
  const probe = getCandidateProbe(engine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  // Pass the real attempt index: on steep-catch gaps the geometry sampler
  // interleaves template catches with normal random samples. For non-steep gaps
  // the attempt arg is unused and the RNG drives diversity.
  const geometry = sampleArcPlacementGeometry(
    rng, probe.refX, probe.refY, geometryTargets, probe.targetState, attempt, gap, lineIdStart, mode,
    ctx.allContactFrames, supportGeometryMode, previousCommittedTerminalGradeDeg,
  );

  const fit = tryCandidateGeometry(
    engine, gap, geometry, lineIdStart, ctx.allContactFrames,
    axisMeasureEnd, gap.targets, true, mode, probe.preTargetSledTrace, evaluationOptions,
  ) as Candidate | null;

  // Record the sled reference used to place this catch, so a later gap with a
  // similar entry state can translate this geometry and reuse it (catch-reuse
  // on periodic specs). Sled-relative geometry → translating by the sled delta
  // reproduces the same catch shape at the new entry.
  if (fit !== null) {
    viableCandidateCount++;
    fit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
    fit.sampleAttempt = attempt;
  }
  return { geometry, fit };
}
