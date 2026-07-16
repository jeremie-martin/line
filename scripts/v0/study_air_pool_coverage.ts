/**
 * V2-panel AIR pool-coverage probe (observation only, outside the compiler
 * identity boundary). For every handoff pool visit at a gap with an authored
 * air target, records how close the sampled pool and the admitted top-8 come
 * to the ask, plus the quality-sort winner — locating the mid-ask air
 * OVERSHOOT (canonical +0.02..+0.11 bias at asks 0.3-0.7) as generation vs
 * admission vs selection.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_air_pool_coverage.ts \
 *     [--cases=...] [--seeds=...] [--budget=N] [--out=FILE]
 */
import { writeFileSync } from "node:fs";
import riverReentry from "../../benchmark/v2/cases/normative/representative/river_reentry.ts";
import loosePocket from "../../benchmark/v2/cases/normative/representative/loose_pocket.ts";
import highAirDrive from "../../benchmark/v2/cases/normative/representative/high_air_drive.ts";
import splitSignal from "../../benchmark/v2/cases/normative/representative/split_signal.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  compileHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeRecord,
} from "./optimizer/handoff.ts";
import { type Spec } from "./types.ts";

const catalog: Record<string, Spec> = {
  river_reentry: riverReentry,
  loose_pocket: loosePocket,
  high_air_drive: highAirDrive,
  split_signal: splitSignal,
};

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const names = (arg("cases") ?? Object.keys(catalog).join(",")).split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "24").split(",").map(Number);
const budget = Number(arg("budget") ?? "500000");
const out = arg("out");
const ADMIT = 8;

type VisitRow = {
  name: string;
  seed: number;
  gapIndex: number;
  target: number;
  poolSize: number;
  winner: number | null;
  bestAll: number | null;
  bestAdmitted: number | null;
  minAll: number | null;
};

const visits: VisitRow[] = [];
let active = { name: "", seed: 0 };

setHandoffPoolProbeHook((record: HandoffPoolProbeRecord) => {
  const target = record.targets.air;
  if (target === undefined) return;
  const values = record.candidates.map((candidate) =>
    (candidate.achievedAtEnd ?? candidate.achieved).air ?? null
  );
  const defined = values.filter((value): value is number => value !== null);
  if (defined.length === 0) return;
  const closest = (pool: number[]): number | null => pool.length === 0
    ? null
    : pool.reduce((best, value) =>
      Math.abs(value - target) < Math.abs(best - target) ? value : best);
  const admitted = values.slice(0, ADMIT).filter((value): value is number => value !== null);
  visits.push({
    name: active.name,
    seed: active.seed,
    gapIndex: record.gapIndex,
    target,
    poolSize: defined.length,
    winner: values[0],
    bestAll: closest(defined),
    bestAdmitted: closest(admitted),
    minAll: Math.min(...defined),
  });
});

try {
  for (const name of names) {
    const source = catalog[name];
    if (source === undefined) throw new Error(`unknown case ${name}`);
    for (const seed of seeds) {
      active = { name, seed };
      compileHandoff(applyJolt(source, benchmarkPolicy.transform.joltMs), seed, { budget });
      process.stderr.write(`${name} seed=${seed}: visits ${visits.length}\n`);
    }
  }
} finally {
  setHandoffPoolProbeHook(null);
}

const output = {
  schema: "line.study-air-pool-coverage.v1",
  joltMs: benchmarkPolicy.transform.joltMs,
  budget,
  seeds,
  visits,
};
if (out !== undefined) writeFileSync(out, `${JSON.stringify(output)}\n`);
process.stdout.write(`${visits.length} visits recorded\n`);
