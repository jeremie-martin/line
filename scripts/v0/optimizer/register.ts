/**
 * Stage 1 — best-so-far register for LDS leaf evaluation.
 *
 * Keeps the strictly-best leaf seen so far under a deterministic
 * comparator. Strict-improvement-only updates + earliest-on-tie
 * (which falls out of "only swap on strict improvement, considered
 * in E order") give two properties simultaneously:
 *
 *   1. Monotonicity-in-budget: more leaves → never worse best.
 *   2. Budget-stable ties: equal-quality leaves don't flip the
 *      answer as budget grows.
 *
 * Comparator, in order:
 *   1. `contract_passed` — a passing leaf strictly dominates any
 *      failing leaf.
 *   2. Among passing: `axis_quality` higher wins (strict).
 *      (axis_quality is `scoreDriftReport`'s pure-quality factor — this
 *      register is the single source of truth for leaf selection.)
 *   3. Among failing: full `score` higher wins (strict). Full score
 *      includes survival_quality + the other contract factors so
 *      partial progress is ordered.
 *   4. Tiebreak: earliest in E (implicit — strict > only swaps on
 *      improvement, so the first-arriving leaf at a given key stays).
 *
 * Floating-point: comparator runs on deterministic IEEE-754 results
 * from `scoreDriftReport`. Engine output determinism is already a
 * project contract; the comparator adds no new nondeterminism.
 */

import type { CompileOutput, Score } from "./types.ts";

/** Composite ranking key for a leaf. */
export type LeafKey = {
  /** True iff drift=0, missing=0, off_beat=0, terminus=endOfSpec. */
  contract_passed: boolean;
  /** Pure quality in [0, 1] from `scoreDriftReport` — used among passing leaves. */
  axis_quality: Score;
  /** Full score (1000 * axis * drift * missing * off_beat * survival)
   *  from scoreDriftReport — used among failing leaves. */
  full_score: number;
  /** Smooth on-beat tightness (`drift_quality` from scoreDriftReport, higher =
   *  landings sit tighter on the beat). Tertiary tiebreak among passing leaves
   *  with equal axis_quality. Optional — omitting it just disables the tiebreak. */
  drift_quality?: number;
};

/** Float-comparison epsilon: treat differences below this as ties so IEEE-754
 *  noise can't flip the comparator across platforms (determinism) or churn the
 *  best-so-far on effectively-equal leaves (budget stability). */
const FLOAT_EPS = 1e-9;
const strictlyGreater = (x: number, y: number): boolean => x > y + FLOAT_EPS;

/** Strict-only comparison: returns true iff `a` is strictly better
 *  than `b` under the lexicographic comparator. Returns false on tie
 *  (which keeps the incumbent — the budget-stability property). */
export function isStrictlyBetter(a: LeafKey, b: LeafKey): boolean {
  // 1. contract_passed dominates
  if (a.contract_passed !== b.contract_passed) {
    return a.contract_passed && !b.contract_passed;
  }
  if (a.contract_passed) {
    // Both passing: axis_quality, then on-beat tightness as a tiebreak.
    if (strictlyGreater(a.axis_quality, b.axis_quality)) return true;
    if (strictlyGreater(b.axis_quality, a.axis_quality)) return false;
    return strictlyGreater(a.drift_quality ?? 0, b.drift_quality ?? 0);
  }
  // Both failing: rank by full score (includes survival, etc.).
  return strictlyGreater(a.full_score, b.full_score);
}

/** Holds the strictly-best leaf seen so far under the comparator
 *  above. Reset before each compile call. */
export class BestSoFarRegister {
  private best: CompileOutput | null = null;
  private bestKey: LeafKey | null = null;
  /** Count of leaves considered (whether they became best or not). */
  public consideredCount = 0;
  /** Count of leaves that strictly improved the best-so-far. */
  public improvementCount = 0;

  /** Offer a leaf to the register. Returns true iff it became the
   *  new best. */
  consider(leaf: CompileOutput, key: LeafKey): boolean {
    this.consideredCount++;
    if (this.bestKey === null || isStrictlyBetter(key, this.bestKey)) {
      this.best = leaf;
      this.bestKey = key;
      this.improvementCount++;
      return true;
    }
    return false;
  }

  /** Read the current best leaf, or null if none considered. */
  getBest(): CompileOutput | null {
    return this.best;
  }

  /** Read the current best key, or null if none considered. */
  getBestKey(): LeafKey | null {
    return this.bestKey;
  }
}
