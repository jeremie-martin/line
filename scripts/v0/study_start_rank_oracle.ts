/** Observation-only oracle over the start evaluator's already-sorted options. */
import { writeFileSync } from "node:fs";
import { scoreDriftReport } from "./score.ts";
import { GOLDEN_SPECS, loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { secToFrame } from "./types.ts";

const argv = process.argv.slice(2);
const argValue = (name: string): string | undefined =>
  argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const argFlag = (name: string): boolean => argv.includes(`--${name}`);
const defaults = [
  "drums_signature",
  "drums_pendulum",
  "dense_sprint",
  "syncopated_switchback",
  "opening_burst",
  "dense_echo_climb",
  "canyon_steps",
  "skyline_push",
  "pop_train",
  "float_bounds",
].join(",");
const specs = (argValue("specs") ?? defaults).split(",") as GoldenSpecName[];
const seeds = (argValue("seeds") ?? "0").split(",").map(Number);
const ranks = (argValue("ranks") ?? "0,1,2,3").split(",").map(Number);
const budget = Number(argValue("budget") ?? "200000");
const firstCompletion = argFlag("first-completion");
const polish = argFlag("polish");
const outPath = argValue("out");
for (const spec of specs) {
  if (!(GOLDEN_SPECS as readonly string[]).includes(spec)) throw new Error(`unknown spec "${spec}"`);
}

type Row = {
  spec: string;
  seed: number;
  rank: number;
  score: number;
  axisQuality: number;
  contractPassed: boolean;
  simFrames: number;
  firstCompletionFrame: number | null;
  finalStartRank: number;
};
const rows: Row[] = [];

for (const specName of specs) {
  const spec = await loadGoldenSpec(specName, "base");
  for (const seed of seeds) {
    for (const rank of ranks) {
      const started = Date.now();
      const checkpoint = compileHandoff(spec, seed, {
        budget,
        startOptionRank: rank,
        stopAfterFirstCompletion: firstCompletion,
        polish,
      });
      const score = scoreDriftReport(checkpoint.report, { totalFrames: secToFrame(spec.duration) });
      rows.push({
        spec: specName,
        seed,
        rank,
        score: score.score,
        axisQuality: score.axis_quality,
        contractPassed: score.contract_passed,
        simFrames: checkpoint.stats.sim_frames,
        firstCompletionFrame: checkpoint.stats.first_completion_frame ?? null,
        finalStartRank: checkpoint.stats.handoff_start_rank ?? -1,
      });
      console.error(
        `  ${specName}/s${seed}/r${rank}: ${score.score.toFixed(2)} ` +
          `${score.contract_passed ? "pass" : "fail"} ${((Date.now() - started) / 1000).toFixed(1)}s`,
      );
    }
  }
}

const groups = new Map<string, Row[]>();
for (const row of rows) {
  const key = `${row.spec}|${row.seed}`;
  const group = groups.get(key) ?? [];
  group.push(row);
  groups.set(key, group);
}
let baselineSum = 0;
let oracleSum = 0;
let nonzeroWins = 0;
for (const group of groups.values()) {
  const baseline = group.find((row) => row.rank === 0);
  if (baseline === undefined) continue;
  const best = group.reduce((winner, row) => row.score > winner.score ? row : winner);
  baselineSum += baseline.score;
  oracleSum += best.score;
  if (best.rank !== 0) nonzeroWins++;
}
const n = groups.size;
console.log(`\n=== isolated start-rank oracle (${n} spec/seed groups at ${budget}) ===`);
console.log(`rank0 mean ${(baselineSum / n).toFixed(2)}`);
console.log(`oracle mean ${(oracleSum / n).toFixed(2)} (lift ${((oracleSum - baselineSum) / n).toFixed(2)})`);
console.log(`nonzero-rank winners ${nonzeroWins}/${n}`);

if (outPath !== undefined) {
  writeFileSync(
    outPath,
    JSON.stringify({ budget, firstCompletion, polish, specs, seeds, ranks, rows }, null, 2) + "\n",
  );
  console.log(`rows -> ${outPath}`);
}
