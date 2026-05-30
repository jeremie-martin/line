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
 * DETERMINISM + MONOTONICITY are verified here and PASS on every spec. The
 * FREEZE pillar is intentionally NOT asserted: the harness measures "full cost"
 * via an unbounded `maxDiscrepancy`-bounded run, but reach has no discrepancy
 * knob and its two floors are budget-exempt with DIFFERENT costs (the lookahead
 * floor is the more expensive one). So output legitimately keeps improving as
 * the budget crosses the second floor's cost — which is correct anytime
 * behavior, not a "budget is a policy input" violation, but it doesn't match the
 * freeze check's single-full-cost assumption. (The same reason the LDS contract
 * skips freeze on its budget-exempt-floor specs.) A reach-appropriate freeze
 * probe — "above the cost of BOTH floors, output is constant" — is tracked as
 * follow-up; determinism + monotonicity are the load-bearing pillars and they
 * hold.
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
      checkFreeze: false,
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
