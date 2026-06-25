/**
 * Launch a sharded quality-ncand characterization panel.
 *
 * This is an orchestration wrapper around `study_budget_spend.ts`: it queues
 * one task per `(budget, shard)` and runs at most `--workers` child processes at
 * once. Each shard writes a normal study JSON file, and successful shards are
 * merged into one analysis-ready panel JSON at the end.
 */

import { spawn } from "node:child_process";
import {
  createWriteStream,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";
import { GOLDEN_SPECS, type GoldenSpecName } from "./golden_suite.ts";

type StudyFile = {
  config: {
    budget: number;
    specs: string[];
    seeds: number[];
    study_knob: "quality_ncand";
    knob_values: number[];
    baseline_value: number;
    quality_ncand?: number[];
    baseline_quality_ncand?: number;
    shard?: { index: number; count: number } | null;
    planned_rows?: number;
    selected_rows?: number;
  };
  rows: unknown[];
};

type Task = {
  index: number;
  budget: number;
  shard: number;
  outPath: string;
  logPath: string;
  status: "pending" | "running" | "skipped" | "ok" | "failed";
  started_at?: string;
  finished_at?: string;
  exit_code?: number | null;
  row_count?: number;
};

const DEFAULT_BUDGETS = [
  150_000,
  216_667,
  283_333,
  350_000,
  416_667,
  483_333,
  550_000,
  616_667,
  683_333,
  750_000,
];
const DEFAULT_Q = [16, 20, 24, 28, 32, 36, 40, 48];
const DEFAULT_SEEDS = Array.from({ length: 16 }, (_, index) => index);

const argv = process.argv.slice(2);
const budgets = positiveIntListArg("budgets", DEFAULT_BUDGETS);
const qualityNCand = positiveIntListArg("quality-ncand", DEFAULT_Q);
const baselineNCand = intArg("baseline-ncand", 32);
const seeds = intListArg("seeds", DEFAULT_SEEDS);
const specs = specListArg("specs", [...GOLDEN_SPECS]);
const workers = intArg("workers", 48);
const shards = intArg("shards", workers);
const outDir = arg("out-dir") ?? "generated/studies/qncand-large-panel";
const resume = !boolArg("no-resume", false);
const mergedOut = arg("merged-out") ?? join(outDir, "panel.json");
const manifestPath = arg("manifest") ?? join(outDir, "manifest.json");
const shardDir = join(outDir, "shards");
const logDir = join(outDir, "logs");

if (workers <= 0) throw new Error("--workers must be positive");
if (shards <= 0) throw new Error("--shards must be positive");

mkdirSync(shardDir, { recursive: true });
mkdirSync(logDir, { recursive: true });

const tasks: Task[] = [];
for (const budget of budgets) {
  for (let shard = 0; shard < shards; shard++) {
    const label = `b${budget}-shard${String(shard).padStart(2, "0")}-of-${shards}`;
    tasks.push({
      index: tasks.length,
      budget,
      shard,
      outPath: join(shardDir, `${label}.json`),
      logPath: join(logDir, `${label}.log`),
      status: "pending",
    });
  }
}

writeManifest(tasks);

let nextTask = 0;
let running = 0;
let failed = 0;
let completed = 0;

await new Promise<void>((resolve) => {
  const pump = () => {
    while (running < workers && nextTask < tasks.length) {
      const task = tasks[nextTask++];
      const existing = resume ? readValidStudy(task.outPath) : null;
      if (existing !== null) {
        task.status = "skipped";
        task.row_count = existing.rows.length;
        completed++;
        printProgress(task);
        continue;
      }
      runTask(task, pump);
    }
    if (running === 0 && nextTask >= tasks.length) resolve();
  };
  pump();
});

writeManifest(tasks);

if (failed > 0) {
  console.error(`qcand-panel: ${failed} task(s) failed; not writing merged panel`);
  process.exitCode = 1;
} else {
  const studies = tasks.map((task) => readStudy(task.outPath));
  const rows = studies.flatMap((study) => study.rows);
  const output = {
    config: {
      budgets,
      specs,
      seeds,
      study_knob: "quality_ncand" as const,
      knob_values: qualityNCand,
      baseline_value: baselineNCand,
      quality_ncand: qualityNCand,
      baseline_quality_ncand: baselineNCand,
      workers,
      shards,
      shard_outputs: tasks.map((task) => task.outPath),
      rows: rows.length,
    },
    rows,
  };
  writeFileSync(mergedOut, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`qcand-panel: wrote ${mergedOut} rows=${rows.length}`);
}

function runTask(task: Task, onDone: () => void): void {
  running++;
  task.status = "running";
  task.started_at = new Date().toISOString();
  writeManifest(tasks);
  const log = createWriteStream(task.logPath, { flags: "a" });
  log.write(`\n=== ${task.started_at} START budget=${task.budget} shard=${task.shard}/${shards} ===\n`);
  const child = spawn(process.execPath, [
    "--import",
    "tsx",
    "scripts/v0/study_budget_spend.ts",
    `--budget=${task.budget}`,
    `--specs=${specs.length === GOLDEN_SPECS.length ? "ALL" : specs.join(",")}`,
    `--seeds=${seeds.join(",")}`,
    `--quality-ncand=${qualityNCand.join(",")}`,
    `--baseline-ncand=${baselineNCand}`,
    `--shard=${task.shard}/${shards}`,
    `--out=${task.outPath}`,
  ], {
    cwd: process.cwd(),
    env: { ...process.env, LR_ENGINE: process.env.LR_ENGINE ?? "wasm" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  child.stdout.pipe(log, { end: false });
  child.stderr.pipe(log, { end: false });
  child.on("close", (code) => {
    task.finished_at = new Date().toISOString();
    task.exit_code = code;
    const study = code === 0 ? readValidStudy(task.outPath) : null;
    if (study === null) {
      task.status = "failed";
      failed++;
    } else {
      task.status = "ok";
      task.row_count = study.rows.length;
    }
    log.write(`=== ${task.finished_at} END code=${code} status=${task.status} rows=${task.row_count ?? "na"} ===\n`);
    log.end();
    running--;
    completed++;
    printProgress(task);
    writeManifest(tasks);
    onDone();
  });
}

function printProgress(task: Task): void {
  const ok = tasks.filter((item) => item.status === "ok" || item.status === "skipped").length;
  const active = tasks.filter((item) => item.status === "running").length;
  console.log(
    `qcand-panel: ${completed}/${tasks.length} done ok=${ok} failed=${failed} ` +
      `running=${active} last=${task.status} b=${task.budget} shard=${task.shard}/${shards}`,
  );
}

function writeManifest(taskList: readonly Task[]): void {
  const plannedRows = budgets.length * specs.length * seeds.length * qualityNCand.length;
  const output = {
    config: {
      budgets,
      specs,
      seeds,
      quality_ncand: qualityNCand,
      baseline_quality_ncand: baselineNCand,
      workers,
      shards,
      out_dir: outDir,
      merged_out: mergedOut,
      planned_rows: plannedRows,
      started_at: taskList.some((task) => task.started_at !== undefined)
        ? taskList.find((task) => task.started_at !== undefined)?.started_at
        : new Date().toISOString(),
    },
    tasks: taskList,
  };
  writeFileSync(manifestPath, `${JSON.stringify(output, null, 2)}\n`);
}

function readValidStudy(path: string): StudyFile | null {
  if (!existsSync(path)) return null;
  try {
    const study = readStudy(path);
    return Array.isArray(study.rows) && study.config?.study_knob === "quality_ncand" ? study : null;
  } catch {
    return null;
  }
}

function readStudy(path: string): StudyFile {
  return JSON.parse(readFileSync(path, "utf8")) as StudyFile;
}

function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function boolArg(name: string, fallback: boolean): boolean {
  const raw = arg(name);
  if (raw === undefined) return fallback;
  if (raw === "" || raw === "1" || raw === "true") return true;
  if (raw === "0" || raw === "false") return false;
  return fallback;
}

function intArg(name: string, fallback: number): number {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function intListArg(name: string, fallback: readonly number[]): number[] {
  const raw = arg(name);
  if (raw === undefined || raw.trim() === "") return [...fallback];
  return raw.split(",").map((value) => Number.parseInt(value, 10))
    .filter((value) => Number.isFinite(value));
}

function positiveIntListArg(name: string, fallback: readonly number[]): number[] {
  return intListArg(name, fallback).filter((value) => value > 0);
}

function specListArg(name: string, fallback: readonly GoldenSpecName[]): GoldenSpecName[] {
  const raw = arg(name);
  const values = raw === undefined || raw.trim() === ""
    ? [...fallback]
    : raw === "ALL"
      ? [...GOLDEN_SPECS]
      : raw.split(",") as GoldenSpecName[];
  for (const spec of values) {
    if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) {
      throw new Error(`unknown golden spec "${spec}"`);
    }
  }
  return values;
}
