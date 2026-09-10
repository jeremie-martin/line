/**
 * V2-panel impact pool-coverage probe (observation only, outside the compiler
 * identity boundary).
 *
 * For every handoff pool visit at a gap whose current targets include impact,
 * records how close the sampled pool (all quality-sorted candidates) and the
 * admitted pool (top HANDOFF_CANDIDATE_POOL by quality) come to the authored
 * impact ask. Separates "the sampler never produced the geometry" from "the
 * quality sort refused it" without touching production behavior.
 *
 *   LR_ENGINE=wasm node --import tsx scripts/v0/study_impact_pool_coverage_v2.ts \
 *     [--cases=...] [--seeds=...] [--budget=N] [--out=FILE]
 */
import { writeFileSync } from "node:fs";
import believer from "../../benchmark/v2/cases/normative/development_music/believer_56_6s.ts";
import denseDialogue from "../../benchmark/v2/cases/normative/representative/dense_dialogue.ts";
import splitSignal from "../../benchmark/v2/cases/normative/representative/split_signal.ts";
import loosePocket from "../../benchmark/v2/cases/normative/representative/loose_pocket.ts";
import frontier5 from "../../benchmark/v2/cases/normative/capability/frontier_low_air_endurance.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import {
  compileLegacyHandoff,
  setHandoffPoolProbeHook,
  type HandoffPoolProbeRecord,
} from "./optimizer/legacy_handoff.ts";
import { type Spec } from "./types.ts";

const catalog: Record<string, Spec> = {
  dense_dialogue: denseDialogue,
  split_signal: splitSignal,
  loose_pocket: loosePocket,
  frontier5,
  believer,
};

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const names = (arg("cases") ?? Object.keys(catalog).join(",")).split(",").filter(Boolean);
const seeds = (arg("seeds") ?? "24").split(",").map(Number);
const budget = Number(arg("budget") ?? "500000");
const out = arg("out");
const ADMIT = 8; // HANDOFF_CANDIDATE_POOL

type CandidateFactors = {
  impact: number | null;
  qualityRank: number;
  currentQuality: number | null;
  readiness: number | null;
  qualityObjective: number | null;
  speedFit: number | null;
  catchability: number | null;
  impactFeasibility: number | null;
  releaseSpeed: number | null;
  cost: number | null;
};

type VisitRow = {
  name: string;
  seed: number;
  gapIndex: number;
  target: number;
  entrySpeed: number;
  poolSize: number;
  // achieved impact of the quality-sort winner (rank 0)
  winner: number | null;
  // closest-to-target achieved impact anywhere in the sampled pool
  bestAll: number | null;
  // closest-to-target achieved impact within the admitted top-8
  bestAdmitted: number | null;
  // highest achieved impact anywhere (upper reach)
  maxAll: number | null;
  winnerFactors: CandidateFactors | null;
  bestAllFactors: CandidateFactors | null;
  // recovery reach: the pool's maximum candidate releaseSpeed (can the pool
  // accelerate out of a slow state?) and that candidate's factors
  maxReleaseSpeed: number | null;
  maxReleaseFactors: CandidateFactors | null;
};

const visits: VisitRow[] = [];
let active: { name: string; seed: number } = { name: "", seed: 0 };

setHandoffPoolProbeHook((record: HandoffPoolProbeRecord) => {
  const target = record.targets.impact;
  if (target === undefined) return;
  const values = record.candidates.map((candidate) => {
    const axes = candidate.achieved;
    return axes.impact ?? null;
  });
  const defined = values.filter((value): value is number => value !== null);
  if (defined.length === 0) return;
  const closest = (pool: number[]): number | null => pool.length === 0
    ? null
    : pool.reduce((best, value) =>
      Math.abs(value - target) < Math.abs(best - target) ? value : best);
  const admitted = values.slice(0, ADMIT).filter((value): value is number => value !== null);
  const bestAll = closest(defined);
  const factors = (index: number): CandidateFactors | null => {
    const candidate = record.candidates[index];
    if (candidate === undefined) return null;
    const round3 = (value: number | null | undefined): number | null =>
      value === null || value === undefined ? null : Number(value.toFixed(4));
    return {
      impact: values[index],
      qualityRank: candidate.qualityRank,
      currentQuality: round3(candidate.currentQuality),
      readiness: round3(candidate.readiness),
      qualityObjective: round3(candidate.qualityObjective),
      speedFit: round3(candidate.speedFit),
      catchability: round3(candidate.catchability),
      impactFeasibility: round3(candidate.impactFeasibility),
      releaseSpeed: round3(candidate.releaseSpeed),
      cost: round3(candidate.cost),
    };
  };
  const bestAllIndex = bestAll === null
    ? -1
    : values.findIndex((value) => value !== null &&
      Math.abs(value - target) === Math.abs(bestAll - target));
  visits.push({
    name: active.name,
    seed: active.seed,
    gapIndex: record.gapIndex,
    target,
    entrySpeed: Number(record.entrySpeed.toFixed(3)),
    poolSize: defined.length,
    winner: values[0],
    bestAll,
    bestAdmitted: closest(admitted),
    maxAll: Math.max(...defined),
    winnerFactors: factors(0),
    bestAllFactors: bestAllIndex < 0 ? null : factors(bestAllIndex),
    ...(() => {
      let maxIdx = -1;
      for (let i = 0; i < record.candidates.length; i++) {
        const v = record.candidates[i].releaseSpeed;
        if (v === null || v === undefined) continue;
        if (maxIdx < 0 || v > (record.candidates[maxIdx].releaseSpeed ?? -Infinity)) maxIdx = i;
      }
      return {
        maxReleaseSpeed: maxIdx < 0
          ? null
          : Number((record.candidates[maxIdx].releaseSpeed as number).toFixed(3)),
        maxReleaseFactors: maxIdx < 0 ? null : factors(maxIdx),
      };
    })(),
  });
});

try {
  for (const name of names) {
    const source = catalog[name];
    if (source === undefined) throw new Error(`unknown case ${name}`);
    for (const seed of seeds) {
      active = { name, seed };
      const spec = applyJolt(source, benchmarkPolicy.transform.joltMs);
      compileLegacyHandoff(spec, seed, { budget });
      process.stderr.write(`${name} seed=${seed}: visits so far ${visits.length}\n`);
    }
  }
} finally {
  setHandoffPoolProbeHook(null);
}

const output = {
  schema: "line.study-impact-pool-coverage-v2.v1",
  joltMs: benchmarkPolicy.transform.joltMs,
  budget,
  seeds,
  visits,
};
if (out !== undefined) writeFileSync(out, `${JSON.stringify(output)}\n`);
process.stdout.write(`${visits.length} visits recorded\n`);
