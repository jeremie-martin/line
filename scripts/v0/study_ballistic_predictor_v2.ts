/**
 * Frozen Benchmark V2 ballistic-predictor corpus and offline evaluator.
 *
 * This study deliberately uses the current V2 catalog, current compiler, current
 * production jolt, and canonical seed ladder. It does not read historical study
 * artifacts. During one explicit collection run it observes the real predictor
 * call sites and, for a deterministic bounded sample of those calls:
 *
 *   1. saves the exact one-to-four pre-target airborne states production read;
 *   2. simulates benchmark-only truth on the discarded candidate fork;
 *   3. records all ten rider points and collision witnesses;
 *   4. freezes that corpus for all later model iterations.
 *
 * The current predictor reads the ten physical rider points and their Verlet
 * previous positions at the already-simulated launch frame, then runs only the
 * collision-free rider constraints. It does not read future engine state.
 *
 * Offline benchmark:
 *   npm run benchmark:ballistic
 *
 * One-time corpus collection:
 *   npm run benchmark:ballistic:collect
 *
 * Collection is deliberately fixed to all current V2 cases, 250k, and the
 * first three canonical seeds. Normal model iteration only reads the frozen
 * corpus; it does not compile tracks or simulate new truth.
 */

import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, gunzipSync } from "node:zlib";
import { ELEVATION } from "./types.ts";
import { BALLISTIC_POINT_IDS } from "./core/ballistic_micro_sim.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  ballisticTraceCollisionFreeThrough,
  type BallisticTraceCandidate,
  type BallisticTraceObservation,
  type BallisticTraceSample,
  type BallisticTraceTruthSample,
  setBallisticTraceSink,
} from "./core/ballistic_trace.ts";
import {
  constraintBallisticStateFromSamples,
} from "./core/ballistic_micro_sim.ts";
import {
  ballisticArticulationFeatures,
  propagateBallisticState,
  type BallisticState,
} from "./core/ballistic_projection.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { canonicalMembers, loadSuiteManifest } from "./benchmark_v2/suite_model.ts";
import { compileHandoff } from "./optimizer/handoff.ts";

type Sample = BallisticTraceSample;
type TruthTarget = "precontact" | "contact";
type PredictorInput = {
  /** The one exact causal anchor packet available to production. */
  anchor: Sample;
  targetFrame: number;
  constraintState: ReturnType<typeof constraintBallisticStateFromSamples>;
};
type Predictor = {
  name: string;
  predict: (input: PredictorInput) => BallisticState;
};
type CorpusObservation = BallisticTraceObservation & {
  sourceId: string;
  seed: number;
  budget: number;
};
type BallisticCorpus = {
  schema: "line.ballistic-predictor-corpus.v8";
  generatedAt: string;
  compiler: string;
  compilerFingerprint: string;
  protocol: {
    canonical: boolean;
    cases: "all-current-v2" | string[];
    budget: number;
    seeds: number[];
    sampleCapPerCaseSeed: number;
    populations: BallisticTraceObservation["population"][];
    compilerPredictor: "current";
  };
  cases: string[];
  joltMs: number;
  observations: number;
  shards: {
    sourceId: string;
    seed: number;
    path: string;
    observations: number;
    seen: number;
    unreadable: number;
    captureErrors: number;
    elapsedMs: number;
  }[];
};
type ErrorSummary = {
  rows: number;
  xMae: number;
  yMae: number;
  positionMae: number;
  vxMae: number;
  vyMae: number;
  velocityMae: number;
  speedMae: number;
  angleMaeDeg: number;
  sledPoseMaeDeg: number;
  sledPoseRateMaeDegPerFrame: number;
  articulationMae: number;
  bindingMismatchRate: number;
};
/** `spread` is the standard deviation of each metric ACROSS case-seed groups,
 *  not across rows: it answers "does this model fail evenly, or fall apart on
 *  particular cases", which is the question a mean cannot answer. */
type MacroErrorSummary = ErrorSummary & {
  groups: number;
  spread: Pick<
    ErrorSummary,
    "positionMae" | "velocityMae" | "speedMae" | "angleMaeDeg"
  >;
};
type ErrorTotals = {
  rows: number;
  x: number;
  y: number;
  position: number;
  vx: number;
  vy: number;
  velocity: number;
  speed: number;
  angle: number;
  sledPose: number;
  sledPoseRate: number;
  articulation: number;
  bindingMismatch: number;
};
type ReservoirEntry = {
  priority: number;
  ordinal: number;
  observation: CorpusObservation;
};
type CollectedCaseSeed = {
  sourceId: string;
  seed: number;
  seen: number;
  unreadable: number;
  captureErrors: number;
  elapsedMs: number;
  observations: CorpusObservation[];
};
type CollectionTaskResult = Omit<CollectedCaseSeed, "observations"> & {
  observations: number;
  populations: Record<string, number>;
};
type CollectionTask = {
  sourceId: string;
  seed: number;
  relativePath: string;
};

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const BALLISTIC_BENCHMARK_BUDGET = 250_000;
const BALLISTIC_BENCHMARK_SEEDS = [735_656_107, 735_656_108, 735_656_109] as const;
/** 1,536 × 44 cases × 3 seeds = at most 202,752 frozen real call-site rows. */
const BALLISTIC_SAMPLE_CAP_PER_CASE_SEED = 1_536;
const BALLISTIC_COLLECTION_JOBS = 48;
const BALLISTIC_POPULATIONS = ["candidate_pool", "aim_probe"] as const;
/* Declared here, not beside measureTiming: the corpus evaluation runs at module
 * top level, so the sample buffer must be initialized before it. */
const TIMING_SAMPLE_CAP = 2_048;
const TIMING_BLOCKS = 12;
const timingSample: PredictorInput[] = [];

const CURRENT_PREDICTOR = {
  name: "current",
  predict: predictCurrent,
} as const satisfies Predictor;
/*
 * The SCALE the scores are expressed in, not a competitor.
 *
 * Normalizing each component by the current model was fine while the current
 * model had error. It is exact now, so that denominator is zero and every
 * alternative scores Infinity - the score cannot rank anything. The fix is to
 * divide by something that belongs to the PROBLEM rather than to whichever
 * model happens to be installed: a predictor that does nothing at all, leaving
 * the rider exactly where it was at launch. Its error is how hard the
 * prediction is over these horizons, it is strictly positive, and it does not
 * move when the production model changes.
 *
 * So a score reads directly: 0 is exact, 1 is no better than not predicting.
 */
const REFERENCE_PREDICTOR = {
  name: "frozen_anchor",
  predict: predictFrozenAnchor,
} as const satisfies Predictor;
const REFERENCE_MODEL = REFERENCE_PREDICTOR.name;
/**
 * The only experiment switch. Return one named predictor while testing it;
 * return null between experiments.
 */
function configuredAlternative(): Predictor | null {
  return { name: "closed_form_system", predict: predictClosedFormSystem };
}
const ALTERNATIVE_PREDICTOR = configuredAlternative();
const CURRENT_MODEL = CURRENT_PREDICTOR.name;
const ALTERNATIVE_MODEL = ALTERNATIVE_PREDICTOR?.name ?? null;
const PREDICTORS: readonly Predictor[] = ALTERNATIVE_PREDICTOR === null
  ? [CURRENT_PREDICTOR, REFERENCE_PREDICTOR]
  : [CURRENT_PREDICTOR, ALTERNATIVE_PREDICTOR, REFERENCE_PREDICTOR];
rejectFixedProtocolOverride("seed");
rejectFixedProtocolOverride("seeds");
rejectFixedProtocolOverride("budget");
rejectFixedProtocolOverride("budgets");
const collect = argv.includes("--collect");
const outputPath = resolve(argValue("out") ?? "generated/analysis/ballistic-v2.json");
const corpusPath = resolve(
  argValue("corpus") ?? "generated/analysis/ballistic-v2-corpus",
);
const sourceManifestPath = resolve("benchmark/v2/compat/source-manifest.json");
const suiteManifestPath = resolve("benchmark/v2/compat/suite-manifest.json");
const sources = resolveSources(loadSourceManifest(sourceManifestPath));
const suite = loadSuiteManifest(suiteManifestPath, sources);
const casesArg = argValue("cases") ?? "all";
const sourceIds = casesArg === "all" ? canonicalMembers(suite) : list(casesArg);
const canonicalScope = casesArg === "all";
if (!collect && casesArg !== "all") {
  throw new Error(`--cases is a collection-only debugging option`);
}
if (collect && !canonicalScope && argValue("corpus") === undefined) {
  throw new Error(`a non-canonical collection requires an explicit --corpus path`);
}
if (collect && existsSync(corpusPath) && !argv.includes("--replace-corpus")) {
  throw new Error(
    `ballistic corpus already exists at ${relativeToCwd(corpusPath)}; ` +
      `normal iterations must reuse it (pass --replace-corpus only for an intentional reset)`,
  );
}
const selected = sourceIds.map((id) => {
  const source = sources.find((entry) => entry.id === id);
  if (source === undefined) throw new Error(`unknown development case ${id}`);
  return source;
});
const workerSourceId = argValue("_worker-source");
if (workerSourceId !== undefined) {
  const workerSeed = exactCanonicalSeed(argValue("_worker-seed"));
  const workerOutput = argValue("_worker-output");
  if (workerOutput === undefined) throw new Error(`ballistic worker output path is missing`);
  const result = await collectCaseSeed(workerSourceId, workerSeed);
  writeFileSync(
    resolve(workerOutput),
    gzipSync(JSON.stringify(result.observations)),
  );
  const workerResult: CollectionTaskResult = {
    sourceId: result.sourceId,
    seed: result.seed,
    seen: result.seen,
    unreadable: result.unreadable,
    captureErrors: result.captureErrors,
    elapsedMs: result.elapsedMs,
    observations: result.observations.length,
    populations: countBy(
      result.observations.map((observation) => observation.population),
    ),
  };
  // Worker stdout is a machine-only channel consumed by the parent.
  await new Promise<void>((resolveWrite, rejectWrite) => {
    process.stdout.write(JSON.stringify(workerResult), (error) => {
      if (error) rejectWrite(error);
      else resolveWrite();
    });
  });
  process.exit(0);
}
const corpus = collect ? await collectCorpus() : loadCorpus();
const reportCaseIds = corpus.cases;
const seeds = corpus.protocol.seeds;
const budgets = [corpus.protocol.budget];
const truthTargets: TruthTarget[] = ["precontact", "contact"];
const evaluation = evaluateCorpus(corpus);
const {
  modelNames,
  score,
  overall,
  macroByCase,
  perCase,
  byHorizon,
  byPopulation,
} = evaluation;
const perBudget = Object.fromEntries(
  budgets.map((budget) => [String(budget), overall]),
);
/* Timing replays the held sample AFTER evaluation, so it never perturbs the
 * accuracy pass and the JIT is warm for every predictor equally. */
const TIMING = measureTiming();
const report = {
  schema: "line.study-ballistic-predictor-v2.v9",
  generatedAt: new Date().toISOString(),
  compiler: corpus.compiler,
  compilerFingerprint: corpus.compilerFingerprint,
  evaluationCompilerFingerprint:
    compilerCandidateIdentity("wasm").candidateFingerprint,
  corpus: relativeToCwd(corpusPath),
  corpusGeneratedAt: corpus.generatedAt,
  protocol: corpus.protocol,
  cases: reportCaseIds,
  seeds,
  budgets,
  joltMs: corpus.joltMs,
  rows: corpus.observations * truthTargets.length,
  modelNames,
  score,
  overall,
  macroByCase,
  perCase,
  perBudget,
  byHorizon,
  byPopulation,
  // Reported beside the score, deliberately not inside it. See measureTiming.
  cost: TIMING,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
// Per-case macro summaries, so the printed spread is across the 44 cases.
printSummary(macroByCase as Record<TruthTarget, Record<string, ErrorSummary>>);
printTiming(TIMING);
console.log(`\nreport: ${relativeToCwd(outputPath)}`);

async function collectCorpus(): Promise<BallisticCorpus> {
  const budget = BALLISTIC_BENCHMARK_BUDGET;
  const compilerFingerprint = compilerCandidateIdentity("wasm").candidateFingerprint;
  const rawTasks = selected.flatMap((source) =>
    BALLISTIC_BENCHMARK_SEEDS.map((seed) => ({ sourceId: source.id, seed }))
  );
  mkdirSync(dirname(corpusPath), { recursive: true });
  const stagingPath = mkdtempSync(`${corpusPath}.tmp-`);
  const shardDirectory = resolve(stagingPath, "shards");
  mkdirSync(shardDirectory, { recursive: true });
  const tasks: CollectionTask[] = rawTasks.map((task, index) => ({
    ...task,
    relativePath:
      `shards/${String(index).padStart(3, "0")}-${safeFilename(task.sourceId)}-s${task.seed}.json.gz`,
  }));
  const shards = new Array<BallisticCorpus["shards"][number]>(tasks.length);
  console.error(
    `collecting ${tasks.length} case/seed shards with ${Math.min(BALLISTIC_COLLECTION_JOBS, tasks.length)} workers`,
  );
  try {
    await parallelCollectionTasks(tasks, stagingPath, (result, index) => {
      const task = tasks[index];
      if (result.sourceId !== task.sourceId || result.seed !== task.seed) {
        throw new Error(`ballistic worker returned mismatched shard metadata`);
      }
      if (!existsSync(resolve(stagingPath, task.relativePath))) {
        throw new Error(`ballistic worker did not write ${task.relativePath}`);
      }
      shards[index] = {
        sourceId: result.sourceId,
        seed: result.seed,
        path: task.relativePath,
        observations: result.observations,
        seen: result.seen,
        unreadable: result.unreadable,
        captureErrors: result.captureErrors,
        elapsedMs: result.elapsedMs,
      };
      console.error(
        `${result.sourceId}/s${result.seed}/${budget}: ${result.seen} calls, ` +
          `retained ${result.observations} ` +
          `(pool ${result.populations.candidate_pool ?? 0}, ` +
          `aim ${result.populations.aim_probe ?? 0}), ` +
          `unreadable ${result.unreadable}, errors ${result.captureErrors}, ` +
          `${result.elapsedMs.toFixed(0)} ms`,
      );
    });
    const compilerFingerprintAfter = compilerCandidateIdentity("wasm").candidateFingerprint;
    if (compilerFingerprintAfter !== compilerFingerprint) {
      throw new Error(`compiler sources changed during ballistic corpus collection`);
    }
    const corpus: BallisticCorpus = {
      schema: "line.ballistic-predictor-corpus.v8",
      generatedAt: new Date().toISOString(),
      compiler: "current checkout",
      compilerFingerprint,
      protocol: {
        canonical: canonicalScope,
        cases: canonicalScope ? "all-current-v2" : sourceIds,
        budget,
        seeds: [...BALLISTIC_BENCHMARK_SEEDS],
        sampleCapPerCaseSeed: BALLISTIC_SAMPLE_CAP_PER_CASE_SEED,
        populations: [...BALLISTIC_POPULATIONS],
        compilerPredictor: CURRENT_MODEL,
      },
      cases: sourceIds,
      joltMs: suite.transform.jolt_ms,
      observations: shards.reduce((sum, shard) => sum + shard.observations, 0),
      shards,
    };
    writeFileSync(
      resolve(stagingPath, "manifest.json"),
      `${JSON.stringify(corpus, null, 2)}\n`,
    );
    installCollectedCorpus(stagingPath);
    console.error(
      `corpus: ${relativeToCwd(corpusPath)} (${corpus.observations} observations, ${shards.length} shards)`,
    );
    return corpus;
  } catch (error) {
    rmSync(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

function installCollectedCorpus(stagingPath: string): void {
  if (!existsSync(corpusPath)) {
    renameSync(stagingPath, corpusPath);
    return;
  }
  const previousPath = `${corpusPath}.previous-${process.pid}-${Date.now()}`;
  renameSync(corpusPath, previousPath);
  try {
    renameSync(stagingPath, corpusPath);
  } catch (error) {
    renameSync(previousPath, corpusPath);
    throw error;
  }
  rmSync(previousPath, { recursive: true, force: true });
}

async function collectCaseSeed(
  sourceId: string,
  seed: number,
): Promise<CollectedCaseSeed> {
  const source = sources.find((entry) => entry.id === sourceId);
  if (source === undefined) throw new Error(`unknown collection source ${sourceId}`);
  const spec = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
  const budget = BALLISTIC_BENCHMARK_BUDGET;
  const started = performance.now();
  const reservoir: ReservoirEntry[] = [];
  let seen = 0;
  let unreadable = 0;
  let captureErrors = 0;
  setBallisticTraceSink((candidate) => {
    const ordinal = seen++;
    const priority = tracePriority(source.id, seed, ordinal, candidate);
    if (
      !reservoirWouldRetain(
        reservoir,
        priority,
        ordinal,
        BALLISTIC_SAMPLE_CAP_PER_CASE_SEED,
      )
    ) return;
    let captured: BallisticTraceObservation | null;
    try {
      captured = candidate.capture();
    } catch (error) {
      unreadable++;
      captureErrors++;
      if (captureErrors <= 3) {
        console.error(
          `ballistic capture skipped for ${source.id}/s${seed} call ${ordinal} ` +
            `(${candidate.population}, gap ${candidate.gapIndex}, ` +
            `${candidate.anchorFrame}->${candidate.targetFrame}): ${String(error)}`,
        );
      }
      return;
    }
    if (captured === null) {
      unreadable++;
      return;
    }
    const entry: ReservoirEntry = {
      priority,
      ordinal,
      observation: { sourceId: source.id, seed, budget, ...captured },
    };
    retainInReservoir(reservoir, entry, BALLISTIC_SAMPLE_CAP_PER_CASE_SEED);
  });
  try {
    compileHandoff(spec, seed, { budget });
  } finally {
    setBallisticTraceSink(null);
  }
  return {
    sourceId,
    seed,
    seen,
    unreadable,
    captureErrors,
    elapsedMs: performance.now() - started,
    observations: reservoir
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((entry) => entry.observation),
  };
}

async function parallelCollectionTasks(
  tasks: readonly CollectionTask[],
  stagingPath: string,
  onResult: (result: CollectionTaskResult, index: number) => void,
): Promise<void> {
  const active = new Set<ChildProcessWithoutNullStreams>();
  let cursor = 0;
  let completed = 0;
  const runLane = async (): Promise<void> => {
    while (true) {
      const index = cursor++;
      if (index >= tasks.length) return;
      const result = await runCollectionWorker(tasks[index], stagingPath, active);
      onResult(result, index);
      completed++;
      console.error(`collection progress: ${completed}/${tasks.length}`);
    }
  };
  try {
    await Promise.all(
      Array.from(
        { length: Math.min(BALLISTIC_COLLECTION_JOBS, tasks.length) },
        () => runLane(),
      ),
    );
  } catch (error) {
    for (const child of active) child.kill("SIGTERM");
    throw error;
  }
}

function runCollectionWorker(
  task: CollectionTask,
  stagingPath: string,
  active: Set<ChildProcessWithoutNullStreams>,
): Promise<CollectionTaskResult> {
  return new Promise((resolveWorker, rejectWorker) => {
    const child = spawn(
      process.execPath,
      [
        ...process.execArgv,
        fileURLToPath(import.meta.url),
        `--_worker-source=${task.sourceId}`,
        `--_worker-seed=${task.seed}`,
        `--_worker-output=${resolve(stagingPath, task.relativePath)}`,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, LR_ENGINE: "wasm" },
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
    active.add(child);
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => stdout.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => stderr.push(chunk));
    child.once("error", (error) => {
      active.delete(child);
      rejectWorker(error);
    });
    child.once("close", (code, signal) => {
      active.delete(child);
      if (code !== 0) {
        rejectWorker(new Error(
          `ballistic worker ${task.sourceId}/s${task.seed} failed ` +
            `(code ${code}, signal ${signal ?? "none"}):\n${Buffer.concat(stderr).toString("utf8")}`,
        ));
        return;
      }
      try {
        resolveWorker(JSON.parse(Buffer.concat(stdout).toString("utf8")) as CollectionTaskResult);
      } catch (error) {
        rejectWorker(new Error(
          `invalid ballistic worker output for ${task.sourceId}/s${task.seed}: ${String(error)}\n` +
            Buffer.concat(stderr).toString("utf8"),
        ));
      }
    });
  });
}

function loadCorpus(): BallisticCorpus {
  const manifestPath = resolve(corpusPath, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `ballistic corpus not found at ${relativeToCwd(corpusPath)}; ` +
        `run npm run benchmark:ballistic:collect once`,
    );
  }
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as BallisticCorpus;
  if (parsed.schema !== "line.ballistic-predictor-corpus.v8") {
    throw new Error(`unsupported ballistic corpus schema`);
  }
  // The frozen rows are predictor inputs plus independent future truth. Their
  // purpose is fast model iteration, so ordinary compiler source changes do
  // not invalidate them. Collection provenance remains in the manifest and
  // report; schema, protocol, case membership, and shard integrity are the
  // compatibility gates below.
  if (
    parsed.protocol.budget !== BALLISTIC_BENCHMARK_BUDGET ||
    parsed.protocol.seeds.length !== BALLISTIC_BENCHMARK_SEEDS.length ||
    parsed.protocol.seeds.some((seed, index) => seed !== BALLISTIC_BENCHMARK_SEEDS[index]) ||
    parsed.protocol.sampleCapPerCaseSeed !== BALLISTIC_SAMPLE_CAP_PER_CASE_SEED ||
    parsed.protocol.compilerPredictor !== CURRENT_MODEL ||
    parsed.protocol.populations.length !== BALLISTIC_POPULATIONS.length ||
    parsed.protocol.populations.some(
      (population, index) => population !== BALLISTIC_POPULATIONS[index],
    )
  ) {
    throw new Error(`ballistic corpus does not match the fixed budget/seeds protocol`);
  }
  if (
    parsed.protocol.canonical &&
    (
      parsed.cases.length !== sourceIds.length ||
      parsed.cases.some((id, index) => id !== sourceIds[index])
    )
  ) {
    throw new Error(`ballistic corpus case membership is stale; recollect it explicitly`);
  }
  if (
    parsed.shards.length !== parsed.cases.length * parsed.protocol.seeds.length ||
    parsed.shards.reduce((sum, shard) => sum + shard.observations, 0) !== parsed.observations
  ) {
    throw new Error(`ballistic corpus manifest has inconsistent shard coverage`);
  }
  for (const shard of parsed.shards) {
    const path = corpusShardPath(shard.path);
    if (!existsSync(path)) throw new Error(`ballistic corpus shard is missing: ${shard.path}`);
  }
  return parsed;
}

function* corpusObservations(corpus: BallisticCorpus): Generator<CorpusObservation> {
  let observations = 0;
  for (const shard of corpus.shards) {
    const parsed = JSON.parse(
      gunzipSync(readFileSync(corpusShardPath(shard.path))).toString("utf8"),
    ) as CorpusObservation[];
    if (
      parsed.length !== shard.observations ||
      parsed.some((observation) =>
        observation.sourceId !== shard.sourceId || observation.seed !== shard.seed
      )
    ) {
      throw new Error(`ballistic corpus shard metadata mismatch: ${shard.path}`);
    }
    observations += parsed.length;
    yield* parsed;
  }
  if (observations !== corpus.observations) {
    throw new Error(`ballistic corpus observation count mismatch`);
  }
}

function corpusShardPath(relativePath: string): string {
  const root = resolve(corpusPath);
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error(`ballistic corpus shard escapes its root: ${relativePath}`);
  }
  return path;
}

function safeFilename(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safe.length === 0) throw new Error(`cannot create a shard name for ${value}`);
  return safe;
}

function evaluateCorpus(corpus: BallisticCorpus) {
  let modelNames: string[] | null = null;
  const overallTotals = new Map<string, ErrorTotals>();
  const caseTotals = new Map<string, ErrorTotals>();
  const horizonTotals = new Map<string, ErrorTotals>();
  const populationTotals = new Map<string, ErrorTotals>();
  const scorePositionTotals = new Map<string, ErrorTotals>();
  const scoreContactTotals = new Map<string, ErrorTotals>();

  for (const observation of corpusObservations(corpus)) {
    if (modelNames === null) {
      modelNames = Object.keys(
        predictAll(observation.anchor, observation.targetFrame),
      ).sort();
    }
    const launchUsable =
      observation.anchor.riderMounted === true &&
      observation.anchor.sledIntact === true;
    const caseSeed = `${observation.sourceId}/s${observation.seed}`;

    for (const target of truthTargets) {
      const truth = observation.truth[target];
      const predictions = predictAll(observation.anchor, truth.frame);
      const dt = truth.frame - observation.anchorFrame;
      const horizon = horizonLabel(dt);
      // All rider and sled points must be collision-free over the portion
      // actually predicted: anchor + 1 through this truth frame, inclusive.
      const cleanFlight = ballisticTraceCollisionFreeThrough(
        observation,
        truth.frame,
      );
      const scorePosition = target === "precontact" &&
        cleanFlight && launchUsable && observation.anchorFrame < truth.frame;
      const scoreContact = target === "contact" && cleanFlight && launchUsable;

      for (const model of modelNames) {
        const error = predictionError(predictions[model], truth);
        addError(overallTotals, metricKey(target, model), error);
        addError(caseTotals, metricKey(observation.sourceId, target, model), error);
        if (horizon !== null) {
          addError(horizonTotals, metricKey(horizon, target, model), error);
        }
        addError(
          populationTotals,
          metricKey(observation.population, target, model),
          error,
        );
        if (scorePosition) {
          addError(scorePositionTotals, metricKey(caseSeed, model), error);
        }
        if (scoreContact) {
          addError(scoreContactTotals, metricKey(caseSeed, model), error);
        }
      }
    }
  }
  if (modelNames === null) throw new Error(`ballistic corpus contains no observations`);

  const modelSummaries = (
    totals: Map<string, ErrorTotals>,
    ...prefix: string[]
  ): Record<string, ErrorSummary> => Object.fromEntries(
    modelNames.map((model) => [
      model,
      summarizeTotals(totals.get(metricKey(...prefix, model))),
    ]),
  );
  const overall = Object.fromEntries(
    truthTargets.map((target) => [target, modelSummaries(overallTotals, target)]),
  ) as Record<TruthTarget, Record<string, ErrorSummary>>;
  const perCase = Object.fromEntries(corpus.cases.map((sourceId) => [
    sourceId,
    Object.fromEntries(
      truthTargets.map((target) => [target, modelSummaries(caseTotals, sourceId, target)]),
    ),
  ]));
  const macroByCase = Object.fromEntries(truthTargets.map((target) => [
    target,
    Object.fromEntries(modelNames.map((model) => [
      model,
      summarizeMacroTotals(
        corpus.cases.map((sourceId) =>
          caseTotals.get(metricKey(sourceId, target, model))
        ),
      ),
    ])),
  ]));
  const byHorizon = Object.fromEntries(
    ["1-8", "9-16", "17-32", "33+"].map((horizon) => [
      horizon,
      Object.fromEntries(
        truthTargets.map((target) => [
          target,
          modelSummaries(horizonTotals, horizon, target),
        ]),
      ),
    ]),
  );
  const byPopulation = Object.fromEntries(
    BALLISTIC_POPULATIONS.map((population) => [
      population,
      Object.fromEntries(
        truthTargets.map((target) => [
          target,
          modelSummaries(populationTotals, population, target),
        ]),
      ),
    ]),
  );
  const caseSeedGroups = corpus.cases.flatMap((sourceId) =>
    corpus.protocol.seeds.map((seed) => `${sourceId}/s${seed}`)
  );
  const scorePositionSummaries = Object.fromEntries(modelNames.map((model) => [
    model,
    summarizeMacroTotals(
      caseSeedGroups.map((group) =>
        scorePositionTotals.get(metricKey(group, model))
      ),
    ),
  ]));
  const scoreContactSummaries = Object.fromEntries(modelNames.map((model) => [
    model,
    summarizeMacroTotals(
      caseSeedGroups.map((group) =>
        scoreContactTotals.get(metricKey(group, model))
      ),
    ),
  ]));

  return {
    modelNames,
    score: predictorScores(
      scorePositionSummaries,
      scoreContactSummaries,
      modelNames,
      caseSeedGroups.length,
    ),
    overall,
    macroByCase,
    perCase,
    byHorizon,
    byPopulation,
  };
}

function metricKey(...parts: string[]): string {
  return parts.join("\0");
}

function horizonLabel(dt: number): string | null {
  if (dt >= 1 && dt <= 8) return "1-8";
  if (dt >= 9 && dt <= 16) return "9-16";
  if (dt >= 17 && dt <= 32) return "17-32";
  if (dt >= 33) return "33+";
  return null;
}

function predictionError(
  prediction: BallisticState,
  truth: BallisticTraceTruthSample,
): Omit<ErrorTotals, "rows"> {
  const dx = prediction.x - truth.body.x;
  const dy = prediction.y - truth.body.y;
  const dvx = prediction.vx - truth.body.vx;
  const dvy = prediction.vy - truth.body.vy;
  const predictedSpeed = Math.hypot(prediction.vx, prediction.vy);
  const truthSpeed = Math.hypot(truth.body.vx, truth.body.vy);
  const predictedAngle = Math.atan2(prediction.vy, prediction.vx);
  const truthAngle = Math.atan2(truth.body.vy, truth.body.vx);
  const articulation = ballisticArticulationFeatures(prediction);
  const predictedBinding = prediction.constraintState;
  return {
    x: Math.abs(dx),
    y: Math.abs(dy),
    position: Math.hypot(dx, dy),
    vx: Math.abs(dvx),
    vy: Math.abs(dvy),
    velocity: Math.hypot(dvx, dvy),
    speed: Math.abs(predictedSpeed - truthSpeed),
    angle: Math.abs(wrappedRadians(predictedAngle - truthAngle)) * 180 / Math.PI,
    sledPose: prediction.sledPoseDeg === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(wrappedDegrees(
        prediction.sledPoseDeg - truth.sledPoseDeg,
      )),
    sledPoseRate: prediction.sledPoseRateDegPerFrame === null
      ? Number.POSITIVE_INFINITY
      : Math.abs(wrappedDegrees(
        prediction.sledPoseRateDegPerFrame -
          truth.sledPoseRateDegPerFrame,
      )),
    articulation: articulation === null
      ? Number.POSITIVE_INFINITY
      : mean(articulation.map(
        (value, index) => Math.abs(value - truth.articulation[index]),
      )),
    bindingMismatch: predictedBinding === undefined
      ? Number.POSITIVE_INFINITY
      : (
        Number(predictedBinding.riderMounted !== truth.riderMounted) +
        Number(predictedBinding.sledIntact !== truth.sledIntact)
      ) / 2,
  };
}

function addError(
  totalsByKey: Map<string, ErrorTotals>,
  key: string,
  error: Omit<ErrorTotals, "rows">,
): void {
  let totals = totalsByKey.get(key);
  if (totals === undefined) {
    totals = {
      rows: 0,
      x: 0,
      y: 0,
      position: 0,
      vx: 0,
      vy: 0,
      velocity: 0,
      speed: 0,
      angle: 0,
      sledPose: 0,
      sledPoseRate: 0,
      articulation: 0,
      bindingMismatch: 0,
    };
    totalsByKey.set(key, totals);
  }
  totals.rows++;
  totals.x += error.x;
  totals.y += error.y;
  totals.position += error.position;
  totals.vx += error.vx;
  totals.vy += error.vy;
  totals.velocity += error.velocity;
  totals.speed += error.speed;
  totals.angle += error.angle;
  totals.sledPose += error.sledPose;
  totals.sledPoseRate += error.sledPoseRate;
  totals.articulation += error.articulation;
  totals.bindingMismatch += error.bindingMismatch;
}

function summarizeTotals(totals: ErrorTotals | undefined): ErrorSummary {
  const rows = totals?.rows ?? 0;
  const divisor = rows === 0 ? NaN : rows;
  return {
    rows,
    xMae: (totals?.x ?? 0) / divisor,
    yMae: (totals?.y ?? 0) / divisor,
    positionMae: (totals?.position ?? 0) / divisor,
    vxMae: (totals?.vx ?? 0) / divisor,
    vyMae: (totals?.vy ?? 0) / divisor,
    velocityMae: (totals?.velocity ?? 0) / divisor,
    speedMae: (totals?.speed ?? 0) / divisor,
    angleMaeDeg: (totals?.angle ?? 0) / divisor,
    sledPoseMaeDeg: (totals?.sledPose ?? 0) / divisor,
    sledPoseRateMaeDegPerFrame:
      (totals?.sledPoseRate ?? 0) / divisor,
    articulationMae: (totals?.articulation ?? 0) / divisor,
    bindingMismatchRate: (totals?.bindingMismatch ?? 0) / divisor,
  };
}

function summarizeMacroTotals(
  totals: readonly (ErrorTotals | undefined)[],
): MacroErrorSummary {
  const summaries = totals
    .filter((entry): entry is ErrorTotals => entry !== undefined && entry.rows > 0)
    .map(summarizeTotals);
  const metric = (key: Exclude<keyof ErrorSummary, "rows">): number =>
    mean(summaries.map((summary) => summary[key]));
  const spreadOf = (key: Exclude<keyof ErrorSummary, "rows">): number => {
    const values = summaries.map((summary) => summary[key]);
    if (values.length < 2) return 0;
    const average = mean(values);
    return Math.sqrt(
      values.reduce((sum, value) => sum + (value - average) ** 2, 0) /
        (values.length - 1),
    );
  };
  return {
    groups: summaries.length,
    spread: {
      positionMae: spreadOf("positionMae"),
      velocityMae: spreadOf("velocityMae"),
      speedMae: spreadOf("speedMae"),
      angleMaeDeg: spreadOf("angleMaeDeg"),
    },
    rows: summaries.reduce((sum, summary) => sum + summary.rows, 0),
    xMae: metric("xMae"),
    yMae: metric("yMae"),
    positionMae: metric("positionMae"),
    vxMae: metric("vxMae"),
    vyMae: metric("vyMae"),
    velocityMae: metric("velocityMae"),
    speedMae: metric("speedMae"),
    angleMaeDeg: metric("angleMaeDeg"),
    sledPoseMaeDeg: metric("sledPoseMaeDeg"),
    sledPoseRateMaeDegPerFrame: metric(
      "sledPoseRateMaeDegPerFrame",
    ),
    articulationMae: metric("articulationMae"),
    bindingMismatchRate: metric("bindingMismatchRate"),
  };
}

/** Deterministic bottom-k sampling backed by a max-heap. */
function reservoirWouldRetain(
  entries: readonly ReservoirEntry[],
  priority: number,
  ordinal: number,
  cap: number,
): boolean {
  if (entries.length < cap) return true;
  const candidate = { priority, ordinal };
  return reservoirOrder(candidate, entries[0]) < 0;
}

function retainInReservoir(
  entries: ReservoirEntry[],
  entry: ReservoirEntry,
  cap: number,
): void {
  if (entries.length < cap) {
    entries.push(entry);
    let index = entries.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (reservoirOrder(entries[parent], entries[index]) >= 0) break;
      [entries[parent], entries[index]] = [entries[index], entries[parent]];
      index = parent;
    }
    return;
  }
  if (reservoirOrder(entry, entries[0]) >= 0) return;
  entries[0] = entry;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    if (left >= entries.length) return;
    const right = left + 1;
    const larger = right < entries.length &&
        reservoirOrder(entries[right], entries[left]) > 0
      ? right
      : left;
    if (reservoirOrder(entries[index], entries[larger]) >= 0) return;
    [entries[index], entries[larger]] = [entries[larger], entries[index]];
    index = larger;
  }
}

function reservoirOrder(
  a: Pick<ReservoirEntry, "priority" | "ordinal">,
  b: Pick<ReservoirEntry, "priority" | "ordinal">,
): number {
  return a.priority - b.priority || a.ordinal - b.ordinal;
}

function tracePriority(
  sourceId: string,
  seed: number,
  ordinal: number,
  candidate: BallisticTraceCandidate,
): number {
  const identity = [
    sourceId,
    seed,
    ordinal,
    candidate.population,
    candidate.gapIndex,
    candidate.anchorFrame,
    candidate.targetFrame,
  ].join("/");
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index++) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  // Final avalanche improves the low-bit distribution of nearby call ordinals.
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

/*
 * Cost is REPORTED, never scored.
 *
 * A predictor's usefulness is accuracy per unit of time, but the two are not
 * commensurable and the exchange rate is a judgement about the compiler, not a
 * property of the corpus. So timing stays out of `rawScore` and out of
 * `decision` entirely - nothing is ever adopted or rejected here on speed. It
 * is printed next to the accuracy so a human can weigh them.
 *
 * Timing is measured in BLOCKS rather than per call: a per-call
 * `hrtime.bigint()` pair costs on the order of a cheap predictor's entire run,
 * so per-call timing would mostly measure the clock. Each block replays the
 * same held sample of real call sites, and the reported spread is across
 * blocks, which is what makes the mean interpretable.
 */
function predictAll(
  anchor: Sample,
  targetFrame: number,
): Record<string, BallisticState> {
  const input: PredictorInput = {
    anchor,
    targetFrame,
    // Exact previous-point positions make earlier trace samples unnecessary.
    constraintState: constraintBallisticStateFromSamples([anchor]),
  };
  if (timingSample.length < TIMING_SAMPLE_CAP) timingSample.push(input);
  return Object.fromEntries(
    PREDICTORS.map((predictor) => [predictor.name, predictor.predict(input)]),
  );
}

type TimingSummary = {
  model: string;
  calls: number;
  blocks: number;
  meanNsPerCall: number;
  sdNsPerCall: number;
  minNsPerCall: number;
  maxNsPerCall: number;
};

/** Replay the held sample `TIMING_BLOCKS` times per predictor and report the
 *  per-call cost with its spread across blocks. Information only. */
function measureTiming(): TimingSummary[] {
  if (timingSample.length === 0) return [];
  const out: TimingSummary[] = [];
  for (const predictor of PREDICTORS) {
    // One untimed warm pass so JIT state is comparable across predictors.
    for (const input of timingSample) predictor.predict(input);
    const perCall: number[] = [];
    for (let block = 0; block < TIMING_BLOCKS; block++) {
      const started = process.hrtime.bigint();
      for (const input of timingSample) predictor.predict(input);
      const elapsed = Number(process.hrtime.bigint() - started);
      perCall.push(elapsed / timingSample.length);
    }
    const mean = perCall.reduce((a, b) => a + b, 0) / perCall.length;
    const variance = perCall.reduce((a, b) => a + (b - mean) ** 2, 0) /
      Math.max(1, perCall.length - 1);
    out.push({
      model: predictor.name,
      calls: timingSample.length * TIMING_BLOCKS,
      blocks: TIMING_BLOCKS,
      meanNsPerCall: round(mean),
      sdNsPerCall: round(Math.sqrt(variance)),
      minNsPerCall: round(Math.min(...perCall)),
      maxNsPerCall: round(Math.max(...perCall)),
    });
  }
  return out;
}

function printTiming(timings: readonly TimingSummary[]): void {
  if (timings.length === 0) return;
  console.log(`\ncost per prediction (INFORMATION ONLY - never scored, never gated)`);
  console.log("model                        ns/call       sd      min      max   xCurrent");
  const current = timings.find((t) => t.model === CURRENT_MODEL)?.meanNsPerCall;
  for (const t of timings) {
    const ratio = current === undefined || current === 0
      ? ""
      : `${(t.meanNsPerCall / current).toFixed(3)}x`;
    console.log(
      `${t.model.padEnd(26)} ${t.meanNsPerCall.toFixed(0).padStart(9)} ` +
      `${t.sdNsPerCall.toFixed(0).padStart(8)} ${t.minNsPerCall.toFixed(0).padStart(8)} ` +
      `${t.maxNsPerCall.toFixed(0).padStart(8)} ${ratio.padStart(10)}`,
    );
  }
  console.log(
    `  ${timings[0].blocks} blocks x ${(timings[0].calls / timings[0].blocks).toFixed(0)} held call sites; ` +
      `spread is across blocks, so it reflects machine noise rather than input variation`,
  );
}


/*
 * Closed-form centre-of-mass propagation: O(1), no stepping, no constraints.
 *
 * Justification for why this can be exact at all: in free flight every
 * constraint in the kernel moves its two points by equal and opposite amounts
 * (`px[p1] -= dx; px[p2] += dx`), there are no per-point masses, and the joint
 * passes only read positions to flip binding flags. The SUM of the ten point
 * positions is therefore invariant under the whole solve, so the ten-point
 * system centre of mass follows exact Verlet projectile motion:
 *
 *   v_n = v_0 + n*g          x_n = x_0 + n*vx_0
 *                            y_n = y_0 + n*vy_0 + g*n*(n+1)/2
 *
 * Measured system-COM residual per frame: 1.1e-13 px on frontier_dense_recovery.
 *
 * What it CANNOT reproduce is the reason the exact kernel exists. Production
 * consumes the six-point RIDER average (BODY_INDICES 4..9), not the ten-point
 * system average, and the rider is coupled to the sled through the bind
 * constraints - so momentum flows across that boundary and the rider mean
 * drifts from the system parabola by 0.017-0.045 px per frame. This predictor
 * also cannot produce sled pose, pose rate, or articulation at all; those
 * components will score as misses, which is the honest cost of not stepping.
 *
 * It is here to price that trade, not to win the score.
 */
function predictClosedFormCom(input: PredictorInput): BallisticState {
  const last = input.anchor;
  const n = Math.max(0, Math.round(input.targetFrame - last.frame));
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  const pose = closedFormPose(input.constraintState);
  const vx = last.body.vx;
  const vy = last.body.vy + n * g;
  const speed = Math.hypot(vx, vy);
  return {
    x: last.body.x + n * vx,
    y: last.body.y + n * last.body.vy + g * n * (n + 1) / 2,
    vx,
    vy,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vy, vx) * 180 / Math.PI : null,
    // A cheap model still has to answer every question production asks. The
    // cheapest honest answer for pose is that the sled keeps rotating at the
    // rate it left the arc with - first order, still O(1). It ignores the
    // articulation that the constraint solve would apply, which is precisely
    // the error this experiment is here to price.
    sledPoseDeg: pose === null ? null : pose.deg + n * pose.rate,
    sledPoseRateDegPerFrame: pose === null ? null : pose.rate,
    // Articulation frozen at launch: the exact anchor packet is carried through
    // UNADVANCED, so every articulation and binding question is answered from
    // the pose the rider left the arc with. Costs nothing, and makes the
    // model's blind spot explicit rather than returning nulls that the
    // evaluator would have to special-case.
    ...(input.constraintState === null || input.constraintState === undefined
      ? {}
      : { constraintState: { ...input.constraintState, frameOffset: 0 } }),
  };
}

/** Sled TAIL->NOSE pose and its per-frame rate, read from the anchor's exact
 *  points and their Verlet previous positions. Two atan2 calls. */
function closedFormPose(
  constraintState: PredictorInput["constraintState"],
): { deg: number; rate: number } | null {
  if (constraintState === null || constraintState === undefined) return null;
  const tail = constraintState.points.TAIL;
  const nose = constraintState.points.NOSE;
  if (tail === undefined || nose === undefined) return null;
  const deg = Math.atan2(nose.y - tail.y, nose.x - tail.x) * 180 / Math.PI;
  const prevDeg = Math.atan2(
    (nose.y - nose.vy) - (tail.y - tail.vy),
    (nose.x - nose.vx) - (tail.x - tail.vx),
  ) * 180 / Math.PI;
  return { deg, rate: wrappedDegrees(deg - prevDeg) };
}


/** Every quantity held at its launch value - the honest "no prediction at all".
 *  It still ANSWERS every question, because a component it left undefined would
 *  drop out of the scale rather than contribute its full difficulty to it. */
function predictFrozenAnchor(input: PredictorInput): BallisticState {
  const body = input.anchor.body;
  const speed = Math.hypot(body.vx, body.vy);
  const pose = closedFormPose(input.constraintState);
  return {
    ...body,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(body.vy, body.vx) * 180 / Math.PI : null,
    sledPoseDeg: pose === null ? null : pose.deg,
    sledPoseRateDegPerFrame: pose === null ? null : pose.rate,
    ...(input.constraintState === null || input.constraintState === undefined
      ? {}
      : { constraintState: { ...input.constraintState, frameOffset: 0 } }),
  };
}


/*
 * Closed-form SYSTEM propagation - the correction the first cut was missing.
 *
 * `closed_form_com` propagated the rider's own six-point mean using the rider's
 * own velocity, as if the rider were a free projectile. It is not. Only the
 * TEN-point system is: the constraints are internal, symmetric and massless, so
 * they cancel in the system sum but not in any subset of it. The rider's
 * instantaneous velocity therefore contains the sled-rider oscillation, and
 * extrapolating it linearly extrapolates the oscillation too.
 *
 * So propagate the thing that is actually ballistic, and carry the rider across
 * on the offset it had at launch:
 *
 *   S_n = S_0 + n*VS_0 + g*n*(n+1)/2      (exact)
 *   R_n = S_n + (R_0 - S_0)               (offset frozen)
 *
 * This is still O(1) - one pass over ten points at launch, then arithmetic.
 * It trades "the rider keeps its launch velocity" for "the rider keeps its
 * launch offset", and the second is the better approximation whenever the
 * relative motion is a bounded oscillation rather than a drift.
 */
function predictClosedFormSystem(input: PredictorInput): BallisticState {
  const constraintState = input.constraintState;
  if (constraintState === null || constraintState === undefined) {
    return predictClosedFormCom(input);
  }
  const last = input.anchor;
  const n = Math.max(0, Math.round(input.targetFrame - last.frame));
  const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
  let sx = 0, sy = 0, svx = 0, svy = 0, count = 0;
  for (const id of BALLISTIC_POINT_IDS) {
    const point = constraintState.points[id];
    if (point === undefined) continue;
    sx += point.x; sy += point.y; svx += point.vx; svy += point.vy; count++;
  }
  if (count === 0) return predictClosedFormCom(input);
  sx /= count; sy /= count; svx /= count; svy /= count;
  // Rider offset from the system centre, held at its launch value.
  const offsetX = last.body.x - sx;
  const offsetY = last.body.y - sy;
  const vy = svy + n * g;
  const x = sx + n * svx + offsetX;
  const y = sy + n * svy + g * n * (n + 1) / 2 + offsetY;
  const speed = Math.hypot(svx, vy);
  const pose = closedFormPose(constraintState);
  return {
    x,
    y,
    vx: svx,
    vy,
    speed,
    comAngleDeg: speed > 0 ? Math.atan2(vy, svx) * 180 / Math.PI : null,
    sledPoseDeg: pose === null ? null : pose.deg + n * pose.rate,
    sledPoseRateDegPerFrame: pose === null ? null : pose.rate,
    constraintState: { ...constraintState, frameOffset: 0 },
  };
}

/** Must mirror the predictor currently used by the compiler. */
function predictCurrent(input: PredictorInput): BallisticState {
  const last = input.anchor;
  const speed = Math.hypot(last.body.vx, last.body.vy);
  const state = propagateBallisticState({
    ...last.body,
    speed,
    comAngleDeg: speed > 0
      ? Math.atan2(last.body.vy, last.body.vx) * 180 / Math.PI
      : null,
    sledPoseDeg: null,
    sledPoseRateDegPerFrame: null,
    ...(input.constraintState === null
      ? {}
      : {
        constraintState: {
          ...input.constraintState,
          // The frozen state is already the exact production anchor. Keep the
          // public suffix origin explicit.
          frameOffset: 0,
        },
      }),
  }, input.targetFrame - last.frame);
  return state;
}

function wrappedRadians(value: number): number {
  let out = value % (2 * Math.PI);
  if (out > Math.PI) out -= 2 * Math.PI;
  if (out <= -Math.PI) out += 2 * Math.PI;
  return out;
}

function wrappedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function predictorScores(
  positionSummaries: Record<string, MacroErrorSummary>,
  contactSummaries: Record<string, MacroErrorSummary>,
  models: readonly string[],
  expectedGroups: number,
) {
  const currentPosition = requiredScoreSummary(
    positionSummaries[REFERENCE_MODEL],
    `${REFERENCE_MODEL} position`,
    expectedGroups,
  );
  const currentContact = requiredScoreSummary(
    contactSummaries[REFERENCE_MODEL],
    `${REFERENCE_MODEL} contact`,
    expectedGroups,
  );
  const components = [
    ["position", "precontact", "positionMae"],
    ["velocity", "contact", "velocityMae"],
    ["speed", "contact", "speedMae"],
    ["angle", "contact", "angleMaeDeg"],
    ["sledPose", "contact", "sledPoseMaeDeg"],
    ["sledPoseRate", "contact", "sledPoseRateMaeDegPerFrame"],
    ["articulation", "contact", "articulationMae"],
    ["bindingIntegrity", "contact", "bindingMismatchRate"],
  ] as const;
  const minimumImprovementPct = 1;
  const referenceComponentError: Record<string, number> = {
    position: currentPosition.positionMae,
    velocity: currentContact.velocityMae,
    speed: currentContact.speedMae,
    angle: currentContact.angleMaeDeg,
    sledPose: currentContact.sledPoseMaeDeg,
    sledPoseRate: currentContact.sledPoseRateMaeDegPerFrame,
    articulation: currentContact.articulationMae,
    bindingIntegrity: currentContact.bindingMismatchRate,
  };
  const informativeComponents = components
    .map(([label]) => label as string)
    .filter((label) => (referenceComponentError[label] ?? 0) > 0);
  if (informativeComponents.length === 0) {
    throw new Error(`the reference predictor has zero error on every component`);
  }
  const modelScores = models.map((model) => {
    const position = requiredScoreSummary(
      positionSummaries[model],
      `${model} position`,
      expectedGroups,
    );
    const contact = requiredScoreSummary(
      contactSummaries[model],
      `${model} contact`,
      expectedGroups,
    );
    const ratios = {
      position: normalizedError(position.positionMae, currentPosition.positionMae),
      velocity: normalizedError(contact.velocityMae, currentContact.velocityMae),
      speed: normalizedError(contact.speedMae, currentContact.speedMae),
      angle: normalizedError(contact.angleMaeDeg, currentContact.angleMaeDeg),
      sledPose: normalizedError(
        contact.sledPoseMaeDeg,
        currentContact.sledPoseMaeDeg,
      ),
      sledPoseRate: normalizedError(
        contact.sledPoseRateMaeDegPerFrame,
        currentContact.sledPoseRateMaeDegPerFrame,
      ),
      articulation: normalizedError(
        contact.articulationMae,
        currentContact.articulationMae,
      ),
      bindingIntegrity: normalizedError(
        contact.bindingMismatchRate,
        currentContact.bindingMismatchRate,
      ),
    };
    return {
      model,
      /*
       * Average only the components the reference model actually gets WRONG.
       * If doing nothing already scores zero error on a component - binding
       * integrity, typically, since bindings rarely break in free flight -
       * then the component says nothing about a predictor, and
       * `normalizedError` reports 1 for everyone. Averaging it in adds a
       * constant to every score and shrinks the spread between models.
       */
      rawScore: mean(
        informativeComponents
          .map((component) => ratios[component])
          .filter((value) => Number.isFinite(value)),
      ),
      ratios,
    };
  });
  const currentScore = modelScores.find((entry) => entry.model === CURRENT_MODEL)?.rawScore;
  if (currentScore === undefined) throw new Error(`current predictor score is missing`);
  const alternativeScore = ALTERNATIVE_MODEL === null
    ? null
    : modelScores.find((entry) => entry.model === ALTERNATIVE_MODEL)?.rawScore ?? null;
  if (ALTERNATIVE_MODEL !== null && alternativeScore === null) {
    throw new Error(`alternative predictor score is missing`);
  }
  /*
   * Scores are already expressed as a fraction of the reference model's error,
   * so a DIFFERENCE between two of them is directly interpretable: 0.4 means
   * "four tenths of the do-nothing error worse". Dividing by `currentScore`
   * would reintroduce the zero denominator the reference scale exists to
   * remove.
   */
  const alternativeImprovementPct = alternativeScore === null
    ? null
    : 100 * (currentScore - alternativeScore);
  const decision = alternativeImprovementPct === null
    ? "no_alternative"
    : alternativeImprovementPct >= minimumImprovementPct
    ? "adopt_alternative"
    : "keep_current";
  return {
    lowerIsBetter: true,
    currentModel: CURRENT_MODEL,
    currentScore: round(currentScore),
    alternativeModel: ALTERNATIVE_MODEL,
    alternativeScore: alternativeScore === null ? null : round(alternativeScore),
    alternativeImprovementPct: alternativeImprovementPct === null
      ? null
      : round(alternativeImprovementPct),
    minimumImprovementPct,
    decision,
    aggregation:
      "equal case-seed macro mean of current-normalized component MAEs",
    componentWeights: Object.fromEntries(
      informativeComponents.map((label) => [label, 1 / informativeComponents.length]),
    ),
    uninformativeComponents: components
      .map(([label]) => label as string)
      .filter((label) => !informativeComponents.includes(label)),
    componentTruth: {
      position: "authored precontact, excluding rows whose truth frame was sampled",
      velocity: "authored contact",
      speed: "authored contact",
      angle: "authored contact",
      sledPose: "authored contact",
      sledPoseRate: "authored contact",
      articulation:
        "authored contact, canonical readiness articulation features",
      bindingIntegrity: "authored contact",
    },
    coverage: {
      positionRows: currentPosition.rows,
      positionCaseSeedGroups: currentPosition.groups,
      contactRows: currentContact.rows,
      contactCaseSeedGroups: currentContact.groups,
    },
    models: modelScores.map((entry) => {
        const improvementPct = 100 * (currentScore - entry.rawScore);
      return {
        model: entry.model,
        score: round(entry.rawScore),
        improvementVsCurrentPct: round(improvementPct),
        ratios: Object.fromEntries(
          Object.entries(entry.ratios).map(([key, value]) => [key, round(value)]),
        ),
      };
    }).sort((a, b) => a.score - b.score),
  };
}

function normalizedError(candidate: number, current: number): number {
  if (current === 0) return candidate === 0 ? 1 : Number.POSITIVE_INFINITY;
  return candidate / current;
}

function requiredScoreSummary(
  summary: MacroErrorSummary | undefined,
  label: string,
  expectedGroups: number,
): MacroErrorSummary {
  const values = summary === undefined
    ? []
    : [
      summary.positionMae,
      summary.velocityMae,
      summary.speedMae,
      summary.angleMaeDeg,
      summary.sledPoseMaeDeg,
      summary.sledPoseRateMaeDegPerFrame,
      summary.articulationMae,
      summary.bindingMismatchRate,
    ];
  /*
   * Coverage problems are fatal; an unanswerable COMPONENT is not.
   *
   * A model that cannot produce sled pose, or articulation, is a legitimate
   * experiment - that is exactly what a cheap model trades away. Killing the
   * whole run because one component came back null makes the harness hostile
   * to the experiments it exists to run (it did, twice, on the first cheap
   * model). Non-finite components are dropped from the mean instead, and the
   * raw error table still shows everything the model DID answer.
   */
  if (
    summary === undefined ||
    summary.rows <= 0 ||
    summary.groups !== expectedGroups ||
    values.some((value) => Number.isFinite(value) && value < 0)
  ) {
    throw new Error(
      `ballistic score coverage is invalid for ${label}: ` +
        `${summary?.rows ?? 0} rows across ${summary?.groups ?? 0}/${expectedGroups} groups`,
    );
  }
  return summary;
}

function printSummary(
  summaries: Record<TruthTarget, Record<string, ErrorSummary>>,
): void {
  for (const target of ["precontact", "contact"] as const) {
    console.log(`\n${target} truth`);
    console.log(
      "model                         rows      posMAE       velMAE     speedMAE     angleMAE",
    );
    for (const [model, summary] of Object.entries(summaries[target])
      .sort((a, b) => a[1].velocityMae - b[1].velocityMae)) {
      // deno-lint-ignore no-explicit-any
      const sd = (summary as any).spread ?? {};
      const cell = (value: number, dispersion: number, digits: number): string =>
        `${value.toFixed(digits)}±${(dispersion ?? 0).toFixed(digits)}`;
      console.log(
        `${model.padEnd(29)} ${String(summary.rows).padStart(4)} ` +
        `${cell(summary.positionMae, sd.positionMae, 2).padStart(12)} ` +
        `${cell(summary.velocityMae, sd.velocityMae, 3).padStart(12)} ` +
        `${cell(summary.speedMae, sd.speedMae, 3).padStart(12)} ` +
        `${cell(summary.angleMaeDeg, sd.angleMaeDeg, 2).padStart(12)}`,
      );
    }
    console.log("  mean ± sd across the 44 cases");
  }
}

function printScores(score: ReturnType<typeof predictorScores>): void {
  console.log(
    `\noverall predictor score - fraction of the do-nothing (${REFERENCE_MODEL}) error; ` +
      `0 = exact, 1 = no better than not predicting`,
  );
  if (
    score.alternativeModel === null ||
    score.alternativeScore === null ||
    score.alternativeImprovementPct === null
  ) {
    console.log(`no alternative configured; current corpus is ready for the next experiment`);
  } else {
    console.log(
      `alternative ${score.alternativeModel} = ${score.alternativeScore.toFixed(4)} vs ` +
        `current ${score.currentScore.toFixed(4)}; ` +
        `${score.alternativeImprovementPct.toFixed(2)} points of reference error; ` +
        `decision ${score.decision}`,
    );
  }
  for (const entry of score.models) {
    console.log(
      `${entry.model.padEnd(45)} ${entry.score.toFixed(4)} ` +
        `${entry.improvementVsCurrentPct.toFixed(2).padStart(7)}%`,
    );
  }
}

function list(value: string): string[] {
  const values = value.split(",").map((entry) => entry.trim()).filter(Boolean);
  if (values.length === 0) throw new Error(`expected a non-empty list`);
  return values;
}

function rejectFixedProtocolOverride(name: string): void {
  if (argValue(name) === undefined) return;
  throw new Error(
    `--${name} is not configurable: the ballistic benchmark is fixed to ` +
      `budget ${BALLISTIC_BENCHMARK_BUDGET} and canonical seeds ` +
      BALLISTIC_BENCHMARK_SEEDS.join(","),
  );
}

function exactCanonicalSeed(value: string | undefined): number {
  const seed = Number(value);
  if (
    !Number.isSafeInteger(seed) ||
    !(BALLISTIC_BENCHMARK_SEEDS as readonly number[]).includes(seed)
  ) {
    throw new Error(`invalid internal ballistic worker seed ${value ?? "<missing>"}`);
  }
  return seed;
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Number.isFinite(value) ? Math.round(value * 10_000) / 10_000 : value;
}

function relativeToCwd(path: string): string {
  const cwd = `${process.cwd()}/`;
  return path.startsWith(cwd) ? path.slice(cwd.length) : path;
}
