/**
 * Rebind a frozen multi-budget baseline to the current scorer only after every
 * retained raw report reproduces its stored score exactly. Compiler output,
 * telemetry, summaries, and headline are unchanged; provenance records both
 * scorer fingerprints and the source archive checksum.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import { gzipSync } from "node:zlib";
import { applyJolt } from "../produce/seed.ts";
import { readVerifiedArtifact } from "./study_lib.ts";
import { buildAxisContract, scoreV2Report } from "../v0/benchmark_v2/evaluator.ts";
import {
  loadSourceManifest,
  loadSourceSpec,
  resolveSources,
} from "../v0/benchmark_v2/model.ts";
import {
  fingerprintFiles,
  loadSuiteManifest,
  suiteIdentity,
} from "../v0/benchmark_v2/suite_model.ts";
import {
  FROZEN_SCALE_STUDY_SCHEMA,
  loadMultiBudgetProfile,
  resolveMultiBudgetSources,
} from "../v0/benchmark_v2/scale_profile.ts";
import { writeFileAtomicDurable } from "../v0/benchmark_v2/durable_fs.ts";

const argument = (name: string): string | undefined => {
  const prefix = `--${name}=`;
  return process.argv.slice(2).find((value) => value.startsWith(prefix))?.slice(prefix.length);
};
const baselineInput = resolve(argument("baseline") ?? "");
const baselineOutput = resolve(argument("out") ?? "");
if (argument("baseline") === undefined || argument("out") === undefined) {
  throw new Error("usage: rescore_scale_baseline.ts --baseline=BASELINE.json --out=BASELINE.json");
}
if (baselineInput === baselineOutput) throw new Error("--out must preserve the source baseline");

const baselineArtifact = readVerifiedArtifact(baselineInput);
const baseline = JSON.parse(baselineArtifact.bytes.toString("utf8"));
const sourceArchivePath = resolve(baseline.archive?.path ?? "");
const sourceArtifact = readVerifiedArtifact(sourceArchivePath);
const archive = JSON.parse(sourceArtifact.bytes.toString("utf8"));
if (archive.schema !== FROZEN_SCALE_STUDY_SCHEMA || !Array.isArray(archive.runs)) {
  throw new Error("baseline does not reference a frozen V4 scale archive");
}

const sourceManifestPath = resolve("benchmark/v2/compat/source-manifest.json");
const suiteManifestPath = resolve("benchmark/v2/compat/suite-manifest.json");
const profile = loadMultiBudgetProfile("benchmark/v2/scale-profile.json");
const allSources = resolveSources(loadSourceManifest(sourceManifestPath));
const suite = loadSuiteManifest(suiteManifestPath, allSources);
const sources = resolveMultiBudgetSources(profile.profile, allSources);
const identity = suiteIdentity(suiteManifestPath, sourceManifestPath, sources);
if (
  archive.suiteFingerprint !== identity.suiteFingerprint ||
  archive.sourceManifestFingerprint !== identity.sourceManifestFingerprint ||
  archive.scoringProtocolFingerprint !== identity.scoringProtocolFingerprint ||
  archive.scaleProfile?.fingerprint !== profile.fingerprint
) throw new Error("source baseline is not bound to the current suite/profile/scoring protocol");

const contracts = new Map<string, ReturnType<typeof buildAxisContract>>();
for (const source of sources) {
  const spec = applyJolt(await loadSourceSpec(source), suite.transform.jolt_ms);
  contracts.set(
    source.id,
    buildAxisContract(spec, source.eligibleComponents, source.diagnosticComponents),
  );
}
const sourceById = new Map(sources.map((source) => [source.id, source]));
let verifiedRuns = 0;
for (const row of archive.runs) {
  const source = sourceById.get(row.task?.sourceId);
  if (
    source === undefined || row.status !== "ok" || row.report == null ||
    row.source?.sourceFingerprint !== source.sourceFingerprint ||
    !Number.isSafeInteger(row.authoredContacts)
  ) throw new Error(`invalid retained run ${row.task?.sourceId ?? "unknown"}`);
  const rescored = scoreV2Report(
    row.report,
    row.authoredContacts,
    contracts.get(source.id)!,
    suite,
  );
  if (JSON.stringify(rescored) !== JSON.stringify(row.score)) {
    throw new Error(`${source.id}/${row.task.budget}/${row.task.actualSeed}: score changed`);
  }
  row.score = rescored;
  verifiedRuns++;
}

const currentScorerFingerprint = fingerprintFiles([
  "scripts/v0/benchmark_v2/evaluator.ts",
  "scripts/v0/benchmark_v2/score_model.ts",
  "scripts/v0/score.ts",
  "scripts/v0/benchmark_v2/scale_profile.ts",
  relative(process.cwd(), profile.path),
]);
const previousScorerFingerprint = archive.scorerFingerprint;
archive.generatedAt = new Date().toISOString();
archive.note = `${archive.note} Raw reports rescored exactly under the current scorer.`;
archive.scorerFingerprint = currentScorerFingerprint;
archive.rescoreProvenance = {
  schema: "line.benchmark-v2.exact-raw-report-rescore.v1",
  sourceArchive: relativeToCwd(sourceArchivePath),
  sourceArtifactSha256: sourceArtifact.artifactSha256,
  sourceRawSha256: sourceArtifact.rawSha256,
  previousScorerFingerprint,
  currentScorerFingerprint,
  verifiedRuns,
  changedScores: 0,
};

const outputArchive = resolve(
  dirname(baselineOutput),
  `${basename(baselineOutput, ".json")}.archive.json`,
);
const archiveBytes = Buffer.from(`${JSON.stringify(archive)}\n`);
const compressedBytes = gzipSync(archiveBytes, { level: 9 });
writeArtifact(outputArchive, archiveBytes);
writeArtifact(`${outputArchive}.gz`, compressedBytes);

const derivedBaseline = structuredClone(baseline);
derivedBaseline.generatedAt = new Date().toISOString();
derivedBaseline.label = `${baseline.label}-exact-current-scorer`;
derivedBaseline.archive = {
  path: relativeToCwd(outputArchive),
  sha256: sha256(archiveBytes),
  compressedSha256: sha256(compressedBytes),
  scaleHeadline: archive.scaleHeadline,
};
derivedBaseline.rescoreProvenance = archive.rescoreProvenance;
writeArtifact(baselineOutput, Buffer.from(`${JSON.stringify(derivedBaseline, null, 2)}\n`));

process.stdout.write(
  `rescored ${verifiedRuns} raw reports exactly; ${previousScorerFingerprint} -> ` +
    `${currentScorerFingerprint}\n${relativeToCwd(baselineOutput)}\n`,
);

function writeArtifact(path: string, bytes: Buffer): void {
  writeFileAtomicDurable(path, bytes);
  writeFileAtomicDurable(`${path}.sha256`, `${sha256(bytes)}  ${path}\n`);
}

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function relativeToCwd(path: string): string {
  return relative(process.cwd(), resolve(path));
}
