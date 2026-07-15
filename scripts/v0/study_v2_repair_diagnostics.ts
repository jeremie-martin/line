/**
 * V2-native observation panel for the completion-triggered repair phase.
 *
 * This does not alter search or replay.  It records the repair decisions the
 * compiler already made so a later selector change can be justified by V2
 * evidence rather than by an old V1 archive.
 */
import { mkdirSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { scoreDriftReport } from "./score.ts";
import { FPS } from "./types.ts";

const argv = process.argv.slice(2);
if (argv.includes("--help")) {
  process.stdout.write(`Usage: npx tsx scripts/v0/study_v2_repair_diagnostics.ts [options]\n\n` +
    `Observe the compiler's existing completion-triggered repair decisions.\n` +
    `This tool never changes search, replay, or benchmark records.\n\n` +
    `Options:\n` +
    `  --specs=id,...       Development case ids (default: four repair-relevant cases)\n` +
    `  --seeds=n,...        Compiler seeds (default: 27,28,29)\n` +
    `  --budget=n           Per-compile budget (default: 500000)\n` +
    `  --out=path           Atomically checkpoint after every completed compile\n` +
    `  --records            Capture per-restart causal detail without terminal spam\n` +
    `  --help               Show this help without compiling\n`);
  process.exit(0);
}
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const ids = (arg("specs") ?? "countercurrent,dense_dialogue,believer_56_6s,frontier_low_air_endurance")
  .split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "27,28,29").split(",").map(Number);
const budget = Number(arg("budget") ?? "500000");
const out = arg("out");
const records = argv.includes("--records");
if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error("--budget must be a positive integer");
if (seeds.some((seed) => !Number.isSafeInteger(seed))) throw new Error("--seeds must be safe integers");
if (records) process.env.LR_REPAIR_LOG = "1";

const cases = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case.spec] as const));
for (const id of ids) if (!cases.has(id)) throw new Error(`unknown V2 development case ${id}`);

const rows: Array<Record<string, unknown>> = [];
const expectedRows = ids.length * seeds.length;
const forceGc = (globalThis as typeof globalThis & { gc?: () => void }).gc;

function observeWithOptionalRepairLog<T>(run: () => T): T {
  if (!records) return run();
  const originalWrite = process.stderr.write;
  process.stderr.write = ((chunk: string | Uint8Array, ...args: unknown[]) => {
    const text = typeof chunk === "string" ? chunk : Buffer.from(chunk).toString("utf8");
    if (text.startsWith("repair ")) return true;
    return originalWrite.call(process.stderr, chunk, ...(args as []));
  }) as typeof process.stderr.write;
  try {
    return run();
  } finally {
    process.stderr.write = originalWrite;
  }
}

const result = () => ({
  schema: "line.study-v2-repair-diagnostics.v1",
  note: "Observation only. Set LR_REPAIR_LOG=1 to include per-restart causal context.",
  complete: rows.length === expectedRows,
  completed_rows: rows.length,
  expected_rows: expectedRows,
  ids,
  seeds,
  budget,
  rows,
});

const checkpoint = () => {
  if (out === undefined) return;
  mkdirSync(dirname(out), { recursive: true });
  const temporary = `${out}.tmp-${process.pid}`;
  writeFileSync(temporary, `${JSON.stringify(result(), null, 2)}\n`);
  renameSync(temporary, out);
};

const observe = (id: string, seed: number): Record<string, unknown> => {
  const started = performance.now();
  const spec = applyJolt(cases.get(id)!, benchmarkPolicy.transform.joltMs);
  const checkpoint = observeWithOptionalRepairLog(() => compileHandoff(spec, seed, { budget }));
  const score = scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) });
  const repair = checkpoint.stats.repair;
  return {
    id,
    seed,
    valid: score.contract_passed,
    score: Number(score.score.toFixed(4)),
    elapsed_ms: Math.round(performance.now() - started),
    sim_frames: checkpoint.stats.sim_frames,
    first_completion_frame: checkpoint.stats.first_completion_frame ?? null,
    repair: repair === undefined ? null : {
      first_completion_frame: repair.first_completion_frame,
      frames_spent: repair.frames_spent,
      restarts: repair.restarts,
      accepts: repair.accepts,
      gaps_touched: repair.gaps_touched,
      records: repair.records ?? null,
    },
  };
};

for (const id of ids) {
  for (const seed of seeds) {
    const row = observe(id, seed);
    forceGc?.();
    row.rss_bytes = process.memoryUsage().rss;
    rows.push(row);
    checkpoint();
    process.stderr.write(`  ${id}/s${seed}: ${row.valid ? "valid" : "invalid"} ${Number(row.score).toFixed(2)}\n`);
  }
}

checkpoint();
if (out === undefined) {
  process.stdout.write(`${JSON.stringify(result(), null, 2)}\n`);
} else {
  process.stdout.write(`wrote ${out}: ${rows.length}/${expectedRows} completed\n`);
}
