#!/usr/bin/env tsx
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { mkdirSync } from "node:fs";
import { compile } from "../v0/compile.ts";
import {
  GOLDEN_SPECS,
  loadGoldenSpec,
  type GoldenSpecName,
} from "../v0/golden_suite.ts";
import { scoreDriftReport } from "../v0/score.ts";

type BaselineRow = {
  compiler: "v0";
  spec: string;
  seed: number;
  elapsed_ms: number;
  contract_passed: boolean;
  score: number;
  axis_quality: number;
  hard_failures: string[];
  track_lines: number;
  stats: unknown;
};

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value] as const;
  }),
);

const specs = (args.get("specs") === undefined
  ? [...GOLDEN_SPECS]
  : args.get("specs")!.split(",").map((name) => name.trim()).filter(Boolean)) as GoldenSpecName[];
const seeds = (args.get("seeds") ?? "0,1,2")
  .split(",")
  .map((seed) => Number(seed.trim()));
const outPath = resolve(args.get("out") ?? "baselines/greedy_v1.json");

const rows: BaselineRow[] = [];
for (const specName of specs) {
  const spec = await loadGoldenSpec(specName, "base");
  const totalFrames = Math.round(spec.duration * 40);
  for (const seed of seeds) {
    const started = Date.now();
    const result = compile(spec, seed);
    const elapsed = Date.now() - started;
    const score = scoreDriftReport(result.report, { totalFrames });
    rows.push({
      compiler: "v0",
      spec: specName,
      seed,
      elapsed_ms: elapsed,
      contract_passed: score.contract_passed,
      score: score.score,
      axis_quality: score.axis_quality,
      hard_failures: score.hard_failures,
      track_lines: result.track.lines.length,
      stats: result.stats,
    });
    console.log(JSON.stringify(rows.at(-1)));
  }
}

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify({
  generated_at: new Date().toISOString(),
  rows,
}, null, 2)}\n`);
