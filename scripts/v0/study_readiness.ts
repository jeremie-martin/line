/**
 * Frozen current-V2 next-arc readiness corpus and offline component evaluator.
 *
 * Collection observes the real candidate sampler at the entry contact of one
 * unbuilt arc. It retains failures as catchability truth, the proposal's
 * entry-contact impact as impact truth, and a study-only continuation through
 * that proposal's outgoing scorer gap as speed/air/elevation truth.
 *
 *   npm run benchmark:readiness:collect
 *   npm run benchmark:readiness
 */

import {
  createWriteStream,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { createGzip, gzipSync, gunzipSync } from "node:zlib";
import { applyJolt } from "../produce/seed.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "./benchmark_v2/model.ts";
import {
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
} from "./benchmark_v2/suite_model.ts";
import { compilerCandidateIdentity } from "./benchmark_v2/compiler_identity.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import {
  setCandidateSampleTraceSink,
  type CandidateSampleTrace,
} from "./optimizer/sample.ts";
import { setNormalPoolSnapshotHook } from "./optimizer/node.ts";
import {
  READINESS_FEATURE_TRANSFORM_ID,
  READINESS_FEATURE_NAMES as CANONICAL_READINESS_FEATURE_NAMES,
  readinessFeatureVector as canonicalReadinessFeatureVector,
  type ReadinessScorerGapContext,
} from "./optimizer/readiness_features.ts";
import { axisTargetQuality } from "./score.ts";
import {
  type AxisValues,
  type CandidateSampleMode,
  type Gap,
} from "./types.ts";
import type { SupportGeometryMode } from "./core/support_geometry.ts";
import {
  ballisticLaunchOf,
  cloneBallisticLaunchObservation,
  incomingKinematics,
  projectBallisticGap,
  type BallisticLaunchObservation,
  type BallisticState,
  type IncomingContactBoundary,
} from "./core/ballistic_projection.ts";
import {
  cloneConstraintBallisticState,
  constraintBallisticStateFromRider,
} from "./core/ballistic_micro_sim.ts";
import {
  engineLineFromTrackLine,
  measurementIndex,
} from "./core/substrate.ts";
import {
  sledPoseDegFromRider,
} from "../lib/detector.ts";
import { detectWindow } from "./core/candidate.ts";
import { measureGapAxes } from "./core/measure.ts";
import {
  arcProposalTargetsForGap,
  PRODUCTION_ARC_PROPOSAL_POLICY_ID,
  successorScorerGapAfter,
} from "./optimizer/arc_proposal.ts";
import {
  parseReadinessModelArtifact,
  type ReadinessModelArtifact,
} from "./optimizer/readiness_model_artifact.ts";
import {
  assertCompatibleReadinessArtifact,
  READINESS_TARGET_SEMANTICS_ID,
  scoreReadinessWithArtifact,
} from "./optimizer/readiness_scoring.ts";

type FrozenScorerGap = {
  index: number;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  endsWithContact: boolean;
  scorerTargets: AxisValues;
  proposalTargets: AxisValues;
  nextImpact: number | null;
};

type FrozenBoundaryState = Omit<BallisticState, "constraintState"> & {
  constraintState: NonNullable<BallisticState["constraintState"]> | null;
};

type FrozenIncomingBoundary = {
  targetFrame: number;
  preContactFrame: number;
  preContact: FrozenBoundaryState;
  incomingVelocityFrame: number;
  incoming: IncomingContactBoundary["incoming"];
  projectedContactFrame: number;
  projectedContact: FrozenBoundaryState;
};

type OutgoingTruth = {
  status: "complete" | "invalid_state" | "rider_ejected" | "sled_broken";
  achieved: {
    speed: number | null;
    air: number | null;
    elevation: number | null;
  };
  fit: {
    speed: number;
    air: number;
    elevation: number;
  };
};

type ReadinessAttempt = {
  proposalBatchId: number;
  attempt: number;
  viable: boolean;
  contactFrameOffset: -1 | 0 | 1 | null;
  impact: number | null;
  launch: BallisticLaunchObservation | null;
  outgoing: OutgoingTruth | null;
};

type ReadinessContext = {
  sourceId: string;
  seed: number;
  budget: number;
  ordinal: number;
  mode: CandidateSampleMode;
  policy: string;
  geometryTargets: AxisValues;
  supportGeometryMode: SupportGeometryMode | null;
  incomingGap: FrozenScorerGap;
  outgoingGap: FrozenScorerGap | null;
  predictedIncomingBoundary: FrozenIncomingBoundary | null;
  exactIncomingBoundary: FrozenIncomingBoundary | null;
  attempts: ReadinessAttempt[];
};

type ReadinessCorpus = {
  schema: "line.readiness-corpus.v6";
  generatedAt: string;
  compilerFingerprint: string;
  samplerFingerprint: string;
  protocol: {
    canonical: boolean;
    cases: "all-current-v2" | string[];
    budget: number;
    seeds: number[];
    contextCapPerCaseSeed: number;
    primaryPolicy: "normal_literal";
    generatorPolicyId: string;
    contextSelectionArtifactFingerprint: string;
  };
  cases: string[];
  joltMs: number;
  contexts: number;
  shards: Array<{
    sourceId: string;
    seed: number;
    path: string;
    contexts: number;
    predictedBoundaryContexts: number;
    seenContexts: number;
    attempts: number;
    retainedAttempts: number;
    viableAttempts: number;
    outgoingTruthAttempts: number;
    elapsedMs: number;
  }>;
};

type CollectionTask = {
  sourceId: string;
  seed: number;
  relativePath: string;
};

type CollectionTaskResult = {
  sourceId: string;
  seed: number;
  contexts: number;
  predictedBoundaryContexts: number;
  seenContexts: number;
  attempts: number;
  retainedAttempts: number;
  viableAttempts: number;
  outgoingTruthAttempts: number;
  elapsedMs: number;
  policies: Record<string, number>;
};

type ContextOwner = Map<string, ReservoirEntry | null>;
type ReservoirEntry = {
  priority: number;
  ordinal: number;
  context: ReadinessContext;
  owner: ContextOwner;
  ownerKey: string;
};

type ComponentPrediction = {
  catchability: number;
  speedFit: number | null;
  airFit: number | null;
  impactFeasibility: number;
  elevationFit: number | null;
  readiness: number | null;
};

type ReadinessModel = {
  name: string;
  changedComponent:
    | "catchability"
    | "speedFit"
    | "airFit"
    | "impactFeasibility"
    | "elevationFit";
  metadata?: unknown;
  predict: (
    row: ReadinessEvaluationRow,
    current: ComponentPrediction,
  ) => ComponentPrediction;
};

type ReadinessEvaluationRow = {
  sourceId: string;
  originFamily: string;
  sourceRole: string;
  seed: number;
  features: number[];
  current: ComponentPrediction;
  truth: {
    attempts: number;
    viable: number;
    impactFit: number | null;
    impactFitNoise: number | null;
    speedFit: number | null;
    airFit: number | null;
    elevationFit: number | null;
    speedFitNoise: number | null;
    airFitNoise: number | null;
    elevationFitNoise: number | null;
    utility: number;
    outgoingStatus: Record<OutgoingTruth["status"], number>;
    incomingBoundaryError: {
      precontactPositionPx: number;
      contactPositionPx: number;
      incomingVelocityPxPerFrame: number;
      incomingSpeedPxPerFrame: number;
      incomingAngleDeg: number | null;
      riderMountedMismatch: number | null;
      sledIntactMismatch: number | null;
    } | null;
  };
  authored: {
    impact: boolean;
    speed: boolean;
    air: boolean;
    elevation: boolean;
  };
};

type LossSummary = {
  groups: number;
  rows: number;
  score: number | null;
};

type ProbabilitySummary = {
  brier: LossSummary;
  logLoss: LossSummary;
  calibrationError: number | null;
  auc: number | null;
  positives: number;
  negatives: number;
};

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const collect = argv.includes("--collect");
const READINESS_BUDGET = 250_000;
const READINESS_SEEDS = [735_656_107, 735_656_108, 735_656_109] as const;
const READINESS_CONTEXT_CAP_PER_CASE_SEED = 1_024;
const READINESS_COLLECTION_JOBS = 48;
const PRIMARY_POLICY = "normal_literal";
const SAMPLER_FILES = [
  "scripts/lib/detector.ts",
  "scripts/v0/types.ts",
  "scripts/v0/score.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/optimizer/aim.ts",
  "scripts/v0/optimizer/arc_probe.ts",
  "scripts/v0/optimizer/arc_model.ts",
  "scripts/v0/optimizer/arc_vector_model.ts",
  "scripts/v0/optimizer/arc_control.ts",
  "scripts/v0/optimizer/arc_actuator.ts",
  "scripts/v0/optimizer/air_policy.ts",
  "scripts/v0/optimizer/impact_policy.ts",
  "scripts/v0/optimizer/arc_proposal.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/v0/optimizer/solver.ts",
  "scripts/v0/optimizer/node.ts",
  "scripts/v0/optimizer/objective.ts",
  "scripts/v0/optimizer/readiness.ts",
  "scripts/v0/optimizer/readiness_scoring.ts",
  "scripts/v0/optimizer/readiness_features.ts",
  "scripts/v0/optimizer/readiness_base_features.ts",
  "scripts/v0/optimizer/readiness_model_artifact.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/core/exit_read.ts",
  "scripts/v0/core/support_geometry.ts",
  "scripts/v0/core/ballistic_launch.ts",
  "scripts/v0/core/ballistic_micro_sim.ts",
  "scripts/v0/core/ballistic_projection.ts",
  "scripts/v0/core/measure.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/core/support_geometry.ts",
  "scripts/v0/score.ts",
  "scripts/v0/types.ts",
  "scripts/lib/detector.ts",
];

rejectFixedProtocolOverride("seed");
rejectFixedProtocolOverride("seeds");
rejectFixedProtocolOverride("budget");
rejectFixedProtocolOverride("budgets");

const outputPath = resolve(
  argValue("out") ?? "generated/analysis/readiness.json",
);
const trainingDatasetPath = argValue("export-dataset") === undefined
  ? null
  : resolve(
    argValue("export-dataset") ||
      "generated/analysis/readiness-training.jsonl.gz",
  );
const corpusPath = resolve(
  argValue("corpus") ?? "generated/analysis/readiness-corpus",
);
const runtimeModelPath = resolve(
  "scripts/v0/optimizer/readiness_model.json",
);
const incumbentArtifact = loadCompatibleIncumbentArtifact(
  runtimeModelPath,
);
const sourceManifestPath = resolve(
  "benchmark/v2/compat/source-manifest.json",
);
const suiteManifestPath = resolve(
  "benchmark/v2/compat/suite-manifest.json",
);
const sources = resolveSources(loadSourceManifest(sourceManifestPath));
const sourcesById = new Map(
  sources.map((source) => [source.id, source] as const),
);
const suite = loadSuiteManifest(suiteManifestPath, sources);
const casesArg = argValue("cases") ?? "all";
const sourceIds = casesArg === "all"
  ? canonicalMembers(suite)
  : list(casesArg);
const canonicalScope = casesArg === "all";
if (!collect && casesArg !== "all") {
  throw new Error(`--cases is a collection-only debugging option`);
}
if (collect && !canonicalScope && argValue("corpus") === undefined) {
  throw new Error(
    `a non-canonical collection requires an explicit --corpus path`,
  );
}
if (
  collect &&
  existsSync(corpusPath) &&
  !argv.includes("--replace-corpus")
) {
  throw new Error(
    `readiness corpus already exists at ${relativeToCwd(corpusPath)}; ` +
      `reuse it or pass --replace-corpus for an intentional reset`,
  );
}
for (const sourceId of sourceIds) {
  if (!sources.some((source) => source.id === sourceId)) {
    throw new Error(`unknown development case ${sourceId}`);
  }
}

const workerSourceId = argValue("_worker-source");
if (workerSourceId !== undefined) {
  const workerSeed = exactCanonicalSeed(argValue("_worker-seed"));
  const workerOutput = argValue("_worker-output");
  if (workerOutput === undefined) {
    throw new Error(`readiness worker output path is missing`);
  }
  const result = await collectCaseSeed(workerSourceId, workerSeed);
  writeFileSync(
    resolve(workerOutput),
    gzipSync(JSON.stringify(result.contexts), { level: 9 }),
  );
  const summary: CollectionTaskResult = {
    sourceId: result.sourceId,
    seed: result.seed,
    contexts: result.contexts.length,
    predictedBoundaryContexts: result.contexts.filter(
      (context) => context.predictedIncomingBoundary !== null,
    ).length,
    seenContexts: result.seenContexts,
    attempts: result.attempts,
    retainedAttempts: sum(
      result.contexts.map((context) => context.attempts.length),
    ),
    viableAttempts: sum(
      result.contexts.map((context) =>
        context.attempts.filter((attempt) => attempt.viable).length
      ),
    ),
    outgoingTruthAttempts: sum(
      result.contexts.map((context) =>
        context.attempts.filter((attempt) => attempt.outgoing !== null).length
      ),
    ),
    elapsedMs: result.elapsedMs,
    policies: countBy(result.contexts.map((context) => context.policy)),
  };
  await new Promise<void>((resolveWrite, rejectWrite) => {
    process.stdout.write(JSON.stringify(summary), (error) => {
      if (error) rejectWrite(error);
      else resolveWrite();
    });
  });
  process.exit(0);
}

const corpus = collect ? await collectCorpus() : loadCorpus();
const evaluationRows = [...buildEvaluationRows(corpus)];
if (trainingDatasetPath !== null) {
  await writeTrainingDataset(
    corpus,
    evaluationRows,
    trainingDatasetPath,
  );
  console.log(
    `readiness training dataset: ${relativeToCwd(trainingDatasetPath)}`,
  );
  process.exit(0);
}
const alternative: ReadinessModel | null = null;
const models: ReadinessModel[] = [
  {
    name: "current",
    changedComponent: "catchability",
    predict: (_context, current) => current,
  },
  ...(alternative === null ? [] : [alternative]),
];
const report = evaluateCorpus(
  corpus,
  evaluationRows,
  models,
  alternative,
);
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
printReport(report);
console.log(`\nreport: ${relativeToCwd(outputPath)}`);

function componentAxis(
  component: "impactFit" | "speedFit" | "airFit" | "elevationFit",
): "impact" | "speed" | "air" | "elevation" {
  return component === "impactFit"
    ? "impact"
    : component === "speedFit"
    ? "speed"
    : component === "airFit"
    ? "air"
    : "elevation";
}

function modelIncoming(boundary: FrozenIncomingBoundary) {
  return {
    ...boundary.incoming,
    ...(typeof boundary.incoming.riderMounted === "boolean"
      ? { riderMounted: boundary.incoming.riderMounted }
      : {}),
    ...(typeof boundary.incoming.sledIntact === "boolean"
      ? { sledIntact: boundary.incoming.sledIntact }
      : {}),
  };
}

function thawIncomingBoundary(
  boundary: FrozenIncomingBoundary,
): IncomingContactBoundary {
  const thawState = (state: FrozenBoundaryState): BallisticState => ({
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    speed: state.speed,
    comAngleDeg: state.comAngleDeg,
    sledPoseDeg: state.sledPoseDeg,
    sledPoseRateDegPerFrame: state.sledPoseRateDegPerFrame,
    ...(state.constraintState === null
      ? {}
      : { constraintState: state.constraintState }),
  });
  return {
    targetFrame: boundary.targetFrame,
    preContactFrame: boundary.preContactFrame,
    preContact: thawState(boundary.preContact),
    incomingVelocityFrame: boundary.incomingVelocityFrame,
    incoming: modelIncoming(boundary),
    projectedContactFrame: boundary.projectedContactFrame,
    projectedContact: thawState(boundary.projectedContact),
  };
}

function thawScorerGap(
  gap: FrozenScorerGap,
): ReadinessScorerGapContext {
  return {
    startFrame: gap.startFrame,
    endFrame: gap.endFrame,
    frameCount: gap.frameCount,
    endsWithContact: gap.endsWithContact,
    scorerTargets: gap.scorerTargets,
    proposalTargets: gap.proposalTargets,
    ...(gap.nextImpact === null ? {} : { nextImpact: gap.nextImpact }),
  };
}

async function collectCorpus(): Promise<ReadinessCorpus> {
  const compilerFingerprint =
    compilerCandidateIdentity("wasm").candidateFingerprint;
  const samplerFingerprint = fingerprintFiles(SAMPLER_FILES);
  const rawTasks = sourceIds.flatMap((sourceId) =>
    READINESS_SEEDS.map((seed) => ({ sourceId, seed }))
  );
  mkdirSync(dirname(corpusPath), { recursive: true });
  const stagingPath = mkdtempSync(`${corpusPath}.tmp-`);
  mkdirSync(resolve(stagingPath, "shards"), { recursive: true });
  const tasks: CollectionTask[] = rawTasks.map((task, index) => ({
    ...task,
    relativePath:
      `shards/${String(index).padStart(3, "0")}-${safeFilename(task.sourceId)}-s${task.seed}.json.gz`,
  }));
  const shards = new Array<ReadinessCorpus["shards"][number]>(tasks.length);
  console.error(
    `collecting ${tasks.length} readiness shards with ` +
      `${Math.min(READINESS_COLLECTION_JOBS, tasks.length)} workers`,
  );
  try {
    await parallelCollectionTasks(tasks, stagingPath, (result, index) => {
      const task = tasks[index];
      if (
        result.sourceId !== task.sourceId ||
        result.seed !== task.seed
      ) {
        throw new Error(`readiness worker returned mismatched metadata`);
      }
      if (!existsSync(resolve(stagingPath, task.relativePath))) {
        throw new Error(`readiness worker did not write ${task.relativePath}`);
      }
      shards[index] = {
        sourceId: result.sourceId,
        seed: result.seed,
        path: task.relativePath,
        contexts: result.contexts,
        predictedBoundaryContexts: result.predictedBoundaryContexts,
        seenContexts: result.seenContexts,
        attempts: result.attempts,
        retainedAttempts: result.retainedAttempts,
        viableAttempts: result.viableAttempts,
        outgoingTruthAttempts: result.outgoingTruthAttempts,
        elapsedMs: result.elapsedMs,
      };
      console.error(
        `${result.sourceId}/s${result.seed}/${READINESS_BUDGET}: ` +
          `${result.attempts} attempts in ${result.seenContexts} contexts, ` +
          `retained ${result.contexts} ` +
          `(${result.predictedBoundaryContexts} predicted boundaries, ` +
          `${result.outgoingTruthAttempts} outgoing truths) ` +
          `(${Object.entries(result.policies)
            .map(([key, value]) => `${key} ${value}`)
            .join(", ")}), ${result.elapsedMs.toFixed(0)} ms`,
      );
    });
    if (fingerprintFiles(SAMPLER_FILES) !== samplerFingerprint) {
      throw new Error(`sampler sources changed during readiness collection`);
    }
    const manifest: ReadinessCorpus = {
      schema: "line.readiness-corpus.v6",
      generatedAt: new Date().toISOString(),
      compilerFingerprint,
      samplerFingerprint,
      protocol: {
        canonical: canonicalScope,
        cases: canonicalScope ? "all-current-v2" : sourceIds,
        budget: READINESS_BUDGET,
        seeds: [...READINESS_SEEDS],
        contextCapPerCaseSeed: READINESS_CONTEXT_CAP_PER_CASE_SEED,
        primaryPolicy: PRIMARY_POLICY,
        generatorPolicyId: PRODUCTION_ARC_PROPOSAL_POLICY_ID,
        contextSelectionArtifactFingerprint: incumbentArtifact === null
          ? "neutral-bootstrap"
          : readinessArtifactFingerprint(runtimeModelPath),
      },
      cases: sourceIds,
      joltMs: suite.transform.jolt_ms,
      contexts: shards.reduce((sum, shard) => sum + shard.contexts, 0),
      shards,
    };
    writeFileSync(
      resolve(stagingPath, "manifest.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );
    installCollectedCorpus(stagingPath);
    console.error(
      `corpus: ${relativeToCwd(corpusPath)} ` +
        `(${manifest.contexts} contexts, ${shards.length} shards)`,
    );
    return manifest;
  } catch (error) {
    rmSync(stagingPath, { recursive: true, force: true });
    throw error;
  }
}

async function collectCaseSeed(
  sourceId: string,
  seed: number,
): Promise<{
  sourceId: string;
  seed: number;
  seenContexts: number;
  attempts: number;
  elapsedMs: number;
  contexts: ReadinessContext[];
}> {
  const source = sources.find((entry) => entry.id === sourceId);
  if (source === undefined) throw new Error(`unknown source ${sourceId}`);
  const spec = applyJolt(
    await loadSourceSpec(source),
    suite.transform.jolt_ms,
  );
  const started = performance.now();
  const reservoir: ReservoirEntry[] = [];
  const byEngine = new WeakMap<object, ContextOwner>();
  let seenContexts = 0;
  let attempts = 0;

  setCandidateSampleTraceSink((trace) => {
    if (!isPrimaryTrace(trace)) return;
    attempts++;
    let owner = byEngine.get(trace.contextKey);
    if (owner === undefined) {
      owner = new Map();
      byEngine.set(trace.contextKey, owner);
    }
    const ownerKey = traceContextKey(trace);
    let entry = owner.get(ownerKey);
    if (entry === undefined) {
      const ordinal = seenContexts++;
      const priority = contextPriority(
        sourceId,
        seed,
        ordinal,
        trace,
      );
      if (
        !reservoirWouldRetain(
          reservoir,
          priority,
          ordinal,
          READINESS_CONTEXT_CAP_PER_CASE_SEED,
        )
      ) {
        owner.set(ownerKey, null);
        return;
      }
      entry = {
        priority,
        ordinal,
        context: emptyContext(sourceId, seed, ordinal, trace),
        owner,
        ownerKey,
      };
      retainInReservoir(
        reservoir,
        entry,
        READINESS_CONTEXT_CAP_PER_CASE_SEED,
      );
      owner.set(ownerKey, entry);
    }
    if (entry === null) return;
    recordAttempt(entry.context, trace);
  });
  setNormalPoolSnapshotHook((record) => {
    const owner = byEngine.get(record.node.prefixEngine);
    const entry = owner === undefined
      ? undefined
      : [...owner.values()].find(
        (candidate) =>
          candidate !== null &&
          candidate.context.incomingGap.index === record.gapIndex &&
          candidate.context.policy === PRIMARY_POLICY,
      );
    if (entry === undefined || entry === null) return;
    const exactBoundary = captureExactIncomingBoundary(
      record.node.prefixEngine,
      entry.context.incomingGap.endFrame,
    );
    if (exactBoundary !== null) {
      assertStableBoundary(
        entry.context.exactIncomingBoundary,
        exactBoundary,
        "exact",
      );
      entry.context.exactIncomingBoundary = exactBoundary;
    }
    const predecessor = [...record.node.prefixFits]
      .reverse()
      .find((fit) => fit !== null);
    if (predecessor === undefined || predecessor === null) return;
    const launch = ballisticLaunchOf(predecessor);
    if (
      launch === undefined ||
      launch.gapStartFrame !== entry.context.incomingGap.startFrame
    ) return;
    const projection = projectBallisticGap(
      launch,
      entry.context.incomingGap.endFrame,
      {},
    );
    if (projection === null) return;
    const predictedBoundary = freezeIncomingBoundary(projection.boundary);
    assertStableBoundary(
      entry.context.predictedIncomingBoundary,
      predictedBoundary,
      "predicted",
    );
    entry.context.predictedIncomingBoundary = predictedBoundary;
  });
  try {
    compileHandoff(spec, seed, { budget: READINESS_BUDGET });
  } finally {
    setCandidateSampleTraceSink(null);
    setNormalPoolSnapshotHook(null);
  }
  return {
    sourceId,
    seed,
    seenContexts,
    attempts,
    elapsedMs: performance.now() - started,
    contexts: reservoir
      .sort((a, b) => a.ordinal - b.ordinal)
      .map((entry) => entry.context),
  };
}

function emptyContext(
  sourceId: string,
  seed: number,
  ordinal: number,
  trace: CandidateSampleTrace,
): ReadinessContext {
  const geometryTargets = finiteAxisValues(trace.geometryTargets);
  const proposalTargets = finiteAxisValues(trace.gap.targets);
  const expectedGeometryTargets = trace.specContext.gaps === undefined
    ? proposalTargets
    : arcProposalTargetsForGap(trace.gap, trace.specContext.gaps);
  const literal =
    trace.mode === "normal" &&
    trace.supportGeometryMode === undefined &&
    axisValuesKey(geometryTargets) ===
      axisValuesKey(expectedGeometryTargets);
  const incomingGap = freezeScorerGap(trace.gap, trace.specContext);
  const outgoingGap = nextScorerGap(trace.gap, trace.specContext);
  return {
    sourceId,
    seed,
    budget: READINESS_BUDGET,
    ordinal,
    mode: trace.mode,
    policy: literal
      ? PRIMARY_POLICY
      : [
        trace.mode,
        trace.supportGeometryMode ?? "default-support",
        axisValuesKey(geometryTargets) === axisValuesKey(proposalTargets)
          ? "literal"
          : "retargeted",
      ].join(":"),
    geometryTargets,
    supportGeometryMode: trace.supportGeometryMode ?? null,
    incomingGap,
    outgoingGap,
    predictedIncomingBoundary: null,
    exactIncomingBoundary: null,
    attempts: [],
  };
}

function isPrimaryTrace(trace: CandidateSampleTrace): boolean {
  const expectedGeometryTargets = trace.specContext.gaps === undefined
    ? trace.gap.targets
    : arcProposalTargetsForGap(trace.gap, trace.specContext.gaps);
  return trace.mode === "normal" &&
    Number.isSafeInteger(trace.proposalBatchId) &&
    trace.supportGeometryMode === undefined &&
    axisValuesKey(trace.geometryTargets) ===
      axisValuesKey(expectedGeometryTargets);
}

function recordAttempt(
  context: ReadinessContext,
  trace: CandidateSampleTrace,
): void {
  if (trace.proposalBatchId === null) {
    throw new Error(`primary readiness trace has no proposal batch identity`);
  }
  const duplicate = context.attempts.find(
    (attempt) =>
      attempt.proposalBatchId === trace.proposalBatchId &&
      attempt.attempt === trace.attempt,
  );
  if (duplicate !== undefined) {
    const impact = trace.fit === null
      ? null
      : finite(trace.fit.achieved.impact);
    if (
      duplicate.viable !== (trace.fit !== null) ||
      duplicate.contactFrameOffset !==
        (trace.fit?.contactFrameOffset ?? null) ||
      duplicate.impact !== impact
    ) {
      throw new Error(
        `one deterministic proposal draw produced conflicting outcomes`,
      );
    }
    return;
  }
  if (trace.fit === null) {
    context.attempts.push({
      proposalBatchId: trace.proposalBatchId,
      attempt: trace.attempt,
      viable: false,
      contactFrameOffset: null,
      impact: null,
      launch: null,
      outgoing: null,
    });
    return;
  }
  const impact = finite(trace.fit.achieved.impact);
  const contactFrameOffset = trace.fit.contactFrameOffset;
  if (contactFrameOffset === undefined) {
    throw new Error(`viable readiness attempt has no contact-frame offset`);
  }
  context.attempts.push({
    proposalBatchId: trace.proposalBatchId,
    attempt: trace.attempt,
    viable: true,
    contactFrameOffset,
    impact,
    launch: ballisticLaunchOf(trace.fit) === undefined
      ? null
      : cloneBallisticLaunchObservation(ballisticLaunchOf(trace.fit)!),
    outgoing: context.outgoingGap === null
      ? null
      : captureOutgoingTruth(trace, context.outgoingGap),
  });
}

function freezeScorerGap(
  gap: Gap,
  specContext: CandidateSampleTrace["specContext"],
): FrozenScorerGap {
  return {
    index: gap.index,
    startFrame: gap.startFrame,
    endFrame: gap.endFrame,
    frameCount: gap.endFrame - gap.startFrame + 1,
    endsWithContact: gap.endsWithContact,
    scorerTargets: finiteAxisValues(
      specContext.gapAxisTargets?.[gap.index] ?? gap.targets,
    ),
    proposalTargets: finiteAxisValues(gap.targets),
    nextImpact: finite(gap.nextImpact) ?? null,
  };
}

function nextScorerGap(
  incomingGap: Gap,
  specContext: CandidateSampleTrace["specContext"],
): FrozenScorerGap | null {
  if (specContext.gaps === undefined) return null;
  const next = successorScorerGapAfter(incomingGap, specContext.gaps);
  return next === null ? null : freezeScorerGap(next, specContext);
}

function assertStableBoundary(
  existing: FrozenIncomingBoundary | null,
  next: FrozenIncomingBoundary,
  kind: "exact" | "predicted",
): void {
  if (
    existing !== null &&
    JSON.stringify(existing) !== JSON.stringify(next)
  ) {
    throw new Error(
      `${kind} incoming boundary changed within one immutable context`,
    );
  }
}

function freezeIncomingBoundary(
  boundary: IncomingContactBoundary,
): FrozenIncomingBoundary {
  return {
    targetFrame: boundary.targetFrame,
    preContactFrame: boundary.preContactFrame,
    preContact: freezeBoundaryState(boundary.preContact),
    incomingVelocityFrame: boundary.incomingVelocityFrame,
    incoming: { ...boundary.incoming },
    projectedContactFrame: boundary.projectedContactFrame,
    projectedContact: freezeBoundaryState(boundary.projectedContact),
  };
}

function freezeBoundaryState(state: BallisticState): FrozenBoundaryState {
  return {
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    speed: state.speed,
    comAngleDeg: state.comAngleDeg,
    sledPoseDeg: state.sledPoseDeg,
    sledPoseRateDegPerFrame: state.sledPoseRateDegPerFrame,
    constraintState: state.constraintState === undefined
      ? null
      : cloneConstraintBallisticState(state.constraintState),
  };
}

// deno-lint-ignore no-explicit-any
function captureExactIncomingBoundary(
  engine: any,
  targetFrame: number,
): FrozenIncomingBoundary | null {
  if (!Number.isSafeInteger(targetFrame) || targetFrame < 1) return null;
  try {
    const contactRider = engine.getRider(targetFrame);
    const preContactRider = engine.getRider(targetFrame - 1);
    const preContact = boundaryStateFromRider(preContactRider, null);
    const contactPose = sledPoseDegFromRider(contactRider);
    const preContactPose = sledPoseDegFromRider(preContactRider);
    const poseRate = contactPose === null || preContactPose === null
      ? null
      : wrappedDegrees(contactPose - preContactPose);
    const contact = boundaryStateFromRider(contactRider, poseRate);
    if (preContact === null || contact === null) return null;
    return {
      targetFrame,
      preContactFrame: targetFrame - 1,
      preContact,
      incomingVelocityFrame: targetFrame,
      incoming: incomingKinematics({
        ...contact,
        ...(contact.constraintState === null
          ? {}
          : { constraintState: contact.constraintState }),
      }),
      projectedContactFrame: targetFrame,
      projectedContact: contact,
    };
  } catch {
    return null;
  }
}

// deno-lint-ignore no-explicit-any
function boundaryStateFromRider(
  rider: any,
  poseRate: number | null,
): FrozenBoundaryState | null {
  const position = rider?.position;
  const velocity = rider?.velocity;
  if (
    position === undefined ||
    velocity === undefined ||
    !Number.isFinite(position.x) ||
    !Number.isFinite(position.y) ||
    !Number.isFinite(velocity.x) ||
    !Number.isFinite(velocity.y)
  ) return null;
  const speed = Math.hypot(velocity.x, velocity.y);
  const constraintState = constraintBallisticStateFromRider(rider);
  return {
    x: position.x,
    y: position.y,
    vx: velocity.x,
    vy: velocity.y,
    speed,
    comAngleDeg: speed > 0
      ? Math.atan2(velocity.y, velocity.x) * 180 / Math.PI
      : null,
    sledPoseDeg: sledPoseDegFromRider(rider),
    sledPoseRateDegPerFrame: poseRate,
    constraintState,
  };
}

function captureOutgoingTruth(
  trace: CandidateSampleTrace,
  outgoingGap: FrozenScorerGap,
): OutgoingTruth {
  const invalid = (
    status: Exclude<OutgoingTruth["status"], "complete">,
  ): OutgoingTruth => ({
    status,
    achieved: { speed: null, air: null, elevation: null },
    fit: {
      speed: targetQuality(null, outgoingGap.scorerTargets.speed),
      air: targetQuality(null, outgoingGap.scorerTargets.air),
      elevation: targetQuality(
        null,
        outgoingGap.scorerTargets.elevation,
      ),
    },
  });
  if (trace.fit === null) return invalid("invalid_state");

  try {
    // deno-lint-ignore no-explicit-any
    const engine: any = (trace.contextKey as any).addLine(
      trace.fit.lines.map((line) => engineLineFromTrackLine(line)),
    );
    const gap: Gap = {
      index: outgoingGap.index,
      startFrame: outgoingGap.startFrame,
      endFrame: outgoingGap.endFrame,
      endsWithContact: outgoingGap.endsWithContact,
      targets: outgoingGap.scorerTargets,
      ...(outgoingGap.nextImpact === null
        ? {}
        : { nextImpact: outgoingGap.nextImpact }),
    };
    const detection = detectWindow(
      engine,
      outgoingGap.startFrame,
      outgoingGap.endFrame,
    );
    if (detection.terminus.reason !== "endOfSpec") {
      if (detection.terminus.reason === "riderEjected") {
        return invalid("rider_ejected");
      }
      if (detection.terminus.reason === "sledBroken") {
        return invalid("sled_broken");
      }
      return invalid("invalid_state");
    }
    const terminalIndex = measurementIndex(
      detection,
      outgoingGap.endFrame,
    );
    if (terminalIndex < 0) return invalid("invalid_state");
    // A future catch is deliberately not constructed. The scorer contract
    // nevertheless owns an authored contact at this terminal frame, so only
    // its air-occupancy bit is canonicalized to grounded. Position, velocity,
    // speed, and elevation remain the exact collision-free continuation.
    if (outgoingGap.endsWithContact) {
      detection.measurements.airborne[terminalIndex] = false;
    }
    const achieved = measureGapAxes(
      detection,
      gap,
      trace.fit.lines,
      outgoingGap.endFrame,
    );
    const speed = finite(achieved.speed);
    const air = finite(achieved.air);
    const elevation = finite(achieved.elevation);
    if (speed === null || air === null) return invalid("invalid_state");
    return {
      status: "complete",
      achieved: { speed, air, elevation },
      fit: {
        speed: targetQuality(speed, outgoingGap.scorerTargets.speed),
        air: targetQuality(air, outgoingGap.scorerTargets.air),
        elevation: targetQuality(
          elevation,
          outgoingGap.scorerTargets.elevation,
        ),
      },
    };
  } catch {
    return invalid("invalid_state");
  }
}

function wrappedDegrees(value: number): number {
  return ((value + 180) % 360 + 360) % 360 - 180;
}

function targetQuality(
  achieved: number | null,
  target: number | undefined,
): number {
  return axisTargetQuality(target, achieved);
}

function* buildEvaluationRows(
  corpus: ReadinessCorpus,
): Generator<ReadinessEvaluationRow> {
  for (const context of corpusContexts(corpus)) {
    if (
      context.policy !== PRIMARY_POLICY ||
      context.predictedIncomingBoundary === null
    ) continue;
    const outgoingStatus: Record<OutgoingTruth["status"], number> = {
      complete: 0,
      invalid_state: 0,
      rider_ejected: 0,
      sled_broken: 0,
    };
    let viable = 0;
    for (const attempt of context.attempts) {
      if (attempt.viable) viable++;
      if (attempt.outgoing !== null) {
        outgoingStatus[attempt.outgoing.status]++;
      }
    }
    const modelInput = {
      incomingBoundary: thawIncomingBoundary(
        context.predictedIncomingBoundary,
      ),
      incomingGap: thawScorerGap(context.incomingGap),
      outgoingGap: context.outgoingGap === null
        ? null
        : thawScorerGap(context.outgoingGap),
      generatorPolicyId: PRODUCTION_ARC_PROPOSAL_POLICY_ID,
    };
    const canonicalFeatures = canonicalReadinessFeatureVector(modelInput);
    const current = currentPrediction(modelInput);
    const source = sourcesById.get(context.sourceId);
    if (source === undefined) {
      throw new Error(`unknown readiness corpus source ${context.sourceId}`);
    }
    yield {
      sourceId: context.sourceId,
      originFamily: source.originFamily,
      sourceRole: source.role,
      seed: context.seed,
      features: canonicalFeatures,
      current,
      truth: {
        attempts: context.attempts.length,
        viable,
        impactFit: realizedImpactFit(context),
        impactFitNoise: impactFitMeanNoise(context),
        speedFit: realizedConditionalFit(context, "speed"),
        airFit: realizedConditionalFit(context, "air"),
        elevationFit: realizedConditionalFit(context, "elevation"),
        speedFitNoise: conditionalFitMeanNoise(context, "speed"),
        airFitNoise: conditionalFitMeanNoise(context, "air"),
        elevationFitNoise: conditionalFitMeanNoise(
          context,
          "elevation",
        ),
        utility: realizedContextUtility(context),
        outgoingStatus,
        incomingBoundaryError: context.exactIncomingBoundary === null
          ? null
          : incomingBoundaryError(
            context.predictedIncomingBoundary,
            context.exactIncomingBoundary,
          ),
      },
      authored: {
        impact:
          context.incomingGap.scorerTargets.impact !== undefined,
        speed:
          context.outgoingGap?.scorerTargets.speed !== undefined,
        air: context.outgoingGap?.scorerTargets.air !== undefined,
        elevation:
          context.outgoingGap?.scorerTargets.elevation !== undefined,
      },
    };
  }
}

function incomingBoundaryError(
  predicted: FrozenIncomingBoundary,
  exact: FrozenIncomingBoundary,
): ReadinessEvaluationRow["truth"]["incomingBoundaryError"] {
  if (
    predicted.targetFrame !== exact.targetFrame ||
    predicted.preContactFrame !== exact.preContactFrame ||
    predicted.incomingVelocityFrame !== exact.incomingVelocityFrame ||
    predicted.projectedContactFrame !== exact.projectedContactFrame
  ) {
    throw new Error(`predicted and exact readiness boundaries are misaligned`);
  }
  return {
    precontactPositionPx: Math.hypot(
      predicted.preContact.x - exact.preContact.x,
      predicted.preContact.y - exact.preContact.y,
    ),
    contactPositionPx: Math.hypot(
      predicted.projectedContact.x - exact.projectedContact.x,
      predicted.projectedContact.y - exact.projectedContact.y,
    ),
    incomingVelocityPxPerFrame: Math.hypot(
      predicted.incoming.vx - exact.incoming.vx,
      predicted.incoming.vy - exact.incoming.vy,
    ),
    incomingSpeedPxPerFrame: Math.abs(
      predicted.incoming.speed - exact.incoming.speed,
    ),
    incomingAngleDeg:
      predicted.incoming.comAngleDeg === null ||
        exact.incoming.comAngleDeg === null
        ? null
        : Math.abs(wrappedDegrees(
          predicted.incoming.comAngleDeg - exact.incoming.comAngleDeg,
        )),
    riderMountedMismatch: bindingMismatch(
      predicted.incoming.riderMounted,
      exact.incoming.riderMounted,
    ),
    sledIntactMismatch: bindingMismatch(
      predicted.incoming.sledIntact,
      exact.incoming.sledIntact,
    ),
  };
}

function bindingMismatch(
  predicted: boolean | undefined,
  exact: boolean | undefined,
): number | null {
  return predicted === undefined || exact === undefined
    ? null
    : predicted === exact
    ? 0
    : 1;
}

async function writeTrainingDataset(
  corpus: ReadinessCorpus,
  rows: readonly ReadinessEvaluationRow[],
  path: string,
): Promise<void> {
  for (const row of rows) {
    if (row.features.length !== CANONICAL_READINESS_FEATURE_NAMES.length) {
      throw new Error(
        `${row.sourceId}/s${row.seed}: readiness feature vector has ` +
          `${row.features.length} values for ` +
          `${CANONICAL_READINESS_FEATURE_NAMES.length} names`,
      );
    }
  }
  const developmentSeeds = new Set<number>(READINESS_SEEDS.slice(0, 2));
  const validationSeeds = new Set<number>(READINESS_SEEDS.slice(2));
  const records = function* (): Generator<string> {
    yield `${JSON.stringify({
      kind: "metadata",
      schema: "line.readiness-training-dataset.v3",
      generatedAt: new Date().toISOString(),
      corpus: {
        schema: corpus.schema,
        compilerFingerprint: corpus.compilerFingerprint,
        samplerFingerprint: corpus.samplerFingerprint,
        contextSelectionArtifactFingerprint:
          corpus.protocol.contextSelectionArtifactFingerprint,
        generatorPolicyId: corpus.protocol.generatorPolicyId,
        budget: corpus.protocol.budget,
        seeds: corpus.protocol.seeds,
        cases: corpus.cases,
      },
      rows: rows.length,
      featureTransformId: READINESS_FEATURE_TRANSFORM_ID,
      targetSemanticsId: READINESS_TARGET_SEMANTICS_ID,
      featureNames: CANONICAL_READINESS_FEATURE_NAMES,
      incumbent: incumbentArtifact === null
        ? null
        : {
          schema: incumbentArtifact.schema,
          generatorPolicyId: incumbentArtifact.generatorPolicyId,
          featureTransformId: incumbentArtifact.featureTransformId,
          targetSemanticsId: incumbentArtifact.targetSemanticsId,
          trainingCorpus: incumbentArtifact.trainingCorpus,
        },
      partitions: {
        developmentSeeds: [...developmentSeeds],
        validationSeeds: [...validationSeeds],
      },
      grouping: {
        crossValidation: "originFamily",
        scoring: "sourceId/seed",
      },
      targets: {
        catchability: "viable / attempts",
        impactFeasibility:
          "mean scorer-compatible entry-impact fit, conditional on viable",
        speedFit:
          "mean outgoing scorer-gap speed fit, conditional on viable",
        airFit:
          "mean outgoing scorer-gap air fit, conditional on viable",
        elevationFit:
          "mean outgoing scorer-gap elevation fit, conditional on viable",
        readiness:
          "mean joint utility of one proposal; failures have utility zero",
      },
    })}\n`;
    for (const row of rows) {
      const partition = developmentSeeds.has(row.seed)
        ? "development"
        : validationSeeds.has(row.seed)
        ? "validation"
        : null;
      if (partition === null) {
        throw new Error(`unpartitioned readiness seed ${row.seed}`);
      }
      yield `${JSON.stringify({
        kind: "row",
        sourceId: row.sourceId,
        originFamily: row.originFamily,
        sourceRole: row.sourceRole,
        seed: row.seed,
        partition,
        features: row.features,
        current: row.current,
        truth: row.truth,
        authored: row.authored,
      })}\n`;
    }
  };

  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}`;
  rmSync(temporaryPath, { force: true });
  try {
    await pipeline(
      Readable.from(records()),
      createGzip({ level: 6 }),
      createWriteStream(temporaryPath),
    );
    renameSync(temporaryPath, path);
  } finally {
    rmSync(temporaryPath, { force: true });
  }
}

function evaluateCorpus(
  corpus: ReadinessCorpus,
  allRows: readonly ReadinessEvaluationRow[],
  models: ReadinessModel[],
  alternative: ReadinessModel | null,
) {
  const partitions = {
    development: new Set<number>(READINESS_SEEDS.slice(0, 2)),
    validation: new Set<number>(READINESS_SEEDS.slice(2)),
  };
  const evaluation = Object.fromEntries(
    Object.entries(partitions).map(([partition, seeds]) => {
      const rows = allRows.filter((row) => seeds.has(row.seed));
      const truth = truthCoverage(rows);
      const groups = truth.groups;
      const expectedGroups = corpus.cases.length * seeds.size;
      if (groups !== expectedGroups) {
        throw new Error(
          `readiness ${partition} boundary coverage spans ${groups}/` +
            `${expectedGroups} case-seed groups`,
        );
      }
      return [
        partition,
        {
          contexts: truth.contexts,
          attempts: truth.attempts,
          groups,
          truth,
          models: Object.fromEntries(
            models.map((model) => [
              model.name,
              evaluateModel(rows, model),
            ]),
          ),
        },
      ];
    }),
  );
  for (const [partition, value] of Object.entries(evaluation) as Array<
    [string, { contexts: number; attempts: number }]
  >) {
    if (value.contexts === 0 || value.attempts === 0) {
      throw new Error(
        `readiness ${partition} partition has no boundary-labeled primary contexts`,
      );
    }
  }
  const decision = alternative === null
    ? {
      alternative: null,
      changedComponent: null,
      minimumImprovementPct: 1,
      verdict: "no_alternative",
    }
    : decideAlternative(evaluation, alternative);
  const references = componentReferences(allRows);
  assertFiniteNumbers(evaluation, "evaluation");
  assertFiniteNumbers(decision, "decision");
  assertFiniteNumbers(references, "references");
  return {
    schema: "line.readiness-evaluation.v3",
    generatedAt: new Date().toISOString(),
    corpus: {
      path: relativeToCwd(corpusPath),
      schema: corpus.schema,
      contexts: corpus.contexts,
      predictedBoundaryContexts: corpus.shards.reduce(
        (sum, shard) => sum + shard.predictedBoundaryContexts,
        0,
      ),
      shards: corpus.shards.length,
      seenContexts: sum(corpus.shards.map((shard) => shard.seenContexts)),
      observedAttempts: sum(corpus.shards.map((shard) => shard.attempts)),
      retainedAttempts: sum(
        corpus.shards.map((shard) => shard.retainedAttempts),
      ),
      viableAttempts: sum(
        corpus.shards.map((shard) => shard.viableAttempts),
      ),
      outgoingTruthAttempts: sum(
        corpus.shards.map((shard) => shard.outgoingTruthAttempts),
      ),
      cases: corpus.cases.length,
      seeds: corpus.protocol.seeds,
      budget: corpus.protocol.budget,
      primaryPolicy: corpus.protocol.primaryPolicy,
      samplerFingerprint: corpus.samplerFingerprint,
      contextSelectionArtifactFingerprint:
        corpus.protocol.contextSelectionArtifactFingerprint,
    },
    modelNames: models.map((model) => model.name),
    modelMetadata: Object.fromEntries(
      models.flatMap((model) =>
        model.metadata === undefined
          ? []
          : [[model.name, model.metadata]]
      ),
    ),
    semantics: {
      decisionBoundary:
        "predicted incoming state at the entry contact of the unbuilt arc",
      catchability:
        "P(one normal/literal proposal for that unbuilt arc is viable)",
      impactFeasibility:
        "E[scorer-compatible entry-impact target fit | viable proposal]",
      speedFit:
        "E[outgoing scorer-gap speed target fit | viable proposal]",
      airFit:
        "E[outgoing scorer-gap air target fit | viable proposal]",
      elevationFit:
        "E[outgoing scorer-gap elevation target fit | viable proposal]",
      composite:
        "mean realized joint utility of one proposal; failures have utility 0",
      targetOwnership:
        "entry impact belongs to incomingGap; speed/air/elevation belong to outgoingGap",
      currentModelStatus:
        incumbentArtifact === null
          ? "no policy-compatible incumbent artifact; bootstrap reference is neutral"
          : "the checked-in policy-compatible readiness artifact",
    },
    references,
    evaluation,
    decision,
  };
}

function componentReferences(
  rows: readonly ReadinessEvaluationRow[],
) {
  const developmentSeeds = new Set<number>(READINESS_SEEDS.slice(0, 2));
  const validationSeeds = new Set<number>(READINESS_SEEDS.slice(2));
  return Object.fromEntries(
    ([
      "impactFit",
      "speedFit",
      "airFit",
      "elevationFit",
    ] as const).map(
      (component) => {
        const development = rows.filter(
          (row) =>
            developmentSeeds.has(row.seed) &&
            row.authored[componentAxis(component)] &&
            row.truth[component] !== null,
        );
        const constant = groupBalancedMean(development, component);
        return [
          component,
          {
            developmentMeanConstant: constant,
            developmentMse: constantMappingMse(
              development,
              component,
              constant,
            ),
            validationMse: constantMappingMse(
              rows.filter(
                (row) =>
                  validationSeeds.has(row.seed) &&
                  row.authored[componentAxis(component)] &&
                  row.truth[component] !== null,
              ),
              component,
              constant,
            ),
          },
        ];
      },
    ),
  );
}

function groupBalancedMean(
  rows: readonly ReadinessEvaluationRow[],
  component: "impactFit" | "speedFit" | "airFit" | "elevationFit",
): number | null {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    const value = row.truth[component];
    if (value === null) continue;
    const values = groups.get(groupKey(row)) ?? [];
    values.push(value);
    groups.set(groupKey(row), values);
  }
  return groups.size === 0
    ? null
    : mean([...groups.values()].map((values) => mean(values)));
}

function constantMappingMse(
  rows: readonly ReadinessEvaluationRow[],
  component: "impactFit" | "speedFit" | "airFit" | "elevationFit",
  constant: number | null,
): LossSummary {
  if (constant === null) return { groups: 0, rows: 0, score: null };
  return macroLoss(rows.flatMap((row) => {
    const truth = row.truth[component];
    return truth === null
      ? []
      : [{
        group: groupKey(row),
        loss: (constant - truth) ** 2,
        weight: 1,
      }];
  }));
}

function evaluateModel(
  rows: Iterable<ReadinessEvaluationRow>,
  model: ReadinessModel,
) {
  type ProbabilityRow = {
    group: string;
    probability: number;
    positives: number;
    negatives: number;
  };
  type MappingRow = {
    group: string;
    predicted: number;
    truth: number;
  };
  const catchabilityRows: ProbabilityRow[] = [];
  const impactRows: MappingRow[] = [];
  const speedRows: MappingRow[] = [];
  const airRows: MappingRow[] = [];
  const elevationRows: MappingRow[] = [];
  const compositeRows: MappingRow[] = [];

  for (const row of rows) {
    const prediction = model.predict(row, row.current);
    const group = groupKey(row);
    catchabilityRows.push({
      group,
      probability: prediction.catchability,
      positives: row.truth.viable,
      negatives: row.truth.attempts - row.truth.viable,
    });
    if (
      row.authored.impact &&
      row.truth.impactFit !== null
    ) {
      impactRows.push({
        group,
        predicted: prediction.impactFeasibility,
        truth: row.truth.impactFit,
      });
    }
    appendComponentRow(
      speedRows,
      row,
      "speed",
      prediction.speedFit,
    );
    appendComponentRow(airRows, row, "air", prediction.airFit);
    appendComponentRow(
      elevationRows,
      row,
      "elevation",
      prediction.elevationFit,
    );
    if (prediction.readiness !== null) {
      compositeRows.push({
        group,
        predicted: prediction.readiness,
        truth: row.truth.utility,
      });
    }
  }

  const catchability = probabilitySummary(catchabilityRows);
  const impactFeasibility = mappingSummary(impactRows);
  const speedFit = mappingSummary(speedRows);
  const airFit = mappingSummary(airRows);
  const elevationFit = mappingSummary(elevationRows);
  return {
    catchability,
    speedFit,
    airFit,
    impactFeasibility,
    elevationFit,
    composite: {
      mse: macroLoss(
        compositeRows.map((row) => ({
          group: row.group,
          loss: (row.predicted - row.truth) ** 2,
          weight: 1,
        })),
      ),
      mae: macroLoss(
        compositeRows.map((row) => ({
          group: row.group,
          loss: Math.abs(row.predicted - row.truth),
          weight: 1,
        })),
      ),
      correlation: pearson(
        compositeRows.map((row) => [row.predicted, row.truth]),
      ),
      spearman: spearman(
        compositeRows.map((row) => [row.predicted, row.truth]),
      ),
      calibrationError: continuousCalibrationError(
        compositeRows,
      ),
    },
  };
}

function appendComponentRow(
  rows: Array<{ group: string; predicted: number; truth: number }>,
  row: ReadinessEvaluationRow,
  component: keyof OutgoingTruth["fit"],
  predicted: number | null,
): void {
  if (
    !row.authored[component] ||
    predicted === null
  ) return;
  const truth = row.truth[
    component === "speed"
      ? "speedFit"
      : component === "air"
      ? "airFit"
      : "elevationFit"
  ];
  if (truth === null) return;
  rows.push({ group: groupKey(row), predicted, truth });
}

function currentPrediction(
  input: Parameters<typeof scoreReadinessWithArtifact>[0],
): ComponentPrediction {
  if (incumbentArtifact === null) {
    return {
      catchability: 1,
      speedFit: 1,
      airFit: 1,
      impactFeasibility: 1,
      elevationFit: 1,
      readiness: 1,
    };
  }
  return scoreReadinessWithArtifact(input, incumbentArtifact);
}

function impactFitValues(context: ReadinessContext): number[] {
  const target = context.incomingGap.scorerTargets.impact;
  if (target === undefined) return [];
  return context.attempts.flatMap((attempt) =>
    attempt.viable
      ? [targetQuality(attempt.impact, target)]
      : []
  );
}

function realizedImpactFit(
  context: ReadinessContext,
): number | null {
  const values = impactFitValues(context);
  return values.length === 0 ? null : mean(values);
}

function impactFitMeanNoise(
  context: ReadinessContext,
): number | null {
  return meanNoise(impactFitValues(context));
}

function realizedConditionalFit(
  context: ReadinessContext,
  component: keyof OutgoingTruth["fit"],
): number | null {
  const values = context.attempts.flatMap((attempt) =>
    attempt.viable && attempt.outgoing !== null
      ? [attempt.outgoing.fit[component]]
      : []
  );
  return values.length === 0 ? null : mean(values);
}

function conditionalFitMeanNoise(
  context: ReadinessContext,
  component: keyof OutgoingTruth["fit"],
): number | null {
  const values = context.attempts.flatMap((attempt) =>
    attempt.viable && attempt.outgoing !== null
      ? [attempt.outgoing.fit[component]]
      : []
  );
  return meanNoise(values);
}

function meanNoise(values: readonly number[]): number | null {
  if (values.length < 2) return null;
  const average = mean(values);
  const sampleVariance = sum(
    values.map((value) => (value - average) ** 2),
  ) / (values.length - 1);
  return sampleVariance / values.length;
}

function realizedContextUtility(context: ReadinessContext): number {
  const impactTarget = context.incomingGap.scorerTargets.impact;
  return mean(context.attempts.map((attempt) => {
    if (!attempt.viable) return 0;
    const impactFit = impactTarget === undefined
      ? 1
      : targetQuality(attempt.impact, impactTarget);
    const outgoing = attempt.outgoing;
    if (context.outgoingGap === null) return impactFit;
    if (outgoing === null) return 0;
    return impactFit * outgoing.fit.speed * outgoing.fit.air *
      outgoing.fit.elevation;
  }));
}

function truthCoverage(rows: Iterable<ReadinessEvaluationRow>) {
  const groups = new Set<string>();
  const outgoingStatus: Record<string, number> = {};
  let contextCount = 0;
  let attemptCount = 0;
  let viableAttempts = 0;
  let impactLabeledAttempts = 0;
  let outgoingTruthAttempts = 0;
  let impactContexts = 0;
  let speedContexts = 0;
  let airContexts = 0;
  let elevationContexts = 0;
  const speedNoise: Array<{
    group: string;
    loss: number;
    weight: number;
  }> = [];
  const airNoise: typeof speedNoise = [];
  const impactNoise: typeof speedNoise = [];
  const elevationNoise: typeof speedNoise = [];
  const boundaryMetrics = {
    precontactPositionPx: [] as typeof speedNoise,
    contactPositionPx: [] as typeof speedNoise,
    incomingVelocityPxPerFrame: [] as typeof speedNoise,
    incomingSpeedPxPerFrame: [] as typeof speedNoise,
    incomingAngleDeg: [] as typeof speedNoise,
    riderMountedMismatch: [] as typeof speedNoise,
    sledIntactMismatch: [] as typeof speedNoise,
  };
  let boundaryContexts = 0;
  for (const row of rows) {
    contextCount++;
    groups.add(groupKey(row));
    attemptCount += row.truth.attempts;
    viableAttempts += row.truth.viable;
    if (row.authored.impact) {
      impactLabeledAttempts += row.truth.viable;
    }
    if (row.authored.impact) impactContexts++;
    if (row.authored.speed) speedContexts++;
    if (row.authored.air) airContexts++;
    if (row.authored.elevation) elevationContexts++;
    for (
      const [value, target] of [
        [row.truth.impactFitNoise, impactNoise],
        [row.truth.speedFitNoise, speedNoise],
        [row.truth.airFitNoise, airNoise],
        [row.truth.elevationFitNoise, elevationNoise],
      ] as const
    ) {
      if (value !== null) {
        target.push({
          group: groupKey(row),
          loss: value,
          weight: 1,
        });
      }
    }
    for (const [status, count] of Object.entries(row.truth.outgoingStatus)) {
      outgoingTruthAttempts += count;
      if (count > 0) {
        outgoingStatus[status] = (outgoingStatus[status] ?? 0) + count;
      }
    }
    const boundaryError = row.truth.incomingBoundaryError;
    if (boundaryError !== null) {
      boundaryContexts++;
      for (const [name, value] of Object.entries(boundaryError) as Array<
        [keyof typeof boundaryMetrics, number | null]
      >) {
        if (value === null) continue;
        boundaryMetrics[name].push({
          group: groupKey(row),
          loss: value,
          weight: 1,
        });
      }
    }
  }
  return {
    groups: groups.size,
    contexts: contextCount,
    attempts: attemptCount,
    viableAttempts,
    impactLabeledAttempts,
    outgoingTruthAttempts,
    outgoingStatus,
    finiteAttemptNoiseMseEstimate: {
      impactFeasibility: macroLoss(impactNoise),
      speedFit: macroLoss(speedNoise),
      airFit: macroLoss(airNoise),
      elevationFit: macroLoss(elevationNoise),
    },
    authoredContexts: {
      impact: impactContexts,
      speed: speedContexts,
      air: airContexts,
      elevation: elevationContexts,
    },
    incomingBoundaryDiagnostics: {
      pairedContexts: boundaryContexts,
      precontactPositionMaePx:
        macroLoss(boundaryMetrics.precontactPositionPx),
      contactPositionMaePx:
        macroLoss(boundaryMetrics.contactPositionPx),
      incomingVelocityMaePxPerFrame:
        macroLoss(boundaryMetrics.incomingVelocityPxPerFrame),
      incomingSpeedMaePxPerFrame:
        macroLoss(boundaryMetrics.incomingSpeedPxPerFrame),
      incomingAngleMaeDeg:
        macroLoss(boundaryMetrics.incomingAngleDeg),
      riderMountedMismatchRate:
        macroLoss(boundaryMetrics.riderMountedMismatch),
      sledIntactMismatchRate:
        macroLoss(boundaryMetrics.sledIntactMismatch),
    },
  };
}

function probabilitySummary(
  rows: Array<{
    group: string;
    probability: number;
    positives: number;
    negatives: number;
  }>,
): ProbabilitySummary {
  const clipped = rows.map((row) => ({
    ...row,
    probability: clamp(row.probability, 0, 1),
  }));
  const brierRows = clipped.map((row) => ({
    group: row.group,
    loss:
      row.positives * (1 - row.probability) ** 2 +
      row.negatives * row.probability ** 2,
    weight: row.positives + row.negatives,
  }));
  const logRows = clipped.map((row) => {
    const p = clamp(row.probability, 1e-6, 1 - 1e-6);
    return {
      group: row.group,
      loss:
        -row.positives * Math.log(p) -
        row.negatives * Math.log(1 - p),
      weight: row.positives + row.negatives,
    };
  });
  return {
    brier: macroLoss(brierRows),
    logLoss: macroLoss(logRows),
    calibrationError: probabilityCalibrationError(clipped),
    auc: weightedAuc(clipped),
    positives: sum(clipped.map((row) => row.positives)),
    negatives: sum(clipped.map((row) => row.negatives)),
  };
}

function mappingSummary(
  rows: Array<{
    group: string;
    predicted: number;
    truth: number;
  }>,
) {
  return {
    mae: macroLoss(
      rows.map((row) => ({
        group: row.group,
        loss: Math.abs(row.predicted - row.truth),
        weight: 1,
      })),
    ),
    mse: macroLoss(
      rows.map((row) => ({
        group: row.group,
        loss: (row.predicted - row.truth) ** 2,
        weight: 1,
      })),
    ),
    bias: macroSigned(
      rows.map((row) => ({
        group: row.group,
        value: row.predicted - row.truth,
      })),
    ),
    correlation: pearson(
      rows.map((row) => [row.predicted, row.truth]),
    ),
  };
}

function decideAlternative(
  evaluation: Record<string, any>,
  alternative: ReadinessModel,
) {
  const metricPath = alternative.changedComponent === "catchability"
    ? [alternative.changedComponent, "brier", "score"]
    : [alternative.changedComponent, "mse", "score"];
  const score = (partition: string, model: string): number =>
    requiredMetric(metricPath.reduce(
      (value, key) => value[key],
      evaluation[partition].models[model],
    ), `${partition}.${model}.${metricPath.join(".")}`);
  const devCurrent = score("development", "current");
  const devAlternative = score("development", alternative.name);
  const validationCurrent = score("validation", "current");
  const validationAlternative = score(
    "validation",
    alternative.name,
  );
  const improvement = (current: number, candidate: number): number =>
    100 * (current - candidate) / current;
  const developmentImprovementPct =
    improvement(devCurrent, devAlternative);
  const validationImprovementPct =
    improvement(validationCurrent, validationAlternative);
  return {
    alternative: alternative.name,
    changedComponent: alternative.changedComponent,
    primaryMetric: metricPath.join("."),
    minimumImprovementPct: 1,
    development: {
      current: devCurrent,
      alternative: devAlternative,
      improvementPct: developmentImprovementPct,
    },
    validation: {
      current: validationCurrent,
      alternative: validationAlternative,
      improvementPct: validationImprovementPct,
    },
    verdict:
      developmentImprovementPct >= 1 &&
        validationImprovementPct > 0
        ? "adopt_alternative"
        : "keep_current",
  };
}

function requiredMetric(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`readiness decision metric is unavailable at ${path}`);
  }
  return value;
}

function macroLoss(
  rows: Array<{
    group: string;
    loss: number;
    weight: number;
  }>,
): LossSummary {
  const groups = new Map<string, { loss: number; weight: number }>();
  let totalRows = 0;
  for (const row of rows) {
    if (
      !Number.isFinite(row.loss) ||
      !Number.isFinite(row.weight) ||
      row.weight <= 0
    ) continue;
    const group = groups.get(row.group) ?? { loss: 0, weight: 0 };
    group.loss += row.loss;
    group.weight += row.weight;
    groups.set(row.group, group);
    totalRows += row.weight;
  }
  if (groups.size === 0) {
    return { groups: 0, rows: 0, score: null };
  }
  return {
    groups: groups.size,
    rows: totalRows,
    score: mean(
      [...groups.values()].map((group) => group.loss / group.weight),
    ),
  };
}

function macroSigned(
  rows: Array<{ group: string; value: number }>,
): number | null {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    if (!Number.isFinite(row.value)) continue;
    const group = groups.get(row.group) ?? [];
    group.push(row.value);
    groups.set(row.group, group);
  }
  return groups.size === 0
    ? null
    : mean([...groups.values()].map((values) => mean(values)));
}

function probabilityCalibrationError(
  rows: Array<{
    probability: number;
    positives: number;
    negatives: number;
  }>,
): number | null {
  const bins = Array.from(
    { length: 10 },
    () => ({ predicted: 0, positives: 0, total: 0 }),
  );
  for (const row of rows) {
    const total = row.positives + row.negatives;
    if (total <= 0) continue;
    const index = Math.min(9, Math.floor(row.probability * 10));
    bins[index].predicted += row.probability * total;
    bins[index].positives += row.positives;
    bins[index].total += total;
  }
  const total = sum(bins.map((bin) => bin.total));
  if (total === 0) return null;
  return sum(
    bins.map((bin) =>
      bin.total === 0
        ? 0
        : bin.total *
          Math.abs(
            bin.predicted / bin.total -
              bin.positives / bin.total,
          )
    ),
  ) / total;
}

function continuousCalibrationError(
  rows: Array<{ predicted: number; truth: number }>,
): number | null {
  const sorted = [...rows].sort(
    (a, b) => a.predicted - b.predicted,
  );
  if (sorted.length === 0) return null;
  let weighted = 0;
  let total = 0;
  for (let bin = 0; bin < 10; bin++) {
    const start = Math.floor(bin * sorted.length / 10);
    const end = Math.floor((bin + 1) * sorted.length / 10);
    const slice = sorted.slice(start, end);
    if (slice.length === 0) continue;
    weighted += slice.length *
      Math.abs(
        mean(slice.map((row) => row.predicted)) -
          mean(slice.map((row) => row.truth)),
      );
    total += slice.length;
  }
  return weighted / total;
}

function weightedAuc(
  rows: Array<{
    probability: number;
    positives: number;
    negatives: number;
  }>,
): number | null {
  const sorted = [...rows].sort(
    (a, b) => a.probability - b.probability,
  );
  const positives = sum(sorted.map((row) => row.positives));
  const negatives = sum(sorted.map((row) => row.negatives));
  if (positives === 0 || negatives === 0) return null;
  let lowerNegatives = 0;
  let wins = 0;
  for (let start = 0; start < sorted.length;) {
    let end = start + 1;
    while (
      end < sorted.length &&
      sorted[end].probability === sorted[start].probability
    ) end++;
    const tiedPositive = sum(
      sorted.slice(start, end).map((row) => row.positives),
    );
    const tiedNegative = sum(
      sorted.slice(start, end).map((row) => row.negatives),
    );
    wins += tiedPositive *
      (lowerNegatives + 0.5 * tiedNegative);
    lowerNegatives += tiedNegative;
    start = end;
  }
  return wins / (positives * negatives);
}

function pearson(pairs: Array<[number, number]>): number | null {
  const finitePairs = pairs.filter(
    ([a, b]) => Number.isFinite(a) && Number.isFinite(b),
  );
  if (finitePairs.length < 2) return null;
  const meanA = mean(finitePairs.map(([a]) => a));
  const meanB = mean(finitePairs.map(([, b]) => b));
  let covariance = 0;
  let varianceA = 0;
  let varianceB = 0;
  for (const [a, b] of finitePairs) {
    const da = a - meanA;
    const db = b - meanB;
    covariance += da * db;
    varianceA += da * da;
    varianceB += db * db;
  }
  return varianceA > 0 && varianceB > 0
    ? covariance / Math.sqrt(varianceA * varianceB)
    : null;
}

function spearman(pairs: Array<[number, number]>): number | null {
  const finitePairs = pairs.filter(
    ([a, b]) => Number.isFinite(a) && Number.isFinite(b),
  );
  if (finitePairs.length < 2) return null;
  const ranksA = ranks(finitePairs.map(([a]) => a));
  const ranksB = ranks(finitePairs.map(([, b]) => b));
  return pearson(ranksA.map((rank, index) => [rank, ranksB[index]]));
}

function ranks(values: number[]): number[] {
  const indexed = values
    .map((value, index) => ({ value, index }))
    .sort((a, b) => a.value - b.value);
  const out = new Array<number>(values.length);
  for (let start = 0; start < indexed.length;) {
    let end = start + 1;
    while (
      end < indexed.length &&
      indexed[end].value === indexed[start].value
    ) end++;
    const rank = (start + end - 1) / 2;
    for (let index = start; index < end; index++) {
      out[indexed[index].index] = rank;
    }
    start = end;
  }
  return out;
}

function printReport(report: any): void {
  console.log(`Next-arc readiness frozen-corpus evaluation`);
  console.log(
    `  ${report.corpus.contexts} contexts; ${report.corpus.cases} cases; ` +
      `${report.corpus.predictedBoundaryContexts} predicted boundaries; ` +
      `budget ${report.corpus.budget}; seeds ${report.corpus.seeds.join(",")}`,
  );
  console.log(
    `  development-mean reference MSE speed/air ` +
      `${fmt(report.references.speedFit.validationMse.score)}/` +
      `${fmt(report.references.airFit.validationMse.score)}`,
  );
  for (const [partition, value] of Object.entries(
    report.evaluation,
  ) as Array<[string, any]>) {
    console.log(
      `\n${partition}: ${value.contexts} primary contexts, ` +
        `${value.attempts} attempts`,
    );
    for (const [model, metrics] of Object.entries(
      value.models,
    ) as Array<[string, any]>) {
      console.log(`  ${model}`);
      console.log(
        `    catchability Brier ${fmt(metrics.catchability.brier.score)} ` +
          `log ${fmt(metrics.catchability.logLoss.score)} ` +
          `ECE ${fmt(metrics.catchability.calibrationError)} ` +
          `AUC ${fmt(metrics.catchability.auc)}`,
      );
      console.log(
        `    impact/speed/air/elevation MSE ` +
          `${fmt(metrics.impactFeasibility.mse.score)}/` +
          `${fmt(metrics.speedFit.mse.score)}/` +
          `${fmt(metrics.airFit.mse.score)}/` +
          `${fmt(metrics.elevationFit.mse.score)}`,
      );
      console.log(
        `    composite MSE ${fmt(metrics.composite.mse.score)} ` +
          `MAE ${fmt(metrics.composite.mae.score)} ` +
          `r ${fmt(metrics.composite.correlation)} ` +
          `rho ${fmt(metrics.composite.spearman)}`,
      );
    }
  }
  console.log(`\ndecision: ${report.decision.verdict}`);
}

function loadCompatibleIncumbentArtifact(
  path: string,
): ReadinessModelArtifact | null {
  if (!existsSync(path)) return null;
  try {
    const artifact = parseReadinessModelArtifact(
      JSON.parse(readFileSync(path, "utf8")),
    );
    assertCompatibleReadinessArtifact(artifact);
    if (artifact.trainingCorpus.schema === "bootstrap-untrained") {
      return null;
    }
    return artifact;
  } catch {
    /*
     * A policy or feature change intentionally has no incumbent. The training
     * dataset records this explicitly and uses a development-only constant
     * reference; production still fails loudly when loading the stale file.
     */
    return null;
  }
}

function readinessArtifactFingerprint(path: string): string {
  return createHash("sha256")
    .update(readFileSync(path))
    .digest("hex");
}

function loadCorpus(): ReadinessCorpus {
  const manifestPath = resolve(corpusPath, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `readiness corpus not found at ${relativeToCwd(corpusPath)}; ` +
        `run npm run benchmark:readiness:collect once`,
    );
  }
  const corpus = JSON.parse(
    readFileSync(manifestPath, "utf8"),
  ) as ReadinessCorpus;
  if (corpus.schema !== "line.readiness-corpus.v6") {
    throw new Error(`unsupported readiness corpus schema`);
  }
  if (
    corpus.protocol.budget !== READINESS_BUDGET ||
    corpus.protocol.contextCapPerCaseSeed !==
      READINESS_CONTEXT_CAP_PER_CASE_SEED ||
    corpus.protocol.primaryPolicy !== PRIMARY_POLICY ||
    corpus.protocol.generatorPolicyId !==
      PRODUCTION_ARC_PROPOSAL_POLICY_ID ||
    typeof corpus.protocol.contextSelectionArtifactFingerprint !== "string" ||
    corpus.protocol.contextSelectionArtifactFingerprint.length === 0 ||
    corpus.protocol.seeds.length !== READINESS_SEEDS.length ||
    corpus.protocol.seeds.some(
      (seed, index) => seed !== READINESS_SEEDS[index],
    )
  ) {
    throw new Error(
      `readiness corpus does not match the fixed protocol`,
    );
  }
  if (corpus.samplerFingerprint !== fingerprintFiles(SAMPLER_FILES)) {
    throw new Error(
      `readiness corpus sampler policy is stale; recollect explicitly`,
    );
  }
  if (
    corpus.protocol.canonical &&
    (
      corpus.cases.length !== sourceIds.length ||
      corpus.cases.some((id, index) => id !== sourceIds[index])
    )
  ) {
    throw new Error(
      `readiness corpus case membership is stale; recollect explicitly`,
    );
  }
  if (
    corpus.shards.length !==
      corpus.cases.length * corpus.protocol.seeds.length ||
    sum(corpus.shards.map((shard) => shard.contexts)) !==
      corpus.contexts
  ) {
    throw new Error(`readiness corpus has inconsistent shard coverage`);
  }
  for (const shard of corpus.shards) {
    if (
      !Number.isSafeInteger(shard.retainedAttempts) ||
      shard.retainedAttempts < shard.contexts ||
      shard.retainedAttempts > shard.attempts ||
      shard.viableAttempts < 0 ||
      shard.viableAttempts > shard.retainedAttempts ||
      shard.outgoingTruthAttempts < 0 ||
      shard.outgoingTruthAttempts > shard.viableAttempts
    ) {
      throw new Error(
        `readiness corpus has invalid shard counts: ${shard.path}`,
      );
    }
    if (!existsSync(corpusShardPath(shard.path))) {
      throw new Error(`readiness corpus shard is missing: ${shard.path}`);
    }
  }
  return corpus;
}

function* corpusContexts(
  corpus: ReadinessCorpus,
  seeds?: ReadonlySet<number>,
): Generator<ReadinessContext> {
  let count = 0;
  const shards = seeds === undefined
    ? corpus.shards
    : corpus.shards.filter((shard) => seeds.has(shard.seed));
  for (const shard of shards) {
    const contexts = JSON.parse(
      gunzipSync(readFileSync(corpusShardPath(shard.path)))
        .toString("utf8"),
    ) as ReadinessContext[];
    if (
      contexts.length !== shard.contexts ||
      contexts.some(
        (context) =>
          context.sourceId !== shard.sourceId ||
          context.seed !== shard.seed,
      )
    ) {
      throw new Error(
        `readiness corpus shard metadata mismatch: ${shard.path}`,
      );
    }
    validateContexts(contexts);
    count += contexts.length;
    yield* contexts;
  }
  const expected = sum(shards.map((shard) => shard.contexts));
  if (count !== expected) {
    throw new Error(`readiness corpus context count mismatch`);
  }
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
      const result = await runCollectionWorker(
        tasks[index],
        stagingPath,
        active,
      );
      onResult(result, index);
      completed++;
      console.error(`collection progress: ${completed}/${tasks.length}`);
    }
  };
  try {
    await Promise.all(
      Array.from(
        {
          length: Math.min(
            READINESS_COLLECTION_JOBS,
            tasks.length,
          ),
        },
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
          `readiness worker ${task.sourceId}/s${task.seed} failed ` +
            `(code ${code}, signal ${signal ?? "none"}):\n` +
            Buffer.concat(stderr).toString("utf8"),
        ));
        return;
      }
      try {
        resolveWorker(
          JSON.parse(
            Buffer.concat(stdout).toString("utf8"),
          ) as CollectionTaskResult,
        );
      } catch (error) {
        rejectWorker(new Error(
          `invalid readiness worker output for ` +
            `${task.sourceId}/s${task.seed}: ${String(error)}\n` +
            Buffer.concat(stderr).toString("utf8"),
        ));
      }
    });
  });
}

function installCollectedCorpus(stagingPath: string): void {
  if (!existsSync(corpusPath)) {
    renameSync(stagingPath, corpusPath);
    return;
  }
  const previousPath =
    `${corpusPath}.previous-${process.pid}-${Date.now()}`;
  renameSync(corpusPath, previousPath);
  try {
    renameSync(stagingPath, corpusPath);
  } catch (error) {
    renameSync(previousPath, corpusPath);
    throw error;
  }
  rmSync(previousPath, { recursive: true, force: true });
}

function traceContextKey(trace: CandidateSampleTrace): string {
  return [
    trace.gap.index,
    trace.mode,
    trace.supportGeometryMode ?? "",
    axisValuesKey(trace.geometryTargets),
  ].join("|");
}

function contextPriority(
  sourceId: string,
  seed: number,
  ordinal: number,
  trace: CandidateSampleTrace,
): number {
  const identity = [
    sourceId,
    seed,
    ordinal,
    trace.gap.index,
    trace.mode,
    trace.supportGeometryMode ?? "",
    axisValuesKey(trace.geometryTargets),
  ].join("/");
  let hash = 0x811c9dc5;
  for (let index = 0; index < identity.length; index++) {
    hash ^= identity.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x7feb352d);
  hash ^= hash >>> 15;
  hash = Math.imul(hash, 0x846ca68b);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

function reservoirWouldRetain(
  entries: readonly ReservoirEntry[],
  priority: number,
  ordinal: number,
  cap: number,
): boolean {
  if (entries.length < cap) return true;
  return reservoirOrder(
    { priority, ordinal },
    entries[0],
  ) < 0;
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
      if (
        reservoirOrder(entries[parent], entries[index]) >= 0
      ) break;
      [entries[parent], entries[index]] =
        [entries[index], entries[parent]];
      index = parent;
    }
    return;
  }
  if (reservoirOrder(entry, entries[0]) >= 0) return;
  const evicted = entries[0];
  evicted.owner.set(evicted.ownerKey, null);
  entries[0] = entry;
  let index = 0;
  while (true) {
    const left = index * 2 + 1;
    if (left >= entries.length) return;
    const right = left + 1;
    const larger =
      right < entries.length &&
        reservoirOrder(entries[right], entries[left]) > 0
        ? right
        : left;
    if (
      reservoirOrder(entries[index], entries[larger]) >= 0
    ) return;
    [entries[index], entries[larger]] =
      [entries[larger], entries[index]];
    index = larger;
  }
}

function reservoirOrder(
  a: Pick<ReservoirEntry, "priority" | "ordinal">,
  b: Pick<ReservoirEntry, "priority" | "ordinal">,
): number {
  return a.priority - b.priority || a.ordinal - b.ordinal;
}

function validateContexts(contexts: ReadinessContext[]): void {
  for (const context of contexts) {
    const label = `${context.sourceId}/s${context.seed}/o${context.ordinal}`;
    if (
      !Number.isSafeInteger(context.ordinal) ||
      context.ordinal < 0 ||
      context.attempts.length < 1
    ) {
      throw new Error(`invalid readiness context identity at ${label}`);
    }
    validateFrozenGap(context.incomingGap, `${label}.incomingGap`);
    if (!context.incomingGap.endsWithContact) {
      throw new Error(`readiness incoming gap must end with contact at ${label}`);
    }
    if (context.outgoingGap !== null) {
      validateFrozenGap(context.outgoingGap, `${label}.outgoingGap`);
      if (
        context.outgoingGap.index <= context.incomingGap.index ||
        context.outgoingGap.startFrame !==
          context.incomingGap.endFrame ||
        context.outgoingGap.endFrame <=
          context.incomingGap.endFrame
      ) {
        throw new Error(`misordered readiness gaps at ${label}`);
      }
    }
    for (
      const [kind, boundary] of [
        ["predicted", context.predictedIncomingBoundary],
        ["exact", context.exactIncomingBoundary],
      ] as const
    ) {
      if (boundary !== null) {
        validateFrozenBoundary(
          boundary,
          context.incomingGap.endFrame,
          `${label}.${kind}IncomingBoundary`,
        );
      }
    }
    const seenAttempts = new Set<string>();
    for (const attempt of context.attempts) {
      const attemptKey =
        `${attempt.proposalBatchId}:${attempt.attempt}`;
      const attemptLabel = `${label}.attempts[${attemptKey}]`;
      if (
        !Number.isSafeInteger(attempt.proposalBatchId) ||
        !Number.isSafeInteger(attempt.attempt) ||
        attempt.attempt < 0 ||
        seenAttempts.has(attemptKey)
      ) {
        throw new Error(`invalid readiness attempt identity at ${attemptLabel}`);
      }
      seenAttempts.add(attemptKey);
      if (
        !attempt.viable &&
        (
          attempt.impact !== null ||
          attempt.contactFrameOffset !== null ||
          attempt.launch !== null ||
          attempt.outgoing !== null
        )
      ) {
        throw new Error(`failed attempt carries future truth at ${attemptLabel}`);
      }
      if (!attempt.viable) continue;
      if (
        attempt.contactFrameOffset !== -1 &&
        attempt.contactFrameOffset !== 0 &&
        attempt.contactFrameOffset !== 1
      ) {
        throw new Error(
          `invalid contact-frame offset at ${attemptLabel}`,
        );
      }
      if (attempt.impact !== null && !Number.isFinite(attempt.impact)) {
        throw new Error(`invalid impact truth at ${attemptLabel}`);
      }
      const impactAuthored =
        context.incomingGap.scorerTargets.impact !== undefined;
      if (
        impactAuthored !== (attempt.impact !== null)
      ) {
        throw new Error(`invalid impact label ownership at ${attemptLabel}`);
      }
      if (attempt.launch !== null) {
        assertFiniteNumbers(attempt.launch, `${attemptLabel}.launch`);
      }
      if (
        context.outgoingGap === null
          ? attempt.outgoing !== null
          : attempt.outgoing === null
      ) {
        throw new Error(`invalid outgoing truth ownership at ${attemptLabel}`);
      }
      if (attempt.outgoing !== null) {
        validateOutgoingTruth(
          attempt.outgoing,
          context.outgoingGap!,
          `${attemptLabel}.outgoing`,
        );
      }
    }
  }
}

function validateFrozenGap(gap: FrozenScorerGap, label: string): void {
  if (
    !Number.isSafeInteger(gap.index) ||
    gap.index < 0 ||
    !Number.isSafeInteger(gap.startFrame) ||
    !Number.isSafeInteger(gap.endFrame) ||
    gap.endFrame < gap.startFrame ||
    gap.frameCount !== gap.endFrame - gap.startFrame + 1 ||
    typeof gap.endsWithContact !== "boolean" ||
    (gap.nextImpact !== null && !Number.isFinite(gap.nextImpact))
  ) {
    throw new Error(`invalid scorer gap at ${label}`);
  }
  assertFiniteNumbers(gap.scorerTargets, `${label}.scorerTargets`);
  assertFiniteNumbers(gap.proposalTargets, `${label}.proposalTargets`);
}

function validateFrozenBoundary(
  boundary: FrozenIncomingBoundary,
  expectedTargetFrame: number,
  label: string,
): void {
  if (
    boundary.targetFrame !== expectedTargetFrame ||
    boundary.preContactFrame !== expectedTargetFrame - 1 ||
    boundary.incomingVelocityFrame !== expectedTargetFrame ||
    boundary.projectedContactFrame !== expectedTargetFrame
  ) {
    throw new Error(`misaligned incoming boundary at ${label}`);
  }
  assertFiniteNumbers(boundary, label);
  if (
    boundary.preContact.speed < 0 ||
    boundary.projectedContact.speed < 0 ||
    boundary.incoming.speed < 0
  ) {
    throw new Error(`negative speed at ${label}`);
  }
}

function validateOutgoingTruth(
  truth: OutgoingTruth,
  gap: FrozenScorerGap,
  label: string,
): void {
  assertFiniteNumbers(truth, label);
  for (const axis of ["speed", "air", "elevation"] as const) {
    const fit = truth.fit[axis];
    if (fit < 0 || fit > 1) {
      throw new Error(`out-of-range ${axis} fit at ${label}`);
    }
    if (gap.scorerTargets[axis] === undefined && fit !== 1) {
      throw new Error(`unauthored ${axis} is non-neutral at ${label}`);
    }
  }
  if (truth.status === "complete") {
    if (
      truth.achieved.speed === null ||
      truth.achieved.air === null ||
      truth.achieved.air < 0 ||
      truth.achieved.air > 1
    ) {
      throw new Error(`invalid complete outgoing truth at ${label}`);
    }
  } else if (
    truth.achieved.speed !== null ||
    truth.achieved.air !== null ||
    truth.achieved.elevation !== null
  ) {
    throw new Error(`invalid failed outgoing truth at ${label}`);
  }
}

function assertFiniteNumbers(value: unknown, path: string): void {
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error(`non-finite readiness metric at ${path}`);
    }
    return;
  }
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertFiniteNumbers(item, `${path}[${index}]`)
    );
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    assertFiniteNumbers(item, `${path}.${key}`);
  }
}

function finite(value: number | undefined): number | null {
  return value !== undefined && Number.isFinite(value)
    ? value
    : null;
}

function finiteAxisValues(values: AxisValues): AxisValues {
  const result: AxisValues = {};
  for (const [axis, value] of Object.entries(values)) {
    if (value === undefined) continue;
    if (!Number.isFinite(value)) {
      throw new Error(`readiness target ${axis} must be finite`);
    }
    result[axis as keyof AxisValues] = value;
  }
  return result;
}

function axisValuesKey(values: AxisValues): string {
  return Object.entries(finiteAxisValues(values))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([axis, value]) => `${axis}:${value}`)
    .join(",");
}

function groupKey(
  context: Pick<ReadinessContext, "sourceId" | "seed">,
): string {
  return `${context.sourceId}/s${context.seed}`;
}

function corpusShardPath(relativePath: string): string {
  const root = resolve(corpusPath);
  const path = resolve(root, relativePath);
  if (!path.startsWith(`${root}${sep}`)) {
    throw new Error(
      `readiness corpus shard escapes its root: ${relativePath}`,
    );
  }
  return path;
}

function exactCanonicalSeed(value: string | undefined): number {
  const seed = Number(value);
  if (
    !Number.isSafeInteger(seed) ||
    !READINESS_SEEDS.includes(seed as typeof READINESS_SEEDS[number])
  ) {
    throw new Error(`invalid readiness worker seed ${value}`);
  }
  return seed;
}

function rejectFixedProtocolOverride(name: string): void {
  if (argValue(name) !== undefined) {
    throw new Error(
      `readiness benchmark fixes --${name}; no override is allowed`,
    );
  }
}

function list(value: string): string[] {
  const values = value.split(",").filter(Boolean);
  if (values.length === 0 || new Set(values).size !== values.length) {
    throw new Error(`expected a non-empty unique comma-separated list`);
  }
  return values;
}

function safeFilename(value: string): string {
  const safe = value.replace(/[^a-zA-Z0-9._-]/g, "_");
  if (safe.length === 0) {
    throw new Error(`cannot create a shard name for ${value}`);
  }
  return safe;
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    counts[value] = (counts[value] ?? 0) + 1;
  }
  return counts;
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

function mean(values: readonly number[]): number {
  return values.length === 0 ? NaN : sum(values) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function fmt(value: unknown): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(6)
    : "n/a";
}

function relativeToCwd(path: string): string {
  const cwd = `${resolve(".")}${sep}`;
  const absolute = resolve(path);
  return absolute.startsWith(cwd)
    ? absolute.slice(cwd.length)
    : absolute;
}
