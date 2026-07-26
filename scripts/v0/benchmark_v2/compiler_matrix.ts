/**
 * Generic Benchmark V2 exploration runner for a declarative COMPILER
 * configuration matrix.
 *
 * This is the orchestration that `arc_control_matrix.ts` grew and that every
 * later sweep wants verbatim: enumerate a configuration product, map each cell
 * to a compiler environment, snapshot it, evaluate every cell and the baseline
 * on ONE shared fresh exploration seed epoch, and emit a paired report. None of
 * that is specific to arc knobs, so none of it is duplicated per sweep.
 *
 * What a caller supplies is only its axis set:
 *
 *   - the enumerated configurations, each with a stable readable id;
 *   - `environmentFor`, which must return `{}` for the SOURCE DEFAULT so the
 *     baseline arm is the production compiler rather than a re-encoding of it;
 *   - its own CLI flags and their names.
 *
 * Properties this runner is responsible for keeping, all of which were load
 * bearing in the arc-control sweeps:
 *
 *   - `--dry-run` prints the full enumeration and cell count having paid
 *     nothing, so the size of an experiment is known before it is bought;
 *   - every arm shares one seed epoch, so comparisons are paired;
 *   - `authority: "exploration-only"` — a matrix can never promote a cell.
 *     Promotion is source-baked plus a fresh certified eval;
 *   - state is resumable and its evaluation protocol and configuration list are
 *     frozen on resume;
 *   - the report carries `scoreIdenticalFraction`, which is what catches a cell
 *     that changed nothing.
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
import { writeFileAtomicDurable } from "./durable_fs.ts";

const SHARED_SEED_LEDGER_ROOT = "generated/benchmark-v2/families";
export const DEFAULT_EVALUATION_BUDGETS = [250_000, 500_000] as const;
export const CANONICAL_EVALUATION_BUDGETS = [250_000, 500_000, 750_000] as const;

/** One matrix's axis set. `C` is the caller's configuration shape; it is stored
 *  verbatim in the state file and the report. */
export type CompilerMatrixSpec<C> = {
  /** Stable schema string for this matrix's state and report. Changing it
   *  invalidates existing state, so treat it as a version. */
  schema: string;
  /** Human-readable axis names, recorded in the report. */
  configurationAxes: readonly string[];
  /** Output root for this matrix family, e.g.
   *  `generated/benchmark-v2/objective-power-matrices`. */
  defaultOutputRoot: string;
  /** Prefix for the shared exploration-seed ledger entry and the archive's
   *  exploration id, e.g. `objective-power-matrix`. */
  explorationPrefix: string;
  /** Every cell, already enumerated by the caller. */
  configurations: readonly C[];
  idOf: (configuration: C) => string;
  /** MUST return `{}` for the source default. */
  environmentFor: (configuration: C) => Record<string, string>;
  /** `--name=value` option names this caller accepts, beyond the protocol ones. */
  knownArguments: readonly string[];
  /** Bare `--flag` names this caller accepts, beyond `--dry-run`/`--resume`. */
  knownFlags?: readonly string[];
  /** Extra fields to include in the `--dry-run` payload. */
  dryRunExtras?: Record<string, unknown>;
};

type MatrixArm<C> = {
  variantId: string;
  configuration: C;
  environment: Record<string, string>;
  snapshot: CompilerSnapshot;
  archive: string | null;
};

type MatrixState<C> = {
  schema: string;
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
  arms: MatrixArm<C>[];
  report: string | null;
};

const PROTOCOL_ARGUMENTS = [
  "name",
  "configurations",
  "evaluation-budgets",
  "seeds",
  "jobs",
  "out-dir",
] as const;
const PROTOCOL_FLAGS = ["dry-run", "resume"] as const;

export function matrixArgument(name: string): string | undefined {
  return process.argv.slice(2)
    .find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

export function positiveNumberList(name: string, fallback: number): number[] {
  const raw = matrixArgument(name) ?? String(fallback);
  const values = raw.split(",").map((value) => Number(value.trim()));
  if (
    values.length === 0 ||
    values.some((value) => !Number.isFinite(value) || value <= 0)
  ) {
    throw new Error(
      `--${name} must be a comma-separated list of positive numbers`,
    );
  }
  return values;
}

function positiveIntegerList(name: string, fallback: readonly number[]): number[] {
  const raw = matrixArgument(name) ?? fallback.join(",");
  const values = raw.split(",").map((value) => Number(value.trim()));
  if (
    values.length === 0 ||
    values.some((value) => !Number.isSafeInteger(value) || value < 1) ||
    new Set(values).size !== values.length
  ) {
    throw new Error(
      `--${name} must be a comma-separated list of distinct positive integers`,
    );
  }
  return values;
}

function sameBudgetLadder(
  left: readonly number[],
  right: readonly number[],
): boolean {
  return left.length === right.length &&
    left.every((budget, index) => budget === right[index]);
}

function isSupportedEvaluationBudgetLadder(budgets: readonly number[]): boolean {
  return sameBudgetLadder(budgets, DEFAULT_EVALUATION_BUDGETS) ||
    sameBudgetLadder(budgets, CANONICAL_EVALUATION_BUDGETS);
}

function sameEnvironment(
  left: Record<string, string>,
  right: Record<string, string>,
): boolean {
  const leftEntries = Object.entries(left).sort(([a], [b]) => a.localeCompare(b));
  const rightEntries = Object.entries(right).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(leftEntries) === JSON.stringify(rightEntries);
}

function relativeToCwd(path: string): string {
  const prefix = `${process.cwd()}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}

/**
 * Run every LR_* variable this matrix sets and nothing else, so a snapshot can
 * never inherit an unrelated flag from the invoking shell.
 */
function withExactCompilerEnvironment<T>(
  environment: Record<string, string>,
  run: () => T,
): T {
  const saved = Object.entries(process.env).filter(([key]) =>
    key.startsWith("LR_")
  );
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("LR_")) delete process.env[key];
  }
  Object.assign(process.env, environment);
  try {
    return run();
  } finally {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("LR_")) delete process.env[key];
    }
    for (const [key, value] of saved) process.env[key] = value;
  }
}

export async function runCompilerConfigurationMatrix<C>(
  spec: CompilerMatrixSpec<C>,
): Promise<void> {
  const argv = process.argv.slice(2);
  const name = matrixArgument("name") ?? spec.explorationPrefix;
  const configurationFilter = matrixArgument("configurations")
    ?.split(",").map((value) => value.trim()).filter(Boolean);
  const evaluationBudgets = positiveIntegerList(
    "evaluation-budgets",
    DEFAULT_EVALUATION_BUDGETS,
  );
  const seeds = Number(matrixArgument("seeds") ?? "6");
  const jobs = Number(
    matrixArgument("jobs") ?? String(Math.min(48, availableParallelism())),
  );
  const outputRoot = resolve(
    matrixArgument("out-dir") ?? spec.defaultOutputRoot,
    name,
  );
  const dryRun = argv.includes("--dry-run");
  const resume = argv.includes("--resume");

  if (!/^[a-z0-9][a-z0-9_-]{0,63}$/.test(name)) {
    throw new Error(`--name must match [a-z0-9][a-z0-9_-]{0,63}`);
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
  if (!Number.isInteger(jobs) || jobs < 1) {
    throw new Error(`--jobs must be a positive integer`);
  }
  const known = new Set([...PROTOCOL_ARGUMENTS, ...spec.knownArguments]);
  const flags = new Set<string>([...PROTOCOL_FLAGS, ...(spec.knownFlags ?? [])]);
  for (const value of argv.filter((entry) => entry.startsWith("--"))) {
    const key = value.slice(2).split("=", 1)[0];
    if (!flags.has(key) && !known.has(key)) {
      throw new Error(`unknown ${spec.explorationPrefix} option ${value}`);
    }
  }

  const configurations = selectConfigurations(
    spec.configurations,
    spec.idOf,
    configurationFilter,
  );
  if (configurations.length === 0) {
    throw new Error(`${spec.explorationPrefix} enumerated no configurations`);
  }

  if (dryRun) {
    console.log(JSON.stringify({
      schema: spec.schema,
      authority: "exploration-only",
      configurationAxes: spec.configurationAxes,
      evaluationProtocol: {
        runner: "official Benchmark V2 development/probe runner",
        budgets: evaluationBudgets,
        seedsPerBudget: seeds,
        sharedFreshSeedEpoch: true,
      },
      ...(spec.dryRunExtras ?? {}),
      configurations: spec.configurations,
      selectedConfigurations: configurations.map(spec.idOf),
      selectedCount: configurations.length,
      /* The number that decides whether this experiment is affordable. The two
       * recorded arc-control sweeps price at ~0.012 h per arm-seed at two
       * budgets and 48 jobs. */
      armSeedProduct: configurations.length * seeds,
    }, null, 2));
    return;
  }

  const statePath = resolve(outputRoot, "matrix.json");
  const baselineContract = readBaselineContract();
  const state = loadOrInitializeState();
  const epoch = await allocateExplorationSeedEpoch(
    SHARED_SEED_LEDGER_ROOT,
    `${spec.explorationPrefix}-${name}`,
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
    schema: spec.schema,
    authority: "exploration-only" as const,
    statement:
      "This is a shared-seed descriptive configuration screen. It runs the actual compiler and official V2 development/probe scorer, but it is not a promotion decision. Any candidate must be source-baked and pass a fresh certified eval.",
    configurationAxes: spec.configurationAxes,
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
    schema: spec.schema,
    name,
    selectedConfigurations: state.arms.length,
    seedBase: state.evaluation.seedBase,
    seedsPerBudget: state.evaluation.seedsPerBudget,
    budgets: state.evaluation.budgets,
    report: state.report,
    ranking: report.ranking.map((row) => ({
      variantId: row.variantId,
      configuration: state.arms.find((arm) => arm.variantId === row.variantId)
        ?.configuration,
      headline: row.headline,
      delta: row.delta,
      standardError: row.standardError,
      scoreIdenticalFraction: row.scoreIdenticalFraction,
    })),
  }, null, 2));

  function selectConfigurations(
    candidates: readonly C[],
    idOf: (configuration: C) => string,
    requested: readonly string[] | undefined,
  ): C[] {
    if (requested === undefined) return [...candidates];
    const byId = new Map(candidates.map((configuration) => [idOf(configuration), configuration]));
    const selected = requested.map((id) => {
      const configuration = byId.get(id);
      if (configuration === undefined) {
        throw new Error(`unknown --configurations entry ${id}`);
      }
      return configuration;
    });
    if (new Set(selected.map(idOf)).size !== selected.length) {
      throw new Error(`--configurations contains a duplicate`);
    }
    return selected;
  }

  function loadOrInitializeState(): MatrixState<C> {
    if (!existsSync(statePath)) {
      mkdirSync(outputRoot, { recursive: true });
      const baseline = readBaselineContract();
      const created: MatrixState<C> = {
        schema: spec.schema,
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
        baseline: {
          label: baseline.label,
          snapshot: baseline.compilerSnapshot,
          archive: null,
        },
        arms: configurations.map((configuration, index) => ({
          variantId: `c${String(index + 1).padStart(3, "0")}`,
          configuration,
          environment: spec.environmentFor(configuration),
          snapshot: captureConfigurationSnapshot(configuration, index),
          archive: null,
        })),
        report: null,
      };
      writeState(created);
      return created;
    }
    if (!resume) {
      throw new Error(
        `matrix state already exists at ${relativeToCwd(statePath)}; pass --resume to reuse it`,
      );
    }
    const loaded = JSON.parse(readFileSync(statePath, "utf8")) as MatrixState<C>;
    if (
      loaded.schema !== spec.schema || loaded.name !== name ||
      loaded.authority !== "exploration-only"
    ) {
      throw new Error(`unsupported matrix state at ${relativeToCwd(statePath)}`);
    }
    if (
      loaded.evaluation.seedsPerBudget !== seeds || loaded.evaluation.jobs !== jobs ||
      !sameBudgetLadder(loaded.evaluation.budgets, evaluationBudgets)
    ) {
      throw new Error(`matrix state has a different frozen evaluation protocol`);
    }
    const expected = configurations.map(spec.idOf);
    const actual = loaded.arms.map((arm) => spec.idOf(arm.configuration));
    if (JSON.stringify(actual) !== JSON.stringify(expected)) {
      throw new Error(`matrix state has a different frozen compiler configuration list`);
    }
    validateCompilerSnapshot(loaded.baseline.snapshot);
    for (const arm of loaded.arms) {
      validateCompilerSnapshot(arm.snapshot);
      if (!sameEnvironment(arm.environment, spec.environmentFor(arm.configuration))) {
        throw new Error(
          `matrix arm ${arm.variantId} environment does not match its configuration`,
        );
      }
    }
    return loaded;
  }

  function captureConfigurationSnapshot(
    configuration: C,
    index: number,
  ): CompilerSnapshot {
    const environment = spec.environmentFor(configuration);
    const before = compilerCandidateIdentity("wasm");
    const snapshot = withExactCompilerEnvironment(
      environment,
      () =>
        createCompilerSnapshot(
          `${name}-c${String(index + 1).padStart(3, "0")}`,
          resolve(outputRoot, "snapshots"),
        ),
    );
    const after = compilerCandidateIdentity("wasm");
    if (before.candidateFingerprint !== after.candidateFingerprint) {
      throw new Error(`compiler changed while capturing ${spec.idOf(configuration)}`);
    }
    if (!sameEnvironment(snapshot.compilerEnvironment, environment)) {
      throw new Error(`snapshot environment mismatch for ${spec.idOf(configuration)}`);
    }
    return snapshot;
  }

  function runOrReuseArm(
    snapshot: CompilerSnapshot,
    expectedCandidateFingerprint: string,
    outputPath: string,
  ): {
    archive: string;
    archiveSha256: string;
    compressedArchiveSha256: string;
    candidateFingerprint: string;
    headline: number;
  } {
    const explorationId = `${spec.explorationPrefix}/${name}`;
    if (!existsSync(outputPath)) {
      const run = runSnapshotBenchmark(snapshot, "development", [
        "--profile=probe",
        "--exploration",
        `--exploration-id=${explorationId}`,
        `--exploration-seed-base=${state.evaluation.seedBase!}`,
        `--exploration-seeds-per-budget=${state.evaluation.seedsPerBudget}`,
        ...(sameBudgetLadder(state.evaluation.budgets, CANONICAL_EVALUATION_BUDGETS)
          ? [`--exploration-budgets=${state.evaluation.budgets.join(",")}`]
          : []),
        `--jobs=${state.evaluation.jobs}`,
        ...(existsSync(`${outputPath}.checkpoint.jsonl`) ? ["--resume"] : []),
      ], outputPath);
      if (run.workerFailures > 0) {
        throw new Error(`V2 exploration arm failed at ${relativeToCwd(outputPath)}`);
      }
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
      archive.exploration?.id !== explorationId ||
      archive.exploration?.seedBase !== state.evaluation.seedBase ||
      archive.exploration?.seedsPerBudget !== state.evaluation.seedsPerBudget ||
      !sameBudgetLadder(archive.identity?.budgets ?? [], state.evaluation.budgets) ||
      archive.git?.candidateFingerprint !== expectedCandidateFingerprint ||
      !Number.isFinite(archive.canonicalHeadline) ||
      summary.archiveSha256 !== verified.archiveSha256
    ) {
      throw new Error(
        `V2 archive does not match its frozen matrix arm at ${relativeToCwd(outputPath)}`,
      );
    }
    return {
      archive: outputPath,
      archiveSha256: verified.archiveSha256,
      compressedArchiveSha256: summary.compressedArchiveSha256,
      candidateFingerprint: expectedCandidateFingerprint,
      headline: archive.canonicalHeadline,
    };
  }

  function matrixAsFamily(
    current: MatrixState<C>,
    baseline: ReturnType<typeof runOrReuseArm>,
  ): BenchmarkFamily {
    const contract = readBaselineContract();
    return {
      schema: FAMILY_SCHEMA,
      protocol: FAMILY_PROTOCOL,
      name: `matrix-${name}`,
      createdAt: current.createdAt,
      baseline: {
        label: current.baseline.label,
        suiteFingerprint: contract.suiteFingerprint,
        candidateFingerprint: contract.candidateFingerprint,
        inferenceFingerprint: contract.inferenceFingerprint,
        protocolFingerprint: contract.protocolFingerprint,
        calibrationFingerprint: contract.calibrationFingerprint,
        snapshot: current.baseline.snapshot,
      },
      rounds: [matrixAsRound(current, baseline)],
    };
  }

  function matrixAsRound(
    current: MatrixState<C>,
    baseline: ReturnType<typeof runOrReuseArm>,
  ): FamilyRound {
    const variants = current.arms.map((arm) => ({
      id: arm.variantId,
      capturedAt: current.createdAt,
      note: spec.idOf(arm.configuration),
      candidateFingerprint: arm.snapshot.candidateFingerprint,
      snapshot: arm.snapshot,
      carriedFromRound: null,
    }));
    return {
      number: 1,
      status: "completed",
      createdAt: current.createdAt,
      frozenAt: current.createdAt,
      variants,
      seedBase: current.evaluation.seedBase,
      seedsPerBudget: current.evaluation.seedsPerBudget,
      baselineRun: {
        archive: relativeToCwd(baseline.archive),
        archiveSha256: baseline.archiveSha256,
        compressedArchiveSha256: baseline.compressedArchiveSha256,
        candidateFingerprint: baseline.candidateFingerprint,
        headline: baseline.headline,
      },
      variantRuns: Object.fromEntries(current.arms.map((arm) => {
        if (arm.archive === null) {
          throw new Error(`matrix arm ${arm.variantId} is missing an archive`);
        }
        const armArchive = loadVerifiedArchive(resolve(arm.archive));
        const armSummary = JSON.parse(
          readFileSync(`${resolve(arm.archive)}.summary.json`, "utf8"),
        );
        return [arm.variantId, {
          archive: arm.archive,
          archiveSha256: armArchive.archiveSha256,
          compressedArchiveSha256: armSummary.compressedArchiveSha256,
          candidateFingerprint: arm.snapshot.candidateFingerprint,
          headline: armArchive.archive.canonicalHeadline,
        }];
      })),
      reportPath: null,
      observedChampionId: null,
      selectedVariantId: null,
      selectedAt: null,
      selectionReason: null,
    };
  }

  function writeState(next: MatrixState<C>): void {
    mkdirSync(dirname(statePath), { recursive: true });
    writeFileAtomicDurable(statePath, `${JSON.stringify(next, null, 2)}\n`);
  }
}
