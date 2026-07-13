import { describe, expect, test } from "vitest";
import {
  type IdentifiedDriftReport,
  normalizeReportTargets,
  reportComparisonIssue,
} from "../scripts/report_identity.ts";
import type { DriftReport } from "../scripts/v0/types.ts";

function report(target: number, achieved: number): DriftReport {
  return {
    contacts: [],
    gaps: [{
      gap_index: 0,
      t_end: 1,
      survived: true,
      axes: { impact: { target, achieved, error: Math.abs(achieved - target) } },
    }],
    off_beat_landings: [],
    terminus: { frame: 40, reason: "endOfSpec" },
  };
}

function identified(value: DriftReport, semantics = "semantics", spec = "spec"): IdentifiedDriftReport {
  return {
    ...value,
    _line: {
      schema: "line.run-report-metadata.v1",
      generatedAt: "2026-07-12T00:00:00.000Z",
      reportSemanticsFingerprint: semantics,
      compiledSpecFingerprint: spec,
      specPath: "spec.ts",
      compiler: "handoff",
      engine: "wasm",
      seed: 0,
      budget: 500_000,
      totalFrames: 40,
    },
  };
}

describe("run report comparison identity", () => {
  test("requires matching report and compiled-spec semantics", () => {
    const base = identified(report(0.5, 0.4));
    expect(reportComparisonIssue(base, identified(report(0.5, 0.6)))).toBeNull();
    expect(reportComparisonIssue(base, identified(report(0.5, 0.6), "changed")))
      .toBe("report scoring or target semantics differ");
    expect(reportComparisonIssue(base, identified(report(0.5, 0.6), "semantics", "changed")))
      .toBe("compiled specifications differ");
    expect(reportComparisonIssue(base, report(0.5, 0.6))).toContain("predate");
  });

  test("can explicitly normalize historical achievements to one target surface", () => {
    const [a, b] = normalizeReportTargets(report(0.4, 0.3), report(0.8, 0.6), "b");
    expect(a.gaps[0].axes.impact).toMatchObject({ target: 0.8, achieved: 0.3, error: 0.5 });
    expect(b.gaps[0].axes.impact).toMatchObject({ target: 0.8, achieved: 0.6 });
    expect(b.gaps[0].axes.impact.error).toBeCloseTo(0.2);
  });
});
