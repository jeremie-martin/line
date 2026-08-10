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
  impactSegmentLaw,
  nativeCatchFrameMode,
  recordNormalPostCurveResolutionSibling,
  sampleArcPlacementGeometry,
  type ArcPlacementGeometry,
  type ImpactFrameTargetState,
  type PreTargetSledTrace,
} from "../arc_placement.ts";
import { getRiderMetered } from "../../lib/detector.ts";
import { registerCompileReset } from "../core/compile_lifecycle.ts";
import type { BallisticFitFields } from "../core/ballistic_projection.ts";
import type { AxisValues, CandidateSampleMode, Gap } from "../types.ts";
import type { SupportGeometryMode } from "../core/support_geometry.ts";
import { arcProposalTargetsForGap } from "./arc_proposal.ts";
import { compileScopedEnv } from "../env_flags.ts";
import {
  characterizeNativeCatchHistory,
  nativeCatchReferenceFrame,
  readNativeCatchSledPoints,
  type NativeCatchReferenceFrame,
} from "../trajectory/native_catch_history.ts";
import type { PrecontactMulticontactHistoryReady } from "../trajectory/precontact_multicontact_history.ts";
import { axisErrorsForTargets } from "../score.ts";

export type NativeCatchHistoryMode =
  | "damp"
  | "damp-strong"
  | "damp-coherent"
  | "damp-detector";
const readNativeCatchHistoryMode = compileScopedEnv("LR_NATIVE_CATCH_HISTORY");

export function nativeCatchHistoryMode(
  environment?: Record<string, string | undefined>,
): NativeCatchHistoryMode | null {
  const value = environment === undefined
    ? readNativeCatchHistoryMode()
    : environment.LR_NATIVE_CATCH_HISTORY;
  if (value === undefined || value === "" || value === "0" || value === "off") return null;
  if (
    value === "damp" || value === "damp-strong" || value === "damp-coherent" ||
    value === "damp-detector"
  ) return value;
  throw new Error(
    `LR_NATIVE_CATCH_HISTORY must be off, damp, damp-strong, damp-coherent, or damp-detector; got ${value}`,
  );
}

/** A Candidate is exactly the existing `GapFit` shape: geometry + lines
 *  + achieved-axes + cost. Re-exported here to keep the optimizer
 *  surface self-contained. */
export type Candidate = GapFit & BallisticFitFields & {
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
  activeSiblingFit?: Candidate | null;
  resolutionSiblingFit?: Candidate | null;
};

/**
 * Exact current-gap certificate for an additive resolution sibling. Every
 * scored axis must be no worse than the nominal parent and the pooled SSE must
 * improve strictly. This is deliberately stronger than the ordinary ranker:
 * the extra geometry is insurance, not a replacement candidate.
 */
export function resolutionSiblingHasNoAxisDebt(
  targets: AxisValues,
  nominal: Pick<Candidate, "achieved">,
  refined: Pick<Candidate, "achieved">,
): boolean {
  const base = axisErrorsForTargets(targets, nominal.achieved);
  const sibling = axisErrorsForTargets(targets, refined.achieved);
  if (base.length === 0 || sibling.length !== base.length) return false;
  let baseSse = 0;
  let siblingSse = 0;
  for (let index = 0; index < base.length; index++) {
    const baseError = base[index]!;
    const siblingError = sibling[index]!;
    if (Math.abs(siblingError) > Math.abs(baseError) + 1e-12) return false;
    baseSse += baseError * baseError;
    siblingSse += siblingError * siblingError;
  }
  return siblingSse < baseSse - 1e-12;
}

/**
 * Study-only view of one real production-sampler attempt. `contextKey` is the
 * immutable prefix engine: repeated attempts with the same key, gap, and mode
 * belong to one counterfactual bundle. Consumers must copy any retained data
 * synchronously; production owns the referenced objects.
 */
export type CandidateSampleTrace = {
  contextKey: object;
  /** Causal compile context available before this proposal. Study consumers
   * retain only the fields they need; production never installs the sink. */
  specContext: SpecContext;
  gap: Gap;
  targetState: ImpactFrameTargetState;
  /** Deterministic proposal-stream identity supplied by the pool owner.
   * Together with `attempt`, this identifies one policy draw even when the
   * same immutable prefix engine is revisited by multiple search streams. */
  proposalBatchId: number | null;
  attempt: number;
  mode: CandidateSampleMode;
  geometryTargets: AxisValues;
  supportGeometryMode?: SupportGeometryMode;
  fit: Candidate | null;
};

let candidateSampleTraceSink:
  ((trace: CandidateSampleTrace) => void) | null = null;

/** Install or clear the readiness-corpus observer. Null in production. */
export function setCandidateSampleTraceSink(
  sink: ((trace: CandidateSampleTrace) => void) | null,
): void {
  candidateSampleTraceSink = sink;
}

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
  /** Contact-indexed sampled gaps for consumers that must distinguish the
   * incoming scorer interval from the following outgoing interval. */
  gaps?: readonly Gap[];
  /** Per-compile, per-engine/gap probe cache. The engine objects are immutable
   *  prefix states, so a WeakMap keeps the cache scoped to live search nodes. */
  probeCache?: WeakMap<object, Map<number, CandidateProbe>>;
};

export type CandidateProbe = {
  refX: number;
  refY: number;
  targetState: ImpactFrameTargetState;
  preTargetSledTrace: () => PreTargetSledTrace;
  precontactHistory: () => PrecontactMulticontactHistoryReady | null;
  nativeCatchReference: () => NativeCatchReferenceFrame | null;
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
  const targetSledPoints = readNativeCatchSledPoints(rider);
  let preTargetTrace: PreTargetSledTrace | undefined;
  let precontactHistory: PrecontactMulticontactHistoryReady | null | undefined;
  const probe: CandidateProbe = {
    refX,
    refY,
    targetState,
    preTargetSledTrace: () => preTargetTrace ??= readPreTargetSledTrace(engine, gap),
    precontactHistory: () => precontactHistory ??= characterizeNativeCatchHistory(
      preTargetTrace ??= readPreTargetSledTrace(engine, gap),
      Math.max(0, gap.startFrame),
      gap.endFrame,
      targetSledPoints,
    ),
    nativeCatchReference: () => nativeCatchReferenceFrame(targetSledPoints, refX, refY),
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
   * still use `gap.targets`; this only shapes the sampled line fragment.
   * Production defaults to the contact-owned composition of incoming
   * impact/grain and outgoing motion targets. Standalone study contexts that
   * omit the gap timeline treat `gap.targets` as an explicit proposal bundle. */
  geometryTargets?: AxisValues,
  /** Optional normal-stream support envelope for a compiler-owned specialist
   *  lane. It changes geometry only; hard gates and scoring remain literal. */
  supportGeometryMode?: SupportGeometryMode,
  /** Study identity only; it does not influence proposal generation. */
  proposalBatchId?: number,
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
    proposalBatchId,
  ).fit;
}

/**
 * Production solver view of one RNG attempt. Default behavior returns exactly
 * one fit; the default-off active-material study may append one coincident
 * sibling while retaining the solid parent first.
 */
export function sampleCandidateFamily(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  rng: () => number,
  ctx: SpecContext,
  lineIdStart: number,
  attempt = 0,
  proposalBatchId?: number,
): Candidate[] {
  const observed = observeOneCandidate(
    engine, gap, rng, ctx, lineIdStart, attempt, "normal",
    undefined, undefined, undefined, proposalBatchId,
  );
  return [
    observed.fit,
    observed.activeSiblingFit ?? null,
    observed.resolutionSiblingFit ?? null,
  ]
    .filter((fit): fit is Candidate => fit !== null);
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
  geometryTargets?: AxisValues,
  supportGeometryMode?: SupportGeometryMode,
  /** Study-only evaluator override. Omitted in production, preserving the
   * normal candidate path exactly; useful when an attribution study must
   * disable optional post-fit continuation on both compared families. */
  evaluationOptions?: CandidateLineEvaluationOptions,
  /** Study identity only; it does not influence proposal generation. */
  proposalBatchId?: number,
): SampledCandidateObservation {
  candidateSampleCount++;
  const probe = getCandidateProbe(engine, gap, ctx);
  const axisMeasureEnd = axisLookaheadEndFrame(gap, ctx.allContactFrames);
  // Pass the real attempt index: on steep-catch gaps the geometry sampler
  // interleaves template catches with normal random samples. For non-steep gaps
  // the attempt arg is unused and the RNG drives diversity.
  const resolvedGeometryTargets = geometryTargets ??
    (
      ctx.gaps === undefined
        ? gap.targets
        : arcProposalTargetsForGap(gap, ctx.gaps)
    );
  const historyMode = nativeCatchHistoryMode();
  const frameMode = nativeCatchFrameMode();
  const segmentLaw = impactSegmentLaw();
  const segmentNeedsHistory = segmentLaw === "high-ask-dense-history" ||
    segmentLaw === "high-ask-detector-history";
  const history = historyMode !== null || segmentNeedsHistory
    ? probe.precontactHistory()
    : null;
  const geometry = sampleArcPlacementGeometry(
    rng, probe.refX, probe.refY, resolvedGeometryTargets, probe.targetState, attempt, gap, lineIdStart, mode,
    ctx.allContactFrames, supportGeometryMode,
    historyMode === null && !segmentNeedsHistory && frameMode === null ? undefined : {
      mode: historyMode,
      history,
      frameMode,
      reference: frameMode === null ? null : probe.nativeCatchReference(),
    },
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
  let activeSiblingFit: Candidate | null | undefined;
  if (geometry.activeSiblingLines !== undefined) {
    candidateSampleCount++;
    activeSiblingFit = tryCandidateGeometry(
      engine,
      gap,
      { kind: "lines", lines: geometry.activeSiblingLines },
      lineIdStart,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      mode,
      probe.preTargetSledTrace,
      evaluationOptions,
    ) as Candidate | null;
    if (activeSiblingFit !== null) {
      viableCandidateCount++;
      activeSiblingFit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      activeSiblingFit.sampleAttempt = attempt;
    }
  }
  let resolutionSiblingFit: Candidate | null | undefined;
  if (geometry.resolutionSiblingLines !== undefined && fit !== null) {
    candidateSampleCount++;
    const evaluated = tryCandidateGeometry(
      engine,
      gap,
      { kind: "lines", lines: geometry.resolutionSiblingLines },
      lineIdStart,
      ctx.allContactFrames,
      axisMeasureEnd,
      gap.targets,
      true,
      mode,
      probe.preTargetSledTrace,
      evaluationOptions,
    ) as Candidate | null;
    const admitted = evaluated !== null && resolutionSiblingHasNoAxisDebt(
      gap.targets,
      fit,
      evaluated,
    );
    recordNormalPostCurveResolutionSibling(admitted);
    resolutionSiblingFit = admitted ? evaluated : null;
    if (resolutionSiblingFit !== null) {
      viableCandidateCount++;
      resolutionSiblingFit.ref = { x: probe.targetState.sledX, y: probe.targetState.sledY };
      resolutionSiblingFit.sampleAttempt = attempt;
    }
  }
  candidateSampleTraceSink?.({
    contextKey: engine,
    specContext: ctx,
    gap,
    targetState: probe.targetState,
    proposalBatchId: proposalBatchId ?? null,
    attempt,
    mode,
    geometryTargets: resolvedGeometryTargets,
    ...(supportGeometryMode === undefined ? {} : { supportGeometryMode }),
    fit,
  });
  return {
    geometry,
    fit,
    ...(activeSiblingFit === undefined ? {} : { activeSiblingFit }),
    ...(resolutionSiblingFit === undefined ? {} : { resolutionSiblingFit }),
  };
}
