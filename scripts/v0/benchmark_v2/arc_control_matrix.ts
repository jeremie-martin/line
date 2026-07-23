/**
 * Actual Benchmark V2 exploration for declarative arc-control configurations.
 *
 * The configuration matrix is strictly compiler-side:
 *
 *   ordered knob sequence × training method × probe layout × probe range × solver range × proposal count
 *
 * Cases, budgets, seeds, and scoring are deliberately not matrix dimensions.
 * Every selected configuration is snapshot, then evaluated by the ordinary V2
 * development probe runner on one fresh shared exploration seed epoch.  This
 * file is orchestration only: it neither reimplements the compiler nor the V2
 * scorer, and it can never select or promote a configuration.
 *
 * Examples:
 *   # Inspect the generated compiler configurations without any paid work.
 *   npm run benchmark:v2:arc-control-matrix -- --dry-run --knobs=whole_rotation,tail_pitch
 *
 *   # A short actual-V2 smoke: source-default, reversed order, joint, sequential.
 *   npm run benchmark:v2:arc-control-matrix -- --name=smoke-01 --seeds=2 \
 *     --configurations=base_additive--signed3--whole_rotation__tail_pitch,base_additive--signed3--tail_pitch__whole_rotation,base_joint--signed3--whole_rotation__tail_pitch,sequential_conditional--signed3--whole_rotation__tail_pitch
 */
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { availableParallelism } from "node:os";
import { dirname, resolve } from "node:path";
import { readBaselineContract } from "./baseline_contract.ts";
import {
  createCompilerSnapshot,
  runSnapshotBenchmark,
  validateCompilerSnapshot,
  type CompilerSnapshot,
} from "./compiler_snapshot.ts";
import { compilerCandidateIdentity } from "./compiler_identity.ts";
import { loadVerifiedArchive } from "./decide.ts";
import {
  allocateExplorationSeedEpoch,
  buildFamilyReport,
  FAMILY_PROTOCOL,
  FAMILY_SCHEMA,
  type BenchmarkFamily,
  type FamilyRound,
} from "./family.ts";
import {
  ARC_CONTROL_DEFAULT,
  ARC_PROPOSAL_COUNT_DEFAULT,
  ARC_PROBE_RANGE_SCALE_DEFAULT,
  ARC_PROPOSAL_RANGE_SCALE_DEFAULT,
  enumerateArcControlConfigurations,
  type ArcControlConfiguration,
  type ArcProbeLayoutId,
  type ArcTrainingMethod,
} from "../optimizer/arc_control.ts";
import { getArcKnob, type ArcKnobId } from "../optimizer/arc_actuator.ts";
import { writeFileAtomicDurable } from "./durable_fs.ts";

const SCHEMA = "line.benchmark-v2.arc-control-matrix.v2" as const;
const DEFAULT_OUTPUT_ROOT = "generated/benchmark-v2/arc-control-matrices";
const SHARED_SEED_LEDGER_ROOT = "generated/benchmark-v2/families";
const DEFAULT_EVALUATION_BUDGETS = [250_000, 500_000] as const;
const CANONICAL_EVALUATION_BUDGETS = [250_000, 500_000, 750_000] as const;
const argv = process.argv.slice(2);

const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

const name = argument("name") ?? "arc-control-matrix";
const knobs = (argument("knobs") ?? "whole_rotation,tail_pitch")
  .split(",").map((value) => value.trim()).filter(Boolean) as ArcKnobId[];
const sequences = argument("sequences")?.split(",").map((entry) =>
  entry.split("__").map((value) => value.trim()).filter(Boolean) as ArcKnobId[],
);
const maxKnobs = Number(argument("max-knobs") ?? "2");
const allowRepeated = argv.includes("--allow-repeated");
const methods = argument("methods")?.split(",").map((value) => value.trim()).filter(Boolean) as ArcTrainingMethod[] | undefined;
/** Keep a nominal layout explicit by default: registering a future layout must
 * never silently multiply an existing paid experiment.  Layout remains an
 * ordinary selected compiler axis through --probe-layouts. */
const probeLayouts = (argument("probe-layouts") ?? "signed3")
  .split(",").map((value) => value.trim()).filter(Boolean) as ArcProbeLayoutId[];
const probeRangeScales = positiveNumberList(
  "probe-range-scales",
  ARC_PROBE_RANGE_SCALE_DEFAULT,
);
const proposalRangeScales = positiveNumberList(
  "proposal-range-scales",
  ARC_PROPOSAL_RANGE_SCALE_DEFAULT,
);
const proposalCounts = (argument("proposal-counts") ?? String(ARC_PROPOSAL_COUNT_DEFAULT))
  .split(",").map((value) => Number(value.trim())).filter((value) => Number.isFinite(value));
const configurationFilter = argument("configurations")?.split(",").map((value) => value.trim()).filter(Boolean);
/** Evaluation protocol, explicitly outside the compiler configuration product. */
const evaluationBudgets = positiveIntegerList("evaluation-budgets", DEFAULT_EVALUATION_BUDGETS);
const seeds = Number(argument("seeds") ?? "6");
const jobs = Number(argument("jobs") ?? String(Math.min(48, availableParallelism())));
const outputRoot = resolve(argument("out-dir") ?? DEFAULT_OUTPUT_ROOT, name);
const dryRun = argv.includes("--dry-run");
const resume = argv.includes("--resume");

validateArguments();
const allConfigurations = enumerateArcControlConfigurations({
  knobs,
  maxKnobs,
  probeLayouts,
  probeRangeScales,
  proposalRangeScales,
  proposalCounts,
  ...(allowRepeated ? { allowRepeated: true } : {}),
  ...(methods === undefined ? {} : { trainingMethods: methods }),
  ...(sequences === undefined ? {} : { sequences }),
});
const configurations = selectConfigurations(allConfigurations, configurationFilter);

type MatrixArm = {
  variantId: string;
  configuration: ArcControlConfiguration;
  environment: Record<string, string>;
  snapshot: CompilerSnapshot;
  archive: string | null;
};

type MatrixState = {
  schema: typeof SCHEMA;
  authority: "exploration-only";
  statement: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  evaluation: {
    runner: "benchmark-v2 development/probe";
    sourceScope: "official-development-suite";
    budgets: number[];
    seedBase: number | null;
    seedsPerBudget: number;
    jobs: number;
  };
  baseline: {
    label: string;
    snapshot: CompilerSnapshot;
    archive: string | null;
  };
  arms: MatrixArm[];
  report: string | null;
};

if (dryRun) {
  console.log(JSON.stringify({
    schema: SCHEMA,
    authority: "exploration-only",
    configurationAxes: [
      "ordered_knob_sequence", "training_method", "probe_layout", "probe_range_scale",
      "proposal_range_scale", "proposal_count",
    ],
    evaluationProtocol: {
      runner: "official Benchmark V2 development/probe runner",
      budgets: evaluationBudgets,
      sharedFreshSeedEpoch: true,
    },
    configurations: allConfigurations,
    selectedConfigurations: configurations.map((configuration) => configuration.id),
    selectedCount: configurations.length,
  }, null, 2));
  process.exit(0);
}

const statePath = resolve(outputRoot, "matrix.json");
const baselineContract = readBaselineContract();
const state = loadOrInitializeState();
const epoch = await allocateExplorationSeedEpoch(
  SHARED_SEED_LEDGER_ROOT,
  `arc-control-matrix-${name}`,
  1,
  seeds * evaluationBudgets.length,
);
if (state.evaluation.seedBase !== null && state.evaluation.seedBase !== epoch.seedBase) {
  throw new Error(`matrix ${name} has a conflicting exploration seed epoch`);
}
state.evaluation.seedBase = epoch.seedBase;
state.updatedAt = new Date().toISOString();
writeState(state);

const baselineReference = runOrReuseArm(
  state.baseline.snapshot,
  baselineContract.candidateFingerprint,
  resolve(outputRoot, "baseline.json"),
);
state.baseline.archive = relativeToCwd(baselineReference.archive);
writeState(state);

for (const arm of state.arms) {
  const reference = runOrReuseArm(
    arm.snapshot,
    arm.snapshot.candidateFingerprint,
    resolve(outputRoot, `variant-${arm.variantId}.json`),
  );
  arm.archive = relativeToCwd(reference.archive);
  state.updatedAt = new Date().toISOString();
  writeState(state);
}

const reportPath = resolve(outputRoot, "report.json");
const report = buildFamilyReport(
  matrixAsFamily(state, baselineReference),
  matrixAsRound(state, baselineReference),
  undefined,
  { budgets: state.evaluation.budgets },
);
const result = {
  schema: SCHEMA,
  authority: "exploration-only" as const,
  statement:
    "This is a shared-seed descriptive configuration screen. It runs the actual compiler and official V2 development/probe scorer, but it is not a promotion decision. Any candidate must be source-baked and pass a fresh certified eval.",
  configurationAxes: [
    "ordered_knob_sequence", "training_method", "probe_layout", "probe_range_scale",
    "proposal_range_scale", "proposal_count",
  ],
  evaluationProtocol: {
    runner: state.evaluation.runner,
    sourceScope: state.evaluation.sourceScope,
    budgets: state.evaluation.budgets,
    seedBase: state.evaluation.seedBase,
    seedsPerBudget: state.evaluation.seedsPerBudget,
    jobs: state.evaluation.jobs,
  },
  baseline: state.baseline,
  arms: state.arms.map((arm) => ({
    variantId: arm.variantId,
    configuration: arm.configuration,
    environment: arm.environment,
    snapshot: arm.snapshot,
    archive: arm.archive,
  })),
  pairedV2Report: report,
};
writeFileAtomicDurable(reportPath, `${JSON.stringify(result, null, 2)}\n`);
state.report = relativeToCwd(reportPath);
state.updatedAt = new Date().toISOString();
writeState(state);
console.log(JSON.stringify({
  schema: SCHEMA,
  name,
  selectedConfigurations: state.arms.length,
  seedBase: state.evaluation.seedBase,
  seedsPerBudget: state.evaluation.seedsPerBudget,
  budgets: state.evaluation.budgets,
  report: state.report,
  ranking: report.ranking.map((row) => ({
    variantId: row.variantId,
    headline: row.headline,
    delta: row.delta,
    standardError: row.standardError,
    scoreIdenticalFraction: row.scoreIdenticalFraction,
  })),
}, null, 2));

function validateArguments(): void {
  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) {
    throw new Error(`--name must match [a-z0-9][a-z0-9_-]{0,63}`);
  }
  if (!Number.isInteger(maxKnobs) || maxKnobs < 1) {
    throw new Error(`--max-knobs must be a positive integer`);
  }
  if (!Number.isInteger(seeds) || seeds < 2 || seeds > 64) {
    throw new Error(`--seeds must be an integer from 2 through 64`);
  }
  if (!isSupportedEvaluationBudgetLadder(evaluationBudgets)) {
    throw new Error(
      `--evaluation-budgets must be either ${DEFAULT_EVALUATION_BUDGETS.join(",")} ` +
      `or ${CANONICAL_EVALUATION_BUDGETS.join(",")}`,
    );
  }
  if (!Number.isInteger(jobs) || jobs < 1) throw new Error(`--jobs must be a positive integer`);
  for (const knob of knobs) getArcKnob(knob);
  for (const sequence of sequences ?? []) for (const knob of sequence) getArcKnob(knob);
  const known = new Set([
    "name", "knobs", "sequences", "max-knobs", "methods", "probe-layouts", "probe-range-scales",
    "proposal-range-scales", "proposal-counts", "configurations", "evaluation-budgets", "seeds", "jobs", "out-dir",
  ]);
  for (const value of argv.filter((entry) => entry.startsWith("--"))) {
    const key = value.slice(2).split("=", 1)[0];
    if (key !== "dry-run" && key !== "allow-repeated" && key !== "resume" && !known.has(key)) {
      throw new Error(`unknown arc-control matrix option ${value}`);
    }
  }
}

function positiveNumberList(name: string, fallback: number): number[] {
  const raw = argument(name) ?? String(fallback);
  const values = raw.split(",").map((value) => Number(value.trim()));
  if (values.length === 0 || values.some((value) => !Number.isFinite(value) || value <= 0)) {
    throw new Error(`--${name} must be a comma-separated list of positive numbers`);
  }
  return values;
}

function positiveIntegerList(name: string, fallback: readonly number[]): number[] {
  const raw = argument(name) ?? fallback.join(",");
  const values = raw.split(",").map((value) => Number(value.trim()));
  if (
    values.length === 0 ||
    values.some((value) => !Number.isSafeInteger(value) || value < 1) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(`--${name} must be a comma-separated list of distinct positive integers`);
  }
  return values;
}

function sameBudgetLadder(left: readonly number[], right: readonly number[]): boolean {
  return left.length === right.length && left.every((budget, index) => budget === right[index]);
}

function isSupportedEvaluationBudgetLadder(budgets: readonly number[]): boolean {
  return sameBudgetLadder(budgets, DEFAULT_EVALUATION_BUDGETS) ||
    sameBudgetLadder(budgets, CANONICAL_EVALUATION_BUDGETS);
}

function selectConfigurations(
  candidates: readonly ArcControlConfiguration[],
  requested: readonly string[] | undefined,
): ArcControlConfiguration[] {
  if (requested === undefined) return [...candidates];
  const byId = new Map(candidates.map((configuration) => [configuration.id, configuration]));
  const selected = requested.map((id) => {
    const configuration = byId.get(id);
    if (configuration === undefined) throw new Error(`unknown --configurations entry ${id}`);
    return configuration;
  });
  if (new Set(selected.map((configuration) => configuration.id)).size !== selected.length) {
    throw new Error(`--configurations contains a duplicate`);
  }
  return selected;
}

function loadOrInitializeState(): MatrixState {
  if (!existsSync(statePath)) {
    mkdirSync(outputRoot, { recursive: true });
    const baseline = readBaselineContract();
    const state: MatrixState = {
      schema: SCHEMA,
      authority: "exploration-only",
      statement:
        "Compiler controls are enumerated independently from one fixed official V2 probe evaluation protocol.",
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      evaluation: {
        runner: "benchmark-v2 development/probe",
        sourceScope: "official-development-suite",
        budgets: [...evaluationBudgets],
        seedBase: null,
        seedsPerBudget: seeds,
        jobs,
      },
      baseline: { label: baseline.label, snapshot: baseline.compilerSnapshot, archive: null },
      arms: configurations.map((configuration, index) => ({
        variantId: `c${String(index + 1).padStart(3, "0")}`,
        configuration,
        environment: environmentFor(configuration),
        snapshot: captureConfigurationSnapshot(configuration, index),
        archive: null,
      })),
      report: null,
    };
    writeState(state);
    return state;
  }
  if (!resume) {
    throw new Error(`matrix state already exists at ${relativeToCwd(statePath)}; pass --resume to reuse it`);
  }
  const state = JSON.parse(readFileSync(statePath, "utf8")) as MatrixState;
  if (state.schema !== SCHEMA || state.name !== name || state.authority !== "exploration-only") {
    throw new Error(`unsupported matrix state at ${relativeToCwd(statePath)}`);
  }
  if (
    state.evaluation.seedsPerBudget !== seeds || state.evaluation.jobs !== jobs ||
    !sameBudgetLadder(state.evaluation.budgets, evaluationBudgets)
  ) {
    throw new Error(`matrix state has a different frozen evaluation protocol`);
  }
  const expected = configurations.map((configuration) => configuration.id);
  const actual = state.arms.map((arm) => arm.configuration.id);
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`matrix state has a different frozen compiler configuration list`);
  }
  validateCompilerSnapshot(state.baseline.snapshot);
  for (const arm of state.arms) {
    validateCompilerSnapshot(arm.snapshot);
    if (!sameEnvironment(arm.environment, environmentFor(arm.configuration))) {
      throw new Error(`matrix arm ${arm.variantId} environment does not match its configuration`);
    }
  }
  return state;
}

function environmentFor(configuration: ArcControlConfiguration): Record<string, string> {
  const isSourceDefault =
    configuration.trainingMethod === ARC_CONTROL_DEFAULT.trainingMethod &&
    configuration.probeLayout === ARC_CONTROL_DEFAULT.probeLayout &&
    configuration.probeRangeScale === ARC_CONTROL_DEFAULT.probeRangeScale &&
    configuration.proposalRangeScale === ARC_CONTROL_DEFAULT.proposalRangeScale &&
    configuration.proposalCount === ARC_CONTROL_DEFAULT.proposalCount &&
    configuration.sequence.join("\0") === ARC_CONTROL_DEFAULT.sequence.join("\0");
  if (isSourceDefault) return {};
  return {
    LR_AIM_KNOB_SEQUENCE: configuration.sequence.join(","),
    LR_AIM_TRAINING_METHOD: configuration.trainingMethod,
    LR_AIM_PROBE_LAYOUT: configuration.probeLayout,
    LR_AIM_PROBE_RANGE_SCALE: String(configuration.probeRangeScale),
    LR_AIM_PROPOSAL_RANGE_SCALE: String(configuration.proposalRangeScale),
    LR_AIM_PROPOSAL_COUNT: String(configuration.proposalCount),
  };
}

function captureConfigurationSnapshot(configuration: ArcControlConfiguration, index: number): CompilerSnapshot {
  const environment = environmentFor(configuration);
  const before = compilerCandidateIdentity("wasm");
  const snapshot = withExactCompilerEnvironment(environment, () => createCompilerSnapshot(
    `${name}-c${String(index + 1).padStart(3, "0")}`,
    resolve(outputRoot, "snapshots"),
  ));
  const after = compilerCandidateIdentity("wasm");
  if (before.candidateFingerprint !== after.candidateFingerprint) {
    throw new Error(`compiler changed while capturing ${configuration.id}`);
  }
  if (!sameEnvironment(snapshot.compilerEnvironment, environment)) {
    throw new Error(`snapshot environment mismatch for ${configuration.id}`);
  }
  return snapshot;
}

function withExactCompilerEnvironment<T>(environment: Record<string, string>, run: () => T): T {
  const saved = Object.entries(process.env).filter(([key]) => key.startsWith("LR_"));
  for (const key of Object.keys(process.env)) if (key.startsWith("LR_")) delete process.env[key];
  Object.assign(process.env, environment);
  try {
    return run();
  } finally {
    for (const key of Object.keys(process.env)) if (key.startsWith("LR_")) delete process.env[key];
    for (const [key, value] of saved) process.env[key] = value;
  }
}

function runOrReuseArm(snapshot: CompilerSnapshot, expectedCandidateFingerprint: string, outputPath: string): {
  archive: string;
  archiveSha256: string;
  compressedArchiveSha256: string;
  candidateFingerprint: string;
  headline: number;
} {
  if (!existsSync(outputPath)) {
    const run = runSnapshotBenchmark(snapshot, "development", [
      "--profile=probe",
      "--exploration",
      `--exploration-id=arc-control-matrix/${name}`,
      `--exploration-seed-base=${state.evaluation.seedBase!}`,
      `--exploration-seeds-per-budget=${state.evaluation.seedsPerBudget}`,
      ...(sameBudgetLadder(state.evaluation.budgets, CANONICAL_EVALUATION_BUDGETS)
        ? [`--exploration-budgets=${state.evaluation.budgets.join(",")}`]
        : []),
      `--jobs=${state.evaluation.jobs}`,
      ...(existsSync(`${outputPath}.checkpoint.jsonl`) ? ["--resume"] : []),
    ], outputPath);
    if (run.workerFailures > 0) throw new Error(`V2 exploration arm failed at ${relativeToCwd(outputPath)}`);
  }
  const verified = loadVerifiedArchive(outputPath);
  const archive = verified.archive;
  const compressedPath = `${outputPath}.gz`;
  const summaryPath = `${outputPath}.summary.json`;
  if (!existsSync(compressedPath) || !existsSync(summaryPath)) {
    throw new Error(`incomplete V2 archive at ${relativeToCwd(outputPath)}`);
  }
  const summary = JSON.parse(readFileSync(summaryPath, "utf8"));
  if (
    archive.mode !== "development" || archive.profile !== "probe" ||
    archive.exploration?.authority !== "exploration-only" ||
    archive.exploration?.id !== `arc-control-matrix/${name}` ||
    archive.exploration?.seedBase !== state.evaluation.seedBase ||
    archive.exploration?.seedsPerBudget !== state.evaluation.seedsPerBudget ||
    !sameBudgetLadder(archive.identity?.budgets ?? [], state.evaluation.budgets) ||
    archive.git?.candidateFingerprint !== expectedCandidateFingerprint ||
    !Number.isFinite(archive.canonicalHeadline) ||
    summary.archiveSha256 !== verified.archiveSha256
  ) throw new Error(`V2 archive does not match its frozen arc-control arm at ${relativeToCwd(outputPath)}`);
  return {
    archive: outputPath,
    archiveSha256: verified.archiveSha256,
    compressedArchiveSha256: summary.compressedArchiveSha256,
    candidateFingerprint: expectedCandidateFingerprint,
    headline: archive.canonicalHeadline,
  };
}

function matrixAsFamily(
  state: MatrixState,
  baseline: ReturnType<typeof runOrReuseArm>,
): BenchmarkFamily {
  const contract = readBaselineContract();
  return {
    schema: FAMILY_SCHEMA,
    protocol: FAMILY_PROTOCOL,
    name: `matrix-${name}`,
    createdAt: state.createdAt,
    baseline: {
      label: state.baseline.label,
      suiteFingerprint: contract.suiteFingerprint,
      candidateFingerprint: contract.candidateFingerprint,
      inferenceFingerprint: contract.inferenceFingerprint,
      protocolFingerprint: contract.protocolFingerprint,
      calibrationFingerprint: contract.calibrationFingerprint,
      snapshot: state.baseline.snapshot,
    },
    rounds: [matrixAsRound(state, baseline)],
  };
}

function matrixAsRound(state: MatrixState, baseline: ReturnType<typeof runOrReuseArm>): FamilyRound {
  const variants = state.arms.map((arm) => ({
    id: arm.variantId,
    capturedAt: state.createdAt,
    note: arm.configuration.id,
    candidateFingerprint: arm.snapshot.candidateFingerprint,
    snapshot: arm.snapshot,
    carriedFromRound: null,
  }));
  return {
    number: 1,
    status: "completed",
    createdAt: state.createdAt,
    frozenAt: state.createdAt,
    variants,
    seedBase: state.evaluation.seedBase,
    seedsPerBudget: state.evaluation.seedsPerBudget,
    baselineRun: {
      archive: relativeToCwd(baseline.archive),
      archiveSha256: baseline.archiveSha256,
      compressedArchiveSha256: baseline.compressedArchiveSha256,
      candidateFingerprint: baseline.candidateFingerprint,
      headline: baseline.headline,
    },
    variantRuns: Object.fromEntries(state.arms.map((arm) => {
      if (arm.archive === null) throw new Error(`matrix arm ${arm.variantId} is missing an archive`);
      const archive = loadVerifiedArchive(resolve(arm.archive));
      const summary = JSON.parse(readFileSync(`${resolve(arm.archive)}.summary.json`, "utf8"));
      return [arm.variantId, {
        archive: arm.archive,
        archiveSha256: archive.archiveSha256,
        compressedArchiveSha256: summary.compressedArchiveSha256,
        candidateFingerprint: arm.snapshot.candidateFingerprint,
        headline: archive.archive.canonicalHeadline,
      }];
    })),
    reportPath: null,
    observedChampionId: null,
    selectedVariantId: null,
    selectedAt: null,
    selectionReason: null,
  };
}

function writeState(state: MatrixState): void {
  mkdirSync(dirname(statePath), { recursive: true });
  writeFileAtomicDurable(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function sameEnvironment(left: Record<string, string>, right: Record<string, string>): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
