/**
 * Step 2 — single-gap K-candidate solver.
 *
 * Calls `sampleOneCandidate` K times against a single shared RNG and
 * returns the viable candidates (nulls filtered) in **sample order**,
 * NOT sorted by cost. This is intentional:
 *
 *   The chainer in Step 3 picks the lowest-cost candidate when it
 *   needs one; the envelope in Step 5 may also use the full sample
 *   list. Keeping the sample-order output means:
 *
 *     **Prefix property (load-bearing for monotonicity-in-K)**:
 *     `solveOneGap(K')[0..len(solveOneGap(K))]` ≡ `solveOneGap(K)`
 *     for all K' >= K. Adding more samples never reorders earlier
 *     ones; it only appends.
 *
 *   If we returned sorted-by-cost, this prefix property would break:
 *   a low-cost candidate from a later attempt would interleave into
 *   earlier positions. With sample-order output, the property holds
 *   by construction. Downstream callers that want sorted-by-cost
 *   can sort explicitly; the unsorted contract is the truthful one.
 *
 * Determinism follows from sampleOneCandidate's determinism plus
 * the shared RNG state being advanced deterministically.
 */

import { sampleOneCandidate, type Candidate, type SpecContext } from "./sample.ts";
import type { Gap } from "./types.ts";

/** Sample up to K candidates at the gap, returning the viable ones in
 *  sample order. Nulls (hard-gate failures) are filtered out, but the
 *  surviving candidates keep their original attempt-order positions
 *  relative to one another. */
export function solveOneGap(
  // deno-lint-ignore no-explicit-any
  engine: any,
  gap: Gap,
  rng: () => number,
  K: number,
  ctx: SpecContext,
  lineIdStart: number,
): Candidate[] {
  if (!Number.isInteger(K) || K < 0) {
    throw new Error(`solveOneGap: K must be a non-negative integer, got ${K}`);
  }
  const out: Candidate[] = [];
  for (let attempt = 0; attempt < K; attempt++) {
    const c = sampleOneCandidate(engine, gap, rng, ctx, lineIdStart, attempt);
    if (c !== null) out.push(c);
  }
  return out;
}

/** Convenience: pick the lowest-cost candidate from a solveOneGap
 *  result, or null if the list is empty. Stable on ties (returns the
 *  first lowest-cost candidate in sample order). */
export function pickLowestCost(candidates: Candidate[]): Candidate | null {
  if (candidates.length === 0) return null;
  let best = candidates[0];
  for (let i = 1; i < candidates.length; i++) {
    if (candidates[i].cost < best.cost) best = candidates[i];
  }
  return best;
}
