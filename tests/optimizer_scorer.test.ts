/**
 * Step 0 verification — the optimizer/scorer wrapper must produce the
 * same axis_quality the existing scoreDriftReport reports.
 *
 * The strong gate (running greedy_v1 outputs through the wrapper and
 * matching the frozen `baselines/greedy_v1.json`) is exercised by the
 * Step 0 freeze script itself; here we test the wrapper in isolation.
 */
import { describe, test, expect } from "vitest";
import { scoreReport, scoreTrack, isStrictlyBetter } from "../scripts/v0/optimizer/scorer.ts";
import { scoreDriftReport, AXIS_QUALITY_TOLERANCE } from "../scripts/v0/score.ts";
import type { DriftReport, ContactReport } from "../scripts/v0/types.ts";

function hitContact(): ContactReport {
  return { t_target: 1, t_actual: 1, frame_error: 0, status: "hit" };
}

function makeReport(axisErrors: number[]): DriftReport {
  return {
    contacts: [hitContact()],
    sections: [{
      section_index: 0,
      survived: true,
      axes: Object.fromEntries(axisErrors.map((e, i) => [
        `axis_${i}`,
        { target: 0.5, achieved: 0.5 + e, error: e },
      ])),
    }],
    off_beat_landings: [],
    terminus: { frame: 100, reason: "endOfSpec" },
  };
}

describe("optimizer/scorer.ts — Step 0 wrapper", () => {
  test("scoreReport returns the same axis_quality as scoreDriftReport", () => {
    const report = makeReport([0.1, 0.2]);
    const direct = scoreDriftReport(report).axis_quality;
    expect(scoreReport(report)).toBe(direct);
  });

  test("scoreTrack reads through to scoreReport on the .report field", () => {
    const report = makeReport([0]);
    const fakeTrack = { track: {} as never, report, stats: {} as never };
    const direct = scoreReport(report);
    expect(scoreTrack(fakeTrack)).toBe(direct);
  });

  test("scoreReport with zero error returns 1 (perfect)", () => {
    expect(scoreReport(makeReport([0]))).toBeCloseTo(1);
  });

  test("scoreReport with one error at AXIS_QUALITY_TOLERANCE returns e^-1", () => {
    const report = makeReport([AXIS_QUALITY_TOLERANCE]);
    expect(scoreReport(report)).toBeCloseTo(Math.exp(-1));
  });

  test("isStrictlyBetter is strict", () => {
    expect(isStrictlyBetter(0.5, 0.5)).toBe(false);
    expect(isStrictlyBetter(0.50001, 0.5)).toBe(true);
    expect(isStrictlyBetter(0.5, 0.50001)).toBe(false);
  });
});
