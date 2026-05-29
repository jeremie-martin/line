import type { CompileStats } from "./types.ts";

export class CompileStatsBuilder {
  private readonly stats: CompileStats;

  constructor(workUnitsRequested: number | null) {
    this.stats = {
      work_units_requested: workUnitsRequested,
      work_units_used: 0,
      work_unit_kind: "engine_addLine",
      budget_exhausted: false,
      best_found_at_work_unit: null,
      no_contract_candidate_found: false,
      completed_candidates: 0,
      contract_passing_candidates: 0,
      archive_updates: 0,
      best_rejected_candidate: null,
      candidates_sampled: 0,
      engine_addLine_calls: 0,
      engine_rebuilds: 0,
      detector_windows: 0,
      detector_frames: 0,
      gap_commits: 0,
      gap_backtracks: 0,
      recovery_promotions: 0,
      validation_retries: 0,
      validation_retry_from_gaps: [],
      polish_candidates: 0,
      polish_iterations: 0,
      total_committed_cost: 0,
      committed_costs_per_gap: [],
    };
  }

  snapshot(): CompileStats {
    return {
      ...this.stats,
      best_rejected_candidate: this.stats.best_rejected_candidate === null
        ? null
        : {
          ...this.stats.best_rejected_candidate,
          hard_failures: [...this.stats.best_rejected_candidate.hard_failures],
          missing_contact_frames: [...this.stats.best_rejected_candidate.missing_contact_frames],
          drift_contact_frames: [...this.stats.best_rejected_candidate.drift_contact_frames],
        },
      committed_costs_per_gap: [...this.stats.committed_costs_per_gap],
      validation_retry_from_gaps: [...this.stats.validation_retry_from_gaps],
    };
  }

  setWorkUnitsUsed(units: number): void {
    this.stats.work_units_used = units;
    this.stats.engine_addLine_calls = units;
  }

  markBudgetExhausted(): void {
    this.stats.budget_exhausted = true;
  }

  markNoContractCandidateFound(): void {
    this.stats.no_contract_candidate_found = true;
  }

  recordEngineRebuild(): void {
    this.stats.engine_rebuilds++;
  }

  recordDetectorWindow(frames: number): void {
    this.stats.detector_windows++;
    this.stats.detector_frames += Math.max(0, frames);
  }

  recordCandidateSampled(count = 1): void {
    this.stats.candidates_sampled += count;
  }

  recordCompletedCandidate(contractPassed: boolean, foundAtWorkUnit: number): void {
    this.stats.completed_candidates++;
    if (contractPassed) this.stats.contract_passing_candidates++;
    if (contractPassed && this.stats.best_found_at_work_unit === null) {
      this.stats.best_found_at_work_unit = foundAtWorkUnit;
    }
  }

  recordRejectedCandidate(input: NonNullable<CompileStats["best_rejected_candidate"]>): void {
    const current = this.stats.best_rejected_candidate;
    if (
      current === null
      || input.hits > current.hits
      || (input.hits === current.hits && input.score > current.score)
      || (input.hits === current.hits && input.score === current.score && input.found_at_work_unit < current.found_at_work_unit)
    ) {
      this.stats.best_rejected_candidate = {
        ...input,
        hard_failures: [...input.hard_failures],
      };
    }
  }

  recordArchiveUpdate(foundAtWorkUnit: number): void {
    this.stats.archive_updates++;
    this.stats.best_found_at_work_unit = foundAtWorkUnit;
  }

  recordGapCommit(cost: number | null, gapIndex: number): void {
    this.stats.gap_commits++;
    while (this.stats.committed_costs_per_gap.length <= gapIndex) {
      this.stats.committed_costs_per_gap.push(null);
    }
    this.stats.committed_costs_per_gap[gapIndex] = cost;
    let total = 0;
    for (const value of this.stats.committed_costs_per_gap) {
      total += value ?? 0;
    }
    this.stats.total_committed_cost = total;
  }

  recordGapBacktrack(): void {
    this.stats.gap_backtracks++;
  }

  recordRecoveryPromotion(): void {
    this.stats.recovery_promotions++;
  }

  recordValidationRetry(fromGapIndex?: number): void {
    this.stats.validation_retries++;
    if (fromGapIndex !== undefined) this.stats.validation_retry_from_gaps.push(fromGapIndex);
  }

  recordPolishCandidate(): void {
    this.stats.polish_candidates++;
  }

  recordPolishIteration(): void {
    this.stats.polish_iterations++;
  }
}
