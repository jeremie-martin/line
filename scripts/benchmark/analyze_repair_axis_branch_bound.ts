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
import { REPAIR_AXIS_BRANCH_BOUND_SCHEMA } from "../v0/optimizer/repair_branch_bound.ts";

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

let mode: "audit" | "prune" | "abort" | null = null;
let attempts = 0;
let terminalAttempts = 0;
let acceptedAttempts = 0;
let selectedNodes = 0;
let eligibleCheckpoints = 0;
let dominatedSelections = 0;
let prunedSubtrees = 0;
let abortedAttempts = 0;
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

for (const [key, row] of candidateRows) {
  const label = printableKey(key);
  const referenceRow = referenceRows.get(key);
  if (referenceRow === undefined) throw new Error(`reference is missing ${label}`);
  const stats = row.stats?.handoff_repair_axis_branch_bound;
  if (stats?.schema !== REPAIR_AXIS_BRANCH_BOUND_SCHEMA) {
    throw new Error(`${label}: missing current repair axis-bound telemetry`);
  }
  if (stats.mode !== "audit" && stats.mode !== "prune" && stats.mode !== "abort") {
    throw new Error(`${label}: invalid repair axis-bound mode`);
  }
  if (mode === null) mode = stats.mode;
  if (mode !== stats.mode) throw new Error("candidate mixes repair axis-bound modes");
  if (stats.comparison_epsilon !== 1e-9) {
    throw new Error(`${label}: repair axis-bound epsilon drifted`);
  }
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
      attempt.aborted_by_bound && attempt.terminal_reached ||
      attempt.dominated_selected_nodes < attempt.opportunities.length ||
      mode === "audit" && (attempt.pruned_subtrees !== 0 || attempt.aborted_by_bound) ||
      mode === "prune" && attempt.aborted_by_bound ||
      mode === "abort" && attempt.pruned_subtrees !== 0
    ) throw new Error(`${label}: malformed repair axis-bound attempt ${attemptOrdinal}`);
    attempts++;
    terminalAttempts += Number(attempt.terminal_reached);
    acceptedAttempts += Number(attempt.accepted_alternative);
    selectedNodes += attempt.selected_nodes;
    eligibleCheckpoints += attempt.eligible_checkpoint_nodes;
    dominatedSelections += attempt.dominated_selected_nodes;
    prunedSubtrees += attempt.pruned_subtrees;
    abortedAttempts += Number(attempt.aborted_by_bound);
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
  schema: "line.repair-axis-branch-bound-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    mode,
    cells: candidate.cells.size,
    budgets: candidate.archive.budgets,
    seeds: candidate.archive.seeds,
    sources: perSource.size,
    interpretation: mode === "audit"
      ? "Behavior-neutral map of whole repair subtrees that cannot beat the completed incumbent even with zero remaining authored-axis error."
      : "Live repair-only pruning of mathematically dominated subtrees; paired score evidence is compact screening, not promotion.",
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
    dominated_selected_nodes: dominatedSelections,
    dominated_subtrees: opportunities,
    actionable_nonterminal_dominated_subtrees: actionableOpportunities,
    dominated_terminal_observations: terminalObservations,
    pruned_subtrees: prunedSubtrees,
    attempts_aborted_by_bound: abortedAttempts,
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
  interpretation_limits: [
    "The upper bound is exact for the compiler register's authored-axis objective; it does not rewrite or cap the authored specification.",
    "Audit subtree frames are the charged work until ordinary traversal exits that lineage. They are a counterfactual work opportunity, not a prediction of which alternative a live prune will reach.",
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
