import type { Budget } from "./types.ts";
import { CompileStatsBuilder } from "./stats.ts";

export type WorkUnitKind = "engine_addLine";

export class BudgetExhaustedError extends Error {
  readonly unitKind: WorkUnitKind;

  constructor(unitKind: WorkUnitKind) {
    super(`budget exhausted before ${unitKind}`);
    this.name = "BudgetExhaustedError";
    this.unitKind = unitKind;
  }
}

export class WorkMeter {
  private used = 0;
  private readonly workLimit: number | null;
  private readonly wallDeadlineMs: number | null;
  readonly budget: Budget;
  private readonly stats: CompileStatsBuilder;

  constructor(
    budget: Budget,
    stats: CompileStatsBuilder,
    nowMs = Date.now(),
  ) {
    this.budget = budget;
    this.stats = stats;
    this.workLimit = budget.kind === "work" ? Math.max(0, Math.floor(budget.units)) : null;
    this.wallDeadlineMs = budget.kind === "wall_ms" ? nowMs + Math.max(0, budget.ms) : null;
  }

  get unitsUsed(): number {
    return this.used;
  }

  get requestedWorkUnits(): number | null {
    return this.workLimit;
  }

  canSpendOne(): boolean {
    if (this.workLimit !== null && this.used >= this.workLimit) return false;
    if (this.wallDeadlineMs !== null && Date.now() >= this.wallDeadlineMs) return false;
    return true;
  }

  spendOne(kind: WorkUnitKind): void {
    if (!this.canSpendOne()) {
      this.stats.markBudgetExhausted();
      throw new BudgetExhaustedError(kind);
    }
    this.used++;
    this.stats.setWorkUnitsUsed(this.used);
  }
}
