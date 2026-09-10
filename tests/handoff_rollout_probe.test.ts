import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import {
  compileLegacyHandoff,
  setHandoffExpansionProbeHook,
  setHandoffRolloutProbeHook,
  type HandoffExpansionProbeRecord,
  type HandoffRolloutProbeRecord,
} from "../scripts/v0/optimizer/legacy_handoff.ts";

/**
 * The rollout-economics observation hooks (`scripts/v0/study_rollout_economics.ts`).
 *
 * Two contracts:
 *   IDENTITY   with no hook installed the compiler does one null comparison per
 *              rollout and nothing else — same track, same score, same frames.
 *   THE SPLIT  post redraw-on-empty, a hop-1 empty pool has three fates, and the
 *              record must name which one happened: trigger (`hop1Redrawn`),
 *              refuted (`hop1Refuted` / outcome `dead_hop1_refuted`), or residual
 *              (outcome `dead_hop1`). The hook's counts must agree exactly with
 *              the compiler's own `fwd_rollout_redraw*` counters, or the study is
 *              measuring a different population from the shipping thermometer.
 */

/** 400k, not the cheapest budget: without a budget where the impact
 *  first-widened arm actually fires, `firstBranch > 1` never occurs and the
 *  shape-attribution assertion below is vacuous. That arm's only budget
 *  coordinate is traversal slack (`B / D(spec)` past
 *  `IMPACT_BEST_FWD_SLACK_START = 2.5`), which on this spec saturates at ~300k,
 *  so 400k is comfortably inside the firing region. (Until 2026-08-04 a
 *  raw-budget ramp — offender d3, 300k/200k — was the binding gate here and
 *  chose this constant; removing it left the budget correct for a different,
 *  better reason, so it stays.) */
const BUDGET = 400_000;
const SEED = 3;

function trackHash(track: unknown): string {
  return createHash("sha256").update(JSON.stringify(track)).digest("hex");
}

describe("rollout observation hooks", () => {
  test("installed hooks change nothing about the compile", async () => {
    const spec = await loadGoldenSpec("dense_sprint", "base");

    const rollouts: HandoffRolloutProbeRecord[] = [];
    const expansions: HandoffExpansionProbeRecord[] = [];
    setHandoffRolloutProbeHook((record) => rollouts.push(record));
    setHandoffExpansionProbeHook((record) => expansions.push(record));
    let instrumented;
    try {
      instrumented = compileLegacyHandoff(spec, SEED, { budget: BUDGET });
    } finally {
      setHandoffRolloutProbeHook(null);
      setHandoffExpansionProbeHook(null);
    }
    const bare = compileLegacyHandoff(spec, SEED, { budget: BUDGET });

    expect(rollouts.length).toBeGreaterThan(0);
    expect(expansions.length).toBeGreaterThan(0);
    expect(trackHash(instrumented.track)).toBe(trackHash(bare.track));
    expect(instrumented.stats.sim_frames).toBe(bare.stats.sim_frames);
    expect(instrumented.stats.search_nodes_expanded).toBe(bare.stats.search_nodes_expanded);
    expect(instrumented.report.contacts.length).toBe(bare.report.contacts.length);

    // THE SPLIT, against the compiler's own counters.
    const fwd = instrumented.stats.fwd_eval;
    expect(fwd).not.toBeNull();
    const triggers = rollouts.filter((record) => record.hop1Redrawn);
    const refuted = rollouts.filter((record) => record.hop1Refuted);
    expect(triggers).toHaveLength(fwd!.fwd_rollout_redraws);
    expect(refuted).toHaveLength(fwd!.fwd_rollout_redraw_refuted);
    expect(triggers.length).toBeGreaterThan(0);
    // A refutation is always a trigger; the residual is the rest.
    expect(refuted.every((record) => record.hop1Redrawn)).toBe(true);
    expect(triggers.length - refuted.length).toBeGreaterThanOrEqual(0);

    // The one call the hook makes per rollout is the one the compiler charged.
    expect(rollouts.filter((record) => record.source !== "start"))
      .toHaveLength(fwd!.fwd_eval_calls);

    // Outcome classes are consistent with the two bits, on the linear shape that
    // carries a hop trace (branched shapes stay `branched` by construction).
    for (const record of rollouts) {
      if (record.outcome === "dead_hop1_refuted") {
        expect(record.hop1Refuted).toBe(true);
        expect(record.hop1Redrawn).toBe(true);
      }
      if (record.outcome === "dead_hop1") {
        expect(record.hop1Refuted).toBe(false);
      }
      // `branched` carries no trace at all; `no_hop` reached no contact to roll.
      // Every other class expanded at least one hop and priced it.
      if (record.outcome === "branched" || record.outcome === "no_hop") {
        expect(record.hopFrames).toHaveLength(0);
      } else {
        expect(record.hopFrames.length).toBeGreaterThan(0);
      }
      expect(record.frames).toBeGreaterThanOrEqual(0);
      expect(record.firstBranch).toBeGreaterThanOrEqual(1);
    }

    // Shape attribution: `greedy:2:1` and the impact-widened arm differ ONLY in
    // firstBranch, so the record has to carry it for M2 to mean anything.
    const widened = rollouts.filter((record) => record.firstBranch > 1);
    expect(widened.length).toBeGreaterThan(0);
    expect(widened.every((record) => record.outcome === "branched")).toBe(true);

    // The expansion hook reports the pool the SEARCH built, not a rollout pool.
    expect(expansions.every((record) => record.nCand > 0)).toBe(true);
    expect(expansions.some((record) => record.poolCandidates > 0)).toBe(true);
  }, 300_000);
});
