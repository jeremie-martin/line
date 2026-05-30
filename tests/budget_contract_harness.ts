/**
 * Architecture-agnostic budget-search contract harness.
 *
 * This is the EXECUTABLE FORM of the compatibility proof in
 * `docs/search_rethink_state_handoff.md` §7: any deterministic search whose
 * explored sequence only GROWS with budget, fed a sim-frame budget that acts as
 * a pure STOP CONDITION, and topped by a strict-improvement register, satisfies
 * determinism + monotonicity-in-budget + objective-budget *simultaneously*.
 *
 * The harness checks that proof against an abstract `BudgetCompile` shape only —
 * it never imports the LDS mechanism (`enumerateLeaves`, `buildSpecContext`,
 * `node`, discrepancy machinery). It depends only on:
 *   - a `compile(spec, {seed, budgetUnits, maxDiscrepancy?}) → CompileOutput`,
 *   - the scoring comparator (`register.ts`), which DEFINES "better track" and
 *     is held constant across any rebuild (`docs/compiler_goals.md` Out of scope).
 *
 * So when the search is rebuilt (the state-handoff / feasibility architecture,
 * §5), it is dropped into THIS SAME harness unchanged. The contract is the
 * guardrail for the rebuild, not a test of one implementation.
 *
 * It OBSERVES AND RECORDS (project test philosophy: experiments, not gatekeepers)
 * — `checkBudgetSearchContract` returns a structured report of every violation
 * rather than throwing on the first, so a caller can diagnose the full picture.
 * `assertBudgetSearchContract` wraps it to fail on any violation, for specs
 * expected to be fully conformant. (As measured 2026-05-30, the current LDS
 * compiler IS conformant on every tested spec — see the test-file header.)
 *
 * The three pillars map 1:1 to the three load-bearing conditions in §7:
 *   Pillar 1  ← condition 1 (policy is a pure function of inputs): determinism.
 *   Pillar 2  ← conditions 1+3 (fixed order + strict register): monotonicity.
 *   Pillar 3  ← condition 2 (budget is a pure stop condition): convergence+freeze.
 */

import { createHash } from "node:crypto";
import { isStrictlyBetter, leafKeyForReport } from "../scripts/v0/optimizer/register.ts";
import { secToFrame, type Spec } from "../scripts/v0/types.ts";
import type { CompileOutput } from "../scripts/v0/optimizer/types.ts";

/** The architecture-agnostic compile signature the contract is stated against.
 *  `compileLDS` (adapted) matches it; a future search adapts to the same shape.
 *  A non-finite `budgetUnits` means "unbounded". */
export type BudgetCompile = (
  spec: Spec,
  opts: { seed: number; budgetUnits: number; maxDiscrepancy?: number },
) => CompileOutput;

export type ContractConfig = {
  /** Ascending sim-frame budgets for the monotonicity grid. */
  budgets: number[];
  seed?: number;
  /** Run the convergence/freeze pillar. Requires that EXHAUSTIVE enumeration is
   *  affordable for this spec — true for cheap-floored specs, false for specs
   *  whose budget-exempt floor alone is huge (the very tension §7 flags). */
  checkFreeze?: boolean;
  /** Small maxDiscrepancy for the freeze pillar so exhaustive enumeration is
   *  cheap. Ignored unless `checkFreeze`. */
  freezeMaxDiscrepancy?: number;
};

/** Structured outcome — observe & record, don't throw. Empty `violations` ⇒ the
 *  spec satisfies the full budget-search contract at the tested budgets. */
export type ContractReport = {
  spec: string;
  /** Pillar 1. */
  deterministic: boolean;
  /** Pillar 2: a higher budget returned a STRICTLY WORSE comparator key. Each
   *  entry is a (lower, higher) budget pair where the regression appeared. */
  monotonicityViolations: { lowerBudget: number; higherBudget: number; detail: string }[];
  /** Pillar 3: an above-full-cost budget did not reproduce the exhaustive output
   *  byte-for-byte (budget is not a pure stop condition). Empty if not checked. */
  freezeViolations: { budget: number; detail: string }[];
  /** All Pillar-2/3 problems flattened into human-readable strings. */
  violations: string[];
};

const trackHash = (out: CompileOutput): string =>
  createHash("sha256").update(JSON.stringify(out.track)).digest("hex");

/** Run the full contract for one (compile, spec) and RETURN what happened. Never
 *  throws on a contract violation (only on a misconfigured run, e.g. a freeze
 *  check on a spec that charges 0 frames). */
export function checkBudgetSearchContract(
  compile: BudgetCompile,
  specName: string,
  spec: Spec,
  cfg: ContractConfig,
): ContractReport {
  const seed = cfg.seed ?? 0;
  const totalFrames = secToFrame(spec.duration);
  const keyOf = (out: CompileOutput) => leafKeyForReport(out.report, totalFrames);
  const report: ContractReport = {
    spec: specName,
    deterministic: true,
    monotonicityViolations: [],
    freezeViolations: [],
    violations: [],
  };

  // ── Pillar 1 — Determinism (condition 1: output is a pure function of inputs).
  // One budget suffices: nondeterminism is a property of the function, not of a
  // particular budget. Use the cheapest (smallest) budget.
  {
    const budget = cfg.budgets[0];
    const a = compile(spec, { seed, budgetUnits: budget });
    const b = compile(spec, { seed, budgetUnits: budget });
    if (trackHash(a) !== trackHash(b)) {
      report.deterministic = false;
      report.violations.push(`non-deterministic Track at budget ${budget}`);
    }
  }

  // ── Pillar 2 — Monotonicity-in-budget (conditions 1+3: fixed deterministic
  // order + strict-improvement register ⇒ the comparator key never regresses as
  // budget grows). The register's exact comparator, reconstructed from each
  // output's DriftReport — the same key `compiler_goals.md` Property 1 is stated
  // in, and the same reconstruction `optimizer_anytime.test.ts` uses.
  let prevKey: ReturnType<typeof keyOf> | null = null;
  let prevBudget = 0;
  for (const budget of cfg.budgets) {
    const out = compile(spec, { seed, budgetUnits: budget });
    const key = keyOf(out);
    if (prevKey !== null && isStrictlyBetter(prevKey, key)) {
      const detail =
        `budget ${budget} (full=${key.full_score.toFixed(2)}, pass=${key.contract_passed}) ` +
        `is STRICTLY WORSE than ${prevBudget} (full=${prevKey.full_score.toFixed(2)}, ` +
        `pass=${prevKey.contract_passed})`;
      report.monotonicityViolations.push({ lowerBudget: prevBudget, higherBudget: budget, detail });
      report.violations.push(`monotonicity: ${detail}`);
    }
    prevKey = key;
    prevBudget = budget;
  }

  // ── Pillar 3 — Budget is a pure stop condition: convergence + freeze
  // (condition 2). Beyond the cost of FULL enumeration, more budget is a no-op:
  // the output freezes to the exhaustive best, byte-identically. This is the
  // black-box fingerprint distinguishing "budget truncates a fixed deterministic
  // sequence" from "budget is an input to the search policy".
  if (cfg.checkFreeze) {
    const maxDiscrepancy = cfg.freezeMaxDiscrepancy ?? 2;
    const exhaustive = compile(spec, { seed, budgetUnits: Infinity, maxDiscrepancy });
    const fullCost = exhaustive.stats.sim_frames;
    if (!(fullCost > 0)) {
      throw new Error(`${specName}: exhaustive run charged 0 sim-frames — cannot test freeze`);
    }
    const exhaustiveHash = trackHash(exhaustive);
    for (const mult of [1.5, 3, 6]) {
      const budgetUnits = Math.ceil(fullCost * mult) + 5_000;
      const h = trackHash(compile(spec, { seed, budgetUnits, maxDiscrepancy }));
      if (h !== exhaustiveHash) {
        const detail =
          `output NOT frozen at budget ${budgetUnits} (≈${mult}× full cost ${fullCost}) — ` +
          `budget is not a pure stop condition`;
        report.freezeViolations.push({ budget: budgetUnits, detail });
        report.violations.push(`freeze: ${detail}`);
      }
    }
  }

  return report;
}

/** Strict wrapper: assert the spec satisfies the FULL contract (no violations).
 *  Use for specs expected to be fully conformant. Throws with all violations. */
export function assertBudgetSearchContract(
  compile: BudgetCompile,
  specName: string,
  spec: Spec,
  cfg: ContractConfig,
): ContractReport {
  const report = checkBudgetSearchContract(compile, specName, spec, cfg);
  if (!report.deterministic || report.violations.length > 0) {
    throw new Error(
      `${specName}: budget-search contract violated:\n  - ${report.violations.join("\n  - ")}`,
    );
  }
  return report;
}
