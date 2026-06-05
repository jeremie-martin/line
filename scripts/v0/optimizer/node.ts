/**
 * SearchNode for handoff-style prefix search.
 *
 * A node is a partial-track state at a gap boundary: which gaps have been
 * committed, what their fits are, what the engine state looks like, and
 * optionally a memoized candidate list for the next gap.
 *
 * Candidate count is a code constant or an explicit caller override, never a
 * budget-derived value. That keeps the search policy independent of budget;
 * budget only decides how far into the deterministic node sequence we get.
 */

import { makeRng } from "../../lib/rng.ts";
import { getRiderMetered } from "../../lib/detector.ts";
import {
  type GapFit,
  engineLineFromTrackLine,
} from "../core/substrate.ts";
import {
  sampleArcParamsRngDraws,
  readTargetState,
} from "../arc_placement.ts";
import { solveOneGap, solveOneGapAttemptRange } from "./solver.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type { Gap } from "./types.ts";

/** Default per-node candidate count. See file header. */
export const N_CAND = 32;

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
    return sortCandidatesByCost(samplePrefix(cached.sampleOrder, nCand));
  }
  const sampleOrder = cached !== null && cached.seed === seed && cached.nCand < nCand
    ? [
      ...cached.sampleOrder,
      ...solveAdditionalCandidates(
        node.prefixEngine, gap, perGapRng, cached.nCand, nCand, ctx, node.prefixNextLineId,
      ),
    ]
    : solveOneGap(
      node.prefixEngine, gap, perGapRng, nCand, ctx, node.prefixNextLineId,
    );
  const sorted = sortCandidatesByCost(sampleOrder);
  node._candidatesCache = { seed, nCand, sampleOrder, candidates: sorted };
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
): Candidate[] {
  advanceCandidateRng(engine, gap, rng, attemptStart);
  return solveOneGapAttemptRange(engine, gap, rng, attemptStart, attemptEnd, ctx, lineIdStart);
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
  const targetState = readTargetState(engine, gap.endFrame, rider.position.x, rider.position.y);
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
