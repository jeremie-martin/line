import { describe, expect, test } from "vitest";
import { createHash } from "node:crypto";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { secToFrame } from "../scripts/v0/types.ts";
import {
  assertBudgetSearchContract,
  type BudgetCompile,
} from "./budget_contract_harness.ts";

function hashTrack(track: unknown): string {
  return createHash("sha256").update(JSON.stringify(track)).digest("hex");
}

describe("optimizer/handoff.ts - prefix hand-off search", () => {
  test("satisfies the architecture-agnostic budget-search contract", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const compile: BudgetCompile = (inputSpec, opts) =>
      compileHandoff(inputSpec, opts.seed, {
        budget: Number.isFinite(opts.budgetUnits)
          ? { kind: "work", units: opts.budgetUnits }
          : undefined,
        maxNodes: opts.maxDiscrepancy ?? 12,
        polish: false,
      });
    assertBudgetSearchContract(compile, "tiny_dance/handoff", spec, {
      budgets: [1, 1_000, 5_000],
      checkFreeze: true,
      freezeMaxDiscrepancy: 12,
    });
  }, 120_000);

  test("same (spec, seed, budget) records identical work and previews", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const budget = { kind: "work" as const, units: 5_000 };
    const a = compileHandoff(spec, 0, { budget, maxNodes: 12, polish: false });
    const b = compileHandoff(spec, 0, { budget, maxNodes: 12, polish: false });
    expect(hashTrack(a.track)).toBe(hashTrack(b.track));
    expect(a.stats.sim_frames).toBe(b.stats.sim_frames);
    expect(a.stats.search_nodes_expanded).toBeGreaterThan(0);
    expect(a.stats.handoff_partial_evaluations).toBeGreaterThan(0);
    expect(a.stats.handoff_full_evaluations).toBeGreaterThan(0);
    expect(a.stats.handoff_previews).toBeGreaterThan(0);
    expect(a.stats.handoff_preview_contacts).toBeGreaterThan(0);
    expect(a.stats.handoff_preview_survivors).toBeGreaterThan(0);
    expect(a.stats.handoff_partial_evaluations).toBe(b.stats.handoff_partial_evaluations);
    expect(a.stats.handoff_full_evaluations).toBe(b.stats.handoff_full_evaluations);
    expect(a.stats.handoff_preview_contacts).toBe(b.stats.handoff_preview_contacts);
    expect(a.stats.handoff_preview_survivors).toBe(b.stats.handoff_preview_survivors);
  }, 60_000);

  test("can return an honest partial/failing prefix under a small budget", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const result = compileHandoff(spec, 0, {
      budget: { kind: "work", units: 1 },
      maxNodes: 12,
      polish: false,
    });
    expect(result.track.lines.length).toBeGreaterThanOrEqual(0);
    expect(result.track.duration).toBeLessThan(secToFrame(spec.duration) + 20);
    expect(result.report.terminus.reason).not.toBe("endOfSpec");
    expect(result.report.contacts.length).toBeGreaterThan(0);
    expect(result.report.contacts.every((contact) => contact.status === "missing")).toBe(true);
    expect(result.stats.budget_exhausted).toBe(true);
    expect(result.stats.leaves_considered).toBeGreaterThan(0);
    expect(result.stats.handoff_partial_evaluations).toBeGreaterThan(0);
  }, 120_000);

  test("polish path uses the selected root start state", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const result = compileHandoff(spec, 0, {
      budget: { kind: "work", units: 8_000 },
      maxNodes: 12,
      polish: true,
    });
    expect(result.stats.handoff_start_options).toBeGreaterThan(1);
    expect(result.stats.leaves_considered).toBeGreaterThan(0);
  }, 60_000);
});
