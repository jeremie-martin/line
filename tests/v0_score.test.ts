import { describe, expect, test } from "vitest";
import {
  AXIS_QUALITY_TOLERANCE,
  scoreDriftReport,
  shiftedGeometricMean,
} from "../scripts/v0/score.ts";
import type { ContactReport, DriftReport } from "../scripts/v0/types.ts";

function contact(status: ContactReport["status"]): ContactReport {
  return {
    t_target: 1,
    t_actual: status === "missing" ? null : 1,
    frame_error: status === "hit" ? 0 : status === "drift" ? 2 : null,
    status,
  };
}

function report(options: {
  contactStatus?: ContactReport["status"];
  axisErrors?: number[];
  offBeat?: boolean;
  terminusReason?: string;
} = {}): DriftReport {
  const axisErrors = options.axisErrors ?? [0];
  return {
    contacts: [contact(options.contactStatus ?? "hit")],
    sections: [
      {
        section_index: 0,
        survived: true,
        axes: Object.fromEntries(axisErrors.map((error, index) => [
          `axis_${index}`,
          { target: 0.5, achieved: 0.5 + error, error },
        ])),
      },
    ],
    off_beat_landings: options.offBeat ? [{ frame: 12 }] : [],
    terminus: { frame: 120, reason: options.terminusReason ?? "endOfSpec" },
  };
}

describe("v0 scoreDriftReport", () => {
  test("uses continuous exponential axis quality", () => {
    const score = scoreDriftReport(report({ axisErrors: [0, AXIS_QUALITY_TOLERANCE] }));

    expect(score.passed).toBe(true);
    expect(score.valid_contract).toBe(true);
    expect(score.axis_error_mean).toBeCloseTo(AXIS_QUALITY_TOLERANCE / 2);
    expect(score.axis_loss).toBeCloseTo(0.5);
    expect(score.axis_quality).toBeCloseTo(Math.exp(-0.5));
    expect(score.axis_score).toBeCloseTo(score.axis_quality);
    expect(score.score).toBeCloseTo(1000 * Math.exp(-0.5));
  });

  test("hard contract failures force zero score", () => {
    const syncFailure = scoreDriftReport(report({ contactStatus: "drift" }));
    const offBeatFailure = scoreDriftReport(report({ offBeat: true }));
    const deathFailure = scoreDriftReport(report({ terminusReason: "fell" }));

    expect(syncFailure.score).toBe(0);
    expect(syncFailure.hard_failures[0]).toMatch(/^sync:/);
    expect(offBeatFailure.score).toBe(0);
    expect(offBeatFailure.hard_failures).toContain("offBeat:1");
    expect(deathFailure.score).toBe(0);
    expect(deathFailure.hard_failures[0]).toMatch(/^died:fell@/);
  });
});

describe("v0 suite aggregation", () => {
  test("shifted geometric mean penalizes failures without collapsing the suite", () => {
    const aggregate = shiftedGeometricMean([1000, 0]);

    expect(aggregate).toBeCloseTo(Math.sqrt(1001) - 1);
    expect(aggregate).toBeGreaterThan(0);
    expect(aggregate).toBeLessThan(500);
  });
});
