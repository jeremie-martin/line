/**
 * Strict V3 compile-budget telemetry analyzer.
 *
 * Usage:
 *   npx tsx scripts/v0/analyze_budget_telemetry.ts FILE_OR_ARCHIVE [...]
 *     [--json=report.json] [--markdown=report.md]
 *
 * The analyzer intentionally has no V1/V2 aliases. Attempt-era archives carry
 * different identities and populations and must not be silently pooled with
 * episode/lane telemetry.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  BUDGET_EVALUATION_ORIGINS,
  BUDGET_TELEMETRY_SCHEMA,
  type BudgetEpisodeTelemetry,
  type BudgetEpisodeWork,
  type CompileBudgetTelemetry,
} from "./optimizer/budget_telemetry.ts";

export const BUDGET_TELEMETRY_ANALYSIS_SCHEMA =
  "line.compile-budget-telemetry-analysis.v3" as const;

type Located = {
  source: string;
  context: string;
  telemetry: CompileBudgetTelemetry;
};

type Distribution = {
  n: number;
  mean: number | null;
  median: number | null;
  p10: number | null;
  p90: number | null;
  min: number | null;
  max: number | null;
};

type LaneSummary = {
  episodes: number;
  compiles: number;
  allocated_frames: Distribution;
  spent_frames: Distribution;
  first_terminal_offset_frames: Distribution;
  terminal_observation_censored: number;
  episodes_with_register_improvement: number;
  internal_full_score_delta: Distribution;
  work: BudgetEpisodeWork;
  ratios: ReturnType<typeof workRatios>;
};

export type BudgetTelemetryAnalysis = {
  schema: typeof BUDGET_TELEMETRY_ANALYSIS_SCHEMA;
  telemetry_schema: typeof BUDGET_TELEMETRY_SCHEMA;
  sources: string[];
  counts: {
    compiles: number;
    summary_payloads: number;
    trace_payloads: number;
    episodes: number;
    node_events: number;
  };
  budgets: {
    hard_frames: Distribution;
    policy_frames: Distribution;
    total_spent_frames: Distribution;
    hard_overrun_frames: Distribution;
    first_terminal_frames: Distribution;
    first_improving_terminal_frames: Distribution;
    post_first_terminal_frames: Distribution;
  };
  work: BudgetEpisodeWork;
  ratios: ReturnType<typeof workRatios>;
  by_lane: Record<string, LaneSummary>;
  estimator: {
    uncensored_episode_starts: number;
    start_point_error_frames: Distribution;
    start_absolute_percentage_error: Distribution;
    start_interval_coverage: number | null;
    note: string;
  };
  lineage: {
    compiles_with_output_episode: number;
    outputs_by_lane: Record<string, number>;
  };
  validation: {
    checked_compiles: number;
    violations: string[];
  };
};

export function analyzeBudgetTelemetry(located: Located[]): BudgetTelemetryAnalysis {
  if (located.length === 0) throw new Error(`no ${BUDGET_TELEMETRY_SCHEMA} payloads found`);
  const violations = located.flatMap(validateLocated);
  if (violations.length > 0) {
    throw new Error(`budget telemetry validation failed:\n${violations.map((v) => `- ${v}`).join("\n")}`);
  }

  const episodes = located.flatMap((item) =>
    item.telemetry.episodes.map((episode) => ({ item, episode }))
  );
  const aggregateWork = sumWork(located.map((item) => item.telemetry.compile.work));
  const lanes = [...new Set(episodes.map(({ episode }) => episode.lane))].sort();
  const startErrors = episodes.flatMap(({ episode }) => {
    const actual = episode.outcome.first_terminal_offset_frames;
    if (actual === null || episode.outcome.terminal_observation_censored) return [];
    const point = episode.start.estimated_remaining_work_frames;
    return [{
      error: point - actual,
      ape: actual > 0 ? Math.abs(point - actual) / actual : null,
      covered: actual >= episode.start.estimate_lower_frames &&
        actual <= episode.start.estimate_upper_frames,
    }];
  });
  const outputLanes = located.flatMap((item) => {
    const lane = item.telemetry.compile.final_output_lane;
    return lane === null ? [] : [lane];
  });

  return {
    schema: BUDGET_TELEMETRY_ANALYSIS_SCHEMA,
    telemetry_schema: BUDGET_TELEMETRY_SCHEMA,
    sources: [...new Set(located.map((item) => item.source))].sort(),
    counts: {
      compiles: located.length,
      summary_payloads: located.filter((item) => item.telemetry.level === "summary").length,
      trace_payloads: located.filter((item) => item.telemetry.level === "trace").length,
      episodes: episodes.length,
      node_events: located.reduce(
        (sum, item) => sum + (item.telemetry.node_events?.length ?? 0),
        0,
      ),
    },
    budgets: {
      hard_frames: distribution(located.map((item) => item.telemetry.compile.hard_budget_frames)),
      policy_frames: distribution(located.map((item) => item.telemetry.compile.policy_budget_frames)),
      total_spent_frames: distribution(located.map((item) => item.telemetry.compile.total_spent_frames)),
      hard_overrun_frames: distribution(located.map((item) => item.telemetry.compile.hard_overrun_frames)),
      first_terminal_frames: distribution(located.flatMap((item) =>
        nullable(item.telemetry.compile.first_terminal_total_spent_frames)
      )),
      first_improving_terminal_frames: distribution(located.flatMap((item) =>
        nullable(item.telemetry.compile.first_improving_terminal_total_spent_frames)
      )),
      post_first_terminal_frames: distribution(located.flatMap((item) => {
        const first = item.telemetry.compile.first_terminal_total_spent_frames;
        return first === null
          ? []
          : [Math.max(0, item.telemetry.compile.total_spent_frames - first)];
      })),
    },
    work: aggregateWork,
    ratios: workRatios(aggregateWork),
    by_lane: Object.fromEntries(lanes.map((lane) => {
      const inLane = episodes.filter(({ episode }) => episode.lane === lane);
      const work = sumWork(inLane.map(({ episode }) => episode.work));
      return [lane, {
        episodes: inLane.length,
        compiles: new Set(inLane.map(({ item }) => item.context)).size,
        allocated_frames: distribution(inLane.map(({ episode }) => episode.allocated_frames)),
        spent_frames: distribution(inLane.flatMap(({ episode }) =>
          nullable(episode.outcome.spent_frames)
        )),
        first_terminal_offset_frames: distribution(inLane.flatMap(({ episode }) =>
          nullable(episode.outcome.first_terminal_offset_frames)
        )),
        terminal_observation_censored: inLane.filter(({ episode }) =>
          episode.outcome.terminal_observation_censored
        ).length,
        episodes_with_register_improvement: inLane.filter(({ episode }) =>
          episode.outcome.register_improved
        ).length,
        internal_full_score_delta: distribution(inLane.flatMap(({ episode }) =>
          nullable(episode.outcome.internal_full_score_delta)
        )),
        work,
        ratios: workRatios(work),
      } satisfies LaneSummary];
    })),
    estimator: {
      uncensored_episode_starts: startErrors.length,
      start_point_error_frames: distribution(startErrors.map((entry) => entry.error)),
      start_absolute_percentage_error: distribution(startErrors.flatMap((entry) =>
        nullable(entry.ape)
      )),
      start_interval_coverage: startErrors.length === 0
        ? null
        : startErrors.filter((entry) => entry.covered).length / startErrors.length,
      note: "Associations are descriptive. Adjacent budget points are deterministic policy variants, not independent samples.",
    },
    lineage: {
      compiles_with_output_episode: outputLanes.length,
      outputs_by_lane: counts(outputLanes),
    },
    validation: { checked_compiles: located.length, violations: [] },
  };
}

function validateLocated(item: Located): string[] {
  const t = item.telemetry;
  const prefix = `${item.source}:${item.context}`;
  const errors: string[] = [];
  if (t.schema !== BUDGET_TELEMETRY_SCHEMA) {
    errors.push(`${prefix}: schema ${String(t.schema)} != ${BUDGET_TELEMETRY_SCHEMA}`);
    return errors;
  }
  const c = t.compile;
  if (c.hard_budget_frames + c.hard_overrun_frames !==
      c.total_spent_frames + c.hard_remaining_frames) {
    errors.push(`${prefix}: compile hard-budget identity is open`);
  }
  for (let index = 0; index < t.episodes.length; index++) {
    const e = t.episodes[index]!;
    const p = `${prefix}:episode=${index}`;
    if (e.episode_id !== index) errors.push(`${p}: non-contiguous episode ID`);
    if (e.parent_episode_id !== null &&
        (e.parent_episode_id < 0 || e.parent_episode_id >= e.episode_id)) {
      errors.push(`${p}: invalid parent episode`);
    }
    if (e.allocated_frames !== e.ceiling_total_spent_frames - e.start_total_spent_frames) {
      errors.push(`${p}: allocated-frame identity is open`);
    }
    if (e.outcome.spent_frames !== null && e.outcome.end_total_spent_frames !== null &&
        e.outcome.spent_frames !== e.outcome.end_total_spent_frames - e.start_total_spent_frames) {
      errors.push(`${p}: spent-frame identity is open`);
    }
    validateWork(e.work, p, errors);
    if (e.outcome.terminal_tracks_considered !== e.work.terminal_node_evaluations) {
      errors.push(`${p}: outcome terminal count disagrees with work funnel`);
    }
    if (e.outcome.register_improved !== (e.work.register_improvements > 0)) {
      errors.push(`${p}: register-improvement outcome disagrees with work funnel`);
    }
    if (e.outcome.terminal_observation_censored !== (e.work.terminal_node_evaluations === 0)) {
      errors.push(`${p}: terminal censoring disagrees with work funnel`);
    }
    if ((e.outcome.first_terminal_offset_frames === null) !==
        (e.work.terminal_node_evaluations === 0)) {
      errors.push(`${p}: first-terminal timing disagrees with work funnel`);
    }
    if ((e.outcome.first_register_improvement_offset_frames === null) !==
        (e.work.register_improvements === 0) ||
        (e.outcome.final_register_improvement_offset_frames === null) !==
        (e.work.register_improvements === 0)) {
      errors.push(`${p}: register-improvement timing disagrees with work funnel`);
    }
    if ((e.outcome.first_terminal_register_improvement_offset_frames === null) !==
        (e.work.terminal_register_improvements === 0)) {
      errors.push(`${p}: terminal-improvement timing disagrees with work funnel`);
    }
    if (e.available_hard_budget_frames !==
        Math.max(0, c.hard_budget_frames - e.start_total_spent_frames)) {
      errors.push(`${p}: available hard budget is inconsistent`);
    }
    const offsets = [
      e.outcome.first_terminal_offset_frames,
      e.outcome.first_register_improvement_offset_frames,
      e.outcome.final_register_improvement_offset_frames,
      e.outcome.first_terminal_register_improvement_offset_frames,
    ].filter((value): value is number => value !== null);
    if (e.outcome.spent_frames !== null && offsets.some((value) => value < 0 || value > e.outcome.spent_frames!)) {
      errors.push(`${p}: episode-local timing lies outside episode spend`);
    }
  }
  validateWork(c.work, `${prefix}:compile`, errors);
  const summed = sumWork(t.episodes.map((episode) => episode.work));
  for (const field of NUMERIC_WORK_FIELDS) {
    if (field === "distinct_terminal_tracks" || field === "repeated_terminal_track_evaluations") {
      continue;
    }
    if (c.work[field] !== summed[field]) {
      errors.push(`${prefix}: compile work ${field} does not equal episode sum`);
    }
  }
  if (c.work.repeated_terminal_track_evaluations !==
      c.work.terminal_node_evaluations - c.work.distinct_terminal_tracks) {
    errors.push(`${prefix}: compile terminal-track identity is open`);
  }
  for (const mode of new Set([
    ...Object.keys(c.work.candidate_samples_by_mode),
    ...Object.keys(summed.candidate_samples_by_mode),
  ])) {
    if ((c.work.candidate_samples_by_mode[mode] ?? 0) !==
        (summed.candidate_samples_by_mode[mode] ?? 0)) {
      errors.push(`${prefix}: compile candidate mode ${mode} does not equal episode sum`);
    }
  }
  for (const origin of BUDGET_EVALUATION_ORIGINS) {
    for (const field of [
      "register_offers",
      "terminal_node_evaluations",
      "register_improvements",
      "terminal_register_improvements",
    ] as const) {
      if (c.work.by_evaluation_origin[origin][field] !==
          summed.by_evaluation_origin[origin][field]) {
        errors.push(`${prefix}: compile evaluation origin ${origin}/${field} does not equal episode sum`);
      }
    }
  }
  let cursor = 0;
  for (const interval of t.execution_intervals) {
    if (interval.start_total_spent_frames !== cursor) {
      errors.push(`${prefix}: execution intervals do not form a contiguous partition at ${cursor}`);
      break;
    }
    if (interval.spent_frames !== interval.end_total_spent_frames - interval.start_total_spent_frames) {
      errors.push(`${prefix}: execution interval spend identity is open`);
    }
    if (interval.episode_id !== null && t.episodes[interval.episode_id] === undefined) {
      errors.push(`${prefix}: execution interval references a missing episode`);
    }
    cursor = interval.end_total_spent_frames;
  }
  if (cursor !== c.total_spent_frames) errors.push(`${prefix}: execution intervals do not cover compile spend`);

  const attributedFirst = t.episodes.flatMap((episode) => {
    const offset = episode.outcome.first_terminal_offset_frames;
    return offset === null ? [] : [episode.start_total_spent_frames + offset];
  });
  const expectedFirst = attributedFirst.length === 0 ? null : Math.min(...attributedFirst);
  if (c.first_terminal_total_spent_frames !== expectedFirst) {
    errors.push(`${prefix}: first-terminal attribution does not close`);
  }
  const attributedImprovingTerminal = t.episodes.flatMap((episode) => {
    const offset = episode.outcome.first_terminal_register_improvement_offset_frames;
    return offset === null ? [] : [episode.start_total_spent_frames + offset];
  });
  const expectedImprovingTerminal = attributedImprovingTerminal.length === 0
    ? null
    : Math.min(...attributedImprovingTerminal);
  if (c.first_improving_terminal_total_spent_frames !== expectedImprovingTerminal) {
    errors.push(`${prefix}: first-improving-terminal attribution does not close`);
  }
  if (c.final_output_episode_id === null !== (c.final_output_lane === null)) {
    errors.push(`${prefix}: final-output episode and lane nullability disagree`);
  } else if (c.final_output_episode_id !== null) {
    const output = t.episodes[c.final_output_episode_id];
    if (output === undefined || output.lane !== c.final_output_lane || !output.outcome.register_improved) {
      errors.push(`${prefix}: final-output lineage is invalid`);
    }
  }
  for (const [index, node] of (t.node_events ?? []).entries()) {
    const episode = t.episodes[node.episode_id];
    if (episode?.lane !== node.lane || episode.mechanism !== node.mechanism ||
        episode.mechanism_detail !== node.mechanism_detail) {
      errors.push(`${prefix}:node_event=${index}: episode attribution is invalid`);
    }
    if (node.spent_frames !== node.frontier_evaluation_frames + node.tail_completion_frames +
        node.post_tail_work_frames) {
      errors.push(`${prefix}:node_event=${index}: atomic spend identity is open`);
    }
  }
  return errors;
}

function validateWork(work: BudgetEpisodeWork, prefix: string, errors: string[]): void {
  const attributedSamples = Object.values(work.candidate_samples_by_mode)
    .reduce((sum, value) => sum + value, 0);
  if (attributedSamples !== work.actual_candidate_samples) {
    errors.push(`${prefix}: candidate-mode sample identity is open`);
  }
  if (work.register_offers !== work.partial_node_evaluations + work.terminal_node_evaluations) {
    errors.push(`${prefix}: register-offer identity is open`);
  }
  if (work.terminal_node_evaluations !== work.first_time_terminal_node_evaluations +
      work.revisited_terminal_node_evaluations) {
    errors.push(`${prefix}: terminal-node identity is open`);
  }
  if (work.terminal_node_evaluations !== work.distinct_terminal_tracks +
      work.repeated_terminal_track_evaluations) {
    errors.push(`${prefix}: terminal-track identity is open`);
  }
  if (work.register_improvements > work.register_offers ||
      work.terminal_register_improvements > work.terminal_node_evaluations ||
      work.terminal_register_improvements > work.register_improvements) {
    errors.push(`${prefix}: improvement count exceeds its population`);
  }
  if (work.viable_candidates > work.actual_candidate_samples) {
    errors.push(`${prefix}: viable candidates exceed actual samples`);
  }
  if (work.nodes_expanded > work.nodes_processed) {
    errors.push(`${prefix}: expanded nodes exceed processed nodes`);
  }
  for (const [mode, count] of Object.entries(work.candidate_samples_by_mode)) {
    if (!Number.isInteger(count) || count < 0) {
      errors.push(`${prefix}: candidate mode ${mode} is not a non-negative integer`);
    }
  }
  const originTotals = BUDGET_EVALUATION_ORIGINS.reduce((total, origin) => {
    const value = work.by_evaluation_origin[origin];
    total.register_offers += value.register_offers;
    total.terminal_node_evaluations += value.terminal_node_evaluations;
    total.register_improvements += value.register_improvements;
    total.terminal_register_improvements += value.terminal_register_improvements;
    return total;
  }, {
    register_offers: 0,
    terminal_node_evaluations: 0,
    register_improvements: 0,
    terminal_register_improvements: 0,
  });
  for (const field of Object.keys(originTotals) as Array<keyof typeof originTotals>) {
    if (originTotals[field] !== work[field]) {
      errors.push(`${prefix}: evaluation-origin ${field} identity is open`);
    }
  }
  for (const origin of BUDGET_EVALUATION_ORIGINS) {
    const value = work.by_evaluation_origin[origin];
    for (const [field, count] of Object.entries(value)) {
      if (!Number.isInteger(count) || count < 0) {
        errors.push(`${prefix}: evaluation origin ${origin}/${field} is not a non-negative integer`);
      }
    }
    if (value.register_improvements > value.register_offers ||
        value.terminal_register_improvements > value.terminal_node_evaluations ||
        value.terminal_register_improvements > value.register_improvements) {
      errors.push(`${prefix}: evaluation origin ${origin} improvement count exceeds its population`);
    }
  }
  for (const field of NUMERIC_WORK_FIELDS) {
    if (!Number.isInteger(work[field]) || work[field] < 0) {
      errors.push(`${prefix}: ${field} is not a non-negative integer`);
    }
  }
}

const NUMERIC_WORK_FIELDS = [
  "pool_builds",
  "requested_normal_proposals",
  "actual_candidate_samples",
  "viable_candidates",
  "nodes_processed",
  "nodes_expanded",
  "children_enqueued",
  "register_offers",
  "partial_node_evaluations",
  "terminal_node_evaluations",
  "first_time_terminal_node_evaluations",
  "revisited_terminal_node_evaluations",
  "distinct_terminal_tracks",
  "repeated_terminal_track_evaluations",
  "register_improvements",
  "terminal_register_improvements",
] as const satisfies readonly Exclude<keyof BudgetEpisodeWork, "candidate_samples_by_mode">[];

function emptyWork(): BudgetEpisodeWork {
  return {
    pool_builds: 0,
    requested_normal_proposals: 0,
    actual_candidate_samples: 0,
  viable_candidates: 0,
  candidate_samples_by_mode: {},
  by_evaluation_origin: Object.fromEntries(BUDGET_EVALUATION_ORIGINS.map((origin) => [origin, {
    register_offers: 0,
    terminal_node_evaluations: 0,
    register_improvements: 0,
    terminal_register_improvements: 0,
  }])) as BudgetEpisodeWork["by_evaluation_origin"],
    nodes_processed: 0,
    nodes_expanded: 0,
    children_enqueued: 0,
    register_offers: 0,
    partial_node_evaluations: 0,
    terminal_node_evaluations: 0,
    first_time_terminal_node_evaluations: 0,
    revisited_terminal_node_evaluations: 0,
    distinct_terminal_tracks: 0,
    repeated_terminal_track_evaluations: 0,
    register_improvements: 0,
    terminal_register_improvements: 0,
  };
}

function sumWork(items: readonly BudgetEpisodeWork[]): BudgetEpisodeWork {
  const result = emptyWork();
  for (const work of items) {
    for (const field of NUMERIC_WORK_FIELDS) result[field] += work[field];
    for (const [mode, value] of Object.entries(work.candidate_samples_by_mode)) {
      result.candidate_samples_by_mode[mode] =
        (result.candidate_samples_by_mode[mode] ?? 0) + value;
    }
    for (const origin of BUDGET_EVALUATION_ORIGINS) {
      const destination = result.by_evaluation_origin[origin];
      const source = work.by_evaluation_origin[origin];
      destination.register_offers += source.register_offers;
      destination.terminal_node_evaluations += source.terminal_node_evaluations;
      destination.register_improvements += source.register_improvements;
      destination.terminal_register_improvements += source.terminal_register_improvements;
    }
  }
  return result;
}

function workRatios(work: BudgetEpisodeWork) {
  return {
    requested_proposals_per_ranked_option_call: divide(
      work.requested_normal_proposals,
      work.pool_builds,
    ),
    actual_samples_per_requested_proposal: divide(
      work.actual_candidate_samples,
      work.requested_normal_proposals,
    ),
    viable_per_actual_sample: divide(work.viable_candidates, work.actual_candidate_samples),
    expanded_per_processed_node: divide(work.nodes_expanded, work.nodes_processed),
    children_per_expanded_node: divide(work.children_enqueued, work.nodes_expanded),
    terminal_evaluations_per_processed_node: divide(
      work.terminal_node_evaluations,
      work.nodes_processed,
    ),
    distinct_tracks_per_terminal_evaluation: divide(
      work.distinct_terminal_tracks,
      work.terminal_node_evaluations,
    ),
    register_improvements_per_offer: divide(work.register_improvements, work.register_offers),
    terminal_improvements_per_terminal_evaluation: divide(
      work.terminal_register_improvements,
      work.terminal_node_evaluations,
    ),
  };
}

function distribution(raw: number[]): Distribution {
  const values = raw.filter(Number.isFinite).sort((a, b) => a - b);
  return {
    n: values.length,
    mean: values.length === 0 ? null : sum(values) / values.length,
    median: quantile(values, 0.5),
    p10: quantile(values, 0.1),
    p90: quantile(values, 0.9),
    min: values[0] ?? null,
    max: values.at(-1) ?? null,
  };
}

function quantile(sorted: number[], probability: number): number | null {
  if (sorted.length === 0) return null;
  const position = (sorted.length - 1) * probability;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower]!;
  const weight = position - lower;
  return sorted[lower]! * (1 - weight) + sorted[upper]! * weight;
}

function divide(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : numerator / denominator;
}

function sum(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function nullable(value: number | null): number[] {
  return value === null ? [] : [value];
}

function counts(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function locatePayloads(source: string, value: unknown): Located[] {
  const located: Located[] = [];
  const visit = (current: unknown, context: string): void => {
    if (typeof current !== "object" || current === null) return;
    if (!Array.isArray(current)) {
      const object = current as Record<string, unknown>;
      if (typeof object.schema === "string" && object.schema.startsWith("line.compile-budget-telemetry.")) {
        if (object.schema !== BUDGET_TELEMETRY_SCHEMA) {
          throw new Error(
            `${source}:${context} has historical schema ${object.schema}; expected ${BUDGET_TELEMETRY_SCHEMA}`,
          );
        }
        located.push({ source, context, telemetry: object as unknown as CompileBudgetTelemetry });
        return;
      }
      for (const [key, child] of Object.entries(object)) visit(child, `${context}.${key}`);
      return;
    }
    current.forEach((child, index) => visit(child, `${context}[${index}]`));
  };
  visit(value, "$" );
  return located;
}

function renderMarkdown(report: BudgetTelemetryAnalysis): string {
  const candidateModes = Object.entries(report.work.candidate_samples_by_mode)
    .sort(([a], [b]) => a.localeCompare(b));
  const lines = [
    "# Compile budget telemetry analysis",
    "",
    `Schema: \`${report.telemetry_schema}\`. Compiles: ${report.counts.compiles}. Episodes: ${report.counts.episodes}.`,
    "",
    "## Work funnel",
    "",
    "| population | count |",
    "|---|---:|",
    ...NUMERIC_WORK_FIELDS.map((field) => `| ${field} | ${report.work[field]} |`),
    "",
    "### Candidate samples by mode",
    "",
    "| mode | actual evaluated geometries |",
    "|---|---:|",
    ...candidateModes.map(([mode, value]) => `| ${mode} | ${value} |`),
    "",
    "### Register work by evaluation origin",
    "",
    "| origin | offers | terminal evaluations | improvements | terminal improvements |",
    "|---|---:|---:|---:|---:|",
    ...BUDGET_EVALUATION_ORIGINS.map((origin) => {
      const value = report.work.by_evaluation_origin[origin];
      return `| ${origin} | ${value.register_offers} | ${value.terminal_node_evaluations} | ` +
        `${value.register_improvements} | ${value.terminal_register_improvements} |`;
    }),
    "",
    "## Efficiency ratios",
    "",
    "| ratio | value |",
    "|---|---:|",
    ...Object.entries(report.ratios).map(([name, value]) =>
      `| ${name} | ${value === null ? "n/a" : value.toFixed(6)} |`
    ),
    "",
    "## Lanes",
    "",
    "| lane | episodes | compiles | spent mean | terminal evals | distinct tracks | register improvements |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(report.by_lane).map(([lane, value]) =>
      `| ${lane} | ${value.episodes} | ${value.compiles} | ${fmt(value.spent_frames.mean)} | ` +
      `${value.work.terminal_node_evaluations} | ${value.work.distinct_terminal_tracks} | ` +
      `${value.work.register_improvements} |`
    ),
    "",
    "## Budget domains",
    "",
    "| quantity | n | mean | median | p10 | p90 | min | max |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...Object.entries(report.budgets).map(([name, value]) =>
      `| ${name} | ${value.n} | ${fmt(value.mean)} | ${fmt(value.median)} | ` +
      `${fmt(value.p10)} | ${fmt(value.p90)} | ${fmt(value.min)} | ${fmt(value.max)} |`
    ),
    "",
    "## Estimator observations",
    "",
    `Uncensored episode starts: ${report.estimator.uncensored_episode_starts}. ` +
      `Start interval coverage: ${fmt(report.estimator.start_interval_coverage)}.`,
    "",
    report.estimator.note,
    "",
    "All reported relationships are direct aggregates or descriptive associations. They are not causal claims.",
  ];
  return `${lines.join("\n")}\n`;
}

function fmt(value: number | null): string {
  return value === null ? "n/a" : Number(value.toFixed(6)).toString();
}

function argument(name: string): string | null {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) ?? null;
}

async function main(): Promise<void> {
  const paths = process.argv.slice(2).filter((value) => !value.startsWith("--"));
  if (paths.length === 0) {
    throw new Error(`usage: analyze_budget_telemetry FILE_OR_ARCHIVE [...] [--json=PATH] [--markdown=PATH]`);
  }
  const located = paths.flatMap((input) => {
    const path = resolve(input);
    return locatePayloads(path, JSON.parse(readFileSync(path, "utf8")));
  });
  const report = analyzeBudgetTelemetry(located);
  const json = `${JSON.stringify(report, null, 2)}\n`;
  const markdown = renderMarkdown(report);
  const jsonPath = argument("json");
  const markdownPath = argument("markdown");
  if (jsonPath !== null) writeFileSync(resolve(jsonPath), json);
  if (markdownPath !== null) writeFileSync(resolve(markdownPath), markdown);
  if (jsonPath === null && markdownPath === null) process.stdout.write(markdown);
}

if (process.argv[1]?.endsWith("analyze_budget_telemetry.ts")) await main();

export { locatePayloads, renderMarkdown as renderBudgetTelemetryAnalysisMarkdown };
