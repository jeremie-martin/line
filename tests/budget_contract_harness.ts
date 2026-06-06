/**
 * Budget-search contract harness (post anytime -> scalar-budget migration).
 *
 * The ONE enforced contract is DETERMINISM: the same (spec, seed, budget) yields a
 * byte-identical Track. That is the property a budget-aware search must keep — a run
 * must be reproducible.
 *
 * The old anytime pillars (monotonicity-in-budget and "budget is a pure stop
 * condition" freeze) were DROPPED, not demoted: they held only because budgets
 * truncated one shared deterministic search, and a budget-AWARE search may
 * legitimately break them (it may spend a small budget on a different strategy than a
 * prefix of a large-budget run). Re-introducing them — even as observe-only
 * diagnostics nobody reads — would just carry anytime machinery forward.
 *
 * The harness depends only on an abstract `BudgetCompile` shape, never on a specific
 * compiler mechanism, so a rebuilt search drops into it unchanged.
 */

import { createHash } from "node:crypto";
import type { Spec } from "../scripts/v0/types.ts";
import type { CompileCheckpoint } from "../scripts/v0/optimizer/types.ts";

/** The architecture-agnostic compile signature the contract is stated against: one
 *  scalar budget = one independent run, returning a single checkpoint. */
export type BudgetCompile = (
  spec: Spec,
  opts: { seed: number; budget: number; maxNodes?: number },
) => CompileCheckpoint;

export type ContractConfig = {
  /** Budget to compile at for the determinism check. */
  budget: number;
  seed?: number;
  /** Optional node cap so the check stays cheap. */
  maxNodes?: number;
};

/** Structured outcome — `violations` empty ⇒ the determinism contract holds. */
export type ContractReport = {
  spec: string;
  deterministic: boolean;
  violations: string[];
};

const trackHash = (out: CompileCheckpoint): string =>
  createHash("sha256").update(JSON.stringify(out.track)).digest("hex");

/** Run the contract for one (compile, spec) and RETURN what happened. */
export function checkBudgetSearchContract(
  compile: BudgetCompile,
  specName: string,
  spec: Spec,
  cfg: ContractConfig,
): ContractReport {
  const seed = cfg.seed ?? 0;
  const report: ContractReport = { spec: specName, deterministic: true, violations: [] };

  // Determinism: output is a pure function of (spec, seed, budget).
  const a = compile(spec, { seed, budget: cfg.budget, maxNodes: cfg.maxNodes });
  const b = compile(spec, { seed, budget: cfg.budget, maxNodes: cfg.maxNodes });
  if (trackHash(a) !== trackHash(b)) {
    report.deterministic = false;
    report.violations.push(`non-deterministic Track at budget ${cfg.budget}`);
  }

  return report;
}

/** Strict wrapper: assert the spec satisfies the determinism contract. */
export function assertBudgetSearchContract(
  compile: BudgetCompile,
  specName: string,
  spec: Spec,
  cfg: ContractConfig,
): ContractReport {
  const report = checkBudgetSearchContract(compile, specName, spec, cfg);
  if (!report.deterministic || report.violations.length > 0) {
    throw new Error(
      `${specName}: determinism contract violated:\n  - ${report.violations.join("\n  - ")}`,
    );
  }
  return report;
}
