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
import type { Candidate, SpecContext } from "./sample.ts";
import type { Gap } from "./types.ts";

/** Default per-node candidate count. See file header. */
export const N_CAND = 32;

/** Orders a gap's freshly-sampled candidate list (sample order) into the
 *  ranked list whose index 0 is "rank 0 / greedy". Taking the orderer as a
 *  parameter lets the LDS floor and the reach-guided descent (`scripts/v0/reach/`)
 *  share ONE descent implementation: LDS passes the default cost-sort; reach
 *  passes a forward-lookahead orderer that can re-rank a doomed cheapest
 *  hand-off by simulating the NEXT gap from each candidate's exit engine.
 *
 *  The orderer receives the node (its `prefixEngine` is the exit state to
 *  fork), the gaps, ctx and seed (so a lookahead probe uses the canonical
 *  next-gap RNG → deterministic). Two invariants it MUST uphold, neither
 *  expressible in the type:
 *    1. REORDER-ONLY — it returns a permutation of the SAME candidates; it never
 *       adds, drops, or mutates one. Adding/dropping would corrupt the LDS
 *       discrepancy semantics (rank 0 = greedy, rank k = k deviations) and the
 *       monotonicity prefix-superset proof that every descent over this hook
 *       relies on.
 *    2. BUDGET-INDEPENDENT — pure function of (spec, seed) + node state, never of
 *       the budget. Any simulation it does charges sim-frames automatically
 *       (cheat-resistance); it must not READ getSimFrames()/remaining budget. */
export type CandidateOrderer = (
  candidates: Candidate[],
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
) => Candidate[];

/** The default orderer: stable sort by pure axis `cost` ascending —
 *  byte-identical to the historical `sort((a, b) => a.cost - b.cost)`. */
export const costOrderer: CandidateOrderer = (candidates) =>
  [...candidates].sort((a, b) => a.cost - b.cost);

/** The canonical per-gap RNG: deterministic in (seed, gapIndex) only, never in
 *  anything the budget touches. `Math.imul` keeps the mix in exact int32
 *  arithmetic so large seeds can't lose precision or collide (the plain `*`
 *  overflowed past 2^53 for big seeds — review #10); byte-identical to the old
 *  `(seed|0)*1000003 + …` for int32-range seeds. SINGLE source of truth: the
 *  real per-gap sampler (`getCandidatesSorted`) and any lookahead probe
 *  (`reach/rank.ts`) both call this, so a probe samples EXACTLY the candidates
 *  the real expansion of that gap will. */
export function perGapRng(seed: number, gapIndex: number): () => number {
  return makeRng((Math.imul(seed | 0, 1000003) + gapIndex + 1) | 0);
}

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
  /** Memoized ORDERED candidate list at this gap, tagged with the orderer that
   *  produced it. Tagging makes the cache orderer-safe: if `getCandidatesSorted`
   *  is called on the same node with a DIFFERENT orderer, the stale list is not
   *  returned — the ordering is recomputed (cheaply, from `_sampleCache`). */
  _candidatesCache: { orderer: CandidateOrderer; list: Candidate[] } | null;
  /** Memoized UNORDERED sample (the expensive `solveOneGap` result). Orderer-
   *  independent — a pure function of (prefixEngine, gap, seed, gapIndex) — so it
   *  is reused across orderers on the same node; only the cheap reordering re-runs. */
  _sampleCache: Candidate[] | null;
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
    _sampleCache: null,
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
  orderer: CandidateOrderer = costOrderer,
): Candidate[] {
  // Orderer-safe memo: only reuse the cached list if THIS orderer produced it.
  const cached = node._candidatesCache;
  if (cached !== null && cached.orderer === orderer) return cached.list;
  const gap = gaps[node.gapIndex];
  if (!gap.endsWithContact) {
    node._candidatesCache = { orderer, list: [] };
    return [];
  }
  // Sample once per node (expensive: a forward sim per candidate). The sample is
  // orderer-independent, so reuse it when a second orderer visits this node.
  let samples = node._sampleCache;
  if (samples === null) {
    samples = solveOneGap(
      node.prefixEngine, gap, perGapRng(seed, node.gapIndex), N_CAND, ctx, node.prefixNextLineId,
    );
    node._sampleCache = samples;
  }
  // Order the sampled candidates (default = stable cost-sort, byte-identical to
  // the historical `(a, b) => a.cost - b.cost`). The reach orderer may re-rank a
  // doomed cheapest hand-off via next-gap lookahead.
  const sorted = orderer(samples, node, gaps, ctx, seed);
  node._candidatesCache = { orderer, list: sorted };
  return sorted;
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
      _sampleCache: null,
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
    _sampleCache: null,
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
  orderer: CandidateOrderer = costOrderer,
): SearchNode | null {
  if (!gaps[node.gapIndex].endsWithContact) {
    return extendNode(node, null);
  }
  const sorted = getCandidatesSorted(node, gaps, ctx, seed, orderer);
  const best = pickLowestCost(sorted);
  if (best === null) return null;
  return extendNode(node, best);
}
