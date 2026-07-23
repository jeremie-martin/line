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
 * The ten-point assembly center is reconstructed without a full state-map read:
 * six times rider.position/velocity plus the four exposed sled points. During
 * unconstrained free flight this center is the physically conserved coordinate;
 * the public rider coordinate is the six-body-point center moving around it.
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
import { applyJolt } from "../produce/seed.ts";
import {
  type BallisticTraceCandidate,
  type BallisticTraceObservation,
  type BallisticTraceSample,
  setBallisticTraceSink,
} from "./core/ballistic_trace.ts";
import {
  articulatedBallisticState,
  LAUNCH_VY_OFFSET_PX,
  predictArticulatedBallisticArrival,
} from "./core/launch_read.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { canonicalMembers, loadSuiteManifest } from "./benchmark_v2/suite_model.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { ELEVATION } from "./types.ts";

type Vec2 = { x: number; y: number };
type KinematicState = Vec2 & { vx: number; vy: number };
type Sample = BallisticTraceSample;
type TruthTarget = "precontact" | "contact";
type PredictorInput = {
  samples: readonly Sample[];
  targetFrame: number;
  dt: number;
  fallback: KinematicState;
  articulation: ReturnType<typeof articulatedBallisticState>;
};
type Predictor = {
  name: string;
  predict: (input: PredictorInput) => KinematicState;
};
type CorpusObservation = BallisticTraceObservation & {
  sourceId: string;
  seed: number;
  budget: number;
};
type BallisticCorpus = {
  schema: "line.ballistic-predictor-corpus.v5";
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
};
type MacroErrorSummary = ErrorSummary & { groups: number };
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
const CURRENT_PREDICTOR = {
  name: "current",
  predict: predictCurrent,
} as const satisfies Predictor;
/**
 * The only experiment switch. Return one named predictor while testing it;
 * return null between experiments.
 */
function configuredAlternative(): Predictor | null {
  return null;
}
const ALTERNATIVE_PREDICTOR = configuredAlternative();
const CURRENT_MODEL = CURRENT_PREDICTOR.name;
const ALTERNATIVE_MODEL = ALTERNATIVE_PREDICTOR?.name ?? null;
const PREDICTORS: readonly Predictor[] = ALTERNATIVE_PREDICTOR === null
  ? [CURRENT_PREDICTOR]
  : [CURRENT_PREDICTOR, ALTERNATIVE_PREDICTOR];
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
const g = ELEVATION.GRAVITY_PX_PER_FRAME2;
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
  byReadFrames,
  byPopulation,
} = evaluation;
const perBudget = Object.fromEntries(
  budgets.map((budget) => [String(budget), overall]),
);
const report = {
  schema: "line.study-ballistic-predictor-v2.v6",
  generatedAt: new Date().toISOString(),
  compiler: corpus.compiler,
  compilerFingerprint: corpus.compilerFingerprint,
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
  byReadFrames,
  byPopulation,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
printSummary(overall as Record<TruthTarget, Record<string, ErrorSummary>>);
printScores(score);
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
        elapsedMs: result.elapsedMs,
      };
      console.error(
        `${result.sourceId}/s${result.seed}/${budget}: ${result.seen} calls, ` +
          `retained ${result.observations} ` +
          `(pool ${result.populations.candidate_pool ?? 0}, ` +
          `aim ${result.populations.aim_probe ?? 0}), ` +
          `unreadable ${result.unreadable}, ${result.elapsedMs.toFixed(0)} ms`,
      );
    });
    const compilerFingerprintAfter = compilerCandidateIdentity("wasm").candidateFingerprint;
    if (compilerFingerprintAfter !== compilerFingerprint) {
      throw new Error(`compiler sources changed during ballistic corpus collection`);
    }
    const corpus: BallisticCorpus = {
      schema: "line.ballistic-predictor-corpus.v5",
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
      throw new Error(
        `ballistic capture failed for ${source.id}/s${seed} call ${ordinal} ` +
          `(${candidate.population}, gap ${candidate.gapIndex}, ` +
          `${candidate.launchFrame}->${candidate.targetFrame}): ${String(error)}`,
      );
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
  if (parsed.schema !== "line.ballistic-predictor-corpus.v5") {
    throw new Error(`unsupported ballistic corpus schema`);
  }
  const compilerFingerprint = compilerCandidateIdentity("wasm").candidateFingerprint;
  if (parsed.compilerFingerprint !== compilerFingerprint) {
    throw new Error(
      `ballistic corpus belongs to a different current compiler; ` +
        `recollect it explicitly after promoting or changing current`,
    );
  }
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
  const readTotals = new Map<string, ErrorTotals>();
  const populationTotals = new Map<string, ErrorTotals>();
  const scorePositionTotals = new Map<string, ErrorTotals>();
  const scoreContactTotals = new Map<string, ErrorTotals>();

  for (const observation of corpusObservations(corpus)) {
    if (modelNames === null) {
      modelNames = Object.keys(predictAll(observation.samples, observation.targetFrame)).sort();
    }
    // The predictor is physically ballistic only when no rider or sled point
    // collides before the authored target. This is intentionally stricter than
    // the detector's sled-only `airborne` label.
    const cleanFlight = observation.collisionWitnesses.every(
      (witness) => witness.frame >= observation.targetFrame,
    );
    const launchUsable = observation.samples.every(
      (sample) => sample.riderMounted === true && sample.sledIntact === true,
    );
    const lastSampleFrame = observation.samples[observation.samples.length - 1].frame;
    const caseSeed = `${observation.sourceId}/s${observation.seed}`;

    for (const target of truthTargets) {
      const truth = observation.truth[target];
      const predictions = predictAll(observation.samples, truth.frame);
      const dt = truth.frame - observation.launchFrame;
      const horizon = horizonLabel(dt);
      const scorePosition = target === "precontact" &&
        cleanFlight && launchUsable && lastSampleFrame < truth.frame;
      const scoreContact = target === "contact" && cleanFlight && launchUsable;

      for (const model of modelNames) {
        const error = predictionError(predictions[model], truth.body);
        addError(overallTotals, metricKey(target, model), error);
        addError(caseTotals, metricKey(observation.sourceId, target, model), error);
        if (horizon !== null) {
          addError(horizonTotals, metricKey(horizon, target, model), error);
        }
        addError(
          readTotals,
          metricKey(String(observation.samples.length), target, model),
          error,
        );
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
  const byReadFrames = Object.fromEntries(
    [1, 2, 3, 4].map((readFrames) => [
      String(readFrames),
      Object.fromEntries(
        truthTargets.map((target) => [
          target,
          modelSummaries(readTotals, String(readFrames), target),
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
    byReadFrames,
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
  prediction: KinematicState,
  truth: KinematicState,
): Omit<ErrorTotals, "rows"> {
  const dx = prediction.x - truth.x;
  const dy = prediction.y - truth.y;
  const dvx = prediction.vx - truth.vx;
  const dvy = prediction.vy - truth.vy;
  const predictedSpeed = Math.hypot(prediction.vx, prediction.vy);
  const truthSpeed = Math.hypot(truth.vx, truth.vy);
  const predictedAngle = Math.atan2(prediction.vy, prediction.vx);
  const truthAngle = Math.atan2(truth.vy, truth.vx);
  return {
    x: Math.abs(dx),
    y: Math.abs(dy),
    position: Math.hypot(dx, dy),
    vx: Math.abs(dvx),
    vy: Math.abs(dvy),
    velocity: Math.hypot(dvx, dvy),
    speed: Math.abs(predictedSpeed - truthSpeed),
    angle: Math.abs(wrappedRadians(predictedAngle - truthAngle)) * 180 / Math.PI,
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
  return {
    groups: summaries.length,
    rows: summaries.reduce((sum, summary) => sum + summary.rows, 0),
    xMae: metric("xMae"),
    yMae: metric("yMae"),
    positionMae: metric("positionMae"),
    vxMae: metric("vxMae"),
    vyMae: metric("vyMae"),
    velocityMae: metric("velocityMae"),
    speedMae: metric("speedMae"),
    angleMaeDeg: metric("angleMaeDeg"),
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
    candidate.launchFrame,
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

function predictAll(samples: readonly Sample[], targetFrame: number): Record<string, KinematicState> {
  const first = samples[0];
  const dt = targetFrame - first.frame;
  const bodyMean = meanLaunchVelocity(samples, "body");
  const input: PredictorInput = {
    samples,
    targetFrame,
    dt,
    fallback: propagate(first.body, bodyMean, dt),
    articulation: articulatedBallisticState(samples, g),
  };
  return Object.fromEntries(
    PREDICTORS.map((predictor) => [predictor.name, predictor.predict(input)]),
  );
}

/** Must mirror the predictor currently used by the compiler. */
function predictCurrent(input: PredictorInput): KinematicState {
  return input.articulation === null
    ? input.fallback
    : predictArticulatedBallisticArrival(input.articulation, input.dt, g);
}

function meanLaunchVelocity(
  samples: readonly Sample[],
  key: "body" | "assembly",
  vyOffset = LAUNCH_VY_OFFSET_PX,
): Pick<KinematicState, "vx" | "vy"> {
  let vx = 0;
  let vy = 0;
  const firstFrame = samples[0].frame;
  for (const sample of samples) {
    const dt = sample.frame - firstFrame;
    vx += sample[key].vx;
    vy += sample[key].vy - g * dt;
  }
  return { vx: vx / samples.length, vy: vy / samples.length + vyOffset };
}

function propagate(
  anchor: Pick<KinematicState, "x" | "y">,
  velocity: Pick<KinematicState, "vx" | "vy">,
  dt: number,
): KinematicState {
  const frames = Math.max(0, Math.round(dt));
  return {
    x: anchor.x + velocity.vx * frames,
    y: anchor.y + velocity.vy * frames + 0.5 * g * frames * (frames + 1),
    vx: velocity.vx,
    vy: velocity.vy + g * frames,
  };
}

function wrappedRadians(value: number): number {
  let out = value % (2 * Math.PI);
  if (out > Math.PI) out -= 2 * Math.PI;
  if (out <= -Math.PI) out += 2 * Math.PI;
  return out;
}

function predictorScores(
  positionSummaries: Record<string, MacroErrorSummary>,
  contactSummaries: Record<string, MacroErrorSummary>,
  models: readonly string[],
  expectedGroups: number,
) {
  const currentPosition = requiredScoreSummary(
    positionSummaries[CURRENT_MODEL],
    `${CURRENT_MODEL} position`,
    expectedGroups,
  );
  const currentContact = requiredScoreSummary(
    contactSummaries[CURRENT_MODEL],
    `${CURRENT_MODEL} contact`,
    expectedGroups,
  );
  const components = [
    ["position", "precontact", "positionMae"],
    ["velocity", "contact", "velocityMae"],
    ["speed", "contact", "speedMae"],
    ["angle", "contact", "angleMaeDeg"],
  ] as const;
  const minimumImprovementPct = 1;
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
      position: position.positionMae / currentPosition.positionMae,
      velocity: contact.velocityMae / currentContact.velocityMae,
      speed: contact.speedMae / currentContact.speedMae,
      angle: contact.angleMaeDeg / currentContact.angleMaeDeg,
    };
    return {
      model,
      rawScore: mean(Object.values(ratios)),
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
  const alternativeImprovementPct = alternativeScore === null
    ? null
    : 100 * (currentScore - alternativeScore) / currentScore;
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
      components.map(([label]) => [label, 1 / components.length]),
    ),
    componentTruth: {
      position: "authored precontact, excluding rows whose truth frame was sampled",
      velocity: "authored contact",
      speed: "authored contact",
      angle: "authored contact",
    },
    coverage: {
      positionRows: currentPosition.rows,
      positionCaseSeedGroups: currentPosition.groups,
      contactRows: currentContact.rows,
      contactCaseSeedGroups: currentContact.groups,
    },
    models: modelScores.map((entry) => {
      const improvementPct = 100 * (currentScore - entry.rawScore) / currentScore;
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
    ];
  if (
    summary === undefined ||
    summary.rows <= 0 ||
    summary.groups !== expectedGroups ||
    values.some((value) => !Number.isFinite(value) || value <= 0)
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
    console.log("model                         rows   posMAE   velMAE  speedMAE angleMAE");
    for (const [model, summary] of Object.entries(summaries[target])
      .sort((a, b) => a[1].velocityMae - b[1].velocityMae)) {
      console.log(
        `${model.padEnd(29)} ${String(summary.rows).padStart(4)} ` +
        `${summary.positionMae.toFixed(3).padStart(8)} ` +
        `${summary.velocityMae.toFixed(4).padStart(8)} ` +
        `${summary.speedMae.toFixed(4).padStart(9)} ` +
        `${summary.angleMaeDeg.toFixed(3).padStart(8)}`,
      );
    }
  }
}

function printScores(score: ReturnType<typeof predictorScores>): void {
  console.log(
    `\noverall predictor score (lower is better; current = ${score.currentScore.toFixed(3)})`,
  );
  if (
    score.alternativeModel === null ||
    score.alternativeScore === null ||
    score.alternativeImprovementPct === null
  ) {
    console.log(`no alternative configured; current corpus is ready for the next experiment`);
  } else {
    console.log(
      `alternative ${score.alternativeModel} = ${score.alternativeScore.toFixed(4)}; ` +
        `${score.alternativeImprovementPct.toFixed(2)}% vs current; ` +
        `threshold ${score.minimumImprovementPct}%; decision ${score.decision}`,
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
