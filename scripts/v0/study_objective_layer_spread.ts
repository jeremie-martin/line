/**
 * Which objective layer actually decides the candidate ranking?
 *
 * A ranker does not need FIDELITY, it needs SPREAD: a perfectly accurate signal
 * that is nearly constant across a candidate pool discriminates nothing. Sweep A
 * found that down-weighting readiness relative to projected outgoing quality
 * costs headline monotonically, which is the opposite of what the two layers'
 * prediction accuracies predict. This measures the mechanism directly.
 *
 * THE STATISTIC THAT MATTERS IS spread/level, NOT spread. `proposalUtility` is a
 * PRODUCT, so it orders candidates by the sum of logs, and a layer's weight in
 * that ordering is its exponent times the spread of its log — approximately
 * spread/level. Raw spread says projected and readiness are comparable;
 * normalized, readiness dominates, because it sits at a much lower level (0.06
 * to 0.33 against 0.46 to 0.72). An exponent IS a log-domain weight, which is
 * why halving readiness's exponent removes the ordering's largest single term.
 *
 * Reads `snapshotObjectiveLayerSpread`, which the compiler already accumulates
 * under LR_AIM_STUDY_STATS=1. No new instrumentation.
 *
 * Usage:
 *   npm run study:layer-spread
 *   npm run study:layer-spread -- --specs=split_signal,dense_dialogue --budget=250000
 */
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { applyJolt } from "../produce/seed.ts";
import { compileHandoff } from "./optimizer/handoff.ts";
import { snapshotObjectiveLayerSpread } from "./optimizer/aim.ts";

const argv = process.argv.slice(2);
const argument = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);

process.env.LR_AIM_STUDY_STATS = "1";

const budget = Number(argument("budget") ?? "250000");
const seed = Number(argument("seed") ?? "0");
const requested = argument("specs")?.split(",").map((value) => value.trim())
  .filter(Boolean);
const defaults = [
  "river_reentry",
  "countercurrent",
  "split_signal",
  "dense_dialogue",
  "high_air_drive",
  "meter_exchange",
];
const wanted = new Set(requested ?? defaults);
const cases = developmentCases
  .filter((entry) => wanted.has(entry.case.metadata.id));
if (cases.length === 0) throw new Error(`no development cases matched --specs`);

console.log(`budget ${budget} seed ${seed}\n`);
console.log(
  `${"spec".padEnd(24)}${"pools".padStart(6)}` +
    `${"| level: set".padStart(14)}${"proj".padStart(7)}${"read".padStart(7)}` +
    `${"| log-weight: set".padStart(19)}${"proj".padStart(7)}${"read".padStart(7)}` +
    `${"read/proj".padStart(11)}`,
);

const ratios: number[] = [];
for (const entry of cases) {
  const spec = applyJolt(entry.case.spec, benchmarkPolicy.transform.joltMs);
  compileHandoff(spec, seed, { budget });
  const spread = snapshotObjectiveLayerSpread();
  if (spread === null) {
    console.log(`${entry.case.metadata.id.padEnd(26)}${"(no pools)".padStart(7)}`);
    continue;
  }
  const logWeight = (spreadMean: number, levelMean: number) =>
    levelMean <= 0 ? NaN : spreadMean / levelMean;
  const settledWeight = logWeight(
    spread.settled_spread_mean,
    spread.settled_level_mean,
  );
  const projectedWeight = logWeight(
    spread.projected_spread_mean,
    spread.projected_level_mean,
  );
  const readinessWeight = logWeight(
    spread.readiness_spread_mean,
    spread.readiness_level_mean,
  );
  const ratio = readinessWeight / projectedWeight;
  if (Number.isFinite(ratio)) ratios.push(ratio);
  console.log(
    entry.case.metadata.id.padEnd(24) +
      String(spread.pools).padStart(6) +
      spread.settled_level_mean.toFixed(3).padStart(14) +
      spread.projected_level_mean.toFixed(3).padStart(7) +
      spread.readiness_level_mean.toFixed(3).padStart(7) +
      settledWeight.toFixed(2).padStart(19) +
      projectedWeight.toFixed(2).padStart(7) +
      readinessWeight.toFixed(2).padStart(7) +
      ratio.toFixed(2).padStart(11),
  );
}

if (ratios.length > 0) {
  const mean = ratios.reduce((sum, value) => sum + value, 0) / ratios.length;
  console.log(
    `\nmean readiness/projected log-domain weight: ${mean.toFixed(2)}x` +
      `\n(>1 means readiness carries MORE of the candidate ordering than the` +
      ` projected term does, at equal exponents)`,
  );
}
