/**
 * Benchmark V2 "power grid" study.
 *
 * Materializes the empirical effect-size x seed-depth x policy operating-
 * characteristic grid that serves as the project's decision resolution card.
 * Simulation-only (no compiles): it resamples REAL observed 12-seed catalog
 * blocks from the retained calibration coverage reference, rescoring every
 * stored row from its raw report before use, and drives the frozen decision
 * inference (`pairedV2DecisionForCalibration`) exactly as
 * `study_decision_coverage.ts` does.
 *
 * The decision confidence (jackknife SE, dof, point estimate) is INDEPENDENT
 * of the decision mode/margin/criticalAlpha, so every operating characteristic
 * in the grid is derived from the one confidence object per trial by comparing
 * the one-sided Student-t bound to the relevant threshold. That lets a single
 * simulation of a given data-generating process serve improvement power, the
 * empirical null, simplification non-inferiority (all margins), and both the
 * derated (criticalAlpha=0.01) and un-derated (criticalAlpha=0.05) criticals.
 *
 * Deterministic: every trial draws from a mulberry32 stream seeded solely from
 * its own (task, validation-stream, trial-index) identity, so parallel and
 * serial execution are bit-identical. No Math.random / Date.now in the DGP.
 *
 * Writes benchmark/v2/studies/power-grid.json (schema
 * line.benchmark-v2.power-grid-study.v1). Modifies no existing file.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { benchmarkDecisionPolicy, COMPILER_IDENTITY_PROTOCOL } from "../../benchmark/v2/decision-policy.ts";
import {
  DECISION_INFERENCE_SOURCE_FILES,
  pairedV2DecisionForCalibration,
  studentTQuantile,
  type DecisionRun,
} from "../v0/benchmark_v2/decision_model.ts";
import {
  fingerprintFiles,
  type SuiteManifest,
} from "../v0/benchmark_v2/suite_model.ts";
import { argumentReader, round, sha256 } from "../v0/benchmark_v2/util.ts";

// ---------------------------------------------------------------------------
// Shared (main + worker) helpers and constants.
// ---------------------------------------------------------------------------

const CRITICALS = [0.01, 0.05] as const;
type Critical = typeof CRITICALS[number];

type Scenario = "empirical_shift" | "symmetric_validity_flips" | "catalog_wide_hard_zero";

/** A single (label, threshold, criticalAlpha) decision rule evaluated per trial. */
type EvalRule = { key: string; threshold: number; criticalAlpha: Critical };

/** A data-generating process to simulate `trials` times at a given depth. */
type SimTask = {
  taskId: string;
  kind: "improvement" | "null_stress" | "simplification_boundary";
  scenario: Scenario;
  depth: number;
  shift: number;
  trueDelta: number;
  trials: number;
  evals: EvalRule[];
};

type OutcomeCounts = { accept: number; reject: number; inconclusive: number };
/** Per (task, validation-stream) accumulator returned by a worker chunk. */
type StreamTally = {
  count: number;
  sumDelta: number;
  sumSe: number;
  central99: number;
  central95: number;
  policyDisagreement: number;
  evals: Record<string, OutcomeCounts>;
};

function emptyTally(evals: EvalRule[]): StreamTally {
  const perEval: Record<string, OutcomeCounts> = {};
  for (const rule of evals) perEval[rule.key] = { accept: 0, reject: 0, inconclusive: 0 };
  return { count: 0, sumDelta: 0, sumSe: 0, central99: 0, central95: 0, policyDisagreement: 0, evals: perEval };
}

function mergeTally(into: StreamTally, add: StreamTally): void {
  into.count += add.count;
  into.sumDelta += add.sumDelta;
  into.sumSe += add.sumSe;
  into.central99 += add.central99;
  into.central95 += add.central95;
  into.policyDisagreement += add.policyDisagreement;
  for (const key of Object.keys(add.evals)) {
    const target = into.evals[key] ?? (into.evals[key] = { accept: 0, reject: 0, inconclusive: 0 });
    target.accept += add.evals[key].accept;
    target.reject += add.evals[key].reject;
    target.inconclusive += add.evals[key].inconclusive;
  }
}

function cellKey(sourceId: string, budget: number, seed: number): string {
  return `${sourceId}\0${budget}\0${seed}`;
}

function suiteForSeeds(suite: SuiteManifest, seedsPerBudget: number): SuiteManifest {
  const cloned = structuredClone(suite);
  cloned.profiles.canonical.seeds_per_budget = seedsPerBudget;
  return cloned;
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(1000, value));
}

function mulberry32(seed: number): () => number {
  let value = seed >>> 0;
  return () => {
    value = (value + 0x6d2b79f5) | 0;
    let t = value;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

/**
 * Build one paired base/candidate set of DecisionRun blocks for a trial,
 * mirroring study_decision_coverage.ts's trialRuns for the corresponding
 * scenario. All arms use the UNPAIRED empirical block DGP (independent seed
 * blocks per arm), except the two zero-inflation stress scenarios which mirror
 * their existing shared-block constructions.
 */
function trialRuns(
  scenario: Scenario,
  suite: SuiteManifest,
  depth: number,
  shift: number,
  members: string[],
  seeds: number[],
  referenceByCell: Map<string, { score: number; valid: boolean }>,
  random: () => number,
): { base: DecisionRun[]; candidate: DecisionRun[] } {
  const base: DecisionRun[] = [];
  const candidate: DecisionRun[] = [];
  for (const budget of suite.profiles.canonical.budgets) {
    for (let seedSlot = 0; seedSlot < depth; seedSlot++) {
      const baseSeed = seeds[Math.floor(random() * seeds.length)];
      const candidateSeed = seeds[Math.floor(random() * seeds.length)];
      const sharedSeed = seeds[Math.floor(random() * seeds.length)];
      const baseBlockValid = random() < 0.8;
      const candidateBlockValid = random() < 0.8;
      for (const sourceId of members) {
        let baseScore: { score: number; valid: boolean };
        let candidateScore: { score: number; valid: boolean };
        if (scenario === "empirical_shift") {
          baseScore = referenceByCell.get(cellKey(sourceId, budget, baseSeed))!;
          candidateScore = referenceByCell.get(cellKey(sourceId, budget, candidateSeed))!;
          if (shift !== 0 && candidateScore.valid) {
            candidateScore = { ...candidateScore, score: clampScore(candidateScore.score + shift) };
          }
        } else if (scenario === "symmetric_validity_flips") {
          const original = referenceByCell.get(cellKey(sourceId, budget, sharedSeed))!;
          baseScore = original;
          candidateScore = original;
          if (random() < 0.08) {
            if (random() < 0.5) baseScore = { score: 0, valid: false };
            else candidateScore = { score: 0, valid: false };
          }
        } else {
          baseScore = { score: baseBlockValid ? 500 : 0, valid: baseBlockValid };
          candidateScore = { score: candidateBlockValid ? 500 : 0, valid: candidateBlockValid };
        }
        const task = { sourceId, budget, seedSlot, actualSeed: seedSlot };
        base.push({ ...task, score: { ...baseScore } });
        candidate.push({ ...task, score: { ...candidateScore } });
      }
    }
  }
  return { base, candidate };
}

/** One-sided policy outcome: accept iff lower bound > threshold, reject iff
 *  upper bound < threshold, else inconclusive. Mirrors the frozen decision
 *  policy exactly (positive = lowerBound > threshold, negative = upperBound <
 *  threshold), recomputed at an arbitrary criticalAlpha from the reported SE
 *  and dof so the derated and un-derated criticals share one simulation. */
function outcomeAt(
  delta: number,
  se: number,
  criticalValue: number,
  threshold: number,
): keyof OutcomeCounts {
  if (se === 0) {
    return delta > threshold ? "accept" : delta < threshold ? "reject" : "inconclusive";
  }
  const lower = delta - criticalValue * se;
  const upper = delta + criticalValue * se;
  if (lower > threshold) return "accept";
  if (upper < threshold) return "reject";
  return "inconclusive";
}

// ---------------------------------------------------------------------------
// Worker: run a chunk of trials for one task/stream and return its tally.
// ---------------------------------------------------------------------------

type WorkerData = {
  suite: SuiteManifest;
  members: string[];
  seeds: number[];
};
type ChunkJob = {
  jobId: number;
  task: SimTask;
  stream: "calibration" | "holdout";
  trialStart: number;
  trialEnd: number;
};

if (!isMainThread) {
  const data = workerData as WorkerData;
  const referenceByCell = new Map<string, { score: number; valid: boolean }>();
  // The reference table is transferred once via SharedArrayBuffer-free plain
  // structured clone in workerData.entries.
  for (const [key, value] of (workerData as any).entries as Array<[string, { score: number; valid: boolean }]>) {
    referenceByCell.set(key, value);
  }
  const suiteCache = new Map<number, SuiteManifest>();
  const getSuite = (depth: number): SuiteManifest => {
    let cached = suiteCache.get(depth);
    if (cached === undefined) {
      cached = suiteForSeeds(data.suite, depth);
      suiteCache.set(depth, cached);
    }
    return cached;
  };

  parentPort!.on("message", (job: ChunkJob | { done: true }) => {
    if ("done" in job) { process.exit(0); }
    const { task, stream, trialStart, trialEnd } = job;
    const suite = getSuite(task.depth);
    const tally = emptyTally(task.evals);
    // Distinct criticalAlphas used by this task's rules.
    const criticalAlphas = [...new Set(task.evals.map((rule) => rule.criticalAlpha))];
    for (let trial = trialStart; trial < trialEnd; trial++) {
      const random = mulberry32(hashSeed(`${task.taskId}:${stream}:${trial}`));
      const { base, candidate } = trialRuns(
        task.scenario, suite, task.depth, task.shift, data.members, data.seeds, referenceByCell, random,
      );
      const decision = pairedV2DecisionForCalibration(base, candidate, suite, {
        profile: "canonical",
        mode: "improvement",
        bootstrapSeed: trial,
      });
      const delta = decision.delta;
      const se = decision.confidence.standardError;
      const dof = decision.confidence.degreesOfFreedom === null
        ? Infinity
        : decision.confidence.degreesOfFreedom;
      tally.count++;
      tally.sumDelta += delta;
      tally.sumSe += se;
      // Derated (policy) central interval: use the exact reported bounds.
      if (decision.confidence.centralLo <= task.trueDelta && decision.confidence.centralHi >= task.trueDelta) {
        tally.central99++;
      }
      // Nominal 95% central interval: recompute from SE/dof.
      if (se === 0) {
        if (delta === task.trueDelta) tally.central95++;
      } else {
        const c95 = studentTQuantile(0.975, dof);
        if (delta - c95 * se <= task.trueDelta && delta + c95 * se >= task.trueDelta) tally.central95++;
      }
      // Critical values shared across all rules with the same criticalAlpha.
      const criticalValue = new Map<number, number>();
      for (const alpha of criticalAlphas) {
        criticalValue.set(alpha, se === 0 ? 0 : studentTQuantile(1 - alpha, dof));
      }
      for (const rule of task.evals) {
        const outcome = outcomeAt(delta, se, criticalValue.get(rule.criticalAlpha)!, rule.threshold);
        tally.evals[rule.key][outcome]++;
      }
      // Validation: our recompute at the reference operating point (threshold 0,
      // criticalAlpha 0.01, improvement) must match the frozen policy outcome.
      const recomputed = outcomeAt(delta, se, criticalValue.get(0.01) ?? (se === 0 ? 0 : studentTQuantile(0.99, dof)), 0);
      if (recomputed !== decision.outcome) tally.policyDisagreement++;
    }
    parentPort!.postMessage({ jobId: job.jobId, taskId: task.taskId, stream, tally });
  });
}

// ---------------------------------------------------------------------------
// Main thread.
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const argument = argumentReader(process.argv.slice(2));
  const smoke = process.argv.includes("--smoke");
  const referencePath = resolve(
    argument("reference") ?? "benchmark/v2/runs/calibration-v2.5-coverage-reference.json.gz",
  );
  const outPath = resolve(argument("out") ?? "benchmark/v2/studies/power-grid.json");
  const workerCount = Number(argument("workers") ?? (smoke ? 4 : 48));
  const dropDepth64 = process.argv.includes("--drop-64");

  // Engine-heavy loaders are imported only here (never in workers).
  const { loadSourceManifest, loadSourceSpec, resolveSources } = await import("../v0/benchmark_v2/model.ts");
  const { buildAxisContract, scoreV2Report } = await import("../v0/benchmark_v2/evaluator.ts");
  const { loadSuiteManifest, suiteIdentity } = await import("../v0/benchmark_v2/suite_model.ts");
  const { canonicalMembers } = await import("../v0/benchmark_v2/suite_model.ts");
  const { applyJolt } = await import("../produce/seed.ts");

  const sourcePath = "benchmark/v2/compat/source-manifest.json";
  const suitePath = "benchmark/v2/compat/suite-manifest.json";
  const sources = resolveSources(loadSourceManifest(sourcePath));
  const baseSuite = loadSuiteManifest(suitePath, sources);
  const identity = suiteIdentity(suitePath, sourcePath, sources);
  const referenceArtifact = readVerifiedReference(referencePath);
  const reference = JSON.parse(referenceArtifact.bytes.toString("utf8"));
  const scorerFingerprint = fingerprintFiles([
    "scripts/v0/benchmark_v2/evaluator.ts",
    "scripts/v0/benchmark_v2/score_model.ts",
    "scripts/v0/score.ts",
  ]);
  const decisionInferenceFingerprint = fingerprintFiles(DECISION_INFERENCE_SOURCE_FILES);
  if (
    !["line.benchmark-v2.budget-scale-study.v1", "line.benchmark-v2.budget-scale-study.v2"].includes(reference.schema) ||
    reference.suiteFingerprint !== identity.suiteFingerprint ||
    reference.sourceManifestFingerprint !== identity.sourceManifestFingerprint ||
    reference.definitionFingerprint !== identity.definitionFingerprint ||
    reference.scorerFingerprint !== scorerFingerprint ||
    JSON.stringify(reference.transform) !== JSON.stringify(baseSuite.transform)
  ) {
    throw new Error(`coverage reference does not match the current suite, sources, transform, and scorer`);
  }
  validateReferenceCompilerIdentity(reference.candidate);
  if (!Array.isArray(reference.seeds) || reference.seeds.length < 8 ||
      new Set(reference.seeds).size !== reference.seeds.length) {
    throw new Error(`coverage reference requires at least eight unique seed blocks`);
  }

  const members = canonicalMembers(baseSuite);
  const contracts = new Map();
  for (const source of sources) {
    const spec = applyJolt(await loadSourceSpec(source), baseSuite.transform.jolt_ms);
    contracts.set(source.id, buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents));
  }
  const referenceByCell = new Map<string, { score: number; valid: boolean }>();
  for (const row of reference.runs ?? []) {
    const source = sources.find((entry: any) => entry.id === row.task?.sourceId);
    if (
      source === undefined || row.status !== "ok" || row.report === null ||
      row.source?.sourceFingerprint !== source.sourceFingerprint || !Number.isSafeInteger(row.authoredContacts)
    ) throw new Error(`coverage reference contains an invalid raw run`);
    const rescored = scoreV2Report(row.report, row.authoredContacts, contracts.get(source.id), baseSuite);
    if (JSON.stringify(rescored) !== JSON.stringify(row.score)) {
      throw new Error(`${source.id}: coverage reference score does not match its raw report`);
    }
    referenceByCell.set(cellKey(source.id, row.task.budget, row.task.actualSeed), {
      score: rescored.score, valid: rescored.valid,
    });
  }
  for (const budget of baseSuite.profiles.canonical.budgets) {
    for (const seed of reference.seeds) {
      for (const sourceId of members) {
        if (!referenceByCell.has(cellKey(sourceId, budget, seed))) {
          throw new Error(`coverage reference is missing ${sourceId}/${budget}/${seed}`);
        }
      }
    }
  }
  console.log(`reference verified: ${members.length} members x ${baseSuite.profiles.canonical.budgets.length} budgets x ${reference.seeds.length} seeds`);

  // -- Solve empirical score shifts for target true catalog deltas. ----------
  const empiricalShiftTruth = (shift: number): number => {
    const fullSuite = suiteForSeeds(baseSuite, reference.seeds.length);
    const base: DecisionRun[] = [];
    const candidate: DecisionRun[] = [];
    for (const budget of fullSuite.profiles.canonical.budgets) {
      reference.seeds.forEach((seed: number, seedSlot: number) => {
        for (const sourceId of members) {
          const original = referenceByCell.get(cellKey(sourceId, budget, seed))!;
          const task = { sourceId, budget, seedSlot, actualSeed: seedSlot };
          base.push({ ...task, score: { ...original } });
          candidate.push({
            ...task,
            score: original.valid ? { ...original, score: clampScore(original.score + shift) } : { ...original },
          });
        }
      });
    }
    return pairedV2DecisionForCalibration(base, candidate, fullSuite, {
      profile: "canonical", mode: "improvement", bootstrapSeed: 0,
    }).delta;
  };
  const solveShiftForDelta = (targetDelta: number): number => {
    if (targetDelta === 0) return 0;
    let low = targetDelta > 0 ? 0 : -60;
    let high = targetDelta > 0 ? 60 : 0;
    // empiricalShiftTruth is monotone non-decreasing in the shift.
    for (let iteration = 0; iteration < 60; iteration++) {
      const middle = (low + high) / 2;
      if (empiricalShiftTruth(middle) < targetDelta) low = middle;
      else high = middle;
    }
    return (low + high) / 2;
  };

  const improvementTargets = [0, 2, 3, 5, 8, 12];
  const improvementShifts = improvementTargets.map((target) => {
    const shift = solveShiftForDelta(target);
    return { targetDelta: target, shift: round(shift), trueDelta: round(empiricalShiftTruth(shift)) };
  });
  console.log(`improvement shifts: ${improvementShifts.map((s) => `${s.targetDelta}=>shift ${s.shift} (true ${s.trueDelta})`).join(", ")}`);
  // Anchor sanity: existing study documents +15 shift => true delta ~ +12.8.
  const anchorTrueDelta = round(empiricalShiftTruth(15));
  console.log(`anchor: shift +15 => true delta ${anchorTrueDelta} (expected ~12.8)`);

  const simplificationMargins = [1, 2, 3, 5];
  const boundaryShifts = simplificationMargins.map((margin) => {
    const shift = solveShiftForDelta(-margin);
    return { margin, shift: round(shift), trueDelta: round(empiricalShiftTruth(shift)) };
  });
  console.log(`boundary shifts: ${boundaryShifts.map((s) => `m${s.margin}=>shift ${s.shift} (true ${s.trueDelta})`).join(", ")}`);

  // -- Build the task list. --------------------------------------------------
  const improvementDepths = (smoke ? [3, 8, 16] : [3, 8, 16, 32, 64, 128]).filter((d) => !(dropDepth64 && d === 64));
  const stressDepths = smoke ? [3, 8] : [3, 8, 32];
  const simplificationDepths = smoke ? [8, 16] : [8, 32, 128];
  const trialsFor = (depth: number): number => {
    if (smoke) return 24;
    if (depth <= 16) return 1000;
    if (depth === 32) return 500;
    return 300;
  };

  const improvementEvals = (): EvalRule[] =>
    CRITICALS.map((criticalAlpha) => ({ key: `impr|${criticalAlpha}`, threshold: 0, criticalAlpha }));
  const noninferiorityEvals = (): EvalRule[] =>
    simplificationMargins.flatMap((margin) =>
      CRITICALS.map((criticalAlpha) => ({ key: `noninf_m${margin}|${criticalAlpha}`, threshold: -margin, criticalAlpha })));
  const nullEvals = (): EvalRule[] =>
    CRITICALS.map((criticalAlpha) => ({ key: `null|${criticalAlpha}`, threshold: 0, criticalAlpha }));

  const tasks: SimTask[] = [];
  // Improvement grid: depth x true delta. The shift==0 sim at simplification
  // depths also carries non-inferiority (threshold=-margin) evals so the
  // simplification delta=0 power reuses that one simulation.
  for (const depth of improvementDepths) {
    for (const target of improvementShifts) {
      const evals = improvementEvals();
      if (target.targetDelta === 0 && simplificationDepths.includes(depth)) {
        evals.push(...noninferiorityEvals());
      }
      tasks.push({
        taskId: `impr:d${depth}:t${target.targetDelta}`,
        kind: "improvement",
        scenario: "empirical_shift",
        depth,
        shift: target.shift,
        trueDelta: target.trueDelta,
        trials: trialsFor(depth),
        evals,
      });
    }
  }
  // Zero-inflation stress nulls.
  for (const depth of stressDepths) {
    for (const scenario of ["symmetric_validity_flips", "catalog_wide_hard_zero"] as const) {
      tasks.push({
        taskId: `stress:${scenario}:d${depth}`,
        kind: "null_stress",
        scenario,
        depth,
        shift: 0,
        trueDelta: 0,
        trials: trialsFor(depth),
        evals: nullEvals(),
      });
    }
  }
  // Simplification boundary: true delta = -margin (want accept <= 5%).
  for (const depth of simplificationDepths) {
    for (const boundary of boundaryShifts) {
      tasks.push({
        taskId: `boundary:d${depth}:m${boundary.margin}`,
        kind: "simplification_boundary",
        scenario: "empirical_shift",
        depth,
        shift: boundary.shift,
        trueDelta: boundary.trueDelta,
        trials: trialsFor(depth),
        evals: CRITICALS.map((criticalAlpha) => ({
          key: `boundary_m${boundary.margin}|${criticalAlpha}`, threshold: -boundary.margin, criticalAlpha,
        })),
      });
    }
  }

  // -- Chunk into jobs (per validation stream). ------------------------------
  const chunkDecisionsByDepth: Record<number, number> = { 3: 500, 8: 500, 16: 125, 32: 50, 64: 25, 128: 10 };
  const jobs: ChunkJob[] = [];
  let jobId = 0;
  const totalDecisions = { value: 0 };
  for (const task of tasks) {
    const perStream = task.trials / 2;
    if (!Number.isInteger(perStream)) throw new Error(`${task.taskId}: trials must be even`);
    const chunk = smoke ? perStream : (chunkDecisionsByDepth[task.depth] ?? perStream);
    for (const stream of ["calibration", "holdout"] as const) {
      for (let start = 0; start < perStream; start += chunk) {
        const end = Math.min(perStream, start + chunk);
        jobs.push({ jobId: jobId++, task, stream, trialStart: start, trialEnd: end });
        totalDecisions.value += end - start;
      }
    }
  }
  // Longest-processing-time-first: per-decision cost grows ~ depth^2, so start
  // the heaviest n=128 chunks immediately and leave cheap chunks for the tail.
  jobs.sort((a, b) =>
    (b.task.depth ** 2 * (b.trialEnd - b.trialStart)) - (a.task.depth ** 2 * (a.trialEnd - a.trialStart)));
  console.log(`dispatching ${jobs.length} chunk jobs (${totalDecisions.value} decisions) across ${workerCount} workers`);

  // -- Run the worker pool. --------------------------------------------------
  const tallies = new Map<string, { calibration: StreamTally; holdout: StreamTally }>();
  for (const task of tasks) {
    tallies.set(task.taskId, { calibration: emptyTally(task.evals), holdout: emptyTally(task.evals) });
  }
  const referenceEntries = [...referenceByCell.entries()];
  const startedAt = Date.now();
  await runPool(workerCount, jobs, { suite: baseSuite, members, seeds: reference.seeds }, referenceEntries,
    (result, doneCount) => {
      const bucket = tallies.get(result.taskId)!;
      mergeTally(bucket[result.stream], result.tally);
      if (doneCount % 25 === 0 || doneCount === jobs.length) {
        const elapsed = (Date.now() - startedAt) / 1000;
        const rate = doneCount / elapsed;
        const eta = rate > 0 ? (jobs.length - doneCount) / rate : 0;
        console.log(`  ${doneCount}/${jobs.length} jobs (${elapsed.toFixed(0)}s elapsed, ETA ${eta.toFixed(0)}s)`);
      }
    });
  const runtimeSeconds = round((Date.now() - startedAt) / 1000);
  console.log(`simulation complete in ${runtimeSeconds}s`);

  // -- Assemble the report. --------------------------------------------------
  const report = assembleReport({
    reference, referencePath, referenceArtifact, identity, scorerFingerprint,
    decisionInferenceFingerprint, members, baseSuite, improvementShifts, boundaryShifts,
    simplificationMargins, improvementDepths, stressDepths, simplificationDepths, anchorTrueDelta,
    smoke, dropDepth64, workerCount, runtimeSeconds, totalDecisions: totalDecisions.value, tasks, tallies,
  });
  mkdirSync(dirname(outPath), { recursive: true });
  const reportBytes = `${JSON.stringify(report, null, 2)}\n`;
  writeFileSync(outPath, reportBytes);
  writeFileSync(`${outPath.replace(/\.json$/, "")}.provenance.json`, `${JSON.stringify({
    schema: "line.benchmark-v2.study-provenance.v1",
    artifact: relative(outPath),
    artifactSha256: createHash("sha256").update(reportBytes).digest("hex"),
    generatedAt: new Date().toISOString(),
    runtimeSeconds,
    workers: workerCount,
    command: "node --import tsx scripts/benchmark/study_power_grid.ts",
  }, null, 2)}\n`);
  console.log(`wrote ${relative(outPath)} (+ provenance sidecar)`);
  printConsoleSummary(report);
}

// ---------------------------------------------------------------------------
// Worker pool orchestration (main thread).
// ---------------------------------------------------------------------------

function runPool(
  workerCount: number,
  jobs: ChunkJob[],
  data: WorkerData,
  entries: Array<[string, { score: number; valid: boolean }]>,
  onResult: (result: { taskId: string; stream: "calibration" | "holdout"; tally: StreamTally }, doneCount: number) => void,
): Promise<void> {
  return new Promise((resolvePromise, rejectPromise) => {
    let nextJob = 0;
    let done = 0;
    const workers: Worker[] = [];
    const dispatch = (worker: Worker): void => {
      if (nextJob >= jobs.length) { worker.postMessage({ done: true }); return; }
      worker.postMessage(jobs[nextJob++]);
    };
    const count = Math.max(1, Math.min(workerCount, jobs.length));
    for (let i = 0; i < count; i++) {
      const worker = new Worker(new URL(import.meta.url), {
        execArgv: process.execArgv,
        workerData: { ...data, entries },
      });
      worker.on("message", (result: { taskId: string; stream: "calibration" | "holdout"; tally: StreamTally }) => {
        done++;
        onResult(result, done);
        if (done === jobs.length) {
          for (const w of workers) void w.terminate();
          resolvePromise();
        } else {
          dispatch(worker);
        }
      });
      worker.on("error", rejectPromise);
      workers.push(worker);
      dispatch(worker);
    }
  });
}

// ---------------------------------------------------------------------------
// Report assembly & statistics (main thread).
// ---------------------------------------------------------------------------

function rateWithWilson(count: number, total: number): { count: number; total: number; rate: number; wilson95: [number, number] } {
  const z = 1.959963984540054;
  if (total === 0) return { count, total, rate: 0, wilson95: [0, 0] };
  const p = count / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return { count, total, rate: round(p), wilson95: [round(Math.max(0, center - half)), round(Math.min(1, center + half))] };
}

function streamStats(tally: StreamTally, evalKeys: string[]): any {
  const byCritical: Record<string, Record<string, any>> = {};
  for (const key of evalKeys) {
    const [label, alpha] = key.split("|");
    (byCritical[alpha] ??= {})[label] = {
      accept: rateWithWilson(tally.evals[key].accept, tally.count),
      reject: rateWithWilson(tally.evals[key].reject, tally.count),
      inconclusive: rateWithWilson(tally.evals[key].inconclusive, tally.count),
    };
  }
  return {
    trials: tally.count,
    meanDelta: tally.count > 0 ? round(tally.sumDelta / tally.count) : null,
    meanSeedBlockSe: tally.count > 0 ? round(tally.sumSe / tally.count) : null,
    centralCoverageDerated99: rateWithWilson(tally.central99, tally.count),
    centralCoverageNominal95: rateWithWilson(tally.central95, tally.count),
    policyDisagreement: tally.policyDisagreement,
    byCritical,
  };
}

function combineTally(a: StreamTally, b: StreamTally, evals: EvalRule[]): StreamTally {
  const merged = emptyTally(evals);
  mergeTally(merged, a);
  mergeTally(merged, b);
  return merged;
}

function assembleReport(ctx: any): any {
  const { tasks, tallies } = ctx;
  const cellFor = (task: SimTask): any => {
    const bucket = tallies.get(task.taskId)!;
    const evalKeys = task.evals.map((rule) => rule.key);
    const combined = combineTally(bucket.calibration, bucket.holdout, task.evals);
    return {
      taskId: task.taskId,
      kind: task.kind,
      scenario: task.scenario,
      depth: task.depth,
      shift: round(task.shift),
      trueDelta: round(task.trueDelta),
      trials: task.trials,
      combined: streamStats(combined, evalKeys),
      calibration: streamStats(bucket.calibration, evalKeys),
      holdout: streamStats(bucket.holdout, evalKeys),
    };
  };

  const improvementCells = tasks.filter((t: SimTask) => t.kind === "improvement").map(cellFor);
  const stressCells = tasks.filter((t: SimTask) => t.kind === "null_stress").map(cellFor);
  const boundaryCells = tasks.filter((t: SimTask) => t.kind === "simplification_boundary").map(cellFor);

  // Simplification non-inferiority (delta=0) accept rates, extracted from the
  // shift==0 improvement sims at simplification depths.
  const nonInferiorityCells: any[] = [];
  for (const depth of ctx.simplificationDepths) {
    const task = tasks.find((t: SimTask) => t.taskId === `impr:d${depth}:t0`);
    if (task === undefined) continue;
    const bucket = tallies.get(task.taskId)!;
    const combined = combineTally(bucket.calibration, bucket.holdout, task.evals);
    for (const margin of ctx.simplificationMargins) {
      const perCritical: Record<string, any> = {};
      for (const alpha of CRITICALS) {
        const key = `noninf_m${margin}|${alpha}`;
        perCritical[alpha] = {
          accept: rateWithWilson(combined.evals[key].accept, combined.count),
          reject: rateWithWilson(combined.evals[key].reject, combined.count),
          inconclusive: rateWithWilson(combined.evals[key].inconclusive, combined.count),
        };
      }
      nonInferiorityCells.push({ depth, margin, trueDelta: 0, trials: combined.count, byCritical: perCritical });
    }
  }

  // MDE(80%) per depth per critical, read off the improvement power curve.
  const mde: any[] = [];
  const improvementDepthsSorted = [...ctx.improvementDepths].sort((a: number, b: number) => a - b);
  for (const depth of improvementDepthsSorted) {
    const points = ctx.improvementShifts
      .map((s: any) => {
        const cell = improvementCells.find((c: any) => c.depth === depth && c.trueDelta === round(s.trueDelta));
        return cell ? { trueDelta: cell.trueDelta, cell } : null;
      })
      .filter((p: any) => p !== null)
      .sort((p: any, q: any) => p.trueDelta - q.trueDelta);
    const perCritical: Record<string, number | null> = {};
    for (const alpha of CRITICALS) {
      perCritical[alpha] = interpolateMde(points.map((p: any) => ({
        delta: p.trueDelta,
        power: p.cell.combined.byCritical[String(alpha)].impr.accept.rate,
      })), 0.8);
    }
    mde.push({ depth, mde80: perCritical });
  }

  return {
    schema: "line.benchmark-v2.power-grid-study.v2",
    smoke: ctx.smoke,
    methodology: {
      summary: "Empirical effect-size x seed-depth x policy operating-characteristic grid. Real observed 12-seed catalog blocks are resampled with replacement (rescored from raw reports before use) to synthesize base and candidate DecisionRun sets; the frozen pairedV2DecisionForCalibration produces the jackknife seed-block confidence; accept/reject/inconclusive is the one-sided Student-t rule (accept iff lower bound > threshold, reject iff upper bound < threshold).",
      dgp: {
        improvement_and_null: "Unpaired empirical blocks: base and candidate independently resample whole observed catalog seed blocks per (budget, seed slot); candidate valid runs receive the calibrated score shift. shift=0 is the empirical null.",
        zero_inflation_stress: "symmetric_validity_flips (shared observed block with an 8% one-sided hard-zero cell flip) and catalog_wide_hard_zero (each block independently valid at 500 or hard-zero with 80% validity per arm) mirror the derate-justifying nulls in study_decision_coverage.ts.",
        simplification: "Unpaired empirical blocks (a real simplification is a different compiler; no shared-seed zero-variance construction). Non-inferiority (true delta 0) reuses the shift=0 improvement sim evaluated at threshold=-margin; boundary (true delta = -margin) uses a negative calibrated shift.",
      },
      criticals: "Every cell is evaluated under criticalAlpha=0.01 (the current derated policy) and criticalAlpha=0.05 (the nominal, un-derated target). Both share one simulation because the seed-block confidence is independent of mode/margin/criticalAlpha; the outcome is recomputed from the reported SE and dof via the exported studentTQuantile. The recompute at (threshold=0, criticalAlpha=0.01, improvement) is validated against the frozen policy outcome per trial (policyDisagreement).",
      centralInterval: "centralCoverageDerated99 uses the policy's reported central bounds (nominal 95% derated to a 99% critical); centralCoverageNominal95 recomputes an un-derated 95% central interval. Coverage is of the true catalog delta.",
      trueDelta: "True catalog deltas are the full 12-seed paired headline delta of the applied score shift (empiricalShiftTruth), depth-independent, solved by monotone bisection to hit the target grid.",
      validationSplit: "Every cell runs two disjoint mulberry32 streams (calibration and holdout), half the trials each, reported separately and combined, giving a built-in held-out check for any future critical-value tuning.",
      rng: "Deterministic: each trial seeds mulberry32 from hash(taskId:stream:trialIndex). No Math.random / Date.now. Parallel execution is bit-identical to serial.",
      derate_note: `Policy alpha=${benchmarkDecisionPolicy.profiles.canonical.alpha} but criticalAlpha=${benchmarkDecisionPolicy.profiles.canonical.criticalAlpha} (the double derate); central nominal ${benchmarkDecisionPolicy.centralIntervalLevel} derated to ${benchmarkDecisionPolicy.centralCriticalIntervalLevel}.`,
    },
    reference: relative(ctx.referencePath),
    referenceArtifactSha256: ctx.referenceArtifact.artifactSha256,
    referenceRawSha256: ctx.referenceArtifact.rawSha256,
    referenceCandidateFingerprint: ctx.reference.candidate?.candidateFingerprint ?? null,
    suiteFingerprint: ctx.identity.suiteFingerprint,
    scorerFingerprint: ctx.scorerFingerprint,
    decisionInferenceFingerprint: ctx.decisionInferenceFingerprint,
    decisionPolicy: {
      method: benchmarkDecisionPolicy.method,
      alpha: benchmarkDecisionPolicy.profiles.canonical.alpha,
      criticalAlpha: benchmarkDecisionPolicy.profiles.canonical.criticalAlpha,
      centralIntervalLevel: benchmarkDecisionPolicy.centralIntervalLevel,
      centralCriticalIntervalLevel: benchmarkDecisionPolicy.centralCriticalIntervalLevel,
    },
    config: {
      totalDecisions: ctx.totalDecisions,
      droppedDepth64: ctx.dropDepth64,
      improvementDepths: ctx.improvementDepths,
      stressDepths: ctx.stressDepths,
      simplificationDepths: ctx.simplificationDepths,
      improvementTargets: ctx.improvementShifts.map((s: any) => s.targetDelta),
      simplificationMargins: ctx.simplificationMargins,
      criticals: [...CRITICALS],
      trialsByDepth: { "<=16": 1000, "32": 500, "64_128": 300, smoke: ctx.smoke ? 24 : null },
      anchorShift15TrueDelta: ctx.anchorTrueDelta,
    },
    shifts: {
      improvement: ctx.improvementShifts,
      simplificationBoundary: ctx.boundaryShifts,
    },
    improvementCells,
    stressCells,
    simplificationNonInferiorityCells: nonInferiorityCells,
    simplificationBoundaryCells: boundaryCells,
    mde80: mde,
  };
}

/** Linear interpolation of the smallest true delta whose power crosses target. */
function interpolateMde(points: Array<{ delta: number; power: number }>, target: number): number | null {
  const sorted = [...points].sort((a, b) => a.delta - b.delta);
  if (sorted.length === 0) return null;
  if (sorted[0].power >= target) return sorted[0].delta;
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (cur.power >= target && prev.power < target) {
      if (cur.power === prev.power) return cur.delta;
      const frac = (target - prev.power) / (cur.power - prev.power);
      return round(prev.delta + frac * (cur.delta - prev.delta));
    }
  }
  return null; // power never reaches target within the grid
}

function printConsoleSummary(report: any): void {
  const pct = (r: any): string => `${(r.rate * 100).toFixed(1)}%`;
  console.log("\n=== IMPROVEMENT POWER (combined) accept-rate by depth x true delta ===");
  const depths = report.config.improvementDepths;
  const deltas = report.shifts.improvement.map((s: any) => s.trueDelta);
  for (const alpha of report.config.criticals) {
    console.log(`-- criticalAlpha=${alpha} --`);
    console.log(`depth\\Δ  ${deltas.map((d: number) => d.toFixed(1).padStart(7)).join("")}`);
    for (const depth of depths) {
      const row = deltas.map((d: number) => {
        const cell = report.improvementCells.find((c: any) => c.depth === depth && c.trueDelta === d);
        return cell ? pct(cell.combined.byCritical[String(alpha)].impr.accept).padStart(7) : "   n/a";
      });
      console.log(`${String(depth).padStart(6)}  ${row.join("")}`);
    }
  }
  console.log("\n=== MDE(80%) per depth (true-delta points needed for >=80% accept) ===");
  for (const row of report.mde80) {
    console.log(`depth ${String(row.depth).padStart(4)}: alpha0.01=${fmtMde(row.mde80["0.01"])}  alpha0.05=${fmtMde(row.mde80["0.05"])}`);
  }
  console.log("\n=== NULL / STRESS false-accept (combined) ===");
  const nullDepth = report.improvementCells.filter((c: any) => c.trueDelta === 0);
  for (const c of nullDepth) {
    console.log(`empirical-null depth ${String(c.depth).padStart(4)}: 0.01=${pct(c.combined.byCritical["0.01"].impr.accept)}  0.05=${pct(c.combined.byCritical["0.05"].impr.accept)}`);
  }
  for (const c of report.stressCells) {
    console.log(`${c.scenario} depth ${String(c.depth).padStart(4)}: 0.01=${pct(c.combined.byCritical["0.01"].null.accept)}  0.05=${pct(c.combined.byCritical["0.05"].null.accept)}`);
  }
  console.log("\n=== SIMPLIFICATION non-inferiority accept (delta=0, want high) / boundary false-accept (delta=-margin, want <=5%) ===");
  for (const ni of report.simplificationNonInferiorityCells) {
    const b = report.simplificationBoundaryCells.find((c: any) => c.depth === ni.depth && c.taskId === `boundary:d${ni.depth}:m${ni.margin}`);
    const bAcc001 = b ? pct(b.combined.byCritical["0.01"][`boundary_m${ni.margin}`].accept) : "n/a";
    const bAcc005 = b ? pct(b.combined.byCritical["0.05"][`boundary_m${ni.margin}`].accept) : "n/a";
    console.log(`depth ${String(ni.depth).padStart(4)} margin ${ni.margin}: noninf 0.01=${pct(ni.byCritical["0.01"].accept)} 0.05=${pct(ni.byCritical["0.05"].accept)} | boundary 0.01=${bAcc001} 0.05=${bAcc005}`);
  }
  const disagreements = [...report.improvementCells, ...report.stressCells, ...report.simplificationBoundaryCells]
    .reduce((sum: number, c: any) => sum + c.combined.policyDisagreement, 0);
  console.log(`\npolicy recompute disagreements vs frozen outcome (should be ~0): ${disagreements}`);
}

function fmtMde(value: number | null): string {
  return value === null ? ">grid" : value.toFixed(2);
}

// ---------------------------------------------------------------------------
// Reference verification (mirrors study_decision_coverage.ts).
// ---------------------------------------------------------------------------

function readVerifiedReference(path: string): { bytes: Buffer; artifactSha256: string; rawSha256: string } {
  if (!existsSync(path) || !existsSync(`${path}.sha256`)) {
    throw new Error(`retained coverage reference and checksum sidecar are required`);
  }
  const artifact = readFileSync(path);
  const artifactSha256 = sha256(artifact);
  const expected = readFileSync(`${path}.sha256`, "utf8").trim().split(/\s+/)[0];
  if (artifactSha256 !== expected) throw new Error(`coverage reference checksum mismatch`);
  const bytes = path.endsWith(".gz") ? gunzipSync(artifact) : artifact;
  return { bytes, artifactSha256, rawSha256: sha256(bytes) };
}

function validateReferenceCompilerIdentity(candidate: any): void {
  const required = [
    "package.json", "package-lock.json", "tsconfig.json", "scripts/v0/arc.ts",
    "scripts/v0/arc_placement.ts", "scripts/v0/score.ts", "scripts/v0/optimizer/handoff.ts",
    "scripts/lib/detector.ts", "engine-rs/Cargo.toml",
  ];
  if (
    candidate?.compilerIdentityProtocol !== COMPILER_IDENTITY_PROTOCOL ||
    !Array.isArray(candidate.compilerSourceFiles) ||
    required.some((path) => !candidate.compilerSourceFiles.includes(path)) ||
    candidate.compilerEnvironment === null || typeof candidate.compilerEnvironment !== "object" ||
    typeof candidate.compilerSourceFingerprint !== "string" ||
    typeof candidate.engineArtifactFingerprint !== "string"
  ) throw new Error(`coverage reference compiler identity is incomplete`);
  const expected = sha256(Buffer.from(JSON.stringify({
    compilerIdentityProtocol: candidate.compilerIdentityProtocol,
    compilerSourceFingerprint: candidate.compilerSourceFingerprint,
    compilerEnvironment: candidate.compilerEnvironment,
    engine: candidate.engine,
    engineArtifactFingerprint: candidate.engineArtifactFingerprint,
  })));
  if (candidate.candidateFingerprint !== expected) {
    throw new Error(`coverage reference compiler identity is not self-consistent`);
  }
}

function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}

if (isMainThread) {
  main().catch((error) => { console.error(error); process.exit(1); });
}
