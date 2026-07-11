/**
 * Merge verified scale-study references into one pooled reference archive.
 *
 * Motivation (RFC D step 2 gate, 2026-07-11): twelve-block references carry
 * ~40% sampling error on the seed-block variance, and the seeds-0..11 and
 * seeds-12..23 references measured materially different spreads. The pooled
 * 24-block reference is the honest basis for re-deriving the operating-point
 * menu. Deterministic: output is a pure function of the verified inputs
 * (no timestamps); retained with compile-archive .sha256 sidecars.
 */

import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { applyJolt } from "../produce/seed.ts";
import { buildAxisContract, summarizeDevelopmentBudget, type AxisContract } from "../v0/benchmark_v2/evaluator.ts";
import { loadSourceManifest, loadSourceSpec, resolveSources } from "../v0/benchmark_v2/model.ts";
import {
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
  suiteIdentity,
} from "../v0/benchmark_v2/suite_model.ts";
import { readVerifiedArtifact, verifyScaleStudyArchive } from "./study_lib.ts";

const REPO = resolve(dirname(new URL(import.meta.url).pathname), "..", "..");

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
}

const inputPaths = (argument("inputs") ?? [
  "benchmark/v2/runs/calibration-v2.4-coverage-reference.json.gz",
  "benchmark/v2/runs/calibration-v2.4-independent-reference-seeds-12-23.json.gz",
].join(",")).split(",");
const outPath = resolve(REPO, argument("out") ?? "benchmark/v2/runs/calibration-v2.4-pooled-reference-seeds-0-23.json");

const sourceManifestPath = "benchmark/v2/compat/source-manifest.json";
const suiteManifestPath = "benchmark/v2/compat/suite-manifest.json";
const sources = resolveSources(loadSourceManifest(sourceManifestPath));
const suite = loadSuiteManifest(suiteManifestPath, sources);
const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
const scorerFingerprint = fingerprintFiles([
  "scripts/v0/benchmark_v2/evaluator.ts",
  "scripts/v0/benchmark_v2/score_model.ts",
  "scripts/v0/score.ts",
]);
const members = canonicalMembers(suite);
const contracts = new Map<string, AxisContract>();
for (const source of sources) {
  const spec = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
  contracts.set(source.id, buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents));
}

const inputs = inputPaths.map((rel) => {
  const verified = readVerifiedArtifact(resolve(REPO, rel));
  const json = JSON.parse(verified.bytes.toString("utf8"));
  verifyScaleStudyArchive(json, {
    label: rel, identity, suite, sources, contracts, scorerFingerprint, members,
  });
  return { rel, verified, json };
});

const first = inputs[0].json;
for (const input of inputs.slice(1)) {
  const json = input.json;
  if (
    json.candidate?.candidateFingerprint !== first.candidate?.candidateFingerprint ||
    JSON.stringify(json.budgets) !== JSON.stringify(first.budgets)
  ) {
    throw new Error(`${input.rel}: candidate or budgets differ from ${inputs[0].rel}`);
  }
  if (json.seeds.some((seed: number) => first.seeds.includes(seed))) {
    throw new Error(`${input.rel}: seeds overlap ${inputs[0].rel}`);
  }
}

const seeds = inputs.flatMap((input) => input.json.seeds as number[]).sort((a, b) => a - b);
const runs = inputs.flatMap((input) => input.json.runs as any[]);
const budgets: number[] = first.budgets;
const summaries = budgets.map((budget) => summarizeDevelopmentBudget(
  runs.filter((row) => row.task.budget === budget).map((row) => ({
    sourceId: row.task.sourceId,
    budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: row.score,
  })),
  budget,
  suite,
));

const merged = {
  schema: "line.benchmark-v2.budget-scale-study.v2",
  note: `Pooled reference merged deterministically from: ${inputs.map((input) =>
    `${input.rel} (artifact ${input.verified.artifactSha256.slice(0, 12)})`).join("; ")}. ` +
    "Derived artifact; no compilation performed here.",
  suiteFingerprint: first.suiteFingerprint,
  sourceManifestFingerprint: first.sourceManifestFingerprint,
  definitionFingerprint: first.definitionFingerprint,
  scorerFingerprint: first.scorerFingerprint,
  transform: first.transform,
  candidate: first.candidate,
  environment: first.environment,
  budgets,
  seeds,
  summaries,
  runs,
  mergedFrom: inputs.map((input) => ({ path: input.rel, artifactSha256: input.verified.artifactSha256 })),
};

const bytes = Buffer.from(`${JSON.stringify(merged, null, 2)}\n`);
const compressed = gzipSync(bytes, { level: 9 });
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, bytes);
writeFileSync(`${outPath}.gz`, compressed);
writeFileSync(`${outPath}.sha256`, `${createHash("sha256").update(bytes).digest("hex")}  ${rel(outPath)}\n`);
writeFileSync(`${outPath}.gz.sha256`, `${createHash("sha256").update(compressed).digest("hex")}  ${rel(`${outPath}.gz`)}\n`);
console.log(`pooled: ${seeds.length} seeds x ${budgets.length} budgets x ${members.length} members = ${runs.length} runs`);
for (const summary of summaries) {
  console.log(`  ${summary.budget / 1000}k: ${summary.score.toFixed(2)} (valid ${summary.validRuns}/${summary.totalRuns})`);
}
console.log(`wrote ${rel(outPath)} (+gz, sidecars)`);

function rel(path: string): string {
  const prefix = `${REPO}/`;
  return path.startsWith(prefix) ? path.slice(prefix.length) : path;
}
