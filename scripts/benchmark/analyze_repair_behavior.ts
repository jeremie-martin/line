/**
 * Audit the independent repair controller from retained Budget Telemetry V9.
 *
 * This is deliberately not a score comparison. It checks controller invariants,
 * measures global-incumbent and temporary-working-track lineage, and
 * characterizes budget associations.
 * Claims that the current archive cannot establish are reported as evidence
 * limits instead of being reconstructed from the final track.
 */
import { createHash } from "node:crypto";
import { createReadStream, existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { writeFileAtomicDurable } from "../v0/benchmark_v2/durable_fs.ts";
import {
  BUDGET_TELEMETRY_SCHEMA,
  replayBudgetRepairSelection,
  type BudgetEpisodeTelemetry,
  type BudgetRepairGapState,
  type CompileBudgetTelemetry,
} from "../v0/optimizer/budget_telemetry.ts";

export const REPAIR_BEHAVIOR_SCHEMA = "line.benchmark-v2.repair-behavior.v6" as const;

type RunRow = {
  task: { sourceId: string; budget: number; actualSeed: number };
  status?: string;
  budgetTelemetry?: CompileBudgetTelemetry | null;
};

type RepairEntry = { run: RunRow; episode: BudgetEpisodeTelemetry };

type AuditCheck = {
  checked: number;
  violations: number;
  examples: string[];
};

export type RepairBehaviorGroup = {
  runs: number;
  runsWithRepair: number;
  repairEpisodes: number;
  repairEpisodesPerRun: number;
  terminalReached: number;
  terminalReachedRate: number | null;
  acceptedAlternatives: number;
  acceptedPerTerminalRate: number | null;
  censoredEpisodes: number;
  totalRepairSpentFrames: number;
  repairSpentShare: number | null;
  framesPerTerminal: number | null;
  framesPerAcceptedAlternative: number | null;
  meanAffordableTargetCount: number | null;
  meanParentDepth: number | null;
  meanTargetGap: number | null;
  meanTargetGapSse: number | null;
  meanAnchorGap: number | null;
  meanAnchorRemainingFraction: number | null;
  meanAnchorRemainingGaps: number | null;
  meanRemainingBudgetFrames: number | null;
  meanEstimatedUpperUtilization: number | null;
  completionWithinEstimatedUpperRate: number | null;
  completionWithinAllocationRate: number | null;
  terminalGeometryIdentical: number;
  acceptedTerminalGeometryIdentical: number;
  terminalGeometryIdenticalRate: number | null;
  terminalGeometryIdenticalSpentFrames: number;
  terminalGeometryIdenticalSpentShare: number | null;
  firstDivergenceAtAnchorRate: number | null;
  meanDivergentSuffixGaps: number | null;
  terminalOfferTargetGapSseImprovement: number | null;
  terminalOfferTargetGapImprovementRate: number | null;
  terminalOfferTargetGapMissing: number;
  rejectedTerminalOfferTargetGapImproved: number;
  workingTrackBridgeEpisodes: number;
  rejectedLocalImprovementFollowup: Record<string, number>;
  incumbentTargetGapSseImprovement: number | null;
  acceptedTerminalOfferTargetGapImprovementRate: number | null;
  acceptedTerminalOfferTargetGapMissing: number;
  acceptedTerminalOfferTargetGapWorsened: number;
  internalFullScoreDelta: number;
  internalFullScoreDeltaPerMillionRepairFrames: number | null;
  replayableDecisionEpisodes: number;
  directTrackIdentityEpisodes: number;
};

export type RepairBehaviorSlice = {
  repairEpisodes: number;
  terminalReached: number;
  terminalReachedRate: number | null;
  acceptedAlternatives: number;
  acceptedPerTerminalRate: number | null;
  censoredEpisodes: number;
  totalRepairSpentFrames: number;
  framesPerTerminal: number | null;
  framesPerAcceptedAlternative: number | null;
  meanParentDepth: number | null;
  meanTargetGap: number | null;
  meanAnchorGap: number | null;
  meanAnchorRemainingGaps: number | null;
  meanEstimatedUpperUtilization: number | null;
  completionWithinEstimatedUpperRate: number | null;
  terminalGeometryIdentical: number;
  acceptedTerminalGeometryIdentical: number;
  terminalGeometryIdenticalRate: number | null;
  terminalGeometryIdenticalSpentFrames: number;
  terminalGeometryIdenticalSpentShare: number | null;
  firstDivergenceAtAnchorRate: number | null;
  meanDivergentSuffixGaps: number | null;
  acceptedTerminalOfferTargetGapImprovementRate: number | null;
  acceptedTerminalOfferTargetGapMissing: number;
  acceptedTerminalOfferTargetGapWorsened: number;
  internalFullScoreDelta: number;
  internalFullScoreDeltaPerMillionRepairFrames: number | null;
};

export type RepairBehaviorSummary = {
  cells: number;
  budgets: number[];
  invariantAudit: {
    passed: boolean;
    checks: Record<string, AuditCheck>;
  };
  overall: RepairBehaviorGroup;
  perBudget: Array<{ budget: number } & RepairBehaviorGroup>;
  perSource: Array<{ sourceId: string } & RepairBehaviorGroup>;
  perParentDepth: Array<{ parentDepth: number } & RepairBehaviorSlice>;
  perIteration: Array<{ iterationIndex: number } & RepairBehaviorSlice>;
  selection: ReturnType<typeof summarizeSelection>;
  terminalOfferDiversity: ReturnType<typeof summarizeTerminalOfferDiversity>;
  transitions: ReturnType<typeof summarizeTransitions>;
  transitionOutcomes: ReturnType<typeof summarizeTransitionOutcomes>;
  adjacentBudgetAssociations: ReturnType<typeof summarizeAdjacentBudgets>;
  evidenceLimits: string[];
};

class Audit {
  readonly checks = new Map<string, AuditCheck>();

  check(name: string, condition: boolean, context: string): void {
    const entry = this.checks.get(name) ?? { checked: 0, violations: 0, examples: [] };
    entry.checked++;
    if (!condition) {
      entry.violations++;
      if (entry.examples.length < 5) entry.examples.push(context);
    }
    this.checks.set(name, entry);
  }

  result(): RepairBehaviorSummary["invariantAudit"] {
    const checks = Object.fromEntries([...this.checks].sort(([a], [b]) => a.localeCompare(b)));
    return {
      passed: Object.values(checks).every((entry) => entry.violations === 0),
      checks,
    };
  }
}

export function summarizeRepairBehavior(rows: RunRow[]): RepairBehaviorSummary {
  const unique = new Set<string>();
  for (const row of rows) {
    const key = runKey(row);
    if (unique.has(key)) throw new Error(`duplicate scale cell ${key}`);
    unique.add(key);
    telemetry(row);
  }

  const audit = new Audit();
  for (const row of rows) auditRun(row, audit);
  const budgets = [...new Set(rows.map((row) => row.task.budget))].sort((a, b) => a - b);
  const sourceIds = [...new Set(rows.map((row) => row.task.sourceId))].sort();
  const entries = rows.flatMap((run) => repairEpisodes(run).map((episode) => ({ run, episode })));
  const parentDepths = [...new Set(entries.map(({ episode }) =>
    episode.repair_decision!.parent_depth
  ))].sort((a, b) => a - b);
  const iterationIndices = [...new Set(entries.map(({ episode }) =>
    episode.repair_decision!.iteration_index
  ))].sort((a, b) => a - b);
  const overall = summarizeGroup(rows);
  const evidenceLimits = [
    ...(overall.replayableDecisionEpisodes === overall.repairEpisodes ? [] : [
      "Some input archives predate per-target decision observations. For those episodes, worst-among-eligible maximality is covered by selector tests but cannot be replayed solely from the artifact.",
    ]),
    ...(overall.directTrackIdentityEpisodes === overall.repairEpisodes ? [] : [
      "Some input archives predate explicit incumbent and terminal-offer hashes. For those episodes, incumbent revisions and direct arc-geometry divergence remain available, but exact per-iteration track identity is not.",
    ]),
    "Across-budget changes are deterministic policy associations: search breadth and the first incumbent can also change with budget. They are not an isolated causal effect of repair budget.",
  ];
  return {
    cells: rows.length,
    budgets,
    invariantAudit: audit.result(),
    overall,
    perBudget: budgets.map((budget) => ({
      budget,
      ...summarizeGroup(rows.filter((row) => row.task.budget === budget)),
    })),
    perSource: sourceIds.map((sourceId) => ({
      sourceId,
      ...summarizeGroup(rows.filter((row) => row.task.sourceId === sourceId)),
    })),
    perParentDepth: parentDepths.map((parentDepth) => ({
      parentDepth,
      ...summarizeSlice(entries.filter(({ episode }) =>
        episode.repair_decision!.parent_depth === parentDepth
      )),
    })),
    perIteration: iterationIndices.map((iterationIndex) => ({
      iterationIndex,
      ...summarizeSlice(entries.filter(({ episode }) =>
        episode.repair_decision!.iteration_index === iterationIndex
      )),
    })),
    selection: summarizeSelection(entries),
    terminalOfferDiversity: summarizeTerminalOfferDiversity(entries),
    transitions: summarizeTransitions(rows),
    transitionOutcomes: summarizeTransitionOutcomes(rows),
    adjacentBudgetAssociations: summarizeAdjacentBudgets(rows),
    evidenceLimits,
  };
}

function auditRun(row: RunRow, audit: Audit): void {
  const value = telemetry(row);
  const repairs = repairEpisodes(row);
  const context = (episode: BudgetEpisodeTelemetry): string =>
    `${runKey(row)}/iteration=${episode.repair_decision?.iteration_index ?? "missing"}`;
  const seenSeeds = new Set<number>();

  for (let index = 0; index < repairs.length; index++) {
    const episode = repairs[index]!;
    const decision = episode.repair_decision!;
    const label = context(episode);
    const affordable = decision.affordable_target_gap_indices;
    audit.check("zeroBasedContiguousIterationIndex", decision.iteration_index === index, label);
    audit.check(
      "remainingBudgetMatchesRepairCeiling",
      decision.remaining_budget_frames ===
        Math.max(0, value.compile.repair_budget_frames - episode.start_total_spent_frames),
      label,
    );
    audit.check(
      "usableBudgetMatchesHeadroom",
      decision.usable_budget_frames ===
        Math.floor(decision.remaining_budget_frames * (1 - decision.headroom_fraction)),
      label,
    );
    audit.check(
      "anchorMatchesSelectedParentDepth",
      decision.anchor_gap_index === decision.target_gap_index - decision.parent_depth &&
        decision.anchor_gap_index === episode.anchor.gap_index,
      label,
    );
    audit.check(
      "affordableTargetIndicesSortedUnique",
      affordable.every((gap, i) => i === 0 || gap > affordable[i - 1]!),
      label,
    );
    audit.check("selectedTargetIsAffordable", affordable.includes(decision.target_gap_index), label);
    audit.check(
      "selectedAnchorUpperCostFitsUsableBudget",
      decision.estimated_anchor_cost_upper_frames <= decision.usable_budget_frames,
      label,
    );
    audit.check(
      "selectedAnchorCostIntervalOrdered",
      decision.estimated_anchor_cost_frames <= decision.estimated_anchor_cost_upper_frames,
      label,
    );
    audit.check(
      "selectedWeaknessFieldsAgree",
      close(decision.target_gap_sse, measuredGapSse(episode.working_target_gap_before)),
      label,
    );
    const consideredTargets = (decision as any).considered_targets;
    if (Array.isArray(consideredTargets)) {
      const replayed = replayBudgetRepairSelection(decision);
      audit.check(
        "affordableTargetSetReplaysExactly",
        sameJson(replayed.affordableTargetGapIndices, affordable),
        label,
      );
      audit.check(
        "affordableAnchorSetReplaysExactly",
        sameJson(replayed.affordableAnchorGapIndices, decision.affordable_anchor_gap_indices),
        label,
      );
      audit.check(
        "declaredRepairSelectionReplaysExactly",
        replayed.targetGapIndex === decision.target_gap_index &&
          replayed.anchorGapIndex === decision.anchor_gap_index &&
          replayed.parentDepth === decision.parent_depth &&
          close(replayed.targetGapSse, decision.target_gap_sse) &&
          close(replayed.mutableSuffixSse, decision.mutable_suffix_sse) &&
          close(replayed.estimatedAnchorCostFrames, decision.estimated_anchor_cost_frames) &&
          close(replayed.estimatedAnchorCostUpperFrames,
            decision.estimated_anchor_cost_upper_frames) &&
          replayed.anchorCostSource === decision.anchor_cost_source,
        label,
      );
    }
    audit.check(
      "atMostOneTerminalAlternative",
      episode.work.terminal_node_evaluations <= 1,
      label,
    );
    audit.check(
      "terminalOutcomeMatchesWork",
      episode.outcome.terminal_reached === (episode.work.terminal_node_evaluations === 1),
      label,
    );
    audit.check(
      "terminalOfferTargetStateMatchesTerminalOutcome",
      episode.outcome.terminal_reached === (episode.outcome.terminal_offer_target_gap !== null),
      label,
    );
    audit.check(
      "acceptanceMatchesTerminalRegisterAdoption",
      episode.outcome.accepted_alternative ===
        (episode.work.terminal_register_improvements === 1),
      label,
    );
    const startRegisterScore = episode.register_key_at_start?.internal_full_score;
    const endRegisterScore = episode.register_key_at_end?.internal_full_score;
    audit.check(
      "repairRegisterKeysPresent",
      startRegisterScore !== undefined && endRegisterScore !== undefined,
      label,
    );
    audit.check(
      "internalScoreDeltaMatchesRegisterKeys",
      startRegisterScore !== undefined && endRegisterScore !== undefined && close(
        episode.outcome.internal_full_score_delta,
        endRegisterScore - startRegisterScore,
      ),
      label,
    );
    audit.check(
      "registerKeyChangesExactlyOnAcceptance",
      episode.outcome.accepted_alternative !==
        sameJson(episode.register_key_at_start, episode.register_key_at_end),
      label,
    );
    audit.check(
      "terminalHasDirectDivergenceEvidence",
      episode.outcome.terminal_reached ===
        (episode.outcome.working_to_offer_divergence !== null),
      label,
    );
    audit.check(
      "identicalTerminalIsNeverAccepted",
      episode.outcome.working_to_offer_divergence?.terminal_geometry_identical !== true ||
        !episode.outcome.accepted_alternative,
      label,
    );
    const incumbentHash = (decision as any).incumbent_track_hash;
    const workingHash = (decision as any).working_track_hash;
    const offerHash = (episode.outcome as any).terminal_offer_track_hash;
    audit.check(
      "globalWorkingTrackHashMatchesIncumbent",
      decision.working_track_source !== "global_incumbent" || workingHash === incumbentHash,
      label,
    );
    audit.check(
      "bridgeOffspringCannotScheduleBridge",
      decision.working_track_source !== "rejected_local_improvement" ||
        episode.outcome.rejected_local_improvement_followup !== "scheduled",
      label,
    );
    const bridgeAssessment = episode.outcome.rejected_local_improvement_bridge_assessment;
    if (bridgeAssessment !== null) {
      audit.check(
        "optimisticBridgeBoundMatchesDisposition",
        bridgeAssessment.policy === "optimistic_axis_quality_bound" &&
          (bridgeAssessment.bound_can_beat_incumbent
            ? episode.outcome.rejected_local_improvement_followup === "scheduled"
            : episode.outcome.rejected_local_improvement_followup ===
              "optimistic_bound_cannot_beat_incumbent"),
        label,
      );
    }
    if (decision.working_track_source === "rejected_local_improvement") {
      const parent = episode.parent_episode_id === null
        ? undefined
        : value.episodes[episode.parent_episode_id];
      audit.check(
        "rejectedLocalImprovementLineage",
        parent?.lane === "repair" &&
          !parent.outcome.accepted_alternative &&
          parent.outcome.rejected_local_improvement_followup === "scheduled" &&
          parent.outcome.terminal_offer_track_hash === workingHash,
        label,
      );
    }
    if (typeof incumbentHash === "string" &&
        (offerHash === null || typeof offerHash === "string")) {
      audit.check(
        "trackHashesAgreeWithDirectGeometry",
        !episode.outcome.terminal_reached ||
          episode.outcome.working_to_offer_divergence?.terminal_geometry_identical ===
            (offerHash === workingHash),
        label,
      );
    }
    if (!episode.outcome.accepted_alternative) {
      audit.check(
        "rejectedAlternativeLeavesIncumbentScoreUnchanged",
        close(episode.outcome.internal_full_score_delta, 0),
        label,
      );
      audit.check(
        "rejectedAlternativeLeavesIncumbentTargetGapUnchanged",
        sameJson(
          episode.incumbent_target_gap_before,
          episode.outcome.incumbent_target_gap_after,
        ),
        label,
      );
    } else {
      audit.check(
        "acceptedTerminalOfferBecomesIncumbentTargetState",
        sameJson(
          episode.outcome.terminal_offer_target_gap,
          episode.outcome.incumbent_target_gap_after,
        ),
        label,
      );
    }
    if (episode.search_seed !== null) {
      audit.check("freshSearchSeedPerIteration", !seenSeeds.has(episode.search_seed), label);
      seenSeeds.add(episode.search_seed);
    }

    const next = repairs[index + 1];
    if (episode.outcome.rejected_local_improvement_followup === "scheduled") {
      audit.check(
        "scheduledBridgeBecomesNextWorkingTrack",
        next?.repair_decision?.working_track_source === "rejected_local_improvement" &&
          next.parent_episode_id === episode.episode_id &&
          next.repair_decision.working_track_hash === offerHash,
        label,
      );
    }
    if (next === undefined) continue;
    const nextDecision = next.repair_decision!;
    audit.check(
      "remainingBudgetStrictlyDecreases",
      nextDecision.remaining_budget_frames < decision.remaining_budget_frames,
      label,
    );
    audit.check(
      "incumbentRevisionTracksAcceptance",
      nextDecision.incumbent_revision ===
        decision.incumbent_revision + (episode.outcome.accepted_alternative ? 1 : 0),
      label,
    );
    audit.check(
      "registerKeyFlowsIntoNextIteration",
      sameJson(episode.register_key_at_end, next.register_key_at_start),
      label,
    );
    const nextIncumbentHash = (nextDecision as any).incumbent_track_hash;
    if (typeof incumbentHash === "string" &&
        typeof nextIncumbentHash === "string") {
      audit.check(
        "incumbentTrackHashFlowsIntoNextIteration",
        episode.outcome.accepted_alternative
          ? typeof offerHash === "string" && nextIncumbentHash === offerHash
          : nextIncumbentHash === incumbentHash,
        label,
      );
    }
    if (!episode.outcome.accepted_alternative &&
        decision.working_track_source === "global_incumbent" &&
        nextDecision.working_track_source === "global_incumbent") {
      const nextAffordable = new Set(nextDecision.affordable_target_gap_indices);
      audit.check(
        "affordableSetOnlyShrinksAfterRejection",
        nextDecision.affordable_target_gap_indices.every((gap) => affordable.includes(gap)),
        label,
      );
      if (
        [
          "worst_gap_deepest_affordable",
          "worst_gap_reserve_cheapest_repair",
          "worst_gap_reserve_cheapest_else_deepest",
          "worst_gap_density_guarded_depth_eight",
        ].includes(decision.selection_policy) &&
        decision.selection_policy === nextDecision.selection_policy &&
        nextAffordable.has(decision.target_gap_index)
      ) {
        audit.check(
          "sameWorstTargetRetainedWhileAffordableAfterRejection",
          nextDecision.target_gap_index === decision.target_gap_index,
          label,
        );
      }
    }
  }
}

function summarizeGroup(rows: RunRow[]): RepairBehaviorGroup {
  const entries = rows.flatMap((run) => repairEpisodes(run).map((episode) => ({ run, episode })));
  const completed = entries.filter(({ episode }) => episode.outcome.terminal_reached);
  const accepted = completed.filter(({ episode }) => episode.outcome.accepted_alternative);
  const offerTargetDeltas = completed.flatMap(({ episode }) => {
    const before = measuredGapSse(episode.working_target_gap_before);
    const offer = measuredGapSse(episode.outcome.terminal_offer_target_gap);
    return before === null || offer === null ? [] : [before - offer];
  });
  const acceptedOfferTargetDeltas = accepted.flatMap(({ episode }) => {
    const before = measuredGapSse(episode.working_target_gap_before);
    const offer = measuredGapSse(episode.outcome.terminal_offer_target_gap);
    return before === null || offer === null ? [] : [before - offer];
  });
  const incumbentTargetDeltas = entries.flatMap(({ episode }) => {
    const before = measuredGapSse(episode.incumbent_target_gap_before);
    const after = measuredGapSse(episode.outcome.incumbent_target_gap_after);
    return before === null || after === null ? [] : [before - after];
  });
  const spent = sum(entries.map(({ episode }) => episode.outcome.spent_frames ?? 0));
  const compileSpent = sum(rows.map((row) => telemetry(row).compile.total_spent_frames));
  const actualToUpper = completed.flatMap(({ episode }) => {
    const actual = episode.outcome.first_terminal_offset_frames;
    const upper = episode.repair_decision!.estimated_anchor_cost_upper_frames;
    return actual === null || upper <= 0 ? [] : [actual / upper];
  });
  const directDivergence = completed.flatMap(({ episode }) => {
    const value = episode.outcome.working_to_offer_divergence;
    return value === null ? [] : [{ episode, value }];
  });
  const internalDelta = sum(entries.map(({ episode }) => episode.outcome.internal_full_score_delta ?? 0));
  return {
    runs: rows.length,
    runsWithRepair: rows.filter((row) => repairEpisodes(row).length > 0).length,
    repairEpisodes: entries.length,
    repairEpisodesPerRun: round(ratio(entries.length, rows.length) ?? 0),
    terminalReached: completed.length,
    terminalReachedRate: roundedRatio(completed.length, entries.length),
    acceptedAlternatives: accepted.length,
    acceptedPerTerminalRate: roundedRatio(accepted.length, completed.length),
    censoredEpisodes: entries.length - completed.length,
    totalRepairSpentFrames: spent,
    repairSpentShare: roundedRatio(spent, compileSpent),
    framesPerTerminal: roundedRatio(spent, completed.length),
    framesPerAcceptedAlternative: roundedRatio(spent, accepted.length),
    meanAffordableTargetCount: roundedMean(entries.map(({ episode }) =>
      episode.repair_decision!.affordable_target_gap_indices.length
    )),
    meanParentDepth: roundedMean(entries.map(({ episode }) =>
      episode.repair_decision!.parent_depth
    )),
    meanTargetGap: roundedMean(entries.map(({ episode }) =>
      episode.repair_decision!.target_gap_index
    )),
    meanTargetGapSse: roundedMean(entries.map(({ episode }) =>
      episode.repair_decision!.target_gap_sse
    )),
    meanAnchorGap: roundedMean(entries.map(({ episode }) => episode.anchor.gap_index)),
    meanAnchorRemainingFraction: roundedMean(entries.map(({ episode }) => {
      const total = episode.anchor.gap_index + episode.anchor.remaining_gaps;
      return total === 0 ? 0 : episode.anchor.remaining_gaps / total;
    })),
    meanAnchorRemainingGaps: roundedMean(entries.map(({ episode }) => episode.anchor.remaining_gaps)),
    meanRemainingBudgetFrames: roundedMean(entries.map(({ episode }) =>
      episode.repair_decision!.remaining_budget_frames
    )),
    meanEstimatedUpperUtilization: roundedMean(actualToUpper),
    completionWithinEstimatedUpperRate: roundedRatio(
      completed.filter(({ episode }) =>
        episode.outcome.first_terminal_offset_frames! <=
          episode.repair_decision!.estimated_anchor_cost_upper_frames
      ).length,
      completed.length,
    ),
    completionWithinAllocationRate: roundedRatio(
      completed.filter(({ episode }) =>
        episode.outcome.first_terminal_offset_frames! <= episode.allocated_frames
      ).length,
      completed.length,
    ),
    terminalGeometryIdentical: directDivergence.filter(({ value }) =>
      value.terminal_geometry_identical
    ).length,
    acceptedTerminalGeometryIdentical: directDivergence.filter(({ episode, value }) =>
      value.terminal_geometry_identical && episode.outcome.accepted_alternative
    ).length,
    terminalGeometryIdenticalRate: roundedRatio(
      directDivergence.filter(({ value }) => value.terminal_geometry_identical).length,
      directDivergence.length,
    ),
    terminalGeometryIdenticalSpentFrames: sum(directDivergence
      .filter(({ value }) => value.terminal_geometry_identical)
      .map(({ episode }) => episode.outcome.spent_frames ?? 0)),
    terminalGeometryIdenticalSpentShare: roundedRatio(
      sum(directDivergence
        .filter(({ value }) => value.terminal_geometry_identical)
        .map(({ episode }) => episode.outcome.spent_frames ?? 0)),
      spent,
    ),
    firstDivergenceAtAnchorRate: roundedRatio(
      directDivergence.filter(({ episode, value }) =>
        value.first_divergent_gap_index === episode.anchor.gap_index
      ).length,
      directDivergence.filter(({ value }) => value.first_divergent_gap_index !== null).length,
    ),
    meanDivergentSuffixGaps: roundedMean(directDivergence.map(({ value }) =>
      value.divergent_suffix_gap_count
    )),
    terminalOfferTargetGapSseImprovement: offerTargetDeltas.length === 0
      ? null
      : round(sum(offerTargetDeltas)),
    terminalOfferTargetGapImprovementRate: roundedRatio(
      completed.filter(({ episode }) => targetGapImproved(episode)).length,
      completed.length,
    ),
    terminalOfferTargetGapMissing: completed.filter(({ episode }) =>
      episode.outcome.terminal_offer_target_gap?.status === "missing"
    ).length,
    rejectedTerminalOfferTargetGapImproved: completed.filter(({ episode }) => {
      if (episode.outcome.accepted_alternative) return false;
      return targetGapImproved(episode);
    }).length,
    workingTrackBridgeEpisodes: entries.filter(({ episode }) =>
      episode.repair_decision!.working_track_source === "rejected_local_improvement"
    ).length,
    rejectedLocalImprovementFollowup: Object.fromEntries(
      [...new Set(entries.map(({ episode }) =>
        episode.outcome.rejected_local_improvement_followup
      ))].sort().map((disposition) => [
        disposition,
        entries.filter(({ episode }) =>
          episode.outcome.rejected_local_improvement_followup === disposition
        ).length,
      ]),
    ),
    incumbentTargetGapSseImprovement: incumbentTargetDeltas.length === 0
      ? null
      : round(sum(incumbentTargetDeltas)),
    acceptedTerminalOfferTargetGapImprovementRate: roundedRatio(
      accepted.filter(({ episode }) => targetGapImproved(episode)).length,
      accepted.length,
    ),
    acceptedTerminalOfferTargetGapMissing: accepted.filter(({ episode }) =>
      episode.outcome.terminal_offer_target_gap?.status === "missing"
    ).length,
    acceptedTerminalOfferTargetGapWorsened:
      acceptedOfferTargetDeltas.filter((value) => value < 0).length,
    internalFullScoreDelta: round(internalDelta),
    internalFullScoreDeltaPerMillionRepairFrames:
      spent === 0 ? null : round(internalDelta * 1_000_000 / spent),
    replayableDecisionEpisodes: entries.filter(({ episode }) =>
      Array.isArray((episode.repair_decision as any)?.considered_targets)
    ).length,
    directTrackIdentityEpisodes: entries.filter(({ episode }) =>
      typeof (episode.repair_decision as any)?.working_track_hash === "string" &&
      (episode.outcome as any).terminal_offer_track_hash !== undefined
    ).length,
  };
}

function summarizeSlice(entries: RepairEntry[]): RepairBehaviorSlice {
  const completed = entries.filter(({ episode }) => episode.outcome.terminal_reached);
  const accepted = completed.filter(({ episode }) => episode.outcome.accepted_alternative);
  const acceptedOfferTargetDeltas = accepted.flatMap(({ episode }) => {
    const before = measuredGapSse(episode.working_target_gap_before);
    const offer = measuredGapSse(episode.outcome.terminal_offer_target_gap);
    return before === null || offer === null ? [] : [before - offer];
  });
  const spent = sum(entries.map(({ episode }) => episode.outcome.spent_frames ?? 0));
  const actualToUpper = completed.flatMap(({ episode }) => {
    const actual = episode.outcome.first_terminal_offset_frames;
    const upper = episode.repair_decision!.estimated_anchor_cost_upper_frames;
    return actual === null || upper <= 0 ? [] : [actual / upper];
  });
  const divergence = completed.flatMap(({ episode }) => {
    const value = episode.outcome.working_to_offer_divergence;
    return value === null ? [] : [{ episode, value }];
  });
  const internalDelta = sum(entries.map(({ episode }) =>
    episode.outcome.internal_full_score_delta ?? 0
  ));
  return {
    repairEpisodes: entries.length,
    terminalReached: completed.length,
    terminalReachedRate: roundedRatio(completed.length, entries.length),
    acceptedAlternatives: accepted.length,
    acceptedPerTerminalRate: roundedRatio(accepted.length, completed.length),
    censoredEpisodes: entries.length - completed.length,
    totalRepairSpentFrames: spent,
    framesPerTerminal: roundedRatio(spent, completed.length),
    framesPerAcceptedAlternative: roundedRatio(spent, accepted.length),
    meanParentDepth: roundedMean(entries.map(({ episode }) =>
      episode.repair_decision!.parent_depth
    )),
    meanTargetGap: roundedMean(entries.map(({ episode }) =>
      episode.repair_decision!.target_gap_index
    )),
    meanAnchorGap: roundedMean(entries.map(({ episode }) => episode.anchor.gap_index)),
    meanAnchorRemainingGaps: roundedMean(entries.map(({ episode }) =>
      episode.anchor.remaining_gaps
    )),
    meanEstimatedUpperUtilization: roundedMean(actualToUpper),
    completionWithinEstimatedUpperRate: roundedRatio(
      completed.filter(({ episode }) =>
        episode.outcome.first_terminal_offset_frames! <=
          episode.repair_decision!.estimated_anchor_cost_upper_frames
      ).length,
      completed.length,
    ),
    terminalGeometryIdentical: divergence.filter(({ value }) =>
      value.terminal_geometry_identical
    ).length,
    acceptedTerminalGeometryIdentical: divergence.filter(({ episode, value }) =>
      value.terminal_geometry_identical && episode.outcome.accepted_alternative
    ).length,
    terminalGeometryIdenticalRate: roundedRatio(
      divergence.filter(({ value }) => value.terminal_geometry_identical).length,
      divergence.length,
    ),
    terminalGeometryIdenticalSpentFrames: sum(divergence
      .filter(({ value }) => value.terminal_geometry_identical)
      .map(({ episode }) => episode.outcome.spent_frames ?? 0)),
    terminalGeometryIdenticalSpentShare: roundedRatio(
      sum(divergence
        .filter(({ value }) => value.terminal_geometry_identical)
        .map(({ episode }) => episode.outcome.spent_frames ?? 0)),
      spent,
    ),
    firstDivergenceAtAnchorRate: roundedRatio(
      divergence.filter(({ episode, value }) =>
        value.first_divergent_gap_index === episode.anchor.gap_index
      ).length,
      divergence.filter(({ value }) => value.first_divergent_gap_index !== null).length,
    ),
    meanDivergentSuffixGaps: roundedMean(divergence.map(({ value }) =>
      value.divergent_suffix_gap_count
    )),
    acceptedTerminalOfferTargetGapImprovementRate: roundedRatio(
      accepted.filter(({ episode }) => targetGapImproved(episode)).length,
      accepted.length,
    ),
    acceptedTerminalOfferTargetGapMissing: accepted.filter(({ episode }) =>
      episode.outcome.terminal_offer_target_gap?.status === "missing"
    ).length,
    acceptedTerminalOfferTargetGapWorsened:
      acceptedOfferTargetDeltas.filter((value) => value < 0).length,
    internalFullScoreDelta: round(internalDelta),
    internalFullScoreDeltaPerMillionRepairFrames:
      spent === 0 ? null : round(internalDelta * 1_000_000 / spent),
  };
}

function summarizeSelection(entries: RepairEntry[]): {
  decisionEpisodes: number;
  replayableDecisionEpisodes: number;
  selectionPolicies: Record<string, number>;
  maximumConsideredParentDepth: number | null;
  explanatoryDepthBeyondOptionRadius: number;
  meanAffordableTargets: number | null;
  meanAffordableAnchors: number | null;
  meanMutableSuffixSse: number | null;
  meanTargetShareOfMutableSuffixSse: number | null;
  meanMutableSuffixSsePerMillionEstimatedFrames: number | null;
} {
  let maximumConsideredParentDepth: number | null = null;
  let replayableDecisionEpisodes = 0;
  let explanatoryDepthBeyondOptionRadius = 0;
  const selectionPolicies: Record<string, number> = {};
  const affordableTargets: number[] = [];
  const affordableAnchors: number[] = [];
  const suffixSse: number[] = [];
  const targetShares: number[] = [];
  const suffixDensities: number[] = [];
  for (const { episode } of entries) {
    const decision = episode.repair_decision!;
    selectionPolicies[decision.selection_policy] =
      (selectionPolicies[decision.selection_policy] ?? 0) + 1;
    const considered = (decision as any).considered_targets;
    if (!Array.isArray(considered)) continue;
    replayableDecisionEpisodes++;
    const consideredMax = Math.max(...considered.flatMap((candidate: any) =>
      candidate.anchor_options.map((option: any) => option.parent_depth)
    ));
    maximumConsideredParentDepth = maximumConsideredParentDepth === null
      ? consideredMax
      : Math.max(maximumConsideredParentDepth, consideredMax);
    if (decision.parent_depth > consideredMax) explanatoryDepthBeyondOptionRadius++;
    affordableTargets.push(decision.affordable_target_gap_indices.length);
    affordableAnchors.push(decision.affordable_anchor_gap_indices.length);
    suffixSse.push(decision.mutable_suffix_sse);
    targetShares.push(decision.mutable_suffix_sse === 0
      ? 0
      : decision.target_gap_sse / decision.mutable_suffix_sse);
    suffixDensities.push(
      decision.mutable_suffix_sse * 1_000_000 / decision.estimated_anchor_cost_frames,
    );
  }
  return {
    decisionEpisodes: entries.length,
    replayableDecisionEpisodes,
    selectionPolicies: Object.fromEntries(
      Object.entries(selectionPolicies).sort(([a], [b]) => a.localeCompare(b)),
    ),
    maximumConsideredParentDepth,
    explanatoryDepthBeyondOptionRadius,
    meanAffordableTargets: roundedMean(affordableTargets),
    meanAffordableAnchors: roundedMean(affordableAnchors),
    meanMutableSuffixSse: roundedMean(suffixSse),
    meanTargetShareOfMutableSuffixSse: roundedMean(targetShares),
    meanMutableSuffixSsePerMillionEstimatedFrames: roundedMean(suffixDensities),
  };
}

function summarizeTerminalOfferDiversity(entries: RepairEntry[]): {
  terminalOffersWithHash: number;
  distinctTerminalOfferTracks: number;
  repeatedTerminalOffers: number;
  repeatedTerminalOffersAgainstSameWorkingTrack: number;
  repeatedTerminalOffersAgainstSameWorkingTrackAndAnchor: number;
  repeatedTerminalOffersAgainstSameWorkingTrackAndAnchorSpentFrames: number;
} {
  const all = new Set<string>();
  const byWorkingTrack = new Set<string>();
  const byWorkingTrackAnchor = new Set<string>();
  let terminalOffersWithHash = 0;
  let repeatedTerminalOffers = 0;
  let repeatedTerminalOffersAgainstSameWorkingTrack = 0;
  let repeatedTerminalOffersAgainstSameWorkingTrackAndAnchor = 0;
  let repeatedTerminalOffersAgainstSameWorkingTrackAndAnchorSpentFrames = 0;
  for (const { episode } of entries) {
    const offer = (episode.outcome as any).terminal_offer_track_hash;
    if (typeof offer !== "string") continue;
    terminalOffersWithHash++;
    const workingTrack = (episode.repair_decision as any).working_track_hash;
    if (typeof workingTrack !== "string") {
      if (all.has(offer)) repeatedTerminalOffers++;
      all.add(offer);
      continue;
    }
    const workingTrackKey = `${workingTrack}\0${offer}`;
    const anchorKey = `${workingTrack}\0${episode.anchor.gap_index}\0${offer}`;
    if (all.has(offer)) repeatedTerminalOffers++;
    if (byWorkingTrack.has(workingTrackKey)) repeatedTerminalOffersAgainstSameWorkingTrack++;
    if (byWorkingTrackAnchor.has(anchorKey)) {
      repeatedTerminalOffersAgainstSameWorkingTrackAndAnchor++;
      repeatedTerminalOffersAgainstSameWorkingTrackAndAnchorSpentFrames +=
        episode.outcome.spent_frames ?? 0;
    }
    all.add(offer);
    byWorkingTrack.add(workingTrackKey);
    byWorkingTrackAnchor.add(anchorKey);
  }
  return {
    terminalOffersWithHash,
    distinctTerminalOfferTracks: all.size,
    repeatedTerminalOffers,
    repeatedTerminalOffersAgainstSameWorkingTrack,
    repeatedTerminalOffersAgainstSameWorkingTrackAndAnchor,
    repeatedTerminalOffersAgainstSameWorkingTrackAndAnchorSpentFrames,
  };
}

function summarizeTransitions(rows: RunRow[]): {
  total: number;
  afterAccepted: number;
  afterRejected: number;
  afterRejectedGlobalIncumbentFollowup: number;
  afterRejectedIncumbentRetry: number;
  afterRejectedBridgeReturnToIncumbent: number;
  afterRejectedLocalBridge: number;
  afterAcceptedAnchorEarlier: number;
  afterAcceptedAnchorSame: number;
  afterAcceptedAnchorLater: number;
  afterRejectedAnchorEarlier: number;
  afterRejectedAnchorSame: number;
  afterRejectedAnchorLater: number;
  afterRejectedSameTarget: number;
  afterRejectedSameTargetAndAnchor: number;
  afterRejectedRepeatedTerminalOffer: number;
  afterRejectedTargetStillAffordable: number;
  afterRejectedTargetRetained: number;
  afterRejectedAffordableSetShrank: number;
  afterRejectedAffordableSetSame: number;
} {
  const result = {
    total: 0,
    afterAccepted: 0,
    afterRejected: 0,
    afterRejectedGlobalIncumbentFollowup: 0,
    afterRejectedIncumbentRetry: 0,
    afterRejectedBridgeReturnToIncumbent: 0,
    afterRejectedLocalBridge: 0,
    afterAcceptedAnchorEarlier: 0,
    afterAcceptedAnchorSame: 0,
    afterAcceptedAnchorLater: 0,
    afterRejectedAnchorEarlier: 0,
    afterRejectedAnchorSame: 0,
    afterRejectedAnchorLater: 0,
    afterRejectedSameTarget: 0,
    afterRejectedSameTargetAndAnchor: 0,
    afterRejectedRepeatedTerminalOffer: 0,
    afterRejectedTargetStillAffordable: 0,
    afterRejectedTargetRetained: 0,
    afterRejectedAffordableSetShrank: 0,
    afterRejectedAffordableSetSame: 0,
  };
  for (const row of rows) {
    const episodes = repairEpisodes(row);
    for (let index = 0; index + 1 < episodes.length; index++) {
      const current = episodes[index]!;
      const next = episodes[index + 1]!;
      const accepted = current.outcome.accepted_alternative;
      const prefix = accepted ? "afterAccepted" : "afterRejected";
      result.total++;
      result[prefix]++;
      if (!accepted && next.repair_decision!.working_track_source ===
          "rejected_local_improvement") {
        result.afterRejectedLocalBridge++;
        continue;
      }
      if (!accepted) {
        result.afterRejectedGlobalIncumbentFollowup++;
        if (current.repair_decision!.working_track_source === "rejected_local_improvement") {
          result.afterRejectedBridgeReturnToIncumbent++;
          continue;
        }
        result.afterRejectedIncumbentRetry++;
      }
      const movement = next.anchor.gap_index < current.anchor.gap_index
        ? "AnchorEarlier"
        : next.anchor.gap_index === current.anchor.gap_index
          ? "AnchorSame"
          : "AnchorLater";
      result[`${prefix}${movement}`]++;
      if (!accepted) {
        const currentDecision = current.repair_decision!;
        const nextDecision = next.repair_decision!;
        if (nextDecision.target_gap_index === currentDecision.target_gap_index) {
          result.afterRejectedSameTarget++;
          if (nextDecision.anchor_gap_index === currentDecision.anchor_gap_index) {
            result.afterRejectedSameTargetAndAnchor++;
          }
        }
        const currentOffer = (current.outcome as any).terminal_offer_track_hash;
        if (typeof currentOffer === "string" &&
            currentOffer === (next.outcome as any).terminal_offer_track_hash) {
          result.afterRejectedRepeatedTerminalOffer++;
        }
        const before = current.repair_decision!.affordable_target_gap_indices;
        const after = next.repair_decision!.affordable_target_gap_indices;
        if (after.length < before.length) result.afterRejectedAffordableSetShrank++;
        else result.afterRejectedAffordableSetSame++;
        if (after.includes(current.repair_decision!.target_gap_index)) {
          result.afterRejectedTargetStillAffordable++;
          if (next.repair_decision!.target_gap_index === current.repair_decision!.target_gap_index) {
            result.afterRejectedTargetRetained++;
          }
        }
      }
    }
  }
  return result;
}

function summarizeTransitionOutcomes(rows: RunRow[]): {
  afterRejectedSameTargetAndAnchor: RepairBehaviorSlice;
  afterRejectedDifferentDecision: RepairBehaviorSlice;
  afterRejectedLocalBridge: RepairBehaviorSlice;
  afterRejectedBridgeReturnToIncumbent: RepairBehaviorSlice;
  afterAccepted: RepairBehaviorSlice;
} {
  const same: RepairEntry[] = [];
  const different: RepairEntry[] = [];
  const accepted: RepairEntry[] = [];
  const bridge: RepairEntry[] = [];
  const bridgeReturn: RepairEntry[] = [];
  for (const run of rows) {
    const episodes = repairEpisodes(run);
    for (let index = 0; index + 1 < episodes.length; index++) {
      const current = episodes[index]!;
      const next = episodes[index + 1]!;
      if (current.outcome.accepted_alternative) {
        accepted.push({ run, episode: next });
        continue;
      }
      if (next.repair_decision!.working_track_source === "rejected_local_improvement") {
        bridge.push({ run, episode: next });
        continue;
      }
      if (current.repair_decision!.working_track_source === "rejected_local_improvement") {
        bridgeReturn.push({ run, episode: next });
        continue;
      }
      const currentDecision = current.repair_decision!;
      const nextDecision = next.repair_decision!;
      if (currentDecision.target_gap_index === nextDecision.target_gap_index &&
          currentDecision.anchor_gap_index === nextDecision.anchor_gap_index) {
        same.push({ run, episode: next });
      } else {
        different.push({ run, episode: next });
      }
    }
  }
  return {
    afterRejectedSameTargetAndAnchor: summarizeSlice(same),
    afterRejectedDifferentDecision: summarizeSlice(different),
    afterRejectedLocalBridge: summarizeSlice(bridge),
    afterRejectedBridgeReturnToIncumbent: summarizeSlice(bridgeReturn),
    afterAccepted: summarizeSlice(accepted),
  };
}

function summarizeAdjacentBudgets(rows: RunRow[]): {
  comparablePairs: number;
  gainedRepairAtHigherBudget: number;
  lostRepairAtHigherBudget: number;
  bothHaveRepair: number;
  firstAnchorEarlierAtHigherBudget: number;
  firstAnchorSameAtHigherBudget: number;
  firstAnchorLaterAtHigherBudget: number;
  meanEpisodeCountDelta: number | null;
  meanAcceptedCountDelta: number | null;
} {
  const bySubject = new Map<string, RunRow[]>();
  for (const row of rows) {
    const key = `${row.task.sourceId}\0${row.task.actualSeed}`;
    const group = bySubject.get(key) ?? [];
    group.push(row);
    bySubject.set(key, group);
  }
  const result = {
    comparablePairs: 0,
    gainedRepairAtHigherBudget: 0,
    lostRepairAtHigherBudget: 0,
    bothHaveRepair: 0,
    firstAnchorEarlierAtHigherBudget: 0,
    firstAnchorSameAtHigherBudget: 0,
    firstAnchorLaterAtHigherBudget: 0,
    meanEpisodeCountDelta: null as number | null,
    meanAcceptedCountDelta: null as number | null,
  };
  const episodeDeltas: number[] = [];
  const acceptedDeltas: number[] = [];
  for (const group of bySubject.values()) {
    group.sort((a, b) => a.task.budget - b.task.budget);
    for (let index = 0; index + 1 < group.length; index++) {
      const lower = repairEpisodes(group[index]!);
      const higher = repairEpisodes(group[index + 1]!);
      result.comparablePairs++;
      episodeDeltas.push(higher.length - lower.length);
      acceptedDeltas.push(countAccepted(higher) - countAccepted(lower));
      if (lower.length === 0 && higher.length > 0) result.gainedRepairAtHigherBudget++;
      if (lower.length > 0 && higher.length === 0) result.lostRepairAtHigherBudget++;
      if (lower.length === 0 || higher.length === 0) continue;
      result.bothHaveRepair++;
      const lowerAnchor = lower[0]!.anchor.gap_index;
      const higherAnchor = higher[0]!.anchor.gap_index;
      if (higherAnchor < lowerAnchor) result.firstAnchorEarlierAtHigherBudget++;
      else if (higherAnchor === lowerAnchor) result.firstAnchorSameAtHigherBudget++;
      else result.firstAnchorLaterAtHigherBudget++;
    }
  }
  result.meanEpisodeCountDelta = roundedMean(episodeDeltas);
  result.meanAcceptedCountDelta = roundedMean(acceptedDeltas);
  return result;
}

function countAccepted(episodes: BudgetEpisodeTelemetry[]): number {
  return episodes.filter((episode) => episode.outcome.accepted_alternative).length;
}

function measuredGapSse(observation: BudgetRepairGapState | null | undefined): number | null {
  return observation?.status === "measured" ? observation.sse : null;
}

function targetGapImproved(episode: BudgetEpisodeTelemetry): boolean {
  const before = measuredGapSse(episode.working_target_gap_before);
  const offer = measuredGapSse(episode.outcome.terminal_offer_target_gap);
  return before !== null && offer !== null && offer < before;
}

function telemetry(row: RunRow): CompileBudgetTelemetry {
  const value = row.budgetTelemetry;
  if (value === null || value === undefined) throw new Error(`${runKey(row)} has no budget telemetry`);
  if (value.schema !== BUDGET_TELEMETRY_SCHEMA) {
    throw new Error(`${runKey(row)} has ${value.schema}; expected ${BUDGET_TELEMETRY_SCHEMA}`);
  }
  return value;
}

function repairEpisodes(row: RunRow): BudgetEpisodeTelemetry[] {
  return telemetry(row).episodes.filter((episode) => episode.lane === "repair");
}

function runKey(row: RunRow): string {
  return `${row.task.sourceId}/${row.task.budget}/${row.task.actualSeed}`;
}

function sameJson(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function close(a: number | null | undefined, b: number | null | undefined): boolean {
  if (a === null || a === undefined || b === null || b === undefined) return a === b;
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function roundedRatio(numerator: number, denominator: number): number | null {
  const value = ratio(numerator, denominator);
  return value === null ? null : round(value);
}

function roundedMean(values: number[]): number | null {
  return values.length === 0 ? null : round(sum(values) / values.length);
}

function round(value: number): number {
  return Number(value.toFixed(6));
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function argumentsNamed(name: string): string[] {
  const prefix = `--${name}=`;
  return process.argv.slice(2).filter((value) => value.startsWith(prefix))
    .map((value) => value.slice(prefix.length));
}

function percentage(value: number | null): string {
  return value === null ? "—" : `${(100 * value).toFixed(1)}%`;
}

function number(value: number | null, digits = 2): string {
  return value === null ? "—" : value.toFixed(digits);
}

type RepairPlotDimension = "budget" | "iteration" | "parent-depth";

export function renderRepairBehaviorPlot(
  summary: RepairBehaviorSummary,
  dimension: RepairPlotDimension,
  label: string,
): string {
  const rows = dimension === "budget"
    ? summary.perBudget
    : dimension === "iteration"
      ? summary.perIteration
      : summary.perParentDepth;
  const labels = rows.map((row: any) => dimension === "budget"
    ? `${Math.round(row.budget / 1000)}k`
    : String(dimension === "iteration" ? row.iterationIndex : row.parentDepth));
  const panels = [
    {
      title: dimension === "budget" ? "Repair iterations per run" : "Repair iterations",
      values: rows.map((row: any) => dimension === "budget"
        ? row.repairEpisodesPerRun
        : row.repairEpisodes),
      digits: dimension === "budget" ? 2 : 0,
    },
    {
      title: dimension === "parent-depth" ? "Accepted per reached terminal" : "Mean parent depth",
      values: rows.map((row: any) => dimension === "parent-depth"
        ? row.acceptedPerTerminalRate
        : row.meanParentDepth),
      digits: 2,
    },
    {
      title: "Internal score gain per million repair frames",
      values: rows.map((row: any) => row.internalFullScoreDeltaPerMillionRepairFrames),
      digits: 2,
    },
  ];
  const width = 1000;
  const panelHeight = 210;
  const height = 70 + panels.length * panelHeight;
  const left = 76;
  const right = 28;
  const plotWidth = width - left - right;
  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<rect width="100%" height="100%" fill="#ffffff"/>`,
    `<text x="${left}" y="34" font-family="sans-serif" font-size="20" font-weight="700">${escapeXml(label)} — repair by ${escapeXml(dimension)}</text>`,
  ];
  for (let panelIndex = 0; panelIndex < panels.length; panelIndex++) {
    const panel = panels[panelIndex]!;
    const top = 62 + panelIndex * panelHeight;
    const chartTop = top + 28;
    const chartHeight = 120;
    const finite = panel.values.filter((value: any): value is number =>
      typeof value === "number" && Number.isFinite(value)
    );
    const max = Math.max(1e-9, ...finite) * 1.08;
    parts.push(`<text x="${left}" y="${top + 17}" font-family="sans-serif" font-size="15" font-weight="600">${escapeXml(panel.title)}</text>`);
    for (let tick = 0; tick <= 4; tick++) {
      const fraction = tick / 4;
      const y = chartTop + chartHeight * (1 - fraction);
      const value = max * fraction;
      parts.push(`<line x1="${left}" y1="${y}" x2="${width - right}" y2="${y}" stroke="#d9dee7" stroke-width="1"/>`);
      parts.push(`<text x="${left - 8}" y="${y + 4}" text-anchor="end" font-family="sans-serif" font-size="11" fill="#596273">${value.toFixed(panel.digits)}</text>`);
    }
    const points = panel.values.flatMap((value: any, index: number) => {
      if (typeof value !== "number" || !Number.isFinite(value)) return [];
      const x = left + (labels.length <= 1 ? plotWidth / 2 : plotWidth * index / (labels.length - 1));
      const y = chartTop + chartHeight * (1 - value / max);
      return [{ x, y, value }];
    });
    if (points.length > 1) {
      parts.push(`<polyline fill="none" stroke="#2563eb" stroke-width="2.5" points="${points.map(({ x, y }) => `${x},${y}`).join(" ")}"/>`);
    }
    for (const point of points) {
      parts.push(`<circle cx="${point.x}" cy="${point.y}" r="4" fill="#2563eb"/>`);
      parts.push(`<text x="${point.x}" y="${point.y - 8}" text-anchor="middle" font-family="sans-serif" font-size="10" fill="#1f2937">${point.value.toFixed(panel.digits)}</text>`);
    }
    for (let index = 0; index < labels.length; index++) {
      const x = left + (labels.length <= 1 ? plotWidth / 2 : plotWidth * index / (labels.length - 1));
      parts.push(`<text x="${x}" y="${chartTop + chartHeight + 19}" text-anchor="middle" font-family="sans-serif" font-size="11" fill="#374151">${escapeXml(labels[index]!)}</text>`);
    }
  }
  parts.push("</svg>");
  return `${parts.join("\n")}\n`;
}

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&apos;",
  })[character]!);
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function markdown(artifact: any): string {
  const lines = [
    "# Independent repair behavior audit",
    "",
    "This report audits whether repair behaves like the declared independent, budget-aware controller. It does not use intermediate outputs as production objectives and it does not infer score causality from deterministic budget variants.",
    "",
    "## Direct invariant checks",
    "",
  ];
  for (const arm of artifact.arms) {
    const checks = Object.entries(arm.summary.invariantAudit.checks) as Array<[string, AuditCheck]>;
    const checked = sum(checks.map(([, value]) => value.checked));
    const violations = sum(checks.map(([, value]) => value.violations));
    lines.push(`- ${arm.label}: ${checked.toLocaleString()} checks, ${violations} violations (${arm.summary.invariantAudit.passed ? "PASS" : "FAIL"}).`);
  }
  lines.push("", "The checks cover budget/headroom arithmetic, selected parent anchoring, selected-anchor affordability, weakness-field agreement, one-terminal execution, acceptance attribution, working-track divergence, rejected-incumbent stability, one-step bridge lineage, fresh search seeds, and cross-iteration revision/register continuity.", "");

  for (const arm of artifact.arms) {
    const summary = arm.summary as RepairBehaviorSummary;
    lines.push(`## ${arm.label}`, "", `Evidence: \`${arm.path}\` (SHA-256 \`${arm.sha256}\`), ${summary.cells} source×budget×seed cells.`, "", `Plots: [budget](${arm.plots.budget}), [iteration](${arm.plots.iteration}), [parent depth](${arm.plots["parent-depth"]}).`, "");
    lines.push("| Budget | Repair runs | Episodes/run | Terminal rate | Accepted/terminal | Mean anchor | Mean suffix gaps | Actual/upper | Identical terminals | Offer target SSE Δ | Internal Δ/M frames |", "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const row of summary.perBudget) {
      lines.push(`| ${Math.round(row.budget / 1000)}k | ${row.runsWithRepair}/${row.runs} | ${row.repairEpisodesPerRun.toFixed(2)} | ${percentage(row.terminalReachedRate)} | ${percentage(row.acceptedPerTerminalRate)} | ${number(row.meanAnchorGap, 1)} | ${number(row.meanDivergentSuffixGaps, 1)} | ${percentage(row.meanEstimatedUpperUtilization)} | ${row.terminalGeometryIdentical} | ${number(row.terminalOfferTargetGapSseImprovement, 3)} | ${number(row.internalFullScoreDeltaPerMillionRepairFrames, 2)} |`);
    }
    lines.push("", "Outcomes by selected parent depth:", "", "| Depth | Episodes | Terminal rate | Accepted/terminal | Mean suffix gaps | Identical | First divergence at anchor | Frames/accepted | Internal Δ/M frames |", "|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const row of summary.perParentDepth) {
      lines.push(`| ${row.parentDepth} | ${row.repairEpisodes} | ${percentage(row.terminalReachedRate)} | ${percentage(row.acceptedPerTerminalRate)} | ${number(row.meanDivergentSuffixGaps, 1)} | ${row.terminalGeometryIdentical} | ${percentage(row.firstDivergenceAtAnchorRate)} | ${number(row.framesPerAcceptedAlternative, 0)} | ${number(row.internalFullScoreDeltaPerMillionRepairFrames, 2)} |`);
    }
    lines.push("", "Outcomes by repair iteration:", "", "| Iteration | Episodes | Mean depth | Mean anchor | Terminal rate | Accepted/terminal | Frames/accepted | Internal Δ/M frames |", "|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const row of summary.perIteration) {
      lines.push(`| ${row.iterationIndex} | ${row.repairEpisodes} | ${number(row.meanParentDepth, 2)} | ${number(row.meanAnchorGap, 1)} | ${percentage(row.terminalReachedRate)} | ${percentage(row.acceptedPerTerminalRate)} | ${number(row.framesPerAcceptedAlternative, 0)} | ${number(row.internalFullScoreDeltaPerMillionRepairFrames, 2)} |`);
    }
    const o = summary.overall;
    lines.push("", "Direct observations:", "", `- ${o.terminalReached}/${o.repairEpisodes} iterations reached a terminal; ${o.acceptedAlternatives} were adopted.`, `- Repair used ${percentage(o.repairSpentShare)} of charged work. Completion stayed within the selected anchor's estimated upper cost in ${percentage(o.completionWithinEstimatedUpperRate)} of completed iterations.`, `- ${o.terminalGeometryIdentical}/${o.terminalReached} terminal alternatives were geometry-identical to their working tracks and ${o.acceptedTerminalGeometryIdentical} were accepted, consuming ${o.terminalGeometryIdenticalSpentFrames.toLocaleString()} frames (${percentage(o.terminalGeometryIdenticalSpentShare)} of repair work); the first divergence occurred at the anchor in ${percentage(o.firstDivergenceAtAnchorRate)} of divergent terminals.`, `- Terminal offers improved the selected working-track target gap ${percentage(o.terminalOfferTargetGapImprovementRate)} of the time; ${o.terminalOfferTargetGapMissing} terminal offers lost the selected target contact and ${o.rejectedTerminalOfferTargetGapImproved} locally improving offers were rejected by the global register.`, `- ${o.workingTrackBridgeEpisodes} episodes used a rejected local improvement as their temporary working track. Follow-up dispositions: ${Object.entries(o.rejectedLocalImprovementFollowup).map(([disposition, count]) => `${disposition}=${count}`).join(", ")}.`, `- Accepted alternatives improved the selected working-track target gap ${percentage(o.acceptedTerminalOfferTargetGapImprovementRate)} of the time; ${o.acceptedTerminalOfferTargetGapWorsened} accepted alternatives worsened it and ${o.acceptedTerminalOfferTargetGapMissing} lost it while improving the register globally.`, `- Aggregate offer target-gap SSE change was ${number(o.terminalOfferTargetGapSseImprovement, 4)} over measured offers; adopted global-incumbent target-gap change was ${number(o.incumbentTargetGapSseImprovement, 4)}; internal full-score gain was ${number(o.internalFullScoreDelta, 2)} (${number(o.internalFullScoreDeltaPerMillionRepairFrames, 2)} per million repair frames).`, `- Full decision replay was available for ${o.replayableDecisionEpisodes}/${o.repairEpisodes} episodes and direct working-track/offer hashes for ${o.directTrackIdentityEpisodes}/${o.repairEpisodes}.`, "");
    const selection = summary.selection;
    const diversity = summary.terminalOfferDiversity;
    lines.push("Selection and direct diversity:", "", `- Full option replay was available for ${selection.replayableDecisionEpisodes}/${selection.decisionEpisodes} decisions. Declared policies: ${Object.entries(selection.selectionPolicies).map(([policy, count]) => `${policy}=${count}`).join(", ")}. Mean affordable populations were ${number(selection.meanAffordableTargets, 2)} targets and ${number(selection.meanAffordableAnchors, 2)} anchors.`, `- The selected mutable suffix carried mean SSE ${number(selection.meanMutableSuffixSse, 4)} (${percentage(selection.meanTargetShareOfMutableSuffixSse)} in its explanatory target) and ${number(selection.meanMutableSuffixSsePerMillionEstimatedFrames, 2)} SSE per million estimated frames. ${selection.explanatoryDepthBeyondOptionRadius} explanatory target-to-anchor depths exceeded the option-generation radius; this is valid for anchor-first policies.`, `- ${diversity.terminalOffersWithHash} terminal offers contained direct hashes: ${diversity.distinctTerminalOfferTracks} were globally distinct, ${diversity.repeatedTerminalOffersAgainstSameWorkingTrack} repeated against the same working track, and ${diversity.repeatedTerminalOffersAgainstSameWorkingTrackAndAnchor} repeated against the same working track and anchor (${diversity.repeatedTerminalOffersAgainstSameWorkingTrackAndAnchorSpentFrames.toLocaleString()} charged frames).`, "");
    const t = summary.transitions;
    lines.push("Within-run transitions:", "", `- ${t.afterRejected} transitions followed a rejected terminal: ${t.afterRejectedLocalBridge} used that rejected offer as a one-step working track and ${t.afterRejectedGlobalIncumbentFollowup} next used the global incumbent (${t.afterRejectedIncumbentRetry} ordinary incumbent retries; ${t.afterRejectedBridgeReturnToIncumbent} returns after a bridge).`, `- Across comparable ordinary incumbent retries, the next anchor moved earlier/same/later ${t.afterRejectedAnchorEarlier}/${t.afterRejectedAnchorSame}/${t.afterRejectedAnchorLater} times. The same target was selected ${t.afterRejectedSameTarget} times and the exact same target+anchor ${t.afterRejectedSameTargetAndAnchor} times.`, `- Across those retries, the affordable set shrank ${t.afterRejectedAffordableSetShrank} times and stayed equal ${t.afterRejectedAffordableSetSame} times; whenever the previous target remained affordable, it was retained ${t.afterRejectedTargetRetained}/${t.afterRejectedTargetStillAffordable} times.`, `- ${t.afterAccepted} transitions followed acceptance: the independently recomputed anchor moved earlier/same/later ${t.afterAcceptedAnchorEarlier}/${t.afterAcceptedAnchorSame}/${t.afterAcceptedAnchorLater} times.`, "");
    const transitionOutcomes = summary.transitionOutcomes;
    const sameDecision = transitionOutcomes.afterRejectedSameTargetAndAnchor;
    const differentDecision = transitionOutcomes.afterRejectedDifferentDecision;
    const bridgeDecision = transitionOutcomes.afterRejectedLocalBridge;
    const bridgeReturn = transitionOutcomes.afterRejectedBridgeReturnToIncumbent;
    lines.push("Outcome of the next iteration after rejection:", "", `- Retrying the unchanged global incumbent at the independently recomputed same target+anchor: ${sameDecision.acceptedAlternatives}/${sameDecision.terminalReached} accepted, ${number(sameDecision.internalFullScoreDelta, 2)} internal-score gain, ${number(sameDecision.internalFullScoreDeltaPerMillionRepairFrames, 2)} gain per million frames.`, `- Retrying the unchanged global incumbent at a different target or anchor: ${differentDecision.acceptedAlternatives}/${differentDecision.terminalReached} accepted, ${number(differentDecision.internalFullScoreDelta, 2)} internal-score gain, ${number(differentDecision.internalFullScoreDeltaPerMillionRepairFrames, 2)} gain per million frames.`, `- Following the rejected local improvement as a protected working track: ${bridgeDecision.acceptedAlternatives}/${bridgeDecision.terminalReached} accepted globally, ${number(bridgeDecision.internalFullScoreDelta, 2)} internal-score gain, ${number(bridgeDecision.internalFullScoreDeltaPerMillionRepairFrames, 2)} gain per million frames.`, `- Returning to the global incumbent after a rejected bridge: ${bridgeReturn.acceptedAlternatives}/${bridgeReturn.terminalReached} accepted, ${number(bridgeReturn.internalFullScoreDelta, 2)} internal-score gain, ${number(bridgeReturn.internalFullScoreDeltaPerMillionRepairFrames, 2)} gain per million frames.`, "");
    const b = summary.adjacentBudgetAssociations;
    lines.push("Adjacent-budget associations (not isolated repair causality):", "", `- ${b.comparablePairs} matched source×seed adjacent-budget pairs; mean changes were ${number(b.meanEpisodeCountDelta)} repair iterations and ${number(b.meanAcceptedCountDelta)} accepted alternatives.`, `- Among ${b.bothHaveRepair} pairs with repair at both budgets, the first anchor at the higher budget was earlier/same/later ${b.firstAnchorEarlierAtHigherBudget}/${b.firstAnchorSameAtHigherBudget}/${b.firstAnchorLaterAtHigherBudget} times.`, "");
  }

  lines.push("## Evidence limits", "");
  const limits = [...new Set(artifact.arms.flatMap((arm: any) => arm.summary.evidenceLimits))];
  for (const limit of limits) lines.push(`- ${limit}`);
  lines.push("");
  return `${lines.join("\n")}\n`;
}

async function main(): Promise<void> {
  const arms = argumentsNamed("arm");
  const out = argument("out");
  const seedCountText = argument("seeds");
  const seedCount = seedCountText === undefined ? null : Number(seedCountText);
  if (arms.length === 0 || out === undefined) {
    throw new Error("usage: analyze_repair_behavior --arm=LABEL:ARCHIVE [--arm=...] [--seeds=N] --out=PREFIX");
  }
  if (seedCount !== null && (!Number.isInteger(seedCount) || seedCount <= 0)) {
    throw new Error(`--seeds must be a positive integer; got ${seedCountText}`);
  }
  const summaries = [];
  for (const value of arms) {
    const split = value.indexOf(":");
    if (split <= 0) throw new Error(`invalid --arm=${value}; expected LABEL:ARCHIVE`);
    const label = value.slice(0, split);
    const path = resolve(value.slice(split + 1));
    const archive = await readRepairArm(path);
    const availableSeeds = [...new Set(archive.runs.map((row) => row.task.actualSeed))]
      .sort((a, b) => a - b);
    const selectedSeeds = new Set(seedCount === null
      ? availableSeeds
      : availableSeeds.slice(0, seedCount));
    const selectedRows = archive.runs.filter((row) => selectedSeeds.has(row.task.actualSeed));
    const selectedCellFingerprint = sha256(Buffer.from(
      selectedRows.map(runKey).sort().join("\n"),
    ));
    summaries.push({
      label,
      path: archive.evidencePath,
      sha256: archive.sha256,
      archiveSchema: archive.schema ?? null,
      candidate: archive.candidate ?? null,
      selectedSeeds: [...selectedSeeds],
      selectedCellFingerprint,
      summary: summarizeRepairBehavior(selectedRows),
    });
  }
  const cellFingerprints = new Set(summaries.map((arm) => arm.selectedCellFingerprint));
  if (cellFingerprints.size !== 1) {
    throw new Error("selected arms do not contain the same source×budget×seed cells");
  }
  const prefix = resolve(out);
  const summariesWithPlots = summaries.map((arm) => {
    const plotFiles: Record<RepairPlotDimension, string> = {
      budget: `${prefix}.${slug(arm.label)}.budget.svg`,
      iteration: `${prefix}.${slug(arm.label)}.iteration.svg`,
      "parent-depth": `${prefix}.${slug(arm.label)}.parent-depth.svg`,
    };
    for (const dimension of Object.keys(plotFiles) as RepairPlotDimension[]) {
      const bytes = Buffer.from(renderRepairBehaviorPlot(arm.summary, dimension, arm.label));
      const path = plotFiles[dimension];
      writeFileAtomicDurable(path, bytes);
      writeFileAtomicDurable(`${path}.sha256`, `${sha256(bytes)}  ${path}\n`);
    }
    return { ...arm, plots: plotFiles };
  });
  const artifact = {
    schema: REPAIR_BEHAVIOR_SCHEMA,
    generatedAt: new Date().toISOString(),
    arms: summariesWithPlots,
  };
  const jsonBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  const markdownBytes = Buffer.from(markdown(artifact));
  writeFileAtomicDurable(`${prefix}.json`, jsonBytes);
  writeFileAtomicDurable(`${prefix}.json.sha256`, `${sha256(jsonBytes)}  ${prefix}.json\n`);
  writeFileAtomicDurable(`${prefix}.md`, markdownBytes);
  writeFileAtomicDurable(`${prefix}.md.sha256`, `${sha256(markdownBytes)}  ${prefix}.md\n`);
  for (const arm of summariesWithPlots) {
    const audit = arm.summary.invariantAudit;
    const violations = (Object.values(audit.checks) as AuditCheck[])
      .reduce((n, check) => n + check.violations, 0);
    console.log(`${arm.label}: ${arm.summary.overall.repairEpisodes} repairs, ${violations} invariant violations`);
  }
  console.log(`wrote ${prefix}.{json,md}`);
}

export async function readRepairArm(path: string): Promise<{
  schema?: string;
  runs: RunRow[];
  candidate?: unknown;
  sha256: string;
  evidencePath: string;
}> {
  if (!path.endsWith(".jsonl")) {
    const checkpointPath = path.endsWith(".gz")
      ? `${path.slice(0, -3)}.checkpoint.jsonl`
      : `${path}.checkpoint.jsonl`;
    if (existsSync(checkpointPath)) return readRepairArm(checkpointPath);
    const bytes = readFileSync(path);
    const archive = JSON.parse(bytes.toString()) as {
      schema?: string;
      runs?: RunRow[];
      candidate?: unknown;
    };
    if (!Array.isArray(archive.runs)) throw new Error(`${path} has no runs array`);
    return { ...archive, runs: archive.runs, sha256: sha256(bytes), evidencePath: path };
  }
  const hash = createHash("sha256");
  const input = createReadStream(path, { encoding: "utf8" });
  input.on("data", (chunk) => hash.update(chunk));
  const lines = createInterface({ input, crlfDelay: Infinity });
  const latestRuns = new Map<string, RunRow>();
  let schema: string | undefined;
  let headerSeen = false;
  for await (const line of lines) {
    if (line === "") continue;
    const entry = JSON.parse(line);
    if (!headerSeen) {
      headerSeen = true;
      schema = entry?.schema;
      if (typeof schema !== "string" || !schema.includes("budget-scale-checkpoint")) {
        throw new Error(`${path} is not a budget-scale checkpoint`);
      }
      continue;
    }
    if (entry?.type !== "result") continue;
    const result = entry.result;
    const row = {
      task: result.task,
      status: result.status,
      budgetTelemetry: result.budgetTelemetry ?? null,
    } as RunRow;
    latestRuns.set(runKey(row), row);
  }
  if (!headerSeen) throw new Error(`${path} is empty`);
  const runs = [...latestRuns.values()].filter((row) => row.status === "ok");
  return { schema, runs, candidate: undefined, sha256: hash.digest("hex"), evidencePath: path };
}

if (process.argv[1]?.endsWith("analyze_repair_behavior.ts")) await main();
