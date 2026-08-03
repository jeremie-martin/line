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
  path: number | null;
  pace: null;
  remainingContacts: number;
  remainingDurationFrames: number;
  startupIncluded: boolean;
  progressFraction: number;
  policyBudgetFrames: number;
};

type CalibrationReport = {
  inputs: string[];
  structuralForm: {
    form: string;
    referenceBudgetFrames: number;
    budgetExponent: number;
    budgets: number[];
    samplesByBudget: Record<string, number>;
    minimumBudgetsForLaw: number;
  };
  byBudget: Array<{
    budget: number;
    samples: number;
    intervalCoverageBySample: number;
    pathFree: { n: number; medianAbsolutePercentageError: number | null };
  }>;
  budgetTransfer: {
    role: string;
    applicable: boolean;
    byHeldOutBudget: Array<{
      heldOutBudget: number;
      trainedBudgets: number[];
      fittedBudgetExponent: number;
      law: { pathFree: { medianAbsolutePercentageError: number | null } };
      constantPooled: { pathFree: { medianAbsolutePercentageError: number | null } };
    }>;
  };
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
    appliedToPredictions: boolean;
    note: string | null;
  };
  provenance?: unknown;
  pointModel: {
    frozen: boolean;
    modelId?: string;
    note?: string;
    intervalsFrozen?: boolean;
    paceScheduleSweep?: Array<{
      paceSchedule: string;
      selected: boolean;
      byBudget: Array<{ budget: number; medianAbsolutePercentageError: number | null }>;
    }>;
  };
  interval: {
    coverageConvention: string;
    coverage: number;
    coverageBySample: number;
    stratification: {
      applied: boolean;
      minimumStratumSamples: number;
      pathStrata: Array<{
        event: string;
        path: "withPath" | "withoutPath";
        n: number;
        fitted: boolean;
        source: "fitted" | "frozen";
        fallback: string | null;
        lowerRatio: number;
        upperRatio: number;
        coverageBySample: number;
      }>;
    };
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
  return runInputs([samples]);
}

/** One analysis file per element, which is how a multi-budget corpus arrives. */
function runInputs(inputSamples: unknown[][], extraArgs: string[] = []): {
  status: number | null;
  stderr: string;
  stdout: string;
  output: string;
  report: string;
} {
  const directory = mkdtempSync(join(tmpdir(), "line-budget-calibration-"));
  temporary.push(directory);
  const output = join(directory, "model.json");
  const report = join(directory, "report.json");
  const inputs = inputSamples.map((samples, index) => {
    const input = join(directory, `analysis-${index}.json`);
    writeFileSync(input, `${JSON.stringify({
      schema: "line.compile-budget-telemetry-analysis.v1",
      inputs: [`synthetic-${index}`],
      calibration_samples: samples,
    })}\n`);
    return input;
  });
  const result = spawnSync(process.execPath, [
    "--import",
    "tsx",
    resolve("scripts/v0/calibrate_budget_estimator.ts"),
    ...inputs,
    `--out=${output}`,
    `--report=${report}`,
    "--folds=2",
    "--coverage=0.95",
    ...extraArgs,
  ], { encoding: "utf8" });
  return { status: result.status, stderr: result.stderr, stdout: result.stdout, output, report };
}

function calibrate(samples: CalibrationSample[]): {
  model: BudgetEstimatorModelArtifact;
  report: CalibrationReport;
} {
  return calibrateInputs([samples]);
}

function calibrateInputs(inputSamples: CalibrationSample[][], extraArgs: string[] = []): {
  model: BudgetEstimatorModelArtifact;
  report: CalibrationReport;
} {
  const result = runInputs(inputSamples, extraArgs);
  expect(result.status, result.stderr || result.stdout).toBe(0);
  return {
    model: parseBudgetEstimatorModel(JSON.parse(readFileSync(result.output, "utf8"))),
    report: JSON.parse(readFileSync(result.report, "utf8")) as CalibrationReport,
  };
}

/** Write an artifact to a temporary path so it can be frozen into a later run. */
function freezeArtifact(model: BudgetEstimatorModelArtifact): string {
  const directory = mkdtempSync(join(tmpdir(), "line-budget-frozen-"));
  temporary.push(directory);
  const path = join(directory, "artifact.json");
  writeFileSync(path, `${JSON.stringify(model, null, 2)}\n`);
  return path;
}

/**
 * A corpus whose cost is exactly `3 * V1(shape) * (B / 750,000)^exponent`, one
 * analysis file per budget. The truth is noiseless, so the fit either recovers
 * the exponent or the search is wrong.
 */
function budgetPanel(budgets: number[], exponent: number): CalibrationSample[][] {
  const shapes = [
    { startupIncluded: false, remainingContacts: 1, remainingDurationFrames: 0 },
    { startupIncluded: false, remainingContacts: 4, remainingDurationFrames: 0 },
    { startupIncluded: true, remainingContacts: 9, remainingDurationFrames: 120 },
  ];
  let attemptId = 0;
  return budgets.map((policyBudgetFrames) =>
    ["family-a", "family-b", "family-c"].flatMap((group) =>
      shapes.map((shape) =>
        sample({
          group,
          attemptId: attemptId++,
          policyBudgetFrames,
          actual: 3 * structuralActual(shape) *
            Math.pow(policyBudgetFrames / 750_000, exponent),
          ...shape,
        })
      )
    )
  );
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

  describe("multi-budget corpora", () => {
    test("fits one shared exponent and declares schema v2", () => {
      const budgets = [150_000, 300_000, 750_000, 1_500_000];
      const { model, report } = calibrateInputs(budgetPanel(budgets, 0.6));

      expect(report.inputs).toHaveLength(4);
      expect(report.structuralForm.budgets).toEqual(budgets);
      expect(report.structuralForm.form).toBe("reference_shape_times_budget_scale");
      expect(model.schema).toBe("line.compile-budget-estimator-model.v2");
      expect(model.structural.name).toContain("-law/");
      expect(model.structural.referenceBudgetFrames).toBe(750_000);
      expect(model.structural.budgetExponent!).toBeCloseTo(0.6, 3);
      // Reference coefficients are the 750k anchor, so they read three times V1.
      expect(model.structural.contactFrames)
        .toBeCloseTo(3 * TRAVERSAL_BUDGET_MODEL_V1.contactFrames, 2);
      // The domain is the corpus, which is now a band rather than a point.
      expect(model.applicability.structuralPolicyBudgetFrames)
        .toEqual({ min: 150_000, max: 1_500_000 });
      // Every budget is predicted, not just the anchor.
      for (const entry of report.byBudget) {
        expect(entry.pathFree.medianAbsolutePercentageError!).toBeLessThan(0.01);
      }
    });

    test("reports budget transfer as evidence, with the no-exponent control", () => {
      const budgets = [150_000, 300_000, 750_000, 1_500_000];
      const { report } = calibrateInputs(budgetPanel(budgets, 0.6));

      expect(report.budgetTransfer.role).toBe("reported_evidence_not_an_acceptance_gate");
      expect(report.budgetTransfer.applicable).toBe(true);
      expect(report.budgetTransfer.byHeldOutBudget.map((entry) => entry.heldOutBudget))
        .toEqual(budgets);
      for (const entry of report.budgetTransfer.byHeldOutBudget) {
        expect(entry.trainedBudgets).not.toContain(entry.heldOutBudget);
        // A budget the fit never saw is still predicted by the exponent, and
        // the same rows without one are not: that gap IS the law's evidence.
        expect(entry.fittedBudgetExponent).toBeCloseTo(0.6, 3);
        expect(entry.law.pathFree.medianAbsolutePercentageError!).toBeLessThan(0.01);
        expect(entry.constantPooled.pathFree.medianAbsolutePercentageError!)
          .toBeGreaterThan(entry.law.pathFree.medianAbsolutePercentageError!);
      }
    });

    test("stays budget-independent below three budgets", () => {
      // Two points define an exponent exactly and therefore measure nothing
      // about it, so the artifact must not claim one.
      const { model, report } = calibrateInputs(budgetPanel([300_000, 1_500_000], 0.6));

      expect(model.structural).not.toHaveProperty("budgetExponent");
      expect(model.structural).not.toHaveProperty("referenceBudgetFrames");
      expect(model.structural.name).not.toContain("-law/");
      expect(report.structuralForm.form).toBe("budget_independent");
      expect(report.structuralForm.budgetExponent).toBe(0);
      expect(report.budgetTransfer.applicable).toBe(false);
      expect(report.budgetTransfer.byHeldOutBudget).toEqual([]);
      // The domain still reports what the corpus covered.
      expect(model.applicability.structuralPolicyBudgetFrames)
        .toEqual({ min: 300_000, max: 1_500_000 });
    });

    test("leaves a single-budget corpus exactly as it was", () => {
      const { model, report } = calibrateInputs(budgetPanel([750_000], 0.6));

      expect(model.structural).not.toHaveProperty("budgetExponent");
      expect(report.structuralForm.form).toBe("budget_independent");
      expect(model.applicability.structuralPolicyBudgetFrames)
        .toEqual({ min: 750_000, max: 750_000 });
    });
  });

  /*
   * Widening an artifact's calibrated claim without re-deriving the numbers the
   * claim is about. Since the margin's structural base became the artifact, the
   * coefficients and correction factors are live policy, so a domain extension
   * must be provably confined to the claim layer — which is what these tests
   * check byte for byte.
   */
  describe("frozen point model", () => {
    const frozenSource = (): BudgetEstimatorModelArtifact =>
      calibrateInputs(budgetPanel([300_000, 750_000, 1_500_000], 0.6)).model;

    test("re-emits the point model verbatim and takes the claim from the new corpus", () => {
      const frozen = frozenSource();
      const path = freezeArtifact(frozen);
      const { model, report } = calibrateInputs(
        budgetPanel([150_000, 250_000, 300_000, 750_000, 1_500_000], 0.6),
        [`--freeze-point-model=${path}`],
      );

      // The half that is live policy, byte for byte.
      expect(model.structural).toEqual(frozen.structural);
      expect(model.combination).toEqual(frozen.combination);
      // The half this corpus earned.
      expect(model.applicability.structuralPolicyBudgetFrames)
        .toEqual({ min: 150_000, max: 1_500_000 });
      expect(frozen.applicability.structuralPolicyBudgetFrames)
        .toEqual({ min: 300_000, max: 1_500_000 });
      expect(model.modelId.startsWith("revalidated-")).toBe(true);
      expect(model.calibrated).toBe(true);
      expect(report.pointModel.frozen).toBe(true);
      expect(report.pointModel.modelId).toBe(frozen.modelId);
      expect(report.provenance ?? report.pointModel.note).toBeDefined();
      // Nothing was fitted here, so there is no fit to hold a budget out of.
      expect(report.budgetTransfer.applicable).toBe(false);
      expect(report.foldDesign.appliedToPredictions).toBe(false);
      // The frozen exponent still answers at the budgets it never saw.
      for (const entry of report.byBudget) {
        expect(entry.pathFree.medianAbsolutePercentageError!).toBeLessThan(0.01);
      }
    });

    test("sweeps every pace schedule and reports the alternatives it did not pick", () => {
      const frozen = frozenSource();
      const path = freezeArtifact(frozen);
      const { model, report } = calibrateInputs(
        budgetPanel([300_000, 750_000, 1_500_000], 0.6),
        [`--freeze-point-model=${path}`, "--pace-schedule=search"],
      );

      const sweep = report.pointModel.paceScheduleSweep!;
      expect(sweep.map((entry) => entry.paceSchedule).sort()).toEqual([
        "linear_progress",
        "none",
        "smoothstep_progress",
        "sqrt_progress",
      ]);
      expect(sweep.filter((entry) => entry.selected)).toHaveLength(1);
      expect(model.combination.paceSchedule)
        .toBe(sweep.find((entry) => entry.selected)!.paceSchedule);
      // Every point-estimate constant is still the frozen artifact's.
      expect(model.structural).toEqual(frozen.structural);
    });

    test("honours an explicit schedule and leaves every fitted constant alone", () => {
      const frozen = frozenSource();
      const path = freezeArtifact(frozen);
      const { model } = calibrateInputs(
        budgetPanel([300_000, 750_000, 1_500_000], 0.6),
        [`--freeze-point-model=${path}`, "--pace-schedule=sqrt_progress"],
      );

      expect(model.combination.paceSchedule).toBe("sqrt_progress");
      expect(model.combination.correctionWithPathFactor)
        .toBe(frozen.combination.correctionWithPathFactor);
      expect(model.combination.correctionWithoutPathFactor)
        .toBe(frozen.combination.correctionWithoutPathFactor);
      expect(model.structural).toEqual(frozen.structural);
    });

    test("--freeze-intervals re-emits the bands and only the domain moves", () => {
      const frozen = frozenSource();
      const path = freezeArtifact(frozen);
      const { model, report } = calibrateInputs(
        budgetPanel([150_000, 250_000, 300_000, 750_000, 1_500_000], 0.6),
        [`--freeze-point-model=${path}`, "--freeze-intervals"],
      );

      // Everything a reader of an interval sees is the incumbent's, byte for byte.
      expect(model.interval).toEqual(frozen.interval);
      expect(model.structural).toEqual(frozen.structural);
      expect(model.combination).toEqual(frozen.combination);
      // The one thing this run earned.
      expect(model.applicability.structuralPolicyBudgetFrames.min).toBe(150_000);
      expect(report.pointModel.intervalsFrozen).toBe(true);
      // The strata are reported as measured, not fitted, so a reader cannot
      // mistake a re-validation for a refit.
      for (const stratum of report.interval.stratification.pathStrata) {
        if (frozen.interval.byEventAndPath?.[stratum.event as "start"]?.[stratum.path] === undefined) continue;
        expect(stratum.source).toBe("frozen");
      }
    });

    /**
     * The bands are LIVE POLICY, so freezing them is what freezing the point
     * model means.
     *
     * `interval.byEventAndPath.start.*.upperRatio` sizes every repair restart
     * ceiling (`handoff.ts` `repairRestartCeilingFrames`). A run documented as a
     * telemetry-only domain extension must not move search behaviour by
     * omitting a flag, so `--freeze-point-model` implies `--freeze-intervals`
     * and refitting is the explicit, loudly-warned opt-out.
     */
    test("--freeze-point-model freezes the bands without being asked", () => {
      const frozen = frozenSource();
      const path = freezeArtifact(frozen);
      const { model, report } = calibrateInputs(
        budgetPanel([150_000, 250_000, 300_000, 750_000, 1_500_000], 0.6),
        [`--freeze-point-model=${path}`],
      );

      expect(model.interval).toEqual(frozen.interval);
      expect(report.pointModel.intervalsFrozen).toBe(true);
      for (const stratum of report.interval.stratification.pathStrata) {
        if (frozen.interval.byEventAndPath?.[stratum.event as "start"]?.[stratum.path] === undefined) continue;
        expect(stratum.source).toBe("frozen");
      }
    });

    test("--refit-intervals restores the refitting arm and says it is promotion-class", () => {
      const frozen = frozenSource();
      const path = freezeArtifact(frozen);
      const result = runInputs(budgetPanel([150_000, 250_000, 300_000, 750_000, 1_500_000], 0.6), [
        `--freeze-point-model=${path}`,
        "--refit-intervals",
      ]);

      expect(result.status, result.stderr || result.stdout).toBe(0);
      expect(result.stderr).toContain("PROMOTION-CLASS");
      expect(result.stderr).toContain("estCostUpperOf");
      const report = JSON.parse(readFileSync(result.report, "utf8")) as CalibrationReport;
      const model = parseBudgetEstimatorModel(JSON.parse(readFileSync(result.output, "utf8")));
      expect(report.pointModel.intervalsFrozen).toBe(false);
      // The point model is still the incumbent's; only the claim layer moved.
      expect(model.structural).toEqual(frozen.structural);
      for (const stratum of report.interval.stratification.pathStrata) {
        expect(stratum.source).toBe("fitted");
      }
    });

    test("refuses --refit-intervals without a frozen model, and beside --freeze-intervals", () => {
      const corpus = budgetPanel([300_000, 750_000, 1_500_000], 0.6);
      const bare = runInputs(corpus, ["--refit-intervals"]);
      expect(bare.status).not.toBe(0);
      expect(bare.stderr).toContain("--refit-intervals requires --freeze-point-model");

      const path = freezeArtifact(frozenSource());
      const both = runInputs(corpus, [
        `--freeze-point-model=${path}`,
        "--freeze-intervals",
        "--refit-intervals",
      ]);
      expect(both.status).not.toBe(0);
      expect(both.stderr).toContain("--refit-intervals contradicts --freeze-intervals");
    });

    test("refuses --freeze-intervals whose coverage promise this run would restate", () => {
      const frozen = frozenSource();
      const path = freezeArtifact({
        ...frozen,
        interval: { ...frozen.interval, nominalCoverage: 0.9 },
      });
      // The run asks for 0.95; relabelling a 0.9 band as a 0.95 one would
      // restate a claim the bands never earned.
      const result = runInputs(budgetPanel([300_000, 750_000, 1_500_000], 0.6), [
        `--freeze-point-model=${path}`,
        "--freeze-intervals",
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("carries nominalCoverage 0.9");
    });

    test("refuses a pace schedule without a frozen model", () => {
      const result = runInputs(budgetPanel([750_000], 0.6), ["--pace-schedule=sqrt_progress"]);
      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("--pace-schedule requires --freeze-point-model");
    });

    test("refuses to widen the claim of a model this corpus does not support", () => {
      // A 20x-too-large point model: still an interval could be fitted around
      // it, and that interval would be a calibrated-looking lie.
      const frozen = frozenSource();
      const path = freezeArtifact({
        ...frozen,
        structural: { ...frozen.structural, contactFrames: frozen.structural.contactFrames * 20 },
      });
      const result = runInputs(budgetPanel([300_000, 750_000, 1_500_000], 0.6), [
        `--freeze-point-model=${path}`,
      ]);

      expect(result.status).not.toBe(0);
      expect(result.stderr).toContain("does not clear the static gates");
    });
  });

  describe("interval stratification", () => {
    /**
     * Two regimes with deliberately different spreads. Path-backed rows have a
     * measured path within a few percent of the truth; path-free rows are a
     * structural regression that misses by up to 40%. One pooled band cannot
     * serve both, which is exactly the situation on the real panel.
     */
    const TIGHT = [0.98, 0.99, 1.0, 1.01, 1.02];
    const WIDE = [0.62, 0.78, 0.95, 1.0, 1.05, 1.22, 1.38];
    const regimeCorpus = (): CalibrationSample[] => {
      const rows: CalibrationSample[] = [];
      let attemptId = 0;
      for (const group of ["family-a", "family-b", "family-c"]) {
        for (const seed of [0, 1]) {
          for (let index = 0; index < 70; index++) {
            const shape = {
              startupIncluded: false,
              remainingContacts: 1 + (index % 7),
              remainingDurationFrames: 0,
            };
            // Actual cost scatters widely around structure in BOTH regimes, so
            // a structural-only estimate is poor for both and the selected
            // candidate is genuinely `path_if_available`. What differs is the
            // information available at read time.
            const truth = 4 * structuralActual(shape) * WIDE[index % WIDE.length];
            const context = `src/${seed}/750000`;
            rows.push(sample({
              group,
              context,
              attemptId: attemptId++,
              event: "high_water",
              actual: truth,
              // The runtime routes this through the path base, so its residual
              // is the path's own error and it belongs in its own band.
              path: truth * TIGHT[index % TIGHT.length],
              ...shape,
            }));
            rows.push(sample({
              group,
              context,
              attemptId: attemptId++,
              event: "high_water",
              actual: 4 * structuralActual(shape) * WIDE[(index + 3) % WIDE.length],
              path: null,
              ...shape,
            }));
          }
        }
      }
      return rows;
    };

    test("fits a band per event x path regime and reports the split", () => {
      const { model, report } = calibrate(regimeCorpus());
      const stratification = report.interval.stratification;

      expect(stratification.applied).toBe(true);
      // Derived from the requested coverage: 4 observations per 2.5% tail.
      expect(stratification.minimumStratumSamples).toBe(160);
      expect(model.schema).toBe("line.compile-budget-estimator-model.v2");

      const strata = model.interval.byEventAndPath!.high_water!;
      const withPath = strata.withPath!;
      const withoutPath = strata.withoutPath!;
      // The whole point: the measured regime is tighter than the regressed one.
      expect(withPath.upperRatio).toBeLessThan(withoutPath.upperRatio);
      expect(withPath.lowerRatio).toBeGreaterThan(withoutPath.lowerRatio);
      for (const interval of [withPath, withoutPath]) {
        expect(interval.lowerRatio).toBeLessThanOrEqual(1);
        expect(interval.upperRatio).toBeGreaterThanOrEqual(1);
      }
      // Each band answers for its own regime rather than for the mixture.
      for (const stratum of stratification.pathStrata) {
        expect(stratum.fitted).toBe(true);
        expect(stratum.n).toBeGreaterThanOrEqual(stratification.minimumStratumSamples);
        expect(stratum.coverageBySample).toBeGreaterThanOrEqual(0.94);
      }
    });

    test("falls back to the event band when a stratum is too thin to fit one", () => {
      // Nine samples per family: no stratum can carry a 2.5% tail, so the
      // artifact must claim no split at all rather than promise coverage from
      // an extreme order statistic.
      const { model, report } = calibrate(["family-a", "family-b", "family-c"].flatMap((group) =>
        [1, 4, 9].map((remainingContacts, index) =>
          sample({
            group,
            attemptId: index,
            remainingContacts,
            remainingDurationFrames: 0,
            startupIncluded: false,
            actual: 3 * structuralActual({
              startupIncluded: false,
              remainingContacts,
              remainingDurationFrames: 0,
            }),
          })
        )
      ));

      expect(report.interval.stratification.applied).toBe(false);
      expect(model.interval).not.toHaveProperty("byEventAndPath");
      for (const stratum of report.interval.stratification.pathStrata) {
        expect(stratum.fitted).toBe(false);
        expect(stratum.fallback).toBe("event");
      }
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
