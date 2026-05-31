/**
 * Stage 1 — SearchNode for LDS.
 *
 * A node is a partial-track state at a gap boundary: which gaps have
 * been committed, what their fits are, what the engine state looks
 * like, and (memoized lazily) the cost-ordered candidate list for the
 * next gap.
 *
 * The candidate list at each node is **fixed** (N_CAND samples in
 * sample order, then sorted by cost ascending). This is the unit
 * over which discrepancy is defined: rank 0 is greedy at this gap,
 * rank ≥ 1 is a deviation.
 *
 * `N_CAND` is a **fixed code constant**, not a budget knob. From the
 * K-sweep evidence (Step 4): N_CAND = 32 is the smallest value where
 * the cost-best candidate is reliably in the pool on every gap of
 * every golden spec. We default to 32; raising it is a code change
 * (re-baselined like any structural constant), never budget-fed.
 * This is the rule that keeps budget-monotonicity intact —
 * `N_CAND` does not change with the budget, so the leaf enumeration
 * `E` is identical for any two budgets.
 */

import { makeRng } from "../../lib/rng.ts";
import {
  type GapFit,
  engineLineFromTrackLine,
} from "../core/substrate.ts";
import { pickLowestCost, solveOneGap } from "./solver.ts";
import { sampleOneCandidate, type Candidate, type SpecContext } from "./sample.ts";
import type { Gap } from "./types.ts";

/** Default per-node candidate count. See file header. */
export const N_CAND = 32;

type CandidateAttemptCache = {
  attempts: number;
  sampleOrder: Candidate[];
  rng: () => number;
};

/** A node in the LDS search tree. `prefixFits.length === gapIndex`.
 *  A leaf has `gapIndex === gaps.length`. */
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
  /** Sum of per-gap cost over committed fits (rank-0 used by greedy
   *  heuristic comparison; the register decides answers via the
   *  full-track scorer, not this). */
  cumulativeCost: number;
  /** Memoized cost-sorted candidate list at this gap. Populated on
   *  first access via `getCandidatesSorted`. */
  _candidatesCache: Candidate[] | null;
  /** Prefix of the sample-order candidate stream. Handoff previews can fill this
   *  with a small K, then normal expansion continues the same stream to N_CAND. */
  _candidateAttemptCache: CandidateAttemptCache | null;
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
    _candidateAttemptCache: null,
  };
}

/** Sample N_CAND candidates at this node's gap and return them
 *  sorted by cost ascending. Memoized — first call computes,
 *  subsequent calls return the cached list. Returns empty if the
 *  gap is non-contact (no commit needed) or if all candidates fail
 *  hard gates. */
export function getCandidatesSorted(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
): Candidate[] {
  if (node._candidatesCache !== null) return node._candidatesCache;
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) {
    node._candidatesCache = [];
    return [];
  }
  let sampleOrder: Candidate[];
  if (node._candidateAttemptCache !== null) {
    sampleOrder = getCandidatePrefix(node, gaps, ctx, seed, N_CAND);
  } else {
    const rng = perGapRng(seed, node.gapIndex);
    const prefixFits = usesPrefixResidualTargets(ctx) ? node.prefixFits : undefined;
    sampleOrder = solveOneGap(
      node.prefixEngine, gap, rng, N_CAND, ctx, node.prefixNextLineId, prefixFits,
    );
    node._candidateAttemptCache = { attempts: N_CAND, sampleOrder, rng };
  }
  // Sort by cost ascending. Stable sort: ties keep sample-order.
  const sorted = [...sampleOrder].sort((a, b) => a.cost - b.cost);
  node._candidatesCache = sorted;
  return sorted;
}

/** Return the viable candidates from the first K deterministic attempts at this
 *  node's current gap, in sample order. Repeated calls with larger K extend the
 *  same stream instead of re-running the prefix attempts. */
export function getCandidatePrefix(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  K: number,
): Candidate[] {
  if (!Number.isInteger(K) || K < 0) {
    throw new Error(`getCandidatePrefix: K must be a non-negative integer, got ${K}`);
  }
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) return [];

  const cache = ensureCandidateAttemptCache(node, seed);
  const prefixFits = usesPrefixResidualTargets(ctx) ? node.prefixFits : undefined;
  while (cache.attempts < K) {
    const candidate = sampleOneCandidate(
      node.prefixEngine,
      gap,
      cache.rng,
      ctx,
      node.prefixNextLineId,
      cache.attempts,
      prefixFits,
    );
    if (candidate !== null) cache.sampleOrder.push(candidate);
    cache.attempts++;
  }
  return cache.sampleOrder;
}

function usesPrefixResidualTargets(ctx: SpecContext): boolean {
  return ctx.spec !== undefined && ctx.gaps !== undefined;
}

function ensureCandidateAttemptCache(node: SearchNode, seed: number): CandidateAttemptCache {
  if (node._candidateAttemptCache !== null) return node._candidateAttemptCache;
  const cache: CandidateAttemptCache = {
    attempts: 0,
    sampleOrder: [],
    rng: perGapRng(seed, node.gapIndex),
  };
  node._candidateAttemptCache = cache;
  return cache;
}

function perGapRng(seed: number, gapIndex: number): () => number {
  // Same scheme as legacy compile.ts. Determined by (seed, gapIndex), not by
  // anything budget-touches. `Math.imul` keeps the mix in exact int32 arithmetic.
  return makeRng((Math.imul(seed | 0, 1000003) + gapIndex + 1) | 0);
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
      _candidateAttemptCache: null,
    };
  }
  // Extend the engine with the candidate's lines.
  let newEngine = parent.prefixEngine;
  for (const line of candidate.lines) {
    newEngine = newEngine.addLine(engineLineFromTrackLine(line));
  }
  return {
    gapIndex: parent.gapIndex + 1,
    prefixFits: [...parent.prefixFits, candidate],
    prefixEngine: newEngine,
    prefixNextLineId: parent.prefixNextLineId + candidate.lines.length,
    cumulativeCost: parent.cumulativeCost + candidate.cost,
    _candidatesCache: null,
    _candidateAttemptCache: null,
  };
}

/** True iff the node represents a complete partial-track (all gaps
 *  processed). The node's prefixEngine is the final engine state. */
export function isLeafNode(node: SearchNode, numGaps: number): boolean {
  return node.gapIndex >= numGaps;
}

/** Convenience: the greedy-rank-0 child of a node, or null if no
 *  viable candidate exists at this gap. */
export function rank0Child(
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
): SearchNode | null {
  if (!gaps[node.gapIndex].endsWithContact) {
    return extendNode(node, null);
  }
  const sorted = getCandidatesSorted(node, gaps, ctx, seed);
  const best = pickLowestCost(sorted);
  if (best === null) return null;
  return extendNode(node, best);
}
