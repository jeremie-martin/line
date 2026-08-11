/**
 * What is the accepted headline actually made of, and what is a point worth?
 *
 * `v2HeadlineForDecisionRuns` is the exact aggregation the benchmark promotes
 * on, so replaying a retained archive through it reproduces the published
 * canonical headline. That makes it a pricing instrument: mutate one property
 * of the run set, re-aggregate, and read the headline difference in the same
 * units the campaign is judged in — with zero compiles.
 *
 * The counterfactuals here are deliberately upper bounds, not proposals. They
 * say where a mechanism would have to bite to be worth its risk.
 *
 *   npm exec tsx scripts/v0/study_headline_counterfactual.ts -- \
 *     --archive=benchmark/v2/runs/segment-refine-development.json.gz \
 *     --budgets=750000
 */
import { gunzipSync } from "node:zlib";
import { readFileSync } from "node:fs";
import { v2HeadlineForDecisionRuns, type DecisionRun } from "./benchmark_v2/decision_model.ts";
import { loadSuiteManifest } from "./benchmark_v2/suite_model.ts";
import { loadSourceManifest, resolveSources } from "./benchmark_v2/model.ts";

function argument(argv: string[], name: string): string | undefined {
  return argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

type Row = DecisionRun & { rms: number; components: Record<string, { rmsError: number; weight: number }> };

function load(path: string): { rows: Row[]; canonical: number } {
  const raw = path.endsWith(".gz")
    ? gunzipSync(readFileSync(path)).toString("utf8")
    : readFileSync(path, "utf8");
  const archive = JSON.parse(raw);
  const rows: Row[] = archive.runs.map((row: any) => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: { score: row.score.score, valid: row.score.valid },
    rms: row.score.weightedAxisRms ?? NaN,
    components: row.score.components ?? {},
  }));
  return { rows, canonical: archive.canonicalHeadline };
}

const argv = process.argv.slice(2);
const archivePath = argument(argv, "archive") ??
  "benchmark/v2/runs/segment-refine-development.json.gz";
const suitePath = argument(argv, "suite") ?? "benchmark/v2/compat/suite-manifest.json";
const manifestPath = argument(argv, "manifest") ?? "benchmark/v2/compat/source-manifest.json";

const loaded = load(archivePath);
const requestedBudgets = argument(argv, "budgets")
  ?.split(",")
  .map(Number)
  .filter((budget) => Number.isSafeInteger(budget) && budget > 0);
const rows = requestedBudgets === undefined
  ? loaded.rows
  : loaded.rows.filter((row) => requestedBudgets.includes(row.budget));
if (rows.length === 0) throw new Error(`no archive rows match the requested budgets`);
const loadedSuite = loadSuiteManifest(suitePath, resolveSources(loadSourceManifest(manifestPath)));
const availableBudgets = [...new Set(rows.map((row) => row.budget))].sort((a, b) => a - b);
const seedDepths = availableBudgets.map((budget) =>
  new Set(rows.filter((row) => row.budget === budget).map((row) => row.seedSlot)).size
);
if (new Set(seedDepths).size !== 1) {
  throw new Error(`selected budgets do not share one seed depth`);
}
const availableSeeds = seedDepths[0];
const suite = {
  ...loadedSuite,
  profiles: {
    ...loadedSuite.profiles,
    canonical: {
      ...loadedSuite.profiles.canonical,
      budgets: availableBudgets,
      seeds_per_budget: availableSeeds,
    },
  },
};
const canonical = requestedBudgets === undefined ? loaded.canonical : null;

const headline = (mutate: (row: Row) => { score: number; valid: boolean }): number =>
  v2HeadlineForDecisionRuns(
    rows.map((row) => ({ ...row, score: mutate(row) })),
    suite,
    "canonical",
  );

const base = headline((row) => row.score);
console.log(`archive          ${archivePath}`);
console.log(`budgets          ${availableBudgets.join(",")}`);
console.log(`canonical        ${canonical === null ? "(projected scope)" : canonical.toFixed(4)}`);
console.log(`replayed         ${base.toFixed(4)}   (must match)`);
console.log(`valid            ${rows.filter((r) => r.score.valid).length}/${rows.length}`);

/** Score from a weighted axis rms, the evaluator's own map. */
const scoreFromRms = (rms: number): number => 1000 * Math.exp(-rms / 0.25);

const headlineWithAxisFactors = (factors: Readonly<Record<string, number>>): number =>
  headline((row) => {
    if (!row.score.valid) return row.score;
    let sum = 0;
    let weight = 0;
    for (const [name, component] of Object.entries(row.components)) {
      const rms = component.rmsError * (factors[name] ?? 1);
      sum += component.weight * rms * rms;
      weight += component.weight;
    }
    return { score: scoreFromRms(Math.sqrt(sum / weight)), valid: true };
  });

const key = (row: Row): string => `${row.sourceId}|${row.budget}`;
const byCell = new Map<string, Row[]>();
for (const row of rows) {
  const list = byCell.get(key(row)) ?? [];
  list.push(row);
  byCell.set(key(row), list);
}

console.log(`\n== what the seed spread costs ==`);
const bestOf = new Map<string, number>();
const meanOf = new Map<string, number>();
for (const [cell, list] of byCell) {
  const valid = list.filter((r) => r.score.valid);
  bestOf.set(cell, valid.length === 0 ? 0 : Math.max(...valid.map((r) => r.score.score)));
  meanOf.set(
    cell,
    valid.length === 0 ? 0 : valid.reduce((sum, r) => sum + r.score.score, 0) / valid.length,
  );
}
const bestSeed = headline((row) => ({ score: bestOf.get(key(row)) ?? 0, valid: true }));
const meanSeed = headline((row) => ({
  score: row.score.valid ? row.score.score : (meanOf.get(key(row)) ?? 0),
  valid: row.score.valid || (meanOf.get(key(row)) ?? 0) > 0,
}));
console.log(`every seed scores its cell's BEST     ${bestSeed.toFixed(2)}  (${(bestSeed - base >= 0 ? "+" : "")}${(bestSeed - base).toFixed(2)})`);
console.log(`invalid runs score their cell's MEAN  ${meanSeed.toFixed(2)}  (+${(meanSeed - base).toFixed(2)})`);

const validBest = headline((row) =>
  row.score.valid ? { score: bestOf.get(key(row)) ?? 0, valid: true } : row.score
);
const allMean = headline((row) => ({
  score: meanOf.get(key(row)) ?? 0,
  valid: (meanOf.get(key(row)) ?? 0) > 0,
}));
console.log(`valid runs score their cell's BEST    ${validBest.toFixed(2)}  (+${(validBest - base).toFixed(2)})`);
console.log(`every run scores its cell's MEAN      ${allMean.toFixed(2)}  (+${(allMean - base).toFixed(2)})`);

console.log(`\n== what each axis costs, as an RMS-scaling upper bound ==`);
for (const axis of ["impact", "air", "speed", "amplitude"]) {
  const present = rows.filter((r) => r.components[axis] !== undefined && r.score.valid);
  if (present.length === 0) continue;
  for (const factor of [0.75, 0.7, 0.5, 0]) {
    const lifted = headline((row) => {
      if (!row.score.valid) return row.score;
      const component = row.components[axis];
      if (component === undefined) return row.score;
      let sum = 0;
      let weight = 0;
      for (const [name, c] of Object.entries(row.components)) {
        const rms = name === axis ? c.rmsError * factor : c.rmsError;
        sum += c.weight * rms * rms;
        weight += c.weight;
      }
      return { score: scoreFromRms(Math.sqrt(sum / weight)), valid: true };
    });
    console.log(
      `${axis.padEnd(10)} rms x${factor.toFixed(2)}   ${lifted.toFixed(2)}  (+${(lifted - base).toFixed(2)})` +
        (factor === 0.75 ? `   n=${present.length}` : ""),
    );
  }
}

console.log(`\n== mixed-axis counterfactuals ==`);
for (const factor of [0.75, 0.5, 0]) {
  const lifted = headlineWithAxisFactors({
    air: factor,
    speed: factor,
    amplitude: factor,
  });
  console.log(
    `air+speed+amplitude rms x${factor.toFixed(2)}  ${lifted.toFixed(2)}  ` +
      `(${lifted - base >= 0 ? "+" : ""}${(lifted - base).toFixed(2)})`,
  );
}
for (const factor of [1, 0.98, 0.95, 0.9, 0.85, 0.8, 0.75]) {
  const lifted = headlineWithAxisFactors({
    impact: factor,
    air: 0,
    speed: 0,
    amplitude: 0,
  });
  console.log(
    `secondary perfect + impact rms x${factor.toFixed(2)}  ${lifted.toFixed(2)}  ` +
      `(${lifted - base >= 0 ? "+" : ""}${(lifted - base).toFixed(2)})`,
  );
}
for (const secondaryFactor of [0.75, 0.5, 0.25, 0]) {
  let passingImpactFactor = 0;
  let failingImpactFactor = 1;
  for (let iteration = 0; iteration < 80; iteration++) {
    const impactFactor = (passingImpactFactor + failingImpactFactor) / 2;
    const lifted = headlineWithAxisFactors({
      impact: impactFactor,
      air: secondaryFactor,
      speed: secondaryFactor,
      amplitude: secondaryFactor,
    });
    if (lifted > 650) passingImpactFactor = impactFactor;
    else failingImpactFactor = impactFactor;
  }
  const thresholdHeadline = headlineWithAxisFactors({
    impact: passingImpactFactor,
    air: secondaryFactor,
    speed: secondaryFactor,
    amplitude: secondaryFactor,
  });
  console.log(
    `secondary rms x${secondaryFactor.toFixed(2)} needs impact rms x${passingImpactFactor.toFixed(6)}  ` +
      `${thresholdHeadline.toFixed(4)} (>650 boundary)`,
  );
}
let passingAllFactor = 0;
let failingAllFactor = 1;
for (let iteration = 0; iteration < 80; iteration++) {
  const factor = (passingAllFactor + failingAllFactor) / 2;
  const lifted = headlineWithAxisFactors({
    impact: factor,
    air: factor,
    speed: factor,
    amplitude: factor,
  });
  if (lifted > 650) passingAllFactor = factor;
  else failingAllFactor = factor;
}
console.log(
  `all four rms x${passingAllFactor.toFixed(6)}  ` +
    `${headlineWithAxisFactors({
      impact: passingAllFactor,
      air: passingAllFactor,
      speed: passingAllFactor,
      amplitude: passingAllFactor,
    }).toFixed(4)} (>650 boundary)`,
);

console.log(`\n== the worst cells, by how much they hold back their group ==`);
const cellLoss = [...byCell.entries()].map(([cell, list]) => {
  const valid = list.filter((r) => r.score.valid);
  const mean = valid.length === 0
    ? 0
    : valid.reduce((sum, r) => sum + r.score.score, 0) / valid.length;
  return { cell, mean, valid: valid.length, of: list.length };
}).sort((a, b) => a.mean - b.mean);
for (const entry of cellLoss.slice(0, 14)) {
  console.log(
    `  ${entry.cell.padEnd(52)} mean ${entry.mean.toFixed(1).padStart(7)}  valid ${entry.valid}/${entry.of}`,
  );
}
