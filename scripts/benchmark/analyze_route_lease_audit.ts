/** Verify and summarize the behavior-neutral selected-route lease audit. */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  readGridArm,
  type GridArm,
} from "./paired_grid.ts";

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = required("candidate");
const referencePath = required("reference");
const outPath = argument("out");
const candidate = readGridArm("route-lease-audit", candidatePath);
const reference = readGridArm("phase-d", referencePath);
const pairingNotes = assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate);
const referenceRows = rowsByKey(reference);

const audits: Array<{ source: string; seed: number; audit: any }> = [];
let exactCells = 0;
for (const [key, candidateRow] of candidateRows) {
  const referenceRow = referenceRows.get(key);
  if (referenceRow === undefined) throw new Error(`reference is missing ${printableKey(key)}`);
  const label = printableKey(key);
  const stats = candidateRow.stats?.handoff_selective_backtracking;
  if (
    stats?.policy !== "selective_axis_regret_catchup_value_initial_expire_10" ||
    stats.route_lease_audit_enabled !== true
  ) throw new Error(`${label}: candidate is not the accepted Phase-D audit mode`);
  const rows = stats.route_lease_audits ?? [];
  if (
    stats.route_lease_audits_started !== rows.length ||
    stats.route_lease_audits_selected !== rows.filter(
      (audit: any) => audit.selected_total_spent_frames !== null,
    ).length ||
    stats.route_lease_audits_with_loss_crossing !== rows.filter(
      (audit: any) => audit.first_loss_crossing !== null,
    ).length
  ) throw new Error(`${label}: route-lease audit counters do not match their ledger`);
  const events = stats.events ?? [];
  for (const audit of rows) {
    validateAudit(label, audit, events[audit.event_index]);
    audits.push({ source: candidateRow.task.sourceId, seed: candidateRow.task.actualSeed, audit });
  }
  assertBehaviorIdentity(label, candidateRow, referenceRow);
  exactCells++;
}
if (exactCells !== referenceRows.size || exactCells === 0) {
  throw new Error("candidate/reference audit scopes differ");
}

const crossings = audits.filter(({ audit }) => audit.first_loss_crossing !== null);
const affordableCrossings = crossings.filter(({ audit }) =>
  audit.first_loss_crossing.displaced_incumbent_affordable_with_reserve === true
);
const result = {
  schema: "line.route-lease-audit-analysis.v1",
  generated_at: new Date().toISOString(),
  evidence: {
    candidate: candidate.path,
    reference: reference.path,
  },
  scope: {
    cells: exactCells,
    sources: new Set([...candidate.cells.values()].map((cell) => cell.sourceId)).size,
    budgets: candidate.archive.budgets,
    seeds: candidate.archive.seeds,
    interpretation:
      "Behavior-neutral audit of accepted Phase D on paired 750k cells; never score or promotion evidence.",
  },
  pairing_notes: pairingNotes,
  invariants: {
    track_score_report_work_and_budget_identity_cells: exactCells,
    all_cells_exact: true,
    audits_started: audits.length,
    audits_selected: audits.filter(({ audit }) => audit.selected_total_spent_frames !== null).length,
    audit_ledgers_valid: true,
  },
  opportunity: {
    loss_crossings: crossings.length,
    crossings_with_incumbent_available: crossings.filter(({ audit }) =>
      audit.first_loss_crossing.displaced_incumbent_available === true
    ).length,
    crossings_with_incumbent_affordable_with_1_25_reserve: affordableCrossings.length,
    crossing_runs: new Set(crossings.map(({ source, seed }) => `${source}\0${seed}`)).size,
    crossing_sources: new Set(crossings.map(({ source }) => source)).size,
    affordable_crossing_runs: new Set(
      affordableCrossings.map(({ source, seed }) => `${source}\0${seed}`),
    ).size,
    affordable_crossing_sources: new Set(affordableCrossings.map(({ source }) => source)).size,
    selection_ordinals: distribution(crossings.map(({ audit }) =>
      audit.first_loss_crossing.selection_ordinal
    )),
    gap_advances: distribution(crossings.map(({ audit }) =>
      audit.first_loss_crossing.gap_index - audit.takeover_gap_index
    )),
    frames_to_crossing: distribution(crossings.map(({ audit }) =>
      audit.first_loss_crossing.total_spent_frames - audit.selected_total_spent_frames
    )),
    incumbent_margin_at_crossing: distribution(crossings.map(({ audit }) =>
      audit.first_loss_crossing.displaced_incumbent_conservative_deadline_margin
    )),
    end_reasons: countBy(audits.map(({ audit }) => audit.end_reason ?? "compile_ceiling")),
  },
  by_source: [...grouped(audits, ({ source }) => source)].sort(([a], [b]) =>
    a.localeCompare(b)
  ).map(([source, rows]) => ({
    source,
    audits: rows.length,
    crossings: rows.filter(({ audit }) => audit.first_loss_crossing !== null).length,
    affordable_crossings: rows.filter(({ audit }) =>
      audit.first_loss_crossing?.displaced_incumbent_affordable_with_reserve === true
    ).length,
  })),
  direct_observations: [
    {
      id: "loss_crossing_is_observable",
      statement:
        `${crossings.length}/${audits.length} selected equal-depth routes later exceed ` +
        "the displaced incumbent's last comparable whole-prefix loss.",
    },
    {
      id: "affordable_incumbent_at_crossing",
      statement:
        `${affordableCrossings.length}/${crossings.length} crossings retain an available ` +
        "incumbent whose conservative work fits with the existing 1.25 reserve factor.",
    },
  ],
  interpretation_limits: [
    "A crossing does not reveal the displaced incumbent's unobserved suffix or terminal score.",
    "The audit identifies a live intervention opportunity; it does not establish rollback value.",
    "Source and timing summaries must not become fitted eligibility rules.",
  ],
};

console.log(`ROUTE-LEASE AUDIT  ${exactCells} exact paired cells`);
console.log(
  `audits ${audits.length}; crossings ${crossings.length}; affordable ` +
    `${affordableCrossings.length}; sources ${result.opportunity.crossing_sources}`,
);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`analysis ${absolute}`);
}

function validateAudit(label: string, audit: any, event: any): void {
  if (
    event?.catchup_outcome !== "alternative_selected" ||
    event.trigger_signal !== "value_exploration" ||
    event.catchup_selected_route_ordinal !== audit.selected_route_ordinal ||
    event.catchup_selected_alternative_ordinal !== audit.selected_alternative_ordinal ||
    audit.takeover_gap_index !== event.from_gap_index ||
    audit.selected_takeover.axis_count !== audit.displaced_incumbent_takeover.axis_count ||
    !(audit.takeover_axis_loss_gain > 0) ||
    !approximatelyEqual(
      audit.takeover_axis_loss_gain,
      audit.displaced_incumbent_takeover.axis_loss - audit.selected_takeover.axis_loss,
    )
  ) throw new Error(`${label}: malformed equal-depth takeover audit`);
  validateWindow(label, audit.selected_takeover);
  validateWindow(label, audit.displaced_incumbent_takeover);
  let firstCrossing: any = null;
  for (const checkpoint of audit.checkpoints) {
    validateWindow(label, checkpoint.whole_prefix);
    validateWindow(label, checkpoint.divergent_suffix);
    if (
      checkpoint.gap_index <= audit.takeover_gap_index ||
      checkpoint.whole_prefix.axis_count !==
        audit.selected_takeover.axis_count + checkpoint.divergent_suffix.axis_count ||
      !approximatelyEqual(
        checkpoint.whole_prefix.axis_sse,
        audit.selected_takeover.axis_sse + checkpoint.divergent_suffix.axis_sse,
      ) ||
      checkpoint.displaced_incumbent_affordable_with_reserve &&
        !checkpoint.displaced_incumbent_available
    ) throw new Error(`${label}: malformed route-lease checkpoint`);
    if (firstCrossing === null && checkpoint.loss_excess_over_displaced_incumbent > 0) {
      firstCrossing = checkpoint;
    }
  }
  if (JSON.stringify(firstCrossing) !== JSON.stringify(audit.first_loss_crossing)) {
    throw new Error(`${label}: first route-loss crossing is not exact`);
  }
  if (
    audit.end_reason === "displaced_incumbent_resumed" &&
    audit.end_total_spent_frames !== event.resumed_total_spent_frames
  ) throw new Error(`${label}: incumbent-resumption end is detached from its event`);
}

function assertBehaviorIdentity(label: string, candidateRow: any, referenceRow: any): void {
  const candidateStats = stripAudit(candidateRow.stats);
  const referenceStats = stripAudit(referenceRow.stats);
  for (const [name, left, right] of [
    ["status", candidateRow.status, referenceRow.status],
    ["authored contacts", candidateRow.authoredContacts, referenceRow.authoredContacts],
    ["track", candidateRow.trackHash, referenceRow.trackHash],
    ["report", candidateRow.report, referenceRow.report],
    ["score", candidateRow.score, referenceRow.score],
    ["stats", candidateStats, referenceStats],
    ["budget telemetry", candidateRow.budgetTelemetry, referenceRow.budgetTelemetry],
  ] as const) {
    if (JSON.stringify(left) !== JSON.stringify(right)) {
      throw new Error(`${label}: behavior-neutral audit changed ${name}`);
    }
  }
}

function stripAudit(stats: any): any {
  const clone = structuredClone(stats);
  const selective = clone?.handoff_selective_backtracking;
  if (selective !== undefined) {
    delete selective.route_lease_audit_enabled;
    delete selective.route_lease_rollback_enabled;
    delete selective.route_lease_audits_started;
    delete selective.route_lease_audits_selected;
    delete selective.route_lease_audits_with_loss_crossing;
    delete selective.route_lease_rollbacks_admitted;
    delete selective.route_lease_rollbacks_executed;
    delete selective.route_lease_rollbacks_incumbent_unavailable;
    delete selective.route_lease_rollbacks_terminal_reserve_suppressed;
    delete selective.route_lease_audits;
  }
  return clone;
}

function validateWindow(label: string, value: any): void {
  if (
    !Number.isSafeInteger(value?.axis_count) || value.axis_count < 0 ||
    !Number.isFinite(value?.axis_sse) || value.axis_sse < 0 ||
    !Number.isFinite(value?.axis_loss) || value.axis_loss < 0
  ) throw new Error(`${label}: invalid route-lease axis window`);
}

function rowsByKey(arm: GridArm): Map<string, any> {
  return new Map(arm.archive.runs.map((row: any) => [
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    row,
  ]));
}

function grouped<T>(values: T[], keyOf: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) result.set(keyOf(value), [...(result.get(keyOf(value)) ?? []), value]);
  return result;
}

function countBy(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function distribution(values: number[]): any {
  const ordered = [...values].sort((a, b) => a - b);
  return {
    count: ordered.length,
    minimum: ordered[0] ?? null,
    median: ordered.length === 0 ? null : ordered[Math.floor(ordered.length / 2)]!,
    maximum: ordered.at(-1) ?? null,
  };
}

function approximatelyEqual(left: number, right: number): boolean {
  return Math.abs(left - right) <= 1e-10 * Math.max(1, Math.abs(left), Math.abs(right));
}

function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value.length === 0) {
    throw new Error("usage: --candidate=ARCHIVE --reference=ARCHIVE [--out=JSON]");
  }
  return value;
}

function printableKey(key: string): string { return key.replaceAll("\0", "/"); }
