/**
 * Budget-search contract harness (post anytime -> scalar-budget migration).
 *
 * Each budget is now an INDEPENDENT full run from scratch. The ONE enforced contract
 * is DETERMINISM: the same (spec, seed, budget) yields a byte-identical Track. That
 * is the property a budget-aware search must keep — a run must be reproducible.
 *
 * Monotonicity-in-budget and the old "budget is a pure stop condition" freeze are
 * recorded as OPTIONAL DIAGNOSTICS, not contracts. They held for the budget-oblivious
 * anytime search (budgets truncated one shared sequence), but a budget-AWARE search
 * may legitimately break them — it may spend a small budget on a different strategy
 * than a prefix of a large-budget run. So this harness OBSERVES AND RECORDS them
 * (project test philosophy: experiments, not gatekeepers) without failing on them.
 *
 * The harness depends only on an abstract `BudgetCompile` shape and the scoring
 * comparator (`register.ts`), never on a specific compiler mechanism — so a rebuilt
 * search drops into the same harness unchanged.
 */

import { createHash } from "node:crypto";
import { isStrictlyBetter, leafKeyForReport } from "../scripts/v0/optimizer/register.ts";
import { secToFrame, type Spec } from "../scripts/v0/types.ts";
import type { CompileCheckpoint } from "../scripts/v0/optimizer/types.ts";

/** The architecture-agnostic compile signature the contract is stated against: one
 *  scalar budget = one independent run, returning a single checkpoint. */
export type BudgetCompile = (
  spec: Spec,
  opts: { seed: number; budget: number; maxNodes?: number },
) => CompileCheckpoint;

export type ContractConfig = {
  /** Ascending sim-frame budgets for the (diagnostic) monotonicity sweep. */
  budgets: number[];
  seed?: number;
  /** Run the (diagnostic) convergence/freeze observation. Requires that exhaustive
   *  search under the supplied cap is affordable for this spec. */
  checkFreeze?: boolean;
  /** Small maxNodes for the freeze observation so exhaustive enumeration is cheap.
   *  Ignored unless `checkFreeze`. */
  freezeMaxNodes?: number;
};

/** Structured outcome — observe & record. `violations` carries ONLY the enforced
 *  contract (determinism); monotonicity/freeze findings are diagnostics. */
export type ContractReport = {
  spec: string;
  /** ENFORCED: same (spec, seed, budget) -> byte-identical Track. */
  deterministic: boolean;
  /** DIAGNOSTIC (not a contract): a higher budget returned a STRICTLY WORSE
   *  comparator key. A budget-aware search may legitimately do this. */
  monotonicityDiagnostics: { lowerBudget: number; higherBudget: number; detail: string }[];
  /** DIAGNOSTIC (not a contract): an above-full-cost budget did not reproduce the
   *  exhaustive output byte-for-byte. Empty if not checked. */
  freezeDiagnostics: { budget: number; detail: string }[];
  /** Enforced-contract failures only (determinism). Empty ⇒ the contract holds. */
  violations: string[];
};

const trackHash = (out: CompileCheckpoint): string =>
  createHash("sha256").update(JSON.stringify(out.track)).digest("hex");

/** Run the contract for one (compile, spec) and RETURN what happened. Never throws
 *  on a diagnostic finding; only on a misconfigured run (e.g. a freeze check on a
 *  spec that charges 0 frames). */
export function checkBudgetSearchContract(
  compile: BudgetCompile,
  specName: string,
  spec: Spec,
  cfg: ContractConfig,
): ContractReport {
  const seed = cfg.seed ?? 0;
  const totalFrames = secToFrame(spec.duration);
  const keyOf = (out: CompileCheckpoint) => leafKeyForReport(out.report, totalFrames);
  const report: ContractReport = {
    spec: specName,
    deterministic: true,
    monotonicityDiagnostics: [],
    freezeDiagnostics: [],
    violations: [],
  };

  // ── ENFORCED — Determinism: output is a pure function of (spec, seed, budget).
  // One budget suffices: nondeterminism is a property of the function, not of a
  // particular budget. Use the cheapest (smallest) budget.
  {
    const budget = cfg.budgets[0];
    const a = compile(spec, { seed, budget });
    const b = compile(spec, { seed, budget });
    if (trackHash(a) !== trackHash(b)) {
      report.deterministic = false;
      report.violations.push(`non-deterministic Track at budget ${budget}`);
    }
  }

  // ── DIAGNOSTIC — Monotonicity-in-budget. Recorded, never a violation: a
  // budget-aware search may spend a small budget on a different strategy than a
  // prefix of a large-budget run, so a higher budget is NOT required to dominate.
  let prevKey: ReturnType<typeof keyOf> | null = null;
  let prevBudget = 0;
  for (const budget of cfg.budgets) {
    const out = compile(spec, { seed, budget });
    const key = keyOf(out);
    if (prevKey !== null && isStrictlyBetter(prevKey, key)) {
      const detail =
        `budget ${budget} (full=${key.full_score.toFixed(2)}, pass=${key.contract_passed}) ` +
        `is STRICTLY WORSE than ${prevBudget} (full=${prevKey.full_score.toFixed(2)}, ` +
        `pass=${prevKey.contract_passed})`;
      report.monotonicityDiagnostics.push({ lowerBudget: prevBudget, higherBudget: budget, detail });
    }
    prevKey = key;
    prevBudget = budget;
  }

  // ── DIAGNOSTIC — Freeze / convergence: beyond the cost of FULL enumeration, more
  // budget WAS a no-op for the anytime search. Recorded for observation only.
  if (cfg.checkFreeze) {
    const maxNodes = cfg.freezeMaxNodes ?? 12;
    const exhaustiveBudget = 1_000_000_000;
    const exhaustive = compile(spec, { seed, budget: exhaustiveBudget, maxNodes });
    const fullCost = exhaustive.stats.sim_frames;
    if (!(fullCost > 0)) {
      throw new Error(`${specName}: exhaustive run charged 0 sim-frames — cannot test freeze`);
    }
    const exhaustiveHash = trackHash(exhaustive);
    for (const mult of [1.5, 3, 6]) {
      const budget = Math.ceil(fullCost * mult) + 5_000;
      const h = trackHash(compile(spec, { seed, budget, maxNodes }));
      if (h !== exhaustiveHash) {
        report.freezeDiagnostics.push({
          budget,
          detail: `output NOT frozen at budget ${budget} (≈${mult}× full cost ${fullCost})`,
        });
      }
    }
  }

  return report;
}

/** Strict wrapper: assert the spec satisfies the ENFORCED contract (determinism).
 *  Monotonicity/freeze diagnostics are returned for inspection but do NOT throw. */
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
