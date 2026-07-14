/**
 * The live-run binding deliberately excludes diagnostic repository status.
 * Source closures, compiler candidate bytes, and the assay runtime already
 * have their own content fingerprints; unrelated editor files must not abort
 * a multi-case cohort merely because they appear in a broad Git status.
 */
import { stableJson } from "./frozen_fixture.ts";

export function longCarrierReplicationExecutionBinding(identity: Record<string, unknown>): Record<string, string> {
  return {
    controllerSourceFingerprint: fingerprint(identity, "controllerSourceIdentity", "fingerprint"),
    verifierSourceFingerprint: fingerprint(identity, "verifierSourceIdentity", "fingerprint"),
    captureSourceFingerprint: fingerprint(identity, "captureSourceIdentity", "fingerprint"),
    assaySourceFingerprint: fingerprint(identity, "assaySourceIdentity", "fingerprint"),
    captureCandidateFingerprint: fingerprint(identity, "captureCandidate", "candidateFingerprint"),
    assayRuntimeFingerprint: fingerprint(identity, "assayRuntime", "fingerprint"),
  };
}

export function sameLongCarrierReplicationExecutionBinding(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): boolean {
  return stableJson(longCarrierReplicationExecutionBinding(left)) === stableJson(longCarrierReplicationExecutionBinding(right));
}

function fingerprint(identity: Record<string, unknown>, section: string, field: string): string {
  const value = identity[section];
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`long-carrier execution identity lacks ${section}`);
  }
  const fingerprint = (value as Record<string, unknown>)[field];
  if (typeof fingerprint !== "string" || !/^[a-f0-9]{64}$/.test(fingerprint)) {
    throw new Error(`long-carrier execution identity lacks a SHA-256 ${section}.${field}`);
  }
  return fingerprint;
}
