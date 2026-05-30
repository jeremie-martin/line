/**
 * Reach-guided candidate ordering — forward one-step lookahead (Stage 2).
 *
 * The handoff_forced diagnosis (docs/search_rethink_state_handoff.md §10): the
 * cheapest landing at a gap often exits in a state the NEXT contact gap cannot
 * catch. Measured (the now-deleted _probe_lazypolicy): on the no-backtrack
 * greedy spine, cost-only reaches 1–3 gaps before a doomed hand-off stalls it;
 * a lazy lookahead that RESCUES only when the cheapest exit is doomed reaches
 * the full track (rhythm_ladder 3→37, cold_start 1→15) with 0 doomed hand-offs.
 *
 * Policy (`lookaheadOrderer`), per contact gap, over cost-sorted survivors:
 *   1. Probe the next CONTACT gap from the cheapest candidate's exit engine.
 *      If it has ≥ RESCUE_THRESHOLD survivors, return cost order unchanged (the
 *      cheap path — ONE probe, the common case; easy gaps are byte-for-byte the
 *      cost-only behavior).
 *   2. Otherwise (cheapest hand-off doomed) probe the REMAINING candidates and
 *      partition into survivable (≥ RESCUE_THRESHOLD next-gap survivors) vs doomed,
 *      keeping cost order WITHIN each partition and putting survivable first. This
 *      only demotes doomed hand-offs behind survivable ones — it never promotes a
 *      high-survivor candidate over a cheaper survivable one, avoiding the
 *      over-rotation that wrecked axis quality on syncopated_switchback /
 *      grain_staircase (the tangency / Direction-A lesson). The rescue commits the
 *      CHEAPEST survivable hand-off — the smallest axis sacrifice that escapes doom.
 *
 * Contract safety:
 *   - Deterministic & EXACT: the probe uses the shared `perGapRng` and the same
 *     N_CAND sample count as the real expansion, so it samples EXACTLY the
 *     candidate set the next contact gap's real expansion will (node.ts
 *     getCandidatesSorted), from the candidate's real exit engine (`extendNode`).
 *   - Budget-independent: the policy never reads getSimFrames()/remaining budget;
 *     it keys off a LOCAL difficulty signal (next-gap survivor count), which §7
 *     explicitly permits.
 *   - Cheat-resistant: the probe simulates real frames, charged automatically.
 *     A PhysicsFrameLimitExceeded from the probe is RE-THROWN (not swallowed) so
 *     the hard runaway guard still fires during a lookahead floor.
 *   - The orderer only REORDERS the sampled survivors — never fabricates or drops
 *     a candidate — and the engine still hard-gates every commit, so a misleading
 *     probe can waste a little work but can never emit an infeasible track (engine
 *     stays ground truth, D2).
 */

import { solveOneGap } from "../optimizer/solver.ts";
import { extendNode, perGapRng, N_CAND, type CandidateOrderer, type SearchNode } from "../optimizer/node.ts";
import { PhysicsFrameLimitExceeded } from "../optimizer/sim_frames.ts";
import type { Candidate, SpecContext } from "../optimizer/sample.ts";
import type { Gap } from "../optimizer/types.ts";

/** Escalate (probe all candidates, reorder) only when the cheapest hand-off
 *  leaves FEWER than this many next-gap survivors. `1` = "rescue only the truly
 *  doomed (zero-survivor) hand-off" — the sweep's most robust setting (higher
 *  thresholds over-rescued and went non-monotone). The SAME predicate gates both
 *  the cheap-path early-out and the partition, so the two never desync. Fixed
 *  code constant, never budget-fed. */
const REACH_RESCUE_THRESHOLD = 1;

/** Count surviving candidates at the next contact gap from a given exit engine —
 *  the exact `solveOneGap(N_CAND)` the real expansion of that gap would run. */
function nextGapSurvivors(
  // deno-lint-ignore no-explicit-any
  exitEngine: any,
  nextContactGap: Gap,
  nextLineId: number,
  ctx: SpecContext,
  seed: number,
): number {
  const rng = perGapRng(seed, nextContactGap.index);
  try {
    return solveOneGap(exitEngine, nextContactGap, rng, N_CAND, ctx, nextLineId).length;
  } catch (e) {
    // The hard runaway guard must still fire during a lookahead floor — don't
    // swallow it. A genuine sampler failure is treated as doomed (conservative).
    if (e instanceof PhysicsFrameLimitExceeded) throw e;
    return 0;
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
  // this path byte-for-byte, and cost is the tie-break after any rescue.
  const byCost = [...candidates].sort((a, b) => a.cost - b.cost);
  if (byCost.length <= 1) return byCost;

  // Look ahead to the next CONTACT gap, skipping intervening non-contact gaps:
  // those commit null (engine + nextLineId unchanged), so the candidate's exit
  // is the entry state to that contact gap. If there is none, nothing downstream
  // can doom this hand-off → no lookahead.
  let ni = node.gapIndex + 1;
  while (ni < gaps.length && !gaps[ni].endsWithContact) ni++;
  if (ni >= gaps.length) return byCost;
  const nextContactGap = gaps[ni];

  // Probe a candidate's exit at the next contact gap. `extendNode` is the
  // canonical apply (engine + nextLineId), identical to what the real descent
  // does when it commits the candidate — so the probe matches reality exactly.
  const probe = (c: Candidate): number => {
    const exit = extendNode(node, c);
    return nextGapSurvivors(exit.prefixEngine, nextContactGap, exit.prefixNextLineId, ctx, seed);
  };

  // Step 1 — cheap path: probe only the cheapest hand-off.
  if (probe(byCost[0]) >= REACH_RESCUE_THRESHOLD) return byCost;

  // Step 2 — cheapest is doomed: probe the REMAINING candidates (byCost[0] is
  // already known doomed; never re-probe it) and partition, cost order within.
  const survivable: Candidate[] = [];
  const doomed: Candidate[] = [byCost[0]];
  for (let i = 1; i < byCost.length; i++) {
    (probe(byCost[i]) >= REACH_RESCUE_THRESHOLD ? survivable : doomed).push(byCost[i]);
  }
  return [...survivable, ...doomed];
};
