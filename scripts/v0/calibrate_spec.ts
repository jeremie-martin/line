/**
 * Single-spec calibration runner.
 *
 * A spec may export `baseSpec` and `calibration`; this runner evaluates each
 * calibration candidate against the base intent, independent of any currently
 * selected sidecar modifier.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/calibrate_spec.ts \
 *     --spec=scripts/v0/specs/drums_0_56s_creative.ts --budget=300000
 */

import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";
import { fileURLToPath, pathToFileURL } from "node:url";
import { availableParallelism } from "node:os";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { compileHandoff } from "./optimizer/handoff.ts";
import { FPS, type AxisName, type Spec } from "./types.ts";
import {
  AXIS_QUALITY_TOLERANCE,
  axisDetails,
  scoreDriftReport,
  shiftedGeometricMean,
  type AxisDetail,
  type V0ContractScore,
} from "./score.ts";
import {
  DEFAULT_CALIBRATION_CANDIDATES,
  auditTargetChanges,
  calibrationSelectionPath,
  defineCalibration,
  type CalibrationObjective,
  type CalibrationCandidate,
  type SpecCalibration,
  type TargetAudit,
} from "./spec_modifiers.ts";

type WorkerInput = {
  specPath: string;
  candidateId: string;
  seed: number;
  budget: number;
};

type WorkerOk = {
  kind: "ok";
  candidateId: string;
  seed: number;
  elapsed_ms: number;
  score: V0ContractScore;
  axes: AxisDetail[];
  track_hash: string;
};

type WorkerErr = {
  kind: "error";
  candidateId: string;
  seed: number;
  elapsed_ms: number;
  message: string;
};

type WorkerResult = WorkerOk | WorkerErr;

type CandidateSummary = {
  id: string;
  label: string;
  description: string | null;
  rank: number;
  score: number;
  delta: number;
  objective_score: number;
  passed: number;
  total: number;
  elapsed_ms: number;
  axis_error_rms: number;
  axis_error_mean: number;
  speed_error_mean: number | null;
  impact_error_mean: number | null;
  drift: number;
  missing: number;
  off_beat_landings: number;
  died: number;
  distortion: TargetAudit["distortion"];
  target_audit: TargetAudit;
  axis_compare: AxisCompare[];
  rows: CandidateRow[];
};

type AxisCompare = {
  axis: string;
  mean_abs_error_before: number | null;
  mean_abs_error_after: number | null;
  target_shift_mean: number | null;
  achieved_shift_mean: number | null;
};

type CandidateRow = {
  seed: number;
  status: "ok" | "error";
  score: number;
  passed: boolean;
  elapsed_ms: number;
  message: string | null;
  track_hash: string | null;
  axis_error_rms: number | null;
  speed_error_mean: number | null;
  impact_error_mean: number | null;
};

export type CalibrationObjectiveInput = {
  score: number;
  axis_compare: readonly Pick<AxisCompare, "axis" | "mean_abs_error_after">[];
  distortion: Pick<TargetAudit["distortion"], "mean_abs_delta">;
};

function parseArgValue(argv: readonly string[], name: string): string | null {
  const prefix = `--${name}=`;
  const attached = argv.find((a) => a.startsWith(prefix));
  if (attached) return attached.slice(prefix.length);
  const flag = `--${name}`;
  const idx = argv.indexOf(flag);
  if (idx >= 0 && idx + 1 < argv.length && !argv[idx + 1].startsWith("--")) return argv[idx + 1];
  return null;
}

function arg(name: string): string | null {
  return parseArgValue(process.argv.slice(2), name);
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

export function parseSeeds(raw: string | null): number[] {
  const source = raw ?? "0,1,2,3,4,5,6,7,8,9,10,11";
  const parts = source.split(",");
  if (parts.length === 0 || parts.some((part) => part.trim() === "")) {
    throw new Error(`--seeds must be a comma-separated list of safe integers, got ${source}`);
  }
  const seeds = parts.map((part) => Number(part.trim()));
  if (seeds.length === 0 || seeds.some((seed) => !Number.isSafeInteger(seed))) {
    throw new Error(`--seeds must be a comma-separated list of safe integers, got ${source}`);
  }
  return [...new Set(seeds)].sort((a, b) => a - b);
}

function fmt(n: number | null, digits = 2): string {
  return n === null || !Number.isFinite(n) ? "-" : n.toFixed(digits);
}

function fmtSigned(n: number, digits = 2): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
}

function round(n: number, digits = 4): number {
  return Number(n.toFixed(digits));
}

function mean(values: number[]): number | null {
  const finite = values.filter(Number.isFinite);
  return finite.length === 0 ? null : finite.reduce((sum, v) => sum + v, 0) / finite.length;
}

function mean0(values: number[]): number {
  return mean(values) ?? 0;
}

export function calibrationObjectiveScore(
  objective: CalibrationObjective,
  input: CalibrationObjectiveInput,
): number {
  if (objective.kind === "global-score") return input.score;

  const scoreWeight = objective.score === undefined ? 1 : finiteOr(objective.score, 0);
  let total = scoreWeight * input.score;
  const axes = objective.axes ?? {};
  for (const [axis, rawWeight] of Object.entries(axes)) {
    const weight = finiteOr(rawWeight, 0);
    if (weight === 0) continue;
    const compare = input.axis_compare.find((row) => row.axis === axis);
    const error = compare?.mean_abs_error_after;
    if (error === null || error === undefined || !Number.isFinite(error)) continue;
    const axisQuality = Math.exp(-Math.max(0, error) / AXIS_QUALITY_TOLERANCE);
    total += weight * 1000 * axisQuality;
  }

  const distortionPenalty = Math.max(0, finiteOr(objective.distortionPenalty, 0));
  total -= distortionPenalty * 1000 * Math.max(0, finiteOr(input.distortion.mean_abs_delta, 0));
  return total;
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function trackHash(track: unknown): string {
  return createHash("sha256").update(JSON.stringify(track)).digest("hex");
}

async function loadCalibrationModule(specPath: string): Promise<{
  baseSpec: Spec;
  calibration: SpecCalibration;
  exportedCalibration: boolean;
  modulePath: string;
}> {
  const abs = resolve(specPath);
  const stat = statSync(abs);
  const mod = await import(`${pathToFileURL(abs).href}?mtime=${Math.trunc(stat.mtimeMs)}`) as Record<string, unknown>;
  const baseSpec = (mod.baseSpec ?? mod.default) as Spec | undefined;
  if (!baseSpec || typeof baseSpec.duration !== "number") {
    throw new Error(`spec ${specPath} did not export a valid Spec`);
  }
  const exported = isCalibration(mod.calibration);
  const calibration = exported
    ? defineCalibration({
        candidates: (mod.calibration as SpecCalibration).candidates,
        objective: (mod.calibration as SpecCalibration).objective,
      })
    : defineCalibration({ candidates: DEFAULT_CALIBRATION_CANDIDATES });
  return { baseSpec, calibration, exportedCalibration: exported, modulePath: abs };
}

function isCalibration(value: unknown): value is SpecCalibration {
  return Boolean(value && typeof value === "object" && Array.isArray((value as SpecCalibration).candidates));
}

function applyCandidate(baseSpec: Spec, calibration: SpecCalibration, candidateId: string): Spec {
  if (candidateId === "identity") return baseSpec;
  const candidate = calibration.candidates.find((c) => c.id === candidateId);
  if (candidate === undefined) throw new Error(`unknown calibration candidate ${candidateId}`);
  return candidate.apply(baseSpec);
}

async function runWorker(): Promise<void> {
  if (!parentPort) throw new Error("worker requires parentPort");
  const input = workerData as WorkerInput;
  const t0 = Date.now();
  try {
    const { baseSpec, calibration } = await loadCalibrationModule(input.specPath);
    const spec = applyCandidate(baseSpec, calibration, input.candidateId);
    const checkpoint = compileHandoff(spec, input.seed, { budget: input.budget });
    const elapsed_ms = Date.now() - t0;
    parentPort.postMessage({
      kind: "ok",
      candidateId: input.candidateId,
      seed: input.seed,
      elapsed_ms,
      score: scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) }),
      axes: axisDetails(checkpoint.report),
      track_hash: trackHash(checkpoint.track),
    } satisfies WorkerOk);
  } catch (error) {
    parentPort.postMessage({
      kind: "error",
      candidateId: input.candidateId,
      seed: input.seed,
      elapsed_ms: Date.now() - t0,
      message: String(error).slice(0, 500),
    } satisfies WorkerErr);
  }
}

async function runOne(input: WorkerInput, options: { redirectStdoutToStderr?: boolean } = {}): Promise<WorkerResult> {
  const workerPath = fileURLToPath(import.meta.url);
  return await new Promise((resolveResult) => {
    const worker = new Worker(workerPath, {
      workerData: input,
      execArgv: process.execArgv,
      stdout: options.redirectStdoutToStderr === true,
      resourceLimits: {
        maxOldGenerationSizeMb: 3072,
        maxYoungGenerationSizeMb: 128,
      },
    });
    if (options.redirectStdoutToStderr === true) {
      worker.stdout?.on("data", (chunk) => process.stderr.write(chunk));
    }
    let settled = false;
    worker.on("message", (msg: WorkerResult) => {
      if (settled) return;
      settled = true;
      worker.terminate().catch(() => {});
      resolveResult(msg);
    });
    worker.on("error", (error) => {
      if (settled) return;
      settled = true;
      resolveResult({
        kind: "error",
        candidateId: input.candidateId,
        seed: input.seed,
        elapsed_ms: 0,
        message: String(error).slice(0, 500),
      });
    });
    worker.on("exit", (code) => {
      if (settled) return;
      settled = true;
      resolveResult({
        kind: "error",
        candidateId: input.candidateId,
        seed: input.seed,
        elapsed_ms: 0,
        message: code === 0 ? "worker exited without result" : `worker exited ${code}`,
      });
    });
  });
}

async function runPool<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const runner = async (): Promise<void> => {
    for (;;) {
      const index = next++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, runner));
  return results;
}

function rowOf(result: WorkerResult): CandidateRow {
  if (result.kind === "error") {
    return {
      seed: result.seed,
      status: "error",
      score: 0,
      passed: false,
      elapsed_ms: result.elapsed_ms,
      message: result.message,
      track_hash: null,
      axis_error_rms: null,
      speed_error_mean: null,
      impact_error_mean: null,
    };
  }
  return {
    seed: result.seed,
    status: "ok",
    score: round(result.score.score, 4),
    passed: result.score.contract_passed,
    elapsed_ms: result.elapsed_ms,
    message: result.score.hard_failures.length ? result.score.hard_failures.join(",") : null,
    track_hash: result.track_hash,
    axis_error_rms: round(result.score.axis_error_rms, 6),
    speed_error_mean: axisMeanError(result.axes, "speed"),
    impact_error_mean: axisMeanError(result.axes, "impact"),
  };
}

function axisMeanError(axes: AxisDetail[], axis: AxisName): number | null {
  const values = axes.filter((a) => a.axis === axis).map((a) => Math.abs(a.error));
  const m = mean(values);
  return m === null ? null : round(m, 6);
}

function summarizeCandidate(
  candidate: CalibrationCandidate,
  results: WorkerResult[],
  identity: WorkerResult[],
  audit: TargetAudit,
  objective: CalibrationObjective,
): Omit<CandidateSummary, "rank" | "delta"> {
  const ok = results.filter((r): r is WorkerOk => r.kind === "ok");
  const rows = results.map(rowOf);
  const scores = rows.map((row) => row.score);
  const axisRms = ok.map((r) => r.score.axis_error_rms);
  const axisMean = ok.map((r) => r.score.axis_error_mean);
  const score = shiftedGeometricMean(scores);
  const axis_compare = compareAxes(identity, results, audit);
  return {
    id: candidate.id,
    label: candidate.label,
    description: candidate.description ?? null,
    score: round(score, 4),
    objective_score: round(calibrationObjectiveScore(objective, {
      score,
      axis_compare,
      distortion: audit.distortion,
    }), 4),
    passed: rows.filter((row) => row.passed).length,
    total: rows.length,
    elapsed_ms: rows.reduce((sum, row) => sum + row.elapsed_ms, 0),
    axis_error_rms: round(mean0(axisRms), 6),
    axis_error_mean: round(mean0(axisMean), 6),
    speed_error_mean: meanNullableRows(rows, "speed_error_mean"),
    impact_error_mean: meanNullableRows(rows, "impact_error_mean"),
    drift: sumScore(ok, "drift"),
    missing: sumScore(ok, "missing"),
    off_beat_landings: sumScore(ok, "off_beat_landings"),
    died: sumScore(ok, "died"),
    distortion: audit.distortion,
    target_audit: audit,
    axis_compare,
    rows,
  };
}

function sumScore(rows: WorkerOk[], key: keyof Pick<V0ContractScore, "drift" | "missing" | "off_beat_landings" | "died">): number {
  return rows.reduce((sum, row) => sum + row.score[key], 0);
}

function meanNullableRows(rows: CandidateRow[], key: "speed_error_mean" | "impact_error_mean"): number | null {
  const m = mean(rows.map((row) => row[key]).filter((v): v is number => v !== null));
  return m === null ? null : round(m, 6);
}

function compareAxes(identity: WorkerResult[], results: WorkerResult[], audit: TargetAudit): AxisCompare[] {
  const beforeOk = identity.filter((r): r is WorkerOk => r.kind === "ok");
  const afterOk = results.filter((r): r is WorkerOk => r.kind === "ok");
  const axes = new Set<string>([
    ...beforeOk.flatMap((row) => row.axes.map((axis) => axis.axis)),
    ...afterOk.flatMap((row) => row.axes.map((axis) => axis.axis)),
    ...audit.axes.map((axis) => axis.axis),
  ]);
  return [...axes].sort().map((axis) => {
    const before = beforeOk.flatMap((row) => row.axes.filter((a) => a.axis === axis).map((a) => Math.abs(a.error)));
    const after = afterOk.flatMap((row) => row.axes.filter((a) => a.axis === axis).map((a) => Math.abs(a.error)));
    const achievedShift = pairedAxisShift(beforeOk, afterOk, axis, "achieved");
    const targetAudit = audit.axes.find((a) => a.axis === axis);
    return {
      axis,
      mean_abs_error_before: nullableRound(mean(before), 6),
      mean_abs_error_after: nullableRound(mean(after), 6),
      target_shift_mean: nullableRound(targetAudit?.delta.mean ?? null, 6),
      achieved_shift_mean: nullableRound(mean(achievedShift), 6),
    };
  });
}

function pairedAxisShift(
  beforeRows: WorkerOk[],
  afterRows: WorkerOk[],
  axis: string,
  field: "achieved" | "target",
): number[] {
  const before = new Map<string, number>();
  for (const row of beforeRows) {
    for (const detail of row.axes) {
      if (detail.axis === axis) before.set(`${row.seed}:${detail.gap_index}`, detail[field]);
    }
  }
  const out: number[] = [];
  for (const row of afterRows) {
    for (const detail of row.axes) {
      const key = `${row.seed}:${detail.gap_index}`;
      const b = before.get(key);
      if (detail.axis === axis && b !== undefined) out.push(detail[field] - b);
    }
  }
  return out;
}

function nullableRound(value: number | null | undefined, digits: number): number | null {
  return value === null || value === undefined || !Number.isFinite(value) ? null : round(value, digits);
}

function printSummary(summaries: CandidateSummary[], reportPath: string): void {
  console.log("\ncalibration candidates");
  console.log("rank  candidate                         score    delta   pass    axis    speed   impact   distort");
  for (const row of summaries) {
    console.log(
      `${String(row.rank).padStart(4)}  ${row.label.padEnd(32).slice(0, 32)} ` +
        `${row.score.toFixed(1).padStart(7)} ` +
        `${fmtSigned(row.delta, 1).padStart(8)} ` +
        `${`${row.passed}/${row.total}`.padStart(7)} ` +
        `${row.axis_error_rms.toFixed(3).padStart(7)} ` +
        `${fmt(row.speed_error_mean, 3).padStart(7)} ` +
        `${fmt(row.impact_error_mean, 3).padStart(8)} ` +
        `${row.distortion.mean_abs_delta.toFixed(3).padStart(9)}`,
    );
  }
  console.log(`\nreport -> ${reportPath}\n`);
}

async function runMain(): Promise<void> {
  const specPath = arg("spec");
  if (!specPath) throw new Error("usage: npx tsx scripts/v0/calibrate_spec.ts --spec=<path.ts> [--budget=N] [--seeds=0,1]");
  const budget = Number(arg("budget") ?? "300000");
  if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`--budget must be a positive integer, got ${budget}`);
  const seeds = parseSeeds(arg("seeds"));
  const rawJobs = arg("jobs");
  const jobs = rawJobs === null ? Math.max(1, Math.floor(availableParallelism() / 2)) : Number(rawJobs);
  if (!Number.isSafeInteger(jobs) || jobs <= 0) throw new Error(`--jobs must be a positive integer, got ${rawJobs}`);
  const jsonOnly = has("json");
  const archiveDir = resolve(arg("out") ?? defaultArchiveDir(specPath));

  const loaded = await loadCalibrationModule(specPath);
  const candidates = loaded.calibration.candidates;
  const byId = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const baseCandidate = byId.get("identity") ?? candidates[0];
  if (baseCandidate === undefined) throw new Error("calibration has no candidates");

  const tasks = candidates.flatMap((candidate) =>
    seeds.map((seed) => ({ specPath, candidateId: candidate.id, seed, budget })),
  );
  if (!jsonOnly) {
    console.log(
      `calibrate spec=${specPath} budget=${budget} seeds=${seeds.join(",")} ` +
        `candidates=${candidates.length} jobs=${Math.min(jobs, tasks.length)}`,
    );
  }

  let done = 0;
  const results = await runPool(tasks, jobs, async (task) => {
    const result = await runOne(task, { redirectStdoutToStderr: jsonOnly });
    done++;
    if (!jsonOnly) process.stderr.write(`\r  compiled ${done}/${tasks.length}`);
    return result;
  });
  if (!jsonOnly) process.stderr.write("\n");

  const grouped = new Map<string, WorkerResult[]>();
  for (const candidate of candidates) grouped.set(candidate.id, []);
  for (const result of results) grouped.get(result.candidateId)?.push(result);

  const baseSpec = loaded.baseSpec;
  const audits = new Map<string, TargetAudit>();
  for (const candidate of candidates) {
    audits.set(candidate.id, auditTargetChanges(baseSpec, applyCandidate(baseSpec, loaded.calibration, candidate.id)));
  }
  const identityRows = grouped.get(baseCandidate.id) ?? [];
  const identityScore = shiftedGeometricMean(identityRows.map(rowOf).map((row) => row.score));
  const summaries = candidates
    .map((candidate) => {
      const summary = summarizeCandidate(
        candidate,
        grouped.get(candidate.id) ?? [],
        identityRows,
        audits.get(candidate.id)!,
        loaded.calibration.objective,
      );
      return {
        ...summary,
        rank: 0,
        delta: round(summary.score - identityScore, 4),
      } satisfies CandidateSummary;
    })
    .sort((a, b) => b.objective_score - a.objective_score || a.distortion.mean_abs_delta - b.distortion.mean_abs_delta)
    .map((summary, index) => ({ ...summary, rank: index + 1 }));

  const best = summaries[0] ?? null;
  const output = {
    kind: "spec-calibration",
    version: 1,
    createdAt: new Date().toISOString(),
    spec: {
      path: specPath,
      name: basename(specPath).replace(/\.ts$/, ""),
      exported_calibration: loaded.exportedCalibration,
      selection_path: calibrationSelectionPath(loaded.modulePath),
    },
    budget,
    seeds,
    jobs,
    objective: loaded.calibration.objective,
    candidate_count: candidates.length,
    baseline_candidate: baseCandidate.id,
    best: best === null ? null : {
      id: best.id,
      label: best.label,
      score: best.score,
      objective_score: best.objective_score,
      delta: best.delta,
    },
    candidates: summaries,
  };

  mkdirSync(archiveDir, { recursive: true });
  const reportPath = resolve(archiveDir, "calibration.json");
  writeFileSync(reportPath, JSON.stringify(output, null, 2) + "\n");
  if (jsonOnly) process.stdout.write(JSON.stringify(output, null, 2) + "\n");
  else printSummary(summaries, reportPath);
}

function defaultArchiveDir(specPath: string): string {
  const stem = basename(specPath).replace(/\.ts$/, "").replace(/[^A-Za-z0-9._-]+/g, "_");
  const stamp = new Date().toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z")
    .replace("T", "-");
  return resolve("generated", "spec-calibration", `${stem}-${stamp}`);
}

function isCliEntry(): boolean {
  const entry = process.argv[1];
  return entry !== undefined && fileURLToPath(import.meta.url) === resolve(entry);
}

if (!isMainThread) {
  await runWorker();
} else if (isCliEntry()) {
  await runMain().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
