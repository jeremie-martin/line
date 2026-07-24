/**
 * Compare the objective's prior-fit ballistic next-elevation prediction with
 * achieved elevation on the final incumbent's following gap.
 *
 *   LR_ENGINE=wasm npx tsx scripts/v0/study_next_elevation_prediction.ts \
 *     --specs=dense_echo_climb,skyline_push,canyon_steps --seeds=0 --budget=200000 \
 *     --out=generated/studies/next-elevation-prediction.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { K_BOUNCE_LANDING } from "../lib/detector.ts";
import { loadGoldenSpec, type GoldenSpecName } from "./golden_suite.ts";
import { sliceTimeline, type GapFit } from "./core/substrate.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { predictArrivalAtNextContact } from "./optimizer/objective.ts";
import { secToFrame } from "./types.ts";

type Row = {
  spec: string;
  seed: number;
  gap: number;
  gapFraction: number;
  target: number;
  nextAir: number;
  predicted: number;
  achieved: number;
  predictionError: number;
  scoredError: number;
};

const argv = process.argv.slice(2);
function arg(name: string): string | undefined {
  const prefix = `--${name}=`;
  return argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

function mean(values: readonly number[]): number | null {
  return values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function metrics(rows: readonly Row[]): unknown {
  const xs = rows.map((row) => row.predicted);
  const ys = rows.map((row) => row.achieved);
  const errors = rows.map((row) => row.predictionError);
  const fullGapPredictions = rows.map((row) => 0.5 + row.nextAir * (row.predicted - 0.5));
  const fullGapErrors = fullGapPredictions.map((predicted, index) => predicted - ys[index]);
  const xMean = mean(xs) ?? 0;
  const yMean = mean(ys) ?? 0;
  let covariance = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (let index = 0; index < rows.length; index++) {
    const dx = xs[index] - xMean;
    const dy = ys[index] - yMean;
    covariance += dx * dy;
    xVariance += dx * dx;
    yVariance += dy * dy;
  }
  const slope = xVariance > 0 ? covariance / xVariance : null;
  const intercept = slope === null ? null : yMean - slope * xMean;
  return {
    rows: rows.length,
    target_mean: round(mean(rows.map((row) => row.target))),
    next_air_mean: round(mean(rows.map((row) => row.nextAir))),
    predicted_mean: round(mean(xs)),
    achieved_mean: round(mean(ys)),
    prediction_bias: round(mean(errors)),
    prediction_mae: round(mean(errors.map(Math.abs))),
    prediction_rmse: rows.length > 0
      ? round(Math.sqrt(errors.reduce((sum, error) => sum + error * error, 0) / rows.length))
      : null,
    full_gap_normalized: {
      predicted_mean: round(mean(fullGapPredictions)),
      bias: round(mean(fullGapErrors)),
      mae: round(mean(fullGapErrors.map(Math.abs))),
      rmse: rows.length > 0
        ? round(Math.sqrt(fullGapErrors.reduce((sum, error) => sum + error * error, 0) / rows.length))
        : null,
    },
    target_mae: round(mean(rows.map((row) => Math.abs(row.achieved - row.target)))),
    neutral_050_mae: round(mean(rows.map((row) => Math.abs(row.achieved - 0.5)))),
    correlation: xVariance > 0 && yVariance > 0
      ? round(covariance / Math.sqrt(xVariance * yVariance))
      : null,
    linear_actual_from_prediction: {
      intercept: round(intercept),
      slope: round(slope),
    },
  };
}

function round(value: number | null, digits = 5): number | null {
  if (value === null || !Number.isFinite(value)) return null;
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

const specNames = (arg("specs") ?? [
  "canyon_steps", "skyline_push", "dense_echo_climb", "switchback_pop",
  "syncopated_lift", "glide_stairs", "ridge_pulse", "rolling_drop",
  "terrace_sprint", "valley_bounce",
].join(",")).split(",").filter(Boolean) as GoldenSpecName[];
const seeds = (arg("seeds") ?? "0").split(",").filter(Boolean).map(Number);
const budget = Number(arg("budget") ?? 200_000);
const outPath = resolve(arg("out") ?? "generated/studies/next-elevation-prediction.json");
const rows: Row[] = [];

for (const specName of specNames) {
  const sourceSpec = await loadGoldenSpec(specName, "base");
  const feasibleContacts = sourceSpec.contacts.filter((contact) => secToFrame(contact.t) >= K_BOUNCE_LANDING);
  const spec = { ...sourceSpec, preroll: undefined, contacts: feasibleContacts };
  const contactFrames = feasibleContacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(contactFrames, secToFrame(spec.duration));

  for (const seed of seeds) {
    let incumbentFits: Array<GapFit | null> | null = null;
    const checkpoint = compileHandoff(sourceSpec, seed, {
      budget,
      onNode: (node: HandoffNode, _key, event) => {
        if (event.fullDuration && event.improved) incumbentFits = [...node.search.prefixFits];
      },
    });
    if (incumbentFits === null) continue;
    const fits: Array<GapFit | null> = incumbentFits;
    const reports = new Map(checkpoint.report.gaps.map((report) => [report.gap_index, report]));
    for (let gapIndex = 1; gapIndex < gaps.length; gapIndex++) {
      const report = reports.get(gapIndex);
      const elevation = report?.axes.elevation;
      const priorFit = fits[gapIndex - 1];
      if (elevation === undefined || priorFit === null || priorFit === undefined) continue;
      const arrival = predictArrivalAtNextContact(priorFit, gaps[gapIndex]);
      const predicted = arrival?.elevation;
      if (predicted === undefined || !Number.isFinite(predicted) || arrival.airFraction === undefined) continue;
      rows.push({
        spec: specName,
        seed,
        gap: gapIndex,
        gapFraction: gapIndex / Math.max(1, gaps.length - 1),
        target: elevation.target,
        nextAir: arrival.airFraction,
        predicted,
        achieved: elevation.achieved,
        predictionError: predicted - elevation.achieved,
        scoredError: elevation.achieved - elevation.target,
      });
    }
    process.stderr.write(`${specName} seed=${seed} rows=${rows.length}\n`);
  }
}

const targetBins = [0, 0.4, 0.5, 0.6, 1].slice(0, -1).map((lo, index) => {
  const hi = [0, 0.4, 0.5, 0.6, 1][index + 1];
  return { lo, hi, metrics: metrics(rows.filter((row) => row.target >= lo && row.target < hi)) };
});
const thirds = [
  { name: "early", lo: 0, hi: 1 / 3 },
  { name: "middle", lo: 1 / 3, hi: 2 / 3 },
  { name: "late", lo: 2 / 3, hi: 1.000001 },
].map((bin) => ({
  name: bin.name,
  metrics: metrics(rows.filter((row) => row.gapFraction >= bin.lo && row.gapFraction < bin.hi)),
}));
const bySpec = Object.fromEntries(specNames.map((spec) => [
  spec,
  metrics(rows.filter((row) => row.spec === spec)),
]));
const result = {
  config: { specs: specNames, seeds, budget },
  overall: metrics(rows),
  target_bins: targetBins,
  thirds,
  by_spec: bySpec,
  rows,
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({
  config: result.config,
  overall: result.overall,
  target_bins: result.target_bins,
  thirds: result.thirds,
  by_spec: result.by_spec,
}, null, 2));
