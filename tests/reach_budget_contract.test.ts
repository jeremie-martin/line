/**
 * Budget-search contract for the REACH-guided forward compiler (`compileReach`).
 *
 * Same architecture-agnostic harness and held-constant comparator as
 * `optimizer_budget_contract.test.ts` — this is the guardrail the colleague
 * review (caveat #1) asked for before the rebuild can become default. Kept in a
 * SEPARATE file (not alongside the compileLDS contract) on purpose: both
 * compilers drive the same single-compile-at-a-time module globals (the
 * sim-frame counter in `scripts/lib/detector.ts`, arc-placement stats), so
 * running both in one module interleaves that state. vitest isolates test files
 * in separate workers, so each compiler's contract run is contamination-free —
 * which also mirrors production (the golden worker runs ONE compiler per worker).
 *
 * `compileReach` defaults to "adaptive" mode (cost floor + lookahead floor, the
 * register keeps the better track). It ignores maxDiscrepancy — the sim-frame
 * budget is the only knob, exactly as the contract wants.
 *
 * All THREE pillars are asserted here, including FREEZE: the harness derives
 * "full cost" from the sim_frames of an unbounded compile and checks that output
 * is byte-identical at 1.5×/3×/6× that cost. reach satisfies this WITHOUT a
 * discrepancy knob — its first floor is budget-exempt and the rest are
 * budget-subject, so once the budget exceeds the combined floor cost the output
 * is constant. (The harness passes maxDiscrepancy to the adapter, which reach
 * harmlessly ignores; the freeze derivation does not depend on it.) This is the
 * guardrail the colleague review (caveat #1) required before reach can be
 * default: if a future change ever made a floor read the budget value, freeze
 * would catch it.
 */

import { describe, it } from "vitest";
import { compileReach } from "../scripts/v0/reach/api.ts";
import { loadGoldenSpec, type GoldenSpecName } from "../scripts/v0/golden_suite.ts";
import {
  assertBudgetSearchContract,
  type BudgetCompile,
} from "./budget_contract_harness.ts";

const compile: BudgetCompile = (spec, opts) =>
  compileReach(spec, opts.seed, {
    budget: Number.isFinite(opts.budgetUnits)
      ? { kind: "work", units: opts.budgetUnits }
      : undefined,
  });

describe("budget-search contract (compileReach)", () => {
  it("tiny_dance: determinism + monotonicity + freeze", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    assertBudgetSearchContract(compile, "tiny_dance", spec, {
      budgets: [50_000, 150_000, 400_000],
      checkFreeze: true,
    });
  }, 300_000);

  for (const name of ["cold_start", "drums_signature"] as GoldenSpecName[]) {
    it(`${name}: determinism + monotonicity`, async () => {
      const spec = await loadGoldenSpec(name, "base");
      assertBudgetSearchContract(compile, name, spec, {
        budgets: [80_000, 160_000, 320_000],
        checkFreeze: false,
      });
    }, 300_000);
  }
});
