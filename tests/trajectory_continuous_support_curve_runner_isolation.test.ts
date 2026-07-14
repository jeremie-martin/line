import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { studySourceIdentity } from "../scripts/v0/trajectory/study_artifact.ts";
import { classifyPostimpactConstructionProbe } from "../scripts/v0/trajectory/postimpact_support_assay.ts";

const RUNNER_PATH = "scripts/v0/study_continuous_support_curve.ts";
const CONSTRUCTION_PATH = "scripts/v0/trajectory/continuous_support_curve_construction.ts";
const CAPTURE_CLOSURE_PATH = "scripts/v0/trajectory/postimpact_capture_closure.ts";

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

const FORBIDDEN_CONSTRUCTION_SOURCE_FILES = [
  "scripts/v0/study_continuous_support_curve.ts",
  "scripts/v0/trajectory/postimpact_fixture.ts",
  "scripts/v0/trajectory/postimpact_study_inputs.ts",
  "scripts/v0/trajectory/frozen_fixture.ts",
  "scripts/v0/trajectory/panel.ts",
  "scripts/v0/trajectory/study_context.ts",
  "scripts/v0/trajectory/scored_contact_impact.ts",
  "scripts/v0/trajectory/contact_capture_arc.ts",
  "scripts/v0/trajectory/contact_capture_arc_design.ts",
  "scripts/v0/trajectory/contact_kinematic_frame.ts",
  "scripts/v0/types.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/optimizer/sample.ts",
  "scripts/lib/primitive.ts",
  "scripts/lib/_lr_engine.ts",
  "scripts/lib/_lr_engine_record.ts",
  "scripts/lib/_lr_engine_wasm.ts",
  "benchmark/v2/policy.ts",
] as const;

function executableSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

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

  test("moves protected-boundary construction into a target-blind leaf", () => {
    const source = readFileSync(CONSTRUCTION_PATH, "utf8");
    const captureSource = readFileSync(CAPTURE_CLOSURE_PATH, "utf8");
    const closure = studySourceIdentity(CONSTRUCTION_PATH).sourceFiles;
    expect(source).toContain("classifyPostimpactConstructionProbe");
    expect(source).toContain(
      "captureOnlyPreHComplete: capture.sharedCaptureCertificate.captureOnlyCompleteThroughHPlusOne",
    );
    expect(source).toContain("survivesThroughH: survivesPostimpactThroughFrame(detection, capture.supportStartFrame)");
    expect(source).not.toMatch(/function classify(?:Continuous|Postimpact)Construction/);
    expect(FORBIDDEN_CONSTRUCTION_SOURCE_FILES.filter((path) => closure.includes(path))).toEqual([]);
    expect(closure).toContain("scripts/v0/trajectory/postimpact_capture_arc.ts");
    expect(closure).toContain(CAPTURE_CLOSURE_PATH);
    expect(captureSource).toContain("prepared.impactConvention");
    expect(captureSource).not.toContain("IMPACT_WINDOW");
    const runtimeAccessViolations = closure.filter((path) =>
      /node:(?:fs|path|child_process)|\bprocess(?:\.|\[)/.test(executableSource(readFileSync(path, "utf8")))
    );
    expect(runtimeAccessViolations).toEqual([]);
    expect(executableSource(source)).not.toMatch(/(?:fixturePath|readFileSync)/);
    expect(executableSource(captureSource)).not.toMatch(/(?:fixturePath|readFileSync)/);
  });

  test("passes the sealed context directly to construction without a runner closure", () => {
    const source = readFileSync(RUNNER_PATH, "utf8");
    expect(source).toContain("withPostimpactStudyInputBoundaryFromPath(\n  fixturePath,\n  constructContinuousSupportCurveRows,");
    // Measurement must reuse the frozen replay adapters rather than silently
    // importing a second scorer, line converter, or ambient impact window.
    expect(source).toContain("pending.addTrackLines(pending.captureEngine, curve.lines)");
    expect(source).toContain("pending.scoreContactImpact");
    expect(source).toContain("pending.impactWindowFrames");
    expect(source).not.toContain('from "./types.ts"');
    expect(source).not.toContain('from "./core/substrate.ts"');
    expect(source).not.toContain('from "./trajectory/scored_contact_impact.ts"');
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
