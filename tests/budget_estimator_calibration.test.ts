import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  parseBudgetEstimatorModel,
  type BudgetEstimatorModelArtifact,
} from "../scripts/v0/optimizer/budget_estimator.ts";
import { TRAVERSAL_BUDGET_MODEL_V1 } from "../scripts/v0/optimizer/budget_model.ts";

const temporary: string[] = [];

afterEach(() => {
  for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true });
});

type CalibrationSample = {
  source: string;
  context: string;
  group: string;
  attemptKind: "initial" | "repair";
  attemptId: number;
  event: "start" | "high_water";
  actual: number;
  structural: number;
  path: null;
  pace: null;
  remainingContacts: number;
  remainingDurationFrames: number;
  startupIncluded: boolean;
  progressFraction: number;
  policyBudgetFrames: number;
};

type CalibrationReport = {
  staticMetrics: { weightedMedianAbsoluteLogError: number };
  acceptance: {
    accepted: boolean;
    selectedMetrics: { weightedMedianAbsoluteLogError: number };
  };
};

function sample(
  input: Partial<CalibrationSample> & Pick<CalibrationSample, "group" | "actual">,
): CalibrationSample {
  return {
    source: `${input.group}.json`,
    context: "test",
    attemptKind: "initial",
    attemptId: 0,
    event: "start",
    structural: 1,
    path: null,
    pace: null,
    remainingContacts: 1,
    remainingDurationFrames: 0,
    startupIncluded: false,
    progressFraction: 0,
    policyBudgetFrames: 750_000,
    ...input,
  };
}

function structuralActual(input: {
  startupIncluded: boolean;
  remainingContacts: number;
  remainingDurationFrames: number;
}): number {
  return (input.startupIncluded ? TRAVERSAL_BUDGET_MODEL_V1.interceptFrames : 0) +
    TRAVERSAL_BUDGET_MODEL_V1.contactFrames * input.remainingContacts +
    TRAVERSAL_BUDGET_MODEL_V1.durationFrameScale * input.remainingDurationFrames;
}

function run(samples: unknown[]): {
  status: number | null;
  stderr: string;
  stdout: string;
  output: string;
  report: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "line-budget-calibration-"));
  temporary.push(directory);
  const input = join(directory, "analysis.json");
  const output = join(directory, "model.json");
  const report = join(directory, "report.json");
  writeFileSync(input, `${JSON.stringify({
    schema: "line.compile-budget-telemetry-analysis.v1",
    inputs: ["synthetic"],
    calibration_samples: samples,
  })}\n`);
  const result = spawnSync(process.execPath, [
    "--import",
    "tsx",
    resolve("scripts/v0/calibrate_budget_estimator.ts"),
    input,
    `--out=${output}`,
    `--report=${report}`,
    "--folds=2",
    "--coverage=0.95",
  ], { encoding: "utf8" });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout, output, report };
}

function calibrate(samples: CalibrationSample[]): {
  model: BudgetEstimatorModelArtifact;
  report: CalibrationReport;
} {
  const result = run(samples);
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return {
    model: parseBudgetEstimatorModel(JSON.parse(readFileSync(result.output, "utf8"))),
    report: JSON.parse(readFileSync(result.report, "utf8")) as CalibrationReport,
  };
}

describe("budget estimator calibration", () => {
  test("evaluates rejected fallback metrics with the static model it emits", () => {
    const a = {
      startupIncluded: true,
      remainingContacts: 1,
      remainingDurationFrames: 10,
    };
    const b = {
      startupIncluded: false,
      remainingContacts: 5,
      remainingDurationFrames: 100,
    };
    const { model, report } = calibrate([
      sample({ group: "family-a", actual: structuralActual(a), ...a }),
      sample({ group: "family-b", actual: structuralActual(b), ...b }),
    ]);

    expect(report.acceptance.accepted).toBe(false);
    expect(report.staticMetrics.weightedMedianAbsoluteLogError).toBe(0);
    expect(report.acceptance.selectedMetrics.weightedMedianAbsoluteLogError).toBe(0);
    expect(model.structural).toEqual(TRAVERSAL_BUDGET_MODEL_V1);
    expect(model.metrics.validationMedianAbsoluteLogError).toBe(0);
    // A rejected candidate emits the untouched static fallback; saying it was
    // fitted would be copied verbatim into every telemetry payload.
    expect(model.calibrated).toBe(false);
    expect(model.modelId.startsWith("static-")).toBe(true);
    expect(model.metrics.acceptedAgainstStatic).toBe(false);
  });

  test("accepts a fitted candidate as calibrated", () => {
    // Actual cost is a fixed multiple of structure, so the correction factor is
    // a real fit and the acceptance gates clear.
    const shapes = [
      { startupIncluded: false, remainingContacts: 1, remainingDurationFrames: 0 },
      { startupIncluded: false, remainingContacts: 4, remainingDurationFrames: 0 },
      { startupIncluded: false, remainingContacts: 9, remainingDurationFrames: 0 },
    ];
    const { model, report } = calibrate(["family-a", "family-b", "family-c"].flatMap((group) =>
      shapes.map((shape, index) =>
        sample({
          group,
          attemptId: index,
          actual: 3 * structuralActual(shape),
          ...shape,
        })
      )
    ));

    expect(report.acceptance.accepted).toBe(true);
    expect(model.calibrated).toBe(true);
    expect(model.modelId.startsWith("calibrated-")).toBe(true);
  });

  test("rejects a sample whose policy budget cannot define the applicability domain", () => {
    const shape = { startupIncluded: false, remainingContacts: 1, remainingDurationFrames: 0 };
    const rows: Array<Record<string, unknown>> = [
      { ...sample({ group: "family-a", actual: structuralActual(shape), ...shape }) },
      { ...sample({ group: "family-b", actual: structuralActual(shape), ...shape }) },
    ];
    delete rows[1].policyBudgetFrames;
    const result = run(rows);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/policyBudgetFrames must be finite/);
    // The guard runs before any write, so no artifact exists to be imported.
    expect(() => readFileSync(result.output, "utf8")).toThrow();
  });

  test("emits point-containing event intervals that the runtime accepts", () => {
    const samples = ["family-a", "family-b"].flatMap((group) => [
      sample({ group, attemptId: 0, event: "start", actual: 100 }),
      sample({ group, attemptId: 0, event: "high_water", actual: 2_000 }),
    ]);
    const { model } = calibrate(samples);

    expect(model.interval.byEvent.start?.upperRatio).toBe(1);
    expect(model.interval.byEvent.high_water?.lowerRatio).toBe(1);
    for (const interval of Object.values(model.interval.byEvent)) {
      expect(interval?.lowerRatio).toBeLessThanOrEqual(1);
      expect(interval?.upperRatio).toBeGreaterThanOrEqual(1);
    }
  });
});
