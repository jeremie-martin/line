/** Verify behavior identity and summarize post-revalidation route leases. */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import {
  assertPairedArms,
  gridCellKey,
  readGridArm,
} from "./paired_grid.ts";

const args = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const candidatePath = required("candidate");
const referencePath = required("reference");
const outPath = argument("out");
const candidate = readGridArm("route-lease-renewal-audit", candidatePath);
const reference = readGridArm("one-shot-revalidation", referencePath);
const pairingNotes = assertPairedArms(candidate, reference);
const candidateRows = rowsByKey(candidate.archive.runs);
const referenceRows = rowsByKey(reference.archive.runs);

const renewals: Array<{
  source: string;
  seed: number;
  audit: any;
  parentEndTotalSpentFrames: number;
  supersedingEvent: any | null;
}> = [];
let exactCells = 0;
for (const [key, candidateRow] of candidateRows) {
  const referenceRow = referenceRows.get(key);
  if (referenceRow === undefined) throw new Error(`reference is missing ${printableKey(key)}`);
  const label = printableKey(key);
  const stats = candidateRow.stats?.handoff_selective_backtracking;
  if (
    stats?.policy !== "selective_axis_regret_catchup_value_initial_expire_10" ||
    stats.route_lease_audit_enabled !== true ||
    stats.route_lease_rollback_enabled !== false ||
    stats.route_lease_revalidation_enabled !== true ||
    stats.route_lease_renewal_audit_enabled !== true ||
    stats.route_lease_revalidation_lineage_reset_enabled === true
  ) throw new Error(`${label}: candidate is not the renewal-audit arm`);
  const rows = stats.route_lease_audits ?? [];
  const renewalRows = rows.filter((audit: any) => audit.origin === "revalidation_renewal");
  if (
    stats.route_lease_audits_started !== rows.length ||
    stats.route_lease_renewal_audits_started !== renewalRows.length ||
    stats.route_lease_renewal_audits_with_loss_crossing !== renewalRows.filter(
      (audit: any) => audit.first_loss_crossing !== null,
    ).length
  ) throw new Error(`${label}: renewal counters do not match their ledger`);
  for (const audit of renewalRows) {
    const parentEndTotalSpentFrames = validateRenewal(label, audit, rows);
    const supersedingEvents = audit.end_reason === "superseded_by_selective_tournament"
      ? eventsAt(stats.events ?? [], audit.end_total_spent_frames)
      : [];
    if (
      audit.end_reason === "superseded_by_selective_tournament" &&
      supersedingEvents.length !== 1
    ) throw new Error(`${label}: renewed lease has no unique superseding tournament`);
    renewals.push({
      source: candidateRow.task.sourceId,
      seed: candidateRow.task.actualSeed,
      audit,
      parentEndTotalSpentFrames,
      supersedingEvent: supersedingEvents[0] ?? null,
    });
  }
  assertBehaviorIdentity(label, candidateRow, referenceRow);
  exactCells++;
}
if (exactCells !== referenceRows.size || exactCells === 0) {
  throw new Error("candidate/reference renewal-audit scopes differ");
}

const crossings = renewals.filter((row) => row.audit.first_loss_crossing !== null);
const available = crossings.filter((row) =>
  row.audit.first_loss_crossing.displaced_incumbent_available === true
);
const affordable = crossings.filter((row) =>
  row.audit.first_loss_crossing.displaced_incumbent_affordable_with_reserve === true
);
const superseded = renewals.filter((row) => row.supersedingEvent !== null);
const staleSuperseded = superseded.filter((row) =>
  row.supersedingEvent.branch_gap_index < row.audit.takeover_gap_index
);
const result = {
  schema: "line.route-lease-renewal-audit-analysis.v1",
  generated_at: new Date().toISOString(),
  scope: {
    cells: exactCells,
    budgets: candidate.archive.budgets,
    seeds: candidate.archive.seeds,
    identity_reference: referencePath,
  },
  pairing_notes: pairingNotes,
  identity: {
    exact_cells: exactCells,
    track_score_report_work_and_non_lease_stats: true,
  },
  renewal: {
    leases: renewals.length,
    runs: new Set(renewals.map((row) => `${row.source}\0${row.seed}`)).size,
    sources: new Set(renewals.map((row) => row.source)).size,
    loss_crossings: crossings.length,
    crossing_runs: new Set(crossings.map((row) => `${row.source}\0${row.seed}`)).size,
    crossing_sources: new Set(crossings.map((row) => row.source)).size,
    crossings_with_displaced_route_available: available.length,
    crossings_affordable_with_reserve: affordable.length,
    takeover_gain: summary(renewals.map((row) => row.audit.takeover_axis_loss_gain)),
    crossing_gap_advance: summary(crossings.map((row) =>
      row.audit.first_loss_crossing.gap_index - row.audit.takeover_gap_index
    )),
    crossing_frames_after_takeover: summary(crossings.map((row) =>
      row.audit.first_loss_crossing.total_spent_frames -
        row.parentEndTotalSpentFrames
    )),
    end_reasons: counted(renewals.map((row) => row.audit.end_reason ?? "compile_ceiling")),
    superseded_by_tournament: superseded.length,
    superseded_by_watch_from_before_measured_horizon: staleSuperseded.length,
    superseding_watch_branch_lag: summary(superseded.map((row) =>
      row.audit.takeover_gap_index - row.supersedingEvent!.branch_gap_index
    )),
  },
  by_source: [...grouped(renewals, (row) => row.source)]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([source, rows]) => ({
      source,
      leases: rows.length,
      crossings: rows.filter((row) => row.audit.first_loss_crossing !== null).length,
    })),
  interpretation: [
    "A renewal crossing is a live repeated-revalidation opportunity, not evidence that acting improves score.",
    "Immediate supersession by an ordinary selective tournament means the existing controller already reconsidered the route before renewal could mature.",
    "A superseding watch whose branch gap predates the measured takeover horizon is stale with respect to that revalidation; this is lineage attribution, not a score claim.",
    "Behavior identity is exact after removing only route-lease audit telemetry.",
  ],
};

console.log(`ROUTE-LEASE RENEWAL AUDIT  ${exactCells} exact paired cells`);
console.log(
  `renewals ${renewals.length}; crossings ${crossings.length}; ` +
    `available ${available.length}; affordable ${affordable.length}; ` +
    `sources ${result.renewal.crossing_sources}`,
);
if (outPath !== undefined) {
  const absolute = resolve(outPath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`analysis ${absolute}`);
}

function validateRenewal(label: string, audit: any, rows: any[]): number {
  const parent = rows[audit.parent_audit_index];
  if (
    audit.parent_audit_index === null || parent === undefined ||
    parent.revalidation === null ||
    (parent.revalidation.outcome !== "current_selected" &&
      parent.revalidation.outcome !== "incumbent_selected") ||
    audit.takeover_gap_index !== parent.revalidation.target_gap_index ||
    audit.selected_takeover.axis_count !== audit.displaced_incumbent_takeover.axis_count ||
    audit.selected_takeover.axis_loss > audit.displaced_incumbent_takeover.axis_loss ||
    audit.revalidation !== null || audit.revalidation_disposition !== null ||
    audit.rollback_disposition !== null || audit.rollback_total_spent_frames !== null
  ) throw new Error(`${label}: invalid renewed route lease`);
  const parentEndTotalSpentFrames = parent.revalidation.end_total_spent_frames;
  const crossing = audit.first_loss_crossing;
  if (crossing !== null && (
    crossing.gap_index <= audit.takeover_gap_index ||
    crossing.total_spent_frames < parentEndTotalSpentFrames ||
    !(crossing.loss_excess_over_displaced_incumbent > 0)
  )) throw new Error(`${label}: invalid renewed route loss crossing`);
  return parentEndTotalSpentFrames;
}

function assertBehaviorIdentity(label: string, candidateRow: any, referenceRow: any): void {
  const candidateStats = stripLeaseTelemetry(candidateRow.stats);
  const referenceStats = stripLeaseTelemetry(referenceRow.stats);
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
      throw new Error(`${label}: behavior-neutral renewal audit changed ${name}`);
    }
  }
}

function stripLeaseTelemetry(stats: any): any {
  const clone = structuredClone(stats);
  const selective = clone?.handoff_selective_backtracking;
  if (selective === undefined) return clone;
  for (const key of Object.keys(selective)) {
    if (key.startsWith("route_lease_")) delete selective[key];
  }
  return clone;
}

function rowsByKey(rows: any[]): Map<string, any> {
  return new Map(rows.map((row) => [
    gridCellKey(row.task.sourceId, row.task.budget, row.task.actualSeed),
    row,
  ]));
}
function eventsAt(events: any[], totalSpentFrames: number | null): any[] {
  return totalSpentFrames === null
    ? []
    : events.filter((event) => event.trigger_total_spent_frames === totalSpentFrames);
}
function grouped<T>(values: T[], keyOf: (value: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) result.set(keyOf(value), [...(result.get(keyOf(value)) ?? []), value]);
  return result;
}
function counted(values: string[]): Record<string, number> {
  return Object.fromEntries([...grouped(values, (value) => value)]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, rows]) => [key, rows.length]));
}
function summary(values: number[]): {
  count: number;
  min: number | null;
  median: number | null;
  mean: number | null;
  max: number | null;
} {
  if (values.length === 0) return { count: 0, min: null, median: null, mean: null, max: null };
  const ordered = [...values].sort((a, b) => a - b);
  const middle = Math.floor(ordered.length / 2);
  return {
    count: values.length,
    min: ordered[0]!,
    median: ordered.length % 2 === 1
      ? ordered[middle]!
      : (ordered[middle - 1]! + ordered[middle]!) / 2,
    mean: values.reduce((total, value) => total + value, 0) / values.length,
    max: ordered.at(-1)!,
  };
}
function required(name: string): string {
  const value = argument(name);
  if (value === undefined || value.length === 0) {
    throw new Error("usage: --candidate=ARCHIVE --reference=ARCHIVE [--out=JSON]");
  }
  return value;
}
function printableKey(key: string): string { return key.replaceAll("\0", "/"); }
