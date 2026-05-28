/**
 * Stage 1 — limited-discrepancy leaf enumeration (Harvey-Ginsberg).
 *
 * Definitions:
 *
 *   - Discrepancy of a path = sum of ranks chosen at the contact
 *     gaps. Rank 0 is the cheapest surviving candidate (the greedy
 *     choice); rank ≥ 1 is a "deviation".
 *   - A leaf at discrepancy D = a complete path whose ranks sum to
 *     exactly D.
 *   - `enumerateLeaves(root, maxDiscrepancy)` yields leaves in
 *     increasing-discrepancy order: all leaves at D=0 (one — the
 *     greedy track), then all at D=1, then D=2, ..., up to maxD.
 *
 * The crucial structural property: for any maxD' >= maxD,
 * `leaves(maxD') ⊇ leaves(maxD)` because we only ADD discrepancy
 * levels at the end. This is the substrate for Property 1
 * (monotonicity-in-budget): budget = "longest prefix of E that fits"
 * = "iterate leaves in this order, stop when budget runs out".
 *
 * Non-contact gaps (tail gap, gaps between sections without a
 * closing Contact) pass through with no rank choice and no
 * discrepancy contribution.
 *
 * Determinism: traversal order is fully fixed by (maxD, num_gaps,
 * N_CAND, per-node sorted candidate list). Per-node candidate list
 * is itself deterministic given (seed, gap_index, prefix engine
 * state) which depends only on (spec, seed). So same (spec, seed)
 * → identical E for any maxD.
 */

import {
  extendNode,
  getCandidatesSorted,
  isLeafNode,
  type SearchNode,
} from "./node.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type { Gap } from "./types.ts";

/** A leaf of the LDS search tree. The `prefixFits` is the complete
 *  fit-array, `prefixEngine` is the final engine, and `ranks` records
 *  the rank chosen at each contact gap (rank 0 = greedy). */
export type Leaf = {
  fits: (SearchNode["prefixFits"][number])[];
  // deno-lint-ignore no-explicit-any
  engine: any;
  ranks: number[]; // length = number of contact gaps; entry per contact gap in order
  discrepancy: number; // sum of ranks
  cumulativeCost: number;
};

/** Enumerate leaves in increasing-discrepancy order. Yields one
 *  leaf at a time; the caller is responsible for scoring + registry.
 *
 *  Two safety bounds for the recursion:
 *   - `maxDiscrepancy`: total ranks summed across all gaps ≤ this.
 *   - Per-gap rank cap: implicit from `candidates.length` (sorted
 *     candidate pool from node.ts; size ≤ N_CAND).
 *
 *  Memoization: shared-prefix candidate lists are cached internally
 *  by the rank-path-signature. Without this, d=2 enumeration on
 *  even small specs re-samples gap-0 candidates dozens of times.
 *  The cache is per-call (one map per enumerateLeaves invocation).
 *
 *  The enumeration is exhaustive within `maxDiscrepancy`. For a real
 *  budgeted compile (Stage 2), the caller wraps this generator and
 *  stops when sim_frames exhausts the budget. */
export function* enumerateLeaves(
  root: SearchNode,
  maxDiscrepancy: number,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
): Generator<Leaf> {
  // Shared-prefix candidate memoization. Key = contact-rank-sequence
  // of committed gaps so far (the unique path identifier; non-contact
  // gaps don't contribute since they have no rank choice). Value =
  // the cost-sorted candidate list at the NEXT contact gap from that
  // path. Computed once per distinct prefix; reused across all leaves
  // that visit it. Without this, d=2 enumeration on small specs
  // re-samples gap-0 candidates dozens of times.
  const candCache = new Map<string, Candidate[]>();

  function getCandidatesCached(
    node: SearchNode,
    pathRanks: number[],
  ): Candidate[] {
    const key = pathRanks.join(",");
    const cached = candCache.get(key);
    if (cached !== undefined) return cached;
    const sorted = getCandidatesSorted(node, gaps, ctx, seed);
    candCache.set(key, sorted);
    return sorted;
  }

  for (let d = 0; d <= maxDiscrepancy; d++) {
    yield* enumerateAtExactly(
      root,
      d,
      [],
      [],
      gaps,
      ctx,
      seed,
      getCandidatesCached,
    );
  }
}

/** Yield exactly the leaves whose ranks-down-this-path sum to
 *  `exactBudget`. Recursive DFS. Helper for `enumerateLeaves`.
 *
 *  Two rank lists are passed: `contactRanks` (only the contact
 *  gaps' rank choices, used as the memo key) and `allRanks` (the
 *  per-gap rank sequence for the resulting Leaf; non-contact gaps
 *  contribute a 0). */
function* enumerateAtExactly(
  node: SearchNode,
  exactBudget: number,
  contactRanks: number[],
  allRanks: number[],
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  getCandidatesCached: (
    node: SearchNode,
    pathRanks: number[],
  ) => Candidate[],
): Generator<Leaf> {
  if (isLeafNode(node, gaps.length)) {
    if (exactBudget === 0) {
      yield {
        fits: node.prefixFits,
        engine: node.prefixEngine,
        ranks: allRanks,
        discrepancy: allRanks.reduce((s, r) => s + r, 0),
        cumulativeCost: node.cumulativeCost,
      };
    }
    return;
  }

  if (!gaps[node.gapIndex].endsWithContact) {
    const child = extendNode(node, null);
    yield* enumerateAtExactly(
      child, exactBudget, contactRanks, [...allRanks, 0],
      gaps, ctx, seed, getCandidatesCached,
    );
    return;
  }

  const candidates = getCandidatesCached(node, contactRanks);
  if (candidates.length === 0) return;
  const maxRank = Math.min(candidates.length - 1, exactBudget);
  for (let r = 0; r <= maxRank; r++) {
    const child = extendNode(node, candidates[r]);
    yield* enumerateAtExactly(
      child,
      exactBudget - r,
      [...contactRanks, r],
      [...allRanks, r],
      gaps, ctx, seed, getCandidatesCached,
    );
  }
}
