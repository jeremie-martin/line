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

    // contact gap
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
          if (f.kind === "contact" && f.tried < f.cands.length) break;
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

/** Per-owning-gap rank budget for guided repair: how many alternative candidates
 *  to try at a gap owning an assembled-track failure. The rank-axis probe found
 *  the recovering deviation is typically rank 1; a few more give margin. A code
 *  constant, not budget-fed. */
const REPAIR_MAX_RANK = 6;
/** Safety bound on guided-repair rounds (each round bumps every current owner's
 *  rank by one and regenerates the override leaf). The per-gap REPAIR_MAX_RANK is
 *  the real bound; this caps pathological multi-miss interaction. */
const REPAIR_ROUNDS_CAP = 12;

/** Contact-gap numbers (position among `endsWithContact` gaps, in order) that OWN
 *  an assembled-track failure — a missing or off-beat contact — in `fits`'s full
 *  track. Reuses the pure detection-analysis substrate (`offBeatLandingEvents`,
 *  `contactLineIdsAt`, `findGapOwning`, `addMissedContactRetryOwners`) to map a
 *  failure to its owning GAP, then converts gap index → contact-gap number. */
function failureOwnerContactGaps(
  det: ReturnType<typeof detect>,
  gaps: Gap[],
  fits: (GapFit | null)[],
  contactFrames: number[],
): Set<number> {
  const ownerGaps = new Set<number>();
  for (const e of offBeatLandingEvents(det, contactFrames)) {
    for (const lid of contactLineIdsAt(det, e.frame)) {
      const owner = findGapOwning(lid, fits);
      if (owner >= 0) ownerGaps.add(owner);
    }
  }
  addMissedContactRetryOwners(ownerGaps, det, gaps, fits, contactFrames);
  // Map gap index → contact-gap number.
  const contactGapNumOf = new Map<number, number>();
  let n = 0;
  for (let i = 0; i < gaps.length; i++) {
    if (gaps[i].endsWithContact) contactGapNumOf.set(i, n++);
  }
  const out = new Set<number>();
  for (const g of ownerGaps) {
    const cgn = contactGapNumOf.get(g);
    if (cgn !== undefined) out.add(cgn);
  }
  return out;
}

/** Build ONE base-rotated leaf with per-contact-gap rank OVERRIDES: at each
 *  contact gap take local-rank `overrides.get(contactGapNum) ?? 0` (0 = the base
 *  choice while on-base). A focused, non-backtracking single-path counterpart of
 *  `enumerateDeviations`, used for guided repair. Returns null on a dead-end or
 *  an out-of-range override rank. Pure function of (spec, seed, baseCommitPath,
 *  overrides) — deterministic; reuses the shared candidate cache. */
function buildOverrideLeaf(
  root: SearchNode,
  gaps: Gap[],
  baseCommitPath: number[],
  overrides: Map<number, number>,
  getCandidatesCached: (node: SearchNode, committedKey: string) => Candidate[],
): Leaf | null {
  let node = root;
  let committedKey = "";
  let onBase = true;
  let contactGapNum = 0;
  const allRanks: number[] = [];
  while (!isLeafNode(node, gaps.length)) {
    if (!gaps[node.gapIndex].endsWithContact) {
      node = extendNode(node, null);
      allRanks.push(0);
      continue;
    }
    const sorted = getCandidatesCached(node, committedKey);
    const baseChoice = onBase ? baseCommitPath[contactGapNum] : 0;
    const options: number[] = [];
    if (onBase && baseChoice === SKIP) {
      options.push(SKIP);
      for (let i = 0; i < sorted.length; i++) options.push(i);
    } else {
      if (sorted.length === 0) return null;
      options.push(baseChoice);
      for (let i = 0; i < sorted.length; i++) if (i !== baseChoice) options.push(i);
    }
    const r = overrides.get(contactGapNum) ?? 0;
    if (r >= options.length) return null; // requested alternative beyond the pool
    const choice = options[r];
    node = choice === SKIP ? extendNode(node, null) : extendNode(node, sorted[choice]);
    committedKey += choice === SKIP ? ",S" : "," + choice;
    allRanks.push(r);
    onBase = onBase && r === 0;
    contactGapNum++;
  }
  return {
    fits: node.prefixFits,
    engine: node.prefixEngine,
    ranks: allRanks,
    discrepancy: allRanks.reduce((s, x) => s + x, 0),
    cumulativeCost: node.cumulativeCost,
  };
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
  // OFF-BEAT in the ASSEMBLED track; the fix is a low-rank deviation at the
  // OWNING gap (rank-axis probe). We detect the failures, bump those contact
  // gaps' override ranks, and yield the resulting single override leaf — offered
  // to the register like any other leaf. So repair is: budget-subject (a cutoff
  // each round, charged frames), monotonic (a fixed prefix of a fixed yielded
  // order), and deterministic. The base path stays a clean completion floor;
  // repairs are leaves, never mutation of the base.
  const overrides = new Map<number, number>(); // contactGapNum -> local rank
  let cur: Leaf = base.leaf;
  for (let round = 0; round < REPAIR_ROUNDS_CAP; round++) {
    if (getSimFrames() >= budgetUnits) return;
    const det = detect(extractRawTrajectory(cur.engine, ctx.durationFrames + 20));
    const owners = failureOwnerContactGaps(
      det, gaps, cur.fits as (GapFit | null)[], ctx.allContactFrames,
    );
    if (owners.size === 0) break; // current leaf satisfies the hard contract
    let bumped = false;
    for (const g of owners) {
      const prev = overrides.get(g) ?? 0;
      if (prev < REPAIR_MAX_RANK) { overrides.set(g, prev + 1); bumped = true; }
    }
    if (!bumped) break; // every owner exhausted its per-gap rank budget
    const repair = buildOverrideLeaf(root, gaps, base.baseCommitPath, overrides, getCandidatesCached);
    if (repair === null) break;
    yield repair;
    cur = repair;
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
