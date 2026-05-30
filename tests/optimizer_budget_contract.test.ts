/**
 * Budget-search contract — the executable form of the compatibility proof in
 * `docs/search_rethink_state_handoff.md` §7 (determinism + monotonicity-in-budget
 * + budget-as-a-pure-stop-condition).
 *
 * The harness (`./budget_contract_harness.ts`) is ARCHITECTURE-AGNOSTIC: it talks
 * to the abstract `BudgetCompile` shape and the held-constant scoring comparator
 * only, never the LDS mechanism. The current optimizer (`compileLDS`) is adapted
 * to that shape here; when the search is rebuilt (the state-handoff / feasibility
 * architecture, §5), point the SAME harness at the new compile function — the
 * contract is the guardrail for the rebuild, not a test of today's implementation.
 *
 * WHAT THIS TEST VERIFIED (2026-05-30, measured): the current LDS compiler
 * satisfies the contract from the OUTSIDE on every spec tested —
 *   - determinism: byte-identical Track for the same (spec, seed, budget);
 *   - monotonicity: the register comparator key never regresses as the sim-frame
 *     budget grows (tiny_dance, cold_start, drums_signature, budgets 50k–400k);
 *   - freeze: above full-enumeration cost, more budget is a no-op (tiny_dance).
 * This is the good news of §6 confirmed black-box: the OBJECTIVE BUDGET +
 * monotonicity machinery actually works; it's the enumeration ORDER that's the
 * mess, not the budget contract.
 *
 * The forward value (per the colleague review, caveat #1) is the GUARDRAIL: when
 * the rebuild makes the floor budget-subject and starts returning partial /
 * contract-failing tracks at tiny budgets, this harness is what catches a fuzzy
 * partial-report breaking monotonicity. Keep it pointed at the new compiler.
 */

import { describe, it } from "vitest";
import { compileLDS } from "../scripts/v0/optimizer/api.ts";
import { loadGoldenSpec, type GoldenSpecName } from "../scripts/v0/golden_suite.ts";
import {
  assertBudgetSearchContract,
  type BudgetCompile,
} from "./budget_contract_harness.ts";

// Adapt the real compiler to the architecture-agnostic contract shape. A
// non-finite `budgetUnits` means "unbounded" → pass no budget (the API rejects a
// non-positive/non-finite budget; an unset budget runs to maxDiscrepancy
// completion). Swap THIS line to point the contract at a future search.
const compile: BudgetCompile = (spec, opts) =>
  compileLDS(spec, opts.seed, {
    maxDiscrepancy: opts.maxDiscrepancy,
    budget: Number.isFinite(opts.budgetUnits)
      ? { kind: "work", units: opts.budgetUnits }
      : undefined,
  });

describe("budget-search contract (architecture-agnostic)", () => {
  // The full contract incl. convergence/freeze. tiny_dance is the canonical
  // freeze spec (optimizer_anytime uses it too): cheap, and non-degenerate at a
  // small maxDiscrepancy so the frozen output is a real contact-landing track,
  // not an all-skipped floor.
  it("tiny_dance: determinism + monotonicity + freeze", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    assertBudgetSearchContract(compile, "tiny_dance", spec, {
      budgets: [50_000, 150_000, 400_000],
      checkFreeze: true,
      freezeMaxDiscrepancy: 1,
    });
  }, 300_000);

  // Harder specs → determinism + monotonicity. Freeze is skipped: their
  // budget-exempt floor makes exhaustive enumeration too costly for a freeze
  // check in CI — exactly the budget-exemption tension §7 flags (a budget-subject
  // floor in the rebuilt search would let `checkFreeze` extend to these).
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
