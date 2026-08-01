/**
 * Validate and summarize compile-budget telemetry sidecars and run archives.
 *
 *   node --import tsx scripts/v0/analyze_budget_telemetry.ts \
 *     generated/foo.budget-telemetry.json generated/run.json \
 *     --out=generated/studies/budget-telemetry-analysis.json
 */

import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import type {
  BudgetAttemptKind,
  BudgetAttemptTelemetry,
  BudgetEstimateObservation,
  CompileBudgetTelemetry,
} from "./optimizer/budget_telemetry.ts";
import { BUDGET_TELEMETRY_SCHEMA } from "./optimizer/budget_telemetry.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  BUDGET_ESTIMATOR_MODEL_FINGERPRINT,
  budgetEstimateInterval,
  budgetEstimatorApplicability,
  estimateRemainingBudgetWork,
  type BudgetEstimatorAttemptKind,
} from "./optimizer/budget_estimator.ts";
import { loadSourceManifest, resolveSources } from "./benchmark_v2/model.ts";

const ATTEMPT_KINDS = ["initial", "snapshot", "repair", "resumed"] as const;

type LocatedTelemetry = {
  source: string;
  context: string;
  group: string;
  telemetry: CompileBudgetTelemetry;
};

type EstimatorProvenance = {
  fingerprint: string;
  model_id: string;
  calibrated: boolean | null;
  payloads: number;
  sources: string[];
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

type IntervalSummary = { n: number; covered: number; coverage: number | null };

type AnalysisReport = {
  schema: "line.compile-budget-telemetry-analysis.v1";
  inputs: string[];
  payloads: number;
  trace_payloads: number;
  /**
   * Which estimator artifact produced the recorded estimates. Estimates from
   * different artifacts are not comparable, so mixing them is a violation
   * unless --allow-mixed-estimators downgrades it to a warning.
   */
  estimators: {
    local_fingerprint: string;
    local_model_id: string;
    local_calibrated: boolean;
    corpus: EstimatorProvenance[];
    mixed: boolean;
    matches_local: boolean;
    /** True when recorded estimates were recomputed and checked against the local artifact. */
    revalidated_against_local: boolean;
    revalidated_observations: number;
    /** Observations whose components a reduced archive form dropped. */
    revalidation_skipped_observations: number;
  };
  warnings: string[];
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
    samples: number;
    components: ComponentSummary[];
  }>;
  by_event: Array<{
    event: BudgetEstimateObservation["event"];
    samples: number;
    interval_coverage: number | null;
    combined: ComponentSummary;
  }>;
  /**
   * Headline coverage over CALIBRATED observations only. Out-of-domain
   * observations widen to [0, max(upper, hard remaining)] by construction, so
   * their coverage is near-tautological and is reported separately.
   */
  interval: IntervalSummary & { scope: "calibrated" };
  interval_trivial: IntervalSummary & { scope: "extrapolated_or_unvalidated" };
  /** Share of samples the estimator itself marks out of domain. */
  out_of_domain_sample_share: number | null;
  censoring: {
    attempts: number;
    start_upper_below_observed_spend: number;
    rate: number | null;
  };
  /** Null only when --samples=off omitted the array; the calibrator needs it. */
  calibration_samples: PredictionSample[] | null;
  samples_omitted: boolean;
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
const requested = argv.filter((value) => !value.startsWith("--"));
if (requested.length === 0) {
  throw new Error(
    "usage: analyze_budget_telemetry.ts <sidecar-or-archive-or-directory>... " +
      "[--out=analysis.json] [--source-manifest=manifest.json] [--samples=off] " +
      "[--allow-mixed-estimators]",
  );
}
const allowMixedEstimators = argv.includes("--allow-mixed-estimators");
const emitSamples = (arg("samples") ?? "on") !== "off";
const inputs = requested.flatMap(expandInput);
if (inputs.length === 0) throw new Error("no telemetry files matched the requested inputs");
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
const warnings: string[] = [];
const samples: PredictionSample[] = [];
let attempts = 0;
let completedAttempts = 0;
let censoredAttempts = 0;
let repairAttempts = 0;
let tracePayloads = 0;
let segmentFrames = 0;
let compileFrames = 0;
let censoredUpperUnderestimates = 0;
let revalidatedObservations = 0;
let skippedRevalidations = 0;

// Estimator provenance first: whether recorded estimates may be pooled at all,
// and whether this process can re-derive them, are decisions about the corpus
// rather than about any one payload.
const estimatorCorpus = new Map<string, EstimatorProvenance>();
for (const item of located) {
  const model = item.telemetry.model as CompileBudgetTelemetry["model"] | undefined;
  const fingerprint = model?.estimator_fingerprint ?? "unspecified";
  const existing = estimatorCorpus.get(fingerprint);
  if (existing === undefined) {
    estimatorCorpus.set(fingerprint, {
      fingerprint,
      model_id: model?.estimator_model ?? "unspecified",
      calibrated: model?.calibrated ?? null,
      payloads: 1,
      sources: [item.source],
    });
  } else {
    existing.payloads++;
    if (!existing.sources.includes(item.source)) existing.sources.push(item.source);
  }
}
const corpusFingerprints = [...estimatorCorpus.keys()].sort();
const mixedEstimators = corpusFingerprints.length > 1;
if (mixedEstimators) {
  const message = `mixed estimator artifacts in one analysis: ${
    corpusFingerprints.map((fingerprint) =>
      `${fingerprint.slice(0, 12)}(${estimatorCorpus.get(fingerprint)!.payloads})`
    ).join(", ")
  } — recorded estimates from different artifacts are not comparable`;
  if (allowMixedEstimators) warnings.push(message);
  else violations.push(message);
}
const matchesLocalEstimator = corpusFingerprints.length === 1 &&
  corpusFingerprints[0] === BUDGET_ESTIMATOR_MODEL_FINGERPRINT;
if (!matchesLocalEstimator) {
  warnings.push(
    `corpus estimator ${corpusFingerprints.map((f) => f.slice(0, 12)).join("+")} ` +
      `differs from the locally loaded artifact ${BUDGET_ESTIMATOR_MODEL_FINGERPRINT.slice(0, 12)} ` +
      `(${BUDGET_ESTIMATOR_MODEL.modelId}): recorded estimates were NOT re-derived, ` +
      `and error statistics describe the recording artifact, not this checkout`,
  );
}

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
    if (matchesLocalEstimator) validateEstimateAccounting(item, attempt, violations);
    collectSamples(item, attempt, samples);
    if (
      attempt.outcome.censored &&
      attempt.outcome.spent_frames !== null &&
      attempt.start.estimate_upper_frames < attempt.outcome.spent_frames
    ) censoredUpperUnderestimates++;
  }
}

const allAttempts = located.flatMap((item) => item.telemetry.attempts);
const components = summarizeComponents(samples);
const byAttemptKind = ATTEMPT_KINDS.map((kind) => ({
  kind,
  attempts: allAttempts.filter((attempt) => attempt.kind === kind).length,
  completed: allAttempts.filter((attempt) => attempt.kind === kind && attempt.outcome.completed).length,
  samples: samples.filter((sample) => sample.attemptKind === kind).length,
  components: summarizeComponents(samples.filter((sample) => sample.attemptKind === kind)),
}));
const byEvent = [...new Set(samples.map((sample) => sample.event))].sort().map((event) => {
  const selected = samples.filter((sample) => sample.event === event);
  return {
    event,
    samples: selected.length,
    interval_coverage: ratio(countCovered(selected), selected.length),
    combined: summarizeComponents(selected).find((component) => component.component === "combined")!,
  };
});
// Extrapolated intervals are [0, max(upper, hard remaining)] by construction:
// pooling them into one headline hides both how wide they are and how few of
// the reported samples were actually in domain.
const calibratedSamples = samples.filter((sample) => sample.estimatorApplicability === "calibrated");
const trivialSamples = samples.filter((sample) => sample.estimatorApplicability !== "calibrated");
const applicabilityStatuses = [...new Set(samples.map((sample) => sample.estimatorApplicability))].sort();
const applicability = applicabilityStatuses.map((status) => {
  const selected = samples.filter((sample) => sample.estimatorApplicability === status);
  return {
    status,
    samples: selected.length,
    interval_coverage: ratio(countCovered(selected), selected.length),
    combined: summarizeComponents(selected).find((component) => component.component === "combined")!,
  };
});

const report: AnalysisReport = {
  schema: "line.compile-budget-telemetry-analysis.v1",
  inputs,
  payloads: located.length,
  trace_payloads: tracePayloads,
  estimators: {
    local_fingerprint: BUDGET_ESTIMATOR_MODEL_FINGERPRINT,
    local_model_id: BUDGET_ESTIMATOR_MODEL.modelId,
    local_calibrated: BUDGET_ESTIMATOR_MODEL.calibrated,
    corpus: corpusFingerprints.map((fingerprint) => estimatorCorpus.get(fingerprint)!),
    mixed: mixedEstimators,
    matches_local: matchesLocalEstimator,
    revalidated_against_local: matchesLocalEstimator,
    revalidated_observations: revalidatedObservations,
    revalidation_skipped_observations: skippedRevalidations,
  },
  warnings,
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
  by_event: byEvent,
  interval: {
    scope: "calibrated",
    n: calibratedSamples.length,
    covered: countCovered(calibratedSamples),
    coverage: ratio(countCovered(calibratedSamples), calibratedSamples.length),
  },
  interval_trivial: {
    scope: "extrapolated_or_unvalidated",
    n: trivialSamples.length,
    covered: countCovered(trivialSamples),
    coverage: ratio(countCovered(trivialSamples), trivialSamples.length),
  },
  out_of_domain_sample_share: ratio(trivialSamples.length, samples.length),
  censoring: {
    attempts: censoredAttempts,
    start_upper_below_observed_spend: censoredUpperUnderestimates,
    rate: ratio(censoredUpperUnderestimates, censoredAttempts),
  },
  applicability,
  calibration_samples: emitSamples ? samples : null,
  samples_omitted: !emitSamples,
};

if (outPath !== undefined) {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  writeFileSync(markdownPath(outPath), markdown(report));
}
console.log(markdown(report));
if (outPath !== undefined) console.log(`wrote ${outPath} and ${markdownPath(outPath)}`);
if (violations.length > 0) process.exitCode = 1;

/** A directory input stands for the telemetry sidecars directly inside it. */
function expandInput(path: string): string[] {
  if (!statSync(path).isDirectory()) return [path];
  const matches = readdirSync(path)
    .filter((entry) =>
      entry.endsWith(".budget-telemetry.json") || entry.endsWith(".budget-telemetry.json.gz")
    )
    .sort()
    .map((entry) => join(path, entry));
  if (matches.length === 0) throw new Error(`no *.budget-telemetry.json files in ${path}`);
  return matches;
}

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
  validateFirstTerminal(item, violations);
}

/**
 * The one cheap external check on attempt attribution.
 *
 * `compile.first_terminal_total_spent_frames` comes from the compiler's own
 * counter and knows nothing about attempts; the same quantity derived from
 * attempts is the earliest attributed terminal. They disagree exactly when a
 * terminal landed in a phase with no active attempt, which is the failure the
 * resumed-search instrumentation existed to prevent. Absent on payloads
 * recorded before the field existed, which are skipped rather than flagged.
 */
function validateFirstTerminal(item: LocatedTelemetry, violations: string[]): void {
  const compile = item.telemetry.compile;
  const reported = compile.first_terminal_total_spent_frames;
  if (reported === undefined) return;
  const prefix = `${item.source}:${item.context}`;
  let derived: number | null = null;
  for (const attempt of item.telemetry.attempts) {
    const offset = attempt.outcome.first_terminal_offset_frames;
    if (!attempt.outcome.completed || offset === null) continue;
    const total = attempt.start_total_spent_frames + offset;
    if (derived === null || total < derived) derived = total;
  }
  if (reported === null && derived !== null) {
    violations.push(
      `${prefix}: attempts report a first terminal at ${derived} but the compile reports none`,
    );
  } else if (reported !== null && derived === null) {
    violations.push(
      `${prefix}: compile reports a first terminal at ${reported} that no attempt claims`,
    );
  } else if (reported !== null && derived !== null && reported !== derived) {
    violations.push(
      `${prefix}: compile first terminal ${reported} differs from earliest attributed ${derived}`,
    );
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

/**
 * Recompute every recorded estimate from its own recorded components.
 *
 * Without this, an observation block whose estimates, intervals, and margins
 * were all replaced by arbitrary numbers still passes every other check: the
 * accounting identities only constrain the work counters. Only run when the
 * corpus was recorded by the artifact this process loaded — otherwise the
 * difference is a legitimate model change, not a corruption.
 */
function validateEstimateAccounting(
  item: LocatedTelemetry,
  attempt: BudgetAttemptTelemetry,
  violations: string[],
): void {
  const prefix = `${item.source}:${item.context}:attempt=${attempt.attempt_id}`;
  const observations = attempt.observations ??
    [attempt.start, ...(attempt.end === null ? [] : [attempt.end])];
  for (const observation of observations) {
    // Reduced archive forms keep the estimates but drop the components they
    // came from. Nothing can be re-derived there, and absence is not corruption.
    if (!hasEstimateComponents(observation)) {
      skippedRevalidations++;
      continue;
    }
    revalidatedObservations++;
    const where = `${prefix}:${observation.event}@${observation.total_spent_frames}`;
    const path = observation.incumbent_path_work_estimate_frames;
    const expectedApplicability = budgetEstimatorApplicability({
      // The recorder asks only whether a path value was stored; the estimator's
      // own selector is what discards non-positive ones.
      pathAvailable: path !== null,
      policyBudgetFrames: item.telemetry.compile.policy_budget_frames,
      attemptKind: attempt.kind as BudgetEstimatorAttemptKind,
    });
    const applicability = observation.estimator_applicability;
    if (applicability !== undefined && applicability !== expectedApplicability) {
      violations.push(
        `${where}: applicability ${applicability} but components imply ${expectedApplicability}`,
      );
    }
    const estimated = estimateRemainingBudgetWork({
      structural: observation.structural_work_prior_frames,
      path,
      pace: observation.episode_pace_work_estimate_frames,
      progressFraction: observation.structural_progress_fraction,
    });
    if (!closeEnough(observation.estimated_remaining_work_frames, estimated)) {
      violations.push(
        `${where}: estimate ${observation.estimated_remaining_work_frames} ` +
          `is not the artifact's ${estimated} for these components`,
      );
      continue;
    }
    const calibratedInterval = budgetEstimateInterval(estimated, {
      event: observation.event,
      pathAvailable: path !== null,
    });
    const inDomain = (applicability ?? expectedApplicability) === "calibrated";
    const lower = inDomain ? calibratedInterval.lower : 0;
    const upper = inDomain
      ? calibratedInterval.upper
      : Math.max(calibratedInterval.upper, observation.hard_remaining_frames);
    for (const [name, recorded, expected] of [
      ["estimate_lower_frames", observation.estimate_lower_frames, lower],
      ["estimate_upper_frames", observation.estimate_upper_frames, upper],
      ["estimate_uncertainty_frames", observation.estimate_uncertainty_frames, (upper - lower) / 2],
      [
        "hard_completion_surplus_frames",
        observation.hard_completion_surplus_frames,
        observation.hard_remaining_frames - estimated,
      ],
      [
        "attempt_completion_surplus_frames",
        observation.attempt_completion_surplus_frames,
        observation.attempt_remaining_frames - estimated,
      ],
    ] as const) {
      if (!closeEnough(recorded, expected)) {
        violations.push(`${where}: ${name} ${recorded} should be ${expected}`);
      }
    }
    const margined = inDomain && estimated > 0;
    for (const [name, recorded, available] of [
      ["hard_completion_margin", observation.hard_completion_margin, observation.hard_remaining_frames],
      [
        "attempt_completion_margin",
        observation.attempt_completion_margin,
        observation.attempt_remaining_frames,
      ],
    ] as const) {
      const expected = margined ? available / estimated : null;
      if (expected === null ? recorded !== null : recorded === null || !closeEnough(recorded, expected)) {
        violations.push(`${where}: ${name} ${String(recorded)} should be ${String(expected)}`);
      }
    }
  }
}

/** Every input the point estimate, its interval, and its margins are built from. */
function hasEstimateComponents(observation: BudgetEstimateObservation): boolean {
  const nullableNumbers: Array<number | null | undefined> = [
    observation.incumbent_path_work_estimate_frames,
    observation.episode_pace_work_estimate_frames,
    observation.hard_completion_margin,
    observation.attempt_completion_margin,
  ];
  return [
    observation.structural_work_prior_frames,
    observation.structural_progress_fraction,
    observation.hard_remaining_frames,
    observation.attempt_remaining_frames,
    observation.estimated_remaining_work_frames,
    observation.estimate_lower_frames,
    observation.estimate_upper_frames,
    observation.estimate_uncertainty_frames,
    observation.hard_completion_surplus_frames,
    observation.attempt_completion_surplus_frames,
  ].every((value) => typeof value === "number") &&
    nullableNumbers.every((value) => value === null || typeof value === "number");
}

function closeEnough(recorded: number, expected: number): boolean {
  if (!Number.isFinite(recorded) || !Number.isFinite(expected)) return false;
  return Math.abs(recorded - expected) <= 1e-6 + 1e-9 * Math.abs(expected);
}

function countCovered(selected: PredictionSample[]): number {
  return selected.filter((sample) => sample.actual >= sample.lower && sample.actual <= sample.upper).length;
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
    // One population per row. A non-positive prediction has no log ratio, so
    // admitting it to the frame/APE statistics while the log statistic drops it
    // reported two different sample sets under one n.
    const values = samples
      .map((sample) => ({ actual: sample.actual, predicted: valueOf(sample) }))
      .filter((value): value is { actual: number; predicted: number } =>
        value.predicted !== null && Number.isFinite(value.predicted) && value.predicted > 0
      );
    const errors = values.map((value) => value.predicted - value.actual);
    const apes = values.map((value) => Math.abs(value.predicted - value.actual) / value.actual);
    const logs = values.map((value) => Math.abs(Math.log(value.predicted / value.actual)));
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
  const componentTable = (components: ComponentSummary[]): string[] => [
    "| component | n | bias frames | MAE frames | median APE | p90 APE | median |log ratio| |",
    "|---|---:|---:|---:|---:|---:|---:|",
    ...components.map((component) =>
      `| ${component.component} | ${component.n} | ${fmt(component.bias_frames)} | ${fmt(component.mae_frames)} | ${pct(component.median_absolute_percentage_error)} | ${pct(component.p90_absolute_percentage_error)} | ${fmt(component.median_absolute_log_error, 3)} |`
    ),
  ];
  const lines = [
    "# Compile Budget Telemetry Analysis",
    "",
    `Payloads: ${report.payloads} (${report.trace_payloads} trace)`,
    `Attempts: ${report.counts.attempts}; completed ${report.counts.completed_attempts}; censored ${report.counts.censored_attempts}; repair ${report.counts.repair_attempts}`,
    `Accounting: ${report.accounting.violations} violations; ${report.accounting.segment_frames}/${report.accounting.compile_frames} frames segmented`,
    `Out-of-domain samples: ${pct(report.out_of_domain_sample_share)} of ${report.counts.exact_prediction_samples} ` +
      `(their intervals are trivially covered and are excluded from the headline)`,
    `Estimator interval coverage (calibrated only): ${pct(report.interval.coverage)} (${report.interval.covered}/${report.interval.n})`,
    `Trivial interval coverage (out of domain): ${pct(report.interval_trivial.coverage)} (${report.interval_trivial.covered}/${report.interval_trivial.n})`,
    `Censored start-upper underestimates: ${pct(report.censoring.rate)} (${report.censoring.start_upper_below_observed_spend}/${report.censoring.attempts})`,
    `Estimator artifact: ${report.estimators.corpus.map((entry) => `${entry.model_id} ${entry.fingerprint.slice(0, 12)} (${entry.payloads})`).join("; ")}` +
      `${
        report.estimators.matches_local
          ? ` — matches this checkout; ${report.estimators.revalidated_observations} observations re-derived, ` +
            `${report.estimators.revalidation_skipped_observations} reduced`
          : " — DIFFERS from this checkout"
      }`,
  ];
  if (report.warnings.length > 0) {
    lines.push("", "> **Warning**", ...report.warnings.map((message) => `> - ${message}`));
  }
  lines.push(
    "",
    ...componentTable(report.components),
    "",
    "## By Attempt Kind",
    "",
    "| kind | attempts | completed | samples | combined median APE | combined bias frames |",
    "|---|---:|---:|---:|---:|---:|",
    ...report.by_attempt_kind.map((entry) => {
      const combined = entry.components.find((component) => component.component === "combined")!;
      return `| ${entry.kind} | ${entry.attempts} | ${entry.completed} | ${entry.samples} | ` +
        `${pct(combined.median_absolute_percentage_error)} | ${fmt(combined.bias_frames)} |`;
    }),
    "",
    "## By Event",
    "",
    "| event | samples | interval coverage | combined median APE | combined bias frames |",
    "|---|---:|---:|---:|---:|",
    ...report.by_event.map((entry) =>
      `| ${entry.event} | ${entry.samples} | ${pct(entry.interval_coverage)} | ` +
      `${pct(entry.combined.median_absolute_percentage_error)} | ${fmt(entry.combined.bias_frames)} |`
    ),
    "",
    "## Estimator Applicability",
    "",
    "| status | samples | interval coverage | combined median APE |",
    "|---|---:|---:|---:|",
    ...report.applicability.map((entry) =>
      `| ${entry.status} | ${entry.samples} | ${pct(entry.interval_coverage)} | ${pct(entry.combined.median_absolute_percentage_error)} |`
    ),
  );
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
