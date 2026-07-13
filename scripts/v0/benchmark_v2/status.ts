import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { benchmarkEvalPolicy } from "../../../benchmark/v2/eval-policy.ts";
import { readEraState, type EraState } from "./attempts.ts";
import { requireCertifiedOperatingPoint, requireCurrentDecisionCalibration } from "./calibration_guard.ts";
import { compilerCandidateIdentity, compilerDirtyPathsAgainstHead } from "./compiler_identity.ts";
import { readBaselineContract } from "./confirmation.ts";
import { retainedEvidenceInventory, type RetainedEvidenceInventory } from "./evidence_inventory.ts";
import {
  loadHeldoutManifest,
  loadSourceManifest,
  resolveHeldoutSources,
  resolveSources,
} from "./model.ts";
import { runnerCompatibilityApproval } from "./runner_compatibility.ts";
import {
  RUNNER_IMPLEMENTATION_SOURCE_FILES,
  canonicalMembers,
  fingerprintFiles,
  loadSuiteManifest,
  suiteIdentity,
} from "./suite_model.ts";

const SOURCE_MANIFEST = "benchmark/v2/compat/source-manifest.json";
const HELDOUT_MANIFEST = "benchmark/v2/compat/heldout-manifest.json";
const SUITE_MANIFEST = "benchmark/v2/compat/suite-manifest.json";
const OPERATIONAL_PROFILE = "benchmark/v2/operational-profile.json";

type StatusRow = {
  id: string;
  mode: string;
  margin: number | null;
  depth: number;
  spend: number;
  mde80: number;
  developmentCompiles: number;
  qualificationCompilesOnAccept: number;
  budgetAfterDeclaration: number;
  declarationAllowed: boolean;
  refusalReason: string | null;
};

export type BenchmarkStatus = {
  schema: "line.benchmark-v2.status.v1";
  baseline: {
    label: string;
    suiteFingerprint: string;
    inferenceFingerprint: string;
    protocolFingerprint: string;
    calibrationFingerprint: string;
    current: boolean;
  };
  era: Pick<EraState,
    "eraId" | "budgetSpent" | "budgetCap" | "cumulativeExpectedFalseAccepts" |
    "inFlightAttemptId" | "transitionPending"
  >;
  compiler: { cleanForRebaseline: boolean; dirtyPaths: string[] };
  stage0: { comparable: boolean; refusalReasons: string[] };
  publication: { pending: string[] };
  evidence: RetainedEvidenceInventory;
  menu: StatusRow[];
  operationalReference: any;
};

export function benchmarkStatus(): BenchmarkStatus {
  const sources = resolveSources(loadSourceManifest(SOURCE_MANIFEST));
  const heldout = resolveHeldoutSources(loadHeldoutManifest(HELDOUT_MANIFEST));
  const suite = loadSuiteManifest(SUITE_MANIFEST, sources);
  const identity = suiteIdentity(SUITE_MANIFEST, SOURCE_MANIFEST, sources);
  const baseline = readBaselineContract();
  if (baseline.suiteFingerprint !== identity.suiteFingerprint) {
    throw new Error(`suite differs from the baseline contract; establish a new baseline`);
  }
  const era = readEraState();
  const currentContract = requireCurrentDecisionCalibration(identity.suiteFingerprint);
  const contractCurrent =
    baseline.inferenceFingerprint === currentContract.inferenceFingerprint &&
    baseline.protocolFingerprint === currentContract.protocolFingerprint &&
    baseline.calibrationFingerprint === currentContract.calibrationFingerprint;
  const publicationPending = [
    "benchmark/v2/migration-pending.json",
    "benchmark/v2/baseline-publication-pending.json",
  ].filter((path) => existsSync(path));
  const rows = benchmarkEvalPolicy.operatingPoints.map((point): StatusRow => {
    const certified = requireCertifiedOperatingPoint(point.mode, point.margin, point.depth, identity.suiteFingerprint);
    const budgetAfterDeclaration = round4(era.budgetSpent + certified.spend);
    const reasons = [
      ...(era.inFlightAttemptId === null ? [] : [`attempt ${era.inFlightAttemptId} is in flight`]),
      ...(era.transitionPending ? ["a baseline transition is pending"] : []),
      ...(publicationPending.length === 0 ? [] : [`publication journal pending: ${publicationPending.join(", ")}`]),
      ...(contractCurrent ? [] : ["decision contract differs from the baseline; run an approved migration"]),
      ...(budgetAfterDeclaration <= era.budgetCap
        ? []
        : [`era spend would be ${budgetAfterDeclaration}, above cap ${era.budgetCap}`]),
    ];
    return {
      id: point.id,
      mode: point.mode,
      margin: point.margin,
      depth: point.depth,
      spend: certified.spend,
      mde80: certified.mde80,
      developmentCompiles: canonicalMembers(suite).length * suite.profiles.canonical.budgets.length * point.depth * 2,
      qualificationCompilesOnAccept:
        heldout.length * suite.profiles.canonical.budgets.length * suite.profiles.canonical.seeds_per_budget,
      budgetAfterDeclaration,
      declarationAllowed: reasons.length === 0,
      refusalReason: reasons.length === 0 ? null : reasons.join("; "),
    };
  });
  const dirtyPaths = compilerDirtyPathsAgainstHead();
  const probe = JSON.parse(readFileSync(resolve("benchmark/v2/probe-baseline.json"), "utf8"));
  const currentCompiler = compilerCandidateIdentity("wasm");
  const stage0RefusalReasons = currentCompiler.engineArtifactFingerprint === baseline.compilerSnapshot.engineArtifactFingerprint
    ? []
    : ["engine artifact differs from the retained probe reference"];
  try {
    runnerCompatibilityApproval(
      probe.probe.implementation_fingerprint,
      fingerprintFiles(RUNNER_IMPLEMENTATION_SOURCE_FILES),
      baseline.suiteFingerprint,
    );
  } catch (error) {
    stage0RefusalReasons.push(error instanceof Error ? error.message : String(error));
  }
  return {
    schema: "line.benchmark-v2.status.v1",
    baseline: {
      label: baseline.label,
      suiteFingerprint: baseline.suiteFingerprint,
      inferenceFingerprint: baseline.inferenceFingerprint,
      protocolFingerprint: baseline.protocolFingerprint,
      calibrationFingerprint: baseline.calibrationFingerprint,
      current: contractCurrent,
    },
    era: {
      eraId: era.eraId,
      budgetSpent: era.budgetSpent,
      budgetCap: era.budgetCap,
      cumulativeExpectedFalseAccepts: era.cumulativeExpectedFalseAccepts,
      inFlightAttemptId: era.inFlightAttemptId,
      transitionPending: era.transitionPending,
    },
    compiler: { cleanForRebaseline: dirtyPaths.length === 0, dirtyPaths },
    stage0: { comparable: stage0RefusalReasons.length === 0, refusalReasons: stage0RefusalReasons },
    publication: { pending: publicationPending },
    evidence: retainedEvidenceInventory(),
    menu: rows,
    operationalReference: JSON.parse(readFileSync(resolve(OPERATIONAL_PROFILE), "utf8")),
  };
}

export function renderBenchmarkStatus(status: BenchmarkStatus): string {
  const reference = status.operationalReference;
  const lines = [
    "Benchmark V2 status (read-only)",
    `  baseline: ${status.baseline.label}`,
    `  decision contract: ${status.baseline.current ? "current" : "STALE (approved migration required)"}`,
    `  era: spent ${status.era.budgetSpent} of ${status.era.budgetCap}; ` +
      `cumulative expected false accepts ${status.era.cumulativeExpectedFalseAccepts}`,
    `  state: ${status.era.inFlightAttemptId === null ? "no attempt in flight" : `attempt ${status.era.inFlightAttemptId} in flight`}; ` +
      `${status.era.transitionPending ? "transition pending" : "no transition pending"}`,
    `  compiler baseline gate: ${status.compiler.cleanForRebaseline ? "clean" : `BLOCKED by ${status.compiler.dirtyPaths.join(", ")}`}`,
    `  stage 0 reference: ${status.stage0.comparable ? "comparable" : `BLOCKED: ${status.stage0.refusalReasons.join("; ")}`}`,
    `  retained evidence: active contract evidence validated; ` +
      `${status.evidence.referencedFiles}/${status.evidence.totalFiles} local files referenced; ` +
      `${formatBytes(status.evidence.unreferencedBytes)} unreferenced and reviewable; ` +
      `${status.evidence.missingReferences.length} external historical reference(s) unavailable locally`,
    "  certified menu:",
  ];
  for (const row of status.menu) {
    lines.push(
      `    ${row.id}: depth ${row.depth}, detects +${row.mde80} at >=80% power, spend ${row.spend}; ` +
      `${row.developmentCompiles} development compiles` +
      `${row.qualificationCompilesOnAccept > 0 ? ` + ${row.qualificationCompilesOnAccept} qualification on accept` : ""}`,
      `      ${row.declarationAllowed ? `ALLOWED (era would be ${row.budgetAfterDeclaration}/${status.era.budgetCap})` : `BLOCKED: ${row.refusalReason}`}`,
    );
  }
  lines.push(
    `  measured reference (${reference.measuredAt}, jobs=${reference.jobs}): ` +
      `stage 0 ${formatDuration(reference.stage0.wallSeconds)}, ` +
      `depth-48 confirmation ${formatDuration(reference.confirmationDepth48.wallSeconds)}, ` +
      `peak aggregate RSS ${reference.confirmationDepth48.peakAggregateRssGiB.toFixed(2)} GiB`,
    `  note: ${reference.scope}`,
  );
  return lines.join("\n");
}

export function runStatusCommand(argv: string[]): number {
  const status = benchmarkStatus();
  if (argv.includes("--json")) {
    console.log(JSON.stringify(status, null, 2));
  } else {
    const detail = argv.includes("--evidence")
      ? [
          ...(status.evidence.unreferenced.length > 0
            ? [
                "  unreferenced evidence (review only; never auto-deleted):",
                ...status.evidence.unreferenced.map((entry) => `    ${entry.path} (${formatBytes(entry.bytes)})`),
              ]
            : []),
          ...(status.evidence.missingReferences.length > 0
            ? [
                "  external historical references unavailable locally (not active-contract inputs):",
                ...status.evidence.missingReferences.map((path) => `    ${path}`),
              ]
            : []),
        ].join("\n")
      : "";
    console.log(`${renderBenchmarkStatus(status)}${detail === "" ? "" : `\n${detail}`}`);
  }
  return 0;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  return `${Math.floor(seconds / 60)}m${Math.round(seconds % 60)}s`;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MiB`;
}
