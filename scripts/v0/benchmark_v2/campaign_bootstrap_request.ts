import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { CompilerSnapshot } from "./compiler_snapshot.ts";
import type { ResolvedSeedSchedule } from "./suite_model.ts";

export const CAMPAIGN_BOOTSTRAP_REQUEST_SCHEMA =
  "line.benchmark-v2.campaign-bootstrap-request.v1" as const;

export type CampaignBootstrapRequest = {
  schema: typeof CAMPAIGN_BOOTSTRAP_REQUEST_SCHEMA;
  status: "authorized";
  purpose: "scorer-bound-active-campaign-baseline-bootstrap";
  generatedAt: string;
  label: string;
  sourceCampaignBaseline: {
    path: string;
    sha256: string;
    label: string;
    suiteFingerprint: string;
    use: "literal-seed-schedule-only";
  };
  scoringBoundary: {
    priorScorer: "net-redirection-arc";
    currentScorer: "accumulated-contacted-frame-impulse";
    goldenEvaluatorFingerprint: string;
    suiteFingerprint: string;
    scoringProtocolFingerprint: string;
    crossRulerComparison: false;
  };
  authority: {
    profile: "canonical";
    mode: "development";
    budgets: [number];
    seedsPerCase: number;
    developmentCases: number;
    expectedPaidCompiles: number;
    jobs: number;
    optimizedWasmOnly: true;
    ordinaryThreeBudgetWorkflow: false;
    deferredBudgetsRecomputed: false;
  };
  canonicalSeedBase: number;
  seedScheduleFingerprint: string;
  canonicalSeedSchedule: ResolvedSeedSchedule;
  candidateFingerprint: string;
  candidateSnapshot: CompilerSnapshot;
  outputPath: string;
};

export function readCampaignBootstrapRequest(path: string): CampaignBootstrapRequest {
  return JSON.parse(readFileSync(path, "utf8")) as CampaignBootstrapRequest;
}

export function validateCampaignBootstrapRequest(
  request: CampaignBootstrapRequest,
  expected: {
    label?: string;
    suiteFingerprint: string;
    scoringProtocolFingerprint: string;
    goldenEvaluatorFingerprint: string;
    candidateFingerprint: string;
    engineArtifactFingerprint: string | null;
    budgets: number[];
    seedSchedule: ResolvedSeedSchedule;
    developmentCases: number;
    jobs?: number;
  },
): void {
  const scheduleFingerprint = sha256(JSON.stringify(request.canonicalSeedSchedule));
  const expectedCompiles =
    expected.developmentCases * request.authority.seedsPerCase * expected.budgets.length;
  if (
    request.schema !== CAMPAIGN_BOOTSTRAP_REQUEST_SCHEMA ||
    request.status !== "authorized" ||
    request.purpose !== "scorer-bound-active-campaign-baseline-bootstrap" ||
    (expected.label !== undefined && request.label !== expected.label) ||
    request.sourceCampaignBaseline?.use !== "literal-seed-schedule-only" ||
    request.scoringBoundary?.priorScorer !== "net-redirection-arc" ||
    request.scoringBoundary?.currentScorer !== "accumulated-contacted-frame-impulse" ||
    request.scoringBoundary?.goldenEvaluatorFingerprint !== expected.goldenEvaluatorFingerprint ||
    request.scoringBoundary?.suiteFingerprint !== expected.suiteFingerprint ||
    request.scoringBoundary?.scoringProtocolFingerprint !== expected.scoringProtocolFingerprint ||
    request.scoringBoundary?.crossRulerComparison !== false ||
    request.authority?.profile !== "canonical" ||
    request.authority?.mode !== "development" ||
    JSON.stringify(request.authority?.budgets) !== JSON.stringify(expected.budgets) ||
    request.authority?.seedsPerCase !== expected.seedSchedule.seedsPerBudget ||
    request.authority?.developmentCases !== expected.developmentCases ||
    request.authority?.expectedPaidCompiles !== expectedCompiles ||
    (expected.jobs !== undefined && request.authority?.jobs !== expected.jobs) ||
    request.authority?.optimizedWasmOnly !== true ||
    request.authority?.ordinaryThreeBudgetWorkflow !== false ||
    request.authority?.deferredBudgetsRecomputed !== false ||
    request.canonicalSeedBase !== expected.seedSchedule.seedBase ||
    request.seedScheduleFingerprint !== scheduleFingerprint ||
    JSON.stringify(request.canonicalSeedSchedule) !== JSON.stringify(expected.seedSchedule) ||
    request.candidateFingerprint !== expected.candidateFingerprint ||
    request.candidateSnapshot?.candidateFingerprint !== expected.candidateFingerprint ||
    request.candidateSnapshot?.engineArtifactFingerprint !== expected.engineArtifactFingerprint
  ) {
    throw new Error(`campaign bootstrap request does not authorize this exact scorer-bound canonical subset run`);
  }
}

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
