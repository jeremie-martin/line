/**
 * Audit the independent repair controller from retained Budget Telemetry V4.
 *
 * This is deliberately not a score comparison. It checks controller invariants,
 * measures within-incumbent transitions, and characterizes budget associations.
 * Claims that the current archive cannot establish are reported as evidence
 * limits instead of being reconstructed from the final track.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { writeFileAtomicDurable } from "../v0/benchmark_v2/durable_fs.ts";
import {
  BUDGET_TELEMETRY_SCHEMA,
  type BudgetEpisodeTelemetry,
  type CompileBudgetTelemetry,
} from "../v0/optimizer/budget_telemetry.ts";

export const REPAIR_BEHAVIOR_SCHEMA = "line.benchmark-v2.repair-behavior.v1" as const;

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
  meanAnchorGap: number | null;
  meanAnchorRemainingGaps: number | null;
  meanRemainingBudgetFrames: number | null;
  meanEstimatedUpperUtilization: number | null;
  completionWithinEstimatedUpperRate: number | null;
  completionWithinAllocationRate: number | null;
  terminalGeometryIdentical: number;
  terminalGeometryIdenticalRate: number | null;
  firstDivergenceAtAnchorRate: number | null;
  meanDivergentSuffixGaps: number | null;
  weakGapSseImprovement: number | null;
  weakGapImprovementRate: number | null;
  acceptedWeakGapImprovementRate: number | null;
  acceptedWeakGapWorsened: number;
  internalFullScoreDelta: number;
  internalFullScoreDeltaPerMillionRepairFrames: number | null;
  replayableDecisionEpisodes: number;
  directTrackIdentityEpisodes: number;
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
  transitions: ReturnType<typeof summarizeTransitions>;
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
    transitions: summarizeTransitions(rows),
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
      "anchorMatchesFixedParentDepth",
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
      close(decision.target_gap_sse, episode.incumbent_weak_gap_sse) &&
        close(decision.target_gap_sse, episode.repair_weak_gap_before?.sse),
      label,
    );
    const consideredTargets = (decision as any).considered_targets;
    if (Array.isArray(consideredTargets)) {
      const replayed = consideredTargets.flatMap((candidate: any) => {
        const anchors = Array.isArray(candidate.anchor_options)
          ? candidate.anchor_options
            .filter((anchor: any) => anchor.affordability === "affordable")
            .sort((a: any, b: any) => b.parent_depth - a.parent_depth)
          : candidate.affordability === "affordable"
            ? [candidate]
            : [];
        return anchors.length === 0 ? [] : [{ candidate, anchor: anchors[0] }];
      }).sort((a: any, b: any) =>
        b.candidate.target_gap_sse - a.candidate.target_gap_sse ||
        a.candidate.target_gap_index - b.candidate.target_gap_index
      )[0];
      audit.check(
        "worstAffordableTargetReplaysExactly",
        replayed !== undefined &&
          replayed.candidate.target_gap_index === decision.target_gap_index &&
          replayed.anchor.anchor_gap_index === decision.anchor_gap_index &&
          close(replayed.candidate.target_gap_sse, decision.target_gap_sse) &&
          close(replayed.anchor.estimated_anchor_cost_frames,
            decision.estimated_anchor_cost_frames) &&
          close(replayed.anchor.estimated_anchor_cost_upper_frames,
            decision.estimated_anchor_cost_upper_frames),
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
      "acceptanceMatchesTerminalRegisterAdoption",
      episode.outcome.accepted_alternative ===
        (episode.work.terminal_register_improvements === 1),
      label,
    );
    audit.check(
      "terminalHasDirectDivergenceEvidence",
      episode.outcome.terminal_reached === (episode.outcome.repair_divergence !== null),
      label,
    );
    audit.check(
      "identicalTerminalIsNeverAccepted",
      episode.outcome.repair_divergence?.terminal_geometry_identical !== true ||
        !episode.outcome.accepted_alternative,
      label,
    );
    const incumbentHash = (decision as any).incumbent_track_hash;
    const offerHash = (episode.outcome as any).terminal_offer_track_hash;
    if (typeof incumbentHash === "string" &&
        (offerHash === null || typeof offerHash === "string")) {
      audit.check(
        "trackHashesAgreeWithDirectGeometry",
        !episode.outcome.terminal_reached ||
          episode.outcome.repair_divergence!.terminal_geometry_identical ===
            (offerHash === incumbentHash),
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
        "rejectedAlternativeLeavesSelectedGapUnchanged",
        close(episode.repair_weak_gap_before?.sse, episode.outcome.repair_weak_gap_after?.sse),
        label,
      );
    }
    if (episode.search_seed !== null) {
      audit.check("freshSearchSeedPerIteration", !seenSeeds.has(episode.search_seed), label);
      seenSeeds.add(episode.search_seed);
    }

    const next = repairs[index + 1];
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
    if (!episode.outcome.accepted_alternative) {
      const nextAffordable = new Set(nextDecision.affordable_target_gap_indices);
      audit.check(
        "affordableSetOnlyShrinksAfterRejection",
        nextDecision.affordable_target_gap_indices.every((gap) => affordable.includes(gap)),
        label,
      );
      if (nextAffordable.has(decision.target_gap_index)) {
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
  const comparableWeak = completed.flatMap(({ episode }) => {
    const before = episode.repair_weak_gap_before?.sse;
    const after = episode.outcome.repair_weak_gap_after?.sse;
    return before === undefined || after === undefined ? [] : [before - after];
  });
  const acceptedWeak = accepted.flatMap(({ episode }) => {
    const before = episode.repair_weak_gap_before?.sse;
    const after = episode.outcome.repair_weak_gap_after?.sse;
    return before === undefined || after === undefined ? [] : [before - after];
  });
  const spent = sum(entries.map(({ episode }) => episode.outcome.spent_frames ?? 0));
  const compileSpent = sum(rows.map((row) => telemetry(row).compile.total_spent_frames));
  const actualToUpper = completed.flatMap(({ episode }) => {
    const actual = episode.outcome.first_terminal_offset_frames;
    const upper = episode.repair_decision!.estimated_anchor_cost_upper_frames;
    return actual === null || upper <= 0 ? [] : [actual / upper];
  });
  const directDivergence = completed.flatMap(({ episode }) => {
    const value = episode.outcome.repair_divergence;
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
    meanAnchorGap: roundedMean(entries.map(({ episode }) => episode.anchor.gap_index)),
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
    terminalGeometryIdenticalRate: roundedRatio(
      directDivergence.filter(({ value }) => value.terminal_geometry_identical).length,
      directDivergence.length,
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
    weakGapSseImprovement: comparableWeak.length === 0 ? null : round(sum(comparableWeak)),
    weakGapImprovementRate: roundedRatio(
      comparableWeak.filter((value) => value > 0).length,
      comparableWeak.length,
    ),
    acceptedWeakGapImprovementRate: roundedRatio(
      acceptedWeak.filter((value) => value > 0).length,
      acceptedWeak.length,
    ),
    acceptedWeakGapWorsened: acceptedWeak.filter((value) => value < 0).length,
    internalFullScoreDelta: round(internalDelta),
    internalFullScoreDeltaPerMillionRepairFrames:
      spent === 0 ? null : round(internalDelta * 1_000_000 / spent),
    replayableDecisionEpisodes: entries.filter(({ episode }) =>
      Array.isArray((episode.repair_decision as any)?.considered_targets)
    ).length,
    directTrackIdentityEpisodes: entries.filter(({ episode }) =>
      typeof (episode.repair_decision as any)?.incumbent_track_hash === "string" &&
      (episode.outcome as any).terminal_offer_track_hash !== undefined
    ).length,
  };
}

function summarizeTransitions(rows: RunRow[]): {
  total: number;
  afterAccepted: number;
  afterRejected: number;
  afterAcceptedAnchorEarlier: number;
  afterAcceptedAnchorSame: number;
  afterAcceptedAnchorLater: number;
  afterRejectedAnchorEarlier: number;
  afterRejectedAnchorSame: number;
  afterRejectedAnchorLater: number;
  afterRejectedTargetStillAffordable: number;
  afterRejectedTargetRetained: number;
  afterRejectedAffordableSetShrank: number;
  afterRejectedAffordableSetSame: number;
} {
  const result = {
    total: 0,
    afterAccepted: 0,
    afterRejected: 0,
    afterAcceptedAnchorEarlier: 0,
    afterAcceptedAnchorSame: 0,
    afterAcceptedAnchorLater: 0,
    afterRejectedAnchorEarlier: 0,
    afterRejectedAnchorSame: 0,
    afterRejectedAnchorLater: 0,
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
      const movement = next.anchor.gap_index < current.anchor.gap_index
        ? "AnchorEarlier"
        : next.anchor.gap_index === current.anchor.gap_index
          ? "AnchorSame"
          : "AnchorLater";
      result[`${prefix}${movement}`]++;
      if (!accepted) {
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
  lines.push("", "The checks cover budget/headroom arithmetic, fixed-parent anchoring, selected-anchor affordability, weakness-field agreement, one-terminal execution, acceptance attribution, direct divergence, rejected-incumbent stability, fresh search seeds, and cross-iteration revision/register continuity.", "");

  for (const arm of artifact.arms) {
    const summary = arm.summary as RepairBehaviorSummary;
    lines.push(`## ${arm.label}`, "", `Evidence: \`${arm.path}\` (SHA-256 \`${arm.sha256}\`), ${summary.cells} source×budget×seed cells.`, "");
    lines.push("| Budget | Repair runs | Episodes/run | Terminal rate | Accepted/terminal | Mean anchor | Mean suffix gaps | Actual/upper | Identical terminals | Weak-gap SSE Δ | Internal Δ/M frames |", "|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
    for (const row of summary.perBudget) {
      lines.push(`| ${Math.round(row.budget / 1000)}k | ${row.runsWithRepair}/${row.runs} | ${row.repairEpisodesPerRun.toFixed(2)} | ${percentage(row.terminalReachedRate)} | ${percentage(row.acceptedPerTerminalRate)} | ${number(row.meanAnchorGap, 1)} | ${number(row.meanDivergentSuffixGaps, 1)} | ${percentage(row.meanEstimatedUpperUtilization)} | ${row.terminalGeometryIdentical} | ${number(row.weakGapSseImprovement, 3)} | ${number(row.internalFullScoreDeltaPerMillionRepairFrames, 2)} |`);
    }
    const o = summary.overall;
    lines.push("", "Direct observations:", "", `- ${o.terminalReached}/${o.repairEpisodes} iterations reached a terminal; ${o.acceptedAlternatives} were adopted.`, `- Repair used ${percentage(o.repairSpentShare)} of charged work. Completion stayed within the selected anchor's estimated upper cost in ${percentage(o.completionWithinEstimatedUpperRate)} of completed iterations.`, `- ${o.terminalGeometryIdentical}/${o.terminalReached} terminal alternatives were geometry-identical to their incumbents; the first divergence occurred at the anchor in ${percentage(o.firstDivergenceAtAnchorRate)} of divergent terminals.`, `- Accepted alternatives improved the selected weak gap ${percentage(o.acceptedWeakGapImprovementRate)} of the time; ${o.acceptedWeakGapWorsened} accepted alternatives worsened it while improving the register globally.`, `- Aggregate selected-gap SSE improvement was ${number(o.weakGapSseImprovement, 4)}; internal full-score gain was ${number(o.internalFullScoreDelta, 2)} (${number(o.internalFullScoreDeltaPerMillionRepairFrames, 2)} per million repair frames).`, `- Full decision replay was available for ${o.replayableDecisionEpisodes}/${o.repairEpisodes} episodes and direct incumbent/offer hashes for ${o.directTrackIdentityEpisodes}/${o.repairEpisodes}.`, "");
    const t = summary.transitions;
    lines.push("Within-run transitions:", "", `- ${t.afterRejected} transitions followed a rejected terminal: the next anchor moved earlier/same/later ${t.afterRejectedAnchorEarlier}/${t.afterRejectedAnchorSame}/${t.afterRejectedAnchorLater} times.`, `- The affordable set shrank after rejection ${t.afterRejectedAffordableSetShrank} times and stayed equal ${t.afterRejectedAffordableSetSame} times. Whenever the previous target remained affordable, it was retained ${t.afterRejectedTargetRetained}/${t.afterRejectedTargetStillAffordable} times.`, `- ${t.afterAccepted} transitions followed acceptance: the independently recomputed anchor moved earlier/same/later ${t.afterAcceptedAnchorEarlier}/${t.afterAcceptedAnchorSame}/${t.afterAcceptedAnchorLater} times.`, "");
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
  if (arms.length === 0 || out === undefined) {
    throw new Error("usage: analyze_repair_behavior --arm=LABEL:ARCHIVE [--arm=...] --out=PREFIX");
  }
  const summaries = [];
  for (const value of arms) {
    const split = value.indexOf(":");
    if (split <= 0) throw new Error(`invalid --arm=${value}; expected LABEL:ARCHIVE`);
    const label = value.slice(0, split);
    const path = resolve(value.slice(split + 1));
    const bytes = readFileSync(path);
    const archive = JSON.parse(bytes.toString()) as { schema?: string; runs?: RunRow[]; candidate?: unknown };
    if (!Array.isArray(archive.runs)) throw new Error(`${path} has no runs array`);
    summaries.push({
      label,
      path,
      sha256: sha256(bytes),
      archiveSchema: archive.schema ?? null,
      candidate: archive.candidate ?? null,
      summary: summarizeRepairBehavior(archive.runs),
    });
  }
  const artifact = {
    schema: REPAIR_BEHAVIOR_SCHEMA,
    generatedAt: new Date().toISOString(),
    arms: summaries,
  };
  const prefix = resolve(out);
  const jsonBytes = Buffer.from(`${JSON.stringify(artifact, null, 2)}\n`);
  const markdownBytes = Buffer.from(markdown(artifact));
  writeFileAtomicDurable(`${prefix}.json`, jsonBytes);
  writeFileAtomicDurable(`${prefix}.json.sha256`, `${sha256(jsonBytes)}  ${prefix}.json\n`);
  writeFileAtomicDurable(`${prefix}.md`, markdownBytes);
  writeFileAtomicDurable(`${prefix}.md.sha256`, `${sha256(markdownBytes)}  ${prefix}.md\n`);
  for (const arm of summaries) {
    const audit = arm.summary.invariantAudit;
    const violations = Object.values(audit.checks).reduce((n, check) => n + check.violations, 0);
    console.log(`${arm.label}: ${arm.summary.overall.repairEpisodes} repairs, ${violations} invariant violations`);
  }
  console.log(`wrote ${prefix}.{json,md}`);
}

if (process.argv[1]?.endsWith("analyze_repair_behavior.ts")) await main();
