/**
 * Read two completed budget-scale studies as a paired multi-budget safety panel.
 *
 * Scale-study cells are paired by (source, budget, actual seed). The seed is the
 * independent block: sources within a seed share the same optimizer draw and
 * must not be counted as independent samples. Suite and stratum point estimates
 * come from the scale study's canonical summaries, not from an arithmetic mean
 * over source scores.
 *
 * This is retained evidence, not a promotion path. It never compiles a track or
 * writes campaign governance state.
 *
 * Usage:
 *   node --import tsx scripts/v0/study_paired_budget_safety.ts \
 *     --candidate=<candidate.json>[,<candidate-2.json>...] \
 *     --reference=<reference.json>[,<reference-2.json>...] \
 *     --out=<paired-safety.json>
 *
 * Multiple archive pairs must cover disjoint cells. Their canonical summaries
 * are recomputed over the union; input headline scores are never averaged.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import {
  assertPairedArms,
  pairGridCells,
  readGridArm,
  seedBlockPairedDelta,
} from "../benchmark/paired_grid.ts";
import { summarizeDevelopmentBudget, type ScoredDevelopmentRun } from "./benchmark_v2/evaluator.ts";
import { loadSourceManifest, resolveSources } from "./benchmark_v2/model.ts";
import { loadSuiteManifest } from "./benchmark_v2/suite_model.ts";

const SCHEMA = "line.benchmark-v2.paired-budget-safety.v1" as const;

const args = process.argv.slice(2);
const argument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
};
const required = (name: string): string => {
  const value = argument(name);
  if (value === undefined || value === "") throw new Error(`missing --${name}=<path[,path...]>`);
  return value;
};

const paths = (name: string): string[] => required(name).split(",").map((path) => resolve(path.trim()));
const candidatePaths = paths("candidate");
const referencePaths = paths("reference");
const outputPath = resolve(required("out"));
if (candidatePaths.length !== referencePaths.length) {
  throw new Error("--candidate and --reference must contain the same number of paths");
}
const candidates = candidatePaths.map((path, index) => readGridArm(`candidate-${index + 1}`, path));
const references = referencePaths.map((path, index) => readGridArm(`reference-${index + 1}`, path));
const comparabilityNotes = candidates.flatMap((candidate, index) =>
  assertPairedArms(candidate, references[index])
);
for (let index = 1; index < candidates.length; index++) {
  for (const field of [
    "suiteFingerprint",
    "sourceManifestFingerprint",
    "scoringProtocolFingerprint",
    "scorerFingerprint",
  ]) {
    if (candidates[index].archive[field] !== candidates[0].archive[field]) {
      throw new Error(`candidate archives disagree on ${field}`);
    }
    if (references[index].archive[field] !== references[0].archive[field]) {
      throw new Error(`reference archives disagree on ${field}`);
    }
  }
}
const pairSets = candidates.map((candidate, index) => pairGridCells(candidate, references[index]));
const pairs = pairSets.flatMap((paired) => paired.pairs);
if (new Set(pairs.map((pair) => pair.key)).size !== pairs.length) {
  throw new Error("archive pairs contain overlapping (source, budget, seed) cells");
}
const budgets = [...new Set(pairs.map((pair) => pair.ref.budget))].sort((a, b) => a - b);
const sourceManifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
const suiteManifestPath = resolve(argument("suite") ?? "benchmark/v2/compat/suite-manifest.json");
const sources = resolveSources(loadSourceManifest(sourceManifestPath));
const suite = loadSuiteManifest(suiteManifestPath, sources);

const summaryAt = (arms: typeof candidates, budget: number): any => {
  const runs = arms.flatMap((arm) => arm.archive.runs).filter((row: any) => row.task.budget === budget);
  if (runs.length === 0) throw new Error(`missing runs for budget ${budget}`);
  return summarizeDevelopmentBudget(runs.map((row: any, seedSlot): ScoredDevelopmentRun => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot,
    actualSeed: row.task.actualSeed,
    score: row.score,
  })), budget, suite);
};

const readings = budgets.map((budget) => {
  const budgetPairs = pairs.filter((pair) => pair.ref.budget === budget);
  const changed = budgetPairs.filter((pair) => pair.ref.trackHash !== pair.candidate.trackHash);
  const lost = budgetPairs.filter((pair) => pair.ref.valid && !pair.candidate.valid);
  const gained = budgetPairs.filter((pair) => !pair.ref.valid && pair.candidate.valid);
  const before = summaryAt(references, budget);
  const after = summaryAt(candidates, budget);
  const beforeStrata = new Map(before.strata.map((entry: any) => [entry.id, entry]));
  const strata = after.strata.map((entry: any) => {
    const ref = beforeStrata.get(entry.id) as any;
    if (ref === undefined) throw new Error(`reference missing ${entry.id} stratum at ${budget}`);
    return {
      id: entry.id,
      referenceScore: ref.score,
      candidateScore: entry.score,
      delta: entry.score - ref.score,
    };
  });
  const stratumDelta = (id: string): number | null =>
    strata.find((entry: any) => entry.id === id)?.delta ?? null;
  const gates = {
    totalNonNegative: after.score - before.score >= 0,
    capabilityNonNegative: (stratumDelta("capability") ?? -Infinity) >= 0,
    legacyNonNegative: (stratumDelta("legacy_regression") ?? -Infinity) >= 0,
    noValidityLoss: after.validRuns >= before.validRuns && lost.length === 0,
  };
  return {
    budget,
    cells: budgetPairs.length,
    changedTracks: changed.length,
    lostCompletions: lost.length,
    gainedCompletions: gained.length,
    referenceScore: before.score,
    candidateScore: after.score,
    delta: after.score - before.score,
    referenceValidRuns: before.validRuns,
    candidateValidRuns: after.validRuns,
    totalRuns: after.totalRuns,
    seedBlockedDelta: seedBlockPairedDelta(budgetPairs),
    strata,
    gates,
    pass: Object.values(gates).every(Boolean),
  };
});

const report = {
  schema: SCHEMA,
  generatedAt: new Date().toISOString(),
  note: "Paired multi-budget safety evidence. Point estimates are not a promotion decision.",
  candidatePaths: candidatePaths.map((path) => relative(process.cwd(), path)),
  referencePaths: referencePaths.map((path) => relative(process.cwd(), path)),
  suiteFingerprint: candidates[0].archive.suiteFingerprint,
  sourceManifestFingerprint: candidates[0].archive.sourceManifestFingerprint,
  scoringProtocolFingerprint: candidates[0].archive.scoringProtocolFingerprint,
  scorerFingerprint: candidates[0].archive.scorerFingerprint,
  candidateIdentities: candidates.map((candidate) => candidate.archive.candidate),
  referenceIdentities: references.map((reference) => reference.archive.candidate),
  comparabilityNotes,
  cells: pairs.length,
  changedTracks: pairSets.reduce((sum, paired) => sum + paired.changed.length, 0),
  lostCompletions: pairSets.reduce((sum, paired) => sum + paired.lost.length, 0),
  gainedCompletions: pairSets.reduce((sum, paired) => sum + paired.gained.length, 0),
  readings,
  pass: readings.every((reading) => reading.pass),
};

mkdirSync(dirname(outputPath), { recursive: true });
const bytes = Buffer.from(`${JSON.stringify(report, null, 2)}\n`);
writeFileSync(outputPath, bytes);
writeFileSync(
  `${outputPath}.sha256`,
  `${createHash("sha256").update(bytes).digest("hex")}  ${relative(process.cwd(), outputPath)}\n`,
);

for (const reading of readings) {
  const strata = new Map(reading.strata.map((entry) => [entry.id, entry.delta]));
  console.log(
    `${reading.budget / 1_000_000}M: ${signed(reading.delta)} total, ` +
    `${signed(strata.get("capability") ?? NaN)} capability, ` +
    `${signed(strata.get("legacy_regression") ?? NaN)} legacy; ` +
    `${reading.candidateValidRuns}/${reading.totalRuns} valid; ` +
    `${reading.changedTracks} changed; ${reading.pass ? "PASS" : "FAIL"}`,
  );
}
console.log(`overall ${report.pass ? "PASS" : "FAIL"}`);
console.log(`output ${relative(process.cwd(), outputPath)}`);

function signed(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  return `${value >= 0 ? "+" : ""}${value.toFixed(4)}`;
}
