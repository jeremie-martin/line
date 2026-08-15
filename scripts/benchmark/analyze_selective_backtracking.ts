/**
 * Offline counterfactuals for bounded selective-backtracking catch-ups.
 *
 * One behavior-neutral compile archive records like-for-like loss checkpoints
 * along every alternative probe. This tool replays a grid of simple stopping
 * rules over those observations. It does not claim the unexecuted continuation
 * score; it answers the narrower questions we can know exactly:
 *
 *   - how many full-tournament decisions would an early sign have contradicted?
 *   - how much already-measured probe work lay after that sign?
 *   - how stable was the sign at different contact advances?
 *
 * A rule is only a design lead. A compiler arm must still run the real paired
 * cells, because saved work changes subsequent frontier and repair behavior.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { readVerifiedArtifact } from "./study_lib.ts";
import {
  summarizeSelectiveTriggerOpportunities,
  type SelectiveTriggerOpportunityRun,
} from "./selective_trigger_opportunities.ts";

type Outcome =
  | "alternative_selected"
  | "current_selected"
  | "probe_dead_end"
  | "probe_deferred"
  | "execution_ceiling";

type Checkpoint = {
  route_ordinal: number;
  route_kind: "causal_alternative" | "local_discrepancy";
  alternative_ordinal: number;
  gap_index: number;
  contact_advance: number;
  probe_nodes_processed: number;
  probe_frames: number;
  current_axis_loss: number;
  alternative_axis_loss: number;
  alternative_axis_loss_gain: number;
};

type Event = {
  sourceId: string;
  seed: number;
  trigger_signal: "branch_regret" | "repair_incumbent_regret" | "periodic_exploration";
  lane: "initial" | "snapshot" | "repair" | "resumed";
  trigger_axis_loss: number;
  incumbent_axis_loss: number | null;
  incumbent_axis_loss_delta: number | null;
  repair_attempt_index: number | null;
  admissible_rewind_choices: RewindChoice[];
  from_gap_index: number;
  catchup_outcome: Outcome;
  catchup_probe_frames: number;
  alternative_conservative_deadline_margin: number;
  catchup_alternatives_requested: number;
  catchup_selected_alternative_ordinal: number | null;
  catchup_selected_route_ordinal: number | null;
  catchup_yielded_route_ordinal: number | null;
  catchup_yielded_route_total_spent_frames: number | null;
  catchup_yielded_route_resumed_total_spent_frames: number | null;
  catchup_additional_probes_skipped_after_first_winner: number;
  catchup_probe_results: ProbeResult[];
  catchup_checkpoints: Checkpoint[];
  local_fallback_telemetry: boolean;
};

type RewindChoice = {
  branch_gap_index: number;
  alternative_gap_index: number;
  contact_advance: number;
  gap_rewind: number;
  axis_loss_delta: number;
  conservative_deadline_margin: number;
};

type ProbeResult = {
  route_ordinal: number;
  route_kind: "causal_alternative" | "local_discrepancy";
  discrepancy_depth: 0 | 1 | 2;
  parent_route_ordinal: number | null;
  parent_local_fallback_choice_ordinal: number | null;
  alternative_ordinal: number;
  outcome:
    | "reached_target"
    | "probe_dead_end"
    | "probe_deferred"
    | "probe_yielded"
    | "execution_ceiling";
  end_gap_index: number;
  probe_nodes_processed: number;
  probe_frames: number;
  axis_loss: number | null;
  local_fallback_choices: LocalFallbackChoice[];
};

type LocalFallbackChoice = {
  choice_ordinal: number;
  gap_index: number;
  remaining_gap_advance: number;
  current_relative_axis_loss_gain: number;
  conservative_deadline_margin: number;
};

type RuleMode = "reject_alternative" | "accept_alternative";

type RuleResult = {
  mode: RuleMode;
  earliest_contact_advance: number;
  minimum_axis_loss_advantage: number;
  actions: number;
  aligned_actions: number;
  contradictory_actions: number;
  contradiction_rate: number | null;
  measured_probe_frames_after_action: number;
  mean_measured_frames_after_action: number | null;
  affected_sources: string[];
};

const REPAIR_INCUMBENT_THRESHOLDS = ["0.00", "0.01", "0.02", "0.05", "0.10"] as const;
const REPAIR_INCUMBENT_MATURITY_ADVANCES = ["2", "3", "4", "5", "6"] as const;
type RepairIncumbentOpportunityRun = {
  sourceId: string;
  seed: number;
  maxDelta: number;
  counts: Record<string, { crossed_watches: number; admissible_watches: number }>;
};
type RepairIncumbentAttemptLimitRun = {
  sourceId: string;
  seed: number;
  backtracks: number;
  suppressedWatches: number;
};
type RepairIncumbentMaturityRun = {
  sourceId: string;
  seed: number;
  counts: Record<string, { crossed_watches: number; admissible_watches: number }>;
};

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const archivePath = argument("archive");
if (archivePath === undefined) {
  throw new Error(`usage: --archive=<scale-study.json[.gz]> [--out=<analysis.json>]`);
}

const verified = readVerifiedArtifact(resolve(archivePath));
const archive = JSON.parse(verified.bytes.toString("utf8"));
const events: Event[] = [];
const triggerRuns: SelectiveTriggerOpportunityRun[] = [];
const repairIncumbentRuns: RepairIncumbentOpportunityRun[] = [];
const repairIncumbentAttemptLimitRuns: RepairIncumbentAttemptLimitRun[] = [];
const repairIncumbentMaturityRuns: RepairIncumbentMaturityRun[] = [];
for (const row of archive.runs ?? []) {
  const stats = row.stats?.handoff_selective_backtracking;
  validateTournamentTelemetry(stats, `${row.task.sourceId}/seed-${row.task.actualSeed}`);
  if (stats?.regret_opportunities_by_min_axis_loss_delta !== undefined) {
    triggerRuns.push({
      sourceId: row.task.sourceId,
      seed: row.task.actualSeed,
      stats,
    });
  }
  if (stats?.repair_incumbent_regret_opportunities_by_min_axis_loss_delta !== undefined) {
    repairIncumbentRuns.push({
      sourceId: row.task.sourceId,
      seed: row.task.actualSeed,
      maxDelta: stats.repair_incumbent_axis_loss_delta_max,
      counts: stats.repair_incumbent_regret_opportunities_by_min_axis_loss_delta,
    });
  }
  if (stats?.policy === "selective_axis_regret_catchup_repair_incumbent_once") {
    repairIncumbentAttemptLimitRuns.push({
      sourceId: row.task.sourceId,
      seed: row.task.actualSeed,
      backtracks: stats.selective_backtracks_by_signal.repair_incumbent_regret,
      suppressedWatches: stats.repair_incumbent_attempt_limit_suppressed_watches,
    });
  }
  if (stats?.repair_incumbent_regret_opportunities_by_min_contact_advance !== undefined) {
    repairIncumbentMaturityRuns.push({
      sourceId: row.task.sourceId,
      seed: row.task.actualSeed,
      counts: stats.repair_incumbent_regret_opportunities_by_min_contact_advance,
    });
  }
  for (const event of stats?.events ?? []) {
    if (event.catchup_outcome === null) continue;
    const probeResults = (event.catchup_probe_results ?? []).map((probe: any, index: number) => ({
      ...probe,
      route_ordinal: probe.route_ordinal ?? index + 1,
      route_kind: probe.route_kind ?? "causal_alternative",
      discrepancy_depth: probe.discrepancy_depth ??
        ((probe.route_kind ?? "causal_alternative") === "causal_alternative" ? 0 : 1),
      parent_route_ordinal: probe.parent_route_ordinal ?? null,
      parent_local_fallback_choice_ordinal:
        probe.parent_local_fallback_choice_ordinal ?? null,
      local_fallback_choices: (probe.local_fallback_choices ?? []).map(
        (choice: any, choiceIndex: number) => ({
          ...choice,
          choice_ordinal: choice.choice_ordinal ?? choiceIndex + 1,
        }),
      ),
    }));
    const selectedAlternativeOrdinal = event.catchup_selected_alternative_ordinal ?? null;
    const selectedRouteOrdinal = event.catchup_selected_route_ordinal ?? (
      selectedAlternativeOrdinal === null
        ? null
        : probeResults.find(
          (probe: ProbeResult) =>
            probe.route_kind === "causal_alternative" &&
            probe.alternative_ordinal === selectedAlternativeOrdinal,
        )?.route_ordinal ?? null
    );
    events.push({
      sourceId: row.task.sourceId,
      seed: row.task.actualSeed,
      trigger_signal: event.trigger_signal ?? "branch_regret",
      lane: event.lane,
      trigger_axis_loss: event.trigger_axis_loss,
      incumbent_axis_loss: event.incumbent_axis_loss ?? null,
      incumbent_axis_loss_delta: event.incumbent_axis_loss_delta ?? null,
      repair_attempt_index: event.repair_attempt_index ?? null,
      admissible_rewind_choices: event.admissible_rewind_choices ?? [],
      from_gap_index: event.from_gap_index,
      catchup_outcome: event.catchup_outcome,
      catchup_probe_frames: event.catchup_probe_frames,
      alternative_conservative_deadline_margin:
        event.alternative_conservative_deadline_margin,
      catchup_alternatives_requested: event.catchup_alternatives_requested ?? 1,
      catchup_selected_alternative_ordinal: selectedAlternativeOrdinal,
      catchup_selected_route_ordinal: selectedRouteOrdinal,
      catchup_yielded_route_ordinal: event.catchup_yielded_route_ordinal ?? null,
      catchup_yielded_route_total_spent_frames:
        event.catchup_yielded_route_total_spent_frames ?? null,
      catchup_yielded_route_resumed_total_spent_frames:
        event.catchup_yielded_route_resumed_total_spent_frames ?? null,
      catchup_additional_probes_skipped_after_first_winner:
        event.catchup_additional_probes_skipped_after_first_winner ?? 0,
      catchup_probe_results: probeResults,
      catchup_checkpoints: (event.catchup_checkpoints ?? []).map((checkpoint: any) => ({
        ...checkpoint,
        route_ordinal: checkpoint.route_ordinal ?? checkpoint.alternative_ordinal ?? 1,
        route_kind: checkpoint.route_kind ?? "causal_alternative",
        alternative_ordinal: checkpoint.alternative_ordinal ?? 1,
      })),
      local_fallback_telemetry:
        probeResults.length > 0 &&
        (event.catchup_probe_results ?? []).every(
          (probe: any) => Array.isArray(probe.local_fallback_choices),
        ),
    });
  }
}

const earliestAdvances = [2, 3, 4, 5, 6, 8];
const advantages = [0, 0.0025, 0.005, 0.01, 0.02, 0.03, 0.05];
// A checkpoint rule predicts one alternative's eventual binary disposition.
// Multi-sibling and local-discrepancy tournaments contain several routes and
// one final winner, so feeding primary-route checkpoints through the old
// binary rule would silently change meaning.
const guardEvents = events.filter((event) =>
  event.catchup_alternatives_requested === 1 &&
  event.catchup_probe_results.every((probe) => probe.route_kind === "causal_alternative")
);
const rules = (["reject_alternative", "accept_alternative"] as const).flatMap((mode) =>
  earliestAdvances.flatMap((earliest) => advantages.map((advantage) =>
    evaluateRule(guardEvents, mode, earliest, advantage)
  ))
);
const zeroContradiction = rules
  .filter((rule) => rule.actions > 0 && rule.contradictory_actions === 0)
  .sort(ruleOrder);
const exploratory = rules
  .filter((rule) => rule.actions > 0)
  .sort((a, b) =>
    a.contradiction_rate! - b.contradiction_rate! || ruleOrder(a, b)
  );

const completedTournaments = events.filter((event) =>
  event.catchup_outcome === "alternative_selected" || event.catchup_outcome === "current_selected"
);
const guardCompleted = guardEvents.filter((event) =>
  event.catchup_outcome === "alternative_selected" || event.catchup_outcome === "current_selected"
);
const stability = earliestAdvances.map((advance) => {
  let observed = 0;
  let signMatchesFinal = 0;
  let alternativeSigns = 0;
  for (const event of guardCompleted) {
    const checkpoint = checkpointAt(event, advance);
    if (checkpoint === undefined) continue;
    observed++;
    const predictsAlternative = checkpoint.alternative_axis_loss_gain > 0;
    if (predictsAlternative) alternativeSigns++;
    if (predictsAlternative === (event.catchup_outcome === "alternative_selected")) {
      signMatchesFinal++;
    }
  }
  return {
    contact_advance: advance,
    observed,
    alternative_signs: alternativeSigns,
    sign_matches_final: signMatchesFinal,
    agreement_rate: observed === 0 ? null : signMatchesFinal / observed,
  };
});

const byOutcome = Object.fromEntries(
  [...new Set(events.map((event) => event.catchup_outcome))].sort().map((outcome) => [
    outcome,
    events.filter((event) => event.catchup_outcome === outcome).length,
  ]),
);
const bySource = [...new Set(events.map((event) => event.sourceId))].sort().map((sourceId) => {
  const sourceEvents = events.filter((event) => event.sourceId === sourceId);
  return {
    source_id: sourceId,
    events: sourceEvents.length,
    probe_frames: sourceEvents.reduce((sum, event) => sum + event.catchup_probe_frames, 0),
    outcomes: Object.fromEntries(
      [...new Set(sourceEvents.map((event) => event.catchup_outcome))].sort().map((outcome) => [
        outcome,
        sourceEvents.filter((event) => event.catchup_outcome === outcome).length,
      ]),
    ),
  };
}).sort((a, b) => b.events - a.events || a.source_id.localeCompare(b.source_id));

const admissionMarginCounterfactuals = [2, 2.1, 2.2, 2.25, 2.3, 2.4, 2.5].map(
  (minimumMargin) => {
    const suppressed = events.filter(
      (event) => event.alternative_conservative_deadline_margin < minimumMargin,
    );
    const countOutcome = (outcome: Outcome): number =>
      suppressed.filter((event) => event.catchup_outcome === outcome).length;
    return {
      minimum_conservative_margin: minimumMargin,
      suppressed_events: suppressed.length,
      suppressed_alternative_selected: countOutcome("alternative_selected"),
      suppressed_current_selected: countOutcome("current_selected"),
      suppressed_probe_dead_ends: countOutcome("probe_dead_end"),
      suppressed_probe_deferred: countOutcome("probe_deferred"),
      suppressed_execution_ceiling: countOutcome("execution_ceiling"),
      measured_probe_frames_in_suppressed_events: suppressed.reduce(
        (sum, event) => sum + event.catchup_probe_frames,
        0,
      ),
      affected_sources: [...new Set(suppressed.map((event) => event.sourceId))].sort(),
    };
  },
);

const multiSiblingEvents = events.filter((event) => event.catchup_alternatives_requested > 1);
const multiSiblingProbes = multiSiblingEvents.flatMap((event) => event.catchup_probe_results);
const multiSiblingSummary = {
  tournaments: multiSiblingEvents.length,
  probes: multiSiblingProbes.length,
  target_reaches: multiSiblingProbes.filter((probe) => probe.outcome === "reached_target").length,
  dead_ends: multiSiblingProbes.filter((probe) => probe.outcome === "probe_dead_end").length,
  deferred: multiSiblingProbes.filter((probe) => probe.outcome === "probe_deferred").length,
  execution_ceiling: multiSiblingProbes.filter((probe) => probe.outcome === "execution_ceiling").length,
  current_selected: multiSiblingEvents.filter(
    (event) => event.catchup_outcome === "current_selected",
  ).length,
  any_alternative_selected: multiSiblingEvents.filter(
    (event) => event.catchup_outcome === "alternative_selected",
  ).length,
  additional_alternative_selected: multiSiblingEvents.filter(
    (event) => (event.catchup_selected_alternative_ordinal ?? 0) > 1,
  ).length,
  additional_probes_skipped_after_first_winner: multiSiblingEvents.reduce(
    (sum, event) => sum + event.catchup_additional_probes_skipped_after_first_winner,
    0,
  ),
  probe_frames: multiSiblingEvents.reduce((sum, event) => sum + event.catchup_probe_frames, 0),
};

const mappedBranchChoiceEvents = events.filter((event) =>
  event.trigger_signal === "branch_regret" && event.admissible_rewind_choices.length > 0
);
const choiceWinnerIndex = (
  event: Event,
  value: (choice: RewindChoice) => number,
): number => event.admissible_rewind_choices.reduce(
  (best, choice, index, choices) =>
    value(choice) > value(choices[best]!) ? index : best,
  0,
);
const summarizeChoicePolicy = (
  name: string,
  value: (choice: RewindChoice) => number,
) => {
  const differing = mappedBranchChoiceEvents.filter((event) => choiceWinnerIndex(event, value) > 0);
  return {
    policy: name,
    differing_events: differing.length,
    affected_runs: new Set(differing.map((event) => `${event.sourceId}/${event.seed}`)).size,
    affected_sources: [...new Set(differing.map((event) => event.sourceId))].sort(),
  };
};
const branchPointChoiceMap = mappedBranchChoiceEvents.length === 0 ? null : {
  events: mappedBranchChoiceEvents.length,
  choices: mappedBranchChoiceEvents.reduce(
    (sum, event) => sum + event.admissible_rewind_choices.length,
    0,
  ),
  multiple_choice_events: mappedBranchChoiceEvents.filter(
    (event) => event.admissible_rewind_choices.length > 1,
  ).length,
  maximum_choices: Math.max(...mappedBranchChoiceEvents.map(
    (event) => event.admissible_rewind_choices.length,
  )),
  alternatives_to_nearest: [
    summarizeChoicePolicy("maximum_regret", (choice) => choice.axis_loss_delta),
    summarizeChoicePolicy(
      "maximum_regret_per_estimated_work",
      (choice) => choice.axis_loss_delta * choice.conservative_deadline_margin,
    ),
    summarizeChoicePolicy(
      "minimum_estimated_work",
      (choice) => choice.conservative_deadline_margin,
    ),
  ],
  caveat:
    "Deadline margin is remaining frames divided by the sibling's conservative suffix-cost " +
    "estimate. Within one event, maximizing regret times margin therefore maximizes regret per " +
    "estimated frame up to a common remaining-budget factor. This map changes no traversal.",
};

const localFallbackTelemetryEvents = events.filter((event) => event.local_fallback_telemetry);
const summarizeLocalFallbackOutcome = (outcome: Outcome) => {
  const selectedEvents = localFallbackTelemetryEvents.filter(
    (event) => event.trigger_signal === "branch_regret" && event.catchup_outcome === outcome,
  );
  const choices = selectedEvents.flatMap(
    (event) => event.catchup_probe_results
      .filter((probe) => probe.route_kind === "causal_alternative")
      .flatMap((probe) => probe.local_fallback_choices),
  );
  const positiveChoices = choices.filter(
    (choice) => choice.current_relative_axis_loss_gain > 0,
  );
  const actionableEvents = selectedEvents.filter((event) =>
    event.catchup_probe_results.some((probe) =>
      probe.route_kind === "causal_alternative" &&
      probe.local_fallback_choices.some(
        (choice) => choice.current_relative_axis_loss_gain > 0,
      )
    )
  );
  return {
    events: selectedEvents.length,
    admissible_local_fallback_choices: choices.length,
    positive_prefix_gain_choices: positiveChoices.length,
    events_with_positive_prefix_gain_choice: actionableEvents.length,
    affected_runs: new Set(
      actionableEvents.map((event) => `${event.sourceId}/${event.seed}`),
    ).size,
    affected_sources: [...new Set(actionableEvents.map((event) => event.sourceId))].sort(),
  };
};
const oneDiscrepancyOpportunityMap = localFallbackTelemetryEvents.length === 0 ? null : {
  telemetry_events: localFallbackTelemetryEvents.length,
  current_selected: summarizeLocalFallbackOutcome("current_selected"),
  probe_dead_end: summarizeLocalFallbackOutcome("probe_dead_end"),
  proposed_policy:
    "After a primary catch-up reaches equal depth but loses, take at most one already-generated " +
    "inner runner-up with positive axis-loss gain over the suspended prefix at that runner-up's " +
    "depth; maximize gain times conservative deadline margin and keep stable generation-order ties.",
  caveat:
    "Every listed runner-up was live and outside deadline pressure when its primary probe ended. " +
    "Positive local gain is an exact prefix comparison, not evidence that greedily extending that " +
    "runner-up to the tournament target will win or improve the final track.",
};
const localDiscrepancyEvents = events.filter((event) =>
  event.catchup_probe_results.some((probe) => probe.route_kind === "local_discrepancy")
);
const losingLocalRoutes = localDiscrepancyEvents.flatMap((event) =>
  event.catchup_outcome !== "current_selected" ? [] : event.catchup_probe_results
    .filter(
      (probe) =>
        probe.route_kind === "local_discrepancy" &&
        probe.discrepancy_depth === 1 &&
        probe.outcome === "reached_target",
    )
    .map((probe) => ({ event, probe }))
);
const nestedDiscrepancyOpportunityMap = losingLocalRoutes.length === 0 ? null : (() => {
  const choices = losingLocalRoutes.flatMap(({ event, probe }) =>
    probe.local_fallback_choices.map((choice) => ({ event, probe, choice }))
  );
  const positiveProperChoices = choices.filter(
    ({ choice }) =>
      choice.current_relative_axis_loss_gain > 0 && choice.remaining_gap_advance > 0,
  );
  const actionable = losingLocalRoutes.filter(({ probe }) =>
    probe.local_fallback_choices.some(
      (choice) =>
        choice.current_relative_axis_loss_gain > 0 && choice.remaining_gap_advance > 0,
    )
  );
  return {
    losing_local_routes: losingLocalRoutes.length,
    admissible_nested_choices: choices.length,
    positive_proper_nested_choices: positiveProperChoices.length,
    actionable_routes: actionable.length,
    affected_runs: new Set(actionable.map(
      ({ event }) => `${event.sourceId}/${event.seed}`,
    )).size,
    affected_sources: [...new Set(actionable.map(({ event }) => event.sourceId))].sort(),
    proposed_policy:
      "Only after the first proper local route reaches equal depth and loses, take at most one " +
      "already-generated inner runner-up with positive incumbent-relative prefix gain and " +
      "nonzero remaining advance; use the same stable gain-times-deadline-margin choice, " +
      "extend to the original target, and make one final strict equal-depth comparison.",
    caveat:
      "These nested nodes remain live in the ordinary frontier. Their prefix gain and breadth " +
      "are exact, but their unexecuted equal-depth quality and downstream score are unknown.",
  };
})();
const oneDiscrepancyExecution = localDiscrepancyEvents.length === 0 ? null : {
  tournaments: localDiscrepancyEvents.length,
  probes: localDiscrepancyEvents.flatMap((event) => event.catchup_probe_results).filter(
    (probe) => probe.route_kind === "local_discrepancy",
  ).length,
  first_level_probes: localDiscrepancyEvents.flatMap(
    (event) => event.catchup_probe_results,
  ).filter((probe) => probe.discrepancy_depth === 1).length,
  nested_probes: localDiscrepancyEvents.flatMap((event) => event.catchup_probe_results).filter(
    (probe) => probe.discrepancy_depth === 2,
  ).length,
  target_reaches: localDiscrepancyEvents.flatMap((event) => event.catchup_probe_results).filter(
    (probe) => probe.route_kind === "local_discrepancy" && probe.outcome === "reached_target",
  ).length,
  yielded_to_ordinary_frontier: localDiscrepancyEvents.flatMap(
    (event) => event.catchup_probe_results,
  ).filter(
    (probe) => probe.route_kind === "local_discrepancy" && probe.outcome === "probe_yielded",
  ).length,
  yielded_routes_resumed: localDiscrepancyEvents.filter(
    (event) => event.catchup_yielded_route_resumed_total_spent_frames !== null,
  ).length,
  selected: localDiscrepancyEvents.filter((event) => {
    const selected = event.catchup_probe_results.find(
      (probe) => probe.route_ordinal === event.catchup_selected_route_ordinal,
    );
    return selected?.route_kind === "local_discrepancy";
  }).length,
  nested_selected: localDiscrepancyEvents.filter((event) => {
    const selected = event.catchup_probe_results.find(
      (probe) => probe.route_ordinal === event.catchup_selected_route_ordinal,
    );
    return selected?.discrepancy_depth === 2;
  }).length,
  current_retained_after_discrepancy: localDiscrepancyEvents.filter(
    (event) => event.catchup_outcome === "current_selected",
  ).length,
  affected_runs: new Set(
    localDiscrepancyEvents.map((event) => `${event.sourceId}/${event.seed}`),
  ).size,
  affected_sources: [...new Set(localDiscrepancyEvents.map((event) => event.sourceId))].sort(),
};
const localRouteProgress = localDiscrepancyEvents.flatMap((event) =>
  event.catchup_probe_results
    .filter((probe) => probe.route_kind === "local_discrepancy" && probe.discrepancy_depth === 1)
    .map((probe) => {
      const checkpoints = event.catchup_checkpoints.filter(
        (checkpoint) =>
          checkpoint.route_ordinal === probe.route_ordinal &&
          checkpoint.gap_index < event.from_gap_index,
      );
      const firstSignReversal = checkpoints.find(
        (checkpoint) => checkpoint.alternative_axis_loss_gain <= 0,
      );
      const targetGain = probe.axis_loss === null
        ? null
        : event.trigger_axis_loss - probe.axis_loss;
      return { event, probe, checkpoints, firstSignReversal, targetGain };
    })
);
const signReversals = localRouteProgress.filter(
  (observation) => observation.firstSignReversal !== undefined,
);
const firstPersistentNonpositive = (
  checkpoints: Checkpoint[],
  requiredStreak: number,
): Checkpoint | undefined => {
  let streak = 0;
  let previousGap: number | null = null;
  for (const checkpoint of checkpoints) {
    const consecutive = previousGap === null || checkpoint.gap_index === previousGap + 1;
    streak = checkpoint.alternative_axis_loss_gain <= 0 && consecutive ? streak + 1
      : checkpoint.alternative_axis_loss_gain <= 0 ? 1
      : 0;
    previousGap = checkpoint.gap_index;
    if (streak >= requiredStreak) return checkpoint;
  }
  return undefined;
};
const persistentSignRows = [1, 2, 3, 4].map((requiredStreak) => {
  const observations = localRouteProgress.flatMap((observation) => {
    const checkpoint = firstPersistentNonpositive(observation.checkpoints, requiredStreak);
    return checkpoint === undefined ? [] : [{ ...observation, checkpoint }];
  });
  const targetObserved = observations.filter((observation) => observation.targetGain !== null);
  return {
    required_successive_nonpositive_checkpoints: requiredStreak,
    routes: observations.length,
    routes_with_target_observed: targetObserved.length,
    recovered_to_strict_target_win: targetObserved.filter(
      (observation) => observation.targetGain! > 0,
    ).length,
    did_not_recover_to_strict_target_win: targetObserved.filter(
      (observation) => observation.targetGain! <= 0,
    ).length,
    measured_probe_frames_after_confirmation: observations.reduce(
      (sum, observation) =>
        sum + Math.max(0, observation.probe.probe_frames - observation.checkpoint.probe_frames),
      0,
    ),
    affected_runs: new Set(observations.map(
      (observation) => `${observation.event.sourceId}/${observation.event.seed}`,
    )).size,
    affected_sources: [...new Set(observations.map(
      (observation) => observation.event.sourceId,
    ))].sort(),
  };
});
const localRouteProgressMap = localRouteProgress.length === 0 ? null : {
  routes: localRouteProgress.length,
  routes_with_intermediate_checkpoint: localRouteProgress.filter(
    (observation) => observation.checkpoints.length > 0,
  ).length,
  first_nonpositive_sign: {
    routes: signReversals.length,
    recovered_to_strict_target_win: signReversals.filter(
      (observation) => (observation.targetGain ?? -Infinity) > 0,
    ).length,
    did_not_recover_to_strict_target_win: signReversals.filter(
      (observation) => !((observation.targetGain ?? -Infinity) > 0),
    ).length,
    measured_probe_frames_after_sign: signReversals.reduce(
      (sum, observation) =>
        sum + Math.max(
          0,
          observation.probe.probe_frames - observation.firstSignReversal!.probe_frames,
        ),
      0,
    ),
    affected_runs: new Set(signReversals.map(
      (observation) => `${observation.event.sourceId}/${observation.event.seed}`,
    )).size,
    affected_sources: [...new Set(signReversals.map(
      (observation) => observation.event.sourceId,
    ))].sort(),
  },
  persistent_nonpositive_sign: persistentSignRows,
  caveat:
    "A local route starts from an exactly positive same-depth prefix gain. A sign reversal is " +
    "the first later authored-gap checkpoint at which its cumulative axis loss is no better " +
    "than the suspended prefix through that same gap. Remaining measured work and target " +
    "recovery are observations of the completed route, not a causal replay of stopping it.",
};

const result = {
  schema: "line.selective-backtracking-offline-guard-analysis.v1",
  source_archive: archivePath,
  source_archive_sha256: verified.artifactSha256,
  scope: {
    runs: archive.runs?.length ?? 0,
    events: events.length,
    events_with_checkpoints: events.filter((event) => event.catchup_checkpoints.length > 0).length,
    single_alternative_events_for_checkpoint_rules: guardEvents.length,
    completed_tournaments: completedTournaments.length,
    single_alternative_completed_tournaments_for_checkpoint_rules: guardCompleted.length,
    outcomes: byOutcome,
    trigger_signals: Object.fromEntries(
      (["branch_regret", "repair_incumbent_regret", "periodic_exploration"] as const)
        .map((signal) => [
        signal,
        events.filter((event) => event.trigger_signal === signal).length,
      ]),
    ),
  },
  by_source: bySource,
  multi_sibling: multiSiblingSummary,
  branch_point_choice_map: branchPointChoiceMap,
  one_discrepancy_opportunity_map: oneDiscrepancyOpportunityMap,
  nested_discrepancy_opportunity_map: nestedDiscrepancyOpportunityMap,
  one_discrepancy_execution: oneDiscrepancyExecution,
  local_route_progress_map: localRouteProgressMap,
  admission_margin_counterfactuals: admissionMarginCounterfactuals,
  trigger_opportunities: triggerRuns.length === 0 ? null : {
    coverage: {
      archive_runs: archive.runs?.length ?? 0,
      telemetry_runs: triggerRuns.length,
    },
    ...summarizeSelectiveTriggerOpportunities(triggerRuns),
  },
  repair_incumbent_regret_opportunities: repairIncumbentRuns.length === 0
    ? null
    : summarizeRepairIncumbentOpportunities(repairIncumbentRuns),
  repair_incumbent_attempt_limit: repairIncumbentAttemptLimitRuns.length === 0
    ? null
    : summarizeRepairIncumbentAttemptLimit(repairIncumbentAttemptLimitRuns),
  repair_incumbent_maturity_opportunities: repairIncumbentMaturityRuns.length === 0
    ? null
    : summarizeRepairIncumbentMaturityOpportunities(repairIncumbentMaturityRuns),
  checkpoint_sign_stability: stability,
  zero_contradiction_rules: zeroContradiction,
  exploratory_rules: exploratory,
  caveat:
    "Offline rules classify the observed full-tournament winner and measured remaining probe work only. " +
    "They do not estimate the score or later frontier/repair effects of actually stopping early. " +
    "Admission-margin rows likewise describe observed tournaments; they are not causal replay. " +
    "Checkpoint rules exclude every multi-route tournament (additional causal siblings or a " +
    "local discrepancy) because one primary-route checkpoint cannot label the final route winner.",
};

function summarizeRepairIncumbentMaturityOpportunities(
  runs: readonly RepairIncumbentMaturityRun[],
) {
  const sourceIds = [...new Set(runs.map((run) => run.sourceId))];
  const summarize = (selected: readonly RepairIncumbentMaturityRun[], advance: string) => {
    const values = selected.map((run) => run.counts[advance]!);
    return {
      crossed_watches: values.reduce((sum, value) => sum + value.crossed_watches, 0),
      admissible_watches: values.reduce((sum, value) => sum + value.admissible_watches, 0),
      runs_with_admissible_watch: values.filter((value) => value.admissible_watches > 0).length,
    };
  };
  for (const run of runs) {
    let previous: { crossed_watches: number; admissible_watches: number } | null = null;
    for (const advance of REPAIR_INCUMBENT_MATURITY_ADVANCES) {
      const current = run.counts[advance];
      if (
        current === undefined ||
        !Number.isSafeInteger(current.crossed_watches) || current.crossed_watches < 0 ||
        !Number.isSafeInteger(current.admissible_watches) || current.admissible_watches < 0 ||
        current.admissible_watches > current.crossed_watches
      ) {
        throw new Error(`${run.sourceId}/seed-${run.seed} has invalid maturity-${advance} counts`);
      }
      if (
        previous !== null &&
        (current.crossed_watches > previous.crossed_watches ||
          current.admissible_watches > previous.admissible_watches)
      ) {
        throw new Error(`${run.sourceId}/seed-${run.seed} maturity counts are not nested`);
      }
      previous = current;
    }
  }
  return {
    coverage: { runs: runs.length, sources: sourceIds.length },
    by_min_contact_advance: Object.fromEntries(REPAIR_INCUMBENT_MATURITY_ADVANCES.map(
      (advance) => {
        const summary = summarize(runs, advance);
        const activeSources = new Set(runs.filter(
          (run) => run.counts[advance]!.admissible_watches > 0,
        ).map((run) => run.sourceId));
        return [advance, { ...summary, sources_with_admissible_watch: activeSources.size }];
      },
    )),
    by_source: sourceIds.map((sourceId) => {
      const sourceRuns = runs.filter((run) => run.sourceId === sourceId);
      return {
        source_id: sourceId,
        runs: sourceRuns.length,
        by_min_contact_advance: Object.fromEntries(REPAIR_INCUMBENT_MATURITY_ADVANCES.map(
          (advance) => [advance, summarize(sourceRuns, advance)],
        )),
      };
    }).sort((left, right) =>
      right.by_min_contact_advance["4"]!.admissible_watches -
        left.by_min_contact_advance["4"]!.admissible_watches ||
      left.source_id.localeCompare(right.source_id)
    ),
    trust_checks: {
      nonnegative_integer_counts: true,
      admissible_not_above_crossed: true,
      nested_minimum_maturity_counts: true,
    },
    caveat:
      "Each row counts a causal watch once when a repair descendant at or beyond the stated " +
      "contact advance exceeds the fixed incumbent-loss delta of 0.02. It maps a delayed " +
      "policy's possible action set; it does not replay downstream scores.",
  };
}

function summarizeRepairIncumbentAttemptLimit(
  runs: readonly RepairIncumbentAttemptLimitRun[],
) {
  const active = runs.filter((run) => run.backtracks > 0 || run.suppressedWatches > 0);
  const sourceIds = [...new Set(active.map((run) => run.sourceId))].sort();
  return {
    runs: runs.length,
    backtracks: active.reduce((sum, run) => sum + run.backtracks, 0),
    suppressed_watches: active.reduce((sum, run) => sum + run.suppressedWatches, 0),
    runs_with_backtrack: active.filter((run) => run.backtracks > 0).length,
    runs_with_suppression: active.filter((run) => run.suppressedWatches > 0).length,
    sources_with_activity: sourceIds.length,
    by_source: sourceIds.map((sourceId) => {
      const sourceRuns = active.filter((run) => run.sourceId === sourceId);
      return {
        source_id: sourceId,
        backtracks: sourceRuns.reduce((sum, run) => sum + run.backtracks, 0),
        suppressed_watches: sourceRuns.reduce((sum, run) => sum + run.suppressedWatches, 0),
        active_runs: sourceRuns.length,
      };
    }).sort((left, right) =>
      right.suppressed_watches - left.suppressed_watches ||
      right.backtracks - left.backtracks ||
      left.source_id.localeCompare(right.source_id)
    ),
    trust_checks: {
      at_most_one_backtrack_per_repair_attempt: true,
      nonnegative_suppression_counts: true,
    },
  };
}

function summarizeRepairIncumbentOpportunities(
  runs: readonly RepairIncumbentOpportunityRun[],
) {
  for (const run of runs) {
    if (!Number.isFinite(run.maxDelta) || run.maxDelta < 0) {
      throw new Error(`${run.sourceId}/seed-${run.seed} has invalid incumbent-regret maximum`);
    }
    let previous: { crossed_watches: number; admissible_watches: number } | null = null;
    for (const threshold of REPAIR_INCUMBENT_THRESHOLDS) {
      const current = run.counts[threshold];
      if (current === undefined) {
        throw new Error(`${run.sourceId}/seed-${run.seed} lacks threshold ${threshold}`);
      }
      if (
        !Number.isSafeInteger(current.crossed_watches) || current.crossed_watches < 0 ||
        !Number.isSafeInteger(current.admissible_watches) || current.admissible_watches < 0 ||
        current.admissible_watches > current.crossed_watches
      ) {
        throw new Error(`${run.sourceId}/seed-${run.seed} has invalid threshold ${threshold}`);
      }
      if (
        previous !== null &&
        (current.crossed_watches > previous.crossed_watches ||
          current.admissible_watches > previous.admissible_watches)
      ) {
        throw new Error(`${run.sourceId}/seed-${run.seed} incumbent-regret counts are not nested`);
      }
      previous = current;
    }
  }
  const sum = (values: readonly number[]) => values.reduce((total, value) => total + value, 0);
  const summarizeThreshold = (
    sourceRuns: readonly RepairIncumbentOpportunityRun[],
    threshold: typeof REPAIR_INCUMBENT_THRESHOLDS[number],
  ) => ({
    crossed_watches: sum(sourceRuns.map((run) => run.counts[threshold]!.crossed_watches)),
    admissible_watches: sum(sourceRuns.map((run) => run.counts[threshold]!.admissible_watches)),
    runs_with_admissible_watch: sourceRuns.filter(
      (run) => run.counts[threshold]!.admissible_watches > 0,
    ).length,
  });
  const sourceIds = [...new Set(runs.map((run) => run.sourceId))];
  return {
    coverage: { runs: runs.length, sources: sourceIds.length },
    max_axis_loss_delta: Math.max(...runs.map((run) => run.maxDelta)),
    thresholds: Object.fromEntries(REPAIR_INCUMBENT_THRESHOLDS.map((threshold) => {
      const summary = summarizeThreshold(runs, threshold);
      const activeSources = new Set(runs.filter(
        (run) => run.counts[threshold]!.admissible_watches > 0,
      ).map((run) => run.sourceId));
      return [threshold, { ...summary, sources_with_admissible_watch: activeSources.size }];
    })),
    by_source: sourceIds.map((sourceId) => {
      const sourceRuns = runs.filter((run) => run.sourceId === sourceId);
      return {
        source_id: sourceId,
        runs: sourceRuns.length,
        thresholds: Object.fromEntries(REPAIR_INCUMBENT_THRESHOLDS.map(
          (threshold) => [threshold, summarizeThreshold(sourceRuns, threshold)],
        )),
      };
    }).sort((left, right) =>
      right.thresholds["0.02"]!.admissible_watches -
        left.thresholds["0.02"]!.admissible_watches ||
      left.source_id.localeCompare(right.source_id)
    ),
    trust_checks: {
      nonnegative_integer_counts: true,
      admissible_not_above_crossed: true,
      nested_threshold_counts: true,
    },
    caveat:
      "Each row is a unique causal watch observed during production repair traversal. " +
      "An admissible watch had its exact sibling live and enough conservative deadline margin. " +
      "The map sizes possible actions; it does not replay their downstream scores.",
  };
}

function validateTournamentTelemetry(stats: any, runKey: string): void {
  if (stats === undefined || !Array.isArray(stats.events)) return;
  const instrumented = stats.events.filter(
    (event: any) => Array.isArray(event.catchup_probe_results),
  );
  if (instrumented.length === 0) return;
  const probes: ProbeResult[] = [];
  const mappedChoiceEvents: any[] = [];
  for (let eventIndex = 0; eventIndex < instrumented.length; eventIndex++) {
    const event = instrumented[eventIndex];
    const label = `${runKey}/event-${eventIndex}`;
    const requested = event.catchup_alternatives_requested;
    const triggerSignal = event.trigger_signal ?? "branch_regret";
    if (
      triggerSignal !== "branch_regret" &&
      triggerSignal !== "repair_incumbent_regret" &&
      triggerSignal !== "periodic_exploration"
    ) {
      throw new Error(`${label} has invalid trigger signal`);
    }
    if (event.admissible_rewind_choices !== undefined) {
      if (!Array.isArray(event.admissible_rewind_choices) || event.admissible_rewind_choices.length < 1) {
        throw new Error(`${label} has no admissible rewind choice`);
      }
      const choices = event.admissible_rewind_choices as RewindChoice[];
      const selected = choices[0]!;
      if (
        selected.branch_gap_index !== event.branch_gap_index ||
        selected.alternative_gap_index !== event.alternative_gap_index ||
        selected.contact_advance !== event.contact_advance ||
        selected.gap_rewind !== event.gap_rewind ||
        Math.abs(selected.axis_loss_delta - event.axis_loss_delta) > 1e-12 ||
        Math.abs(
          selected.conservative_deadline_margin -
            event.alternative_conservative_deadline_margin,
        ) > 1e-12
      ) {
        throw new Error(`${label} first rewind choice does not match the selected sibling`);
      }
      for (const choice of choices) {
        if (
          !Number.isSafeInteger(choice.branch_gap_index) ||
          !Number.isSafeInteger(choice.alternative_gap_index) ||
          !Number.isSafeInteger(choice.contact_advance) || choice.contact_advance < 2 ||
          !Number.isSafeInteger(choice.gap_rewind) || choice.gap_rewind < 0 ||
          !Number.isFinite(choice.axis_loss_delta) ||
          !Number.isFinite(choice.conservative_deadline_margin)
        ) {
          throw new Error(`${label} has an invalid admissible rewind choice`);
        }
      }
      mappedChoiceEvents.push(event);
    }
    if (triggerSignal === "repair_incumbent_regret") {
      if (
        event.lane !== "repair" ||
        typeof event.incumbent_axis_loss !== "number" ||
        typeof event.incumbent_axis_loss_delta !== "number" ||
        Math.abs(
          event.trigger_axis_loss - event.incumbent_axis_loss -
            event.incumbent_axis_loss_delta,
        ) > 1e-12 ||
        !(event.incumbent_axis_loss_delta > 0.02)
      ) {
        throw new Error(`${label} has inconsistent repair-incumbent trigger evidence`);
      }
      if (
        stats.policy === "selective_axis_regret_catchup_repair_incumbent_once" &&
        (!Number.isSafeInteger(event.repair_attempt_index) || event.repair_attempt_index < 0)
      ) {
        throw new Error(`${label} has no valid repair attempt attribution`);
      }
    }
    if (triggerSignal === "periodic_exploration") {
      const budget = event.periodic_budget;
      if (
        (stats.policy === "selective_axis_regret_catchup_periodic_initial" &&
          event.lane !== "initial") ||
        (stats.policy === "selective_axis_regret_catchup_periodic_repair" &&
          event.lane !== "repair") ||
        event.contact_advance !== stats.periodic_contact_rewind ||
        budget?.admitted !== true || budget?.reason !== "admitted"
      ) {
        throw new Error(`${label} has inconsistent periodic trigger evidence`);
      }
    }
    if (!Number.isSafeInteger(requested) || requested < 1) {
      throw new Error(`${label} has invalid catchup_alternatives_requested`);
    }
    const results = event.catchup_probe_results.map((probe: any, index: number) => ({
      ...probe,
      route_ordinal: probe.route_ordinal ?? index + 1,
      route_kind: probe.route_kind ?? "causal_alternative",
      discrepancy_depth: probe.discrepancy_depth ??
        ((probe.route_kind ?? "causal_alternative") === "causal_alternative" ? 0 : 1),
      parent_route_ordinal: probe.parent_route_ordinal ?? null,
      parent_local_fallback_choice_ordinal:
        probe.parent_local_fallback_choice_ordinal ?? null,
      local_fallback_choices: (probe.local_fallback_choices ?? []).map(
        (choice: any, choiceIndex: number) => ({
          ...choice,
          choice_ordinal: choice.choice_ordinal ?? choiceIndex + 1,
        }),
      ),
    })) as ProbeResult[];
    const skipped = event.catchup_additional_probes_skipped_after_first_winner ?? 0;
    if (!Number.isSafeInteger(skipped) || skipped < 0 || skipped >= requested) {
      throw new Error(`${label} has invalid skipped-after-first-winner count`);
    }
    if (event.catchup_outcome !== null && results.length === 0) {
      throw new Error(`${label} completed without a probe result`);
    }
    const routeOrdinals = new Set<number>();
    const causalAlternativeOrdinals = new Set<number>();
    const routesByOrdinal = new Map<number, ProbeResult>();
    for (const probe of results) {
      if (
        !Number.isSafeInteger(probe.route_ordinal) ||
        probe.route_ordinal < 1 ||
        routeOrdinals.has(probe.route_ordinal) ||
        (probe.route_kind !== "causal_alternative" && probe.route_kind !== "local_discrepancy") ||
        ![0, 1, 2].includes(probe.discrepancy_depth) ||
        !Number.isSafeInteger(probe.alternative_ordinal) ||
        probe.alternative_ordinal < 1 ||
        probe.alternative_ordinal > requested
      ) {
        throw new Error(`${label} has invalid probe route identity`);
      }
      if (probe.route_kind === "causal_alternative") {
        if (
          probe.discrepancy_depth !== 0 ||
          probe.parent_route_ordinal !== null ||
          probe.parent_local_fallback_choice_ordinal !== null ||
          causalAlternativeOrdinals.has(probe.alternative_ordinal)
        ) {
          throw new Error(`${label} has invalid causal-alternative route identity`);
        }
        causalAlternativeOrdinals.add(probe.alternative_ordinal);
      } else {
        const parent = routesByOrdinal.get(probe.parent_route_ordinal ?? -1);
        const parentChoice = parent?.local_fallback_choices.find(
          (choice) =>
            choice.choice_ordinal === probe.parent_local_fallback_choice_ordinal,
        );
        if (
          (probe.discrepancy_depth !== 1 && probe.discrepancy_depth !== 2) ||
          parent === undefined ||
          parent.discrepancy_depth !== probe.discrepancy_depth - 1 ||
          parent.alternative_ordinal !== probe.alternative_ordinal ||
          parentChoice === undefined ||
          !(parentChoice.current_relative_axis_loss_gain > 0)
        ) {
          throw new Error(`${label} has invalid local-discrepancy parent route`);
        }
        const eligibleParentChoices = parent.local_fallback_choices.filter((choice) =>
          choice.current_relative_axis_loss_gain > 0 &&
          (
            (
              stats.policy !== "selective_axis_regret_catchup_proper_discrepancy" &&
              stats.policy !== "selective_axis_regret_catchup_yielding_discrepancy" &&
              stats.policy !== "selective_axis_regret_catchup_nested_discrepancy_map" &&
              stats.policy !== "selective_axis_regret_catchup_nested_discrepancy"
            ) ||
            choice.remaining_gap_advance > 0
          )
        );
        const bestChoice = eligibleParentChoices
          .reduce<LocalFallbackChoice | null>(
            (best, choice) =>
              best === null ||
                choice.current_relative_axis_loss_gain * choice.conservative_deadline_margin >
                  best.current_relative_axis_loss_gain * best.conservative_deadline_margin
                ? choice
                : best,
            null,
          );
        if (bestChoice?.choice_ordinal !== parentChoice.choice_ordinal) {
          throw new Error(`${label} local discrepancy did not select maximum value per work`);
        }
      }
      routeOrdinals.add(probe.route_ordinal);
      routesByOrdinal.set(probe.route_ordinal, probe);
      if (probe.local_fallback_choices !== undefined) {
        if (!Array.isArray(probe.local_fallback_choices)) {
          throw new Error(`${label} has invalid local fallback choices`);
        }
        if (
          probe.route_kind === "local_discrepancy" &&
          probe.local_fallback_choices.length > 0 &&
          stats.policy !== "selective_axis_regret_catchup_nested_discrepancy_map" &&
          stats.policy !== "selective_axis_regret_catchup_nested_discrepancy"
        ) {
          throw new Error(`${label} legacy local route unexpectedly records nested choices`);
        }
        const choiceOrdinals = new Set<number>();
        for (const choice of probe.local_fallback_choices as LocalFallbackChoice[]) {
          if (
            !Number.isSafeInteger(choice.choice_ordinal) || choice.choice_ordinal < 1 ||
            choiceOrdinals.has(choice.choice_ordinal) ||
            !Number.isSafeInteger(choice.gap_index) || choice.gap_index < 0 ||
            !Number.isSafeInteger(choice.remaining_gap_advance) ||
            choice.remaining_gap_advance < 0 ||
            choice.gap_index + choice.remaining_gap_advance !== event.from_gap_index ||
            !Number.isFinite(choice.current_relative_axis_loss_gain) ||
            !Number.isFinite(choice.conservative_deadline_margin)
          ) {
            throw new Error(`${label} has an invalid local fallback choice`);
          }
          choiceOrdinals.add(choice.choice_ordinal);
        }
      }
      probes.push(probe);
    }
    const nodes = results.reduce((sum, probe) => sum + probe.probe_nodes_processed, 0);
    const frames = results.reduce((sum, probe) => sum + probe.probe_frames, 0);
    if (nodes !== event.catchup_probe_nodes_processed || frames !== event.catchup_probe_frames) {
      throw new Error(`${label} probe aggregates disagree with probe_results`);
    }
    const reached = results.filter((probe) => probe.outcome === "reached_target");
    const causalResults = results.filter((probe) => probe.route_kind === "causal_alternative");
    const localDiscrepancyResults = results.filter(
      (probe) => probe.route_kind === "local_discrepancy",
    );
    if (localDiscrepancyResults.length > 0) {
      const causalReached = causalResults.filter((probe) => probe.outcome === "reached_target");
      const firstLocal = localDiscrepancyResults.filter(
        (probe) => probe.discrepancy_depth === 1,
      );
      const nested = localDiscrepancyResults.filter(
        (probe) => probe.discrepancy_depth === 2,
      );
      const nestedPolicy = stats.policy ===
        "selective_axis_regret_catchup_nested_discrepancy";
      if (
        (
          stats.policy !== "selective_axis_regret_catchup_one_discrepancy" &&
          stats.policy !== "selective_axis_regret_catchup_proper_discrepancy" &&
          stats.policy !== "selective_axis_regret_catchup_yielding_discrepancy" &&
          stats.policy !== "selective_axis_regret_catchup_nested_discrepancy_map" &&
          !nestedPolicy
        ) ||
        firstLocal.length !== 1 ||
        (nestedPolicy ? nested.length > 1 : nested.length !== 0) ||
        causalReached.length === 0 ||
        causalReached.some((probe) => probe.axis_loss! < event.trigger_axis_loss) ||
        (
          nested.length === 1 &&
          (
            firstLocal[0]!.outcome !== "reached_target" ||
            firstLocal[0]!.axis_loss! < event.trigger_axis_loss
          )
        ) ||
        (
          (
            stats.policy === "selective_axis_regret_catchup_proper_discrepancy" ||
            stats.policy === "selective_axis_regret_catchup_yielding_discrepancy" ||
            stats.policy === "selective_axis_regret_catchup_nested_discrepancy_map" ||
            nestedPolicy
          ) &&
          localDiscrepancyResults.some((probe) => {
            const parent = results.find(
              (candidate) => candidate.route_ordinal === probe.parent_route_ordinal,
            );
            return parent?.local_fallback_choices.find(
              (choice) =>
                choice.choice_ordinal === probe.parent_local_fallback_choice_ordinal,
            )?.remaining_gap_advance === 0;
          })
        )
      ) {
        throw new Error(`${label} violated the one-discrepancy admission boundary`);
      }
    }
    if (skipped > 0) {
      const first = causalResults.find((probe) => probe.alternative_ordinal === 1);
      if (
        causalResults.length + skipped !== requested ||
        first?.outcome !== "reached_target" ||
        !(first.axis_loss! < event.trigger_axis_loss)
      ) {
        throw new Error(`${label} skipped probes without a strict first-sibling winner`);
      }
    }
    const bestAlternativeLoss = reached.length === 0
      ? null
      : Math.min(...reached.map((probe) => probe.axis_loss as number));
    if (!sameNullableNumber(bestAlternativeLoss, event.catchup_axis_loss)) {
      throw new Error(`${label} best alternative loss disagrees with probe_results`);
    }
    const selected = event.catchup_selected_alternative_ordinal ?? null;
    const selectedRoute = event.catchup_selected_route_ordinal ?? (
      selected === null
        ? null
        : reached.find((probe) =>
          probe.route_kind === "causal_alternative" &&
          probe.alternative_ordinal === selected
        )?.route_ordinal ?? null
    );
    if (event.catchup_outcome === "alternative_selected") {
      const selectedProbe = reached.find((probe) => probe.route_ordinal === selectedRoute);
      if (selectedProbe === undefined || !(selectedProbe.axis_loss! < event.trigger_axis_loss)) {
        throw new Error(`${label} selected alternative is not a strict completed winner`);
      }
      if (selectedProbe.alternative_ordinal !== selected) {
        throw new Error(`${label} selected route and causal alternative disagree`);
      }
      if (selectedProbe.axis_loss !== bestAlternativeLoss) {
        throw new Error(`${label} did not select the lowest-loss alternative`);
      }
    } else if (selected !== null || selectedRoute !== null) {
      throw new Error(`${label} non-alternative outcome names a selected route`);
    } else if (
      event.catchup_outcome === "current_selected" &&
      bestAlternativeLoss !== null &&
      event.trigger_axis_loss > bestAlternativeLoss
    ) {
      throw new Error(`${label} retained current despite a lower-loss completed alternative`);
    }
    const lastCheckpointByRoute = new Map<number, Checkpoint>();
    for (const rawCheckpoint of event.catchup_checkpoints ?? []) {
      const checkpoint: Checkpoint = {
        ...rawCheckpoint,
        route_ordinal:
          rawCheckpoint.route_ordinal ?? rawCheckpoint.alternative_ordinal ?? 1,
        route_kind: rawCheckpoint.route_kind ?? "causal_alternative",
        alternative_ordinal: rawCheckpoint.alternative_ordinal ?? 1,
      };
      const route = routesByOrdinal.get(checkpoint.route_ordinal);
      const previous = lastCheckpointByRoute.get(checkpoint.route_ordinal);
      if (
        route === undefined ||
        checkpoint.route_kind !== route.route_kind ||
        checkpoint.alternative_ordinal !== route.alternative_ordinal ||
        checkpoint.gap_index <= (previous?.gap_index ?? event.branch_gap_index) ||
        checkpoint.gap_index > event.from_gap_index ||
        checkpoint.probe_nodes_processed < (previous?.probe_nodes_processed ?? 0) ||
        checkpoint.probe_nodes_processed > route.probe_nodes_processed ||
        checkpoint.probe_frames < (previous?.probe_frames ?? 0) ||
        checkpoint.probe_frames > route.probe_frames ||
        !Number.isFinite(checkpoint.alternative_axis_loss_gain)
      ) {
        throw new Error(`${label} checkpoint has invalid route attribution`);
      }
      lastCheckpointByRoute.set(checkpoint.route_ordinal, checkpoint);
    }
    const yielded = results.filter((probe) => probe.outcome === "probe_yielded");
    if (yielded.length > 0) {
      const route = yielded[0]!;
      if (
        stats.policy !== "selective_axis_regret_catchup_yielding_discrepancy" ||
        yielded.length !== 1 ||
        yielded[0]!.route_kind !== "local_discrepancy" ||
        yielded[0]!.axis_loss !== null ||
        event.catchup_outcome !== "current_selected" ||
        event.catchup_selected_route_ordinal !== null ||
        event.catchup_yielded_route_ordinal !== route.route_ordinal ||
        !Number.isFinite(event.catchup_yielded_route_total_spent_frames) ||
        (
          event.catchup_yielded_route_resumed_total_spent_frames !== null &&
          (
            !Number.isFinite(event.catchup_yielded_route_resumed_total_spent_frames) ||
            event.catchup_yielded_route_resumed_total_spent_frames <
              event.catchup_yielded_route_total_spent_frames
          )
        )
      ) {
        throw new Error(`${label} has an invalid yielded discrepancy route`);
      }
      const checkpoints = (event.catchup_checkpoints ?? []).filter(
        (checkpoint: any) =>
          (checkpoint.route_ordinal ?? checkpoint.alternative_ordinal ?? 1) ===
            route.route_ordinal,
      ).map((rawCheckpoint: any) => ({
        ...rawCheckpoint,
        route_ordinal: rawCheckpoint.route_ordinal ?? rawCheckpoint.alternative_ordinal ?? 1,
        route_kind: rawCheckpoint.route_kind ?? "causal_alternative",
        alternative_ordinal: rawCheckpoint.alternative_ordinal ?? 1,
      })) as Checkpoint[];
      const confirmation = checkpoints.slice(-3);
      if (
        confirmation.length !== 3 ||
        confirmation.some((checkpoint) => checkpoint.alternative_axis_loss_gain > 0) ||
        confirmation.some(
          (checkpoint, index) =>
            index > 0 && checkpoint.gap_index !== confirmation[index - 1]!.gap_index + 1,
        ) ||
        confirmation[2]!.gap_index !== route.end_gap_index ||
        confirmation[2]!.gap_index >= event.from_gap_index ||
        confirmation[2]!.probe_nodes_processed !== route.probe_nodes_processed ||
        confirmation[2]!.probe_frames !== route.probe_frames
      ) {
        throw new Error(`${label} yielded without three persistent non-positive checkpoints`);
      }
    } else if (
      event.catchup_yielded_route_ordinal !== undefined &&
      (
        event.catchup_yielded_route_ordinal !== null ||
        event.catchup_yielded_route_total_spent_frames !== null ||
        event.catchup_yielded_route_resumed_total_spent_frames !== null
      )
    ) {
      throw new Error(`${label} names a yielded route without a yielded probe`);
    }
  }

  const count = (outcome: ProbeResult["outcome"]): number =>
    probes.filter((probe) => probe.outcome === outcome).length;
  const assertStat = (name: string, expected: number): void => {
    if (stats[name] !== expected) {
      throw new Error(`${runKey} ${name}=${stats[name]} disagrees with event total ${expected}`);
    }
  };
  const assertOptionalStat = (name: string, expected: number): void => {
    if (stats[name] !== undefined) assertStat(name, expected);
  };
  assertStat("catchup_probe_attempts", probes.length);
  assertStat("catchup_probe_target_reaches", count("reached_target"));
  assertStat(
    "catchup_additional_probe_attempts",
    probes.filter(
      (probe) => probe.route_kind === "causal_alternative" && probe.alternative_ordinal > 1,
    ).length,
  );
  assertStat(
    "catchup_additional_probe_target_reaches",
    probes.filter(
      (probe) =>
        probe.route_kind === "causal_alternative" &&
        probe.alternative_ordinal > 1 &&
        probe.outcome === "reached_target",
    ).length,
  );
  assertStat(
    "catchup_tournaments_with_additional_probe",
    instrumented.filter((event: any) => event.catchup_probe_results.length > 1).length,
  );
  assertStat(
    "catchup_additional_alternative_selected",
    instrumented.filter((event: any) =>
      (event.catchup_selected_alternative_ordinal ?? 0) > 1
    ).length,
  );
  // Archives produced before the second-chance policy have no skip counter.
  // If present, however, it must exactly equal the event records.
  assertOptionalStat(
    "catchup_additional_probes_skipped_after_first_winner",
    instrumented.reduce(
      (sum: number, event: any) =>
        sum + (event.catchup_additional_probes_skipped_after_first_winner ?? 0),
      0,
    ),
  );
  assertStat("catchup_probe_dead_ends", count("probe_dead_end"));
  assertStat("catchup_probe_deferred", count("probe_deferred"));
  assertOptionalStat(
    "catchup_local_discrepancy_probe_yields",
    probes.filter(
      (probe) => probe.route_kind === "local_discrepancy" && probe.outcome === "probe_yielded",
    ).length,
  );
  assertOptionalStat(
    "catchup_local_discrepancy_yielded_routes_resumed",
    instrumented.filter(
      (event: any) => event.catchup_yielded_route_resumed_total_spent_frames != null,
    ).length,
  );
  assertStat("catchup_execution_ceiling_stops", count("execution_ceiling"));
  assertStat(
    "catchup_probe_nodes_processed",
    probes.reduce((sum, probe) => sum + probe.probe_nodes_processed, 0),
  );
  assertStat("catchup_probe_frames", probes.reduce((sum, probe) => sum + probe.probe_frames, 0));
  const localFallbackChoices = probes.flatMap(
    (probe) => probe.local_fallback_choices ?? [],
  );
  const positiveLocalFallbackChoices = localFallbackChoices.filter(
    (choice) => choice.current_relative_axis_loss_gain > 0,
  );
  assertOptionalStat(
    "catchup_probes_with_local_fallback_choice",
    probes.filter((probe) => (probe.local_fallback_choices?.length ?? 0) > 0).length,
  );
  assertOptionalStat(
    "catchup_probes_with_positive_local_fallback_choice",
    probes.filter((probe) => probe.local_fallback_choices?.some(
      (choice) => choice.current_relative_axis_loss_gain > 0,
    )).length,
  );
  assertOptionalStat("catchup_local_fallback_choice_count_sum", localFallbackChoices.length);
  assertOptionalStat(
    "catchup_positive_local_fallback_choice_count_sum",
    positiveLocalFallbackChoices.length,
  );
  assertOptionalStat(
    "catchup_local_fallback_choice_count_max",
    probes.length === 0
      ? 0
      : Math.max(...probes.map((probe) => probe.local_fallback_choices?.length ?? 0)),
  );
  assertOptionalStat(
    "catchup_local_discrepancy_probe_attempts",
    probes.filter((probe) => probe.route_kind === "local_discrepancy").length,
  );
  assertOptionalStat(
    "catchup_local_discrepancy_probe_target_reaches",
    probes.filter(
      (probe) => probe.route_kind === "local_discrepancy" && probe.outcome === "reached_target",
    ).length,
  );
  assertOptionalStat(
    "catchup_local_discrepancy_selected",
    instrumented.filter((event: any) => {
      const route = event.catchup_probe_results.find(
        (probe: any) => probe.route_ordinal === event.catchup_selected_route_ordinal,
      );
      return route?.route_kind === "local_discrepancy";
    }).length,
  );
  assertOptionalStat(
    "catchup_nested_discrepancy_probe_attempts",
    probes.filter((probe) => probe.discrepancy_depth === 2).length,
  );
  assertOptionalStat(
    "catchup_nested_discrepancy_probe_target_reaches",
    probes.filter(
      (probe) => probe.discrepancy_depth === 2 && probe.outcome === "reached_target",
    ).length,
  );
  assertOptionalStat(
    "catchup_nested_discrepancy_selected",
    instrumented.filter((event: any) => {
      const route = event.catchup_probe_results.find(
        (probe: any) => probe.route_ordinal === event.catchup_selected_route_ordinal,
      );
      return (route?.discrepancy_depth ?? 1) === 2;
    }).length,
  );
  if (stats.selective_backtracks_by_signal !== undefined) {
    for (const signal of [
      "branch_regret",
      "repair_incumbent_regret",
      "periodic_exploration",
    ] as const) {
      if (
        signal === "periodic_exploration" &&
        stats.selective_backtracks_by_signal[signal] === undefined
      ) continue;
      const expected = instrumented.filter(
        (event: any) => (event.trigger_signal ?? "branch_regret") === signal,
      ).length;
      if (stats.selective_backtracks_by_signal[signal] !== expected) {
        throw new Error(`${runKey} ${signal} action count disagrees with events`);
      }
    }
  }
  if (stats.policy === "selective_axis_regret_catchup_repair_incumbent_once") {
    if (stats.repair_incumbent_max_backtracks_per_attempt !== 1) {
      throw new Error(`${runKey} has an invalid repair-incumbent per-attempt limit`);
    }
    if (
      !Number.isSafeInteger(stats.repair_incumbent_attempt_limit_suppressed_watches) ||
      stats.repair_incumbent_attempt_limit_suppressed_watches < 0
    ) {
      throw new Error(`${runKey} has an invalid repair-incumbent suppression count`);
    }
    const incumbentEvents = instrumented.filter(
      (event: any) => event.trigger_signal === "repair_incumbent_regret",
    );
    const attempts = incumbentEvents.map((event: any) => event.repair_attempt_index);
    if (new Set(attempts).size !== attempts.length) {
      throw new Error(`${runKey} took more than one repair-incumbent action in one attempt`);
    }
  }
  if (stats.admissible_rewind_choice_count_sum !== undefined) {
    const choiceCount = mappedChoiceEvents.reduce(
      (sum, event) => sum + event.admissible_rewind_choices.length,
      0,
    );
    const multiple = mappedChoiceEvents.filter(
      (event) => event.admissible_rewind_choices.length > 1,
    ).length;
    const maximum = mappedChoiceEvents.length === 0
      ? 0
      : Math.max(...mappedChoiceEvents.map((event) => event.admissible_rewind_choices.length));
    if (
      stats.admissible_rewind_choice_count_sum !== choiceCount ||
      stats.selective_backtracks_with_multiple_admissible_rewind_choices !== multiple ||
      stats.admissible_rewind_choice_count_max !== maximum
    ) {
      throw new Error(`${runKey} admissible rewind choice aggregates disagree with events`);
    }
  }
}

function sameNullableNumber(left: number | null, right: unknown): boolean {
  return left === null ? right === null : typeof right === "number" && Math.abs(left - right) < 1e-12;
}

print(result);
const out = argument("out");
if (out !== undefined) {
  const absolute = resolve(out);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`\nanalysis ${absolute}`);
}

function checkpointAt(event: Event, earliest: number): Checkpoint | undefined {
  return event.catchup_checkpoints.find((checkpoint) =>
    checkpoint.contact_advance >= earliest &&
    checkpoint.gap_index < event.from_gap_index &&
    checkpoint.probe_frames < event.catchup_probe_frames
  );
}

function evaluateRule(
  sourceEvents: Event[],
  mode: RuleMode,
  earliest: number,
  advantage: number,
): RuleResult {
  let actions = 0;
  let aligned = 0;
  let contradictory = 0;
  let frames = 0;
  const sources = new Set<string>();
  for (const event of sourceEvents) {
    const checkpoint = event.catchup_checkpoints.find((candidate) => {
      if (
        candidate.contact_advance < earliest ||
        candidate.gap_index >= event.from_gap_index ||
        candidate.probe_frames >= event.catchup_probe_frames
      ) return false;
      return mode === "reject_alternative"
        ? candidate.alternative_axis_loss_gain <= -advantage
        : candidate.alternative_axis_loss_gain >= advantage;
    });
    if (checkpoint === undefined) continue;
    actions++;
    sources.add(event.sourceId);
    const agrees = mode === "reject_alternative"
      ? event.catchup_outcome !== "alternative_selected"
      : event.catchup_outcome === "alternative_selected";
    if (agrees) aligned++;
    else contradictory++;
    frames += Math.max(0, event.catchup_probe_frames - checkpoint.probe_frames);
  }
  return {
    mode,
    earliest_contact_advance: earliest,
    minimum_axis_loss_advantage: advantage,
    actions,
    aligned_actions: aligned,
    contradictory_actions: contradictory,
    contradiction_rate: actions === 0 ? null : contradictory / actions,
    measured_probe_frames_after_action: frames,
    mean_measured_frames_after_action: actions === 0 ? null : frames / actions,
    affected_sources: [...sources].sort(),
  };
}

function ruleOrder(a: RuleResult, b: RuleResult): number {
  return b.measured_probe_frames_after_action - a.measured_probe_frames_after_action ||
    b.actions - a.actions ||
    a.earliest_contact_advance - b.earliest_contact_advance ||
    a.minimum_axis_loss_advantage - b.minimum_axis_loss_advantage ||
    a.mode.localeCompare(b.mode);
}

function print(analysis: typeof result): void {
  console.log(`SELECTIVE BACKTRACKING OFFLINE GUARD ANALYSIS`);
  console.log(
    `  ${analysis.scope.runs} runs; ${analysis.scope.events} events; ` +
    `${analysis.scope.events_with_checkpoints} with checkpoints; ` +
    `${analysis.scope.completed_tournaments} completed tournaments`,
  );
  console.log(`  outcomes ${JSON.stringify(analysis.scope.outcomes)}`);
  console.log(`  trigger signals ${JSON.stringify(analysis.scope.trigger_signals)}`);
  if (analysis.multi_sibling.tournaments > 0) {
    console.log(
      `  multi-sibling ${analysis.multi_sibling.tournaments} tournaments; ` +
      `${analysis.multi_sibling.probes} probes; ` +
      `${analysis.multi_sibling.additional_alternative_selected} selected sibling #2+`,
    );
  }
  if (analysis.branch_point_choice_map !== null) {
    const choices = analysis.branch_point_choice_map;
    console.log(
      `  branch-point map ${choices.choices} admissible choices across ${choices.events} events; ` +
      `${choices.multiple_choice_events} events have alternatives; max ${choices.maximum_choices}`,
    );
    for (const policy of choices.alternatives_to_nearest) {
      console.log(
        `    ${policy.policy.padEnd(36)} differs ${String(policy.differing_events).padStart(4)} ` +
        `events; ${policy.affected_runs} runs / ${policy.affected_sources.length} sources`,
      );
    }
  }
  if (analysis.one_discrepancy_opportunity_map !== null) {
    const map = analysis.one_discrepancy_opportunity_map;
    console.log(`  one-discrepancy map ${map.telemetry_events} instrumented events`);
    console.log(
      `    current retained: ${map.current_selected.events} events; ` +
      `${map.current_selected.admissible_local_fallback_choices} local choices, ` +
      `${map.current_selected.events_with_positive_prefix_gain_choice} actionable; ` +
      `${map.current_selected.affected_runs} runs / ` +
      `${map.current_selected.affected_sources.length} sources`,
    );
    console.log(
      `    primary dead end: ${map.probe_dead_end.events} events; ` +
      `${map.probe_dead_end.admissible_local_fallback_choices} local choices, ` +
      `${map.probe_dead_end.events_with_positive_prefix_gain_choice} actionable`,
    );
  }
  if (analysis.one_discrepancy_execution !== null) {
    const live = analysis.one_discrepancy_execution;
    console.log(
      `  one-discrepancy execution ${live.probes} probes in ${live.tournaments} tournaments; ` +
      `${live.target_reaches} reached target, ${live.selected} selected, ` +
      `${live.current_retained_after_discrepancy} retained current`,
    );
    if (live.nested_probes > 0) {
      console.log(
        `    ${live.first_level_probes} first-level and ${live.nested_probes} nested routes; ` +
        `${live.nested_selected} nested routes selected`,
      );
    }
    if (live.yielded_to_ordinary_frontier > 0) {
      console.log(
        `    ${live.yielded_to_ordinary_frontier} local routes yielded to frontier; ` +
        `${live.yielded_routes_resumed} later resumed`,
      );
    }
  }
  if (analysis.nested_discrepancy_opportunity_map !== null) {
    const nested = analysis.nested_discrepancy_opportunity_map;
    console.log(
      `  nested-discrepancy map ${nested.positive_proper_nested_choices} positive proper ` +
      `choices across ${nested.actionable_routes}/${nested.losing_local_routes} losing routes; ` +
      `${nested.affected_runs} runs / ${nested.affected_sources.length} sources`,
    );
  }
  if (analysis.local_route_progress_map !== null) {
    const progress = analysis.local_route_progress_map;
    const reversal = progress.first_nonpositive_sign;
    console.log(
      `  local-route progress ${progress.routes_with_intermediate_checkpoint}/` +
      `${progress.routes} routes have an intermediate checkpoint; first sign reversal in ` +
      `${reversal.routes}, ${reversal.recovered_to_strict_target_win} recover; ` +
      `${reversal.measured_probe_frames_after_sign} measured frames follow`,
    );
    for (const row of progress.persistent_nonpositive_sign) {
      console.log(
        `    streak ${row.required_successive_nonpositive_checkpoints}: ` +
        `${row.routes} routes; ${row.recovered_to_strict_target_win}/` +
        `${row.routes_with_target_observed} recover; ` +
        `${row.affected_runs} runs / ${row.affected_sources.length} sources; ` +
        `${row.measured_probe_frames_after_confirmation} frames follow confirmation`,
      );
    }
  }
  console.log(`\nCONSERVATIVE-MARGIN ADMISSION COUNTERFACTUALS`);
  for (const row of analysis.admission_margin_counterfactuals) {
    console.log(
      `  margin ${row.minimum_conservative_margin.toFixed(2)}: suppress ` +
      `${String(row.suppressed_events).padStart(3)} events; alternative/current/other ` +
      `${row.suppressed_alternative_selected}/${row.suppressed_current_selected}/` +
      `${row.suppressed_probe_dead_ends + row.suppressed_probe_deferred +
        row.suppressed_execution_ceiling}; measured frames ` +
      `${String(row.measured_probe_frames_in_suppressed_events).padStart(9)}`,
    );
  }
  if (analysis.trigger_opportunities !== null) {
    console.log(`\nTRIGGER OPPORTUNITIES (PRODUCTION TRAVERSAL)`);
    console.log(
      `  telemetry coverage ${analysis.trigger_opportunities.coverage.telemetry_runs}/` +
      `${analysis.trigger_opportunities.coverage.archive_runs} runs`,
    );
    for (const row of analysis.trigger_opportunities.thresholds) {
      console.log(
        `  delta ${row.min_axis_loss_delta.toFixed(2)}: crossed ${String(row.crossed_watches).padStart(4)}, ` +
        `admissible ${String(row.admissible_watches).padStart(4)}, ` +
        `additional vs 0.20 ${String(row.additional_admissible_vs_production).padStart(4)}; ` +
        `${row.runs_with_admissible_watch} runs / ${row.sources_with_admissible_watch} sources`,
      );
    }
    console.log(`  leading sources at 0.15:`);
    for (const row of analysis.trigger_opportunities.by_source
      .filter((entry) => entry.thresholds["0.15"]!.additional_admissible_vs_production > 0)
      .slice(0, 12)) {
      const threshold = row.thresholds["0.15"]!;
      console.log(
        `    ${row.source_id.padEnd(56)} ` +
        `admissible ${String(threshold.admissible_watches).padStart(4)}, ` +
        `additional ${String(threshold.additional_admissible_vs_production).padStart(4)}, ` +
        `runs ${threshold.runs_with_admissible_watch}/${row.runs}`,
      );
    }
  }
  if (analysis.repair_incumbent_regret_opportunities !== null) {
    const opportunity = analysis.repair_incumbent_regret_opportunities;
    console.log(`\nREPAIR-INCUMBENT REGRET OPPORTUNITIES`);
    console.log(
      `  telemetry coverage ${opportunity.coverage.runs}/${analysis.scope.runs} runs; ` +
      `${opportunity.coverage.sources} sources; max delta ${opportunity.max_axis_loss_delta.toFixed(4)}`,
    );
    for (const threshold of REPAIR_INCUMBENT_THRESHOLDS) {
      const row = opportunity.thresholds[threshold]!;
      console.log(
        `  delta > ${threshold}: crossed ${String(row.crossed_watches).padStart(4)}, ` +
        `admissible ${String(row.admissible_watches).padStart(4)}; ` +
        `${row.runs_with_admissible_watch} runs / ${row.sources_with_admissible_watch} sources`,
      );
    }
    const leaders = opportunity.by_source.filter(
      (row) => row.thresholds["0.02"]!.admissible_watches > 0,
    ).slice(0, 8);
    if (leaders.length > 0) {
      console.log(`  leading sources at delta > 0.02:`);
      for (const row of leaders) {
        console.log(
          `    ${row.source_id.padEnd(56)} ` +
          `admissible ${String(row.thresholds["0.02"]!.admissible_watches).padStart(4)}, ` +
          `runs ${row.thresholds["0.02"]!.runs_with_admissible_watch}/${row.runs}`,
        );
      }
    }
  }
  if (analysis.repair_incumbent_attempt_limit !== null) {
    const limit = analysis.repair_incumbent_attempt_limit;
    console.log(`\nREPAIR-INCUMBENT PER-ATTEMPT LIMIT`);
    console.log(
      `  ${limit.backtracks} actions in ${limit.runs_with_backtrack}/${limit.runs} runs; ` +
      `${limit.suppressed_watches} later eligible watches suppressed in ` +
      `${limit.runs_with_suppression} runs; ${limit.sources_with_activity} active sources`,
    );
    for (const row of limit.by_source.slice(0, 8)) {
      console.log(
        `    ${row.source_id.padEnd(56)} actions ${String(row.backtracks).padStart(3)}, ` +
        `suppressed ${String(row.suppressed_watches).padStart(4)}, active runs ${row.active_runs}`,
      );
    }
  }
  if (analysis.repair_incumbent_maturity_opportunities !== null) {
    const maturity = analysis.repair_incumbent_maturity_opportunities;
    console.log(`\nREPAIR-INCUMBENT MATURITY OPPORTUNITIES (DELTA > 0.02)`);
    console.log(
      `  telemetry coverage ${maturity.coverage.runs}/${analysis.scope.runs} runs; ` +
      `${maturity.coverage.sources} sources`,
    );
    for (const advance of REPAIR_INCUMBENT_MATURITY_ADVANCES) {
      const row = maturity.by_min_contact_advance[advance]!;
      console.log(
        `  advance >= ${advance}: crossed ${String(row.crossed_watches).padStart(4)}, ` +
        `admissible ${String(row.admissible_watches).padStart(4)}; ` +
        `${row.runs_with_admissible_watch} runs / ${row.sources_with_admissible_watch} sources`,
      );
    }
  }
  console.log(`\nCHECKPOINT SIGN VS FULL-DEPTH WINNER`);
  for (const row of analysis.checkpoint_sign_stability) {
    console.log(
      `  advance ${String(row.contact_advance).padStart(2)}: ${String(row.observed).padStart(4)} observed; ` +
      `${row.agreement_rate === null ? "-" : `${(100 * row.agreement_rate).toFixed(1)}%`} agreement`,
    );
  }
  console.log(`\nBEST ZERO-CONTRADICTION RULES`);
  for (const rule of analysis.zero_contradiction_rules.slice(0, 12)) printRule(rule);
  console.log(`\nLOWEST-CONTRADICTION EXPLORATORY RULES`);
  for (const rule of analysis.exploratory_rules.slice(0, 12)) printRule(rule);
  console.log(`\n  ${analysis.caveat}`);
}

function printRule(rule: RuleResult): void {
  console.log(
    `  ${rule.mode.padEnd(18)} after ${String(rule.earliest_contact_advance).padStart(2)} ` +
    `margin ${rule.minimum_axis_loss_advantage.toFixed(4)}: actions ${String(rule.actions).padStart(4)}, ` +
    `contradictions ${String(rule.contradictory_actions).padStart(3)}, ` +
    `measured tail ${String(Math.round(rule.measured_probe_frames_after_action)).padStart(9)} frames`,
  );
}
