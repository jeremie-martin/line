/**
 * Capture exactly one preregistered long-carrier replication fixture.
 *
 * This entrypoint is intentionally narrower than the generic trajectory
 * capture CLI: it has one roster, one transform, one engine, and one budget.
 * It is the only capture executable allowed by the replication controller.
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  fixtureFingerprintForPayload,
  frozenFixtureCaptureArtifactIdentity,
  sha256,
  stableJson,
  type FrozenFixtureCaptureArtifactIdentity,
  type FrozenTrajectoryFixtureV3,
} from "./trajectory/frozen_fixture.ts";
import {
  getLongCarrierReplicationCaptureCase,
  buildLongCarrierReplicationCaptureSetup,
} from "./trajectory/long_carrier_replication_input.ts";
import {
  LONG_CARRIER_REPLICATION_PROTOCOL,
  LONG_CARRIER_REPLICATION_SCOPE,
} from "./trajectory/long_carrier_replication_protocol.ts";
import {
  longCarrierReplicationCandidateIdentity,
  type LongCarrierReplicationCandidateIdentity,
} from "./trajectory/long_carrier_replication_candidate.ts";
import {
  fingerprintLongCarrierReplicationFiles,
  longCarrierReplicationSourceIdentity,
  type LongCarrierReplicationSourceIdentity,
} from "./trajectory/long_carrier_replication_source.ts";
import {
  replicationIdentityDriftArtifactPath,
  writeImmutableReplicationJson,
} from "./trajectory/long_carrier_replication_records.ts";
import { assertLongCarrierReplicationRuntimeEnvironment } from "./trajectory/long_carrier_replication_runtime.ts";
import { captureTrajectoryPrefix } from "./trajectory/prefix_capture_core.ts";

const CAPTURE_PATH = "scripts/v0/capture_long_carrier_replication_fixture.ts";
const argv = process.argv.slice(2);

if (argv.includes("--help") || argv.includes("-h")) {
  process.stdout.write([
    "Usage: capture_long_carrier_replication_fixture.ts --case=ID --cohort=validation --budget=500000 --out=FILE",
    "",
    "Captures one declared long-carrier replication fixture under the fixed",
    "WASM/500k protocol. Alternate cases, cohorts, budgets, and LR settings are rejected.",
  ].join("\n") + "\n");
  process.exit(0);
}

const options = parseArguments(argv);
assertExactEnvironment();
const panel = getLongCarrierReplicationCaptureCase(options.id);
if (options.cohort !== "validation") throw new Error("long-carrier replication capture requires --cohort=validation");
if (options.budget !== LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget) {
  throw new Error(`long-carrier replication capture requires --budget=${LONG_CARRIER_REPLICATION_PROTOCOL.capture.captureBudget}`);
}
const outputPath = resolve(options.out);
if (existsSync(outputPath)) throw new Error(`replication fixture output already exists and is immutable: ${outputPath}`);

const captureEnvironment = { LR_ENGINE: "wasm" };
const sourceAtStart = longCarrierReplicationSourceIdentity(CAPTURE_PATH);
const candidateAtStart = longCarrierReplicationCandidateIdentity("wasm");
const panelSourceFingerprintAtStart = fingerprintLongCarrierReplicationFiles([panel.sourcePath]);
const captureIdentity = captureIdentityFor(panelSourceFingerprintAtStart, sourceAtStart, candidateAtStart);
const started = performance.now();
const captured = captureTrajectoryPrefix(
  panel,
  buildLongCarrierReplicationCaptureSetup(panel),
  options.budget,
);
const sourceAtEnd = longCarrierReplicationSourceIdentity(CAPTURE_PATH);
const candidateAtEnd = longCarrierReplicationCandidateIdentity("wasm");
const panelSourceFingerprintAtEnd = fingerprintLongCarrierReplicationFiles([panel.sourcePath]);
const stable = sourceAtStart.fingerprint === sourceAtEnd.fingerprint &&
  candidateAtStart.candidateFingerprint === candidateAtEnd.candidateFingerprint &&
  panelSourceFingerprintAtStart === panelSourceFingerprintAtEnd;

const payload: Omit<FrozenTrajectoryFixtureV3, "fixtureFingerprint"> = {
  schema: "line.frozen-trajectory-prefix.v3",
  purpose: "Frozen physical-prefix input for the preregistered long-carrier replication; not a compiler candidate or comparative result.",
  capture: {
    argv: [...argv],
    runtime: {
      node: process.version,
      engine: "wasm",
      relevantEnvironment: captureEnvironment,
    },
    elapsedMs: round(performance.now() - started),
    captureBudget: options.budget,
    studySourceFingerprint: sourceAtStart.fingerprint,
    studySourceFiles: [...sourceAtStart.sourceFiles],
    captureIdentity,
    identityCheck: {
      stable,
      panelSourceFingerprintAtStart,
      panelSourceFingerprintAtEnd,
      studySourceFingerprintAtStart: sourceAtStart.fingerprint,
      studySourceFingerprintAtEnd: sourceAtEnd.fingerprint,
      captureCandidateFingerprintAtStart: candidateAtStart.candidateFingerprint,
      captureCandidateFingerprintAtEnd: candidateAtEnd.candidateFingerprint,
    },
    captureCompilerAtEnd: candidateAtEnd,
  },
  panel: {
    id: panel.id,
    cohort: panel.cohort,
    category: panel.category,
    sourcePath: panel.sourcePath,
    sourceFingerprint: panelSourceFingerprintAtStart,
    publicSeed: panel.seed,
    requestedTargetGap: panel.targetGap,
    selectionRationale: panel.selectionRationale,
    selectedTargetGap: captured.current.index,
    outgoingGap: captured.outgoing.index,
    currentFrame: captured.current.endFrame,
    outgoingFrame: captured.outgoing.endFrame,
    outgoingIntervalFrames: captured.outgoingIntervalFrames,
    expectedOutgoingFrames: panel.expectedOutgoingFrames ?? null,
    studyScope: panel.studyScope ?? null,
  },
  transform: {
    value: LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform,
    fingerprint: sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform)),
  },
  materialized: captured.materialized,
  materializedFingerprint: captured.materializedFingerprint,
  physicalPrefix: captured.physicalPrefix,
  physicalPrefixFingerprint: captured.physicalPrefixFingerprint,
  checkpoints: {
    targetPlanningState: captured.targetPlanningState,
    targetProbeState: captured.targetProbeState,
    preTargetSledTrace: captured.preTargetSledTrace,
    targetPlanningStateFingerprint: sha256(stableJson(captured.targetPlanningState)),
    targetProbeStateFingerprint: sha256(stableJson(captured.targetProbeState)),
    preTargetSledTraceFingerprint: sha256(stableJson(captured.preTargetSledTrace)),
  },
  captureCompiler: candidateAtStart,
  baseline: captured.baseline,
};
const fixture: FrozenTrajectoryFixtureV3 = {
  ...payload,
  fixtureFingerprint: fixtureFingerprintForPayload(payload),
};
const publicationPath = stable
  ? outputPath
  : replicationIdentityDriftArtifactPath(
    outputPath,
    sourceAtEnd.fingerprint,
    candidateAtEnd.candidateFingerprint,
    panelSourceFingerprintAtEnd,
  );
if (existsSync(publicationPath)) throw new Error(`replication fixture output already exists and is immutable: ${publicationPath}`);
writeImmutableReplicationJson(publicationPath, fixture, "long-carrier replication fixture");
process.stderr.write(
  `replication fixture ${panel.id}: g${fixture.panel.selectedTargetGap}->g${fixture.panel.outgoingGap} ` +
  `(${fixture.panel.outgoingIntervalFrames} frames) -> ${publicationPath}\n`,
);
if (!stable) {
  process.stderr.write("replication fixture invalid: source or compiler identity drift\n");
  process.exitCode = 2;
}

function parseArguments(values: readonly string[]): { id: string; cohort: string; budget: number; out: string } {
  const parsed = new Map<string, string[]>();
  const unsupported: string[] = [];
  for (const value of values) {
    const match = /^--(case|cohort|budget|out)=(.+)$/.exec(value);
    if (match === null) {
      unsupported.push(value);
      continue;
    }
    const [_, name, argument] = match;
    parsed.set(name!, [...(parsed.get(name!) ?? []), argument!]);
  }
  if (unsupported.length > 0) throw new Error(`unsupported replication capture option(s): ${unsupported.join(", ")}`);
  const required = (name: string): string => {
    const valuesForName = parsed.get(name) ?? [];
    if (valuesForName.length !== 1 || valuesForName[0] === "") {
      throw new Error(`--${name}=VALUE is required exactly once`);
    }
    return valuesForName[0]!;
  };
  const budgetText = required("budget");
  const budget = Number(budgetText);
  if (!Number.isSafeInteger(budget)) throw new Error(`invalid --budget=${budgetText}`);
  return { id: required("case"), cohort: required("cohort"), budget, out: required("out") };
}

function assertExactEnvironment(): void {
  assertLongCarrierReplicationRuntimeEnvironment();
  const relevant = Object.fromEntries(Object.entries(process.env)
    .filter(([name, value]) => name.startsWith("LR_") && value !== undefined)
    .sort(([left], [right]) => left.localeCompare(right)));
  if (stableJson(relevant) !== stableJson({ LR_ENGINE: "wasm" })) {
    throw new Error(`long-carrier replication capture requires exactly LR_ENGINE=wasm; received ${stableJson(relevant)}`);
  }
}

function captureIdentityFor(
  panelSourceFingerprint: string,
  sourceIdentity: LongCarrierReplicationSourceIdentity,
  candidate: LongCarrierReplicationCandidateIdentity,
): FrozenFixtureCaptureArtifactIdentity {
  const protocolFingerprint = sha256(stableJson({
    schema: "line.frozen-trajectory-prefix-capture-protocol.v1",
    scope: LONG_CARRIER_REPLICATION_SCOPE,
    panel: {
      id: panel.id,
      cohort: panel.cohort,
      category: panel.category,
      sourcePath: panel.sourcePath,
      sourceFingerprint: panelSourceFingerprint,
      publicSeed: panel.seed,
      requestedTargetGap: panel.targetGap,
      selectionRationale: panel.selectionRationale,
      expectedOutgoingFrames: panel.expectedOutgoingFrames ?? null,
      studyScope: panel.studyScope ?? null,
    },
    capture: {
      engine: "wasm",
      budget: options.budget,
      relevantEnvironment: captureEnvironment,
      transformFingerprint: sha256(stableJson(LONG_CARRIER_REPLICATION_PROTOCOL.capture.transform)),
    },
  }));
  return frozenFixtureCaptureArtifactIdentity({
    schema: "line.frozen-trajectory-prefix-capture.v1",
    panelId: panel.id,
    panelSourceFingerprint,
    captureBudget: options.budget,
    engine: "wasm",
    relevantEnvironment: captureEnvironment,
    studySourceFingerprint: sourceIdentity.fingerprint,
    captureCandidateFingerprint: candidate.candidateFingerprint,
    protocolFingerprint,
  });
}

function round(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
