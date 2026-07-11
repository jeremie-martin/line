import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
  CONFIRMATION_DECLARATION_SCHEMA,
  CONFIRMATION_STATE_SCHEMA,
  allocateCanonicalSeedBase,
  assertBaselineTransitionAllowed,
  consumeConfirmation,
  initializeConfirmationStateFromBaseline,
  validateConfirmationEvidence,
  type ConfirmationDeclaration,
  type ConfirmationState,
} from "../scripts/v0/benchmark_v2/confirmation.ts";
import {
  removeAmbientCompilerSources,
  validateCompilerSnapshot,
} from "../scripts/v0/benchmark_v2/compiler_snapshot.ts";
import { latestSuccessfulResults } from "../scripts/v0/benchmark_v2/checkpoint_model.ts";
import {
  assertDecisionCoverageAdequate,
  decisionCalibrationFingerprint,
  requireCurrentDecisionCalibration,
} from "../scripts/v0/benchmark_v2/calibration_guard.ts";
import {
  LISTENING_REVIEW_ATTESTATION,
  loadListeningReview,
  requireApprovedListeningReview,
} from "../scripts/v0/benchmark_v2/listening_review.ts";
import { loadSourceManifest, resolveSources } from "../scripts/v0/benchmark_v2/model.ts";
import { suiteIdentity } from "../scripts/v0/benchmark_v2/suite_model.ts";

const sourcePath = "benchmark/v2/compat/source-manifest.json";
const suitePath = "benchmark/v2/compat/suite-manifest.json";

describe("Benchmark V2 governance", () => {
  test("removes candidate-only compiler files before extracting a frozen snapshot", () => {
    const workspace = mkdtempSync(join(tmpdir(), "v2-snapshot-boundary-"));
    const candidateOnly = join(workspace, "scripts/v0/optimizer/candidate_only.ts");
    const supportFile = join(workspace, "scripts/v0/benchmark_v2/support.ts");
    mkdirSync(join(workspace, "scripts/v0/optimizer"), { recursive: true });
    mkdirSync(join(workspace, "scripts/v0/benchmark_v2"), { recursive: true });
    writeFileSync(candidateOnly, "export const leaked = true;\n");
    writeFileSync(supportFile, "export const retained = true;\n");

    removeAmbientCompilerSources(workspace);

    expect(existsSync(candidateOnly)).toBe(false);
    expect(existsSync(supportFile)).toBe(true);
  });

  test("validates the complete listening template but blocks canonical use until a human approves it", async () => {
    const sources = resolveSources(loadSourceManifest(sourcePath));
    const identity = suiteIdentity(suitePath, sourcePath, sources);
    const evidence = await loadListeningReview(
      "benchmark/v2/evidence/listening-review.json",
      identity.suiteFingerprint,
      identity.sourceManifestFingerprint,
      sources,
    );
    expect(evidence.review.items).toHaveLength(42);
    expect(() => requireApprovedListeningReview(evidence)).toThrow(/canonical baseline and promotion are blocked/);

    const approved = structuredClone(evidence.review);
    approved.status = "approved";
    approved.reviewer = { name: "Human Reviewer", role: "music review" };
    approved.reviewedAt = "2026-07-10T12:00:00.000Z";
    approved.attestation = LISTENING_REVIEW_ATTESTATION;
    for (const item of approved.items) {
      item.review.rhythmPlausible = true;
      item.review.phraseCoherent = true;
      item.review.variantFaithfulToParent = item.parentId === undefined ? "not_applicable" : true;
    }
    expect(() => requireApprovedListeningReview({ ...evidence, review: approved })).not.toThrow();

    const missingAudioPath = join(mkdtempSync(join(tmpdir(), "v2-listening-")), "approved.json");
    const missingAudio = structuredClone(approved);
    missingAudio.items[0].audio = join(tmpdir(), "definitely-missing-v2-click.wav");
    writeFileSync(missingAudioPath, `${JSON.stringify(missingAudio)}\n`);
    await expect(loadListeningReview(
      missingAudioPath,
      identity.suiteFingerprint,
      identity.sourceManifestFingerprint,
      sources,
    )).rejects.toThrow(/approved listening review audio file is missing/);

    const tamperedPath = join(mkdtempSync(join(tmpdir(), "v2-listening-")), "review.json");
    const tampered = structuredClone(evidence.review);
    tampered.items[0].audioSha256 = "0".repeat(64);
    writeFileSync(tamperedPath, `${JSON.stringify(tampered)}\n`);
    await expect(loadListeningReview(
      tamperedPath,
      identity.suiteFingerprint,
      identity.sourceManifestFingerprint,
      sources,
    )).rejects.toThrow(/audio (file does not match|is stale)/);
  });

  test("a provisional baseline creates a blocked confirmation state", () => {
    const dir = mkdtempSync(join(tmpdir(), "v2-governance-"));
    const statePath = join(dir, "state.json");
    const state = initializeConfirmationStateFromBaseline("benchmark/v2/baseline.json", statePath);
    expect(state.status).toBe("blocked");
    expect(state.attempt).toBeNull();
    expect(() => assertBaselineTransitionAllowed("candidate", "suite", join(dir, "missing.json")))
      .toThrow(/confirmation state is missing/);
  });

  test("mechanically rejects stale decision calibration", () => {
    const sources = resolveSources(loadSourceManifest(sourcePath));
    const identity = suiteIdentity(suitePath, sourcePath, sources);
    expect(() => requireCurrentDecisionCalibration(identity.suiteFingerprint)).not.toThrow();
    const dir = mkdtempSync(join(tmpdir(), "v2-calibration-"));
    const calibrationPath = join(dir, "calibration.json");
    const calibration = JSON.parse(readFileSync("benchmark/v2/studies/decision-calibration.json", "utf8"));
    calibration.decisionFingerprint = "0".repeat(64);
    writeFileSync(calibrationPath, `${JSON.stringify(calibration)}\n`);
    expect(() => requireCurrentDecisionCalibration(identity.suiteFingerprint, calibrationPath))
      .toThrow(/decision calibration is stale/);
  });

  test("calibration identity ignores timestamps but binds substantive evidence", () => {
    const calibration = JSON.parse(readFileSync("benchmark/v2/studies/decision-calibration.json", "utf8"));
    const timestampOnly = structuredClone(calibration);
    timestampOnly.generatedAt = "2099-01-01T00:00:00.000Z";
    expect(decisionCalibrationFingerprint(timestampOnly)).toBe(decisionCalibrationFingerprint(calibration));

    const changedEvidence = structuredClone(calibration);
    changedEvidence.coverageStudy.sha256 = "0".repeat(64);
    expect(decisionCalibrationFingerprint(changedEvidence)).not.toBe(decisionCalibrationFingerprint(calibration));
  });

  test("mechanically rejects missing retained calibration evidence", () => {
    const sources = resolveSources(loadSourceManifest("benchmark/v2/compat/source-manifest.json"));
    const identity = suiteIdentity(
      "benchmark/v2/compat/suite-manifest.json",
      "benchmark/v2/compat/source-manifest.json",
      sources,
    );
    const dir = mkdtempSync(join(tmpdir(), "v2-calibration-evidence-"));
    const calibrationPath = join(dir, "calibration.json");
    const calibration = JSON.parse(readFileSync("benchmark/v2/studies/decision-calibration.json", "utf8"));
    calibration.controls.identical.baseArchive = join(dir, "missing.json.gz");
    calibration.controls.identical.baseArchiveSha256 = "0".repeat(64);
    writeFileSync(calibrationPath, `${JSON.stringify(calibration)}\n`);
    expect(() => requireCurrentDecisionCalibration(identity.suiteFingerprint, calibrationPath))
      .toThrow(/identical base control is missing/);
  });

  test("mechanically rejects fresh but statistically inadequate coverage", () => {
    const coverage = JSON.parse(readFileSync("benchmark/v2/studies/decision-coverage.json", "utf8"));
    expect(() => assertDecisionCoverageAdequate(coverage)).not.toThrow();
    const inconsistent = structuredClone(coverage);
    inconsistent.results.find((row: any) => row.scenario === "empirical_blocks").falseAccept.count = 900;
    expect(() => assertDecisionCoverageAdequate(inconsistent)).toThrow(/inconsistent with its count/);
    const inadequate = structuredClone(coverage);
    const row = inadequate.results.find((entry: any) => entry.scenario === "empirical_blocks");
    row.positiveOutcome = row.falseAccept = { count: 900, rate: 0.9, wilson95: [0.8798, 0.9171] };
    row.unresolvedOutcome = { count: 95, rate: 0.095, wilson95: [0.0783, 0.1148] };
    expect(() => assertDecisionCoverageAdequate(inadequate)).toThrow(/false accept upper bound/);
    const incomplete = JSON.parse(readFileSync("benchmark/v2/studies/decision-coverage.json", "utf8"));
    incomplete.results = incomplete.results.filter((row: any) => row.scenario !== "catalog_wide_hard_zero");
    expect(() => assertDecisionCoverageAdequate(incomplete)).toThrow(/catalog_wide_hard_zero.*missing/);

    const powerless = structuredClone(coverage);
    const powered = powerless.powerResults.find((entry: any) => entry.scenario === "empirical_score_gain");
    const knownLowPower = powerless.diagnosticResults.find(
      (entry: any) => entry.scenario === "hard_zero_validity_gain",
    );
    powered.positiveOutcome = structuredClone(knownLowPower.positiveOutcome);
    powered.negativeOutcome = structuredClone(knownLowPower.negativeOutcome);
    powered.unresolvedOutcome = structuredClone(knownLowPower.unresolvedOutcome);
    expect(() => assertDecisionCoverageAdequate(powerless)).toThrow(/power lower bound/);
  });

  test("allocates non-overlapping canonical epochs above the probe and calibration range", () => {
    const ledger: ConfirmationState["seedLedger"] = [];
    for (let index = 0; index < 20; index++) {
      const canonicalSeedBase = allocateCanonicalSeedBase(ledger, 24);
      expect(canonicalSeedBase).toBeGreaterThanOrEqual(1_000_000);
      expect(ledger.every((entry) =>
        canonicalSeedBase + 24 <= entry.canonicalSeedBase ||
        entry.canonicalSeedBase + entry.seedCount <= canonicalSeedBase
      )).toBe(true);
      ledger.push({
        attemptId: `attempt-${index}`,
        canonicalSeedBase,
        seedCount: 24,
        seedScheduleFingerprint: "0".repeat(64),
      });
    }
  });

  test("rejects a tampered compiler snapshot archive", () => {
    const dir = mkdtempSync(join(tmpdir(), "v2-snapshot-"));
    const archive = join(dir, "snapshot.tar.gz");
    writeFileSync(archive, "snapshot bytes\n");
    const snapshot = {
      schema: "line.benchmark-v2.compiler-snapshot.v1" as const,
      archive,
      archiveSha256: sha256(readFileSync(archive)),
      candidateFingerprint: "1".repeat(64),
      compilerSourceFingerprint: "2".repeat(64),
      compilerEnvironment: {},
      engineArtifactFingerprint: "3".repeat(64),
    };
    expect(() => validateCompilerSnapshot(snapshot)).not.toThrow();
    writeFileSync(archive, "tampered bytes\n");
    expect(() => validateCompilerSnapshot(snapshot)).toThrow(/checksum mismatch/);
  });

  test("resume retries failures and keeps the latest successful result", () => {
    const recovered = latestSuccessfulResults([
      { key: "a", status: "timeout", value: 1 },
      { key: "b", status: "ok", value: 2 },
      { key: "a", status: "ok", value: 3 },
      { key: "c", status: "error", value: 4 },
    ], (entry) => entry.key);
    expect(recovered).toEqual([
      { key: "a", status: "ok", value: 3 },
      { key: "b", status: "ok", value: 2 },
    ]);
  });

  test("binds one canonical archive to its predeclared mode and consumes it exactly once", () => {
    const sources = resolveSources(loadSourceManifest(sourcePath));
    const suiteFingerprint = suiteIdentity(suitePath, sourcePath, sources).suiteFingerprint;
    const decisionContract = requireCurrentDecisionCalibration(suiteFingerprint);
    const dir = mkdtempSync(join(tmpdir(), "v2-governance-"));
    const declarationPath = join(dir, "declaration.json");
    const statePath = join(dir, "state.json");
    const decisionPath = join(dir, "decision.json");
    const candidatePath = join(dir, "candidate.json");
    const snapshotPath = join(dir, "candidate-snapshot.tar.gz");
    const baselineFingerprint = "3".repeat(64);
    const candidateFingerprint = "4".repeat(64);
    writeFileSync(candidatePath, "candidate evidence\n");
    writeFileSync(snapshotPath, "candidate snapshot\n");
    writeFileSync(decisionPath, "decision evidence\n");
    const declaration: ConfirmationDeclaration = {
      schema: CONFIRMATION_DECLARATION_SCHEMA,
      attemptId: "attempt",
      declaredAt: "2026-07-10T12:00:00.000Z",
      baselineLabel: "baseline",
      baselineCandidateFingerprint: baselineFingerprint,
      baselineSuiteFingerprint: suiteFingerprint,
      baselineSnapshotSha256: "snapshot-sha",
      baselineDecisionFingerprint: decisionContract.decisionFingerprint,
      baselineCalibrationFingerprint: decisionContract.calibrationFingerprint,
      candidateFingerprint,
      candidateSnapshot: {
        schema: "line.benchmark-v2.compiler-snapshot.v1",
        archive: snapshotPath,
        archiveSha256: sha256(readFileSync(snapshotPath)),
        candidateFingerprint,
        compilerSourceFingerprint: "1".repeat(64),
        compilerEnvironment: {},
        engineArtifactFingerprint: "2".repeat(64),
      },
      canonicalSeedBase: 100,
      seedScheduleFingerprint: sha256(Buffer.from(JSON.stringify({ seedBase: 100 }))),
      mode: "simplification",
      margin: 0.5,
      statement: "predeclared",
    };
    writeFileSync(declarationPath, `${JSON.stringify(declaration)}\n`);
    const declarationSha = sha256(readFileSync(declarationPath));
    const state: ConfirmationState = {
      schema: CONFIRMATION_STATE_SCHEMA,
      status: "evidence-ready",
      reason: null,
      baseline: {
        label: "baseline",
        suiteFingerprint,
        archiveSha256: "base-sha",
        candidateFingerprint: baselineFingerprint,
        listeningReviewFingerprint: "review",
        compilerSnapshot: declaration.candidateSnapshot,
        decisionFingerprint: decisionContract.decisionFingerprint,
        calibrationFingerprint: decisionContract.calibrationFingerprint,
      },
      seedLedger: [{
        attemptId: "attempt",
        canonicalSeedBase: 100,
        seedCount: 24,
        seedScheduleFingerprint: declaration.seedScheduleFingerprint,
      }],
      attempt: {
        declarationPath,
        declarationSha256: declarationSha,
        declaration,
        baseArchivePath: "base.json",
        baseArchiveSha256: "base-sha",
        developmentArchivePath: candidatePath,
        developmentArchiveSha256: "candidate-sha",
      },
    };
    writeFileSync(statePath, `${JSON.stringify(state)}\n`);

    expect(() => validateConfirmationEvidence(statePath, {
      baseArchiveSha256: "base-sha",
      baseCandidateFingerprint: baselineFingerprint,
      candidateArchiveSha256: "candidate-sha",
      candidateFingerprint,
      suiteFingerprint,
      baseConfirmationDeclaration: { path: declarationPath, sha256: declarationSha },
      confirmationDeclaration: { path: declarationPath, sha256: declarationSha },
      seedSchedule: { seedBase: 100 },
      mode: "simplification",
      margin: 0.5,
    })).not.toThrow();
    const staleContractState = structuredClone(state);
    staleContractState.baseline.decisionFingerprint = "0".repeat(64);
    writeFileSync(statePath, `${JSON.stringify(staleContractState)}\n`);
    expect(() => validateConfirmationEvidence(statePath, {
      baseArchiveSha256: "base-sha",
      baseCandidateFingerprint: baselineFingerprint,
      candidateArchiveSha256: "candidate-sha",
      candidateFingerprint,
      suiteFingerprint,
      baseConfirmationDeclaration: { path: declarationPath, sha256: declarationSha },
      confirmationDeclaration: { path: declarationPath, sha256: declarationSha },
      seedSchedule: { seedBase: 100 },
      mode: "simplification",
      margin: 0.5,
    })).toThrow(/decision or calibration contract differs/);
    writeFileSync(statePath, `${JSON.stringify(state)}\n`);
    expect(() => validateConfirmationEvidence(statePath, {
      baseArchiveSha256: "base-sha",
      baseCandidateFingerprint: baselineFingerprint,
      candidateArchiveSha256: "candidate-sha",
      candidateFingerprint,
      suiteFingerprint,
      baseConfirmationDeclaration: { path: declarationPath, sha256: declarationSha },
      confirmationDeclaration: { path: declarationPath, sha256: declarationSha },
      seedSchedule: { seedBase: 100 },
      mode: "simplification",
      margin: 0.6,
    })).toThrow(/predeclared candidate, mode, margin/);
    expect(() => validateConfirmationEvidence(statePath, {
      baseArchiveSha256: "base-sha",
      baseCandidateFingerprint: baselineFingerprint,
      candidateArchiveSha256: "candidate-sha",
      candidateFingerprint,
      suiteFingerprint,
      baseConfirmationDeclaration: { path: declarationPath, sha256: declarationSha },
      confirmationDeclaration: { path: declarationPath, sha256: declarationSha },
      seedSchedule: { seedBase: 101 },
      mode: "simplification",
      margin: 0.5,
    })).toThrow(/fresh seed epoch/);

    consumeConfirmation(
      statePath,
      "candidate-sha",
      "simplification",
      0.5,
      decisionPath,
      "inconclusive",
    );
    const consumed = JSON.parse(readFileSync(statePath, "utf8"));
    expect(consumed.status).toBe("consumed");
    expect(consumed.attempt.outcome).toBe("inconclusive");
    expect(() => assertBaselineTransitionAllowed("candidate-id", suiteFingerprint, statePath)).toThrow(/new baseline is allowed only/);
    expect(() => assertBaselineTransitionAllowed("candidate-id", "new-suite", statePath)).not.toThrow();
    expect(() => consumeConfirmation(
      statePath,
      "candidate-sha",
      "simplification",
      0.5,
      decisionPath,
      "inconclusive",
    )).toThrow(/one-shot confirmation/);

    consumed.attempt.outcome = "accept";
    writeFileSync(statePath, `${JSON.stringify(consumed)}\n`);
    expect(() => assertBaselineTransitionAllowed(candidateFingerprint, suiteFingerprint, statePath)).not.toThrow();
    expect(() => assertBaselineTransitionAllowed("different-candidate", suiteFingerprint, statePath)).toThrow(/new baseline is allowed only/);
  });
});

function sha256(value: Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
