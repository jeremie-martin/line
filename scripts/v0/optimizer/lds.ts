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
import { getSimFrames } from "./sim_frames.ts";
import type { Candidate, SpecContext } from "./sample.ts";
import type { Gap } from "./types.ts";
import { CALIB } from "../types.ts";

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

/** Sentinel in a base-commit-path entry: this contact gap was SKIPPED
 *  (no viable candidate survived backtracking) — committed as a null fit,
 *  engine unchanged, so the base path still reaches end-of-spec. Mirrors
 *  legacy `compile()`'s `gapFailures` continue-past behaviour. */
export const SKIP = -1;

/** Build the deterministic backtracking base path — the d=0 leaf.
 *
 *  This replaces the naive rank-0 descent (which silently dies at the first
 *  0-candidate contact gap, e.g. drums_signature gap 36). It descends
 *  committing the lowest-cost candidate at each contact gap; on a downstream
 *  dead-end (0 candidates, or all candidates tried) it backtracks up to
 *  `CALIB.BACKTRACK_DEPTH` earlier contact gaps and tries their next
 *  candidate; if the backtrack budget for a failure is exhausted it SKIPS the
 *  failing gap (null fit, forward progress guaranteed). The first complete
 *  path found is returned, along with `baseCommitPath` — the committed sorted
 *  candidate index at each contact gap (or `SKIP`). This is the LDS search's
 *  own completion guarantee; only THIS base path needs to complete, deviations
 *  (d>=1) are free to dead-end because the register already holds it.
 *
 *  Determinism: candidate lists come from `getCandidatesSorted`, a pure
 *  function of (seed, gapIndex, prefix engine) — the per-gap RNG is seeded by
 *  (seed, gapIndex) only (node.ts), independent of revisit count. Same
 *  (spec, seed) -> identical base path. Budget-exempt by design: the floor
 *  must always complete (like the legacy floor it replaces), so there is no
 *  `getSimFrames()` cutoff inside this descent.
 *
 *  Returns null only if no complete path exists at all (then `compileLDS`
 *  surfaces the existing "no leaf reached end-of-spec" error). */
export function buildBacktrackingLeaf(
  root: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
): { leaf: Leaf; baseCommitPath: number[] } | null {
  type FrameKind = "leaf" | "noncontact" | "contact" | "skip";
  type Frame = {
    node: SearchNode;
    kind: FrameKind;
    cands: Candidate[];
    /** Contact: index of the NEXT candidate to try (committed = tried-1 after
     *  advancing). Non-contact/skip: 0->1 progress flag. */
    tried: number;
  };

  const makeFrame = (node: SearchNode): Frame => {
    if (isLeafNode(node, gaps.length)) return { node, kind: "leaf", cands: [], tried: 0 };
    if (!gaps[node.gapIndex].endsWithContact) return { node, kind: "noncontact", cands: [], tried: 0 };
    return { node, kind: "contact", cands: getCandidatesSorted(node, gaps, ctx, seed), tried: 0 };
  };

  const MAX_BT = CALIB.BACKTRACK_DEPTH;
  // Global step cap — a hard termination guarantee against pathological
  // re-failure (committing an earlier candidate that re-triggers the same
  // downstream failure). Beyond it we stop backtracking and force a forward
  // skip-march (rank-0-or-skip) to a leaf, which terminates in <= gaps.length.
  const STEP_CAP = (gaps.length + 1) * (MAX_BT + 2) * 64 + 256;

  const nContacts = gaps.filter((g) => g.endsWithContact).length;

  const stack: Frame[] = [makeFrame(root)];
  let failureStartIdx = -1; // gapIndex where the current failure episode began
  let backtracksUsed = 0;
  let steps = 0;
  let forceSkip = false; // tripped by STEP_CAP / full unwind — never backtrack again

  while (stack.length > 0) {
    if (++steps > STEP_CAP) forceSkip = true;
    const top = stack[stack.length - 1];

    if (top.kind === "leaf") {
      const path: number[] = [];
      for (const f of stack) {
        if (f.kind === "contact") path.push(f.tried - 1);
        else if (f.kind === "skip") path.push(SKIP);
      }
      const leaf: Leaf = {
        fits: top.node.prefixFits,
        engine: top.node.prefixEngine,
        ranks: new Array(nContacts).fill(0), // base path = local-rank 0 everywhere
        discrepancy: 0,
        cumulativeCost: top.node.cumulativeCost,
      };
      return { leaf, baseCommitPath: path };
    }

    if (top.kind === "noncontact") {
      if (top.tried === 0) {
        top.tried = 1;
        stack.push(makeFrame(extendNode(top.node, null)));
      } else {
        stack.pop(); // only one way through a non-contact gap; unwind
      }
      continue;
    }

    if (top.kind === "skip") {
      stack.pop(); // a committed skip has one continuation; if back here, unwind further
      continue;
    }

    // contact gap
    if (top.tried < top.cands.length && !(forceSkip && top.tried > 0)) {
      // commit the next candidate (lowest cost first). Under forceSkip we take
      // rank 0 if present (best effort) but never retry a higher rank.
      const cand = top.cands[top.tried];
      top.tried++;
      if (failureStartIdx !== -1 && top.node.gapIndex >= failureStartIdx) {
        failureStartIdx = -1; // forward progress past the failure gap — reset episode
        backtracksUsed = 0;
      }
      stack.push(makeFrame(extendNode(top.node, cand)));
      continue;
    }

    // contact exhausted (0 candidates, or all tried)
    if (!forceSkip) {
      if (failureStartIdx === -1) {
        failureStartIdx = top.node.gapIndex;
        backtracksUsed = 0;
      }
      if (backtracksUsed < MAX_BT) {
        // backtrack: discard this subtree, pop to the nearest earlier contact
        // frame with an untried candidate (this also resets all gaps between).
        stack.pop();
        while (stack.length > 0) {
          const f = stack[stack.length - 1];
          if (f.kind === "contact" && f.tried < f.cands.length) break;
          stack.pop();
        }
        if (stack.length === 0) {
          forceSkip = true; // no untried candidate anywhere — fall back to skip-march
          stack.push(makeFrame(root));
          continue;
        }
        backtracksUsed++;
        continue;
      }
    }
    // skip this contact gap (commit null, advance) — guarantees forward progress
    const child = extendNode(top.node, null);
    stack.pop();
    stack.push({ node: top.node, kind: "skip", cands: [], tried: 1 });
    stack.push(makeFrame(child));
    failureStartIdx = -1;
    backtracksUsed = 0;
  }
  return null;
}

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
  /** Stop expanding nodes once `getSimFrames() >= budgetUnits`. Without this,
   *  a budget check only at yielded leaves lets dead-end-heavy specs (e.g.
   *  drums, whose rank-0 descent dies at a 0-candidate gap) explore many
   *  dead-end paths BETWEEN yields, overshooting the budget by 2-3×. Checking
   *  inside the recursion bounds overshoot to ~one node's candidate sampling.
   *  The cutoff is still a pure function of the budget, and the enumeration
   *  ORDER is unchanged — so monotonicity-in-budget is preserved (a larger
   *  budget expands a superset). Default Infinity (exhaustive to maxD). */
  budgetUnits = Infinity,
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
    if (getSimFrames() >= budgetUnits) return;
    yield* enumerateAtExactly(
      root,
      d,
      [],
      [],
      gaps,
      ctx,
      seed,
      getCandidatesCached,
      budgetUnits,
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
  budgetUnits: number,
): Generator<Leaf> {
  // Finer-grained budget cutoff: stop expanding once the budget is spent, so
  // dead-end exploration between yields can't overshoot. Bounds overshoot to
  // ~one node's candidate sampling.
  if (getSimFrames() >= budgetUnits) return;
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
      gaps, ctx, seed, getCandidatesCached, budgetUnits,
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
      gaps, ctx, seed, getCandidatesCached, budgetUnits,
    );
  }
}
