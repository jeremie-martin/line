/**
 * Seal the all-row mechanical qualification required before a V3 long-carrier
 * efficacy declaration. This runner deliberately consumes the score-free
 * prefix-preparation API and never launches the duration assay.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  LONG_CARRIER_REPLICATION_PROTOCOL,
} from "./trajectory/long_carrier_replication_protocol.ts";
import {
  LONG_CARRIER_REPLICATION_FEASIBILITY_SCHEMA,
  type LongCarrierReplicationFeasibilityRow,
} from "./trajectory/long_carrier_replication_feasibility.ts";
import { longCarrierReplicationCandidateIdentity, type LongCarrierReplicationCandidateIdentity } from "./trajectory/long_carrier_replication_candidate.ts";
import {
  longCarrierReplicationPanelSourceFingerprint,
  longCarrierReplicationSourceIdentity,
} from "./trajectory/long_carrier_replication_source.ts";
import {
  assertLongCarrierReplicationRuntimeEnvironment,
  longCarrierReplicationCaptureRuntimeIdentity,
} from "./trajectory/long_carrier_replication_runtime.ts";
import {
  assertReplicationEvidenceOutsideWorkspace,
  writeSealedReplicationRecord,
} from "./trajectory/long_carrier_replication_records.ts";
import { sha256, stableJson } from "./trajectory/postimpact_study_inputs.ts";

const FEASIBILITY_PATH = "scripts/v0/run_long_carrier_replication_feasibility.ts";
const CAPTURE_PATH = "scripts/v0/capture_long_carrier_replication_fixture.ts";
const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: run_long_carrier_replication_feasibility.ts --out=FILE",
    "",
    "Runs the fixed V3 roster at WASM/500k only to qualify physical-prefix",
    "availability and exact replay. The immutable record contains no score or assay outcome.",
  ].join("\n") + "\n");
  process.exit(0);
}

const outputPath = parseOutput(argv);
assertReplicationEvidenceOutsideWorkspace(outputPath);
if (existsSync(outputPath)) throw new Error(`feasibility output already exists and is immutable: ${outputPath}`);
assertExactEnvironment();

const feasibilitySourceAtStart = longCarrierReplicationSourceIdentity(FEASIBILITY_PATH);
const captureSourceAtStart = longCarrierReplicationSourceIdentity(CAPTURE_PATH);
const captureRuntimeAtStart = longCarrierReplicationCaptureRuntimeIdentity();
const candidateAtStart = longCarrierReplicationCandidateIdentity("wasm");
const panelSourceFingerprintsAtStart = panelSourceFingerprints();
assertDefinitionPathsCommitted(candidateAtStart);

// Do not load a compiler-facing module until its complete candidate boundary
// has passed the clean committed-source gate above. This avoids attesting a
// source snapshot taken after an already-loaded compiler module was changed.
const captureInput = await import("./trajectory/long_carrier_replication_input.ts");
const captureMaterialization = await import("./trajectory/capture_input.ts");
const prefixCapture = await import("./trajectory/prefix_capture_core.ts");
assertInitialIdentity(
  feasibilitySourceAtStart,
  captureSourceAtStart,
  captureRuntimeAtStart,
  candidateAtStart,
  panelSourceFingerprintsAtStart,
);
const rows: LongCarrierReplicationFeasibilityRow[] = [];

for (const entry of LONG_CARRIER_REPLICATION_PROTOCOL.cases) {
  const started = performance.now();
  const panel = captureInput.getLongCarrierReplicationCaptureCase(entry.id);
  const setup = captureInput.buildLongCarrierReplicationCaptureSetup(panel);
  try {
    const prepared = prefixCapture.prepareTrajectoryPrefix(
      panel,
      setup,
      LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
    );
    rows.push({
      id: entry.id,
      sourcePath: entry.sourcePath,
      sourceFingerprintAtStart: panelSourceFingerprintsAtStart[entry.sourcePath]!,
      sourceFingerprintAtEnd: "",
      targetGap: entry.targetGap,
      outgoingGap: prepared.outgoing.index,
      outgoingIntervalFrames: prepared.outgoingIntervalFrames,
      materializedGapCount: setup.gaps.length,
      status: "available",
      failureCode: null,
      witness: {
        projectionRule: prepared.projection.rule,
        donorGap: prepared.projection.donorGap,
        donorSkippedContacts: prepared.projection.donorSkippedContacts,
        physicalPrefixFingerprint: prepared.physicalPrefixFingerprint,
        materializedFingerprint: sha256(stableJson(captureMaterialization.materializeTrajectoryCaptureInput(setup))),
        prefixNextLineId: prepared.physicalPrefix.prefixNextLineId,
        cumulativeCost: prepared.physicalPrefix.cumulativeCost,
        targetPlanningStateFingerprint: sha256(stableJson(prepared.targetPlanningState)),
        targetProbeStateFingerprint: sha256(stableJson(prepared.targetProbeState)),
        preTargetSledTraceFingerprint: sha256(stableJson(prepared.preTargetSledTrace)),
      },
      elapsedMs: round(performance.now() - started),
    });
  } catch (error) {
    rows.push({
      id: entry.id,
      sourcePath: entry.sourcePath,
      sourceFingerprintAtStart: panelSourceFingerprintsAtStart[entry.sourcePath]!,
      sourceFingerprintAtEnd: "",
      targetGap: entry.targetGap,
      outgoingGap: entry.targetGap + 1,
      outgoingIntervalFrames: entry.expectedOutgoingFrames,
      materializedGapCount: setup.gaps.length,
      status: error instanceof prefixCapture.TrajectoryPrefixUnavailableError ? "unavailable" : "invalid",
      failureCode: error instanceof prefixCapture.TrajectoryPrefixUnavailableError ? error.code : "capture_error",
      witness: null,
      elapsedMs: round(performance.now() - started),
    });
    process.stderr.write(`long-carrier feasibility ${entry.id}: ${errorMessage(error)}\n`);
  }
}

const panelSourceFingerprintsAtEnd = panelSourceFingerprints();
const feasibilitySourceAtEnd = longCarrierReplicationSourceIdentity(FEASIBILITY_PATH);
const captureSourceAtEnd = longCarrierReplicationSourceIdentity(CAPTURE_PATH);
const captureRuntimeAtEnd = longCarrierReplicationCaptureRuntimeIdentity();
const candidateAtEnd = longCarrierReplicationCandidateIdentity("wasm");
const stable =
  feasibilitySourceAtStart.fingerprint === feasibilitySourceAtEnd.fingerprint &&
  captureSourceAtStart.fingerprint === captureSourceAtEnd.fingerprint &&
  captureRuntimeAtStart.fingerprint === captureRuntimeAtEnd.fingerprint &&
  candidateAtStart.candidateFingerprint === candidateAtEnd.candidateFingerprint &&
  stableJson(panelSourceFingerprintsAtStart) === stableJson(panelSourceFingerprintsAtEnd);
for (const row of rows) row.sourceFingerprintAtEnd = panelSourceFingerprintsAtEnd[row.sourcePath]!;
const qualified = stable && rows.every((row) => row.status === "available");
const record = writeSealedReplicationRecord(outputPath, {
  schema: LONG_CARRIER_REPLICATION_FEASIBILITY_SCHEMA,
  scope: LONG_CARRIER_REPLICATION_PROTOCOL.scope,
  protocolFingerprint: sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL)),
  environment: { LR_ENGINE: "wasm" },
  captureBudget: LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget,
  projectionRule: LONG_CARRIER_REPLICATION_PROTOCOL.capture.prefixProjectionRule,
  identities: {
    stable,
    feasibilitySourceAtStart,
    feasibilitySourceAtEnd,
    captureSourceAtStart,
    captureSourceAtEnd,
    captureRuntimeAtStart,
    captureRuntimeAtEnd,
    captureCandidateAtStart: candidateAtStart,
    captureCandidateAtEnd: candidateAtEnd,
    panelSourceFingerprintsAtStart,
    panelSourceFingerprintsAtEnd,
  },
  rows,
  qualified,
}, "long-carrier feasibility record");
const counts = Object.fromEntries(["available", "unavailable", "invalid"].map((status) => [
  status,
  rows.filter((row) => row.status === status).length,
]));
process.stdout.write(
  `long-carrier feasibility ${qualified ? "qualified" : "not qualified"}; ` +
  `${counts.available}/${rows.length} available, ${counts.unavailable} unavailable, ${counts.invalid} invalid; ` +
  `record=${outputPath} (${record.recordFingerprint.slice(0, 12)})\n`,
);
process.exitCode = qualified ? 0 : counts.invalid > 0 || !stable ? 2 : 3;

function parseOutput(values: readonly string[]): string {
  const outputs = values.filter((value) => value.startsWith("--out=")).map((value) => value.slice("--out=".length));
  const unsupported = values.filter((value) => !value.startsWith("--out="));
  if (unsupported.length > 0) throw new Error(`unsupported feasibility option(s): ${unsupported.join(", ")}`);
  if (outputs.length !== 1 || outputs[0] === "") throw new Error("--out=FILE is required exactly once");
  return resolve(outputs[0]!);
}

function assertExactEnvironment(): void {
  assertLongCarrierReplicationRuntimeEnvironment();
  const relevant = Object.fromEntries(Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)));
  if (stableJson(relevant) !== stableJson({ LR_ENGINE: "wasm" })) {
    throw new Error(`long-carrier feasibility requires exactly LR_ENGINE=wasm; received ${stableJson(relevant)}`);
  }
}

function assertDefinitionPathsCommitted(candidate: LongCarrierReplicationCandidateIdentity): void {
  const paths = [...new Set([
    ...longCarrierReplicationSourceIdentity(FEASIBILITY_PATH).sourceFiles,
    ...longCarrierReplicationSourceIdentity(CAPTURE_PATH).sourceFiles,
    ...candidate.compilerSourceFiles,
  ])].sort();
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", ...paths], { stdio: "ignore" });
    execFileSync("git", ["diff", "--quiet", "HEAD", "--", ...paths], { stdio: "ignore" });
  } catch {
    throw new Error("long-carrier feasibility source and compiler closures must be tracked, committed, and clean");
  }
}

function assertInitialIdentity(
  feasibilitySource: ReturnType<typeof longCarrierReplicationSourceIdentity>,
  captureSource: ReturnType<typeof longCarrierReplicationSourceIdentity>,
  runtime: ReturnType<typeof longCarrierReplicationCaptureRuntimeIdentity>,
  candidate: LongCarrierReplicationCandidateIdentity,
  panels: Record<string, string>,
): void {
  const unchanged =
    feasibilitySource.fingerprint === longCarrierReplicationSourceIdentity(FEASIBILITY_PATH).fingerprint &&
    captureSource.fingerprint === longCarrierReplicationSourceIdentity(CAPTURE_PATH).fingerprint &&
    runtime.fingerprint === longCarrierReplicationCaptureRuntimeIdentity().fingerprint &&
    candidate.candidateFingerprint === longCarrierReplicationCandidateIdentity("wasm").candidateFingerprint &&
    stableJson(panels) === stableJson(panelSourceFingerprints());
  if (!unchanged) {
    throw new Error("long-carrier feasibility source, compiler, runtime, or panel identity changed during initialization");
  }
}

function panelSourceFingerprints(): Record<string, string> {
  return Object.fromEntries([...new Set(LONG_CARRIER_REPLICATION_PROTOCOL.cases.map((entry) => entry.sourcePath))]
    .sort()
    .map((path) => [path, longCarrierReplicationPanelSourceFingerprint(path)])) as Record<string, string>;
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
