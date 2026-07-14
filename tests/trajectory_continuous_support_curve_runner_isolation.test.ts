import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { studySourceIdentity } from "../scripts/v0/trajectory/study_artifact.ts";
import { classifyPostimpactConstructionProbe } from "../scripts/v0/trajectory/postimpact_support_assay.ts";

const RUNNER_PATH = "scripts/v0/study_continuous_support_curve.ts";

/**
 * The curve assay is calibration-only. Its static source closure must not pull
 * in compiler placement/search policy, benchmark policy, or fixture-panel
 * selection machinery. Check both the entry source and the resolver-backed
 * transitive closure so wrapping a forbidden module in a helper cannot bypass
 * the boundary.
 */
const FORBIDDEN_TRANSITIVE_SOURCE_FILES = [
  "scripts/v0/arc_placement.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/trajectory/exact_support_slice_assay.ts",
  "scripts/v0/trajectory/frozen_fixture.ts",
  "scripts/v0/trajectory/study_context.ts",
  "scripts/v0/trajectory/study_trace.ts",
  "scripts/v0/trajectory/study_artifact.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/v0/trajectory/transition_contract.ts",
  "benchmark/v2/policy.ts",
  "scripts/v0/trajectory/panel.ts",
] as const;

const FORBIDDEN_ENTRY_IMPORT_SPECIFIERS = [
  "./arc_placement.ts",
  "./core/candidate.ts",
  "./trajectory/exact_support_slice_assay.ts",
  "./trajectory/frozen_fixture.ts",
  "./trajectory/study_context.ts",
  "./trajectory/study_trace.ts",
  "./trajectory/study_artifact.ts",
  "./optimizer/handoff.ts",
  "./optimizer/sample.ts",
  "./trajectory/transition_contract.ts",
  "../../benchmark/v2/policy.ts",
  "./trajectory/panel.ts",
] as const;

describe("continuous support curve runner isolation", () => {
  test("keeps compiler, benchmark, and panel dependencies out of its static source closure", () => {
    const source = readFileSync(RUNNER_PATH, "utf8");
    const directViolations = FORBIDDEN_ENTRY_IMPORT_SPECIFIERS.filter((specifier) => source.includes(specifier));
    const identity = studySourceIdentity(RUNNER_PATH);
    const transitiveViolations = FORBIDDEN_TRANSITIVE_SOURCE_FILES.filter((path) => identity.sourceFiles.includes(path));
    expect({ directViolations, transitiveViolations }).toEqual({
      directViolations: [],
      transitiveViolations: [],
    });
  });

  test("delegates protected-boundary classification to the tested shared rule", () => {
    const source = readFileSync(RUNNER_PATH, "utf8");
    expect(source).toContain("classifyPostimpactConstructionProbe");
    expect(source).toContain(
      "captureOnlyPreHComplete: input.sharedCaptureCertificate.captureOnlyCompleteThroughHPlusOne",
    );
    expect(source).toContain("survivesThroughH: survivesThroughFrame(detection, input.supportStartFrame)");
    expect(source).not.toMatch(/function classify(?:Continuous|Postimpact)Construction/);
  });

  test("keeps a fatal attributable at-H support collision as a phase rejection", () => {
    expect(classifyPostimpactConstructionProbe({
      physicalPrefixMatchesBaseline: true,
      captureOnlyPreHComplete: true,
      captureOnlyPreHTraceAvailable: true,
      captureTraceMatchesComparator: false,
      traceMatchesBeforeFirstSupportCollision: true,
      selectedCaptureEventMatchesComparator: false,
      impactMatchesComparator: false,
      // This is deliberately false: it describes the candidate after its
      // attributable collision, not the already-proved capture-only baseline.
      survivesThroughH: false,
      preOrAtHSupportCollisionCount: 1,
    })).toMatchObject({
      constructionSafe: false,
      expectedCollisionRejection: true,
      protocolInvalid: false,
      reason: "support_collision_at_or_before_H",
    });
  });

  test("keeps execution completion, five-arm evidence eligibility, and orientation coverage explicit", () => {
    const source = readFileSync(RUNNER_PATH, "utf8");
    for (const field of [
      "executionComplete",
      "descriptiveLocalClaimEligible",
      "selectedCertifiedPhaseRows",
      "completeMeasurementRows",
      "completePairedRows",
      "orientationEvidence",
      "entryActiveNormalProjectionToReferenceStepRatio",
      "resolutionDiagnosticActionErrors",
    ]) {
      expect(source).toContain(field);
    }
    expect(source).not.toContain("certifiedRows:");
  });
});
