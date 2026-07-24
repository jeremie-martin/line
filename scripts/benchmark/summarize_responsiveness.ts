import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { RUN_ARCHIVE_SCHEMA } from "../v0/benchmark_v2/runner.ts";
import {
  DECISION_INFERENCE_PROTOCOL_FINGERPRINT,
  pairedV2Decision,
  type DecisionRun,
} from "../v0/benchmark_v2/decision_model.ts";
import { loadSourceManifest, resolveSources } from "../v0/benchmark_v2/model.ts";
import { fingerprintFiles, loadSuiteManifest } from "../v0/benchmark_v2/suite_model.ts";
import { round, sha256 } from "../v0/benchmark_v2/util.ts";

const paths = {
  baseline: "benchmark/v2/runs/calibration-v2.6-probe-baseline.json.gz",
  impactOff: "benchmark/v2/runs/calibration-v2.6-impact-off-probe.json.gz",
  narrowBreadth: "benchmark/v2/runs/calibration-v2.6-quality-ncand-1-probe.json.gz",
};
const archives = Object.fromEntries(Object.entries(paths).map(([id, path]) => [id, verified(path)])) as
  Record<keyof typeof paths, any>;
const policies = new Set(Object.values(archives).map((archive) => archive.identity.executionPolicyFingerprint));
if (policies.size !== 1) throw new Error(`responsiveness archives do not use one execution policy`);
const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
const suite = loadSuiteManifest("benchmark/v2/compat/suite-manifest.json", sources);
const report = {
  schema: "line.benchmark-v2.responsiveness-study.v1",
  status: "complete",
  purpose: "Confirm that the frozen probe detects broad and axis-specific compiler degradations under an identical execution policy.",
  executionPolicyFingerprint: archives.baseline.identity.executionPolicyFingerprint,
  decisionInferenceFingerprint: DECISION_INFERENCE_PROTOCOL_FINGERPRINT,
  cases: [
    summarize("baseline", archives.baseline),
    summarize("impact_blindness", archives.impactOff),
    summarize("candidate_breadth_1", archives.narrowBreadth),
  ],
};
write("benchmark/v2/studies/responsiveness.json", `${JSON.stringify(report, null, 2)}\n`);
write("docs/benchmark-v2-responsiveness.md", markdown(report));
console.log(markdown(report));

function summarize(id: string, archive: any): Record<string, unknown> {
  const baselineHeadline = archives.baseline.canonicalHeadline;
  return {
    id,
    archive: paths[id === "baseline" ? "baseline" : id === "impact_blindness" ? "impactOff" : "narrowBreadth"],
    archiveSha256: archive.__sha256,
    compilerEnvironment: archive.git.compilerEnvironment,
    headline: archive.canonicalHeadline,
    deltaFromBaseline: round(archive.canonicalHeadline - baselineHeadline),
    validRuns: archive.runs.filter((run: any) => run.score.valid).length,
    totalRuns: archive.runs.length,
    budgets: archive.developmentSummaries.map((summary: any) => ({
      budget: summary.budget,
      score: summary.score,
      validRuns: summary.validRuns,
      totalRuns: summary.totalRuns,
    })),
    strata: weightedStrata(archive),
    hardFailures: counts(archive.runs.flatMap((run: any) => run.score.hardFailures.map((failure: string) => failure.split(":")[0]))),
    decision: id === "baseline" ? null : decisionSummary(archive),
  };
}

function decisionSummary(candidate: any): Record<string, unknown> {
  const result = pairedV2Decision(toRuns(archives.baseline), toRuns(candidate), suite, {
    profile: "probe",
    mode: "improvement",
  });
  return {
    outcome: result.outcome,
    delta: result.delta,
    centralInterval: [result.confidence.centralLo, result.confidence.centralHi],
    lowerBound: result.confidence.lowerBound,
    upperBound: result.confidence.upperBound,
  };
}

function toRuns(archive: any): DecisionRun[] {
  return archive.runs.map((row: any) => ({
    sourceId: row.task.sourceId,
    budget: row.task.budget,
    seedSlot: row.task.seedSlot,
    actualSeed: row.task.actualSeed,
    score: { score: row.score.score, valid: row.score.valid },
  }));
}

function weightedStrata(archive: any): Record<string, number> {
  const weights = new Map([[250_000, 2 / 7], [500_000, 5 / 7]]);
  const out: Record<string, number> = {};
  for (const summary of archive.developmentSummaries) {
    for (const stratum of summary.strata) {
      out[stratum.id] = (out[stratum.id] ?? 0) + (weights.get(summary.budget) ?? 0) * stratum.score;
    }
  }
  return Object.fromEntries(Object.entries(out).map(([id, score]) => [id, round(score)]));
}

function verified(path: string): any {
  const bytes = readFileSync(path);
  const digest = sha256(bytes);
  const expected = readFileSync(`${path}.sha256`, "utf8").trim().split(/\s+/)[0];
  if (digest !== expected) throw new Error(`${path}: checksum mismatch`);
  const archive = JSON.parse((path.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8"));
  if (archive.schema !== RUN_ARCHIVE_SCHEMA || archive.profile !== "probe") {
    throw new Error(`${path}: not a V2 probe archive`);
  }
  return { ...archive, __sha256: digest };
}

function markdown(report: any): string {
  const lines = [
    "# Benchmark V2 Responsiveness Calibration",
    "",
    "All runs use the same catalog, budgets, seed blocks, scoring, engine, and semantic execution protocol. Only the declared compiler environment changes.",
    "The row named `baseline` is the retained calibration reference, not an approved promotion baseline.",
    "",
    "| Case | Environment | Headline | Delta | Valid |",
    "|---|---|---:|---:|---:|",
    ...report.cases.map((entry: any) =>
      `| ${entry.id} | ${JSON.stringify(entry.compilerEnvironment)} | ${entry.headline.toFixed(2)} | ` +
      `${entry.deltaFromBaseline.toFixed(2)} | ${entry.validRuns}/${entry.totalRuns} |`
    ),
    "",
    `\`LR_QUALITY_NCAND=1\` is the graded calibration: it lowers every stratum and the probe decision returns ` +
      `\`${report.cases.find((entry: any) => entry.id === "candidate_breadth_1").decision.outcome}\` with a ` +
      `${Math.abs(report.cases.find((entry: any) => entry.id === "candidate_breadth_1").decision.delta).toFixed(2)}-point headline loss. ` +
      "`LR_IMPACT_OFF=1` is the contract calibration: authored impact measurements disappear, so every run is invalid rather than silently ignoring the axis.",
  ];
  return `${lines.join("\n")}\n`;
}

function counts(values: string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return result;
}

function write(path: string, contents: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, contents);
}
