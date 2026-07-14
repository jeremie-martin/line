import { describe, expect, test } from "vitest";
import {
  longCarrierReplicationExecutionBinding,
  sameLongCarrierReplicationExecutionBinding,
} from "../scripts/v0/trajectory/long_carrier_replication_identity.ts";

function identity() {
  return {
    controllerSourceIdentity: { fingerprint: "a".repeat(64), sourceFiles: ["controller.ts"] },
    verifierSourceIdentity: { fingerprint: "b".repeat(64), sourceFiles: ["verifier.ts"] },
    captureSourceIdentity: { fingerprint: "c".repeat(64), sourceFiles: ["capture.ts"] },
    assaySourceIdentity: { fingerprint: "d".repeat(64), sourceFiles: ["assay.ts"] },
    captureCandidate: { candidateFingerprint: "e".repeat(64), trackedChanges: [] },
    assayRuntime: { fingerprint: "f".repeat(64), platform: "linux" },
  };
}

describe("long-carrier live execution identity", () => {
  test("retains detailed diagnostics while comparing only replay-relevant fingerprints", () => {
    const initial = identity();
    const diagnosticOnly = structuredClone(initial);
    diagnosticOnly.captureCandidate.trackedChanges = ["?? unrelated-note.txt"];
    diagnosticOnly.assayRuntime.platform = "other diagnostic value";

    expect(sameLongCarrierReplicationExecutionBinding(initial, diagnosticOnly)).toBe(true);
    expect(longCarrierReplicationExecutionBinding(initial)).toEqual({
      controllerSourceFingerprint: "a".repeat(64),
      verifierSourceFingerprint: "b".repeat(64),
      captureSourceFingerprint: "c".repeat(64),
      assaySourceFingerprint: "d".repeat(64),
      captureCandidateFingerprint: "e".repeat(64),
      assayRuntimeFingerprint: "f".repeat(64),
    });
  });

  test("rejects a changed compiler candidate or source/runtime fingerprint", () => {
    const initial = identity();
    const changed = structuredClone(initial);
    changed.captureCandidate.candidateFingerprint = "0".repeat(64);
    expect(sameLongCarrierReplicationExecutionBinding(initial, changed)).toBe(false);
  });
});
