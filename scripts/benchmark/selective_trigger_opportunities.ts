export const SELECTIVE_TRIGGER_OPPORTUNITY_THRESHOLDS = [
  "0.05",
  "0.10",
  "0.15",
  "0.20",
] as const;

export type SelectiveTriggerOpportunityStats = {
  min_axis_loss_delta: number;
  min_conservative_deadline_margin?: number | null;
  lower_trigger_max_gap_rewind?: number | null;
  mature_axis_loss_delta_max: number;
  loss_threshold_crossings: number;
  selective_backtracks: number;
  regret_opportunities_by_min_axis_loss_delta: Record<
    string,
    { crossed_watches: number; admissible_watches: number }
  >;
};

export type SelectiveTriggerOpportunityRun = {
  sourceId: string;
  seed: number;
  stats: SelectiveTriggerOpportunityStats;
};

export type SelectiveTriggerOpportunitySummary = {
  runs: number;
  sources: number;
  mature_axis_loss_delta_max: number;
  thresholds: Array<{
    min_axis_loss_delta: number;
    crossed_watches: number;
    admissible_watches: number;
    additional_admissible_vs_production: number;
    runs_with_crossing: number;
    runs_with_admissible_watch: number;
    sources_with_admissible_watch: number;
  }>;
  by_source: Array<{
    source_id: string;
    runs: number;
    thresholds: Record<
      string,
      {
        crossed_watches: number;
        admissible_watches: number;
        additional_admissible_vs_production: number;
        runs_with_admissible_watch: number;
      }
    >;
  }>;
  trust_checks: {
    nested_threshold_counts: true;
    active_threshold_crossings_match: true;
    unconditional_active_threshold_admissions_match: true;
  };
  caveat: string;
};

const PRODUCTION_THRESHOLD = "0.20";

/** Aggregate behavior-neutral trigger opportunities while enforcing the
 * identities that make the counters interpretable. Lower-threshold counts are
 * an offline action-set bound, not a replay: taking one action would alter all
 * later search state. */
export function summarizeSelectiveTriggerOpportunities(
  runs: readonly SelectiveTriggerOpportunityRun[],
): SelectiveTriggerOpportunitySummary {
  if (runs.length === 0) throw new Error("trigger opportunity analysis requires runs");
  for (const run of runs) validateRun(run);

  const productionByRun = new Map(runs.map((run) => [
    runKey(run),
    counts(run, PRODUCTION_THRESHOLD).admissible_watches,
  ]));
  const thresholds = SELECTIVE_TRIGGER_OPPORTUNITY_THRESHOLDS.map((threshold) => {
    const perRun = runs.map((run) => counts(run, threshold));
    const sources = new Set<string>();
    for (let index = 0; index < runs.length; index++) {
      if (perRun[index]!.admissible_watches > 0) sources.add(runs[index]!.sourceId);
    }
    return {
      min_axis_loss_delta: Number(threshold),
      crossed_watches: sum(perRun.map((entry) => entry.crossed_watches)),
      admissible_watches: sum(perRun.map((entry) => entry.admissible_watches)),
      additional_admissible_vs_production: sum(runs.map((run, index) =>
        perRun[index]!.admissible_watches - productionByRun.get(runKey(run))!
      )),
      runs_with_crossing: perRun.filter((entry) => entry.crossed_watches > 0).length,
      runs_with_admissible_watch: perRun.filter((entry) => entry.admissible_watches > 0).length,
      sources_with_admissible_watch: sources.size,
    };
  });

  const sourceIds = [...new Set(runs.map((run) => run.sourceId))];
  const bySource = sourceIds.map((sourceId) => {
    const sourceRuns = runs.filter((run) => run.sourceId === sourceId);
    const productionAdmissions = sum(sourceRuns.map((run) =>
      counts(run, PRODUCTION_THRESHOLD).admissible_watches
    ));
    const sourceThresholds = Object.fromEntries(
      SELECTIVE_TRIGGER_OPPORTUNITY_THRESHOLDS.map((threshold) => {
        const perRun = sourceRuns.map((run) => counts(run, threshold));
        const admissible = sum(perRun.map((entry) => entry.admissible_watches));
        return [threshold, {
          crossed_watches: sum(perRun.map((entry) => entry.crossed_watches)),
          admissible_watches: admissible,
          additional_admissible_vs_production: admissible - productionAdmissions,
          runs_with_admissible_watch: perRun.filter((entry) => entry.admissible_watches > 0).length,
        }];
      }),
    );
    return { source_id: sourceId, runs: sourceRuns.length, thresholds: sourceThresholds };
  }).sort((left, right) =>
    right.thresholds["0.15"]!.additional_admissible_vs_production -
      left.thresholds["0.15"]!.additional_admissible_vs_production ||
    right.thresholds["0.15"]!.admissible_watches -
      left.thresholds["0.15"]!.admissible_watches ||
    left.source_id.localeCompare(right.source_id)
  );

  return {
    runs: runs.length,
    sources: sourceIds.length,
    mature_axis_loss_delta_max: Math.max(...runs.map((run) =>
      run.stats.mature_axis_loss_delta_max
    )),
    thresholds,
    by_source: bySource,
    trust_checks: {
      nested_threshold_counts: true,
      active_threshold_crossings_match: true,
      unconditional_active_threshold_admissions_match: true,
    },
    caveat:
      "Each threshold is observed on production traversal. Counts are unique causal watches, " +
      "but opportunities are not jointly replayable because taking an earlier backtrack changes later traversal.",
  };
}

function validateRun(run: SelectiveTriggerOpportunityRun): void {
  let previous: { crossed_watches: number; admissible_watches: number } | null = null;
  for (const threshold of SELECTIVE_TRIGGER_OPPORTUNITY_THRESHOLDS) {
    const current = counts(run, threshold);
    for (const [name, value] of Object.entries(current)) {
      if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`${runKey(run)} ${threshold} ${name} is not a non-negative integer`);
      }
    }
    if (current.admissible_watches > current.crossed_watches) {
      throw new Error(`${runKey(run)} ${threshold} has more admissible than crossed watches`);
    }
    if (
      previous !== null &&
      (current.crossed_watches > previous.crossed_watches ||
        current.admissible_watches > previous.admissible_watches)
    ) {
      throw new Error(`${runKey(run)} opportunity counts are not nested by threshold`);
    }
    previous = current;
  }
  const activeThreshold = run.stats.min_axis_loss_delta.toFixed(2);
  const active = counts(run, activeThreshold);
  if (active.crossed_watches !== run.stats.loss_threshold_crossings) {
    throw new Error(`${runKey(run)} active-threshold crossing counters disagree`);
  }
  if (run.stats.selective_backtracks > active.admissible_watches) {
    throw new Error(`${runKey(run)} has more actions than active-threshold admissions`);
  }
  const hasConditionalAdmission =
    run.stats.lower_trigger_max_gap_rewind != null ||
    run.stats.min_conservative_deadline_margin != null;
  if (!hasConditionalAdmission && active.admissible_watches !== run.stats.selective_backtracks) {
    throw new Error(`${runKey(run)} active-threshold admission counters disagree`);
  }
}

function counts(
  run: SelectiveTriggerOpportunityRun,
  threshold: string,
): { crossed_watches: number; admissible_watches: number } {
  const value = run.stats.regret_opportunities_by_min_axis_loss_delta[threshold];
  if (value === undefined) throw new Error(`${runKey(run)} is missing threshold ${threshold}`);
  return value;
}

function runKey(run: SelectiveTriggerOpportunityRun): string {
  return `${run.sourceId}/seed-${run.seed}`;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
