import { describe, expect, test } from "vitest";
import {
  buildAxisContract,
  scoreV2Report,
  summarizeDevelopmentBudget,
  weightedBudgetHeadline,
  type AxisContract,
  type ScoredDevelopmentRun,
} from "../scripts/v0/benchmark_v2/evaluator.ts";
import type { DriftReport } from "../scripts/v0/types.ts";
import type { SuiteManifest } from "../scripts/v0/benchmark_v2/suite_model.ts";
import { shiftedGeometricMean } from "../scripts/v0/score.ts";

const scoring = {
  component_weights: { air: 0.3, speed: 0.3, impact: 0.3, amplitude: 0.1 },
  axis_quality_tolerance: 0.25,
} as const;
const airContract: AxisContract = { scored: { air: [0] }, diagnostic: {} };

function report(status: "hit" | "drift" = "hit"): DriftReport {
  return {
    contacts: [
      { t_target: 0.5, t_actual: 0.5, frame_error: 0, status },
      { t_target: 1, t_actual: 1, frame_error: status === "hit" ? 0 : 2, status },
    ],
    gaps: [{
      gap_index: 0,
      t_end: 0.5,
      survived: true,
      axes: { air: { target: 0.5, achieved: 0.6, error: 0.1 } },
    }],
    off_beat_landings: [],
    terminus: { frame: 40, reason: "endOfSpec" },
  };
}

describe("Benchmark V2 evaluator", () => {
  test("renormalizes active components and zeroes invalid contract runs", () => {
    const valid = scoreV2Report(report(), 2, airContract, scoring);
    expect(valid.valid).toBe(true);
    expect(valid.weightedAxisRms).toBe(0.1);
    expect(valid.components.air?.weight).toBe(1);
    expect(valid.score).toBeCloseTo(1000 * Math.exp(-0.1 / 0.25), 3);

    const invalid = scoreV2Report(report("drift"), 2, airContract, scoring);
    expect(invalid.valid).toBe(false);
    expect(invalid.score).toBe(0);
  });

  test("weights families independently of member count and weights budgets explicitly", () => {
    const suite = {
      strata: [{
        id: "representative",
        weight: 1,
        groups: [
          { id: "a", weight: 0.75, members: ["a1", "a2"] },
          { id: "b", weight: 0.25, members: ["b1"] },
        ],
      }],
    } as Pick<SuiteManifest, "strata">;
    const run = (sourceId: string, budget: number, score: number): ScoredDevelopmentRun => ({
      sourceId,
      budget,
      seedSlot: 0,
      actualSeed: 0,
      score: { ...scoreV2Report(report(), 2, airContract, scoring), score },
    });
    const runs = [run("a1", 100, 400), run("a2", 100, 400), run("b1", 100, 800)];
    const summary = summarizeDevelopmentBudget(runs, 100, suite);
    expect(summary.groups[0].score).toBeCloseTo(400, 3);
    expect(summary.score).toBeCloseTo(500, 3);
    expect(weightedBudgetHeadline(
      [summary, { ...summary, budget: 200, score: 700 }],
      [{ budget: 100, weight: 0.25 }, { budget: 200, weight: 0.75 }],
    )).toBe(650);
  });

  test("balances variants within parents before balancing parents within a family", () => {
    const suite = {
      strata: [{
        id: "representative",
        weight: 1,
        groups: [{
          id: "family",
          weight: 1,
          members: ["p1", "p1_a", "p1_b", "p2"],
          parents: [
            { id: "p1", members: ["p1", "p1_a", "p1_b"] },
            { id: "p2", members: ["p2"] },
          ],
        }],
      }],
    } as Pick<SuiteManifest, "strata">;
    const run = (sourceId: string, score: number): ScoredDevelopmentRun => ({
      sourceId,
      budget: 100,
      seedSlot: 0,
      actualSeed: 0,
      score: { ...scoreV2Report(report(), 2, airContract, scoring), score },
    });
    const summary = summarizeDevelopmentBudget([
      run("p1", 100), run("p1_a", 100), run("p1_b", 100), run("p2", 900),
    ], 100, suite);
    expect(summary.groups[0].parents?.map((parent) => parent.score)).toEqual([100, 900]);
    expect(summary.groups[0].score).toBeCloseTo(shiftedGeometricMean([100, 900]), 3);
    expect(summary.groups[0].score).not.toBeCloseTo(shiftedGeometricMean([100, 100, 100, 900]), 3);
  });

  test("distinguishes intentionally undefined axes from missing measurements", () => {
    const spec = {
      duration: 1,
      contacts: [{ t: 0.5, impact: 0.7 }],
      axes: {},
    };
    const contract = buildAxisContract(spec, ["sync", "survival", "impact"]);
    const missing = scoreV2Report(report(), 2, contract, scoring);
    expect(missing.valid).toBe(false);
    expect(missing.hardFailures).toContain("missing_measurement:impact:1[0..0]");

    const contactReport = report();
    contactReport.gaps[0].axes = {};
    const contactOnly = scoreV2Report(contactReport, 2, { scored: {}, diagnostic: {} }, scoring);
    expect(contactOnly.valid).toBe(true);
    expect(contactOnly.scoringMode).toBe("contact_only");
    expect(contactOnly.score).toBe(1000);
  });
});
