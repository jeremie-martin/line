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
import { detect, extractRawTrajectory } from "../../lib/detector.ts";
import {
  addMissedContactRetryOwners,
  contactLineIdsAt,
  findGapOwning,
  offBeatLandingEvents,
  type GapFit,
} from "../compile.ts";

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

/** Per-failure backtrack depth for the base-path descent. Higher than legacy's
 *  `CALIB.BACKTRACK_DEPTH` (2) because the optimizer's candidate generator
 *  samples from `gap.targets` directly — it lacks legacy `compile()`'s residual
 *  look-ahead targeting, so it relies on backtracking (exploring committed
 *  combinations) rather than look-ahead to find landable sequences on dense
 *  specs. Measured: depth 2 SKIPS 3 contacts on solo_run (fails, and thrashes —
 *  179k floor frames); depth 4 lands all 77 (passes, beats greedy_v1, and is
 *  CHEAPER at 68k frames because it resolves without thrashing). 8 gives margin;
 *  it is inert on specs that complete within depth 2 (drums, tiny_dance) and is
 *  bounded by the descent's global STEP_CAP. */
export const BASE_BACKTRACK_DEPTH = 8;

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
  /** Per-failure backtrack depth. Defaults to the calibrated constant; exposed
   *  so the descent's completion power can be probed/tuned without a spec-name
   *  branch. */
  maxBacktrack: number = BASE_BACKTRACK_DEPTH,
  /** Candidate-list cache keyed by the COMMITTED candidate-identity path (the
   *  absolute sorted-index, or "S" for a skip, at each contact gap so far). This
   *  is a SECOND memoization layer on top of `node._candidatesCache` (node.ts):
   *  the per-node cache serves an already-materialized node, while this keyed
   *  cache is reused across the FRESH nodes that backtracking re-descents and —
   *  when shared via `enumerateLeaves` — the deviation enumeration build for the
   *  same committed prefix (measured 23–50% hit rate in the deviation phase).
   *  Pass the SAME map used by `enumerateLeaves` to share it. Default: fresh. */
  candCache: Map<string, Candidate[]> = new Map(),
  /** Guided repair: sorted-candidate indices to EXCLUDE at specific gaps
   *  (gapIndex -> forbidden sorted-indices). The descent skips these when
   *  committing but otherwise backtracks normally to complete — so forcing an
   *  owning gap off its assembled-track-missing candidate lets the rest finish
   *  via backtracking (the base path passes an empty map → unchanged). */
  forbidden?: Map<number, Set<number>>,
): { leaf: Leaf; baseCommitPath: number[] } | null {
  type FrameKind = "leaf" | "noncontact" | "contact" | "skip";
  type Frame = {
    node: SearchNode;
    kind: FrameKind;
    cands: Candidate[];
    /** Contact: index of the NEXT candidate to try (committed = tried-1 after
     *  advancing). Non-contact/skip: 0->1 progress flag. */
    tried: number;
    /** Committed candidate-identity path of the PREFIX before this gap (cache
     *  key for this gap's candidate list). */
    committedKey: string;
  };

  const getCached = (node: SearchNode, key: string): Candidate[] => {
    const hit = candCache.get(key);
    if (hit !== undefined) return hit;
    const sorted = getCandidatesSorted(node, gaps, ctx, seed);
    candCache.set(key, sorted);
    return sorted;
  };

  const makeFrame = (node: SearchNode, committedKey: string): Frame => {
    if (isLeafNode(node, gaps.length)) return { node, kind: "leaf", cands: [], tried: 0, committedKey };
    if (!gaps[node.gapIndex].endsWithContact) return { node, kind: "noncontact", cands: [], tried: 0, committedKey };
    return { node, kind: "contact", cands: getCached(node, committedKey), tried: 0, committedKey };
  };

  const MAX_BT = maxBacktrack;
  // Global step cap — a hard termination guarantee against pathological
  // re-failure (committing an earlier candidate that re-triggers the same
  // downstream failure). Beyond it we stop backtracking and force a forward
  // skip-march (rank-0-or-skip) to a leaf, which terminates in <= gaps.length.
  const STEP_CAP = (gaps.length + 1) * (MAX_BT + 2) * 64 + 256;

  const stack: Frame[] = [makeFrame(root, "")];
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
        // base path = local-rank 0 at every gap; length = total gaps to match
        // enumerateDeviations' allRanks (one entry per gap, contact + non-contact).
        ranks: new Array(gaps.length).fill(0),
        discrepancy: 0,
        cumulativeCost: top.node.cumulativeCost,
      };
      return { leaf, baseCommitPath: path };
    }

    if (top.kind === "noncontact") {
      if (top.tried === 0) {
        top.tried = 1;
        stack.push(makeFrame(extendNode(top.node, null), top.committedKey));
      } else {
        stack.pop(); // only one way through a non-contact gap; unwind
      }
      continue;
    }

    if (top.kind === "skip") {
      stack.pop(); // a committed skip has one continuation; if back here, unwind further
      continue;
    }

    // contact gap. Skip any forbidden sorted-index (guided repair forces a gap
    // off its assembled-track-missing candidate) by advancing past it.
    const fb = forbidden?.get(top.node.gapIndex);
    if (fb) while (top.tried < top.cands.length && fb.has(top.tried)) top.tried++;
    if (top.tried < top.cands.length && !(forceSkip && top.tried > 0)) {
      // commit the next candidate (lowest cost first). Under forceSkip we take
      // rank 0 if present (best effort) but never retry a higher rank.
      const r = top.tried;
      const cand = top.cands[r];
      top.tried = r + 1;
      if (failureStartIdx !== -1 && top.node.gapIndex >= failureStartIdx) {
        failureStartIdx = -1; // forward progress past the failure gap — reset episode
        backtracksUsed = 0;
      }
      stack.push(makeFrame(extendNode(top.node, cand), top.committedKey + "," + r));
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
          if (f.kind === "contact") {
            const ffb = forbidden?.get(f.node.gapIndex);
            if (ffb) while (f.tried < f.cands.length && ffb.has(f.tried)) f.tried++;
            if (f.tried < f.cands.length) break;
          }
          stack.pop();
        }
        if (stack.length === 0) {
          forceSkip = true; // no untried candidate anywhere — fall back to skip-march
          stack.push(makeFrame(root, ""));
          continue;
        }
        backtracksUsed++;
        continue;
      }
    }
    // skip this contact gap (commit null, advance) — guarantees forward progress
    const child = extendNode(top.node, null);
    const skipKey = top.committedKey;
    stack.pop();
    stack.push({ node: top.node, kind: "skip", cands: [], tried: 1, committedKey: skipKey });
    stack.push(makeFrame(child, skipKey + ",S"));
    failureStartIdx = -1;
    backtracksUsed = 0;
  }
  return null;
}

/** Safety bound on guided-repair rounds. Each round FORBIDS every current owner
 *  gap's committed (assembled-track-missing) candidate and re-runs the
 *  backtracking descent; the natural per-gap bound is the candidate pool size
 *  (forbidding eventually exhausts it → the gap skips). This caps pathological
 *  multi-miss interaction. A code constant, not budget-fed. */
const REPAIR_ROUNDS_CAP = 12;

/** Gap indices that OWN an assembled-track failure (a missing or off-beat
 *  contact) in `fits`'s full track, sorted ascending (deterministic). Reuses the
 *  pure detection-analysis substrate (`offBeatLandingEvents`, `contactLineIdsAt`,
 *  `findGapOwning`, `addMissedContactRetryOwners`). */
function failureOwnerGaps(
  det: ReturnType<typeof detect>,
  gaps: Gap[],
  fits: (GapFit | null)[],
  contactFrames: number[],
): number[] {
  const ownerGaps = new Set<number>();
  for (const e of offBeatLandingEvents(det, contactFrames)) {
    for (const lid of contactLineIdsAt(det, e.frame)) {
      const owner = findGapOwning(lid, fits);
      if (owner >= 0) ownerGaps.add(owner);
    }
  }
  addMissedContactRetryOwners(ownerGaps, det, gaps, fits, contactFrames);
  return [...ownerGaps].sort((a, b) => a - b);
}

/** Expand a contact-gap-order commit path (committed sorted-index per contact
 *  gap, SKIP for a skipped gap) to a per-gap `ranks` array (length = gaps.length;
 *  non-contact and skipped gaps → 0). Used to give repair leaves a distinct,
 *  deterministic fingerprint reflecting their actual committed candidates. */
function perGapRanksFromCommit(commit: number[], gaps: Gap[]): number[] {
  const out: number[] = [];
  let cgn = 0;
  for (const g of gaps) {
    if (g.endsWithContact) {
      const c = commit[cgn++];
      out.push(c === SKIP ? 0 : c);
    } else {
      out.push(0);
    }
  }
  return out;
}

/** Enumerate leaves in increasing-discrepancy order, RELATIVE TO the
 *  backtracking base path (the d=0 floor from `buildBacktrackingLeaf`).
 *
 *  d=0 is the base path itself — always yielded first and budget-exempt (a
 *  floor must complete). For d>=1, candidates at each contact gap are read in
 *  a BASE-ROTATED order: while still on the base path, the base's committed
 *  choice is local-rank 0; once a deviation is taken (local-rank>=1) the path
 *  is "off base" and local-rank 0 reverts to the cheapest candidate (greedy
 *  continuation). So discrepancy d counts edit-distance from the base path,
 *  and low-d leaves explore completions NEAR a track that completes — instead
 *  of near the cheapest-everywhere spine, which dead-ends on dense specs.
 *
 *  Structural property (preserves monotonicity-in-budget): for any maxD' >=
 *  maxD, `leaves(maxD') ⊇ leaves(maxD)` — we only ADD discrepancy levels at
 *  the end, and the rotated order at each node is a pure function of
 *  (spec, seed) (the base path is fixed; rotation is deterministic). The
 *  budget only controls how far into this fixed order we go (the node-entry
 *  cutoff is a pure function of the budget and never changes leaf CONTENT).
 *
 *  Memoization: candidate lists are cached by the COMMITTED candidate-identity
 *  path — the absolute sorted-index (or "S" for a skipped gap) at each contact
 *  gap so far. This (not the local-rank path) is what uniquely identifies the
 *  committed prefix engine once base-rotation makes local-rank != sorted-index;
 *  keying on local rank would return a list computed for a different engine
 *  state. Same scheme as legacy `candidateCacheKey`. */
export function* enumerateLeaves(
  root: SearchNode,
  maxDiscrepancy: number,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  budgetUnits = Infinity,
): Generator<Leaf> {
  // Candidate-list cache keyed on the committed candidate-identity path, SHARED
  // between the base-path descent, the guided-repair leaves, and the deviation
  // enumeration (and across the base path's own backtracking re-descents). The
  // key scheme is identical in all — absolute sorted-index (or "S") per contact
  // gap — so a candidate list sampled once is reused for free when any of them
  // revisits the same prefix.
  const candCache = new Map<string, Candidate[]>();

  const getCandidatesCached = (node: SearchNode, committedKey: string): Candidate[] => {
    const cached = candCache.get(committedKey);
    if (cached !== undefined) return cached;
    const sorted = getCandidatesSorted(node, gaps, ctx, seed);
    candCache.set(committedKey, sorted);
    return sorted;
  };

  const base = buildBacktrackingLeaf(root, gaps, ctx, seed, BASE_BACKTRACK_DEPTH, candCache);
  if (base === null) return;
  yield base.leaf;

  // Guided repair — the validation-retry IDEA integrated as ordinary deviation
  // LEAVES, not a copied retry loop. The base path can complete yet MISS or land
  // OFF-BEAT in the ASSEMBLED track. The fix: FORBID the owning gap's committed
  // (missing) candidate and re-run the BACKTRACKING descent, so the gap takes an
  // alternative and the rest completes via backtracking (Phase 2a's straight-line
  // override descent gave up on a downstream dead-end; this does not). Each round
  // forbids one more candidate at each still-failing owner. So repair is:
  // budget-subject (a cutoff each round), monotonic (a fixed prefix of a fixed
  // yielded order), and deterministic. The base path stays a clean floor; repairs
  // are leaves, never mutation.
  const cgnOf = new Map<number, number>(); // gapIndex -> contact-gap number
  { let n = 0; for (let i = 0; i < gaps.length; i++) if (gaps[i].endsWithContact) cgnOf.set(i, n++); }
  const forbidden = new Map<number, Set<number>>(); // gapIndex -> forbidden sorted-indices
  let cur: Leaf = base.leaf;
  let curCommit = base.baseCommitPath;
  for (let round = 0; round < REPAIR_ROUNDS_CAP; round++) {
    if (getSimFrames() >= budgetUnits) return;
    const det = detect(extractRawTrajectory(cur.engine, ctx.durationFrames + 20));
    const owners = failureOwnerGaps(det, gaps, cur.fits as (GapFit | null)[], ctx.allContactFrames);
    if (owners.length === 0) break; // current leaf satisfies the hard contract
    let bumped = false;
    for (const g of owners) {
      const cgn = cgnOf.get(g);
      if (cgn === undefined) continue;
      const committed = curCommit[cgn];
      if (committed === SKIP) continue; // skipped gap — no committed candidate to forbid
      let set = forbidden.get(g);
      if (!set) { set = new Set<number>(); forbidden.set(g, set); }
      if (!set.has(committed)) { set.add(committed); bumped = true; }
    }
    if (!bumped) break; // nothing new to forbid (owners skipped / already exhausted)
    const repair = buildBacktrackingLeaf(
      root, gaps, ctx, seed, BASE_BACKTRACK_DEPTH, candCache, forbidden,
    );
    if (repair === null) break;
    // Distinct, deterministic fingerprint (committed-index path) + discrepancy so
    // repair leaves don't collide with the base leaf or each other.
    const repairLeaf: Leaf = {
      ...repair.leaf,
      ranks: perGapRanksFromCommit(repair.baseCommitPath, gaps),
      discrepancy: round + 1,
    };
    yield repairLeaf;
    cur = repairLeaf;
    curCommit = repair.baseCommitPath;
  }

  for (let d = 1; d <= maxDiscrepancy; d++) {
    if (getSimFrames() >= budgetUnits) return;
    yield* enumerateDeviations(
      root, d, "", [], true, 0,
      gaps, ctx, seed, base.baseCommitPath, getCandidatesCached, budgetUnits,
    );
  }
}

/** Yield exactly the leaves whose base-relative discrepancy (sum of local
 *  ranks) equals `exactBudget`. Recursive DFS, base-rotated. Helper for
 *  `enumerateLeaves`.
 *
 *  `committedKey` is the committed candidate-identity path so far (cache key).
 *  `allRanks` is the per-gap LOCAL rank for the resulting Leaf (non-contact
 *  gaps contribute 0). `onBase` is true iff every contact-gap choice so far
 *  matched the base path — only then does `node`'s candidate list match the
 *  one the base path saw, so only then is `baseCommitPath[contactGapNum]` a
 *  valid index into it. `contactGapNum` indexes `baseCommitPath`. */
function* enumerateDeviations(
  node: SearchNode,
  exactBudget: number,
  committedKey: string,
  allRanks: number[],
  onBase: boolean,
  contactGapNum: number,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
  baseCommitPath: number[],
  getCandidatesCached: (node: SearchNode, committedKey: string) => Candidate[],
  budgetUnits: number,
): Generator<Leaf> {
  // Node-entry budget cutoff: a pure function of the budget; it gates which
  // prefixes are visited, never the content of any leaf (monotonicity-safe).
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
    yield* enumerateDeviations(
      child, exactBudget, committedKey, [...allRanks, 0], onBase, contactGapNum,
      gaps, ctx, seed, baseCommitPath, getCandidatesCached, budgetUnits,
    );
    return;
  }

  const sorted = getCandidatesCached(node, committedKey);
  // The base's committed choice at this contact gap (valid only while onBase,
  // because only then is `node` the same node the base path visited here).
  const baseChoice = onBase ? baseCommitPath[contactGapNum] : 0;

  // Rotated option order: the preferred choice (base choice while on base, else
  // cheapest) first, then the remaining candidates in sorted-cost order. An
  // option is a sorted-index, or SKIP (commit null — only when the base path
  // itself skipped this gap).
  const options: number[] = [];
  if (onBase && baseChoice === SKIP) {
    options.push(SKIP);
    for (let i = 0; i < sorted.length; i++) options.push(i);
  } else {
    if (sorted.length === 0) return; // dead-end: this deviation can't complete
    const pref = baseChoice; // 0 off-base; the base's sorted-index on-base
    options.push(pref);
    for (let i = 0; i < sorted.length; i++) if (i !== pref) options.push(i);
  }

  const maxRank = Math.min(options.length - 1, exactBudget);
  for (let r = 0; r <= maxRank; r++) {
    const choice = options[r];
    const childOnBase = onBase && r === 0; // r===0 takes the preferred (base) choice
    const child = choice === SKIP ? extendNode(node, null) : extendNode(node, sorted[choice]);
    const childKey = committedKey + (choice === SKIP ? ",S" : "," + choice);
    yield* enumerateDeviations(
      child, exactBudget - r, childKey, [...allRanks, r],
      childOnBase, contactGapNum + 1,
      gaps, ctx, seed, baseCommitPath, getCandidatesCached, budgetUnits,
    );
  }
}
