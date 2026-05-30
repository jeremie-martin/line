/**
 * Budget-search contract — the executable form of the compatibility proof in
 * `docs/search_rethink_state_handoff.md` §7 (determinism + monotonicity-in-budget
 * + budget-as-a-pure-stop-condition).
 *
 * The harness (`./budget_contract_harness.ts`) is ARCHITECTURE-AGNOSTIC: it talks
 * to the abstract `BudgetCompile` shape and the held-constant scoring comparator
 * only, never the LDS mechanism. The current optimizer (`compileLDS`) is adapted
 * to that shape here; the reach-guided rebuild is gated by the same contract in
 * its own file (`reach_budget_contract.test.ts`) — kept separate because the
 * compilers share module-global state (the single-compile-at-a-time sim-frame
 * counter), and vitest isolates test FILES in separate workers, so each
 * compiler's contract run is contamination-free.
 *
 * WHAT THIS TEST VERIFIED (2026-05-30, measured): the current LDS compiler
 * satisfies the contract from the OUTSIDE on every spec tested —
 *   - determinism: byte-identical Track for the same (spec, seed, budget);
 *   - monotonicity: the register comparator key never regresses as the sim-frame
 *     budget grows (tiny_dance, cold_start, drums_signature, budgets 50k–400k);
 *   - freeze: above full-enumeration cost, more budget is a no-op (tiny_dance).
 */

import { describe, it } from "vitest";
import { compileLDS } from "../scripts/v0/optimizer/api.ts";
import { loadGoldenSpec, type GoldenSpecName } from "../scripts/v0/golden_suite.ts";
import {
  assertBudgetSearchContract,
  type BudgetCompile,
} from "./budget_contract_harness.ts";

// Adapt the real compiler to the architecture-agnostic contract shape. A
// non-finite `budgetUnits` means "unbounded" → pass no budget.
const compile: BudgetCompile = (spec, opts) =>
  compileLDS(spec, opts.seed, {
    maxDiscrepancy: opts.maxDiscrepancy,
    budget: Number.isFinite(opts.budgetUnits)
      ? { kind: "work", units: opts.budgetUnits }
      : undefined,
  });

describe("budget-search contract (compileLDS)", () => {
  it("tiny_dance: determinism + monotonicity + freeze", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    assertBudgetSearchContract(compile, "tiny_dance", spec, {
      budgets: [50_000, 150_000, 400_000],
      checkFreeze: true,
      freezeMaxDiscrepancy: 1,
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
