/**
 * Reach-guided candidate ordering — forward one-step lookahead (Stage 2).
 *
 * The handoff_forced diagnosis (docs/search_rethink_state_handoff.md §10): the
 * cheapest landing at a gap often exits in a state the NEXT gap cannot catch.
 * Measured here (scripts/v0/reach/_probe_lazypolicy.ts): on the no-backtrack
 * greedy spine, cost-only reaches 1–3 gaps before a doomed hand-off stalls it;
 * a lazy lookahead that RESCUES only when the cheapest exit is doomed reaches
 * the full track (rhythm_ladder 3→37, cold_start 1→15) with 0 doomed hand-offs.
 *
 * Policy (`lookaheadOrderer`), per contact gap, over cost-sorted survivors:
 *   1. Keep the cost order as the baseline (so easy gaps are byte-for-byte the
 *      cost-only behavior and cost stays the tie-break everywhere).
 *   2. Probe the NEXT gap from the cheapest candidate's exit engine. If it has
 *      ≥ RESCUE_THRESHOLD survivors, commit cost order unchanged (cheap path —
 *      one probe, the common case).
 *   3. Otherwise (cheapest hand-off is doomed/near-doomed) probe every
 *      candidate's exit and STABLE-reorder by (next-gap survivors DESC, then
 *      original cost ASC). This rescues a survivable hand-off while still
 *      preferring the cheapest among equally-survivable ones.
 *
 * Contract safety:
 *   - Deterministic: the next-gap probe uses the canonical per-gap RNG
 *     (Math.imul scheme) for gap i+1 — the exact candidates the real expansion
 *     of i+1 would sample. Pure function of (spec, seed) + node state.
 *   - Budget-independent: the policy never reads getSimFrames()/remaining budget.
 *     It keys off a LOCAL difficulty signal (next-gap survivor count), which §7
 *     explicitly permits.
 *   - Cheat-resistant: the probe simulates real frames, charged automatically.
 *   - The orderer only REORDERS the sampled survivors; it never fabricates or
 *     drops a candidate, and the engine still hard-gates every commit — so a
 *     misleading probe can waste a little work but can never emit an infeasible
 *     track (engine stays ground truth, D2).
 */

import { makeRng } from "../../lib/rng.ts";
import { solveOneGap } from "../optimizer/solver.ts";
import { engineLineFromTrackLine, type GapFit } from "../core/substrate.ts";
import type { CandidateOrderer, SearchNode } from "../optimizer/node.ts";
import type { Candidate, SpecContext } from "../optimizer/sample.ts";
import type { Gap } from "../optimizer/types.ts";

/** Next-gap survivor sample count for a lookahead probe. From the empirical
 *  sweep (_probe_lazypolicy.ts): 12 gives a stable rescue signal; smaller
 *  under-probes on dense specs. Fixed code constant (like N_CAND), never
 *  budget-fed. */
export const REACH_PROBE_K = 12;

/** Escalate (probe all candidates, reorder) only when the cheapest hand-off
 *  leaves FEWER than this many next-gap survivors. `1` = "rescue only the truly
 *  doomed (zero-survivor) hand-off" — the sweep's most robust setting (higher
 *  thresholds over-rescued and went non-monotone). Fixed code constant. */
export const REACH_RESCUE_THRESHOLD = 1;

/** Per-gap RNG for the NEXT gap's probe — the canonical scheme from node.ts, so
 *  the probe samples exactly the candidates gap i+1's real expansion will. */
function nextGapRng(seed: number, nextGapIndex: number): () => number {
  return makeRng((Math.imul(seed | 0, 1000003) + nextGapIndex + 1) | 0);
}

/** Apply a candidate's lines to an engine, returning the exit engine + next id. */
function applyCandidate(
  // deno-lint-ignore no-explicit-any
  engine: any,
  fit: GapFit,
  lineIdStart: number,
  // deno-lint-ignore no-explicit-any
): { engine: any; nextLineId: number } {
  let e = engine;
  for (const line of fit.lines) e = e.addLine(engineLineFromTrackLine(line));
  return { engine: e, nextLineId: lineIdStart + fit.lines.length };
}

/** Count surviving candidates at the next contact gap from a given exit engine.
 *  Non-contact next gap (or no next gap) → treated as fully survivable
 *  (REACH_PROBE_K) so it never triggers a rescue. */
function nextGapSurvivors(
  // deno-lint-ignore no-explicit-any
  exitEngine: any,
  nextGap: Gap | undefined,
  nextLineId: number,
  ctx: SpecContext,
  seed: number,
): number {
  if (nextGap === undefined || !nextGap.endsWithContact) return REACH_PROBE_K;
  const rng = nextGapRng(seed, nextGap.index);
  try {
    return solveOneGap(exitEngine, nextGap, rng, REACH_PROBE_K, ctx, nextLineId).length;
  } catch {
    return 0; // a throwing probe = treat as doomed (conservative)
  }
}

/** The reach-guided orderer (forward one-step lazy lookahead). */
export const lookaheadOrderer: CandidateOrderer = (
  candidates: Candidate[],
  node: SearchNode,
  gaps: Gap[],
  ctx: SpecContext,
  seed: number,
): Candidate[] => {
  // Baseline: stable cost-sort (identical to costOrderer). Easy gaps stay on
  // this path byte-for-byte, and cost is the tie-break after rescue.
  const byCost = [...candidates].sort((a, b) => a.cost - b.cost);
  if (byCost.length <= 1) return byCost;

  const nextGap = gaps[node.gapIndex + 1];
  // A non-contact (or absent) next gap can't doom the hand-off → no lookahead.
  if (nextGap === undefined || !nextGap.endsWithContact) return byCost;

  // Step 1: probe only the cheapest hand-off (the common, cheap path).
  const cheapest = applyCandidate(node.prefixEngine, byCost[0], node.prefixNextLineId);
  const cheapestNext = nextGapSurvivors(
    cheapest.engine, nextGap, cheapest.nextLineId, ctx, seed,
  );
  if (cheapestNext >= REACH_RESCUE_THRESHOLD) return byCost; // cheapest is fine

  // Step 2: cheapest hand-off is doomed → probe all and apply the MINIMAL fix:
  // partition into survivable (next-gap survivors > 0) vs doomed (== 0), keep
  // each partition in its original cost order, and put survivable first. This
  // only demotes truly-doomed hand-offs behind survivable ones; it never
  // promotes a high-survivor candidate over a cheaper survivable one. That
  // avoids the over-rotation failure (maximizing survivors wrecked axis quality
  // on syncopated_switchback/grain_staircase — the tangency/Direction-A lesson):
  // the rescue picks the CHEAPEST survivable hand-off, the smallest axis
  // sacrifice that escapes the doom.
  const survivable: Candidate[] = [];
  const doomed: Candidate[] = [];
  for (const c of byCost) {
    const exit = applyCandidate(node.prefixEngine, c, node.prefixNextLineId);
    const next = nextGapSurvivors(exit.engine, nextGap, exit.nextLineId, ctx, seed);
    (next > 0 ? survivable : doomed).push(c);
  }
  return [...survivable, ...doomed];
};
