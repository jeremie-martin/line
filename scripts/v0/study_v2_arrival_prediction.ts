/**
 * V2-native observation of the zero-frame ballistic next-contact predictor.
 *
 * This does not fit or alter a model. It compares every usable release-state
 * prediction on the final incumbent path with the following gap's achieved
 * axes, then reports calibrated error and correlation by axis. The selected
 * path is deliberately used only as an observational sample: a result cannot
 * justify a ranking change without a separate candidate-level outcome study.
 *
 * LR_ENGINE=wasm npx tsx scripts/v0/study_v2_arrival_prediction.ts \
 *   --cases=frontier_dense_recovery,frontier_pickup_progression,countercurrent \
 *   --seeds=24 --budget=500000 --out=generated/studies/v2-arrival-prediction.json
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { benchmarkPolicy } from "../../benchmark/v2/policy.ts";
import { makeRng } from "../lib/rng.ts";
import { applyJolt } from "../produce/seed.ts";
import { effectiveAxes, sampleGapTargets, sliceTimeline, type GapFit } from "./core/substrate.ts";
import { compileHandoff, type HandoffNode } from "./optimizer/handoff.ts";
import { predictArrivalAtNextContact } from "./optimizer/objective.ts";
import { scoreDriftReport } from "./score.ts";
import { authoredSpeedToPx, CALIB, FPS, secToFrame, type AxisValues, type Gap, type Spec } from "./types.ts";

type Axis = "speed" | "air" | "elevation";
type Row = {
  caseId: string;
  seed: number;
  gap: number;
  axis: Axis;
  predicted: number;
  achieved: number;
  target: number;
};

const argv = process.argv.slice(2);
const arg = (name: string): string | undefined =>
  argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const caseArg = arg("cases");
const seeds = (arg("seeds") ?? "24").split(",").filter(Boolean).map(Number);
const budget = Number(arg("budget") ?? "500000");
const outPath = arg("out");
const includeRows = arg("rows") === "1";
if (!Number.isSafeInteger(budget) || budget <= 0) throw new Error(`invalid --budget=${budget}`);
if (seeds.some((seed) => !Number.isSafeInteger(seed))) throw new Error("--seeds must be integers");

const byId = new Map(developmentCases.map((entry) => [entry.case.metadata.id, entry.case]));
const requestedIds = (caseArg ?? [
  "frontier_dense_recovery",
  "frontier_dense_recovery_240ms_figures",
  "frontier_pickup_progression",
  "frontier_pickup_progression_shifted",
  "frontier_low_air_endurance",
  "frontier_low_air_endurance_7s",
  "countercurrent",
  "believer_56_6s",
].join(",")).split(",").filter(Boolean);
const cases = requestedIds.map((id) => {
  const definition = byId.get(id);
  if (definition === undefined) throw new Error(`unknown development case ${id}`);
  return definition;
});

const rows: Row[] = [];
const runs: Array<{
  caseId: string;
  seed: number;
  valid: boolean;
  score: number;
  completedPath: boolean;
  usablePredictions: number;
  elapsedMs: number;
}> = [];

for (const definition of cases) {
  for (const seed of seeds) {
    const spec = applyJolt(definition.spec, benchmarkPolicy.transform.joltMs);
    let best: HandoffNode | null = null;
    const started = performance.now();
    const checkpoint = compileHandoff(spec, seed, {
      budget,
      onNode(node, _key, event) {
        if (event.improved) best = node;
      },
    });
    const setup = buildSetup(spec, seed);
    const score = scoreDriftReport(checkpoint.report, { totalFrames: setup.durationFrames });
    const completedPath = best !== null && setup.gaps
      .filter((gap) => gap.endsWithContact)
      .every((gap) => best.search.prefixFits[gap.index] !== null && best.search.prefixFits[gap.index] !== undefined);
    let usablePredictions = 0;
    if (best !== null) {
      for (let index = 0; index + 1 < setup.gaps.length; index++) {
        const gap = setup.gaps[index];
        const next = setup.gaps[index + 1];
        if (!gap.endsWithContact || !next.endsWithContact) continue;
        const fit = best.search.prefixFits[index];
        const nextFit = best.search.prefixFits[index + 1];
        if (fit === null || fit === undefined || nextFit === null || nextFit === undefined) continue;
        const arrival = predictArrivalAtNextContact(fit, next);
        if (arrival === null) continue;
        const achieved = nextFit.achieved;
        const target = setup.gapAxisTargets[next.index];
        const observations: Array<[Axis, number | undefined, number | undefined, number | undefined]> = [
          ["speed", arrival.meanSpeedPx, achieved.speed === undefined ? undefined : authoredSpeedToPx(achieved.speed),
            target.speed === undefined ? undefined : authoredSpeedToPx(target.speed)],
          ["air", arrival.airFraction, achieved.air, target.air],
          ["elevation", arrival.elevation, achieved.elevation, target.elevation],
        ];
        for (const [axis, predicted, actual, authoredTarget] of observations) {
          // Keep the observation contract aligned with the scorer: an axis that
          // the author did not specify is not evidence for a prediction policy.
          if (!Number.isFinite(predicted) || !Number.isFinite(actual) || !Number.isFinite(authoredTarget)) continue;
          usablePredictions++;
          rows.push({
            caseId: definition.metadata.id,
            seed,
            gap: next.index,
            axis,
            predicted: round(predicted!),
            achieved: round(actual!),
            target: round(authoredTarget!),
          });
        }
      }
    }
    runs.push({
      caseId: definition.metadata.id,
      seed,
      valid: score.contract_passed,
      score: round(score.score),
      completedPath,
      usablePredictions,
      elapsedMs: Math.round(performance.now() - started),
    });
    process.stderr.write(`${definition.metadata.id} seed=${seed} valid=${score.contract_passed} rows=${usablePredictions}\n`);
    // Handoff studies retain substantial WASM/trajectory state until a GC pass.
    // This observer intentionally spans multiple full compiles, so release it
    // between independent rows rather than turning a diagnostic into an OOM.
    (globalThis as { gc?: () => void }).gc?.();
  }
}

const result = {
  schema: "line.study-v2-arrival-prediction.v1",
  config: { caseIds: requestedIds, seeds, budget },
  runs,
  overall: { rows: rows.length },
  byAxis: Object.fromEntries((["speed", "air", "elevation"] as const).map((axis) => [
    axis,
    summarize(rows.filter((row) => row.axis === axis)),
  ])),
  byCase: Object.fromEntries(requestedIds.map((caseId) => {
    const caseRows = rows.filter((row) => row.caseId === caseId);
    return [caseId, {
      rows: caseRows.length,
      byAxis: Object.fromEntries((["speed", "air", "elevation"] as const).map((axis) => [
        axis,
        summarize(caseRows.filter((row) => row.axis === axis)),
      ])),
    }];
  })),
  ...(includeRows ? { rows } : {}),
};
const json = `${JSON.stringify(result, null, 2)}\n`;
if (outPath === undefined) process.stdout.write(json);
else {
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, json);
  process.stdout.write(`${JSON.stringify({ ...result, rows: undefined }, null, 2)}\n`);
}

function buildSetup(userSpec: Spec, seed: number): { gaps: Gap[]; gapAxisTargets: AxisValues[]; durationFrames: number } {
  const spec: Spec = {
    ...userSpec,
    preroll: undefined,
    contacts: userSpec.contacts.filter((contact) => secToFrame(contact.t) >= 5),
  };
  const durationFrames = secToFrame(spec.duration);
  const contactFrames = spec.contacts.map((contact) => secToFrame(contact.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(contactFrames, durationFrames);
  const gapAxisTargets = gaps.map((gap) => effectiveAxes(gap, spec));
  const rng = makeRng(seed);
  for (const gap of gaps) gap.targets = sampleGapTargets(gapAxisTargets[gap.index], spec.jitter ?? CALIB.SIGMA, rng);
  const impactByFrame = new Map(spec.contacts.flatMap((contact) =>
    contact.impact === undefined ? [] : [[secToFrame(contact.t), contact.impact] as const],
  ));
  for (const gap of gaps) {
    const impact = impactByFrame.get(gap.endFrame);
    if (gap.endsWithContact && impact !== undefined) {
      gap.targets.impact = impact;
      gapAxisTargets[gap.index].impact = impact;
    }
  }
  return { gaps, gapAxisTargets, durationFrames };
}

function summarize(input: readonly Row[]): unknown {
  if (input.length === 0) return { rows: 0, correlation: null, mae: null, rmse: null, targetMae: null, targetRmse: null, predictorBeatsTarget: null };
  const errors = input.map((row) => row.predicted - row.achieved);
  const targetRows = input;
  const targetErrors = targetRows.map((row) => row.target - row.achieved);
  const xMean = mean(input.map((row) => row.predicted));
  const yMean = mean(input.map((row) => row.achieved));
  let covariance = 0;
  let xVariance = 0;
  let yVariance = 0;
  for (const row of input) {
    const dx = row.predicted - xMean;
    const dy = row.achieved - yMean;
    covariance += dx * dy;
    xVariance += dx * dx;
    yVariance += dy * dy;
  }
  return {
    rows: input.length,
    bias: round(mean(errors)),
    mae: round(mean(errors.map(Math.abs))),
    rmse: round(Math.sqrt(mean(errors.map((error) => error * error)))),
    correlation: xVariance > 0 && yVariance > 0 ? round(covariance / Math.sqrt(xVariance * yVariance)) : null,
    targetMae: round(mean(targetErrors.map(Math.abs))),
    targetRmse: round(Math.sqrt(mean(targetErrors.map((error) => error * error)))),
    predictorBeatsTarget: round(
      targetRows.filter((row) => Math.abs(row.predicted - row.achieved) < Math.abs(row.target - row.achieved)).length /
        targetRows.length,
    ),
  };
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function round(value: number): number {
  return Math.round(value * 1000000) / 1000000;
}
