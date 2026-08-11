/**
 * Human-readable rendering of ONE compile's budget telemetry.
 *
 *   npx tsx scripts/v0/describe_budget_telemetry.ts <sidecar.budget-telemetry.json>
 *
 * Companion to scripts/v0/analyze_budget_telemetry.ts: the analyzer aggregates
 * many compiles into error/coverage statistics, this prints one compile's story
 * — where the budget went, which episodes ran, and what the estimator believed
 * at each observation. Semantics of every field: docs/compile-budget-telemetry.md.
 *
 * When a sibling `<prefix>.stats.json` exists (scripts/v0/run.ts writes one next
 * to the sidecar) its compiler counters are shown too, so the recorder's
 * accounting can be eyeballed against the compiler's own numbers.
 *
 * This renderer accepts the current schema only. Historical payloads must use
 * their historical tooling; silently translating old repair semantics into V5
 * episode semantics would produce false comparisons.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { BUDGET_TELEMETRY_SCHEMA } from "./optimizer/budget_telemetry.ts";

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
  "execution_intervals",
  "episodes",
  "node_events",
]);
const KNOWN_COMPILE = new Set([
  "hard_budget_frames",
  "policy_budget_frames",
  "search_policy_budget_frames",
  "repair_budget_frames",
  "total_spent_frames",
  "hard_remaining_frames",
  "hard_overrun_frames",
  "budget_exhausted",
  "initial_structural_work_prior_frames",
  "initial_structural_slack",
  "initial_structural_applicability",
  "first_terminal_total_spent_frames",
  "first_improving_terminal_total_spent_frames",
  "work",
  "final_output_episode_id",
  "final_output_lane",
  "resume_admission",
]);
const KNOWN_INTERVAL = new Set([
  "kind",
  "episode_id",
  "start_total_spent_frames",
  "end_total_spent_frames",
  "spent_frames",
  "stop_reason",
]);
const KNOWN_EPISODE = new Set([
  "episode_id",
  "lane",
  "parent_episode_id",
  "search_seed",
  "frontier_has_fallback_lane",
  "anchor",
  "repair_decision",
  "incumbent_weak_gap_sse",
  "repair_weak_gap_before",
  "start_total_spent_frames",
  "ceiling_total_spent_frames",
  "ceiling_source",
  "available_hard_budget_frames",
  "allocated_frames",
  "work",
  "register_key_at_start",
  "register_key_at_end",
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
  "episode_spent_frames",
  "episode_remaining_frames",
  "episode_overrun_frames",
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
  "episode_completion_margin",
  "episode_completion_surplus_frames",
]);
/**
 * Recognized on purpose and NOT given a column: every one of them is an exact
 * function of two columns the walk already prints, and the walk is already
 * fourteen columns wide. Named in the legend rather than left to be inferred
 * from their absence — "recognized" and "rendered" are different claims, and
 * the tool used to make only the first one visible.
 *
 *   hard_overrun_frames                = max(0, total − hard budget)
 *   episode_overrun_frames             = max(0, episode spend − allocation)
 *   estimate_uncertainty_frames        = (upper − lower) / 2
 *   hard_completion_surplus_frames     = hard rem − EST
 *   episode_completion_surplus_frames  = episode rem − EST
 *   structural_startup_included        = (the one-time intercept still due)
 */
const RECOGNIZED_NOT_RENDERED = [
  "hard_overrun_frames",
  "episode_overrun_frames",
  "estimate_uncertainty_frames",
  "hard_completion_surplus_frames",
  "episode_completion_surplus_frames",
  "structural_startup_included",
] as const;

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
  // TWO DIFFERENT SLACKS ship under that word and they used to print one above
  // the other, undistinguished. This one is `policy budget / initial structural
  // prior` under the ESTIMATOR ARTIFACT, so it grows as B^(1-alpha) and is
  // telemetry. `budget_slack` in COMPILE STATS below is the V1 traversal-model
  // DIFFICULTY coordinate, exactly linear in B, and it is live policy. Neither
  // is convertible into the other; the labels say which is which.
  push(
    "initial structural slack (artifact)",
    num(compile.initial_structural_slack) === null ? null : ratio(compile.initial_structural_slack, 3),
  );
  // Compile-scope fields a later recorder may add; rendered only when present.
  push(
    "initial structural applicability",
    scalar(compile.initial_structural_applicability) ?? scalar(compile.estimator_applicability),
  );
  push("first terminal at", scalar(compile.first_terminal_total_spent_frames));
  push("first improving terminal at", scalar(compile.first_improving_terminal_total_spent_frames));
  push("final output episode", scalar(compile.final_output_episode_id));
  push("final output lane", scalar(compile.final_output_lane));
  const work = asRecord(compile.work);
  for (const [field, label] of WORK_FIELDS) {
    const value = scalar(work?.[field]);
    if (value !== null) push(label, value);
  }
  const calls = num(work?.ranked_option_calls);
  const requested = num(work?.requested_normal_proposals);
  if (calls !== null && requested !== null) {
    push(
      "mean requested normal proposals per ranked-option call",
      calls === 0 ? MISSING : ratio(requested / calls, 3),
    );
  }
  return ["COMPILE", ...renderTable(["field", "value"], ["l", "r"], rows, "  ").slice(1)];
}

const WORK_FIELDS: readonly (readonly [field: string, label: string])[] = [
  ["ranked_option_calls", "ranked-option pool calls"],
  ["requested_normal_proposals", "requested normal proposals"],
  ["actual_candidate_samples", "actual candidate samples"],
  ["viable_candidates", "viable candidates"],
  ["nodes_processed", "nodes processed"],
  ["nodes_expanded", "nodes expanded"],
  ["children_enqueued", "children enqueued"],
  ["register_offers", "register offers"],
  ["partial_node_evaluations", "partial node evaluations"],
  ["terminal_node_evaluations", "terminal node evaluations"],
  ["first_time_terminal_node_evaluations", "first-time terminal nodes"],
  ["revisited_terminal_node_evaluations", "revisited terminal nodes"],
  ["distinct_terminal_tracks", "distinct terminal tracks"],
  ["repeated_terminal_track_evaluations", "repeated terminal tracks"],
  ["register_improvements", "register improvements"],
  ["terminal_register_improvements", "terminal register improvements"],
];

/** `budget_slack` is relabelled on the way out: it is the V1 traversal-model
 *  DIFFICULTY coordinate (exactly linear in B, live policy), not the artifact
 *  ratio the COMPILE block calls "initial structural slack". */
const STATS_FIELDS: readonly (readonly [field: string, label: string])[] = [
  ["sim_frames", "sim_frames"],
  ["first_completion_frame", "first_completion_frame"],
  ["predicted_first_completion_frames", "predicted_first_completion_frames"],
  ["budget_slack", "budget_slack (traversal model V1)"],
  ["budget_exhausted", "budget_exhausted"],
  ["leaves_considered", "leaves_considered"],
  ["improvements", "improvements"],
  ["gap_commits", "gap_commits"],
  ["gap_backtracks", "gap_backtracks"],
];

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
  for (const [field, label] of STATS_FIELDS) {
    const value = scalar(stats[field]);
    if (value !== null) rows.push([label, value]);
  }
  const elapsed = scalar(envelope?.elapsed_ms);
  if (elapsed !== null) rows.push(["elapsed_ms", elapsed]);
  if (rows.length === 0) return [];
  return [`COMPILE STATS  ${statsPath}`, ...renderTable(["field", "value"], ["l", "r"], rows, "  ").slice(1)];
}

function renderIntervals(payload: Rec, unknown: Set<string>): string[] {
  const intervals = asArray(payload.execution_intervals);
  if (intervals.length === 0) return ["EXECUTION INTERVALS (0)"];
  const rows = intervals.map((entry, index) => {
    const interval = asRecord(entry) ?? {};
    collectUnknown(interval, KNOWN_INTERVAL, unknown);
    return [
      String(index),
      text(interval.kind),
      num(interval.episode_id) === null ? MISSING : count(interval.episode_id),
      count(interval.start_total_spent_frames),
      count(interval.end_total_spent_frames),
      count(interval.spent_frames),
      text(interval.stop_reason),
    ];
  });
  return [
    `EXECUTION INTERVALS (${intervals.length})`,
    ...renderTable(
      ["#", "kind", "episode", "from", "to", "spent", "stop reason"],
      ["r", "l", "r", "r", "r", "r", "l"],
      rows,
      "  ",
    ),
  ];
}

function episodeOutcomeLabel(outcome: Rec | null): string {
  if (outcome === null) return MISSING;
  if (bool(outcome.terminal_reached) !== true) return "no terminal";
  return bool(outcome.accepted_alternative) === true
    ? "terminal; alternative accepted"
    : "terminal; alternative not accepted";
}

/**
 * Episode columns. Optional repair context disappears when the compile has no
 * repair lane.
 */
type EpisodeColumn = {
  header: string;
  align: Align;
  optional?: boolean;
  cell: (episode: Rec, anchor: Rec | null, outcome: Rec | null) => string;
};

const EPISODE_COLUMNS: EpisodeColumn[] = [
  { header: "id", align: "r", cell: (e) => count(e.episode_id) },
  { header: "lane", align: "l", cell: (e) => text(e.lane) },
  {
    header: "parent",
    align: "r",
    cell: (e) => (num(e.parent_episode_id) === null ? MISSING : count(e.parent_episode_id)),
  },
  { header: "seed", align: "r", cell: (a) => count(a.search_seed) },
  {
    header: "anchor gap@frame",
    align: "r",
    cell: (_a, anchor) =>
      anchor === null ? MISSING : `${count(anchor.gap_index)}@${count(anchor.anchor_frame)}`,
  },
  // Repair-only, null on every other kind, so the three columns disappear on a
  // payload with no repair phase. `round` is the pick of a weak gap (one round
  // can spend several attempts walking the anchor upstream, so the attempt
  // ordinal is NOT the round index); `up` is that walk's distance; `weak sse`
  // is the ranking's own key at the moment it ranked.
  {
    header: "iteration",
    align: "r",
    optional: true,
    cell: (a) => count(asRecord(a.repair_decision)?.iteration_index),
  },
  {
    header: "parent depth",
    align: "r",
    optional: true,
    cell: (a) => count(asRecord(a.repair_decision)?.parent_depth),
  },
  {
    header: "weak sse",
    align: "r",
    optional: true,
    cell: (a) => (num(a.incumbent_weak_gap_sse) === null ? MISSING : ratio(a.incumbent_weak_gap_sse, 4)),
  },
  { header: "start", align: "r", cell: (a) => count(a.start_total_spent_frames) },
  { header: "ceiling", align: "r", cell: (a) => count(a.ceiling_total_spent_frames) },
  {
    header: "ceiling from",
    align: "l",
    optional: true,
    cell: (a) => text(a.ceiling_source),
  },
  { header: "allocated", align: "r", cell: (a) => count(a.allocated_frames) },
  { header: "spent", align: "r", cell: (_a, _anchor, o) => (o === null ? MISSING : count(o.spent_frames)) },
  { header: "outcome", align: "l", cell: (_a, _anchor, o) => episodeOutcomeLabel(o) },
  { header: "stop reason", align: "l", cell: (_a, _anchor, o) => (o === null ? MISSING : text(o.stop_reason)) },
  {
    header: "1st term",
    align: "r",
    cell: (_a, _anchor, o) => (o === null ? MISSING : count(o.first_terminal_offset_frames)),
  },
  {
    header: "1st improve",
    align: "r",
    optional: true,
    cell: (_a, _anchor, o) => (o === null ? MISSING : count(o.first_register_improvement_offset_frames)),
  },
  {
    header: "1st terminal improve",
    align: "r",
    optional: true,
    cell: (_a, _anchor, o) =>
      o === null ? MISSING : count(o.first_terminal_register_improvement_offset_frames),
  },
  {
    header: "improved",
    align: "l",
    cell: (_a, _anchor, o) =>
      o === null || bool(o.register_improved) === null ? MISSING : flag(o.register_improved),
  },
  {
    header: "internal score delta",
    align: "r",
    optional: true,
    cell: (_a, _anchor, o) => (o === null ? MISSING : ratio(o.internal_full_score_delta, 3)),
  },
];

function renderEpisodes(payload: Rec, unknown: Set<string>): string[] {
  const episodes = asArray(payload.episodes);
  if (episodes.length === 0) return ["EPISODES (0)"];
  const cells = episodes.map((entry) => {
    const episode = asRecord(entry) ?? {};
    collectUnknown(episode, KNOWN_EPISODE, unknown);
    const anchor = asRecord(episode.anchor);
    const outcome = asRecord(episode.outcome);
    return EPISODE_COLUMNS.map((column) => column.cell(episode, anchor, outcome));
  });
  const columns = EPISODE_COLUMNS.map((column, index) => ({ column, index })).filter(
    ({ column, index }) => !column.optional || cells.some((row) => row[index] !== MISSING),
  );
  return [
    `EPISODES (${episodes.length})`,
    ...renderTable(
      columns.map(({ column }) => column.header),
      columns.map(({ column }) => column.align),
      cells.map((row) => columns.map(({ index }) => row[index])),
      "  ",
    ),
  ];
}

function renderEpisodeWork(payload: Rec): string[] {
  const episodes = asArray(payload.episodes).flatMap((entry) => {
    const episode = asRecord(entry);
    return episode === null ? [] : [episode];
  });
  if (episodes.length === 0) return [];
  const rows = episodes.map((episode) => {
    const work = asRecord(episode.work) ?? {};
    return [
      count(episode.episode_id),
      text(episode.lane),
      count(work.ranked_option_calls),
      ratio(
        num(work.ranked_option_calls) === 0
          ? null
          : (num(work.requested_normal_proposals) ?? 0) /
            (num(work.ranked_option_calls) ?? 1),
        2,
      ),
      count(work.requested_normal_proposals),
      count(work.actual_candidate_samples),
      count(work.viable_candidates),
      count(work.nodes_processed),
      count(work.children_enqueued),
      count(work.register_offers),
      count(work.terminal_node_evaluations),
      count(work.distinct_terminal_tracks),
      count(work.repeated_terminal_track_evaluations),
      count(work.register_improvements),
      count(work.terminal_register_improvements),
    ];
  });
  const originRows = episodes.flatMap((episode) => {
    const work = asRecord(episode.work);
    const origins = asRecord(work?.by_evaluation_origin);
    if (origins === null) return [];
    return Object.entries(origins).flatMap(([origin, raw]) => {
      const value = asRecord(raw);
      if (value === null) return [];
      return [[
        count(episode.episode_id),
        text(episode.lane),
        origin,
        count(value.register_offers),
        count(value.terminal_node_evaluations),
        count(value.register_improvements),
        count(value.terminal_register_improvements),
      ]];
    });
  });
  return [
    "EPISODE WORK FUNNEL",
    ...renderTable(
      ["id", "lane", "calls", "mean req", "requested", "sampled", "viable", "nodes", "children", "offers", "terminal", "tracks", "repeat", "improve", "term imp"],
      ["r", "l", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r"],
      rows,
      "  ",
    ),
    ...(originRows.length === 0
      ? []
      : [
        "",
        "EVALUATION ORIGIN ATTRIBUTION",
        ...renderTable(
          ["id", "lane", "origin", "offers", "terminal", "improve", "term imp"],
          ["r", "l", "l", "r", "r", "r", "r"],
          originRows,
          "  ",
        ),
      ]),
  ];
}

/**
 * Trace payloads carry the full observation array; summary payloads keep only
 * the episode's start and end. Walk whichever exists, and say which it was.
 */
function episodeObservations(episode: Rec): { rows: unknown[]; source: string } {
  const observations = asArray(episode.observations);
  if (observations.length > 0) return { rows: observations, source: "trace" };
  const fallback = [episode.start, episode.end].filter((entry) => asRecord(entry) !== null);
  return { rows: fallback, source: "start/end only" };
}

// `hard rem` and `prog` are the two terms the margin is MADE of and were the
// conspicuous omissions: `hard mrg` = hard rem / EST, and `prog` is the weight
// at which EST blends the episode pace into the structural base. Without them
// the walk showed the answer and neither of its inputs.
const WALK_HEADERS = [
  "event",
  "total",
  "hard rem",
  "episode sp",
  "episode rem",
  "hw",
  "prog",
  "S",
  "path",
  "pace",
  "EST",
  "lower",
  "upper",
  "hard mrg",
  "episode mrg",
  "app",
];
const WALK_ALIGNS: Align[] = [
  "l", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "r", "l",
];

function walkRow(raw: unknown, unknown: Set<string>): string[] {
  const observation = asRecord(raw) ?? {};
  collectUnknown(observation, KNOWN_OBSERVATION, unknown);
  const highWater = asRecord(observation.high_water);
  return [
    text(observation.event),
    count(observation.total_spent_frames),
    count(observation.hard_remaining_frames),
    count(observation.episode_spent_frames),
    count(observation.episode_remaining_frames),
    highWater === null ? MISSING : count(highWater.gap_index),
    ratio(observation.structural_progress_fraction, 3),
    count(observation.structural_work_prior_frames),
    count(observation.incumbent_path_work_estimate_frames),
    count(observation.episode_pace_work_estimate_frames),
    count(observation.estimated_remaining_work_frames),
    count(observation.estimate_lower_frames),
    count(observation.estimate_upper_frames),
    ratio(observation.hard_completion_margin),
    ratio(observation.episode_completion_margin),
    applicabilityCode(observation.estimator_applicability),
  ];
}

function renderWalk(payload: Rec, unknown: Set<string>): string[] {
  const episodes = asArray(payload.episodes)
    .map((entry) => asRecord(entry))
    .filter((episode): episode is Rec => episode !== null);
  if (episodes.length === 0) return [];
  const walks = episodes.map((episode) => {
    const { rows, source } = episodeObservations(episode);
    return { episode, source, cells: rows.map((row) => walkRow(row, unknown)) };
  });
  // One width set for every episode, so the columns line up down the page.
  const widths = columnWidths(WALK_HEADERS, walks.flatMap((walk) => walk.cells));
  const lines = [
    "OBSERVATION WALK   applicability: CAL calibrated · EXT extrapolated · UNV unvalidated kind",
    `  recognized, not given a column (each derivable from two above): ${
      RECOGNIZED_NOT_RENDERED.join(", ")
    }`,
  ];
  for (const { episode, source, cells } of walks) {
    lines.push(
      "",
      `  episode ${count(episode.episode_id)}  lane=${text(episode.lane)}  ` +
        `parent=${num(episode.parent_episode_id) === null ? MISSING : count(episode.parent_episode_id)}  ` +
        `fallback=${flag(episode.frontier_has_fallback_lane)}  ` +
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
  if (payload.schema !== BUDGET_TELEMETRY_SCHEMA) {
    throw new Error(
      `${path} has schema ${String(payload.schema)}; expected ${BUDGET_TELEMETRY_SCHEMA}`,
    );
  }
  if (!Array.isArray(payload.episodes) || !Array.isArray(payload.execution_intervals)) {
    throw new Error(`${path} is missing V5 episodes or execution intervals`);
  }
  const rootUnknown = new Set<string>();
  const compileUnknown = new Set<string>();
  const intervalUnknown = new Set<string>();
  const episodeUnknown = new Set<string>();
  const observationUnknown = new Set<string>();
  collectUnknown(payload, KNOWN_ROOT, rootUnknown);
  collectUnknown(asRecord(payload.compile), KNOWN_COMPILE, compileUnknown);

  const sections: string[][] = [
    renderHeader(path, payload),
    renderCompile(payload),
    renderStats(path),
    renderIntervals(payload, intervalUnknown),
    renderEpisodes(payload, episodeUnknown),
    renderEpisodeWork(payload),
    renderWalk(payload, observationUnknown),
    renderUnknown([
      { scope: "payload", keys: rootUnknown },
      { scope: "compile", keys: compileUnknown },
      { scope: "execution interval", keys: intervalUnknown },
      { scope: "episode", keys: episodeUnknown },
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
