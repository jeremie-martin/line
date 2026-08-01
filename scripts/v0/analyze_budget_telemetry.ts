/**
 * Validate and summarize compile-budget telemetry sidecars and run archives.
 *
 *   node --import tsx scripts/v0/analyze_budget_telemetry.ts \
 *     generated/foo.budget-telemetry.json generated/run.json \
 *     --out=generated/studies/budget-telemetry-analysis.json
 */

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type {
  BudgetAttemptKind,
  BudgetAttemptTelemetry,
  BudgetEstimateObservation,
  CompileBudgetTelemetry,
} from "./optimizer/budget_telemetry.ts";
import { BUDGET_TELEMETRY_SCHEMA } from "./optimizer/budget_telemetry.ts";
import { loadSourceManifest, resolveSources } from "./benchmark_v2/model.ts";

type LocatedTelemetry = {
  source: string;
  context: string;
  group: string;
  telemetry: CompileBudgetTelemetry;
};

type PredictionSample = {
  source: string;
  context: string;
  group: string;
  attemptKind: BudgetAttemptKind;
  attemptId: number;
  event: BudgetEstimateObservation["event"];
  actual: number;
  structural: number;
  path: number | null;
  pace: number | null;
  combined: number;
  lower: number;
  upper: number;
  remainingContacts: number;
  remainingDurationFrames: number;
  startupIncluded: boolean;
  progressFraction: number;
  policyBudgetFrames: number;
  estimatorApplicability: BudgetEstimateObservation["estimator_applicability"] | "legacy_unspecified";
};

type ComponentSummary = {
  component: "structural" | "path" | "pace" | "combined";
  n: number;
  bias_frames: number | null;
  mae_frames: number | null;
  median_absolute_percentage_error: number | null;
  p90_absolute_percentage_error: number | null;
  median_absolute_log_error: number | null;
};

type AnalysisReport = {
  schema: "line.compile-budget-telemetry-analysis.v1";
  inputs: string[];
  payloads: number;
  trace_payloads: number;
  counts: {
    attempts: number;
    completed_attempts: number;
    censored_attempts: number;
    repair_attempts: number;
    exact_prediction_samples: number;
  };
  accounting: {
    compile_frames: number;
    segment_frames: number;
    violations: number;
    messages: string[];
  };
  components: ComponentSummary[];
  by_attempt_kind: Array<{
    kind: BudgetAttemptKind;
    attempts: number;
    completed: number;
    components: ComponentSummary[];
  }>;
  interval: { n: number; covered: number; coverage: number | null };
  censoring: {
    attempts: number;
    start_upper_below_observed_spend: number;
    rate: number | null;
  };
  calibration_samples: PredictionSample[];
  applicability: Array<{
    status: PredictionSample["estimatorApplicability"];
    samples: number;
    interval_coverage: number | null;
    combined: ComponentSummary;
  }>;
};

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
};
const inputs = argv.filter((value) => !value.startsWith("--"));
if (inputs.length === 0) {
  throw new Error("usage: analyze_budget_telemetry.ts <sidecar-or-archive>... [--out=analysis.json]");
}
const outPath = arg("out");
const sourceManifestPath = arg("source-manifest");
const familyBySourceId = sourceManifestPath === undefined
  ? new Map<string, string>()
  : new Map(resolveSources(loadSourceManifest(resolve(sourceManifestPath))).map((source) => [
    source.id,
    source.originFamily,
  ]));
const located = inputs.flatMap(readTelemetries);
if (located.length === 0) throw new Error("no line.compile-budget-telemetry.v1 payloads found");

const violations: string[] = [];
const samples: PredictionSample[] = [];
let attempts = 0;
let completedAttempts = 0;
let censoredAttempts = 0;
let repairAttempts = 0;
let tracePayloads = 0;
let segmentFrames = 0;
let compileFrames = 0;
let censoredUpperUnderestimates = 0;

for (const item of located) {
  const telemetry = item.telemetry;
  compileFrames += telemetry.compile.total_spent_frames;
  if (telemetry.level === "trace") tracePayloads++;
  validateCompile(item, violations);
  segmentFrames += telemetry.segments.reduce((sum, segment) => sum + segment.spent_frames, 0);
  for (const attempt of telemetry.attempts) {
    attempts++;
    if (attempt.kind === "repair") repairAttempts++;
    if (attempt.outcome.completed) completedAttempts++;
    if (attempt.outcome.censored) censoredAttempts++;
    validateAttempt(item, attempt, violations);
    collectSamples(item, attempt, samples);
    if (
      attempt.outcome.censored &&
      attempt.outcome.spent_frames !== null &&
      attempt.start.estimate_upper_frames < attempt.outcome.spent_frames
    ) censoredUpperUnderestimates++;
  }
}

const components = summarizeComponents(samples);
const byAttemptKind = (["initial", "snapshot", "repair"] as const).map((kind) => ({
  kind,
  attempts: located.flatMap((item) => item.telemetry.attempts).filter((attempt) => attempt.kind === kind).length,
  completed: located.flatMap((item) => item.telemetry.attempts)
    .filter((attempt) => attempt.kind === kind && attempt.outcome.completed).length,
  components: summarizeComponents(samples.filter((sample) => sample.attemptKind === kind)),
}));
const intervalSamples = samples.filter((sample) => sample.actual > 0);
const intervalCovered = intervalSamples.filter((sample) =>
  sample.actual >= sample.lower && sample.actual <= sample.upper
).length;
const applicabilityStatuses = [...new Set(samples.map((sample) => sample.estimatorApplicability))].sort();
const applicability = applicabilityStatuses.map((status) => {
  const selected = samples.filter((sample) => sample.estimatorApplicability === status);
  const covered = selected.filter((sample) => sample.actual >= sample.lower && sample.actual <= sample.upper).length;
  return {
    status,
    samples: selected.length,
    interval_coverage: ratio(covered, selected.length),
    combined: summarizeComponents(selected).find((component) => component.component === "combined")!,
  };
});

const report: AnalysisReport = {
  schema: "line.compile-budget-telemetry-analysis.v1",
  inputs,
  payloads: located.length,
  trace_payloads: tracePayloads,
  counts: {
    attempts,
    completed_attempts: completedAttempts,
    censored_attempts: censoredAttempts,
    repair_attempts: repairAttempts,
    exact_prediction_samples: samples.length,
  },
  accounting: {
    compile_frames: compileFrames,
    segment_frames: segmentFrames,
    violations: violations.length,
    messages: violations.slice(0, 200),
  },
  components,
  by_attempt_kind: byAttemptKind,
  interval: {
    n: intervalSamples.length,
    covered: intervalCovered,
    coverage: ratio(intervalCovered, intervalSamples.length),
  },
  censoring: {
    attempts: censoredAttempts,
    start_upper_below_observed_spend: censoredUpperUnderestimates,
    rate: ratio(censoredUpperUnderestimates, censoredAttempts),
  },
  applicability,
  calibration_samples: samples,
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath(outPath), markdown(report));
}
console.log(markdown(report));
if (outPath !== undefined) console.log(`wrote ${outPath} and ${markdownPath(outPath)}`);
if (violations.length > 0) process.exitCode = 1;

function readTelemetries(path: string): LocatedTelemetry[] {
  const bytes = readFileSync(path);
  const decoded = path.endsWith(".gz") ? gunzipSync(bytes).toString("utf8") : bytes.toString("utf8");
  const value = JSON.parse(decoded);
  if (isTelemetry(value)) return [{ source: path, context: "sidecar", group: "sidecar", telemetry: value }];

  const out: LocatedTelemetry[] = [];
  if (Array.isArray(value.runs)) {
    for (const run of value.runs) {
      const telemetry = run?.budgetTelemetry ?? run?.budget_telemetry;
      if (!isTelemetry(telemetry)) continue;
      out.push({
        source: path,
        context: [run.task?.sourceId ?? run.source?.id ?? "run", run.task?.actualSeed, run.task?.budget]
          .filter((part) => part !== undefined).join("/"),
        group: run.source?.originFamily ??
          familyBySourceId.get(run.task?.sourceId ?? run.source?.id) ??
          run.task?.sourceId ?? run.source?.id ?? "run",
        telemetry,
      });
    }
  }
  if (Array.isArray(value.rows)) {
    for (const row of value.rows) {
      if (Array.isArray(row?.checkpoints)) {
        for (const checkpoint of row.checkpoints) {
          const telemetry = checkpoint?.budget_telemetry ?? checkpoint?.budgetTelemetry;
          if (isTelemetry(telemetry)) {
            out.push({
              source: path,
              context: `${row.name ?? "row"}/seed=${row.seed ?? "?"}/budget=${checkpoint.budget ?? "?"}`,
              group: row.name ?? "row",
              telemetry,
            });
          }
        }
      } else {
        const telemetry = row?.budgetTelemetry ?? row?.budget_telemetry;
        if (isTelemetry(telemetry)) {
          out.push({
            source: path,
            context: row.sourceId ?? row.spec ?? "row",
            group: row.originFamily ?? row.sourceId ?? row.spec ?? "row",
            telemetry,
          });
        }
      }
    }
  }
  return out;
}

function isTelemetry(value: unknown): value is CompileBudgetTelemetry {
  return typeof value === "object" && value !== null &&
    (value as { schema?: unknown }).schema === BUDGET_TELEMETRY_SCHEMA;
}

function validateCompile(item: LocatedTelemetry, violations: string[]): void {
  const { telemetry } = item;
  const prefix = `${item.source}:${item.context}`;
  const compile = telemetry.compile;
  const balance = compile.hard_budget_frames + compile.hard_overrun_frames -
    compile.total_spent_frames - compile.hard_remaining_frames;
  if (balance !== 0) violations.push(`${prefix}: hard budget identity differs by ${balance}`);
  let cursor = 0;
  for (const [index, segment] of [...telemetry.segments]
    .sort((a, b) => a.start_total_spent_frames - b.start_total_spent_frames)
    .entries()) {
    if (segment.start_total_spent_frames !== cursor) {
      violations.push(`${prefix}: segment ${index} starts ${segment.start_total_spent_frames}, expected ${cursor}`);
    }
    if (segment.spent_frames !== segment.end_total_spent_frames - segment.start_total_spent_frames) {
      violations.push(`${prefix}: segment ${index} spent identity fails`);
    }
    cursor = Math.max(cursor, segment.end_total_spent_frames);
  }
  if (cursor !== compile.total_spent_frames) {
    violations.push(`${prefix}: segments end ${cursor}, compile ends ${compile.total_spent_frames}`);
  }
}

function validateAttempt(
  item: LocatedTelemetry,
  attempt: BudgetAttemptTelemetry,
  violations: string[],
): void {
  const prefix = `${item.source}:${item.context}:attempt=${attempt.attempt_id}`;
  if (attempt.anchor.gap_index !== attempt.start.high_water.gap_index) {
    violations.push(`${prefix}: start high-water differs from anchor`);
  }
  if (attempt.local_budget_frames !== attempt.ceiling_total_spent_frames - attempt.start_total_spent_frames) {
    violations.push(`${prefix}: local budget identity fails`);
  }
  if (
    attempt.outcome.end_total_spent_frames !== null &&
    attempt.outcome.spent_frames !== null &&
    attempt.outcome.end_total_spent_frames - attempt.start_total_spent_frames !==
      attempt.outcome.spent_frames
  ) violations.push(`${prefix}: outcome spent identity fails`);
  const observations = attempt.observations ?? [attempt.start, ...(attempt.end === null ? [] : [attempt.end])];
  let lastSpent = -1;
  let lastGap = attempt.anchor.gap_index;
  for (const observation of observations) {
    if (observation.total_spent_frames < lastSpent) violations.push(`${prefix}: observation spend regressed`);
    if (observation.high_water.gap_index < lastGap) violations.push(`${prefix}: high-water regressed`);
    if (!allFiniteObservationValues(observation)) violations.push(`${prefix}: non-finite observation value`);
    const hardBalance = item.telemetry.compile.hard_budget_frames + observation.hard_overrun_frames -
      observation.total_spent_frames - observation.hard_remaining_frames;
    if (hardBalance !== 0) violations.push(`${prefix}: observation hard-budget identity fails`);
    lastSpent = observation.total_spent_frames;
    lastGap = observation.high_water.gap_index;
  }
  if (attempt.outcome.completed && attempt.outcome.first_terminal_offset_frames === null) {
    violations.push(`${prefix}: completed attempt lacks first-terminal offset`);
  }
  if (
    attempt.outcome.first_terminal_offset_frames !== null &&
    attempt.outcome.spent_frames !== null &&
    attempt.outcome.first_terminal_offset_frames > attempt.outcome.spent_frames
  ) violations.push(`${prefix}: terminal occurs after attempt end`);
  if (!attempt.outcome.completed && !attempt.outcome.censored) {
    violations.push(`${prefix}: incomplete attempt is not censored`);
  }
}

function collectSamples(
  item: LocatedTelemetry,
  attempt: BudgetAttemptTelemetry,
  out: PredictionSample[],
): void {
  const offset = attempt.outcome.first_terminal_offset_frames;
  if (!attempt.outcome.completed || offset === null) return;
  const terminalTotal = attempt.start_total_spent_frames + offset;
  const observations = attempt.observations ?? [attempt.start, ...(attempt.end === null ? [] : [attempt.end])];
  for (const observation of observations) {
    // Ground truth is charged work from this observation to this attempt's
    // first terminal. Never infer a completion cost for a censored attempt.
    const actual = Math.max(0, terminalTotal - observation.total_spent_frames);
    if (actual <= 0) continue;
    out.push({
      source: item.source,
      context: item.context,
      group: item.group,
      attemptKind: attempt.kind,
      attemptId: attempt.attempt_id,
      event: observation.event,
      actual,
      structural: observation.structural_work_prior_frames,
      path: observation.incumbent_path_work_estimate_frames,
      pace: observation.episode_pace_work_estimate_frames,
      combined: observation.estimated_remaining_work_frames,
      lower: observation.estimate_lower_frames,
      upper: observation.estimate_upper_frames,
      remainingContacts: observation.high_water.remaining_contacts,
      remainingDurationFrames: observation.high_water.remaining_duration_frames,
      startupIncluded: observation.structural_startup_included ??
        (attempt.kind === "initial" &&
          observation.high_water.gap_index === attempt.anchor.gap_index),
      progressFraction: observation.structural_progress_fraction,
      policyBudgetFrames: item.telemetry.compile.policy_budget_frames,
      estimatorApplicability: observation.estimator_applicability ?? "legacy_unspecified",
    });
  }
}

function summarizeComponents(samples: PredictionSample[]): ComponentSummary[] {
  const definitions = [
    ["structural", (sample: PredictionSample) => sample.structural],
    ["path", (sample: PredictionSample) => sample.path],
    ["pace", (sample: PredictionSample) => sample.pace],
    ["combined", (sample: PredictionSample) => sample.combined],
  ] as const;
  return definitions.map(([component, valueOf]) => {
    const values = samples
      .map((sample) => ({ actual: sample.actual, predicted: valueOf(sample) }))
      .filter((value): value is { actual: number; predicted: number } =>
        value.predicted !== null && value.predicted >= 0 && Number.isFinite(value.predicted)
      );
    const errors = values.map((value) => value.predicted - value.actual);
    const apes = values.map((value) => Math.abs(value.predicted - value.actual) / value.actual);
    const logs = values
      .filter((value) => value.predicted > 0 && value.actual > 0)
      .map((value) => Math.abs(Math.log(value.predicted / value.actual)));
    return {
      component,
      n: values.length,
      bias_frames: nullableRound(mean(errors)),
      mae_frames: nullableRound(mean(errors.map(Math.abs))),
      median_absolute_percentage_error: nullableRound(percentile(apes, 0.5), 4),
      p90_absolute_percentage_error: nullableRound(percentile(apes, 0.9), 4),
      median_absolute_log_error: nullableRound(percentile(logs, 0.5), 4),
    };
  });
}

function allFiniteObservationValues(observation: BudgetEstimateObservation): boolean {
  return allFiniteValues(observation);
}

function allFiniteValues(value: unknown): boolean {
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(allFiniteValues);
  if (typeof value === "object" && value !== null) {
    return Object.values(value).every(allFiniteValues);
  }
  return true;
}

function markdown(report: AnalysisReport): string {
  const lines = [
    "# Compile Budget Telemetry Analysis",
    "",
    `Payloads: ${report.payloads} (${report.trace_payloads} trace)`,
    `Attempts: ${report.counts.attempts}; completed ${report.counts.completed_attempts}; censored ${report.counts.censored_attempts}; repair ${report.counts.repair_attempts}`,
    `Accounting: ${report.accounting.violations} violations; ${report.accounting.segment_frames}/${report.accounting.compile_frames} frames segmented`,
    `Estimator interval coverage: ${pct(report.interval.coverage)} (${report.interval.covered}/${report.interval.n})`,
    `Censored start-upper underestimates: ${pct(report.censoring.rate)} (${report.censoring.start_upper_below_observed_spend}/${report.censoring.attempts})`,
    "",
    "| component | n | bias frames | MAE frames | median APE | p90 APE | median |log ratio| |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...report.components.map((component) =>
      `| ${component.component} | ${component.n} | ${fmt(component.bias_frames)} | ${fmt(component.mae_frames)} | ${pct(component.median_absolute_percentage_error)} | ${pct(component.p90_absolute_percentage_error)} | ${fmt(component.median_absolute_log_error, 3)} |`
    ),
    "",
    "## Estimator Applicability",
    "",
    "| status | samples | interval coverage | combined median APE |",
    "|---|---:|---:|---:|",
    ...report.applicability.map((entry) =>
      `| ${entry.status} | ${entry.samples} | ${pct(entry.interval_coverage)} | ${pct(entry.combined.median_absolute_percentage_error)} |`
    ),
  ];
  if (report.accounting.messages.length > 0) {
    lines.push("", "## Accounting Violations", "", ...report.accounting.messages.map((message) => `- ${message}`));
  }
  return `${lines.join("\n")}\n`;
}

function markdownPath(path: string): string {
  return extname(path) === ".json" ? path.slice(0, -5) + ".md" : `${path}.md`;
}

function mean(values: number[]): number | null {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function percentile(values: number[], probability: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * probability;
  const low = Math.floor(index);
  const high = Math.ceil(index);
  const fraction = index - low;
  return sorted[low] * (1 - fraction) + sorted[high] * fraction;
}

function ratio(numerator: number, denominator: number): number | null {
  return denominator === 0 ? null : Number((numerator / denominator).toFixed(6));
}

function nullableRound(value: number | null, digits = 2): number | null {
  return value === null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function fmt(value: number | null, digits = 1): string {
  return value === null ? "n/a" : value.toFixed(digits);
}

function pct(value: number | null): string {
  return value === null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}
