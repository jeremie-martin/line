import { describe, expect, test } from "vitest";
import {
  longCarrierReplicationExecutionBinding,
  sameLongCarrierReplicationExecutionBinding,
} from "../scripts/v0/trajectory/long_carrier_replication_identity.ts";

function identity() {
  return {
    controllerSourceIdentity: { fingerprint: "a".repeat(64), sourceFiles: ["controller.ts"] },
    verifierSourceIdentity: { fingerprint: "b".repeat(64), sourceFiles: ["verifier.ts"] },
    feasibilitySourceIdentity: { fingerprint: "c".repeat(64), sourceFiles: ["feasibility.ts"] },
    captureSourceIdentity: { fingerprint: "d".repeat(64), sourceFiles: ["capture.ts"] },
    captureRuntime: { fingerprint: "e".repeat(64), platform: "linux" },
    assaySourceIdentity: { fingerprint: "f".repeat(64), sourceFiles: ["assay.ts"] },
    captureCandidate: { candidateFingerprint: "1".repeat(64), trackedChanges: [] },
    assayRuntime: { fingerprint: "2".repeat(64), platform: "linux" },
  };
}

describe("long-carrier live execution identity", () => {
  test("retains detailed diagnostics while comparing only replay-relevant fingerprints", () => {
    const initial = identity();
    const diagnosticOnly = structuredClone(initial);
    diagnosticOnly.captureCandidate.trackedChanges = ["?? unrelated-note.txt"];
    diagnosticOnly.captureRuntime.platform = "other capture diagnostic value";
    diagnosticOnly.assayRuntime.platform = "other diagnostic value";

    expect(sameLongCarrierReplicationExecutionBinding(initial, diagnosticOnly)).toBe(true);
    expect(longCarrierReplicationExecutionBinding(initial)).toEqual({
      controllerSourceFingerprint: "a".repeat(64),
      verifierSourceFingerprint: "b".repeat(64),
      feasibilitySourceFingerprint: "c".repeat(64),
      captureSourceFingerprint: "d".repeat(64),
      captureRuntimeFingerprint: "e".repeat(64),
      assaySourceFingerprint: "f".repeat(64),
      captureCandidateFingerprint: "1".repeat(64),
      assayRuntimeFingerprint: "2".repeat(64),
    });
  });

  test("rejects a changed compiler candidate or source/runtime fingerprint", () => {
    const initial = identity();
    const changed = structuredClone(initial);
    changed.captureCandidate.candidateFingerprint = "0".repeat(64);
    expect(sameLongCarrierReplicationExecutionBinding(initial, changed)).toBe(false);
  });
});
