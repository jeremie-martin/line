/**
 * V2-native observation panel for the completion-triggered repair phase.
 *
 * This does not alter search or replay. It records V4 repair decisions and
 * outcomes so controller work is based on exact current semantics.
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
if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error("--budget must be a positive integer");
if (seeds.some((seed) => !Number.isSafeInteger(seed))) throw new Error("--seeds must be safe integers");

const cases = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case.spec] as const));
for (const id of ids) if (!cases.has(id)) throw new Error(`unknown V2 development case ${id}`);

const rows: Array<Record<string, unknown>> = [];
const expectedRows = ids.length * seeds.length;
const forceGc = (globalThis as typeof globalThis & { gc?: () => void }).gc;

const result = () => ({
  schema: "line.study-v2-repair-diagnostics.v2",
  note: "Observation only. Repair data comes exclusively from budget telemetry V5.",
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
  const checkpoint = compileHandoff(spec, seed, { budget, budgetTelemetry: "summary" });
  const score = scoreDriftReport(checkpoint.report, { totalFrames: Math.round(spec.duration * FPS) });
  const repairEpisodes = checkpoint.budgetTelemetry?.episodes.filter((episode) =>
    episode.lane === "repair"
  ) ?? [];
  return {
    id,
    seed,
    valid: score.contract_passed,
    score: Number(score.score.toFixed(4)),
    elapsed_ms: Math.round(performance.now() - started),
    sim_frames: checkpoint.stats.sim_frames,
    first_completion_frame: checkpoint.stats.first_completion_frame ?? null,
    repair: {
      frames_spent: repairEpisodes.reduce(
        (sum, episode) => sum + (episode.outcome.spent_frames ?? 0),
        0,
      ),
      iterations: repairEpisodes.length,
      terminals_reached: repairEpisodes.filter((episode) => episode.outcome.terminal_reached).length,
      accepted_alternatives: repairEpisodes.filter((episode) =>
        episode.outcome.accepted_alternative
      ).length,
      episodes: repairEpisodes.map((episode) => ({
        decision: episode.repair_decision,
        work: episode.work,
        outcome: episode.outcome,
      })),
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
