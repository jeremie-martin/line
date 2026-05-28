import { createHash } from "node:crypto";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { availableParallelism } from "node:os";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { fileURLToPath } from "node:url";
import { Worker, isMainThread, parentPort, workerData } from "node:worker_threads";

import { compile } from "../compile.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "../golden_suite.ts";
import { scoreDriftReport, type V0ContractScore } from "../score.ts";

const DEFAULT_BUDGETS = [
  50_000,
  100_000,
  200_000,
  500_000,
  1_000_000,
  2_000_000,
  5_000_000,
  10_000_000,
] as const;
const FULL_SEEDS = [0, 1, 2, 3, 4] as const;
const MINIMAL_SEEDS = [0, 1, 2] as const;
const REPRESENTATIVE_SPECS: GoldenSpecName[] = [
  "drums_signature",
  "drums_pendulum",
  "dense_sprint",
  "syncopated_switchback",
  "grain_staircase",
  "rhythm_ladder",
];
const MINIMAL_SPECS: GoldenSpecName[] = [
  "drums_signature",
  "dense_sprint",
  "syncopated_switchback",
  "grain_staircase",
  "rhythm_ladder",
];
const QUALITY_TOLERANCE = 0.01;

type Scope = "minimal" | "representative" | "full";
type Strategy = "lds" | "legacy";

type StudyJob = {
  id: number;
  name: GoldenSpecName;
  seed: number;
  strategy: Strategy;
  budget_units: number | null;
  budget_index: number | null;
};

type StudyRow = StudyJob & {
  ok: boolean;
  elapsed_ms: number;
  work_units: number;
  sim_frames: number;
  physics_frames_computed: number;
  trajectory_frames_read: number;
  engine_add_lines: number;
  candidates_sampled: number;
  leaves_attempted: number;
  leaves_scored: number;
  max_discrepancy_started: number;
  subfloor_fallback_units: number;
  budget_exhausted: boolean;
  overshoot_units: number | null;
  overshoot_ratio: number | null;
  wall_ms_per_work_unit: number;
  track_hash: string;
  full_score: number;
  passed: boolean;
  axis_quality: number;
  contract_gated_quality: number;
  hard_failures: string[];
  leaf_fingerprints: string[];
  error: string | null;
};

type StudyConfig = {
  scope: Scope;
  names: GoldenSpecName[];
  seeds: number[];
  budgets: number[];
  greedy_reference: boolean;
  concurrency: number;
  out_dir: string;
  current_golden_specs: number;
};

type CaseSummary = {
  name: GoldenSpecName;
  seed: number;
  monotone_ok: boolean;
  prefix_ok: boolean;
  first_pass_budget: number | null;
  first_positive_budget: number | null;
  saturation_budget: number | null;
  final_quality: number;
  final_score: number;
  greedy_quality: number | null;
  greedy_score: number | null;
  greedy_match_budget: number | null;
  rows: Array<{
    budget_units: number;
    work_units: number;
    leaves_scored: number;
    passed: boolean;
    contract_gated_quality: number;
    full_score: number;
  }>;
  observations: string[];
};

type StudyOutput = {
  generated_at: string;
  config: StudyConfig;
  aggregate: {
    rows: number;
    lds_rows: number;
    legacy_rows: number;
    monotonicity_ok: boolean;
    prefix_ok: boolean;
    wall_ms_per_work_unit_cv: number;
    overshoot_units_p50: number;
    overshoot_units_p95: number;
    max_overshoot_units: number;
    failures: string[];
  };
  cases: CaseSummary[];
  rows: StudyRow[];
};

function arg(name: string): string | null {
  const prefix = `--${name}=`;
  const found = process.argv.slice(2).find((a) => a.startsWith(prefix));
  return found ? found.slice(prefix.length) : null;
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function parseScope(): Scope {
  const raw = arg("scope");
  if (raw === null) return "minimal";
  if (raw === "minimal" || raw === "representative" || raw === "full") return raw;
  throw new Error(`--scope must be minimal, representative, or full, got ${raw}`);
}

function parseNames(scope: Scope): GoldenSpecName[] {
  const raw = arg("specs");
  if (raw !== null) {
    const names = raw.split(",").map((part) => part.trim());
    for (const name of names) {
      if (!GOLDEN_SPECS.includes(name as GoldenSpecName)) {
        throw new Error(`unknown golden spec ${name}`);
      }
    }
    return names as GoldenSpecName[];
  }
  if (scope === "full") return [...GOLDEN_SPECS];
  if (scope === "representative") {
    return REPRESENTATIVE_SPECS.filter((name) => GOLDEN_SPECS.includes(name));
  }
  return MINIMAL_SPECS.filter((name) => GOLDEN_SPECS.includes(name));
}

function parseSeeds(scope: Scope): number[] {
  const raw = arg("seeds");
  if (raw !== null) {
    const seeds = raw.split(",").map((part) => Number(part.trim()));
    if (seeds.some((seed) => !Number.isInteger(seed))) {
      throw new Error(`--seeds must be comma-separated integers, got ${raw}`);
    }
    return seeds;
  }
  return scope === "minimal" ? [...MINIMAL_SEEDS] : [...FULL_SEEDS];
}

function parseBudgets(): number[] {
  const raw = arg("budgets");
  if (raw !== null) {
    const budgets = raw.split(",").map((part) => Number(part.trim()));
    validateBudgets(budgets, raw);
    return budgets;
  }

  const levelsRaw = arg("budget-levels");
  if (levelsRaw !== null) {
    const levels = Number(levelsRaw);
    if (!Number.isInteger(levels) || levels < 2) {
      throw new Error(`--budget-levels must be an integer >= 2, got ${levelsRaw}`);
    }
    const min = Number(arg("budget-min") ?? "50000");
    const max = Number(arg("budget-max") ?? "10000000");
    if (!Number.isFinite(min) || !Number.isFinite(max) || min <= 0 || max <= min) {
      throw new Error(`invalid budget range ${min}-${max}`);
    }
    return logSpaceBudgets(min, max, levels);
  }

  return [...DEFAULT_BUDGETS];
}

function validateBudgets(budgets: number[], label: string): void {
  if (budgets.some((budget) => !Number.isInteger(budget) || budget <= 0)) {
    throw new Error(`budgets must be positive integers, got ${label}`);
  }
  for (let i = 1; i < budgets.length; i++) {
    if (budgets[i] <= budgets[i - 1]) {
      throw new Error(`budgets must be strictly increasing, got ${label}`);
    }
  }
}

function logSpaceBudgets(min: number, max: number, levels: number): number[] {
  const out: number[] = [];
  const logMin = Math.log(min);
  const logMax = Math.log(max);
  for (let i = 0; i < levels; i++) {
    const t = levels === 1 ? 0 : i / (levels - 1);
    out.push(Math.round(Math.exp(logMin + (logMax - logMin) * t)));
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

function parseConcurrency(): number {
  const raw = arg("concurrency");
  if (raw !== null) {
    const value = Number(raw);
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`--concurrency must be a positive integer, got ${raw}`);
    }
    return value;
  }
  return Math.max(1, Math.min(4, availableParallelism() - 1));
}

function timestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

function parseConfig(): StudyConfig {
  const scope = parseScope();
  const out = arg("out") ?? `generated/v0_budget_study/${timestamp()}`;
  return {
    scope,
    names: parseNames(scope),
    seeds: parseSeeds(scope),
    budgets: parseBudgets(),
    greedy_reference: !has("no-greedy"),
    concurrency: parseConcurrency(),
    out_dir: out,
    current_golden_specs: GOLDEN_SPECS.length,
  };
}

function buildJobs(config: StudyConfig): StudyJob[] {
  const jobs: StudyJob[] = [];
  let id = 1;
  for (const name of config.names) {
    for (const seed of config.seeds) {
      for (let budget_index = 0; budget_index < config.budgets.length; budget_index++) {
        jobs.push({
          id: id++,
          name,
          seed,
          strategy: "lds",
          budget_units: config.budgets[budget_index],
          budget_index,
        });
      }
      if (config.greedy_reference) {
        jobs.push({
          id: id++,
          name,
          seed,
          strategy: "legacy",
          budget_units: null,
          budget_index: null,
        });
      }
    }
  }
  return jobs;
}

function stableHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function contractGatedQuality(score: V0ContractScore): number {
  return score.passed ? score.axis_quality : 0;
}

async function runWorker(): Promise<void> {
  if (!parentPort) throw new Error("study worker requires parentPort");
  const job = workerData as StudyJob;
  const started = performance.now();
  try {
    const spec = await loadGoldenSpec(job.name, "base");
    const result = job.strategy === "lds"
      ? compile(spec, {
        seed: job.seed,
        strategy: "lds",
        budget: { kind: "work", units: job.budget_units ?? 1 },
      })
      : compile(spec, job.seed);
    const elapsed_ms = performance.now() - started;
    const score = scoreDriftReport(result.report);
    const overshoot_units = job.budget_units === null
      ? null
      : result.stats.work_units_used - job.budget_units;
    const row: StudyRow = {
      ...job,
      ok: true,
      elapsed_ms,
      work_units: result.stats.work_units_used,
      sim_frames: result.stats.sim_frames,
      physics_frames_computed: result.stats.physics_frames_computed,
      trajectory_frames_read: result.stats.trajectory_frames_read,
      engine_add_lines: result.stats.engine_add_lines,
      candidates_sampled: result.stats.candidates_sampled,
      leaves_attempted: result.stats.leaves_attempted,
      leaves_scored: result.stats.leaves_scored,
      max_discrepancy_started: result.stats.max_discrepancy_started,
      subfloor_fallback_units: result.stats.subfloor_fallback_units,
      budget_exhausted: result.stats.budget_exhausted,
      overshoot_units,
      overshoot_ratio: overshoot_units === null || job.budget_units === null
        ? null
        : overshoot_units / job.budget_units,
      wall_ms_per_work_unit: result.stats.work_units_used > 0
        ? elapsed_ms / result.stats.work_units_used
        : 0,
      track_hash: stableHash(result.track),
      full_score: score.score,
      passed: score.passed,
      axis_quality: score.axis_quality,
      contract_gated_quality: contractGatedQuality(score),
      hard_failures: score.hard_failures,
      leaf_fingerprints: result.stats.scored_leaf_fingerprints,
      error: null,
    };
    parentPort.postMessage(row);
  } catch (error) {
    const elapsed_ms = performance.now() - started;
    parentPort.postMessage({
      ...job,
      ok: false,
      elapsed_ms,
      work_units: 0,
      sim_frames: 0,
      physics_frames_computed: 0,
      trajectory_frames_read: 0,
      engine_add_lines: 0,
      candidates_sampled: 0,
      leaves_attempted: 0,
      leaves_scored: 0,
      max_discrepancy_started: -1,
      subfloor_fallback_units: 0,
      budget_exhausted: false,
      overshoot_units: null,
      overshoot_ratio: null,
      wall_ms_per_work_unit: 0,
      track_hash: "",
      full_score: 0,
      passed: false,
      axis_quality: 0,
      contract_gated_quality: 0,
      hard_failures: ["error"],
      leaf_fingerprints: [],
      error: error instanceof Error ? error.message : String(error),
    } satisfies StudyRow);
  }
}

async function runJob(job: StudyJob): Promise<StudyRow> {
  const workerPath = fileURLToPath(import.meta.url);
  return await new Promise<StudyRow>((resolvePromise, reject) => {
    const worker = new Worker(workerPath, { workerData: job, execArgv: process.execArgv });
    worker.once("message", (row: StudyRow) => resolvePromise(row));
    worker.once("error", reject);
    worker.once("exit", (code) => {
      if (code !== 0) reject(new Error(`worker for job ${job.id} exited ${code}`));
    });
  });
}

async function runJobs(
  jobs: StudyJob[],
  concurrency: number,
  onRow?: (row: StudyRow) => Promise<void>,
): Promise<StudyRow[]> {
  const rows: StudyRow[] = [];
  let next = 0;
  let done = 0;
  const started = performance.now();

  async function workerLoop(): Promise<void> {
    while (true) {
      const index = next++;
      if (index >= jobs.length) return;
      const row = await runJob(jobs[index]);
      rows.push(row);
      if (onRow !== undefined) await onRow(row);
      done++;
      if (!has("quiet")) {
        const elapsed = (performance.now() - started) / 1000;
        const rate = done / Math.max(1, elapsed);
        console.error(
          `study ${done}/${jobs.length} ${row.name} seed=${row.seed} ` +
            `${row.strategy}${row.budget_units === null ? "" : `@${row.budget_units}`} ` +
            `q=${row.contract_gated_quality.toFixed(4)} ` +
            `rate=${rate.toFixed(2)}/s`,
        );
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, jobs.length) }, () => workerLoop()));
  return rows.sort(compareRows);
}

function compareRows(a: StudyRow, b: StudyRow): number {
  return a.name.localeCompare(b.name)
    || a.seed - b.seed
    || strategyOrder(a.strategy) - strategyOrder(b.strategy)
    || (a.budget_index ?? 9999) - (b.budget_index ?? 9999);
}

function strategyOrder(strategy: Strategy): number {
  return strategy === "lds" ? 0 : 1;
}

function prefixOk(prev: string[], next: string[]): boolean {
  if (prev.length > next.length) return false;
  for (let i = 0; i < prev.length; i++) {
    if (prev[i] !== next[i]) return false;
  }
  return true;
}

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values: number[]): number {
  if (values.length === 0) return 0;
  const m = mean(values);
  return Math.sqrt(mean(values.map((value) => Math.pow(value - m, 2))));
}

function cv(values: number[]): number {
  const m = mean(values);
  return m === 0 ? 0 : stddev(values) / m;
}

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(p * sorted.length) - 1));
  return sorted[index];
}

function buildOutput(config: StudyConfig, rows: StudyRow[]): StudyOutput {
  const cases = buildCaseSummaries(config, rows);
  const failures = [
    ...cases.flatMap((c) => c.monotone_ok ? [] : [`${c.name} seed=${c.seed} monotonicity`]),
    ...cases.flatMap((c) => c.prefix_ok ? [] : [`${c.name} seed=${c.seed} prefix`]),
    ...rows.flatMap((row) => row.ok ? [] : [`${row.name} seed=${row.seed} ${row.strategy}: ${row.error}`]),
  ];
  const ratios = rows
    .filter((row) => row.strategy === "lds" && row.ok && row.wall_ms_per_work_unit > 0)
    .map((row) => row.wall_ms_per_work_unit);
  const overshoots = rows
    .filter((row) => row.strategy === "lds" && row.ok && row.overshoot_units !== null)
    .map((row) => row.overshoot_units ?? 0);

  return {
    generated_at: new Date().toISOString(),
    config,
    aggregate: {
      rows: rows.length,
      lds_rows: rows.filter((row) => row.strategy === "lds").length,
      legacy_rows: rows.filter((row) => row.strategy === "legacy").length,
      monotonicity_ok: cases.every((c) => c.monotone_ok),
      prefix_ok: cases.every((c) => c.prefix_ok),
      wall_ms_per_work_unit_cv: cv(ratios),
      overshoot_units_p50: percentile(overshoots, 0.5),
      overshoot_units_p95: percentile(overshoots, 0.95),
      max_overshoot_units: overshoots.length === 0 ? 0 : Math.max(...overshoots),
      failures,
    },
    cases,
    rows,
  };
}

function buildCaseSummaries(config: StudyConfig, rows: StudyRow[]): CaseSummary[] {
  const out: CaseSummary[] = [];
  for (const name of config.names) {
    for (const seed of config.seeds) {
      const lds = rows
        .filter((row) => row.name === name && row.seed === seed && row.strategy === "lds")
        .sort((a, b) => (a.budget_units ?? 0) - (b.budget_units ?? 0));
      const greedy = rows.find((row) =>
        row.name === name && row.seed === seed && row.strategy === "legacy"
      );
      if (lds.length === 0) continue;

      let monotone_ok = true;
      let prefix_ok = true;
      for (let i = 1; i < lds.length; i++) {
        if (
          lds[i].contract_gated_quality + QUALITY_TOLERANCE <
            lds[i - 1].contract_gated_quality
        ) {
          monotone_ok = false;
        }
        if (!prefixOk(lds[i - 1].leaf_fingerprints, lds[i].leaf_fingerprints)) {
          prefix_ok = false;
        }
      }

      const finalRow = lds[lds.length - 1];
      const firstPass = lds.find((row) => row.passed);
      const firstPositive = lds.find((row) => row.contract_gated_quality > 0);
      const saturation = lds.find((row) =>
        row.contract_gated_quality + QUALITY_TOLERANCE >= finalRow.contract_gated_quality
      );
      const greedyMatch = greedy === undefined
        ? undefined
        : lds.find((row) =>
          row.contract_gated_quality + QUALITY_TOLERANCE >= greedy.contract_gated_quality
        );

      out.push({
        name,
        seed,
        monotone_ok,
        prefix_ok,
        first_pass_budget: firstPass?.budget_units ?? null,
        first_positive_budget: firstPositive?.budget_units ?? null,
        saturation_budget: saturation?.budget_units ?? null,
        final_quality: finalRow.contract_gated_quality,
        final_score: finalRow.full_score,
        greedy_quality: greedy?.contract_gated_quality ?? null,
        greedy_score: greedy?.full_score ?? null,
        greedy_match_budget: greedyMatch?.budget_units ?? null,
        rows: lds.map((row) => ({
          budget_units: row.budget_units ?? 0,
          work_units: row.work_units,
          leaves_scored: row.leaves_scored,
          passed: row.passed,
          contract_gated_quality: row.contract_gated_quality,
          full_score: row.full_score,
        })),
        observations: observationsFor(lds, greedy),
      });
    }
  }
  return out;
}

function observationsFor(lds: StudyRow[], greedy: StudyRow | undefined): string[] {
  const observations: string[] = [];
  const first = lds[0];
  const last = lds[lds.length - 1];
  const firstPass = lds.find((row) => row.passed);
  if (!first.passed && firstPass !== undefined) {
    observations.push(`contract first passes at budget ${firstPass.budget_units}`);
  }
  if (last.contract_gated_quality <= 0) {
    observations.push("no passing LDS track in swept budget range");
  }
  const firstBest = lds.find((row) =>
    row.contract_gated_quality + QUALITY_TOLERANCE >= last.contract_gated_quality
  );
  if (firstBest !== undefined && firstBest !== last) {
    observations.push(`quality saturates by budget ${firstBest.budget_units}`);
  }
  if (greedy !== undefined) {
    const match = lds.find((row) =>
      row.contract_gated_quality + QUALITY_TOLERANCE >= greedy.contract_gated_quality
    );
    observations.push(
      match === undefined
        ? "LDS does not match greedy reference in swept range"
        : `LDS matches greedy reference by budget ${match.budget_units}`,
    );
  }
  if (observations.length === 0) observations.push("monotone curve with no notable jump");
  return observations;
}

function toCsv(rows: StudyRow[]): string {
  const columns: Array<keyof StudyRow> = [
    "name",
    "seed",
    "strategy",
    "budget_units",
    "budget_index",
    "ok",
    "elapsed_ms",
    "work_units",
    "sim_frames",
    "budget_exhausted",
    "overshoot_units",
    "overshoot_ratio",
    "wall_ms_per_work_unit",
    "leaves_scored",
    "max_discrepancy_started",
    "full_score",
    "passed",
    "axis_quality",
    "contract_gated_quality",
    "track_hash",
    "error",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
  ].join("\n") + "\n";
}

function csvCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function renderMarkdown(output: StudyOutput): string {
  const lines: string[] = [];
  lines.push("# V0 LDS Budget Study");
  lines.push("");
  lines.push(`Generated: ${output.generated_at}`);
  lines.push("");
  lines.push("## Scope");
  lines.push("");
  lines.push(`- Scope: ${output.config.scope}`);
  lines.push(`- Current golden specs in repo: ${output.config.current_golden_specs}`);
  lines.push(`- Specs: ${output.config.names.join(", ")}`);
  lines.push(`- Seeds: ${output.config.seeds.join(", ")}`);
  lines.push(`- Budgets: ${output.config.budgets.join(", ")}`);
  lines.push(`- Greedy reference: ${output.config.greedy_reference}`);
  lines.push(`- Concurrency: ${output.config.concurrency}`);
  lines.push("");
  lines.push("## Aggregate");
  lines.push("");
  lines.push(`- Rows: ${output.aggregate.rows}`);
  lines.push(`- Monotonicity: ${output.aggregate.monotonicity_ok ? "ok" : "failed"}`);
  lines.push(`- Prefix stability: ${output.aggregate.prefix_ok ? "ok" : "failed"}`);
  lines.push(`- Wall ms/work-unit CV: ${output.aggregate.wall_ms_per_work_unit_cv.toFixed(4)}`);
  lines.push(`- Overshoot p50/p95/max: ${output.aggregate.overshoot_units_p50} / ${output.aggregate.overshoot_units_p95} / ${output.aggregate.max_overshoot_units}`);
  if (output.aggregate.failures.length > 0) {
    lines.push("");
    lines.push("Failures:");
    for (const failure of output.aggregate.failures) lines.push(`- ${failure}`);
  }
  lines.push("");
  lines.push("## Case Curves");
  lines.push("");
  for (const c of output.cases) {
    lines.push(`### ${c.name} seed=${c.seed}`);
    lines.push("");
    lines.push(`- Monotone: ${c.monotone_ok}`);
    lines.push(`- Prefix: ${c.prefix_ok}`);
    lines.push(`- First pass budget: ${c.first_pass_budget ?? "none"}`);
    lines.push(`- Saturation budget: ${c.saturation_budget ?? "none"}`);
    lines.push(`- Greedy quality: ${fmt(c.greedy_quality)}`);
    lines.push(`- Greedy match budget: ${c.greedy_match_budget ?? "none"}`);
    lines.push("");
    lines.push("```text");
    lines.push("budget     work       leaves pass quality score   curve");
    for (const row of c.rows) {
      lines.push(
        `${pad(row.budget_units, 10)} ${pad(row.work_units, 10)} ${pad(row.leaves_scored, 6)} ` +
          `${row.passed ? "yes " : "no  "} ${fmt(row.contract_gated_quality)} ${pad(row.full_score.toFixed(1), 7)} ${bar(row.contract_gated_quality)}`,
      );
    }
    lines.push("```");
    lines.push("");
    for (const observation of c.observations) lines.push(`- ${observation}`);
    lines.push("");
  }
  return lines.join("\n");
}

function fmt(value: number | null): string {
  return value === null ? "n/a" : value.toFixed(4);
}

function pad(value: string | number, width: number): string {
  return String(value).padStart(width, " ");
}

function bar(value: number): string {
  const width = 20;
  const filled = Math.max(0, Math.min(width, Math.round(value * width)));
  return `[${"#".repeat(filled)}${".".repeat(width - filled)}]`;
}

async function writeOutputs(output: StudyOutput): Promise<void> {
  await mkdir(output.config.out_dir, { recursive: true });
  await writeFile(resolve(output.config.out_dir, "study.json"), JSON.stringify(output, null, 2) + "\n");
  await writeFile(resolve(output.config.out_dir, "rows.csv"), toCsv(output.rows));
  await writeFile(resolve(output.config.out_dir, "analysis.md"), renderMarkdown(output));
}

function jobKey(job: Pick<StudyJob, "name" | "seed" | "strategy" | "budget_units">): string {
  return `${job.name}|${job.seed}|${job.strategy}|${job.budget_units ?? "none"}`;
}

async function readExistingRows(outDir: string): Promise<StudyRow[]> {
  const jsonlRows = await readRowsJsonl(outDir);
  if (jsonlRows.length > 0) return dedupeRows(jsonlRows);

  try {
    const raw = await readFile(resolve(outDir, "study.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<StudyOutput>;
    return Array.isArray(parsed.rows) ? dedupeRows(parsed.rows as StudyRow[]) : [];
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: string }).code
      : undefined;
    if (code === "ENOENT") return [];
    throw error;
  }
}

async function readRowsJsonl(outDir: string): Promise<StudyRow[]> {
  try {
    const raw = await readFile(resolve(outDir, "rows.jsonl"), "utf8");
    return raw
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as StudyRow);
  } catch (error) {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: string }).code
      : undefined;
    if (code === "ENOENT") return [];
    throw error;
  }
}

function dedupeRows(rows: StudyRow[]): StudyRow[] {
  const byKey = new Map<string, StudyRow>();
  for (const row of rows) byKey.set(jobKey(row), row);
  return [...byKey.values()].sort(compareRows);
}

async function main(): Promise<void> {
  const config = parseConfig();
  validateBudgets(config.budgets, config.budgets.join(","));
  await mkdir(config.out_dir, { recursive: true });
  if (!has("resume")) {
    await writeFile(resolve(config.out_dir, "rows.jsonl"), "");
  }
  const jobs = buildJobs(config);
  const existingRows = has("resume") ? await readExistingRows(config.out_dir) : [];
  const existingKeys = new Set(existingRows.map(jobKey));
  const remainingJobs = jobs.filter((job) => !existingKeys.has(jobKey(job)));
  let appendChain = Promise.resolve();
  const appendRow = (row: StudyRow): Promise<void> => {
    appendChain = appendChain.then(() =>
      appendFile(resolve(config.out_dir, "rows.jsonl"), JSON.stringify(row) + "\n")
    );
    return appendChain;
  };
  console.error(
    `budget study scope=${config.scope} specs=${config.names.length}/${GOLDEN_SPECS.length} ` +
      `seeds=${config.seeds.length} budgets=${config.budgets.length} ` +
      `greedy=${config.greedy_reference} jobs=${jobs.length} ` +
      `remaining=${remainingJobs.length} resume=${has("resume")} concurrency=${config.concurrency}`,
  );
  const rows = [
    ...existingRows,
    ...await runJobs(remainingJobs, config.concurrency, appendRow),
  ].sort(compareRows);
  await appendChain;
  const output = buildOutput(config, rows);
  await writeOutputs(output);
  console.log(JSON.stringify({
    ok: output.aggregate.failures.length === 0,
    out_dir: output.config.out_dir,
    rows: output.aggregate.rows,
    monotonicity_ok: output.aggregate.monotonicity_ok,
    prefix_ok: output.aggregate.prefix_ok,
    wall_ms_per_work_unit_cv: output.aggregate.wall_ms_per_work_unit_cv,
    failures: output.aggregate.failures,
  }, null, 2));
  if (output.aggregate.failures.length > 0) process.exitCode = 1;
}

if (!isMainThread) {
  await runWorker();
} else {
  await main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
