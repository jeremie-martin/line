import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, renameSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { assessLongCarrierReplication } from "../scripts/v0/trajectory/long_carrier_replication_assessment.ts";
import {
  LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES,
  LONG_CARRIER_REPLICATION_PROTOCOL,
  LONG_CARRIER_REPLICATION_SCOPE,
  longCarrierReplicationArtifactPaths,
  longCarrierReplicationAssayArgv,
  longCarrierReplicationAssayScriptArgv,
  longCarrierReplicationCaptureArgv,
  longCarrierReplicationCaptureScriptArgv,
} from "../scripts/v0/trajectory/long_carrier_replication_protocol.ts";
import {
  LONG_CARRIER_REPLICATION_DECLARATION_SCHEMA,
  LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
  LONG_CARRIER_REPLICATION_LEDGER_SCHEMA,
  writeSealedReplicationRecord,
} from "../scripts/v0/trajectory/long_carrier_replication_records.ts";
import { sha256, stableJson } from "../scripts/v0/trajectory/frozen_fixture.ts";
import { writeImmutableJsonArtifact } from "../scripts/v0/trajectory/study_artifact.ts";
import {
  LONG_CARRIER_TEST_CAPTURE_RUNTIME,
  LONG_CARRIER_TEST_FEASIBILITY_BINDING,
  LONG_CARRIER_TEST_IDENTITIES,
  LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS,
  qualifiedLongCarrierReplicationFeasibility,
  resealFixtureAndRebindAssay,
  validLongCarrierReplicationCohort,
} from "./support/long_carrier_replication_evidence.ts";

type RootOptions = {
  declarationTemplateBudget?: number;
  fixtureArgvBudget?: number;
  feasibilityMismatch?: boolean;
  outgoingGeometryMismatch?: boolean;
};

function createSealedRoot(options: RootOptions = {}): string {
  const root = mkdtempSync(join(tmpdir(), "line-long-carrier-verifier-"));
  const cohort = validLongCarrierReplicationCohort();
  const templates = structuredClone(LONG_CARRIER_REPLICATION_COMMAND_TEMPLATES) as {
    capture: string[];
    assay: string[];
  };
  if (options.declarationTemplateBudget !== undefined) {
    templates.capture = templates.capture.map((token) => token === "--budget=500000"
      ? `--budget=${options.declarationTemplateBudget}`
      : token);
  }
  const declaration = writeSealedReplicationRecord(join(root, "declaration.json"), {
    schema: LONG_CARRIER_REPLICATION_DECLARATION_SCHEMA,
    scope: LONG_CARRIER_REPLICATION_SCOPE,
    createdAt: "2026-07-14T00:00:00.000Z",
    protocol: LONG_CARRIER_REPLICATION_PROTOCOL,
    protocolFingerprint: fingerprint(LONG_CARRIER_REPLICATION_PROTOCOL),
    cases: LONG_CARRIER_REPLICATION_PROTOCOL.cases,
    environment: { LR_ENGINE: "wasm" },
    captureBudget: 500_000,
    publicationRoot: root,
    command: { executable: process.execPath, templates },
    // Git currently uses SHA-1 object IDs here; the verifier also accepts
    // SHA-256 repositories without conflating either with content hashes.
    sourceRevision: { head: "1".repeat(40), tree: "2".repeat(40) },
    definitionPaths: Object.keys(LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS).sort(),
    definitionFileFingerprints: LONG_CARRIER_TEST_PANEL_SOURCE_FINGERPRINTS,
    execution: {
      controllerSourceIdentity: { sourceFiles: [], fingerprint: "3".repeat(64) },
      verifierSourceIdentity: { sourceFiles: [], fingerprint: "4".repeat(64) },
      feasibilitySourceIdentity: {
        sourceFiles: ["scripts/v0/run_long_carrier_replication_feasibility.ts"],
        fingerprint: LONG_CARRIER_TEST_FEASIBILITY_BINDING.feasibilitySourceFingerprint,
      },
      captureSourceIdentity: { sourceFiles: [], fingerprint: LONG_CARRIER_TEST_IDENTITIES.captureStudySourceFingerprint },
      captureRuntime: LONG_CARRIER_TEST_CAPTURE_RUNTIME,
      assaySourceIdentity: { sourceFiles: [], fingerprint: LONG_CARRIER_TEST_IDENTITIES.assaySourceFingerprint },
      captureCandidate: { candidateFingerprint: LONG_CARRIER_TEST_IDENTITIES.captureCandidateFingerprint },
      assayRuntime: { fingerprint: LONG_CARRIER_TEST_IDENTITIES.assayRuntimeFingerprint },
    },
    captureFeasibility: qualifiedLongCarrierReplicationFeasibility(),
  }, "synthetic replication declaration");
  const events: string[] = [];
  for (const [index, entry] of LONG_CARRIER_REPLICATION_PROTOCOL.cases.entries()) {
    const ordinal = index + 1;
    const padded = String(ordinal).padStart(2, "0");
    const paths = longCarrierReplicationArtifactPaths(ordinal, entry.id);
    const fixturePath = join(root, paths.fixture);
    const assayPath = join(root, paths.assay);
    const expectedCaptureArgv = longCarrierReplicationCaptureArgv(entry, fixturePath);
    const captureArgv = options.declarationTemplateBudget === undefined
      ? expectedCaptureArgv
      : expectedCaptureArgv.map((token) => token === "--budget=500000" ? `--budget=${options.declarationTemplateBudget}` : token);
    const assayArgv = longCarrierReplicationAssayArgv(fixturePath, assayPath);
    const captureScriptArgv = options.declarationTemplateBudget === undefined
      ? longCarrierReplicationCaptureScriptArgv(entry, fixturePath)
      : captureArgv.slice(3);
    const assayScriptArgv = longCarrierReplicationAssayScriptArgv(fixturePath, assayPath);
    const entryEvidence = cohort[index]!;
    resealFixtureAndRebindAssay(entryEvidence, (fixture) => {
      fixture.capture.argv = options.fixtureArgvBudget === undefined
        ? captureScriptArgv
        : captureScriptArgv.map((token) => token === "--budget=500000" ? `--budget=${options.fixtureArgvBudget}` : token);
      if (options.feasibilityMismatch === true && index === 0) {
        fixture.physicalPrefix.prefixNextLineId = 2;
      }
      if (options.outgoingGeometryMismatch === true && index === 0) {
        fixture.panel.outgoingGap = entry.targetGap + 2;
        fixture.panel.outgoingFrame += 10;
        fixture.panel.outgoingIntervalFrames += 10;
      }
    }, (artifact) => {
      artifact.argv = assayScriptArgv;
      artifact.provenance.fixturePath = fixturePath;
    });
    const fixture = entryEvidence.capture.fixture as Record<string, unknown>;
    const assay = entryEvidence.assay.artifact as Record<string, unknown>;
    writeImmutableJsonArtifact(fixturePath, fixture, "synthetic replication fixture");
    writeImmutableJsonArtifact(assayPath, assay, "synthetic replication assay");

    const capturePlanPath = `events/${padded}-capture-${entry.id}.plan.json`;
    const captureResultPath = `events/${padded}-capture-${entry.id}.result.json`;
    const assayPlanPath = `events/${padded}-assay-${entry.id}.plan.json`;
    const assayResultPath = `events/${padded}-assay-${entry.id}.result.json`;
    const captureEventArgv = [process.execPath, ...captureArgv];
    const assayEventArgv = [process.execPath, ...assayArgv];
    writeSealedReplicationRecord(join(root, capturePlanPath), stagePlan("capture", entry.id, ordinal, declaration.recordFingerprint, captureEventArgv, paths.fixture), "synthetic capture plan");
    writeSealedReplicationRecord(join(root, captureResultPath), stageResult("capture", entry.id, ordinal, declaration.recordFingerprint, capturePlanPath, captureEventArgv, paths.fixture, fixture.fixtureFingerprint), "synthetic capture result");
    writeSealedReplicationRecord(join(root, assayPlanPath), stagePlan("assay", entry.id, ordinal, declaration.recordFingerprint, assayEventArgv, paths.assay), "synthetic assay plan");
    writeSealedReplicationRecord(join(root, assayResultPath), stageResult("assay", entry.id, ordinal, declaration.recordFingerprint, assayPlanPath, assayEventArgv, paths.assay, assay.artifactContentFingerprint), "synthetic assay result");
    events.push(capturePlanPath, captureResultPath, assayPlanPath, assayResultPath);
  }
  const assessment = assessLongCarrierReplication(cohort, LONG_CARRIER_TEST_IDENTITIES);
  writeSealedReplicationRecord(join(root, "ledger.json"), {
    schema: LONG_CARRIER_REPLICATION_LEDGER_SCHEMA,
    scope: LONG_CARRIER_REPLICATION_SCOPE,
    declarationPath: "declaration.json",
    declarationFingerprint: declaration.recordFingerprint,
    completed: true,
    abortReason: null,
    eventPaths: events,
    assessment,
  }, "synthetic replication ledger");
  return root;
}

function stagePlan(
  stage: "capture" | "assay",
  id: string,
  ordinal: number,
  declarationFingerprint: string,
  argv: string[],
  requestedArtifactPath: string,
) {
  return {
    schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
    kind: "plan",
    stage,
    id,
    ordinal,
    declarationFingerprint,
    argv,
    environment: { LR_ENGINE: "wasm" },
    requestedArtifactPath,
  };
}

function stageResult(
  stage: "capture" | "assay",
  id: string,
  ordinal: number,
  declarationFingerprint: string,
  planPath: string,
  argv: string[],
  requestedArtifactPath: string,
  fingerprint: string,
) {
  return {
    schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
    kind: "result",
    stage,
    id,
    ordinal,
    declarationFingerprint,
    planPath,
    argv,
    environment: { LR_ENGINE: "wasm" },
    requestedArtifactPath,
    artifactPath: requestedArtifactPath,
    observedArtifactPaths: [requestedArtifactPath],
    artifact: { fingerprint },
    artifactError: null,
    classification: stage === "capture" ? "captured" : "assayed",
    child: successfulChild(),
  };
}

function successfulChild() {
  return {
    exitCode: 0,
    signal: null,
    error: null,
    elapsedMs: 1,
    stdoutSha256: fingerprint(""),
    stderrSha256: fingerprint(""),
    stdoutTail: "",
    stderrTail: "",
  };
}

function fingerprint(value: unknown): string {
  return sha256(stableJson(value));
}

function verify(root: string, strict = false) {
  return spawnSync(process.execPath, [
    "--import",
    "tsx",
    "scripts/v0/verify_long_carrier_replication.ts",
    `--out-dir=${root}`,
    ...(strict ? ["--require-current-identity"] : []),
  ], { cwd: process.cwd(), encoding: "utf8" });
}

function rewriteSealedRecord(
  path: string,
  label: string,
  mutate: (payload: Record<string, unknown>) => void,
): void {
  const record = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
  delete record.recordFingerprint;
  mutate(record);
  rmSync(path);
  writeSealedReplicationRecord(path, record, label);
}

describe("long-carrier replication verifier", () => {
  test("reconstructs a sealed historical root without consulting the current candidate", () => {
    const result = verify(createSealedRoot());
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("supported_local_duration_response");
    expect(result.stdout).not.toContain("historical identity differs");

    const strict = verify(createSealedRoot(), true);
    expect(strict.status).not.toBe(0);
    expect(`${strict.stdout}\n${strict.stderr}`).toContain("current controller, verifier, feasibility, capture, compiler candidate, assay source, or runtime identity differs");
  });

  test("verifies a moved output root against its declared historical publication paths", () => {
    const root = createSealedRoot();
    const moved = `${root}-moved`;
    renameSync(root, moved);

    const result = verify(moved);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("supported_local_duration_response");
  });

  test("rejects a coherent alternate declared budget before it can borrow the v1 verdict", () => {
    const result = verify(createSealedRoot({ declarationTemplateBudget: 499_999 }));
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("command templates do not match");
  });

  test("rejects a fixture whose emitted argv disagrees with the planned invocation", () => {
    const result = verify(createSealedRoot({ fixtureArgvBudget: 499_999 }));
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("fixture capture argv does not match");
  });

  test("rejects a captured fixture that does not reproduce its sealed feasibility witness", () => {
    const result = verify(createSealedRoot({ feasibilityMismatch: true }));
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("captured result lacks one successful normal fixture publication");
  });

  test("rejects a captured fixture whose rehashed outgoing geometry differs from its declared case", () => {
    const result = verify(createSealedRoot({ outgoingGeometryMismatch: true }));
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("captured result lacks one successful normal fixture publication");
  });

  test("requires an invalid capture event to preserve its exact recomputed witness error", () => {
    const root = createSealedRoot({ feasibilityMismatch: true });
    const first = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;
    rewriteSealedRecord(
      join(root, "events", `01-capture-${first.id}.result.json`),
      "synthetic mismatched witness error",
      (result) => {
        result.classification = "invalid";
        result.artifactError = "fixture does not reproduce sealed feasibility witness: stale synthetic reason";
      },
    );

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("indistinguishable from a successful normal capture");
  });

  test("rejects an unledgered identity-drift sibling beside a normal fixture", () => {
    const root = createSealedRoot();
    const first = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;
    const paths = longCarrierReplicationArtifactPaths(1, first.id);
    const fixture = JSON.parse(readFileSync(join(root, paths.fixture), "utf8"));
    writeImmutableJsonArtifact(
      join(root, paths.fixture.replace(/\.json$/, ".identity-drift-synthetic.json")),
      fixture,
      "synthetic unledgered drift fixture",
    );

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("artifact inventory does not match");
  });

  test("rejects any other unledgered JSON artifact in the publication directories", () => {
    const root = createSealedRoot();
    writeImmutableJsonArtifact(join(root, "fixtures", "stray.json"), { stray: true }, "synthetic stray artifact");

    const result = verify(root);
    expect(result.status).not.toBe(0);
    expect(`${result.stdout}\n${result.stderr}`).toContain("unledgered fixture or assay artifacts");
  });

  test("rejects a completed ledger with a contradictory scope or abort state", () => {
    const wrongScope = createSealedRoot();
    rewriteSealedRecord(join(wrongScope, "ledger.json"), "wrong-scope ledger", (ledger) => {
      ledger.scope = "other_scope";
    });
    const wrongScopeResult = verify(wrongScope);
    expect(wrongScopeResult.status).not.toBe(0);
    expect(`${wrongScopeResult.stdout}\n${wrongScopeResult.stderr}`).toContain("does not bind the sealed declaration");

    const retainedAbort = createSealedRoot();
    rewriteSealedRecord(join(retainedAbort, "ledger.json"), "aborted completed ledger", (ledger) => {
      ledger.abortReason = "unexpected retained abort";
    });
    const retainedAbortResult = verify(retainedAbort);
    expect(retainedAbortResult.status).not.toBe(0);
    expect(`${retainedAbortResult.stdout}\n${retainedAbortResult.stderr}`).toContain("cannot retain an abort reason");
  });

  test("rejects an unledgered event and a falsely successful child", () => {
    const unledgeredEvent = createSealedRoot();
    const declaration = JSON.parse(readFileSync(join(unledgeredEvent, "declaration.json"), "utf8")) as Record<string, unknown>;
    writeSealedReplicationRecord(join(unledgeredEvent, "events", "unledgered-abort.json"), {
      schema: LONG_CARRIER_REPLICATION_EVENT_SCHEMA,
      kind: "abort",
      declarationFingerprint: declaration.recordFingerprint,
      reason: "unledgered abort must remain visible",
    }, "synthetic unledgered abort");
    const unledgeredResult = verify(unledgeredEvent);
    expect(unledgeredResult.status).not.toBe(0);
    expect(`${unledgeredResult.stdout}\n${unledgeredResult.stderr}`).toContain("event inventory does not match");

    const malformedChild = createSealedRoot();
    const first = LONG_CARRIER_REPLICATION_PROTOCOL.cases[0]!;
    rewriteSealedRecord(
      join(malformedChild, "events", `01-capture-${first.id}.result.json`),
      "synthetic malformed child result",
      (result) => {
        const child = result.child as Record<string, unknown>;
        result.child = { ...child, signal: "SIGKILL" };
      },
    );
    const malformedChildResult = verify(malformedChild);
    expect(malformedChildResult.status).not.toBe(0);
    expect(`${malformedChildResult.stdout}\n${malformedChildResult.stderr}`).toContain("lacks one successful normal fixture publication");
  });
});
