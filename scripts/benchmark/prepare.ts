import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { developmentCases } from "../../benchmark/v2/catalog.ts";
import { buildAuditReport, renderAuditMarkdown } from "../v0/benchmark_v2/audit_model.ts";
import {
  buildCharacterizationReport,
  characterizeSpec,
  loadHeldoutManifest,
  loadSourceManifest,
  loadSourceSpec,
  renderCharacterizationMarkdown,
  resolveHeldoutSources,
  resolveSources,
} from "../v0/benchmark_v2/model.ts";
import {
  canonicalMembers,
  loadSuiteManifest,
  suiteIdentity,
} from "../v0/benchmark_v2/suite_model.ts";
import { loadListeningReview } from "../v0/benchmark_v2/listening_review.ts";

export const benchmarkV2Paths = {
  sourceManifest: "benchmark/v2/compat/source-manifest.json",
  heldoutManifest: "benchmark/v2/compat/heldout-manifest.json",
  suiteManifest: "benchmark/v2/compat/suite-manifest.json",
  characterization: "benchmark/v2/evidence/characterization.json",
  audit: "benchmark/v2/evidence/audit.json",
  review: "benchmark/v2/evidence/candidate-review.json",
  listeningReview: "benchmark/v2/evidence/listening-review.json",
} as const;

export async function prepareBenchmarkV2(): Promise<{
  developmentCases: number;
  qualificationCases: number;
  characterizationFingerprint: string;
  auditFingerprint: string;
  listeningReviewFingerprint: string;
  listeningReviewStatus: string;
}> {
  await import("./sync_catalog.ts");

  const manifestContents = readFileSync(benchmarkV2Paths.sourceManifest, "utf8");
  const heldoutContents = readFileSync(benchmarkV2Paths.heldoutManifest, "utf8");
  const development = resolveSources(loadSourceManifest(benchmarkV2Paths.sourceManifest));
  const qualification = resolveHeldoutSources(loadHeldoutManifest(benchmarkV2Paths.heldoutManifest));
  const characterized = [];
  for (const source of [...development, ...qualification]) {
    characterized.push(characterizeSpec(source, await loadSourceSpec(source)));
  }
  const characterization = buildCharacterizationReport(
    benchmarkV2Paths.sourceManifest,
    manifestContents,
    characterized,
    { path: benchmarkV2Paths.heldoutManifest, contents: heldoutContents },
  );
  const audit = buildAuditReport(characterization);
  if (audit.hardFailures.length > 0) {
    throw new Error(`Benchmark V2 static audit failed:\n${audit.hardFailures.map((failure) => `- ${failure}`).join("\n")}`);
  }
  const suite = loadSuiteManifest(benchmarkV2Paths.suiteManifest, development);
  const identity = suiteIdentity(
    benchmarkV2Paths.suiteManifest,
    benchmarkV2Paths.sourceManifest,
    development,
  );
  const listeningReview = await loadListeningReview(
    benchmarkV2Paths.listeningReview,
    identity.suiteFingerprint,
    identity.sourceManifestFingerprint,
    development,
  );
  const selected = new Set(canonicalMembers(suite));
  const review = {
    schema: "line.benchmark-v2.candidate-review.v2",
    status: "canonical-selected-without-compiler-results",
    characterization_fingerprint: characterization.dataFingerprint,
    audit_fingerprint: audit.auditFingerprint,
    listening_review_fingerprint: listeningReview.fingerprint,
    listening_review_status: listeningReview.review.status,
    selection_basis: "Typed catalog membership, static source characterization, explicit parent variants, and static independence audit only. No compiler or qualification outcome was used.",
    decisions: developmentCases.map((entry) => ({
      id: entry.case.metadata.id,
      disposition: selected.has(entry.case.metadata.id) ? "selected" : "excluded",
      parent_id: entry.case.metadata.variant?.parentId,
      rationale: entry.case.metadata.variant?.rationale ?? entry.case.metadata.notes ?? "Normative authored coverage case.",
      phases: entry.case.metadata.phases.map((phase) => phase.id),
    })),
  };

  writeJson(benchmarkV2Paths.characterization, characterization);
  writeJson(benchmarkV2Paths.audit, audit);
  writeJson(benchmarkV2Paths.review, review);
  writeText("docs/benchmark-v2-characterization.md", renderCharacterizationMarkdown(characterization));
  writeText("docs/benchmark-v2-audit.md", renderAuditMarkdown(audit));
  writeText("docs/benchmark-v2-case-review.md", renderCaseReview(review));

  return {
    developmentCases: development.length,
    qualificationCases: qualification.length,
    characterizationFingerprint: characterization.dataFingerprint,
    auditFingerprint: audit.auditFingerprint,
    listeningReviewFingerprint: listeningReview.fingerprint,
    listeningReviewStatus: listeningReview.review.status,
  };
}

function renderCaseReview(review: {
  characterization_fingerprint: string;
  audit_fingerprint: string;
  listening_review_fingerprint: string;
  listening_review_status: string;
  decisions: Array<{ id: string; disposition: string; parent_id?: string; rationale: string; phases: string[] }>;
}): string {
  const lines = [
    "# Benchmark V2 Case Review",
    "",
    `Characterization: \`${review.characterization_fingerprint.slice(0, 16)}\`. Audit: \`${review.audit_fingerprint.slice(0, 16)}\`.`,
    `Listening review: **${review.listening_review_status}** (\`${review.listening_review_fingerprint.slice(0, 16)}\`).`,
    "",
    "Selection is based on source structure and stated benchmark intent. It contains no compiler or qualification result.",
    "",
    "| Case | Parent | Phases | Rationale |",
    "|---|---|---:|---|",
    ...review.decisions.map((decision) =>
      `| ${decision.id} | ${decision.parent_id ?? "normative"} | ${decision.phases.length} | ${decision.rationale.replaceAll("|", "\\|")} |`
    ),
  ];
  return `${lines.join("\n")}\n`;
}

function writeJson(path: string, value: unknown): void {
  writeText(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  const absolute = resolve(path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, value);
}

if (resolve(process.argv[1] ?? "") === resolve(new URL(import.meta.url).pathname)) {
  const prepared = await prepareBenchmarkV2();
  console.log(
    `Prepared Benchmark V2: ${prepared.developmentCases} development, ` +
    `${prepared.qualificationCases} qualification; audit ${prepared.auditFingerprint.slice(0, 16)}`,
  );
}
