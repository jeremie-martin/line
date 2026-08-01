/**
 * Human-readable rendering of ONE compile's budget telemetry.
 *
 *   npx tsx scripts/v0/describe_budget_telemetry.ts <sidecar.budget-telemetry.json>
 *
 * Companion to scripts/v0/analyze_budget_telemetry.ts: the analyzer aggregates
 * many compiles into error/coverage statistics, this prints one compile's story
 * — where the budget went, which attempts ran, and what the estimator believed
 * at each observation. Semantics of every field: docs/compile-budget-telemetry.md.
 *
 * When a sibling `<prefix>.stats.json` exists (scripts/v0/run.ts writes one next
 * to the sidecar) its compiler counters are shown too, so the recorder's
 * accounting can be eyeballed against the compiler's own numbers.
 *
 * The payload is a moving target: a parallel workstream adds fields. This tool
 * therefore renders only what it recognizes, tolerates missing fields, and lists
 * unrecognized key names at the end rather than failing on them.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// ─────────── Defensive readers (payloads are evolving; never throw) ───────────

type Rec = Record<string, unknown>;

function asRecord(value: unknown): Rec | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Rec)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function num(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function str(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function bool(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

/** Scalar of unknown-but-printable type, for fields we recognize by name only. */
function scalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? group(value) : String(value);
  if (typeof value === "string" || typeof value === "boolean") return String(value);
  return null;
}

// ─────────── Formatting ───────────

const MISSING = "null";

/** Deterministic thousands grouping (no locale dependence). */
function group(value: number): string {
  const rounded = Math.round(value * 1000) / 1000;
  const negative = rounded < 0;
  const [whole, fraction] = Math.abs(rounded).toString().split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return `${negative ? "-" : ""}${grouped}${fraction ? `.${fraction}` : ""}`;
}

function count(value: unknown): string {
  const n = num(value);
  return n === null ? MISSING : group(Math.round(n));
}

function ratio(value: unknown, digits = 2): string {
  const n = num(value);
  return n === null ? MISSING : n.toFixed(digits);
}

function flag(value: unknown): string {
  const b = bool(value);
  return b === null ? MISSING : b ? "yes" : "no";
}

function text(value: unknown): string {
  return str(value) ?? MISSING;
}

const APPLICABILITY_CODES: Record<string, string> = {
  calibrated: "CAL",
  extrapolated_policy_budget: "EXT",
  unvalidated_attempt_kind: "UNV",
};

function applicabilityCode(value: unknown): string {
  const raw = str(value);
  if (raw === null) return MISSING;
  return APPLICABILITY_CODES[raw] ?? raw;
}

type Align = "l" | "r";

function columnWidths(headers: string[], rows: string[][]): number[] {
  return headers.map((header, column) =>
    rows.reduce((max, row) => Math.max(max, (row[column] ?? "").length), header.length),
  );
}

function renderTable(
  headers: string[],
  aligns: Align[],
  rows: string[][],
  indent: string,
  /** Shared widths, so sibling tables (the per-attempt walks) stay aligned. */
  fixedWidths?: number[],
): string[] {
  const widths = fixedWidths ?? columnWidths(headers, rows);
  const line = (cells: string[]): string =>
    indent + cells
      .map((cell, column) =>
        aligns[column] === "r"
          ? (cell ?? "").padStart(widths[column])
          : (cell ?? "").padEnd(widths[column]),
      )
      .join("  ")
      .trimEnd();
  return [line(headers), ...rows.map(line)];
}

// ─────────── Recognized keys (anything else is reported, not rendered) ───────────

const KNOWN_ROOT = new Set([
  "schema",
  "level",
  "archive_form",
  "model",
  "compile",
  "segments",
  "attempts",
]);
const KNOWN_COMPILE = new Set([
  "hard_budget_frames",
  "policy_budget_frames",
  "total_spent_frames",
  "hard_remaining_frames",
  "hard_overrun_frames",
  "budget_exhausted",
  "initial_structural_work_prior_frames",
  "initial_structural_slack",
  "initial_structural_applicability",
  "first_terminal_total_spent_frames",
]);
const KNOWN_SEGMENT = new Set([
  "kind",
  "attempt_id",
  "start_total_spent_frames",
  "end_total_spent_frames",
  "spent_frames",
  "stop_reason",
]);
const KNOWN_ATTEMPT = new Set([
  "attempt_id",
  "kind",
  "parent_attempt_id",
  "search_seed",
  "has_fallback",
  "anchor",
  "start_total_spent_frames",
  "ceiling_total_spent_frames",
  "ceiling_source",
  "available_hard_budget_frames",
  "local_budget_frames",
  "start",
  "end",
  "observations",
  "outcome",
]);
const KNOWN_OBSERVATION = new Set([
  "event",
  "total_spent_frames",
  "hard_remaining_frames",
  "hard_overrun_frames",
  "attempt_spent_frames",
  "attempt_remaining_frames",
  "attempt_overrun_frames",
  "high_water",
  "structural_startup_included",
  "estimator_applicability",
  "structural_progress_fraction",
  "structural_work_prior_frames",
  "incumbent_path_work_estimate_frames",
  "episode_pace_work_estimate_frames",
  "estimated_remaining_work_frames",
  "estimate_lower_frames",
  "estimate_upper_frames",
  "estimate_uncertainty_frames",
  "hard_completion_margin",
  "hard_completion_surplus_frames",
  "attempt_completion_margin",
  "attempt_completion_surplus_frames",
]);

function collectUnknown(record: Rec | null, known: Set<string>, into: Set<string>): void {
  if (record === null) return;
  for (const key of Object.keys(record)) if (!known.has(key)) into.add(key);
}

// ─────────── Sections ───────────

function renderHeader(path: string, payload: Rec): string[] {
  const model = asRecord(payload.model);
  const archiveForm = str(payload.archive_form);
  const lines = [
    `budget telemetry  ${path}`,
    `schema ${text(payload.schema)}   level=${text(payload.level)}` +
      // golden.json embeds a reduced copy; say so rather than let a reader read
      // stripped observation fields as missing ones.
      (archiveForm === null ? "" : `   archive_form=${archiveForm} (reduced copy)`),
  ];
  if (model !== null) {
    const fingerprint = str(model.estimator_fingerprint);
    lines.push(
      `model  traversal=${text(model.traversal_model)}  estimator=${text(model.estimator_model)}  ` +
        `fingerprint=${fingerprint === null ? MISSING : fingerprint.slice(0, 12)}  ` +
        `calibrated=${flag(model.calibrated)}`,
    );
    if (str(model.traversal_source) !== null) lines.push(`       source=${text(model.traversal_source)}`);
  }
  return lines;
}

function renderCompile(payload: Rec): string[] {
  const compile = asRecord(payload.compile);
  if (compile === null) return ["COMPILE", "  (no compile block in payload)"];
  const rows: string[][] = [];
  const push = (label: string, value: string | null): void => {
    if (value !== null) rows.push([label, value]);
  };
  push("hard budget", num(compile.hard_budget_frames) === null ? null : count(compile.hard_budget_frames));
  push("policy budget", num(compile.policy_budget_frames) === null ? null : count(compile.policy_budget_frames));
  push("total spent", num(compile.total_spent_frames) === null ? null : count(compile.total_spent_frames));
  push("hard remaining", num(compile.hard_remaining_frames) === null ? null : count(compile.hard_remaining_frames));
  push("hard overrun", num(compile.hard_overrun_frames) === null ? null : count(compile.hard_overrun_frames));
  push("budget exhausted", bool(compile.budget_exhausted) === null ? null : flag(compile.budget_exhausted));
  push(
    "initial structural prior",
    num(compile.initial_structural_work_prior_frames) === null
      ? null
      : count(compile.initial_structural_work_prior_frames),
  );
  push(
    "initial structural slack",
    num(compile.initial_structural_slack) === null ? null : ratio(compile.initial_structural_slack, 3),
  );
  // Compile-scope fields a later recorder may add; rendered only when present.
  push(
    "initial structural applicability",
    scalar(compile.initial_structural_applicability) ?? scalar(compile.estimator_applicability),
  );
  push("first terminal at", scalar(compile.first_terminal_total_spent_frames));
  return ["COMPILE", ...renderTable(["field", "value"], ["l", "r"], rows, "  ").slice(1)];
}

const STATS_FIELDS = [
  "sim_frames",
  "first_completion_frame",
  "predicted_first_completion_frames",
  "budget_slack",
  "budget_exhausted",
  "leaves_considered",
  "improvements",
  "gap_commits",
  "gap_backtracks",
] as const;

function renderStats(sidecarPath: string): string[] {
  const suffix = ".budget-telemetry.json";
  if (!sidecarPath.endsWith(suffix)) return [];
  const statsPath = `${sidecarPath.slice(0, -suffix.length)}.stats.json`;
  if (!existsSync(statsPath)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(readFileSync(statsPath, "utf8"));
  } catch {
    return [`COMPILE STATS  ${statsPath}`, "  (unreadable; skipped)"];
  }
  const envelope = asRecord(parsed);
  // run.ts wraps CompileStats in a small envelope; accept a bare CompileStats too.
  const stats = asRecord(envelope?.stats) ?? envelope;
  if (stats === null) return [];
  const rows: string[][] = [];
  for (const field of STATS_FIELDS) {
    const value = scalar(stats[field]);
    if (value !== null) rows.push([field, value]);
  }
  const elapsed = scalar(envelope?.elapsed_ms);
  if (elapsed !== null) rows.push(["elapsed_ms", elapsed]);
  if (rows.length === 0) return [];
  return [`COMPILE STATS  ${statsPath}`, ...renderTable(["field", "value"], ["l", "r"], rows, "  ").slice(1)];
}

function renderSegments(payload: Rec, unknown: Set<string>): string[] {
  const segments = asArray(payload.segments);
  if (segments.length === 0) return ["SEGMENTS (0)"];
  const rows = segments.map((entry, index) => {
    const segment = asRecord(entry) ?? {};
    collectUnknown(segment, KNOWN_SEGMENT, unknown);
    return [
      String(index),
      text(segment.kind),
      num(segment.attempt_id) === null ? MISSING : count(segment.attempt_id),
      count(segment.start_total_spent_frames),
      count(segment.end_total_spent_frames),
      count(segment.spent_frames),
      text(segment.stop_reason),
    ];
  });
  return [
    `SEGMENTS (${segments.length})`,
    ...renderTable(
      ["#", "kind", "att", "from", "to", "spent", "stop reason"],
      ["r", "l", "r", "r", "r", "r", "l"],
      rows,
      "  ",
    ),
  ];
}

function attemptOutcomeLabel(outcome: Rec | null): string {
  if (outcome === null) return MISSING;
  const completed = bool(outcome.completed);
  const censored = bool(outcome.censored);
  if (completed === true) return "completed";
  if (censored === true) return "censored";
  if (completed === false) return "incomplete";
  return MISSING;
}

/**
 * Attempt columns. `optional` columns describe fields a recorder version may
 * not emit; they are dropped when no attempt in this compile carries them, so
 * an older payload does not render a column of nulls.
 */
type AttemptColumn = {
  header: string;
  align: Align;
  optional?: boolean;
  cell: (attempt: Rec, anchor: Rec | null, outcome: Rec | null) => string;
};

const ATTEMPT_COLUMNS: AttemptColumn[] = [
  { header: "id", align: "r", cell: (a) => count(a.attempt_id) },
  { header: "kind", align: "l", cell: (a) => text(a.kind) },
  {
    header: "parent",
    align: "r",
    cell: (a) => (num(a.parent_attempt_id) === null ? MISSING : count(a.parent_attempt_id)),
  },
  { header: "seed", align: "r", cell: (a) => count(a.search_seed) },
  {
    header: "anchor gap@frame",
    align: "r",
    cell: (_a, anchor) =>
      anchor === null ? MISSING : `${count(anchor.gap_index)}@${count(anchor.anchor_frame)}`,
  },
  { header: "start", align: "r", cell: (a) => count(a.start_total_spent_frames) },
  { header: "ceiling", align: "r", cell: (a) => count(a.ceiling_total_spent_frames) },
  {
    header: "ceiling from",
    align: "l",
    optional: true,
    cell: (a) => text(a.ceiling_source),
  },
  { header: "local", align: "r", cell: (a) => count(a.local_budget_frames) },
  { header: "spent", align: "r", cell: (_a, _anchor, o) => (o === null ? MISSING : count(o.spent_frames)) },
  { header: "outcome", align: "l", cell: (_a, _anchor, o) => attemptOutcomeLabel(o) },
  { header: "stop reason", align: "l", cell: (_a, _anchor, o) => (o === null ? MISSING : text(o.stop_reason)) },
  {
    header: "1st term",
    align: "r",
    cell: (_a, _anchor, o) => (o === null ? MISSING : count(o.first_terminal_offset_frames)),
  },
  {
    header: "1st acc",
    align: "r",
    optional: true,
    cell: (_a, _anchor, o) => (o === null ? MISSING : count(o.first_accepted_improvement_offset_frames)),
  },
  {
    header: "accepted",
    align: "l",
    cell: (_a, _anchor, o) =>
      o === null || bool(o.accepted_improvement) === null ? MISSING : flag(o.accepted_improvement),
  },
  {
    header: "score delta",
    align: "r",
    optional: true,
    cell: (_a, _anchor, o) => (o === null ? MISSING : ratio(o.accepted_score_delta, 3)),
  },
];

function renderAttempts(payload: Rec, unknown: Set<string>): string[] {
  const attempts = asArray(payload.attempts);
  if (attempts.length === 0) return ["ATTEMPTS (0)"];
  const cells = attempts.map((entry) => {
    const attempt = asRecord(entry) ?? {};
    collectUnknown(attempt, KNOWN_ATTEMPT, unknown);
    const anchor = asRecord(attempt.anchor);
    const outcome = asRecord(attempt.outcome);
    return ATTEMPT_COLUMNS.map((column) => column.cell(attempt, anchor, outcome));
  });
  const columns = ATTEMPT_COLUMNS.map((column, index) => ({ column, index })).filter(
    ({ column, index }) => !column.optional || cells.some((row) => row[index] !== MISSING),
  );
  return [
    `ATTEMPTS (${attempts.length})`,
    ...renderTable(
      columns.map(({ column }) => column.header),
      columns.map(({ column }) => column.align),
      cells.map((row) => columns.map(({ index }) => row[index])),
      "  ",
    ),
  ];
}

/**
 * Trace payloads carry the full observation array; summary payloads keep only
 * the attempt's start and end. Walk whichever exists, and say which it was.
 */
function attemptObservations(attempt: Rec): { rows: unknown[]; source: string } {
  const observations = asArray(attempt.observations);
  if (observations.length > 0) return { rows: observations, source: "trace" };
  const fallback = [attempt.start, attempt.end].filter((entry) => asRecord(entry) !== null);
  return { rows: fallback, source: "start/end only" };
}

const WALK_HEADERS = [
  "event",
  "total",
  "att sp",
  "att rem",
  "hw",
  "S",
  "path",
  "pace",
  "EST",
  "lower",
  "upper",
  "hard mrg",
  "att mrg",
  "app",
];
const WALK_ALIGNS: Align[] = ["l", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "l"];

function walkRow(raw: unknown, unknown: Set<string>): string[] {
  const observation = asRecord(raw) ?? {};
  collectUnknown(observation, KNOWN_OBSERVATION, unknown);
  const highWater = asRecord(observation.high_water);
  return [
    text(observation.event),
    count(observation.total_spent_frames),
    count(observation.attempt_spent_frames),
    count(observation.attempt_remaining_frames),
    highWater === null ? MISSING : count(highWater.gap_index),
    count(observation.structural_work_prior_frames),
    count(observation.incumbent_path_work_estimate_frames),
    count(observation.episode_pace_work_estimate_frames),
    count(observation.estimated_remaining_work_frames),
    count(observation.estimate_lower_frames),
    count(observation.estimate_upper_frames),
    ratio(observation.hard_completion_margin),
    ratio(observation.attempt_completion_margin),
    applicabilityCode(observation.estimator_applicability),
  ];
}

function renderWalk(payload: Rec, unknown: Set<string>): string[] {
  const attempts = asArray(payload.attempts)
    .map((entry) => asRecord(entry))
    .filter((attempt): attempt is Rec => attempt !== null);
  if (attempts.length === 0) return [];
  const walks = attempts.map((attempt) => {
    const { rows, source } = attemptObservations(attempt);
    return { attempt, source, cells: rows.map((row) => walkRow(row, unknown)) };
  });
  // One width set for every attempt, so the columns line up down the page.
  const widths = columnWidths(WALK_HEADERS, walks.flatMap((walk) => walk.cells));
  const lines = ["OBSERVATION WALK   applicability: CAL calibrated · EXT extrapolated · UNV unvalidated kind"];
  for (const { attempt, source, cells } of walks) {
    lines.push(
      "",
      `  attempt ${count(attempt.attempt_id)}  kind=${text(attempt.kind)}  ` +
        `parent=${num(attempt.parent_attempt_id) === null ? MISSING : count(attempt.parent_attempt_id)}  ` +
        `fallback=${flag(attempt.has_fallback)}  ` +
        `observations=${cells.length} (${source})`,
    );
    if (cells.length === 0) continue;
    lines.push(...renderTable(WALK_HEADERS, WALK_ALIGNS, cells, "    ", widths));
  }
  return lines;
}

function renderUnknown(scopes: Array<{ scope: string; keys: Set<string> }>): string[] {
  const present = scopes.filter((entry) => entry.keys.size > 0);
  if (present.length === 0) return [];
  return [
    "UNRENDERED FIELDS  (present in the payload, not known to this renderer)",
    ...present.map((entry) => `  ${entry.scope}: ${[...entry.keys].sort().join(", ")}`),
  ];
}

// ─────────── Entry point ───────────

function describe(path: string): string {
  const payload = asRecord(JSON.parse(readFileSync(path, "utf8")));
  if (payload === null) throw new Error(`${path} is not a budget-telemetry object`);
  const rootUnknown = new Set<string>();
  const compileUnknown = new Set<string>();
  const segmentUnknown = new Set<string>();
  const attemptUnknown = new Set<string>();
  const observationUnknown = new Set<string>();
  collectUnknown(payload, KNOWN_ROOT, rootUnknown);
  collectUnknown(asRecord(payload.compile), KNOWN_COMPILE, compileUnknown);

  const sections: string[][] = [
    renderHeader(path, payload),
    renderCompile(payload),
    renderStats(path),
    renderSegments(payload, segmentUnknown),
    renderAttempts(payload, attemptUnknown),
    renderWalk(payload, observationUnknown),
    renderUnknown([
      { scope: "payload", keys: rootUnknown },
      { scope: "compile", keys: compileUnknown },
      { scope: "segment", keys: segmentUnknown },
      { scope: "attempt", keys: attemptUnknown },
      { scope: "observation", keys: observationUnknown },
    ]),
  ];
  return sections.filter((section) => section.length > 0).map((section) => section.join("\n")).join("\n\n");
}

function isCliEntry(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && import.meta.url === pathToFileURL(resolve(entry)).href;
}

if (isCliEntry()) {
  const paths = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
  if (paths.length === 0) {
    console.error(
      "usage: npx tsx scripts/v0/describe_budget_telemetry.ts <sidecar.budget-telemetry.json> [more...]",
    );
    process.exit(1);
  }
  const rendered: string[] = [];
  for (const path of paths) {
    try {
      rendered.push(describe(resolve(path)));
    } catch (error) {
      console.error(`cannot describe ${path}: ${error instanceof Error ? error.message : String(error)}`);
      process.exit(1);
    }
  }
  console.log(`${rendered.join("\n\n")}\n`);
}

export { describe as describeBudgetTelemetry };
