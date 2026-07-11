import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { applyJolt, JOLT_DEFAULT_MS } from "../../produce/seed.ts";
import { axisDetails, scoreDriftReport } from "../score.ts";
import { compileHandoff } from "../optimizer/handoff.ts";
import { AXES, type AxisName } from "../types.ts";
import type { CharacterizationReport } from "./model.ts";
import {
  assertNoHeldoutIdentity,
  loadHeldoutManifest,
  loadSourceManifest,
  loadSourceSpec,
  resolveHeldoutSources,
  resolveSources,
} from "./model.ts";
import { aggregateScreenRuns, renderScreenMarkdown, type ScreenRun } from "./screen_model.ts";
import { sourceInventoryFingerprint } from "./suite_model.ts";
import { relativeToCwd, round, sha256 } from "./util.ts";

const SCREEN_SCHEMA = "line.benchmark-v2.development-screen.v1";
const args = process.argv.slice(2);
const manifestPath = resolve(argument("manifest") ?? "benchmark/v2/compat/source-manifest.json");
const heldoutManifestPath = resolve(argument("heldout-manifest") ?? "benchmark/v2/compat/heldout-manifest.json");
const characterizationPath = resolve(argument("characterization") ?? "benchmark/v2/evidence/characterization.json");
const outPath = resolve(argument("out") ?? "generated/benchmark-v2/development-screen.json");
const markdownPath = argument("markdown") === undefined ? undefined : resolve(argument("markdown")!);
const budgets = integerList("budgets", "75000");
const seeds = integerList("seeds", "0");
const joltMs = finiteNumber("jolt-ms", JOLT_DEFAULT_MS);
const sourceRole = argument("role") ?? "representative";
if (!["representative", "capability", "regression", "development_music"].includes(sourceRole)) {
  throw new Error(`--role must be representative, capability, regression, or development_music`);
}

const manifest = loadSourceManifest(manifestPath);
const heldoutManifest = loadHeldoutManifest(heldoutManifestPath);
const resolvedSources = resolveSources(manifest);
assertNoHeldoutIdentity(resolvedSources, resolveHeldoutSources(heldoutManifest));
const characterization = JSON.parse(
  readFileSync(characterizationPath, "utf8"),
) as CharacterizationReport;
if (characterization.manifestFingerprint !== sourceInventoryFingerprint(readFileSync(manifestPath, "utf8"))) {
  throw new Error(`screen characterization manifest fingerprint is stale`);
}
const eligibleSources = resolvedSources.filter((source) => source.role === (
  sourceRole === "representative"
    ? "representative_candidate"
    : sourceRole === "capability"
      ? "capability_candidate"
      : sourceRole === "regression"
        ? "regression_candidate"
        : "development_music_candidate"
));
const requestedIds = stringList("sources", eligibleSources.map((source) => source.id).join(","));
const sourceById = new Map(eligibleSources.map((source) => [source.id, source]));
const unknown = requestedIds.filter((id) => !sourceById.has(id));
if (unknown.length > 0) {
  throw new Error(
    `${sourceRole} screen rejects ineligible or unknown source ids: ${unknown.join(", ")}`,
  );
}

const gitHead = git(["rev-parse", "HEAD"]);
const trackedDiff = git(["diff", "--binary", "HEAD"]);
const compilerTrackedDiff = git([
  "diff", "--binary", "HEAD", "--",
  "scripts/v0/optimizer", "scripts/v0/core", "scripts/v0/score.ts", "scripts/v0/types.ts", "engine-rs",
]);
const harnessFingerprint = sha256([
  "scripts/v0/benchmark_v2/model.ts",
  "scripts/v0/benchmark_v2/screen_model.ts",
  "scripts/v0/benchmark_v2/screen.ts",
  "scripts/v0/benchmark_v2/util.ts",
].map((path) => readFileSync(resolve(path), "utf8")).join("\n---\n"));
const trackedStatus = git(["status", "--short", "--untracked-files=no"])
  .split("\n")
  .filter(Boolean);
const runs: ScreenRun[] = [];

console.log(`Benchmark V2 ${sourceRole} screen`);
console.log(`  sources: ${requestedIds.join(", ")}`);
console.log(`  budgets: ${budgets.join(", ")}  seeds: ${seeds.join(", ")}`);
console.log(`  production jolt parameter: ${joltMs}ms (effective contact shift ${-joltMs}ms)`);

for (const sourceId of requestedIds) {
  const source = sourceById.get(sourceId)!;
  const characterizedSource = characterization.sources.find((entry) => entry.id === sourceId);
  if (characterizedSource === undefined) throw new Error(`${sourceId}: absent from characterization`);
  if (
    characterizedSource.role !== source.role ||
    characterizedSource.sourceFingerprint !== source.sourceFingerprint ||
    characterizedSource.module !== source.module ||
    characterizedSource.scoreSource !== source.scoreSource
  ) {
    throw new Error(`${sourceId}: characterization source identity is stale`);
  }
  const authoredContactCount = characterizedSource.contactCount;
  const baseSpec = await loadSourceSpec(source);
  for (const budget of budgets) {
    for (const seed of seeds) {
      const started = performance.now();
      try {
        const spec = applyJolt(baseSpec, joltMs);
        const { track, report } = compileHandoff(spec, seed, { budget });
        const elapsedMs = Math.round(performance.now() - started);
        const score = scoreDriftReport(report, { totalFrames: track.duration });
        const contacts = report.contacts.reduce(
          (counts, contact) => {
            counts[contact.status]++;
            return counts;
          },
          { hit: 0, drift: 0, missing: 0 },
        );
        const axisMeanAbsoluteError = Object.fromEntries(AXES.flatMap((axis) => {
          const errors = axisDetails(report)
            .filter((detail) => detail.axis === axis)
            .map((detail) => Math.abs(detail.error));
          return errors.length === 0
            ? []
            : [[axis, round(errors.reduce((sum, error) => sum + error, 0) / errors.length)]];
        })) as Partial<Record<AxisName, number>>;
        const indexedContacts = report.contacts.map((contact, index) => ({ contact, index }));
        const lastHit = indexedContacts.filter(({ contact }) => contact.status === "hit").at(-1);
        const firstMissing = indexedContacts.find(({ contact }) => contact.status === "missing");
        const missingAuthored = Math.max(0, authoredContactCount - contacts.hit - contacts.drift);
        runs.push({
          sourceId,
          budget,
          seed,
          status: "ok",
          elapsedMs,
          score: round(score.score),
          axisErrorRms: round(score.axis_error_rms),
          contacts: {
            authoredTotal: authoredContactCount,
            reportedTotal: report.contacts.length,
            hit: contacts.hit,
            drift: contacts.drift,
            reportedMissing: contacts.missing,
            missingAuthored,
            offBeat: report.off_beat_landings.length,
          },
          terminus: { frame: report.terminus.frame, reason: report.terminus.reason },
          ...(lastHit === undefined ? {} : {
            lastHitContact: { index: lastHit.index, targetSeconds: round(lastHit.contact.t_target) },
          }),
          ...(firstMissing === undefined ? {} : {
            firstMissingContact: {
              index: firstMissing.index,
              targetSeconds: round(firstMissing.contact.t_target),
            },
          }),
          axisMeanAbsoluteError,
        });
        console.log(
          `  ${sourceId} budget=${budget} seed=${seed}: score=${score.score.toFixed(2)} ` +
          `hit=${contacts.hit}/${authoredContactCount} missing=${missingAuthored} ${elapsedMs}ms`,
        );
      } catch (error) {
        const elapsedMs = Math.round(performance.now() - started);
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        runs.push({ sourceId, budget, seed, status: "error", elapsedMs, error: message });
        console.error(`  ${sourceId} budget=${budget} seed=${seed}: ERROR ${message}`);
      }
    }
  }
}

const archive = {
  schema: SCREEN_SCHEMA,
  status: "diagnostic-not-suite-result",
  sourceRole,
  generatedAt: new Date().toISOString(),
  characterizationFingerprint: characterization.dataFingerprint,
  sourceManifest: relativeToCwd(manifestPath),
  gitHead,
  worktreeTrackedDiffSha256: sha256(trackedDiff),
  compilerTrackedDiffSha256: sha256(compilerTrackedDiff),
  harnessFingerprint,
  trackedChanges: trackedStatus,
  engine: process.env.LR_ENGINE ?? "typescript",
  scoreRuler: "scoreDriftReport-v1-diagnostic",
  transform: { kind: "production_felt_jolt", joltMs, effectiveContactShiftMs: -joltMs },
  budgets,
  seeds,
  sources: requestedIds.map((id) => {
    const source = sourceById.get(id)!;
    return {
      id,
      module: source.module,
      scoreSource: source.scoreSource,
      sourceFingerprint: source.sourceFingerprint,
      originFamily: source.originFamily,
      musicWorkId: source.musicWorkId,
    };
  }),
  runs,
  aggregates: aggregateScreenRuns(runs),
};

mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(archive, null, 2)}\n`);
console.log(`  archive: ${relativeToCwd(outPath)}`);
if (markdownPath !== undefined) {
  mkdirSync(dirname(markdownPath), { recursive: true });
  writeFileSync(markdownPath, renderScreenMarkdown(archive));
  console.log(`  Markdown: ${relativeToCwd(markdownPath)}`);
}
if (runs.some((run) => run.status === "error")) process.exitCode = 1;

function argument(name: string): string | undefined {
  const prefix = `--${name}=`;
  return args.find((arg) => arg.startsWith(prefix))?.slice(prefix.length);
}

function stringList(name: string, fallback: string): string[] {
  const values = (argument(name) ?? fallback).split(",").map((value) => value.trim()).filter(Boolean);
  if (values.length === 0 || new Set(values).size !== values.length) {
    throw new Error(`--${name} must contain unique comma-separated values`);
  }
  return values;
}

function integerList(name: string, fallback: string): number[] {
  const values = stringList(name, fallback).map(Number);
  if (values.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new Error(`--${name} must contain non-negative safe integers`);
  }
  if (name === "budgets" && values.some((value) => value === 0)) {
    throw new Error(`--budgets values must be positive`);
  }
  return values;
}

function finiteNumber(name: string, fallback: number): number {
  const value = argument(name) === undefined ? fallback : Number(argument(name));
  if (!Number.isFinite(value)) throw new Error(`--${name} must be finite`);
  return value;
}

function git(gitArgs: string[]): string {
  return execFileSync("git", gitArgs, { encoding: "utf8" }).trimEnd();
}
