/** Audit and paired outcome report for repair authored-axis branch-and-bound. */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  pairGridCells,
  pairedGridOutcomeSummary,
  readGridArm,
  seedBlockPairedDelta,
  type GridArm,
} from "./paired_grid.ts";
import {
  REPAIR_AXIS_BRANCH_BOUND_SCHEMA,
  REPAIR_SUFFIX_RECOVERY_PRESSURE_THRESHOLDS,
} from "../v0/optimizer/repair_branch_bound.ts";

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const required = (name: string): string => {
  const value = argument(name);
  if (value === undefined) throw new Error(`missing --${name}=PATH`);
  return value;
};

const candidate = readGridArm("repair-axis-bound", required("candidate"));
const reference = readGridArm("reference", required("reference"));
const pairingNotes = assertPairedArms(candidate, reference);
const paired = pairGridCells(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);

let mode: "audit" | "prune" | "abort" | "incomplete-abort" | null = null;
let attempts = 0;
let terminalAttempts = 0;
let acceptedAttempts = 0;
let selectedNodes = 0;
let eligibleCheckpoints = 0;
let comparableRecoveryCheckpoints = 0;
let incomparableRecoveryCheckpoints = 0;
let missingCurrentAxisObservations = 0;
let dominatedSelections = 0;
let prunedSubtrees = 0;
let abortedAttempts = 0;
let incompletePrefixAbortedAttempts = 0;
let opportunities = 0;
let actionableOpportunities = 0;
let terminalObservations = 0;
let opportunitiesWithAlternative = 0;
let frontierReturns = 0;
let terminalDescendants = 0;
let acceptedTerminalDescendants = 0;
let measuredDominatedFrames = 0;
let terminalDescendantFrames = 0;
let maximumDominatedFrames = 0;
const activeRuns = new Set<string>();
const activeSources = new Set<string>();
const perSource = new Map<string, {
  runs: number;
  opportunities: number;
  actionable: number;
  terminalObservations: number;
  frames: number;
  actionableFrames: number;
  terminalDescendants: number;
}>();
type RecoverySummary = {
  threshold: number;
  opportunities: number;
  actionable: number;
  terminalObservations: number;
  opportunitiesWithAlternative: number;
  frontierReturns: number;
  terminalDescendants: number;
  acceptedTerminalDescendants: number;
  actionableTerminalDescendants: number;
  actionableAcceptedTerminalDescendants: number;
  frames: number;
  actionableFrames: number;
  terminalDescendantFrames: number;
  acceptedTerminalDescendantFrames: number;
  terminalDescendantAxisSseDelta: number;
  acceptedTerminalDescendantAxisSseDelta: number;
  activeActionableRuns: Set<string>;
  activeActionableSources: Set<string>;
};
const recoveryByThreshold = new Map<number, RecoverySummary>(
  REPAIR_SUFFIX_RECOVERY_PRESSURE_THRESHOLDS.map((threshold) => [
    threshold,
    {
      threshold,
      opportunities: 0,
      actionable: 0,
      terminalObservations: 0,
      opportunitiesWithAlternative: 0,
      frontierReturns: 0,
      terminalDescendants: 0,
      acceptedTerminalDescendants: 0,
      actionableTerminalDescendants: 0,
      actionableAcceptedTerminalDescendants: 0,
      frames: 0,
      actionableFrames: 0,
      terminalDescendantFrames: 0,
      acceptedTerminalDescendantFrames: 0,
      terminalDescendantAxisSseDelta: 0,
      acceptedTerminalDescendantAxisSseDelta: 0,
      activeActionableRuns: new Set(),
      activeActionableSources: new Set(),
    },
  ]),
);
let incompletePrefixOpportunities = 0;
let actionableIncompletePrefixOpportunities = 0;
let incompletePrefixTerminalObservations = 0;
let incompletePrefixFrontierReturns = 0;
let incompletePrefixTerminalDescendants = 0;
let incompletePrefixAcceptedTerminalDescendants = 0;
let incompletePrefixFrames = 0;
let actionableIncompletePrefixFrames = 0;
let maximumIncompletePrefixFrames = 0;
const incompletePrefixActiveRuns = new Set<string>();
const incompletePrefixActiveSources = new Set<string>();
const incompletePrefixPerSource = new Map<string, {
  opportunities: number;
  actionable: number;
  terminalDescendants: number;
  acceptedTerminalDescendants: number;
  frames: number;
  actionableFrames: number;
}>();

for (const [key, row] of candidateRows) {
  const label = printableKey(key);
  const referenceRow = referenceRows.get(key);
  if (referenceRow === undefined) throw new Error(`reference is missing ${label}`);
  const stats = row.stats?.handoff_repair_axis_branch_bound;
  if (stats?.schema !== REPAIR_AXIS_BRANCH_BOUND_SCHEMA) {
    throw new Error(`${label}: missing current repair axis-bound telemetry`);
  }
  if (
    stats.mode !== "audit" && stats.mode !== "prune" && stats.mode !== "abort" &&
    stats.mode !== "incomplete-abort"
  ) {
    throw new Error(`${label}: invalid repair axis-bound mode`);
  }
  if (mode === null) mode = stats.mode;
  if (mode !== stats.mode) throw new Error("candidate mixes repair axis-bound modes");
  if (stats.comparison_epsilon !== 1e-9) {
    throw new Error(`${label}: repair axis-bound epsilon drifted`);
  }
  if (
    JSON.stringify(stats.recovery_pressure_thresholds) !==
      JSON.stringify(REPAIR_SUFFIX_RECOVERY_PRESSURE_THRESHOLDS)
  ) throw new Error(`${label}: recovery-pressure thresholds drifted`);
  if (mode === "audit") assertAuditIdentity(label, row, referenceRow);

  let rowOpportunities = 0;
  let rowActionable = 0;
  let rowTerminalObservations = 0;
  let rowFrames = 0;
  let rowActionableFrames = 0;
  let rowTerminalDescendants = 0;
  stats.attempts.forEach((attempt: any, attemptOrdinal: number) => {
    if (
      attempt.iteration_index !== attemptOrdinal ||
      attempt.end_total_spent_frames < attempt.start_total_spent_frames ||
      attempt.accepted_alternative && !attempt.terminal_reached ||
      attempt.recovery_pressure_comparable_checkpoint_nodes +
          attempt.recovery_pressure_incomparable_checkpoint_nodes !==
        attempt.eligible_checkpoint_nodes ||
      attempt.aborted_by_bound && attempt.terminal_reached ||
      attempt.aborted_by_incomplete_prefix && attempt.terminal_reached ||
      attempt.dominated_selected_nodes < attempt.opportunities.length ||
      mode === "audit" && (
        attempt.pruned_subtrees !== 0 || attempt.aborted_by_bound ||
        attempt.aborted_by_incomplete_prefix
      ) ||
      mode === "prune" && (
        attempt.aborted_by_bound || attempt.aborted_by_incomplete_prefix
      ) ||
      mode === "abort" && (
        attempt.pruned_subtrees !== 0 || attempt.aborted_by_incomplete_prefix
      ) ||
      mode === "incomplete-abort" && (
        attempt.pruned_subtrees !== 0 || attempt.aborted_by_bound
      )
    ) throw new Error(`${label}: malformed repair axis-bound attempt ${attemptOrdinal}`);
    attempts++;
    terminalAttempts += Number(attempt.terminal_reached);
    acceptedAttempts += Number(attempt.accepted_alternative);
    selectedNodes += attempt.selected_nodes;
    eligibleCheckpoints += attempt.eligible_checkpoint_nodes;
    comparableRecoveryCheckpoints +=
      attempt.recovery_pressure_comparable_checkpoint_nodes;
    incomparableRecoveryCheckpoints +=
      attempt.recovery_pressure_incomparable_checkpoint_nodes;
    missingCurrentAxisObservations +=
      attempt.recovery_pressure_missing_current_axis_observations;
    dominatedSelections += attempt.dominated_selected_nodes;
    prunedSubtrees += attempt.pruned_subtrees;
    abortedAttempts += Number(attempt.aborted_by_bound);
    incompletePrefixAbortedAttempts += Number(attempt.aborted_by_incomplete_prefix);
    attempt.opportunities.forEach((opportunity: any, opportunityOrdinal: number) => {
      if (
        opportunity.opportunity_index !== opportunityOrdinal ||
        opportunity.end_total_spent_frames < opportunity.root_total_spent_frames ||
        opportunity.spent_frames_in_subtree !==
          opportunity.end_total_spent_frames - opportunity.root_total_spent_frames ||
        !(opportunity.incumbent_quality_margin > stats.comparison_epsilon) ||
        opportunity.accepted_terminal_descended ||
        opportunity.terminal_descended !==
          (opportunity.outcome === "terminal_descendant")
      ) throw new Error(`${label}: malformed dominated subtree ${opportunityOrdinal}`);
      opportunities++;
      actionableOpportunities += Number(!opportunity.root_terminal);
      terminalObservations += Number(opportunity.root_terminal);
      rowOpportunities++;
      rowActionable += Number(!opportunity.root_terminal);
      rowTerminalObservations += Number(opportunity.root_terminal);
      opportunitiesWithAlternative += Number(opportunity.frontier_nodes_at_entry > 0);
      frontierReturns += Number(opportunity.outcome === "frontier_return");
      terminalDescendants += Number(opportunity.terminal_descended);
      rowTerminalDescendants += Number(opportunity.terminal_descended);
      acceptedTerminalDescendants += Number(opportunity.accepted_terminal_descended);
      measuredDominatedFrames += opportunity.spent_frames_in_subtree;
      rowFrames += opportunity.spent_frames_in_subtree;
      if (!opportunity.root_terminal) {
        rowActionableFrames += opportunity.spent_frames_in_subtree;
      }
      if (opportunity.terminal_descended) {
        terminalDescendantFrames += opportunity.spent_frames_in_subtree;
      }
      maximumDominatedFrames = Math.max(
        maximumDominatedFrames,
        opportunity.spent_frames_in_subtree,
      );
    });
    const recoveryOrdinals = new Map<number, number>();
    attempt.recovery_pressure_opportunities.forEach((opportunity: any) => {
      const summary = recoveryByThreshold.get(opportunity.threshold);
      const expectedOrdinal = recoveryOrdinals.get(opportunity.threshold) ?? 0;
      const remaining = Math.max(
        0,
        attempt.incumbent_axis_sse - opportunity.incumbent_prefix_axis_sse,
      );
      const excess = Math.max(
        0,
        opportunity.current_prefix_axis_sse - opportunity.incumbent_prefix_axis_sse,
      );
      const expectedPressure = remaining > 1e-15
        ? excess / remaining
        : excess > 1e-15 ? null : 0;
      const expectedTerminalDelta = opportunity.terminal_axis_sse === null
        ? null
        : opportunity.terminal_axis_sse - attempt.incumbent_axis_sse;
      if (
        summary === undefined ||
        opportunity.opportunity_index !== expectedOrdinal ||
        opportunity.current_prefix_axis_count !== opportunity.incumbent_prefix_axis_count ||
        opportunity.end_total_spent_frames < opportunity.root_total_spent_frames ||
        opportunity.spent_frames_in_subtree !==
          opportunity.end_total_spent_frames - opportunity.root_total_spent_frames ||
        Math.abs(opportunity.incumbent_remaining_axis_sse - remaining) > 1e-9 ||
        Math.abs(opportunity.prefix_excess_axis_sse - excess) > 1e-9 ||
        !sameNullableNumber(opportunity.recovery_pressure, expectedPressure) ||
        opportunity.recovery_pressure !== null &&
          opportunity.recovery_pressure < opportunity.threshold ||
        opportunity.terminal_descended !==
          (opportunity.outcome === "terminal_descendant") ||
        opportunity.terminal_descended !== (opportunity.terminal_axis_sse !== null) ||
        !sameNullableNumber(
          opportunity.terminal_axis_sse_delta_from_incumbent,
          expectedTerminalDelta,
        ) ||
        opportunity.accepted_terminal_descended &&
          (!opportunity.terminal_descended || !attempt.accepted_alternative)
      ) throw new Error(
        `${label}: malformed recovery-pressure opportunity ` +
        `${opportunity.threshold}/${expectedOrdinal}`,
      );
      recoveryOrdinals.set(opportunity.threshold, expectedOrdinal + 1);
      summary.opportunities++;
      summary.actionable += Number(!opportunity.root_terminal);
      summary.terminalObservations += Number(opportunity.root_terminal);
      summary.opportunitiesWithAlternative += Number(opportunity.frontier_nodes_at_entry > 0);
      summary.frontierReturns += Number(opportunity.outcome === "frontier_return");
      summary.terminalDescendants += Number(opportunity.terminal_descended);
      summary.acceptedTerminalDescendants += Number(
        opportunity.accepted_terminal_descended,
      );
      summary.actionableTerminalDescendants += Number(
        !opportunity.root_terminal && opportunity.terminal_descended,
      );
      summary.actionableAcceptedTerminalDescendants += Number(
        !opportunity.root_terminal && opportunity.accepted_terminal_descended,
      );
      summary.frames += opportunity.spent_frames_in_subtree;
      summary.actionableFrames += !opportunity.root_terminal
        ? opportunity.spent_frames_in_subtree
        : 0;
      summary.terminalDescendantFrames += opportunity.terminal_descended
        ? opportunity.spent_frames_in_subtree
        : 0;
      summary.acceptedTerminalDescendantFrames += opportunity.accepted_terminal_descended
        ? opportunity.spent_frames_in_subtree
        : 0;
      summary.terminalDescendantAxisSseDelta += opportunity.terminal_descended
        ? opportunity.terminal_axis_sse_delta_from_incumbent
        : 0;
      summary.acceptedTerminalDescendantAxisSseDelta +=
        opportunity.accepted_terminal_descended
          ? opportunity.terminal_axis_sse_delta_from_incumbent
          : 0;
      if (!opportunity.root_terminal) {
        summary.activeActionableRuns.add(key);
        summary.activeActionableSources.add(row.task.sourceId);
      }
    });
    attempt.incomplete_prefix_opportunities.forEach(
      (opportunity: any, opportunityOrdinal: number) => {
        const expectedTerminalDelta = opportunity.terminal_axis_sse === null
          ? null
          : opportunity.terminal_axis_sse - attempt.incumbent_axis_sse;
        if (
          opportunity.opportunity_index !== opportunityOrdinal ||
          opportunity.current_prefix_axis_count >= opportunity.incumbent_prefix_axis_count ||
          opportunity.missing_current_axis_observations !==
            opportunity.incumbent_prefix_axis_count - opportunity.current_prefix_axis_count ||
          opportunity.end_total_spent_frames < opportunity.root_total_spent_frames ||
          opportunity.spent_frames_in_subtree !==
            opportunity.end_total_spent_frames - opportunity.root_total_spent_frames ||
          opportunity.terminal_descended !==
            (opportunity.outcome === "terminal_descendant") ||
          opportunity.terminal_descended !== (opportunity.terminal_axis_sse !== null) ||
          !sameNullableNumber(
            opportunity.terminal_axis_sse_delta_from_incumbent,
            expectedTerminalDelta,
          ) ||
          opportunity.accepted_terminal_descended &&
            (!opportunity.terminal_descended || !attempt.accepted_alternative)
        ) throw new Error(
          `${label}: malformed incomplete-prefix opportunity ${opportunityOrdinal}`,
        );
        incompletePrefixOpportunities++;
        actionableIncompletePrefixOpportunities += Number(!opportunity.root_terminal);
        incompletePrefixTerminalObservations += Number(opportunity.root_terminal);
        incompletePrefixFrontierReturns += Number(opportunity.outcome === "frontier_return");
        incompletePrefixTerminalDescendants += Number(opportunity.terminal_descended);
        incompletePrefixAcceptedTerminalDescendants += Number(
          opportunity.accepted_terminal_descended,
        );
        incompletePrefixFrames += opportunity.spent_frames_in_subtree;
        actionableIncompletePrefixFrames += !opportunity.root_terminal
          ? opportunity.spent_frames_in_subtree
          : 0;
        maximumIncompletePrefixFrames = Math.max(
          maximumIncompletePrefixFrames,
          opportunity.spent_frames_in_subtree,
        );
        if (!opportunity.root_terminal) {
          incompletePrefixActiveRuns.add(key);
          incompletePrefixActiveSources.add(row.task.sourceId);
        }
        const source = incompletePrefixPerSource.get(row.task.sourceId) ?? {
          opportunities: 0,
          actionable: 0,
          terminalDescendants: 0,
          acceptedTerminalDescendants: 0,
          frames: 0,
          actionableFrames: 0,
        };
        source.opportunities++;
        source.actionable += Number(!opportunity.root_terminal);
        source.terminalDescendants += Number(opportunity.terminal_descended);
        source.acceptedTerminalDescendants += Number(
          opportunity.accepted_terminal_descended,
        );
        source.frames += opportunity.spent_frames_in_subtree;
        source.actionableFrames += !opportunity.root_terminal
          ? opportunity.spent_frames_in_subtree
          : 0;
        incompletePrefixPerSource.set(row.task.sourceId, source);
      },
    );
  });
  if (rowOpportunities > 0) {
    activeRuns.add(key);
    activeSources.add(row.task.sourceId);
  }
  const source = perSource.get(row.task.sourceId) ?? {
    runs: 0,
    opportunities: 0,
    actionable: 0,
    terminalObservations: 0,
    frames: 0,
    actionableFrames: 0,
    terminalDescendants: 0,
  };
  source.runs++;
  source.opportunities += rowOpportunities;
  source.actionable += rowActionable;
  source.terminalObservations += rowTerminalObservations;
  source.frames += rowFrames;
  source.actionableFrames += rowActionableFrames;
  source.terminalDescendants += rowTerminalDescendants;
  perSource.set(row.task.sourceId, source);
}

if (mode === null) throw new Error("candidate has no rows");
if (acceptedTerminalDescendants !== 0) {
  throw new Error("dominance proof falsified by an accepted descendant");
}

const result = {
  schema: "line.repair-axis-branch-bound-analysis.v5",
  generated_at: new Date().toISOString(),
  scope: {
    mode,
    cells: candidate.cells.size,
    budgets: candidate.archive.budgets,
    seeds: candidate.archive.seeds,
    sources: perSource.size,
    interpretation: mode === "audit"
      ? "Behavior-neutral map of strict dominance and graded suffix recovery pressure. Recovery pressure is a burden, not a proof of failure."
      : mode === "incomplete-abort"
      ? "Live repair-attempt abort on a committed authored-observation deficit; paired score evidence is compact screening, not promotion."
      : "Live repair-only strict-bound disposition; paired score evidence is compact screening, not promotion.",
  },
  pairing_notes: pairingNotes,
  exact_behavior_identity: mode === "audit",
  paired_outcomes: pairedGridOutcomeSummary(paired.pairs),
  score: scoreSummary(paired.pairs),
  mechanics: {
    attempts,
    terminal_attempts: terminalAttempts,
    accepted_attempts: acceptedAttempts,
    selected_nodes: selectedNodes,
    eligible_checkpoint_nodes: eligibleCheckpoints,
    recovery_pressure_comparable_checkpoint_nodes: comparableRecoveryCheckpoints,
    recovery_pressure_incomparable_checkpoint_nodes: incomparableRecoveryCheckpoints,
    recovery_pressure_missing_current_axis_observations: missingCurrentAxisObservations,
    dominated_selected_nodes: dominatedSelections,
    dominated_subtrees: opportunities,
    actionable_nonterminal_dominated_subtrees: actionableOpportunities,
    dominated_terminal_observations: terminalObservations,
    pruned_subtrees: prunedSubtrees,
    attempts_aborted_by_bound: abortedAttempts,
    attempts_aborted_by_incomplete_prefix: incompletePrefixAbortedAttempts,
    dominated_subtrees_with_queued_alternative: opportunitiesWithAlternative,
    frontier_return_subtrees: frontierReturns,
    terminal_descendant_subtrees: terminalDescendants,
    accepted_terminal_descendant_subtrees: acceptedTerminalDescendants,
    charged_frames_inside_dominated_subtrees: measuredDominatedFrames,
    charged_frames_to_dominated_terminal_descendants: terminalDescendantFrames,
    maximum_charged_frames_in_one_dominated_subtree: maximumDominatedFrames,
    active_runs: activeRuns.size,
    active_sources: activeSources.size,
    per_source: [...perSource].sort(([a], [b]) => a.localeCompare(b)).map(
      ([source_id, value]) => ({ source_id, ...value }),
    ),
  },
  recovery_pressure: [...recoveryByThreshold.values()].map((summary) => ({
    threshold: summary.threshold,
    opportunities: summary.opportunities,
    actionable_nonterminal_opportunities: summary.actionable,
    terminal_observations: summary.terminalObservations,
    opportunities_with_queued_alternative: summary.opportunitiesWithAlternative,
    frontier_return_opportunities: summary.frontierReturns,
    terminal_descendant_opportunities: summary.terminalDescendants,
    accepted_terminal_descendant_opportunities: summary.acceptedTerminalDescendants,
    actionable_terminal_descendant_opportunities: summary.actionableTerminalDescendants,
    actionable_accepted_terminal_descendant_opportunities:
      summary.actionableAcceptedTerminalDescendants,
    actionable_acceptance_rate_given_terminal_descendant:
      summary.actionableTerminalDescendants === 0
        ? null
        : summary.actionableAcceptedTerminalDescendants /
          summary.actionableTerminalDescendants,
    charged_frames: summary.frames,
    actionable_charged_frames: summary.actionableFrames,
    terminal_descendant_charged_frames: summary.terminalDescendantFrames,
    accepted_terminal_descendant_charged_frames: summary.acceptedTerminalDescendantFrames,
    mean_terminal_descendant_axis_sse_delta: summary.terminalDescendants === 0
      ? null
      : summary.terminalDescendantAxisSseDelta / summary.terminalDescendants,
    mean_accepted_terminal_descendant_axis_sse_delta:
      summary.acceptedTerminalDescendants === 0
        ? null
        : summary.acceptedTerminalDescendantAxisSseDelta /
          summary.acceptedTerminalDescendants,
    active_actionable_runs: summary.activeActionableRuns.size,
    active_actionable_sources: summary.activeActionableSources.size,
  })),
  incomplete_prefix: {
    opportunities: incompletePrefixOpportunities,
    actionable_nonterminal_opportunities: actionableIncompletePrefixOpportunities,
    terminal_observations: incompletePrefixTerminalObservations,
    frontier_return_opportunities: incompletePrefixFrontierReturns,
    terminal_descendant_opportunities: incompletePrefixTerminalDescendants,
    accepted_terminal_descendant_opportunities:
      incompletePrefixAcceptedTerminalDescendants,
    categorical_hypothesis_falsified:
      incompletePrefixAcceptedTerminalDescendants > 0,
    charged_frames: incompletePrefixFrames,
    actionable_charged_frames: actionableIncompletePrefixFrames,
    maximum_charged_frames_in_one_opportunity: maximumIncompletePrefixFrames,
    active_actionable_runs: incompletePrefixActiveRuns.size,
    active_actionable_sources: incompletePrefixActiveSources.size,
    per_source: [...incompletePrefixPerSource]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([source_id, value]) => ({ source_id, ...value })),
  },
  interpretation_limits: [
    "The upper bound is exact for the compiler register's authored-axis objective; it does not rewrite or cap the authored specification.",
    "Audit subtree frames are the charged work until ordinary traversal exits that lineage. They are a counterfactual work opportunity, not a prediction of which alternative a live prune will reach.",
    "Recovery pressure is prefix excess SSE divided by the incumbent's remaining suffix SSE. A value of 0.5 means the route must eliminate half of that remaining incumbent error merely to catch up.",
    "A prefix missing authored-axis observations present in the completed incumbent is not assigned an optimistic pressure. It is counted as incomparable rather than silently treating missing error as zero.",
    "Incomplete-prefix lineage is a categorical hypothesis under audit. An accepted descendant would falsify it because final evaluation, not segmented prefix telemetry, is authoritative.",
    "Unlike strict dominance, recovery-pressure crossings may recover and be accepted. Accepted descendants are direct false-abort evidence for that threshold, not invariant violations.",
    "Compact paired cells characterize mechanics and screen a live rule. Only the canonical 750k probability ladder can authorize promotion.",
  ],
};

const json = `${JSON.stringify(result, null, 2)}\n`;
const out = argument("out");
if (out === undefined) process.stdout.write(json);
else {
  const path = resolve(out);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, json);
  process.stdout.write(`wrote ${path}\n`);
}

function rowsByKey(arm: GridArm): Map<string, any> {
  return new Map(arm.archive.runs.map((row: any) => [
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    row,
  ]));
}

function printableKey(key: string): string {
  return key.replaceAll("\u0000", "/");
}

function scoreSummary(pairs: ReturnType<typeof pairGridCells>["pairs"]): unknown {
  const bySource = new Map<string, number[]>();
  for (const pair of pairs) {
    const deltas = bySource.get(pair.candidate.sourceId) ?? [];
    deltas.push(pair.candidate.score - pair.ref.score);
    bySource.set(pair.candidate.sourceId, deltas);
  }
  const deltas = pairs.map((pair) => pair.candidate.score - pair.ref.score);
  return {
    seed_block: seedBlockPairedDelta([...pairs]),
    minimum_cell_delta: deltas.length === 0 ? null : Math.min(...deltas),
    changed_cells: deltas.filter((delta) => delta !== 0).length,
    improved_cells: deltas.filter((delta) => delta > 0).length,
    regressed_cells: deltas.filter((delta) => delta < 0).length,
    per_source: [...bySource].sort(([a], [b]) => a.localeCompare(b)).map(
      ([source_id, values]) => ({
        source_id,
        mean_delta: values.reduce((sum, value) => sum + value, 0) / values.length,
      }),
    ),
  };
}

function assertAuditIdentity(label: string, candidateRow: any, referenceRow: any): void {
  const candidate = structuredClone(candidateRow);
  const reference = structuredClone(referenceRow);
  delete candidate.elapsedMs;
  delete reference.elapsedMs;
  delete candidate.stats.handoff_repair_axis_branch_bound;
  if (JSON.stringify(candidate) !== JSON.stringify(reference)) {
    throw new Error(`${label}: audit changed behavior outside its telemetry field`);
  }
}

function sameNullableNumber(actual: unknown, expected: number | null): boolean {
  if (actual === null || expected === null) return actual === expected;
  return typeof actual === "number" && Number.isFinite(actual) &&
    Math.abs(actual - expected) <= 1e-12 * Math.max(1, Math.abs(expected));
}
