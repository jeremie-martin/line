import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { postimpactAssaySourceIdentity } from "../scripts/v0/trajectory/postimpact_assay_artifact.ts";
import {
  POSTIMPACT_LONG_CARRIER_CAPTURE_PROTOCOL,
  projectPostimpactLongCarrierCaptureRow,
  projectPostimpactLongCarrierDurationCapture,
} from "../scripts/v0/trajectory/postimpact_long_carrier_capture.ts";
import type { PostimpactCaptureClosurePending } from "../scripts/v0/trajectory/postimpact_capture_closure.ts";

const RUNNER_PATH = "scripts/v0/study_long_carrier_duration_response.ts";
const CONSTRUCTION_PATH = "scripts/v0/trajectory/postimpact_long_carrier_construction.ts";
const CAPTURE_CLOSURE_PATH = "scripts/v0/trajectory/postimpact_capture_closure.ts";

const FORBIDDEN_CONSTRUCTION_SOURCE_FILES = [
  "scripts/v0/study_long_carrier_duration_response.ts",
  "scripts/v0/trajectory/postimpact_fixture.ts",
  "scripts/v0/trajectory/postimpact_study_inputs.ts",
  "scripts/v0/trajectory/postimpact_assay_artifact.ts",
  "scripts/v0/trajectory/frozen_fixture.ts",
  "scripts/v0/trajectory/panel.ts",
  "scripts/v0/trajectory/study_context.ts",
  "scripts/v0/trajectory/scored_contact_impact.ts",
  "scripts/v0/types.ts",
  "scripts/v0/core/substrate.ts",
  "scripts/v0/core/candidate.ts",
  "scripts/v0/arc_placement.ts",
  "scripts/v0/optimizer/handoff.ts",
  "scripts/v0/optimizer/sample.ts",
  "benchmark/v2/policy.ts",
] as const;

function executableSource(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

describe("post-impact long-carrier runner isolation", () => {
  test("keeps capture and duration construction free of fixture, target, and compiler policy", () => {
    const closure = postimpactAssaySourceIdentity(CONSTRUCTION_PATH).sourceFiles;
    const constructionSource = readFileSync(CONSTRUCTION_PATH, "utf8");
    const captureSource = readFileSync(CAPTURE_CLOSURE_PATH, "utf8");

    expect(FORBIDDEN_CONSTRUCTION_SOURCE_FILES.filter((path) => closure.includes(path))).toEqual([]);
    expect(closure).toContain(CAPTURE_CLOSURE_PATH);
    expect(closure).toContain("scripts/v0/trajectory/postimpact_long_carrier_capture.ts");
    expect(closure).toContain("scripts/v0/trajectory/postimpact_long_carrier.ts");
    expect(closure).toContain("scripts/v0/trajectory/postimpact_long_carrier_protocol.ts");
    expect(executableSource(constructionSource)).not.toMatch(/(?:readFileSync|fixturePath|outgoing\.axes|authoredContactFrames)/);
    expect(executableSource(constructionSource)).not.toMatch(/(?:scoreContactImpact|captureOnlyImpact|current\.impact)/);
    expect(executableSource(captureSource)).not.toMatch(/(?:readFileSync|fixturePath|outgoingEndFrame|authoredContactFrames)/);
    const runtimeAccessViolations = closure.filter((path) =>
      /node:(?:fs|path|child_process)|\bprocess(?:\.|\[)/.test(executableSource(readFileSync(path, "utf8")))
    );
    expect(runtimeAccessViolations).toEqual([]);
  });

  test("uses the explicit staged boundary rather than an inline duration-aware construction callback", () => {
    const source = readFileSync(RUNNER_PATH, "utf8");
    expect(source).toContain("withPostimpactCaptureThenDurationBoundaryFromPath(");
    expect(source).toContain("constructPostimpactLongCarrierCaptureRows,");
    expect(source).toContain("constructPostimpactLongCarrierDurationRows,");
    expect(source).toContain("boundary.durationResult.rows.map((row) => measureRow(row, boundary.observation))");
    expect(source).toContain("captureProjection: POSTIMPACT_LONG_CARRIER_CAPTURE_PROTOCOL");
    expect(source).toContain("long-carrier duration study is wasm-only");
  });

  test("projects a minimal score- and target-blind duration token", () => {
    const pending = fakeCapturePending();
    const token = projectPostimpactLongCarrierDurationCapture(pending);
    expect(POSTIMPACT_LONG_CARRIER_CAPTURE_PROTOCOL.excluded).toContain("current_impact_target");
    expect(Object.keys(token).sort()).toEqual([
      "addTrackLines",
      "baselinePhysicalPrefixTrace",
      "captureEngine",
      "captureFullTraceThroughH",
      "captureLineIds",
      "captureObservationSurface",
      "captureOnlyObservation",
      "captureTraceThroughH",
      "captureTraceThroughHPlusOne",
      "current",
      "impactWindowFrames",
      "lastCaptureLineId",
      "namedReferenceAtH",
      "namedReferenceStep",
      "protectedCaptureImpactMatches",
      "responseAnchorPoint",
      "sharedCaptureCertificate",
      "speedRuler",
      "supportStartFrame",
    ]);
    expect(Object.keys(token.current).sort()).toEqual(["endFrame", "intervalFrames", "startFrame"]);
    for (const forbidden of ["capture", "entry", "scoreContactImpact", "captureOnlyImpact", "impactConvention"]) {
      expect(forbidden in token).toBe(false);
    }
    expect(JSON.stringify(token)).not.toContain("secret-impact-target");
    expect(JSON.stringify(token)).not.toContain("secret-score-outcome");

    const projectedRow = projectPostimpactLongCarrierCaptureRow({
      rowIndex: 3,
      captureStatus: "closed",
      captureReason: null,
      report: {
        current: { impact: "secret-impact-target" },
        capture: { impact: { arbitraryShape: "secret-score-outcome" } },
      },
      pending,
      protocolInvalid: false,
    });
    expect(JSON.stringify(projectedRow.report)).not.toContain("secret-impact-target");
    expect(JSON.stringify(projectedRow.report)).not.toContain("secret-score-outcome");
  });
});

function fakeCapturePending(): PostimpactCaptureClosurePending {
  return {
    rowIndex: 3,
    entry: { label: "impact-derived-geometry-must-not-leak", control: { turnMagnitudeDeg: 999 } } as any,
    capture: {
      lines: [{ id: 17 }],
      captureBandLineIds: [17],
      lineRoles: { approach: 17, runway: 17, arc: [] },
      impactTurnDeg: 999,
      entryTurnDeg: 999,
      remainingTurnDeg: 999,
    } as any,
    captureEngine: {},
    addTrackLines: () => ({}),
    scoreContactImpact: () => ({ metric: "secret-score-outcome" }),
    impactConvention: {
      impactWindowFrames: 6,
      catchableRedirFraction: 0.5,
      redirArcSoftPxPerFrame: 2,
      redirArcVeryStrongPxPerFrame: 8,
      speedRulerMinPxPerFrame: 4,
      speedRulerMaxPxPerFrame: 16,
    },
    current: { startFrame: 10, endFrame: 20, intervalFrames: 10, impact: "secret-impact-target" as any },
    baselinePhysicalPrefixTrace: { fingerprint: "prefix", frameCount: 1, unavailableAtFrame: null, semantics: "full_non_scarf_engine_state_v1" },
    captureOnlyObservation: {} as any,
    captureOnlyImpact: { metric: "secret-score-outcome" },
    captureTraceThroughH: { fingerprint: "h", frameCount: 1, unavailableAtFrame: null, semantics: "full_non_scarf_engine_state_v1" },
    captureFullTraceThroughH: { fingerprint: "full", frameCount: 1, unavailableAtFrame: null, semantics: "full_non_scarf_engine_state_v1" },
    captureTraceThroughHPlusOne: { fingerprint: "h1", frameCount: 1, unavailableAtFrame: null, semantics: "full_non_scarf_engine_state_v1" },
    supportStartFrame: 26,
    responseAnchor: { anchorPoint: "TAIL" } as any,
    namedReferenceAtH: { point: "TAIL", position: { x: 1, y: 2 }, velocity: { x: 3, y: 4 }, speedPxPerFrame: 5, headingDeg: 6 },
    namedReferenceStep: {
      anchorPoint: "TAIL",
      fromFrame: 26,
      toFrame: 27,
      fromReference: { x: 1, y: 2 },
      toReference: { x: 3, y: 4 },
      exactCaptureOnlyTraceFingerprint: "h1",
    },
    sharedCaptureCertificate: {
      supportStartFrame: 26,
      captureOnlyCompleteThroughHPlusOne: true,
      captureOnlyTraceStartFrame: 20,
      captureOnlyTraceEndFrame: 27,
      exactCaptureOnlyTrace: { fingerprint: "h1", frameCount: 1, unavailableAtFrame: null, semantics: "full_non_scarf_engine_state_v1" },
      namedReferenceStep: {
        anchorPoint: "TAIL",
        fromFrame: 26,
        toFrame: 27,
        fromReference: { x: 1, y: 2 },
        toReference: { x: 3, y: 4 },
        exactCaptureOnlyTraceFingerprint: "h1",
      },
    },
  } as unknown as PostimpactCaptureClosurePending;
}
