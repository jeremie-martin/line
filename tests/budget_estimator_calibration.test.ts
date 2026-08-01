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
  attemptKind: "initial" | "repair" | "resumed";
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
  fitPopulation: {
    analysisSamples: number;
    fittedSamples: number;
    fittedAttemptKinds: string[];
    excludedSamples: number;
    excludedSamplesByKind: Record<string, number>;
    excludedAttempts: number;
    structuralAttemptKinds: string[];
  };
  foldDesign: {
    blocking: string;
    familyFolds: number;
    seedFolds: number;
    evaluationCells: number;
    seeds: number[];
    unresolvedSeedSamples: number;
    seedFoldBySeed: Record<string, number | null>;
    familyFoldByGroup: Record<string, number>;
    note: string | null;
  };
  interval: {
    coverageConvention: string;
    coverage: number;
    coverageBySample: number;
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

  test("excludes resumed attempts from the fit without changing the artifact", () => {
    // A resumed attempt reports its tree's root anchor while its frontier is
    // already deep, so its features imply far more remaining work than it has.
    // Admitting even a few would move the coefficients, the correction, and the
    // event intervals — and would put `resumed` into structuralAttemptKinds,
    // which is the artifact asserting calibration it does not have.
    const shapes = [
      { startupIncluded: false, remainingContacts: 1, remainingDurationFrames: 0 },
      { startupIncluded: false, remainingContacts: 4, remainingDurationFrames: 0 },
      { startupIncluded: false, remainingContacts: 9, remainingDurationFrames: 0 },
    ];
    const fittable = ["family-a", "family-b", "family-c"].flatMap((group) =>
      shapes.map((shape, index) =>
        sample({ group, attemptId: index, actual: 3 * structuralActual(shape), ...shape })
      )
    );
    const resumed = ["family-a", "family-b", "family-c"].map((group) =>
      sample({
        group,
        attemptKind: "resumed",
        attemptId: 99,
        // Continuation anchor: the features describe the whole spec while the
        // frontier is nearly done, so actual work is a small fraction of them.
        actual: 0.05 * structuralActual(shapes[2]),
        ...shapes[2],
      })
    );

    const clean = calibrate(fittable);
    const contaminated = calibrate([...fittable, ...resumed]);

    // Normalize only what a separate invocation must differ in: the wall-clock
    // stamp and the temporary input path. Everything a compile reads is compared.
    const normalized = (model: BudgetEstimatorModelArtifact) => ({
      ...model,
      generatedAt: "",
      provenance: { ...model.provenance, inputs: [] },
      structural: { ...model.structural, source: "" },
    });
    expect(normalized(contaminated.model)).toEqual(normalized(clean.model));
    // The dataset fingerprint hashes the fitted sample set, so equality here is
    // the direct statement that resumed samples never entered the fit.
    expect(contaminated.model.provenance.datasetFingerprint)
      .toBe(clean.model.provenance.datasetFingerprint);
    expect(contaminated.model.applicability.structuralAttemptKinds).not.toContain("resumed");
    expect(contaminated.report.fitPopulation).toMatchObject({
      analysisSamples: fittable.length + resumed.length,
      fittedSamples: fittable.length,
      excludedSamples: resumed.length,
      excludedSamplesByKind: { resumed: resumed.length },
      excludedAttempts: resumed.length,
      fittedAttemptKinds: ["initial", "repair", "snapshot"],
    });
    // The exclusion is a filter on fitting, not on input validation: a resumed
    // sample is schema-valid telemetry and must not make the calibrator throw.
    expect(clean.report.fitPopulation.excludedSamples).toBe(0);
  });

  describe("held-out fold design", () => {
    // Cost per remaining contact depends only on the SEED. A fit that trained
    // on a sample's own seed absorbs that scale and predicts it well; a fit
    // that never saw the seed cannot. The emitted interval therefore reports
    // which blocking actually happened, without reaching into the module.
    const SEED_SCALE = new Map([[0, 20_000], [1, 60_000]]);
    const corpus = (withSeedContext: boolean): CalibrationSample[] => {
      const rows: CalibrationSample[] = [];
      let attemptId = 0;
      for (const group of ["family-a", "family-b"]) {
        for (const [seed, scale] of SEED_SCALE) {
          for (const remainingContacts of [1, 2, 3]) {
            rows.push(sample({
              group,
              attemptId: attemptId++,
              event: "high_water",
              context: withSeedContext ? `src/${seed}/750000` : "test",
              remainingContacts,
              actual: scale * remainingContacts,
            }));
          }
        }
      }
      return rows;
    };

    test("blocks held-out evaluation on both source family and seed", () => {
      const { model, report } = calibrate(corpus(true));

      expect(report.foldDesign.blocking).toBe("source_family_and_seed");
      expect(report.foldDesign.familyFolds).toBe(2);
      expect(report.foldDesign.seedFolds).toBe(2);
      expect(report.foldDesign.evaluationCells).toBe(4);
      expect(report.foldDesign.seeds).toEqual([0, 1]);
      expect(report.foldDesign.unresolvedSeedSamples).toBe(0);
      expect(report.foldDesign.note).toBeNull();
      // Both axes partition: every family and every seed is in exactly one
      // fold, and every fold index is used, so no cell trains on its own test.
      expect(new Set(Object.values(report.foldDesign.familyFoldByGroup))).toEqual(new Set([0, 1]));
      expect(new Set(Object.values(report.foldDesign.seedFoldBySeed))).toEqual(new Set([0, 1]));

      // Each fit sees one seed and is scored on the other, so the cheap seed is
      // predicted by the expensive seed's model and vice versa: held-out ratios
      // reach 1/3 and 3, and the interval has to own both tails.
      expect(model.interval.byEvent.high_water!.upperRatio).toBeGreaterThan(2.5);
      expect(model.interval.byEvent.high_water!.lowerRatio).toBeLessThan(0.4);
    });

    test("falls back to family-only folds loudly when the seed is unrecoverable", () => {
      const result = run(corpus(false));
      expect(result.status, result.stderr).toBe(0);
      const model = parseBudgetEstimatorModel(JSON.parse(readFileSync(result.output, "utf8")));
      const report = JSON.parse(readFileSync(result.report, "utf8")) as CalibrationReport;

      // Never silent: the degradation is on stderr and in the report.
      expect(result.stderr).toMatch(/seed blocking DISABLED/);
      expect(report.foldDesign.blocking).toBe("source_family_only");
      expect(report.foldDesign.note).toMatch(/seed blocking DISABLED/);
      expect(report.foldDesign.seedFolds).toBe(1);
      expect(report.foldDesign.unresolvedSeedSamples).toBe(corpus(false).length);

      // Both seeds are in every fit, so the model already knows the cheap seed
      // and its held-out underprediction tail vanishes: the lower bound
      // collapses to the clamp at 1. That missing tail is exactly the optimism
      // the double blocking removes.
      expect(model.interval.byEvent.high_water!.lowerRatio).toBeGreaterThan(0.9);
    });

    test("assigns folds deterministically across invocations", () => {
      const first = calibrate(corpus(true));
      const second = calibrate(corpus(true));

      expect(second.report.foldDesign.familyFoldByGroup)
        .toEqual(first.report.foldDesign.familyFoldByGroup);
      expect(second.report.foldDesign.seedFoldBySeed)
        .toEqual(first.report.foldDesign.seedFoldBySeed);
      expect(second.model.interval).toEqual(first.model.interval);
      expect(second.model.structural.contactFrames).toBe(first.model.structural.contactFrames);
    });

    test("reports interval coverage under both conventions", () => {
      const { model, report } = calibrate(corpus(true));

      expect(report.interval.coverageConvention).toBe("per_sample");
      expect(report.interval.coverage).toBeGreaterThan(0);
      expect(report.interval.coverageBySample).toBeGreaterThan(0);
      // Every attempt here holds exactly one sample, so the two conventions
      // must agree; they diverge only when sample density varies by attempt.
      expect(report.interval.coverageBySample).toBeCloseTo(report.interval.coverage, 6);
      expect(model.metrics.validationIntervalCoverageBySample)
        .toBeCloseTo(report.interval.coverageBySample, 5);
    });
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
