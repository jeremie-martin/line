import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { compilerCandidateIdentity } from "../benchmark_v2/compiler_identity.ts";

const CAMPAIGN_BASELINE = resolve("benchmark/v2/campaign-baseline.json");

export type VerificationProvenance = {
  campaignBaselineLabel: string;
  campaignHeadline: number;
  head: string;
  compilerSourceFingerprint: string;
  candidateFingerprint: string;
  engineArtifactFingerprint: string | null;
};

/**
 * Bind a freshly recorded behavior fixture to the governed compiler that made
 * it. Verification remains a behavior oracle after source-only refactors: the
 * provenance is descriptive on reads, while recording refuses to bless a
 * working tree that is not the active campaign compiler.
 */
export function currentCampaignVerificationProvenance(): VerificationProvenance {
  const baseline = JSON.parse(readFileSync(CAMPAIGN_BASELINE, "utf8"));
  const identity = compilerCandidateIdentity("wasm");
  const mismatches = [
    identity.compilerSourceFingerprint === baseline.compiler_source_fingerprint
      ? null
      : "compiler source fingerprint",
    identity.candidateFingerprint === baseline.candidate_fingerprint
      ? null
      : "candidate fingerprint",
    identity.engineArtifactFingerprint === baseline.engine_artifact_fingerprint
      ? null
      : "engine artifact fingerprint",
  ].filter((value): value is string => value !== null);
  if (mismatches.length > 0) {
    throw new Error(
      `refusing to record verification fixtures from a compiler that does not match ` +
      `the active campaign baseline (${mismatches.join(", ")})`,
    );
  }
  return {
    campaignBaselineLabel: baseline.label,
    campaignHeadline: baseline.development.canonical_headline,
    head: identity.head,
    compilerSourceFingerprint: identity.compilerSourceFingerprint,
    candidateFingerprint: identity.candidateFingerprint,
    engineArtifactFingerprint: identity.engineArtifactFingerprint,
  };
}

export function formatVerificationProvenance(
  provenance: VerificationProvenance | undefined,
): string {
  if (provenance === undefined) return "unbound historical fixture";
  return `${provenance.campaignBaselineLabel} @ ${provenance.head.slice(0, 12)} ` +
    `(candidate ${provenance.candidateFingerprint.slice(0, 12)})`;
}
