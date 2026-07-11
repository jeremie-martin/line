// Probe operating characteristics + futility-value study (Benchmark V2).
//
// Two questions:
//   (A) What are the probe screening policy's actual empirical error rates? The probe
//       profile has no guard-enforced calibration cells today (decision-coverage.json only
//       covers canonical 8-seed cells). This materializes probe-profile null/power/screening
//       cells against the retained empirical-block reference.
//   (B) How well does early evidence predict the final canonical outcome? For each true
//       delta we simulate ONE canonical-style run at depth n=32 seeds/budget and read interim
//       looks (the first k blocks of that same run) to characterize interim-futility stopping
//       as an alternative to the separate two-stage probe.
//
// Read-only: imports the frozen decision/scoring/suite machinery, resamples the retained
// coverage reference, and writes only benchmark/v2/studies/probe-futility.json. No existing
// file is modified. The script self-forks (child_process) to parallelize the expensive
// canonical jackknife decisions across cores; per-(scenario,trial) seeding makes the output
// independent of shard layout, so results are reproducible regardless of concurrency.

import { spawnSync } from "node:child_process";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gunzipSync } from "node:zlib";
import { COMPILER_IDENTITY_PROTOCOL, benchmarkDecisionPolicy } from "../../benchmark/v2/decision-policy.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  DECISION_INFERENCE_SOURCE_FILES,
  pairedV2DecisionForCalibration,
  studentTQuantile,
  type DecisionRun,
} from "../v0/benchmark_v2/decision_model.ts";
import { buildAxisContract, scoreV2Report } from "../v0/benchmark_v2/evaluator.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "../v0/benchmark_v2/model.ts";
import {
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
  suiteIdentity,
  type SuiteManifest,
} from "../v0/benchmark_v2/suite_model.ts";
import { argumentReader, round, sha256 } from "../v0/benchmark_v2/util.ts";

// ---------------------------------------------------------------------------
// Shared constants / small utilities (used by both main and worker branches).
// ---------------------------------------------------------------------------

const SELF_PATH = fileURLToPath(import.meta.url);
const INTERIM_LOOKS = [2, 3, 4, 8, 16] as const;
const DEPTH_SEEDS = 32;
// Interim delta-estimate bins for the P(final accept | interim estimate) calibration curve.
const ESTIMATE_BIN_EDGES = [-Infinity, -4, -2, -1, 0, 1, 2, 4, 8, Infinity];
// One-sided upper-bound levels evaluated for the "upper bound < 0" futility rule.
const UPPER_BOUND_ALPHAS = [0.05, 0.01] as const;
// Threshold sweep for the estimate<threshold rule at k=3.
const THRESHOLD_SWEEP = [-2, -1, 0, 1] as const;

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
function cellKey(sourceId: string, budget: number, seed: number): string {
  return `${sourceId}\0${budget}\0${seed}`;
}
function pick<T>(values: readonly T[], random: () => number): T {
  return values[Math.floor(random() * values.length)];
}

type CellScore = { score: number; valid: boolean };

// A compact, self-contained payload every worker reads (no spec loading / no 183MB reference).
type WorkerPayload = {
  suite: SuiteManifest;
  members: string[];
  seeds: number[];
  referenceByCell: Array<[string, CellScore]>;
};

// Trial record shape returned by Part B workers.
type LookStat = { k: number; estimate: number; se: number; df: number | null };
type PartBRecord = {
  looks: LookStat[];
  final: { estimate: number; se: number; df: number | null; outcome: string };
};

// ===========================================================================
// WORKER BRANCH
// ===========================================================================

function outcomeFrom(
  estimate: number,
  se: number,
  df: number | null,
  threshold: number,
  criticalAlpha: number,
): "positive" | "negative" | "unresolved" {
  const t = se === 0 ? 0 : studentTQuantile(1 - criticalAlpha, df === null ? Infinity : df);
  const lower = estimate - t * se;
  const upper = estimate + t * se;
  if (lower > threshold) return "positive";
  if (upper < threshold) return "negative";
  return "unresolved";
}

function makeWorkerContext(payload: WorkerPayload) {
  const referenceByCell = new Map<string, CellScore>(payload.referenceByCell);
  const suite = payload.suite;
  const members = payload.members;
  const seeds = payload.seeds;

  function suiteForCanonicalSeeds(n: number): SuiteManifest {
    const cloned = structuredClone(suite);
    cloned.profiles.canonical.seeds_per_budget = n;
    return cloned;
  }

  // Unpaired empirical-block DGP: base and candidate independently resample whole observed
  // catalog seed blocks; the candidate additionally receives +shift on valid cells.
  function empiricalRuns(
    budgets: number[],
    seedsPerBudget: number,
    shift: number,
    random: () => number,
  ): { base: DecisionRun[]; candidate: DecisionRun[] } {
    const base: DecisionRun[] = [];
    const candidate: DecisionRun[] = [];
    for (const budget of budgets) {
      for (let slot = 0; slot < seedsPerBudget; slot++) {
        const baseSeed = pick(seeds, random);
        const candSeed = pick(seeds, random);
        for (const sourceId of members) {
          const bs = referenceByCell.get(cellKey(sourceId, budget, baseSeed))!;
          const cs0 = referenceByCell.get(cellKey(sourceId, budget, candSeed))!;
          const cs = shift !== 0 && cs0.valid
            ? { score: clampScore(cs0.score + shift), valid: true }
            : cs0;
          const task = { sourceId, budget, seedSlot: slot, actualSeed: slot };
          base.push({ ...task, score: { ...bs } });
          candidate.push({ ...task, score: { ...cs } });
        }
      }
    }
    return { base, candidate };
  }

  function symmetricValidityFlipRuns(
    budgets: number[],
    seedsPerBudget: number,
    random: () => number,
  ): { base: DecisionRun[]; candidate: DecisionRun[] } {
    const base: DecisionRun[] = [];
    const candidate: DecisionRun[] = [];
    for (const budget of budgets) {
      for (let slot = 0; slot < seedsPerBudget; slot++) {
        const sharedSeed = pick(seeds, random);
        for (const sourceId of members) {
          const original = referenceByCell.get(cellKey(sourceId, budget, sharedSeed))!;
          let baseScore: CellScore = original;
          let candScore: CellScore = original;
          if (random() < 0.08) {
            if (random() < 0.5) baseScore = { score: 0, valid: false };
            else candScore = { score: 0, valid: false };
          }
          const task = { sourceId, budget, seedSlot: slot, actualSeed: slot };
          base.push({ ...task, score: { ...baseScore } });
          candidate.push({ ...task, score: { ...candScore } });
        }
      }
    }
    return { base, candidate };
  }

  function catalogWideHardZeroRuns(
    budgets: number[],
    seedsPerBudget: number,
    random: () => number,
  ): { base: DecisionRun[]; candidate: DecisionRun[] } {
    const base: DecisionRun[] = [];
    const candidate: DecisionRun[] = [];
    for (const budget of budgets) {
      for (let slot = 0; slot < seedsPerBudget; slot++) {
        const baseValid = random() < 0.8;
        const candValid = random() < 0.8;
        for (const sourceId of members) {
          const task = { sourceId, budget, seedSlot: slot, actualSeed: slot };
          base.push({ ...task, score: { score: baseValid ? 500 : 0, valid: baseValid } });
          candidate.push({ ...task, score: { score: candValid ? 500 : 0, valid: candValid } });
        }
      }
    }
    return { base, candidate };
  }

  return {
    suite,
    suiteForCanonicalSeeds,
    empiricalRuns,
    symmetricValidityFlipRuns,
    catalogWideHardZeroRuns,
  };
}

function runWorkerTask(payload: WorkerPayload, task: any): any {
  const ctx = makeWorkerContext(payload);
  const probeBudgets = [...payload.suite.profiles.probe.budgets];
  const probeSeeds = payload.suite.profiles.probe.seeds_per_budget;
  const canonicalBudgets = [...payload.suite.profiles.canonical.budgets];

  if (task.type === "partA") {
    // Probe-profile calibration cell (1000 trials). Returns raw outcome/coverage counts.
    let advance = 0;
    let stop = 0;
    let unresolved = 0;
    let covered = 0;
    let sumDelta = 0;
    for (let trial = 0; trial < task.trials; trial++) {
      const random = mulberry32(hashSeed(`partA:${task.cellId}:${trial}`));
      let runs: { base: DecisionRun[]; candidate: DecisionRun[] };
      if (task.dgp === "symmetric_validity_flips") {
        runs = ctx.symmetricValidityFlipRuns(probeBudgets, probeSeeds, random);
      } else if (task.dgp === "catalog_wide_hard_zero") {
        runs = ctx.catalogWideHardZeroRuns(probeBudgets, probeSeeds, random);
      } else {
        runs = ctx.empiricalRuns(probeBudgets, probeSeeds, task.shift, random);
      }
      const decision = pairedV2DecisionForCalibration(runs.base, runs.candidate, ctx.suite, {
        profile: "probe",
        mode: task.mode,
        margin: task.margin ?? undefined,
        bootstrapSeed: 0,
      });
      if (decision.outcome === "advance") advance++;
      else if (decision.outcome === "stop") stop++;
      else unresolved++;
      if (decision.confidence.centralLo <= task.trueDelta && decision.confidence.centralHi >= task.trueDelta) {
        covered++;
      }
      sumDelta += decision.delta;
    }
    return { cellId: task.cellId, advance, stop, unresolved, covered, sumDelta, trials: task.trials };
  }

  if (task.type === "partB") {
    // ONE canonical-style run at n=32 per trial; interim looks read the first k blocks.
    const suite32 = ctx.suiteForCanonicalSeeds(DEPTH_SEEDS);
    const interimSuites = new Map(INTERIM_LOOKS.map((k) => [k, ctx.suiteForCanonicalSeeds(k)]));
    const records: PartBRecord[] = [];
    for (let trial = task.trialStart; trial < task.trialEnd; trial++) {
      const random = mulberry32(hashSeed(`partB:${task.deltaKey}:${trial}`));
      const full = ctx.empiricalRuns(canonicalBudgets, DEPTH_SEEDS, task.shift, random);
      const looks: LookStat[] = [];
      for (const k of INTERIM_LOOKS) {
        const base = full.base.filter((r) => r.seedSlot < k);
        const candidate = full.candidate.filter((r) => r.seedSlot < k);
        const decision = pairedV2DecisionForCalibration(base, candidate, interimSuites.get(k)!, {
          profile: "canonical",
          mode: "improvement",
          bootstrapSeed: 0,
        });
        looks.push({
          k,
          estimate: decision.confidence.estimate,
          se: decision.confidence.standardError,
          df: decision.confidence.degreesOfFreedom,
        });
      }
      const finalDecision = pairedV2DecisionForCalibration(full.base, full.candidate, suite32, {
        profile: "canonical",
        mode: "improvement",
        bootstrapSeed: 0,
      });
      records.push({
        looks,
        final: {
          estimate: finalDecision.confidence.estimate,
          se: finalDecision.confidence.standardError,
          df: finalDecision.confidence.degreesOfFreedom,
          outcome: finalDecision.outcome, // native canonical criticalAlpha (0.01)
        },
      });
    }
    return { deltaKey: task.deltaKey, records };
  }

  if (task.type === "legacy") {
    // Legacy two-stage: INDEPENDENT probe draw then INDEPENDENT canonical (8-seed) draw.
    const probeOutcomes = ["advance", "stop", "unresolved"] as const;
    const canonicalOutcomes = ["accept", "reject", "inconclusive"] as const;
    const contingency: Record<string, Record<string, number>> = {};
    for (const p of probeOutcomes) {
      contingency[p] = {};
      for (const c of canonicalOutcomes) contingency[p][c] = 0;
    }
    for (let trial = 0; trial < task.trials; trial++) {
      const random = mulberry32(hashSeed(`legacy:${task.deltaKey}:${trial}`));
      const probeRun = ctx.empiricalRuns(probeBudgets, probeSeeds, task.shift, random);
      const probeDecision = pairedV2DecisionForCalibration(probeRun.base, probeRun.candidate, ctx.suite, {
        profile: "probe",
        mode: "improvement",
        bootstrapSeed: 0,
      });
      const canonRun = ctx.empiricalRuns(
        canonicalBudgets,
        ctx.suite.profiles.canonical.seeds_per_budget,
        task.shift,
        random,
      );
      const canonDecision = pairedV2DecisionForCalibration(canonRun.base, canonRun.candidate, ctx.suite, {
        profile: "canonical",
        mode: "improvement",
        bootstrapSeed: 0,
      });
      contingency[probeDecision.outcome][canonDecision.outcome]++;
    }
    return { deltaKey: task.deltaKey, contingency, trials: task.trials };
  }

  throw new Error(`unknown worker task type ${task.type}`);
}

function workerMain(): void {
  const argument = argumentReader(process.argv.slice(2));
  const payloadPath = argument("payload");
  const taskB64 = argument("task");
  if (payloadPath === undefined || taskB64 === undefined) {
    process.stderr.write("worker requires --payload and --task\n");
    process.exit(2);
  }
  try {
    const payload = JSON.parse(readFileSync(payloadPath!, "utf8")) as WorkerPayload;
    const task = JSON.parse(Buffer.from(taskB64!, "base64").toString("utf8"));
    const result = runWorkerTask(payload, task);
    process.stdout.write(JSON.stringify(result));
    process.exit(0);
  } catch (error) {
    process.stderr.write(`${(error as Error).stack ?? String(error)}\n`);
    process.exit(1);
  }
}

// ===========================================================================
// MAIN ORCHESTRATOR
// ===========================================================================

function rateWithWilson(count: number, total: number): { count: number; total: number; rate: number; wilson95: [number, number] } {
  if (total === 0) return { count, total, rate: 0, wilson95: [0, 0] };
  const z = 1.959963984540054;
  const p = count / total;
  const denominator = 1 + z * z / total;
  const center = (p + z * z / (2 * total)) / denominator;
  const half = z * Math.sqrt(p * (1 - p) / total + z * z / (4 * total * total)) / denominator;
  return { count, total, rate: round(p), wilson95: [round(center - half), round(center + half)] };
}

function binIndex(value: number): number {
  for (let i = 0; i < ESTIMATE_BIN_EDGES.length - 1; i++) {
    if (value >= ESTIMATE_BIN_EDGES[i] && value < ESTIMATE_BIN_EDGES[i + 1]) return i;
  }
  return ESTIMATE_BIN_EDGES.length - 2;
}
function binLabel(i: number): string {
  const lo = ESTIMATE_BIN_EDGES[i];
  const hi = ESTIMATE_BIN_EDGES[i + 1];
  const l = lo === -Infinity ? "(-inf" : `[${lo}`;
  const h = hi === Infinity ? "+inf)" : `${hi})`;
  return `${l}, ${h}`;
}

function upperBound(estimate: number, se: number, df: number | null, alpha: number): number {
  if (se === 0) return estimate;
  return estimate + studentTQuantile(1 - alpha, df === null ? Infinity : df) * se;
}
function finalOutcomeAt(estimate: number, se: number, df: number | null, criticalAlpha: number): string {
  const decision = outcomeFrom(estimate, se, df, 0, criticalAlpha);
  return decision === "positive" ? "accept" : decision === "negative" ? "reject" : "inconclusive";
}

async function mainOrchestrator(): Promise<void> {
  const startedAt = Date.now();
  const argument = argumentReader(process.argv.slice(2));
  const smoke = process.argv.includes("--smoke");
  const partATrials = integerArgument(argument, "partA-trials", smoke ? 60 : 1_000, 10);
  const partBTrials = integerArgument(argument, "partB-trials", smoke ? 24 : 500, 4);
  const legacyTrials = integerArgument(argument, "legacy-trials", smoke ? 24 : 200, 4);
  const concurrency = integerArgument(argument, "concurrency", smoke ? 4 : 32, 1);
  const partBShardSize = integerArgument(argument, "partB-shard-size", smoke ? 12 : 125, 1);
  const referencePath = resolve(
    argument("reference") ?? "benchmark/v2/runs/calibration-v2.4-coverage-reference.json.gz",
  );
  const outPath = resolve(argument("out") ?? "benchmark/v2/studies/probe-futility.json");

  // -- Load + validate the retained empirical reference (mirrors study_decision_coverage.ts).
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
  if (!Array.isArray(reference.seeds) || reference.seeds.length < 8 || new Set(reference.seeds).size !== reference.seeds.length) {
    throw new Error(`coverage reference requires at least eight unique seed blocks`);
  }

  const members = canonicalMembers(baseSuite);
  const contracts = new Map();
  for (const source of sources) {
    const spec = applyJolt(await loadSourceSpec(source), baseSuite.transform.jolt_ms);
    contracts.set(source.id, buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents));
  }
  const referenceByCell = new Map<string, CellScore>();
  for (const row of reference.runs ?? []) {
    const source = sources.find((entry) => entry.id === row.task?.sourceId);
    if (
      source === undefined || row.status !== "ok" || row.report === null ||
      row.source?.sourceFingerprint !== source.sourceFingerprint || !Number.isSafeInteger(row.authoredContacts)
    ) throw new Error(`coverage reference contains an invalid raw run`);
    const rescored = scoreV2Report(row.report, row.authoredContacts, contracts.get(source.id), baseSuite);
    if (JSON.stringify(rescored) !== JSON.stringify(row.score)) {
      throw new Error(`${source.id}: coverage reference score does not match its raw report`);
    }
    referenceByCell.set(cellKey(source.id, row.task.budget, row.task.actualSeed), {
      score: rescored.score,
      valid: rescored.valid,
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
  console.log(`reference loaded + verified (${referenceByCell.size} cells) in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

  // -- Precompute paired-shift truths for each target delta (one-time, in main).
  const shiftTargets = [0, 2, 3, 5, 8, 12, 15, -2, -5];
  const shiftForTarget = new Map<number, number>();
  const pairedTruthForTarget = new Map<number, number>();
  for (const target of shiftTargets) {
    if (target === 0) {
      shiftForTarget.set(0, 0);
      pairedTruthForTarget.set(0, empiricalShiftTruth(baseSuite, referenceByCell, reference.seeds, members, 0));
      continue;
    }
    const shift = solveEmpiricalShift(baseSuite, referenceByCell, reference.seeds, members, target);
    shiftForTarget.set(target, shift);
    pairedTruthForTarget.set(target, empiricalShiftTruth(baseSuite, referenceByCell, reference.seeds, members, shift));
  }
  console.log(`shift targets solved: ${shiftTargets.map((t) => `${t}=>shift ${round(shiftForTarget.get(t)!)} (truth ${round(pairedTruthForTarget.get(t)!)})`).join(", ")}`);

  // -- Write the compact worker payload.
  const payload: WorkerPayload = {
    suite: baseSuite,
    members,
    seeds: reference.seeds,
    referenceByCell: [...referenceByCell.entries()],
  };
  const scratchDir = argument("scratch") ?? process.env.CLAUDE_SCRATCHPAD ?? tmpdir();
  mkdirSync(scratchDir, { recursive: true });
  const payloadPath = resolve(scratchDir, `probe-futility-payload.${process.pid}.json`);
  writeFileSync(payloadPath, JSON.stringify(payload));

  // -- Enumerate work items.
  type WorkItem = { key: string; task: any };
  const items: WorkItem[] = [];

  // Part A null cells (probe profile, improvement, trueDelta 0).
  const partANullCells = [
    { cellId: "null_empirical_blocks", dgp: "empirical_blocks", shift: 0 },
    { cellId: "null_symmetric_validity_flips", dgp: "symmetric_validity_flips", shift: 0 },
    { cellId: "null_catalog_wide_hard_zero", dgp: "catalog_wide_hard_zero", shift: 0 },
  ];
  for (const cell of partANullCells) {
    items.push({
      key: cell.cellId,
      task: { type: "partA", ...cell, mode: "improvement", margin: null, trueDelta: 0, trials: partATrials },
    });
  }
  // Part A power curve (probe profile, improvement, empirical gains).
  const powerTargets = [3, 5, 8, 12, 15];
  for (const target of powerTargets) {
    items.push({
      key: `power_${target}`,
      task: {
        type: "partA",
        cellId: `power_${target}`,
        dgp: "empirical_blocks",
        shift: shiftForTarget.get(target)!,
        mode: "improvement",
        margin: null,
        trueDelta: pairedTruthForTarget.get(target)!,
        trials: partATrials,
      },
    });
  }
  // Part A simplification screening (probe profile, simplification, margins {2,5}, trueDelta {0,-margin}).
  for (const margin of [2, 5]) {
    for (const target of [0, -margin]) {
      items.push({
        key: `simpl_m${margin}_d${target}`,
        task: {
          type: "partA",
          cellId: `simpl_m${margin}_d${target}`,
          dgp: "empirical_blocks",
          shift: shiftForTarget.get(target)!,
          mode: "simplification",
          margin,
          trueDelta: pairedTruthForTarget.get(target)!,
          trials: partATrials,
        },
      });
    }
  }

  // Part B main simulation (canonical-style, n=32) sharded by trial range.
  const partBDeltas = [0, 2, 3, 5, 8, 12, -5];
  for (const target of partBDeltas) {
    const deltaKey = `d${target}`;
    for (let start = 0; start < partBTrials; start += partBShardSize) {
      const end = Math.min(start + partBShardSize, partBTrials);
      items.push({
        key: `partB_${deltaKey}_${start}_${end}`,
        task: {
          type: "partB",
          deltaKey,
          target,
          shift: shiftForTarget.get(target)!,
          trialStart: start,
          trialEnd: end,
        },
      });
    }
  }

  // Legacy two-stage (independent probe + independent canonical-8 draws).
  for (const target of partBDeltas) {
    items.push({
      key: `legacy_d${target}`,
      task: { type: "legacy", deltaKey: `d${target}`, target, shift: shiftForTarget.get(target)!, trials: legacyTrials },
    });
  }

  console.log(`dispatching ${items.length} work items across ${concurrency} workers ...`);
  const rawResults = await runPool(items, payloadPath, concurrency);
  const byKey = new Map(items.map((item, index) => [item.key, rawResults[index]]));
  try {
    if (existsSync(payloadPath)) writeFileSync(payloadPath, ""); // best-effort truncate before unlink
  } catch { /* ignore */ }
  spawnSync("rm", ["-f", payloadPath]);

  // -----------------------------------------------------------------------
  // Aggregate Part A.
  // -----------------------------------------------------------------------
  function partACell(key: string): any {
    const r = byKey.get(key);
    return {
      advance: rateWithWilson(r.advance, r.trials),
      stop: rateWithWilson(r.stop, r.trials),
      unresolved: rateWithWilson(r.unresolved, r.trials),
      centralCoverage: rateWithWilson(r.covered, r.trials),
      meanDelta: round(r.sumDelta / r.trials),
    };
  }
  const partA = {
    trials: partATrials,
    nullCalibration: partANullCells.map((cell) => {
      const c = partACell(cell.cellId);
      return {
        scenario: cell.dgp,
        trueDelta: 0,
        meanDelta: c.meanDelta,
        falseAdvance: c.advance,
        falseStop: c.stop,
        unresolved: c.unresolved,
        centralCoverage: c.centralCoverage,
      };
    }),
    powerCurve: powerTargets.map((target) => {
      const c = partACell(`power_${target}`);
      return {
        targetDelta: target,
        shift: round(shiftForTarget.get(target)!),
        pairedTruthDelta: round(pairedTruthForTarget.get(target)!),
        meanDelta: c.meanDelta,
        advance: c.advance,
        stop: c.stop,
        unresolved: c.unresolved,
      };
    }),
    simplificationScreening: [2, 5].flatMap((margin) =>
      [0, -margin].map((target) => {
        const c = partACell(`simpl_m${margin}_d${target}`);
        return {
          margin,
          targetTrueDelta: target,
          pairedTruthDelta: round(pairedTruthForTarget.get(target)!),
          meanDelta: c.meanDelta,
          advance: c.advance,
          stop: c.stop,
          unresolved: c.unresolved,
        };
      })
    ),
  };

  // -----------------------------------------------------------------------
  // Aggregate Part B.
  // -----------------------------------------------------------------------
  // Gather per-delta records.
  const recordsByDelta = new Map<number, PartBRecord[]>();
  for (const target of partBDeltas) recordsByDelta.set(target, []);
  for (const item of items) {
    if (item.task.type !== "partB") continue;
    const r = byKey.get(item.key);
    recordsByDelta.get(item.task.target)!.push(...r.records);
  }

  // Per-trial derived views.
  type Trial = {
    delta: number;
    lookEstimate: Map<number, number>;
    lookUpper: Map<number, Map<number, number>>; // k -> alpha -> upper bound
    finalOutcome01: string;
    finalOutcome05: string;
    finalEstimate: number;
  };
  const trials: Trial[] = [];
  for (const target of partBDeltas) {
    for (const record of recordsByDelta.get(target)!) {
      const lookEstimate = new Map<number, number>();
      const lookUpper = new Map<number, Map<number, number>>();
      for (const look of record.looks) {
        lookEstimate.set(look.k, look.estimate);
        const byAlpha = new Map<number, number>();
        for (const alpha of UPPER_BOUND_ALPHAS) byAlpha.set(alpha, upperBound(look.estimate, look.se, look.df, alpha));
        lookUpper.set(look.k, byAlpha);
      }
      trials.push({
        delta: target,
        lookEstimate,
        lookUpper,
        finalOutcome01: record.final.outcome, // native
        finalOutcome05: finalOutcomeAt(record.final.estimate, record.final.se, record.final.df, 0.05),
        finalEstimate: record.final.estimate,
      });
    }
  }

  const partBDeltaSummaries = partBDeltas.map((target) => {
    const subset = trials.filter((t) => t.delta === target);
    const n = subset.length;
    const rate = (pred: (t: Trial) => boolean) => rateWithWilson(subset.filter(pred).length, n);
    return {
      targetDelta: target,
      shift: round(shiftForTarget.get(target)!),
      pairedTruthDelta: round(pairedTruthForTarget.get(target)!),
      trials: n,
      meanFinalDelta: round(subset.reduce((s, t) => s + t.finalEstimate, 0) / n),
      final01: {
        accept: rate((t) => t.finalOutcome01 === "accept"),
        reject: rate((t) => t.finalOutcome01 === "reject"),
        inconclusive: rate((t) => t.finalOutcome01 === "inconclusive"),
      },
      final05: {
        accept: rate((t) => t.finalOutcome05 === "accept"),
        reject: rate((t) => t.finalOutcome05 === "reject"),
        inconclusive: rate((t) => t.finalOutcome05 === "inconclusive"),
      },
    };
  });

  // (i) Calibration: P(final accept | interim estimate bin), pooled across the delta grid.
  function calibrationCurve(finalAcceptKey: "finalOutcome01" | "finalOutcome05"): any {
    const perLook: Record<string, any> = {};
    for (const k of INTERIM_LOOKS) {
      const rows = [];
      for (let bin = 0; bin < ESTIMATE_BIN_EDGES.length - 1; bin++) {
        const inBin = trials.filter((t) => binIndex(t.lookEstimate.get(k)!) === bin);
        const accepts = inBin.filter((t) => t[finalAcceptKey] === "accept").length;
        rows.push({
          bin: binLabel(bin),
          count: inBin.length,
          pFinalAccept: rateWithWilson(accepts, inBin.length),
        });
      }
      perLook[`k${k}`] = rows;
    }
    return perLook;
  }

  // (ii) Futility rules. For each rule and look, kill-rate among eventual accepts (single-look
  //      and cumulative) and stop-rate per delta (single-look and cumulative).
  type RuleFn = (t: Trial, k: number) => boolean;
  const rules: Array<{ id: string; description: string; fn: RuleFn }> = [
    {
      id: "estimateBelowZero",
      description: "Stop after look k if the interim delta estimate < 0.",
      fn: (t, k) => t.lookEstimate.get(k)! < 0,
    },
    {
      id: "upperBound05BelowZero",
      description: "Stop after look k if the one-sided 95% upper bound (alpha 0.05) < 0.",
      fn: (t, k) => t.lookUpper.get(k)!.get(0.05)! < 0,
    },
    {
      id: "upperBound01BelowZero",
      description: "Stop after look k if the one-sided 99% upper bound (alpha 0.01) < 0.",
      fn: (t, k) => t.lookUpper.get(k)!.get(0.01)! < 0,
    },
  ];

  function cumulativeStopped(t: Trial, upToK: number, fn: RuleFn): boolean {
    return INTERIM_LOOKS.filter((k) => k <= upToK).some((k) => fn(t, k));
  }

  function futilityForRule(rule: { id: string; description: string; fn: RuleFn }): any {
    const accepts01 = trials.filter((t) => t.finalOutcome01 === "accept");
    const accepts05 = trials.filter((t) => t.finalOutcome05 === "accept");
    const nullTrials = trials.filter((t) => t.delta === 0);
    const perK = INTERIM_LOOKS.map((k) => {
      const killSingle01 = rateWithWilson(accepts01.filter((t) => rule.fn(t, k)).length, accepts01.length);
      const killCumul01 = rateWithWilson(accepts01.filter((t) => cumulativeStopped(t, k, rule.fn)).length, accepts01.length);
      const killSingle05 = rateWithWilson(accepts05.filter((t) => rule.fn(t, k)).length, accepts05.length);
      const killCumul05 = rateWithWilson(accepts05.filter((t) => cumulativeStopped(t, k, rule.fn)).length, accepts05.length);
      const nullStopSingle = rateWithWilson(nullTrials.filter((t) => rule.fn(t, k)).length, nullTrials.length);
      const nullStopCumul = rateWithWilson(nullTrials.filter((t) => cumulativeStopped(t, k, rule.fn)).length, nullTrials.length);
      const perDelta = partBDeltas.map((target) => {
        const subset = trials.filter((t) => t.delta === target);
        return {
          delta: target,
          stopSingleLook: rateWithWilson(subset.filter((t) => rule.fn(t, k)).length, subset.length),
          stopCumulative: rateWithWilson(subset.filter((t) => cumulativeStopped(t, k, rule.fn)).length, subset.length),
        };
      });
      return {
        k,
        killAmongAccepts01_singleLook: killSingle01,
        killAmongAccepts01_cumulative: killCumul01,
        killAmongAccepts05_singleLook: killSingle05,
        killAmongAccepts05_cumulative: killCumul05,
        nullStop_singleLook: nullStopSingle,
        nullStop_cumulative: nullStopCumul,
        perDelta,
      };
    });
    return { rule: rule.id, description: rule.description, perK };
  }

  // (iii) Threshold sweep at k=3 for rule estimate<threshold.
  const K3 = 3;
  const accepts01 = trials.filter((t) => t.finalOutcome01 === "accept");
  const accepts05 = trials.filter((t) => t.finalOutcome05 === "accept");
  const nullTrials = trials.filter((t) => t.delta === 0);
  const thresholdSweepK3 = THRESHOLD_SWEEP.map((threshold) => ({
    threshold,
    killAmongAccepts01: rateWithWilson(accepts01.filter((t) => t.lookEstimate.get(K3)! < threshold).length, accepts01.length),
    killAmongAccepts05: rateWithWilson(accepts05.filter((t) => t.lookEstimate.get(K3)! < threshold).length, accepts05.length),
    nullStop: rateWithWilson(nullTrials.filter((t) => t.lookEstimate.get(K3)! < threshold).length, nullTrials.length),
    perDelta: partBDeltas.map((target) => {
      const subset = trials.filter((t) => t.delta === target);
      return { delta: target, stopRate: rateWithWilson(subset.filter((t) => t.lookEstimate.get(K3)! < threshold).length, subset.length) };
    }),
  }));

  const partB = {
    trials: partBTrials,
    depthSeeds: DEPTH_SEEDS,
    interimLooks: [...INTERIM_LOOKS],
    budgets: [...baseSuite.profiles.canonical.budgets],
    deltas: partBDeltaSummaries,
    calibrationByInterimEstimate: {
      note: "Pooled across the simulated delta grid (equal trials per delta). P(final accept) vs interim delta-estimate bin.",
      finalAccept01: calibrationCurve("finalOutcome01"),
      finalAccept05: calibrationCurve("finalOutcome05"),
    },
    futilityRules: {
      note: "killAmongAccepts = fraction of eventual-accept runs the rule would stop (single-look = rule fires at exactly look k; cumulative = rule fired at some look <= k). nullStop = fraction of true-null (delta 0) runs stopped.",
      rules: rules.map(futilityForRule),
    },
    thresholdSweepK3: {
      note: "Rule: stop at k=3 if interim estimate < threshold. Single-look.",
      cells: thresholdSweepK3,
    },
  };

  // -----------------------------------------------------------------------
  // Aggregate legacy two-stage.
  // -----------------------------------------------------------------------
  const legacy = {
    trials: legacyTrials,
    note: "Independent probe draw (2 budgets x 3 seeds) then independent canonical draw (3 budgets x 8 seeds). P(canonical accept | probe outcome).",
    deltas: partBDeltas.map((target) => {
      const r = byKey.get(`legacy_d${target}`);
      const cont = r.contingency;
      const probeOutcomes = ["advance", "stop", "unresolved"] as const;
      const totalTrials = r.trials;
      let probeAdvance = 0;
      let canonAccept = 0;
      for (const p of probeOutcomes) {
        for (const c of ["accept", "reject", "inconclusive"]) {
          if (p === "advance") probeAdvance += cont[p][c];
          if (c === "accept") canonAccept += cont[p][c];
        }
      }
      const conditional = probeOutcomes.map((p) => {
        const n = cont[p].accept + cont[p].reject + cont[p].inconclusive;
        return {
          probeOutcome: p,
          probeOutcomeRate: rateWithWilson(n, totalTrials),
          canonicalAcceptGivenProbe: rateWithWilson(cont[p].accept, n),
          canonicalRejectGivenProbe: rateWithWilson(cont[p].reject, n),
          canonicalInconclusiveGivenProbe: rateWithWilson(cont[p].inconclusive, n),
        };
      });
      return {
        targetDelta: target,
        pairedTruthDelta: round(pairedTruthForTarget.get(target)!),
        marginalProbeAdvance: rateWithWilson(probeAdvance, totalTrials),
        marginalCanonicalAccept: rateWithWilson(canonAccept, totalTrials),
        conditional,
        contingency: cont,
      };
    }),
  };

  const runtimeSeconds = round((Date.now() - startedAt) / 1000);
  const report = {
    schema: "line.benchmark-v2.probe-futility-study.v2",
    suiteFingerprint: identity.suiteFingerprint,
    scorerFingerprint,
    decisionInferenceFingerprint,
    reference: relative(referencePath),
    referenceArtifactSha256: referenceArtifact.artifactSha256,
    referenceRawSha256: referenceArtifact.rawSha256,
    referenceCandidateFingerprint: reference.candidate?.candidateFingerprint ?? null,
    probeProfile: {
      budgets: [...baseSuite.profiles.probe.budgets],
      seedsPerBudget: baseSuite.profiles.probe.seeds_per_budget,
      alpha: benchmarkDecisionPolicy.profiles.probe.alpha,
      criticalAlpha: benchmarkDecisionPolicy.profiles.probe.criticalAlpha,
    },
    canonicalProfile: {
      budgets: [...baseSuite.profiles.canonical.budgets],
      nativeSeedsPerBudget: baseSuite.profiles.canonical.seeds_per_budget,
      alpha: benchmarkDecisionPolicy.profiles.canonical.alpha,
      criticalAlpha: benchmarkDecisionPolicy.profiles.canonical.criticalAlpha,
    },
    methodology: {
      dgp: "Unpaired empirical blocks: base and candidate independently resample whole observed catalog seed blocks within each budget from the retained reference; candidates receive +shift on valid cells to reach a target delta. Null/validity-flip/catalog-wide DGPs mirror study_decision_coverage.ts.",
      truthDefinition: "pairedTruthDelta is the headline delta when every valid cell of the full 12-seed catalog receives +shift (paired), reused as the reference true delta as in the coverage study; meanDelta reports the realized unpaired Monte Carlo mean.",
      partA: "Probe profile (2 budgets [250k,500k], 3 seeds/budget, alpha 0.10 / criticalAlpha 0.05). Decisions call pairedV2DecisionForCalibration with profile 'probe'; advance/stop use the one-sided criticalAlpha (0.05) bounds. The probe budget subset is respected automatically (weightedBudgets renormalizes over the profile budgets).",
      partB: "One canonical-style run at n=32 seeds/budget (3 budgets) per trial. Interim looks read the FIRST k blocks of the SAME run (not a fresh draw) via seeds_per_budget=k. Final outcome at n=32 recorded at criticalAlpha 0.01 (native, = decision.outcome) AND recomputed at 0.05 via studentTQuantile on (estimate, se, df).",
      futilityRules: "Concrete rules only: estimate<0, one-sided upper bound (alpha 0.05 and 0.01) < 0, and an estimate<threshold sweep at k=3. Single-look = rule evaluated at exactly look k; cumulative = rule fired at any look <= k (first-hit sequential).",
      legacyTwoStage: "Independent probe draw and independent canonical (8-seed) draw per trial to characterize the legacy screening value P(canonical accept | probe outcome), for comparison against interim looks inside one run.",
      seeding: "Deterministic per-(scenario,trial) mulberry32 seeds, so results are independent of shard/worker layout. bootstrapSeed is irrelevant for calibration decisions (sensitivity iterations are 0).",
      parallelism: "Results are independent of worker/shard layout: every trial is seeded per (scenario, trial). Realized concurrency and shard sizes are recorded in the provenance sidecar.",
    },
    partA,
    partB,
    legacyTwoStage: legacy,
  };

  const reportBytes = `${JSON.stringify(report, null, 2)}\n`;
  write(outPath, reportBytes);
  write(`${outPath.replace(/\.json$/, "")}.provenance.json`, `${JSON.stringify({
    schema: "line.benchmark-v2.study-provenance.v1",
    artifact: relative(outPath),
    artifactSha256: createHash("sha256").update(reportBytes).digest("hex"),
    generatedAt: new Date().toISOString(),
    runtimeSeconds,
    workers: concurrency,
    partBShardSize,
    command: "node --import tsx scripts/benchmark/study_probe_coverage.ts",
  }, null, 2)}\n`);
  console.log(`\nwrote ${relative(outPath)} in ${runtimeSeconds}s (+ provenance sidecar)`);
  printSummary(report);
}

// ---------------------------------------------------------------------------
// Shift solving (paired truth), mirrors study_decision_coverage.ts helpers.
// ---------------------------------------------------------------------------

function empiricalShiftTruth(
  suite: SuiteManifest,
  referenceByCell: Map<string, CellScore>,
  seeds: number[],
  members: string[],
  shift: number,
): number {
  const fullSuite = structuredClone(suite);
  fullSuite.profiles.canonical.seeds_per_budget = seeds.length;
  const base: DecisionRun[] = [];
  const candidate: DecisionRun[] = [];
  for (const budget of fullSuite.profiles.canonical.budgets) {
    seeds.forEach((seed, seedSlot) => {
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
    profile: "canonical",
    mode: "improvement",
    bootstrapSeed: 0,
  }).delta;
}

function solveEmpiricalShift(
  suite: SuiteManifest,
  referenceByCell: Map<string, CellScore>,
  seeds: number[],
  members: string[],
  targetDelta: number,
): number {
  let low = -40;
  let high = 60;
  for (let iteration = 0; iteration < 44; iteration++) {
    const middle = (low + high) / 2;
    if (empiricalShiftTruth(suite, referenceByCell, seeds, members, middle) < targetDelta) low = middle;
    else high = middle;
  }
  return (low + high) / 2;
}

// ---------------------------------------------------------------------------
// Child-process pool.
// ---------------------------------------------------------------------------

function runPool(
  items: Array<{ key: string; task: any }>,
  payloadPath: string,
  concurrency: number,
): Promise<any[]> {
  return new Promise((resolveAll, rejectAll) => {
    const results: any[] = new Array(items.length);
    let next = 0;
    let done = 0;
    let failed = false;
    let running = 0;
    const startedAt = Date.now();

    function launch(): void {
      if (failed) return;
      while (running < concurrency && next < items.length) {
        const index = next++;
        const item = items[index];
        running++;
        const taskB64 = Buffer.from(JSON.stringify(item.task)).toString("base64");
        const child = spawn(
          process.execPath,
          [...process.execArgv, SELF_PATH, "--worker", `--payload=${payloadPath}`, `--task=${taskB64}`],
          { stdio: ["ignore", "pipe", "pipe"] },
        );
        let out = "";
        let err = "";
        child.stdout.on("data", (d) => (out += d.toString()));
        child.stderr.on("data", (d) => (err += d.toString()));
        child.on("error", (error) => {
          if (failed) return;
          failed = true;
          rejectAll(error);
        });
        child.on("exit", (code) => {
          running--;
          if (failed) return;
          if (code !== 0) {
            failed = true;
            rejectAll(new Error(`worker ${item.key} exited ${code}: ${err.slice(0, 2000)}`));
            return;
          }
          try {
            results[index] = JSON.parse(out);
          } catch (error) {
            failed = true;
            rejectAll(new Error(`worker ${item.key} bad output: ${(error as Error).message}; stderr=${err.slice(0, 500)}`));
            return;
          }
          done++;
          if (done % 5 === 0 || done === items.length) {
            console.log(`  ${done}/${items.length} work items done (${((Date.now() - startedAt) / 1000).toFixed(0)}s)`);
          }
          if (done === items.length) resolveAll(results);
          else launch();
        });
      }
    }
    launch();
  });
}

// ---------------------------------------------------------------------------
// Reference verification helpers (copied read-only from study_decision_coverage.ts).
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
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "scripts/v0/arc.ts",
    "scripts/v0/arc_placement.ts",
    "scripts/v0/score.ts",
    "scripts/v0/optimizer/handoff.ts",
    "scripts/lib/detector.ts",
    "engine-rs/Cargo.toml",
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

// ---------------------------------------------------------------------------
// Misc helpers.
// ---------------------------------------------------------------------------

function integerArgument(
  argument: (name: string) => string | undefined,
  name: string,
  fallback: number,
  minimum: number,
): number {
  const raw = argument(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isSafeInteger(value) || value < minimum) throw new Error(`--${name} must be an integer >= ${minimum}`);
  return value;
}
function write(path: string, value: string): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, value);
}
function relative(path: string): string {
  return path.startsWith(`${process.cwd()}/`) ? path.slice(process.cwd().length + 1) : path;
}
function pct(v: { rate: number; wilson95: [number, number] }): string {
  return `${(v.rate * 100).toFixed(1)}% [${(v.wilson95[0] * 100).toFixed(1)},${(v.wilson95[1] * 100).toFixed(1)}]`;
}

function printSummary(report: any): void {
  console.log(`\n=== PART A: probe operating characteristics (${report.partA.trials} trials/cell) ===`);
  console.log(`null: scenario | false-advance | false-stop | central-coverage`);
  for (const c of report.partA.nullCalibration) {
    console.log(`  ${c.scenario} | ${pct(c.falseAdvance)} | ${pct(c.falseStop)} | ${pct(c.centralCoverage)}`);
  }
  console.log(`probe power curve: trueDelta | advance`);
  for (const c of report.partA.powerCurve) {
    console.log(`  ~${c.targetDelta} (truth ${c.pairedTruthDelta}) | ${pct(c.advance)}`);
  }
  console.log(`simplification screening: margin | trueDelta | advance | stop`);
  for (const c of report.partA.simplificationScreening) {
    console.log(`  m${c.margin} | ${c.targetTrueDelta} | ${pct(c.advance)} | ${pct(c.stop)}`);
  }

  console.log(`\n=== PART B: final canonical outcomes at n=32 (${report.partB.trials} trials/delta) ===`);
  console.log(`delta | final accept@0.01 | final accept@0.05`);
  for (const d of report.partB.deltas) {
    console.log(`  ~${d.targetDelta} | ${pct(d.final01.accept)} | ${pct(d.final05.accept)}`);
  }
  console.log(`\nfutility rules (kill among eventual accepts@0.01 / null-stop, cumulative by look):`);
  for (const rule of report.partB.futilityRules.rules) {
    console.log(`  rule ${rule.rule}:`);
    for (const pk of rule.perK) {
      console.log(`    k=${pk.k}: kill(cumul)=${pct(pk.killAmongAccepts01_cumulative)} null-stop(cumul)=${pct(pk.nullStop_cumulative)} | kill(single)=${pct(pk.killAmongAccepts01_singleLook)} null-stop(single)=${pct(pk.nullStop_singleLook)}`);
    }
  }
  console.log(`\nthreshold sweep (estimate<thr at k=3): thr | kill@0.01 | null-stop`);
  for (const c of report.partB.thresholdSweepK3.cells) {
    console.log(`  ${c.threshold} | ${pct(c.killAmongAccepts01)} | ${pct(c.nullStop)}`);
  }

  console.log(`\n=== LEGACY two-stage (${report.legacyTwoStage.trials} trials/delta) ===`);
  console.log(`delta | P(probe advance) | P(canon accept) | P(canon accept|probe advance) | P(canon accept|probe stop)`);
  for (const d of report.legacyTwoStage.deltas) {
    const adv = d.conditional.find((x: any) => x.probeOutcome === "advance");
    const stp = d.conditional.find((x: any) => x.probeOutcome === "stop");
    console.log(`  ~${d.targetDelta} | ${pct(d.marginalProbeAdvance)} | ${pct(d.marginalCanonicalAccept)} | ${pct(adv.canonicalAcceptGivenProbe)} | ${pct(stp.canonicalAcceptGivenProbe)}`);
  }
}

// ===========================================================================
// Entry point.
// ===========================================================================

if (process.argv.includes("--worker")) {
  workerMain();
} else {
  await mainOrchestrator();
}
