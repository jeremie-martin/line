/**
 * Power levers study: seeds versus specifications (Benchmark V2).
 *
 * Question (Jérémie, 2026-07-11): to buy decision power, is it better to run
 * more seeds per budget or to grow the catalog with more specifications /
 * variants? This measures, on the pooled 24-block reference, how the paired
 * seed-block jackknife SE of the headline delta scales along both axes:
 *
 *   - seeds axis:   seedsPerBudget in {8, 16, 32, 64} at the full catalog;
 *   - catalog axis: parent-preserving subsamples of the catalog
 *                   (fractions {0.25, 0.5, 0.75, 1.0}) at fixed depths.
 *
 * Each cell simulates null unpaired empirical-block trials (the SE is what
 * matters; power curves at any effect follow from SE and dof) and reports the
 * mean jackknife SE, mean dof, the implied MDE(80%) at the policy critical
 * (alpha=0.01), and the total compile cost of a two-arm confirmation at that
 * cell — giving the per-compile trade curve between the two levers.
 *
 * Caveats stated in the artifact: subsampling measures how SE shrinks as the
 * *existing* catalog grows toward its full size; projecting beyond the full
 * catalog assumes new specifications carry a variance profile similar to the
 * current mix (composition effects are visible in the fraction cells).
 * Deterministic per-(cell, trial) seeding; byte-stable artifact + provenance.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { applyJolt } from "../produce/seed.ts";
import {
  pairedV2DecisionForCalibration,
  studentTQuantile,
  type DecisionRun,
} from "../v0/benchmark_v2/decision_model.ts";
import { buildAxisContract, type AxisContract } from "../v0/benchmark_v2/evaluator.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "../v0/benchmark_v2/model.ts";
import {
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
  suiteIdentity,
  type SuiteManifest,
} from "../v0/benchmark_v2/suite_model.ts";
import { readVerifiedArtifact, verifyScaleStudyArchive, cellKey } from "./study_lib.ts";

const REPO = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");

const DEPTHS = [8, 16, 32, 64];
const FRACTIONS = [0.25, 0.5, 0.75, 1];
const TRIALS = 300;
const CRITICAL_ALPHA = 0.01;
const POWER_TARGET_Z = 0.8416212335729143; // Phi^-1(0.80)

type CellSpec = { id: string; depth: number; fraction: number };
const CELLS: CellSpec[] = [
  // seeds axis at full catalog + catalog axis at two representative depths
  ...DEPTHS.map((depth) => ({ id: `d${depth}-f100`, depth, fraction: 1 })),
  ...FRACTIONS.filter((fraction) => fraction < 1).flatMap((fraction) => [
    { id: `d16-f${Math.round(fraction * 100)}`, depth: 16, fraction },
    { id: `d32-f${Math.round(fraction * 100)}`, depth: 32, fraction },
  ]),
];

type Tally = { count: number; sumSe: number; sumSeSq: number; sumDf: number };
type ChunkJob = { cellId: string; trialStart: number; trialEnd: number };

if (isMainThread) await main();
else workerLoop();

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
 * Parent-preserving catalog subsample: per group, keep a deterministic random
 * subset of parents (at least one), with all their members. Returns the
 * reduced suite clone plus its member list.
 */
function subsampleSuite(
  suite: SuiteManifest,
  fraction: number,
  random: () => number,
): { reduced: SuiteManifest; members: string[] } {
  if (fraction >= 1) return { reduced: suite, members: canonicalMembers(suite) };
  const reduced = structuredClone(suite);
  for (const stratum of reduced.strata) {
    for (const group of stratum.groups) {
      const parents = group.parents ?? group.members.map((id) => ({ id, members: [id] }));
      const keep = Math.max(1, Math.round(parents.length * fraction));
      const shuffled = [...parents];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      const kept = shuffled.slice(0, keep).sort((a, b) => a.id.localeCompare(b.id));
      group.parents = kept;
      group.members = kept.flatMap((parent) => parent.members);
    }
  }
  return { reduced, members: canonicalMembers(reduced) };
}

function suiteForSeeds(suite: SuiteManifest, seedsPerBudget: number): SuiteManifest {
  const cloned = structuredClone(suite);
  cloned.profiles.canonical.seeds_per_budget = seedsPerBudget;
  return cloned;
}

function workerLoop(): void {
  const data = workerData as {
    suite: SuiteManifest;
    seeds: number[];
    entries: Array<[string, { score: number; valid: boolean }]>;
    cells: CellSpec[];
  };
  const referenceByCell = new Map(data.entries);
  const cellsById = new Map(data.cells.map((cell) => [cell.id, cell]));

  parentPort!.on("message", (job: ChunkJob | { done: true }) => {
    if ("done" in job) process.exit(0);
    const cell = cellsById.get(job.cellId)!;
    const tally: Tally = { count: 0, sumSe: 0, sumSeSq: 0, sumDf: 0 };
    for (let trial = job.trialStart; trial < job.trialEnd; trial++) {
      const random = mulberry32(hashSeed(`levers:${job.cellId}:${trial}`));
      const { reduced, members } = subsampleSuite(data.suite, cell.fraction, random);
      const suiteAtDepth = suiteForSeeds(reduced, cell.depth);
      const base: DecisionRun[] = [];
      const candidate: DecisionRun[] = [];
      for (const budget of suiteAtDepth.profiles.canonical.budgets) {
        for (let seedSlot = 0; seedSlot < cell.depth; seedSlot++) {
          const baseSeed = data.seeds[Math.floor(random() * data.seeds.length)];
          const candidateSeed = data.seeds[Math.floor(random() * data.seeds.length)];
          for (const sourceId of members) {
            const task = { sourceId, budget, seedSlot, actualSeed: seedSlot };
            base.push({ ...task, score: { ...referenceByCell.get(cellKey(sourceId, budget, baseSeed))! } });
            candidate.push({ ...task, score: { ...referenceByCell.get(cellKey(sourceId, budget, candidateSeed))! } });
          }
        }
      }
      const decision = pairedV2DecisionForCalibration(base, candidate, suiteAtDepth, {
        profile: "canonical", mode: "improvement", bootstrapSeed: 0,
      });
      const se = decision.confidence.standardError;
      tally.count++;
      tally.sumSe += se;
      tally.sumSeSq += se * se;
      tally.sumDf += decision.confidence.degreesOfFreedom ?? 0;
    }
    parentPort!.postMessage({ cellId: job.cellId, tally });
  });
}

async function main(): Promise<void> {
  const startedAt = Date.now();
  const argument = (name: string): string | undefined => {
    const prefix = `--${name}=`;
    return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  };
  const referencePath = resolve(REPO, argument("reference") ??
    "benchmark/v2/runs/calibration-v2.4-pooled-reference-seeds-0-23.json.gz");
  const outPath = resolve(REPO, argument("out") ?? "benchmark/v2/studies/power-levers.json");
  const workerCount = Number(argument("workers") ?? 32);
  const trials = Number(argument("trials") ?? TRIALS);

  const sourceManifestPath = "benchmark/v2/compat/source-manifest.json";
  const suiteManifestPath = "benchmark/v2/compat/suite-manifest.json";
  const sources = resolveSources(loadSourceManifest(sourceManifestPath));
  const suite = loadSuiteManifest(suiteManifestPath, sources);
  const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
  const scorerFingerprint = fingerprintFiles([
    "scripts/v0/benchmark_v2/evaluator.ts",
    "scripts/v0/benchmark_v2/score_model.ts",
    "scripts/v0/score.ts",
  ]);
  const members = canonicalMembers(suite);
  const contracts = new Map<string, AxisContract>();
  for (const source of sources) {
    const spec = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
    contracts.set(source.id, buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents));
  }
  const referenceArtifact = readVerifiedArtifact(referencePath);
  const reference = JSON.parse(referenceArtifact.bytes.toString("utf8"));
  const referenceCells = verifyScaleStudyArchive(reference, {
    label: "pooled reference", identity, suite, sources, contracts, scorerFingerprint, members,
  });

  const chunkSize = 25;
  const jobs: ChunkJob[] = CELLS.flatMap((cell) =>
    Array.from({ length: Math.ceil(trials / chunkSize) }, (_, index) => ({
      cellId: cell.id,
      trialStart: index * chunkSize,
      trialEnd: Math.min(trials, (index + 1) * chunkSize),
    })),
  );
  console.log(`dispatching ${jobs.length} chunk jobs (${CELLS.length} cells x ${trials} trials) across ${workerCount} workers`);

  const tallies = new Map<string, Tally>();
  await new Promise<void>((resolvePromise, rejectPromise) => {
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
        workerData: { suite, seeds: reference.seeds, entries: [...referenceCells.entries()], cells: CELLS },
      });
      worker.on("message", (result: { cellId: string; tally: Tally }) => {
        done++;
        const existing = tallies.get(result.cellId);
        tallies.set(result.cellId, existing === undefined ? result.tally : {
          count: existing.count + result.tally.count,
          sumSe: existing.sumSe + result.tally.sumSe,
          sumSeSq: existing.sumSeSq + result.tally.sumSeSq,
          sumDf: existing.sumDf + result.tally.sumDf,
        });
        if (done % 20 === 0 || done === jobs.length) console.log(`  ${done}/${jobs.length} chunks`);
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

  const fullParents = suite.strata.flatMap((s) => s.groups.flatMap((g) => g.parents ?? [])).length;
  const cells = CELLS.map((cell) => {
    const tally = tallies.get(cell.id)!;
    const meanSe = tally.sumSe / tally.count;
    const meanDf = tally.sumDf / tally.count;
    const seSd = Math.sqrt(Math.max(0, tally.sumSeSq / tally.count - meanSe * meanSe));
    const critical = studentTQuantile(1 - CRITICAL_ALPHA, Math.max(1, meanDf));
    const memberCount = Math.round(members.length * cell.fraction);
    return {
      ...cell,
      trials: tally.count,
      approxMembers: cell.fraction >= 1 ? members.length : memberCount,
      meanSeedBlockSe: round(meanSe),
      seSd: round(seSd),
      meanDof: round(meanDf),
      mde80: round((critical + POWER_TARGET_Z) * meanSe),
      compilesPerArm: Math.round(suite.profiles.canonical.budgets.length * cell.depth * members.length * cell.fraction),
      compilesTwoArms: Math.round(2 * suite.profiles.canonical.budgets.length * cell.depth * members.length * cell.fraction),
    };
  });

  const report = {
    schema: "line.benchmark-v2.power-levers-study.v1",
    question:
      "Seeds versus specifications: how does the paired seed-block jackknife SE of the headline delta scale with seeds per budget versus catalog size, and which lever buys more power per compile?",
    reference: rel(referencePath),
    referenceArtifactSha256: referenceArtifact.artifactSha256,
    suiteFingerprint: identity.suiteFingerprint,
    scorerFingerprint,
    methodology: {
      dgp: "Null unpaired empirical blocks resampled from the pooled reference (the SE is effect-independent; power at any effect follows from SE and dof via the one-sided Student-t rule).",
      catalogAxis: "Parent-preserving subsample per trial: each group keeps a deterministic random subset of its parents (at least one) with all their members; group and stratum weights are unchanged (the geometric means renormalize over remaining parents).",
      seedsAxis: "profiles.canonical.seeds_per_budget overridden per cell via the suite-clone pattern.",
      mde: "MDE(80%) = (t(1-alpha, mean dof) + z(0.80)) x mean SE at alpha=0.01 (the current policy critical).",
      extrapolationCaveat: "Subsampling measures SE shrinkage as the existing catalog grows toward full size; projecting beyond the full catalog assumes new specifications resemble the current variance mix. Composition effects are visible across fraction cells (frontier-heavy subsets are noisier).",
      rng: "Deterministic per (cell, trial); independent of worker layout.",
    },
    fullCatalog: { members: members.length, parents: fullParents },
    criticalAlpha: CRITICAL_ALPHA,
    cells,
  };
  const bytes = `${JSON.stringify(report, null, 2)}\n`;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, bytes);
  writeFileSync(`${outPath.replace(/\.json$/, "")}.provenance.json`, `${JSON.stringify({
    schema: "line.benchmark-v2.study-provenance.v1",
    artifact: rel(outPath),
    artifactSha256: createHash("sha256").update(bytes).digest("hex"),
    generatedAt: new Date().toISOString(),
    runtimeSeconds: round((Date.now() - startedAt) / 1000),
    workers: workerCount,
    command: "node --import tsx scripts/benchmark/study_power_levers.ts",
  }, null, 2)}\n`);
  console.log(`\nwrote ${rel(outPath)}`);
  for (const cell of cells) {
    console.log(`  ${cell.id.padEnd(10)} members=${String(cell.approxMembers).padStart(3)} SE=${cell.meanSeedBlockSe.toFixed(3)} MDE80=${cell.mde80.toFixed(2)} compiles(2 arms)=${cell.compilesTwoArms}`);
  }
}

function round(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function rel(path: string): string {
  const prefix = `${REPO}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
