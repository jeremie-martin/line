/**
 * SearchNode for handoff-style prefix search.
 *
 * A node is a partial-track state at a gap boundary: which gaps have been
 * committed, what their fits are, what the engine state looks like, and
 * optionally a memoized candidate list for the next gap.
 *
 * Candidate count is a code constant or an explicit caller override. The handoff
 * caller DOES derive its override from the compile's target budget
 * (`budgetAwareQualitySampleCount`, optimizer/handoff.ts) - this module used to
 * claim otherwise, which is a dangerous thing to believe while debugging
 * reproducibility. What still holds, and is the property that matters: the
 * target budget is a per-compile constant, so the count never changes mid-node
 * and a compile stays deterministic in (spec, seed, budget). It is NOT constant
 * ACROSS budgets, and two budgets will walk different node sequences.
 */

import { makeRng } from "../../lib/rng.ts";
import { getRiderMetered } from "../../lib/detector.ts";
import {
  type GapFit,
  engineLineFromTrackLine,
} from "../core/substrate.ts";
import {
  sampleArcParamsRngDraws,
  readTargetStateFromRider,
} from "../arc_placement.ts";
import { solveOneGap, solveOneGapAttemptRange } from "./solver.ts";
import {
  aimEnumEnabled,
  aimTopKBasesEffective,
  makeEnumAimedCandidates,
  rankQualityEnabled,
  recordLaneBaseSkip,
  recordLanePoolRank,
  recordPoolAirSpread,
  recordRankQualityPool,
  sortCandidatesByQuality,
} from "./aim.ts";
import {
  type Candidate,
  type SpecContext,
} from "./sample.ts";
import {
  makeDetectorRunwayCandidates,
  recordDetectorRunwayPoolRanks,
} from "./contact_phase.ts";
import {
  makeContactTransitionCandidates,
  recordContactTransitionPoolRanks,
} from "./contact_transition.ts";
import type { Gap } from "./types.ts";

/** Default per-node candidate count. See file header. */
export const N_CAND = 32;

// Rollout aim-suppression (lookahead campaign). best:1:N rebuilds the rolled-level pool the same
// way as the top-level pool — INCLUDING the charged aim-lane probes ("the documented branch-widening
// failure", see below). This flag lets a rollout drop ONLY the aim probes (keeping the quality-rank)
// to isolate the value of wide branching from the cost of its probes. Set by the forward-eval rollout
// (setRolloutContext); the env knob LR_ROLLOUT_AIM=0 turns the suppression on.
let inRolloutContext = false;
const rolloutAimEnabled =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_ROLLOUT_AIM !== "0";
export function setRolloutContext(active: boolean): void {
  inRolloutContext = active;
}
// Scoped aim suppression for WIDENED rollout pool builds (nCand > 1 inside a
// rollout would otherwise qualify for the charged aim lane on EVERY prefix
// re-sort — a budget sink that stalls completion; baseline branch=1 rollout
// pools never contained aim candidates, so suppression preserves rollout
// semantics). Set around the pool build by forwardFirstWidenedScore.
let rolloutAimSuppressed = false;
export function setRolloutAimSuppressed(active: boolean): void {
  rolloutAimSuppressed = active;
}
/** Read the flag so a nested widened build (the rollout re-draw on empty) can
 *  restore the caller's state instead of assuming it was off. */
export function isRolloutAimSuppressed(): boolean {
  return rolloutAimSuppressed;
}

/**
 * Throttle the enumerative aiming lane while the compile is against its
 * deadline (optimizer/deadline.ts: `margin <= DEADLINE_MARGIN_FULL_PRESSURE`,
 * before first completion — see the Phase-1a boundary in handoff.ts).
 *
 * The lane fits a local response model by SIMULATING a probe design per base,
 * and it is the compiler's second largest lookahead spend after forward
 * evaluation: measured on `frontier_dense_recovery` at 250k it charges 42,859 of
 * 250,851 frames, 17% of the budget, on a compile that never finishes building
 * its track. Pacing the forward-eval width on the same signal was worth +10.66,
 * and the lane is held to the same rule.
 *
 * TWO LEVELS, never a gradient. The state is binary because the pool memo
 * (`node._candidatesCache`) is keyed on `(seed, nCand)` and not on the lane's
 * inputs, so a pool built in one state and returned frozen in the other makes
 * that node's content depend on WHEN it was first visited. A CONTINUOUS K would
 * make "the other state" mean "the margin moved at all" and expose ~265 stale
 * lane-sensitive reads per compile (phase0/h2-cache-transitions.md); grading K
 * waits for a cache-key fix.
 *
 * The binary form is not free of that hazard either, and the measurement is
 * what draws the current scope. Running the throttle for the whole compile put
 * 764 of 11,792 frozen reads (6.5%) at 150k and 540 of 36,456 (1.5%) at 750k
 * across the 44-source suite on the wrong side of a transition — ~9 and ~6 per
 * compile, essentially all of them in the repair and resumed passes, where a
 * restart re-reads a node the initial search already built. Holding the
 * throttle to the pre-completion phase (Phase 1a) all but removes it: on the
 * same 44x2 grid the count is 3 of 10,758 at 150k and 2 of 47,252 at 750k,
 * 0.03% and 0.004%, against the 0 of 895,457 the old pace signal measured over
 * 336 compiles — the residual is pre-completion and comes from the trigger
 * point moving, not from the phase.
 * Extending it past first completion is Phase 1b's, and needs the memo keyed on
 * this flag first. Note the failure mode either way is compositionality, not
 * reproducibility: the compile stays deterministic in (spec, seed, budget).
 */
let aimLaneDeadlineThrottled = false;
export function setAimLaneDeadlineThrottled(active: boolean): void {
  aimLaneDeadlineThrottled = active;
}

/**
 * Bases the throttled lane keeps, as a share of the unthrottled K.
 *
 * The rolled forward-eval head keeps `HANDOFF_FORWARD_EVAL_TOP` (2) of
 * `HANDOFF_CANDIDATE_POOL` (5) under full deadline pressure; the aim lane is
 * held to the same rule, so it keeps the same share of its bases. That lands on
 * accepted counts at both ends of the budget range rather than on a new tuned
 * number: K=4 -> 2 at 150k, K=7 -> 3 at 300k, K=18 -> 7 at 750k, and the floor
 * of 1 is the lane's own accepted scarce-budget policy
 * (`AIM_TOPK_MATURE_BUDGET_FRAMES`). It replaces a lane KILL, which is the one
 * shape the campaign's own rule forbids: throttle a magnitude, never trigger a
 * mode.
 *
 * The literal is asserted against `HANDOFF_FORWARD_EVAL_TOP /
 * HANDOFF_CANDIDATE_POOL` at handoff.ts module load (node.ts cannot import
 * handoff.ts without a cycle), so re-tuning either pool constant fails fast
 * instead of silently splitting the two consumers of the "same share" rule.
 */
export const AIM_LANE_DEADLINE_BASE_SHARE = 2 / 5;

function aimLaneBases(kEffective: number): number {
  return aimLaneDeadlineThrottled
    ? Math.max(1, Math.round(kEffective * AIM_LANE_DEADLINE_BASE_SHARE))
    : kEffective;
}

/**
 * Debug-only guard for the hazard the two-level throttle rides on.
 *
 * Exposure is a distributional property, not a structural one — the throttled
 * caller asks at the largest nCand in the compile, so it USUALLY lands on a
 * rebuilding path — which is exactly why it is counted rather than argued.
 * Production reads nothing: `LR_DEADLINE_CACHE_ASSERT` is sampled once at
 * module load and the map is only written under it.
 */
const deadlineCacheAssertEnabled =
  (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env?.LR_DEADLINE_CACHE_ASSERT === "1";
const laneStateAtBuild = new WeakMap<object, boolean>();
let deadlineCacheStats = { frozenReads: 0, crossStateReads: 0 };

/** Frozen-content reads and how many of them crossed a throttle transition. */
export function deadlineCacheAssertStats(): { frozenReads: number; crossStateReads: number } {
  return { ...deadlineCacheStats };
}

export function resetDeadlineCacheAssertStats(): void {
  deadlineCacheStats = { frozenReads: 0, crossStateReads: 0 };
}

/** Generation-time raw-normal snapshot for observation studies. The callback
 * runs after an ordinary attempt prefix is created or extended, before the
 * current pool's lane extras and ranking. Observers that retain historical
 * hashes own them before later traversal can mutate a selected candidate
 * object. Production never installs one. */
export type NormalPoolSnapshotRecord = {
  node: SearchNode;
  seed: number;
  gapIndex: number;
  nCand: number;
  sampleOrder: readonly Candidate[];
};
type NormalPoolSnapshotHook = (record: NormalPoolSnapshotRecord) => void;
let normalPoolSnapshotHook: NormalPoolSnapshotHook | null = null;
export function setNormalPoolSnapshotHook(hook: NormalPoolSnapshotHook | null): void {
  normalPoolSnapshotHook = hook;
}

/** A node in the prefix-search tree. `prefixFits.length === gapIndex`.
 *  A terminal node has `gapIndex === gaps.length`. */
export type SearchNode = {
  /** Number of gaps committed so far (0..gaps.length). */
  gapIndex: number;
  /** Per-gap committed fits, in gap order. Tail/non-contact gaps are null. */
  prefixFits: (GapFit | null)[];
  /** Engine state after applying prefixFits. */
  // deno-lint-ignore no-explicit-any
  prefixEngine: any;
  /** Next available line ID for the next gap's candidates. */
  prefixNextLineId: number;
  /** Sum of per-gap cost over committed fits. The register decides returned
   *  outputs via the final report comparator, not this local score. */
  cumulativeCost: number;
  /** Memoized cost-sorted candidate list at this gap. Populated on
   *  first access via `getCandidatesSorted`. The count is tracked because the
   *  handoff compiler normally asks for a cheap prefix, but may later ask for a
   *  larger deterministic prefix when a required contact would otherwise be
   *  skipped. */
  _candidatesCache: {
    seed: number;
    nCand: number;
    sampleOrder: Candidate[];
    candidates: Candidate[];
  } | null;
  /** Optional memoized child nodes for repeated extension of the same parent by
   *  the same sampled candidate. This lets lookahead and later expansion share
   *  any candidate cache acquired by the child, without changing candidate order. */
  _childrenCache?: { byCandidate: WeakMap<Candidate, SearchNode>; nullChild: SearchNode | null };
};

/** Construct the root node for a compile. */
export function makeRootNode(
  // deno-lint-ignore no-explicit-any
  initialEngine: any,
  numGaps: number,
): SearchNode {
  return {
    gapIndex: 0,
    prefixFits: [],
    prefixEngine: initialEngine,
    prefixNextLineId: 1,
    cumulativeCost: 0,
    _candidatesCache: null,
    _childrenCache: undefined,
  };
}

/** Sample candidates at this node's gap and return them
 *  sorted by cost ascending. Memoized — first call computes,
 *  subsequent calls return the cached list. Returns empty if the
 *  gap is non-contact (no commit needed) or if all candidates fail
 *  hard gates. */
export function getCandidatesSorted(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  /** Number of candidates to sample at this gap. Defaults to N_CAND. The handoff
   *  search passes a smaller value: it only
   *  ranks a pool of ~5-8 by feasibility and branches 3-wide, so generating the
   *  full 32 is mostly wasted per-node work — the dominant cost that starves its
   *  bounded-budget exploration. By the prefix property of `solveOneGap`, a
   *  smaller count is a deterministic prefix of the full sample order, so the
   *  cheaper pool stays a subset of the richer one (same seed → same samples). */
  nCand: number = N_CAND,
): Candidate[] {
  if (!Number.isInteger(nCand) || nCand < 0) {
    throw new Error(`getCandidatesSorted: nCand must be a non-negative integer, got ${nCand}`);
  }
  if (
    node._candidatesCache !== null &&
    node._candidatesCache.seed === seed &&
    node._candidatesCache.nCand === nCand
  ) {
    if (deadlineCacheAssertEnabled) noteFrozenRead(node._candidatesCache);
    return node._candidatesCache.candidates;
  }
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) {
    node._candidatesCache = { seed, nCand, sampleOrder: [], candidates: [] };
    return [];
  }
  // Fresh per-gap RNG. Determined
  // by (seed, gapIndex), not by anything budget-touches. `Math.imul` keeps the
  // mix in exact int32 arithmetic so large seeds can't lose precision or
  // collide (the plain `*` overflowed past 2^53 for big seeds — review #10).
  // Byte-identical to the old `(seed|0)*1000003 + …` for int32-range seeds.
  const perGapRng = makeRng((Math.imul(seed | 0, 1000003) + node.gapIndex + 1) | 0);
  const cached = node._candidatesCache;
  if (cached !== null && cached.seed === seed && cached.nCand > nCand) {
    return sortWithLaneExtras(
      node, gaps, ctx, gap, nCand, samplePrefix(cached.sampleOrder, nCand),
    );
  }
  const sampleOrder = cached !== null && cached.seed === seed && cached.nCand < nCand
    ? [
      ...cached.sampleOrder,
      ...solveAdditionalCandidates(
        node.prefixEngine, gap, perGapRng, cached.nCand, nCand, ctx, node.prefixNextLineId,
        seed,
      ),
    ]
    : solveOneGap(
      node.prefixEngine, gap, perGapRng, nCand, ctx, node.prefixNextLineId,
      seed,
    );
  normalPoolSnapshotHook?.({ node, seed, gapIndex: gap.index, nCand, sampleOrder });
  const sorted = sortWithLaneExtras(node, gaps, ctx, gap, nCand, sampleOrder);
  node._candidatesCache = { seed, nCand, sampleOrder, candidates: sorted };
  if (deadlineCacheAssertEnabled) {
    laneStateAtBuild.set(node._candidatesCache, aimLaneDeadlineThrottled);
  }
  return sorted;
}

function noteFrozenRead(cache: object): void {
  deadlineCacheStats.frozenReads++;
  const built = laneStateAtBuild.get(cache);
  if (built !== undefined && built !== aimLaneDeadlineThrottled) {
    deadlineCacheStats.crossStateReads++;
  }
}

function sortWithLaneExtras(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  gap: Gap,
  nCand: number,
  sampleOrder: Candidate[],
): Candidate[] {
  let sorted = sortCandidatesByCost(sampleOrder);
  // QUALITY-OBJECTIVE POOL SORT (LR_RANK_QUALITY, default on): rank the pool by
  // the shared objective (achieved-axis-quality × composite next-gap readiness)
  // before the lane runs, so the lane refines the
  // quality-best base, not the cost-best one (the aim lane still runs on
  // `sorted[0]` of this ordering).
  const rankQuality = rankQualityEnabled();
  const costOrder = sorted;
  if (rankQuality && sorted.length > 0) {
    // record=false: telemetry is recorded once per pool build on the FINAL
    // ordering — by the merged re-sort below when lane extras exist, else by
    // the explicit recordRankQualityPool call.
    sorted = sortCandidatesByQuality(node.prefixEngine, gap, gaps, sorted, false, ctx);
  }
  // The enumerative proposer (the ONE aiming lane — optimizer/aim.ts):
  // model-proposed candidates competing on cost like any other.
  // `sampleOrder` stays the pure attempt prefix (prefix property untouched);
  // lane candidates live only in the sorted pool of the nCand that built
  // them. nCand > 1 keeps the lane's PROBES out of forward-eval rollout
  // pools (branch=1): multiplying CHARGED rollout work is the documented
  // branch-widening failure.
  const aimedExtras: Candidate[] = [];
  if (
    nCand > 1 && sorted.length > 0 && aimEnumEnabled() &&
    !(inRolloutContext && (!rolloutAimEnabled || rolloutAimSuppressed))
  ) {
    // Refine the first K candidates of the quality-sorted pool, not just
    // `sorted[0]`. Each base is passed exactly as `sorted[0]` is today (same
    // engine/gap/lineId), and its extras accumulate into the one pool. K=1 →
    // a single iteration on sorted[0] (byte-identical).
    // The pool elements are distinct candidates; only K exceeding the pool length
    // forces a skip (counted). lineId start stays node.prefixNextLineId for every
    // base — each candidate is a self-contained line set that competes in the
    // pool (only one wins per branch), so reusing the start id is safe; the merge
    // re-sort ranks all extras from all bases together.
    // K is gated on compile maturity and low-air targets (aimTopKBasesEffective):
    // below the budget threshold this is 1; low-air mature gaps keep K=3. A
    // compile against its deadline keeps only a share of those bases
    // (aimLaneBases) rather than losing the lane.
    const kEff = aimLaneBases(aimTopKBasesEffective(gap, gaps, ctx));
    const bases = Math.min(kEff, sorted.length);
    for (let b = 0; b < kEff; b++) {
      if (b >= bases) { recordLaneBaseSkip(); continue; }
      aimedExtras.push(...makeEnumAimedCandidates(
        node.prefixEngine, gap, gaps, ctx, sorted[b], node.prefixNextLineId,
        true,
        b === 0,
      ));
    }
  }
  // Tight authored intervals have only one or two frames of detector runway
  // slack. Two state-relative swept catches cover that contact phase without
  // replacing any sampled candidate or multiplying rollout work.
  const runwayExtras = nCand > 1 && !inRolloutContext
    ? makeDetectorRunwayCandidates(
      node.prefixEngine,
      gap,
      gaps,
      ctx,
      node.prefixNextLineId,
      [...sampleOrder, ...aimedExtras],
    )
    : [];
  const contactTransitionExtras = nCand > 1 && !inRolloutContext
    ? makeContactTransitionCandidates(
      node.prefixEngine,
      gap,
      gaps,
      ctx,
      node.prefixNextLineId,
      [...sampleOrder, ...aimedExtras, ...runwayExtras],
    )
    : [];
  const laneExtras = [...aimedExtras, ...runwayExtras, ...contactTransitionExtras];
  if (laneExtras.length > 0) {
    // Re-sort the full pool (sampled + lane extras). With the quality sort on
    // the judge is the quality objective; with it off, cost, bit-identically.
    sorted = rankQuality
      ? sortCandidatesByQuality(
        node.prefixEngine, gap, gaps, sortCandidatesByCost([...sampleOrder, ...laneExtras]), true, ctx,
      )
      : sortCandidatesByCost([...sampleOrder, ...laneExtras]);
    // Selection-rank telemetry: where each lane extra landed in the sorted
    // pool (reference-identity lookup; pure read after the sort completes,
    // so it cannot perturb candidate order). Recorded once per pool build.
    for (const extra of aimedExtras) {
      recordLanePoolRank("aimed", sorted.indexOf(extra), sorted.length);
    }
  } else if (rankQuality && costOrder.length > 0) {
    // No merged re-sort happened: the pre-lane ordering is final — record it.
    recordRankQualityPool(costOrder, sorted);
    recordPoolAirSpread(gap, gaps, sorted, ctx);
  }
  recordDetectorRunwayPoolRanks(runwayExtras, sorted);
  recordContactTransitionPoolRanks(contactTransitionExtras, sorted);
  return sorted;
}

function samplePrefix(sampleOrder: Candidate[], nCand: number): Candidate[] {
  return sampleOrder.filter((candidate) => {
    const attempt = candidate.sampleAttempt;
    return attempt !== undefined && attempt < nCand;
  });
}

function sortCandidatesByCost(sampleOrder: Candidate[]): Candidate[] {
  // Sort by cost ascending. Stable sort: ties keep sample-order.
  return [...sampleOrder].sort((a, b) => a.cost - b.cost);
}

function solveAdditionalCandidates(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  rng: () => number,
  attemptStart: number,
  attemptEnd: number,
  ctx: SpecContext,
  lineIdStart: number,
  proposalBatchId: number,
): Candidate[] {
  advanceCandidateRng(engine, gap, rng, attemptStart);
  return solveOneGapAttemptRange(
    engine,
    gap,
    rng,
    attemptStart,
    attemptEnd,
    ctx,
    lineIdStart,
    proposalBatchId,
  );
}

function advanceCandidateRng(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  rng: () => number,
  attempts: number,
): void {
  if (attempts <= 0) return;
  const rider = getRiderMetered(engine, gap.endFrame);
  const targetState = readTargetStateFromRider(rider, rider.position.x, rider.position.y);
  for (let attempt = 0; attempt < attempts; attempt++) {
    const draws = sampleArcParamsRngDraws(targetState, gap, attempt);
    for (let draw = 0; draw < draws; draw++) rng();
  }
}

/** Extend a node by committing the given candidate (or null for a
 *  non-contact gap). Returns a new SearchNode advanced by one gap.
 *  Does not mutate the input node. */
export function extendNode(
  parent: SearchNode,
  candidate: Candidate | null,
): SearchNode {
  if (candidate === null) {
    // Non-contact gap: no engine change, just advance the index.
    return {
      gapIndex: parent.gapIndex + 1,
      prefixFits: [...parent.prefixFits, null],
      prefixEngine: parent.prefixEngine,
      prefixNextLineId: parent.prefixNextLineId,
      cumulativeCost: parent.cumulativeCost,
      _candidatesCache: null,
      _childrenCache: undefined,
    };
  }
  // Extend the engine with the candidate's whole arc in one call (addLine
  // accepts an array — same result as adding line-by-line).
  const newEngine = parent.prefixEngine.addLine(
    candidate.lines.map((line) => engineLineFromTrackLine(line)),
  );
  return {
    gapIndex: parent.gapIndex + 1,
    prefixFits: [...parent.prefixFits, candidate],
    prefixEngine: newEngine,
    prefixNextLineId: parent.prefixNextLineId + candidate.lines.length,
    cumulativeCost: parent.cumulativeCost + candidate.cost,
    _candidatesCache: null,
    _childrenCache: undefined,
  };
}

/** Cached form of `extendNode` for search code that may revisit the same
 *  parent/candidate edge during fixed lookahead and later real expansion. */
export function extendNodeCached(
  parent: SearchNode,
  candidate: Candidate | null,
): SearchNode {
  const cache = parent._childrenCache ??= {
    byCandidate: new WeakMap<Candidate, SearchNode>(),
    nullChild: null,
  };
  if (candidate === null) {
    if (cache.nullChild === null) cache.nullChild = extendNode(parent, null);
    return cache.nullChild;
  }
  const cached = cache.byCandidate.get(candidate);
  if (cached !== undefined) return cached;
  const child = extendNode(parent, candidate);
  cache.byCandidate.set(candidate, child);
  return child;
}

/** True iff the node represents a complete partial-track (all gaps
 *  processed). The node's prefixEngine is the final engine state. */
export function isLeafNode(node: SearchNode, numGaps: number): boolean {
  return node.gapIndex >= numGaps;
}
