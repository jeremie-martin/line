import { describe, expect, test } from "vitest";
import {
  CAMPAIGN_BOOTSTRAP_REQUEST_SCHEMA,
  sha256,
  validateCampaignBootstrapRequest,
  type CampaignBootstrapRequest,
} from "../scripts/v0/benchmark_v2/campaign_bootstrap_request.ts";

const hash = "a".repeat(64);
const seeds = [
  16, 17, 18, 19, 20, 21, 22, 23,
  ...Array.from({ length: 40 }, (_, index) => 608 + index),
];
const schedule = {
  kind: "profile_budget_disjoint_contiguous" as const,
  profile: "canonical" as const,
  seedBase: 0,
  seedsPerBudget: 48,
  byBudget: [{ budget: 750_000, actualSeeds: seeds }],
};
const request: CampaignBootstrapRequest = {
  schema: CAMPAIGN_BOOTSTRAP_REQUEST_SCHEMA,
  status: "authorized",
  purpose: "scorer-bound-active-campaign-baseline-bootstrap",
  generatedAt: "2026-07-31T00:00:00.000Z",
  label: "contact-redir-impulse-v2-750k",
  sourceCampaignBaseline: {
    path: "benchmark/v2/campaign-baseline.json",
    sha256: hash,
    label: "prior",
    suiteFingerprint: "b".repeat(64),
    use: "literal-seed-schedule-only",
  },
  scoringBoundary: {
    priorScorer: "net-redirection-arc",
    currentScorer: "accumulated-contacted-frame-impulse",
    goldenEvaluatorFingerprint: "07cf88383150",
    suiteFingerprint: "c".repeat(64),
    scoringProtocolFingerprint: "d".repeat(64),
    crossRulerComparison: false,
  },
  authority: {
    profile: "canonical",
    mode: "development",
    budgets: [750_000],
    seedsPerCase: 48,
    developmentCases: 44,
    expectedPaidCompiles: 2_112,
    jobs: 48,
    optimizedWasmOnly: true,
    ordinaryThreeBudgetWorkflow: false,
    deferredBudgetsRecomputed: false,
  },
  canonicalSeedBase: 0,
  seedScheduleFingerprint: sha256(JSON.stringify(schedule)),
  canonicalSeedSchedule: schedule,
  candidateFingerprint: "e".repeat(64),
  candidateSnapshot: {
    schema: "line.benchmark-v2.compiler-snapshot.v1",
    archive: "benchmark/v2/runs/contact-redir-impulse-v2-750k-compiler-snapshot.tar.gz",
    archiveSha256: "f".repeat(64),
    candidateFingerprint: "e".repeat(64),
    compilerSourceFingerprint: "1".repeat(64),
    compilerEnvironment: {},
    engineArtifactFingerprint: "2".repeat(64),
  },
  outputPath: "generated/benchmark-v2/bootstrap/contact-redir-impulse-v2-750k-development.json",
};
const expected = {
  label: request.label,
  suiteFingerprint: request.scoringBoundary.suiteFingerprint,
  scoringProtocolFingerprint: request.scoringBoundary.scoringProtocolFingerprint,
  goldenEvaluatorFingerprint: request.scoringBoundary.goldenEvaluatorFingerprint,
  candidateFingerprint: request.candidateFingerprint,
  engineArtifactFingerprint: request.candidateSnapshot.engineArtifactFingerprint,
  budgets: [750_000],
  seedSchedule: schedule,
  developmentCases: 44,
  jobs: 48,
};

describe("campaign scorer-bound bootstrap request", () => {
  test("authorizes only the exact 750k/N=48/44-case/48-job request", () => {
    expect(() => validateCampaignBootstrapRequest(request, expected)).not.toThrow();
  });

  test("rejects cross-ruler comparison and seed-schedule mutations", () => {
    expect(() => validateCampaignBootstrapRequest({
      ...request,
      scoringBoundary: {
        ...request.scoringBoundary,
        crossRulerComparison: true as false,
      },
    }, expected)).toThrow(/does not authorize/);

    expect(() => validateCampaignBootstrapRequest({
      ...request,
      canonicalSeedSchedule: {
        ...schedule,
        byBudget: [{ budget: 750_000, actualSeeds: [...seeds.slice(0, 47), 648] }],
      },
    }, expected)).toThrow(/does not authorize/);
  });
});
