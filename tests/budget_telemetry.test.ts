import { describe, expect, test } from "vitest";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import {
  adaptiveEstimate,
  BUDGET_TELEMETRY_SCHEMA,
  CompileBudgetTelemetryRecorder,
  remainingStructure,
  structuralRemainingWork,
} from "../scripts/v0/optimizer/budget_telemetry.ts";
import type { Gap } from "../scripts/v0/types.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  budgetEstimateInterval,
  budgetEstimatorApplicability,
  estimateRemainingBudgetWork,
  parseBudgetEstimatorModel,
} from "../scripts/v0/optimizer/budget_estimator.ts";

const GAPS: Gap[] = [
  { index: 0, startFrame: 0, endFrame: 20, endsWithContact: true, targets: {} },
  { index: 1, startFrame: 20, endFrame: 50, endsWithContact: false, targets: {} },
  { index: 2, startFrame: 50, endFrame: 80, endsWithContact: true, targets: {} },
  { index: 3, startFrame: 80, endFrame: 100, endsWithContact: false, targets: {} },
];

const TEST_MODEL = {
  name: "test/model",
  source: "unit test",
  interceptFrames: 100,
  contactFrames: 10,
  durationFrameScale: 2,
};

describe("compile budget telemetry", () => {
  test("describes the remaining suffix and structural work without hidden policy", () => {
    expect(remainingStructure(GAPS, 100, 0)).toEqual({
      gap_index: 0,
      anchor_frame: 0,
      remaining_gaps: 4,
      remaining_contacts: 2,
      remaining_duration_frames: 100,
    });
    expect(remainingStructure(GAPS, 100, 2)).toEqual({
      gap_index: 2,
      anchor_frame: 50,
      remaining_gaps: 2,
      remaining_contacts: 1,
      remaining_duration_frames: 50,
    });
    expect(remainingStructure(GAPS, 100, 99)).toEqual({
      gap_index: 4,
      anchor_frame: 100,
      remaining_gaps: 0,
      remaining_contacts: 0,
      remaining_duration_frames: 0,
    });
    expect(structuralRemainingWork(GAPS, 100, 0, true, TEST_MODEL)).toBe(320);
    expect(structuralRemainingWork(GAPS, 100, 0, false, TEST_MODEL)).toBe(220);
    expect(structuralRemainingWork(GAPS, 100, 2, false, TEST_MODEL)).toBe(110);
    expect(structuralRemainingWork(GAPS, 100, 4, true, TEST_MODEL)).toBe(0);
  });

  test("blends positive estimates geometrically as progress increases", () => {
    expect(adaptiveEstimate(100, null, 0.5)).toBe(100);
    expect(adaptiveEstimate(100, 400, 0)).toBeCloseTo(100);
    expect(adaptiveEstimate(100, 400, 0.5)).toBeCloseTo(200);
    expect(adaptiveEstimate(100, 400, 1)).toBeCloseTo(400);
    expect(adaptiveEstimate(100, 400, 10)).toBeCloseTo(400);
  });

  test("routes path corrections and event-specific intervals from the frozen artifact", () => {
    const model = structuredClone(BUDGET_ESTIMATOR_MODEL);
    model.combination = {
      baseMode: "path_if_available",
      paceSchedule: "none",
      correctionWithoutPathFactor: 2,
      correctionWithPathFactor: 3,
    };
    model.interval = {
      lowerRatio: 0.5,
      upperRatio: 2,
      nominalCoverage: 0.9,
      byEvent: { start: { lowerRatio: 0.8, upperRatio: 1.2 } },
    };
    expect(estimateRemainingBudgetWork({
      structural: 100,
      path: null,
      pace: null,
      progressFraction: 0,
    }, model)).toBe(200);
    expect(estimateRemainingBudgetWork({
      structural: 100,
      path: 40,
      pace: 999,
      progressFraction: 1,
    }, model)).toBe(120);
    expect(budgetEstimateInterval(100, "start", model)).toEqual({ lower: 80, upper: 120 });
    expect(budgetEstimateInterval(100, "end", model)).toEqual({ lower: 50, upper: 200 });
    expect(budgetEstimatorApplicability({
      pathAvailable: false,
      policyBudgetFrames: model.applicability.structuralPolicyBudgetFrames.min,
      attemptKind: "initial",
    }, model)).toBe("calibrated");
    expect(budgetEstimatorApplicability({
      pathAvailable: false,
      policyBudgetFrames: model.applicability.structuralPolicyBudgetFrames.max + 1,
      attemptKind: "initial",
    }, model)).toBe("extrapolated_policy_budget");
    expect(budgetEstimatorApplicability({
      pathAvailable: true,
      policyBudgetFrames: model.applicability.structuralPolicyBudgetFrames.max + 1,
      attemptKind: "repair",
    }, model)).toBe("calibrated");
    expect(budgetEstimatorApplicability({
      pathAvailable: false,
      policyBudgetFrames: model.applicability.structuralPolicyBudgetFrames.min,
      attemptKind: "snapshot",
    }, model)).toBe("unvalidated_attempt_kind");
    expect(parseBudgetEstimatorModel(model)).toEqual(model);
    expect(() => parseBudgetEstimatorModel({ ...model, schema: "wrong" })).toThrow(/schema/);
  });

  test("records contiguous segments, attempt outcomes, and exact budget identities", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "trace",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 1_000,
      policyBudgetFrames: 800,
      model: TEST_MODEL,
    });
    const attempt = recorder.startAttempt({
      kind: "initial",
      searchSeed: 42,
      hasFallback: false,
      anchorGapIndex: 0,
      startTotalSpentFrames: 0,
      ceilingTotalSpentFrames: 800,
      includeStartup: true,
    });
    recorder.recordSegment("startup", 0, 20, "ready", attempt);
    recorder.observeActive(1, 80);
    recorder.observeActive(2, 160);
    recorder.markTerminal(240, GAPS.length);
    recorder.endActive(260, "compile_finished", true);
    recorder.recordSegment("initial_search", 20, 260, "compile_finished", attempt);

    const telemetry = recorder.snapshot(260, false);
    expect(telemetry?.schema).toBe(BUDGET_TELEMETRY_SCHEMA);
    expect(telemetry?.compile).toMatchObject({
      hard_budget_frames: 1_000,
      policy_budget_frames: 800,
      total_spent_frames: 260,
      hard_remaining_frames: 740,
      hard_overrun_frames: 0,
      budget_exhausted: false,
    });
    expect(telemetry?.segments.map((segment) => segment.spent_frames)).toEqual([20, 240]);
    const recordedAttempt = telemetry?.attempts[0];
    expect(recordedAttempt?.outcome).toEqual({
      stop_reason: "compile_finished",
      end_total_spent_frames: 260,
      spent_frames: 260,
      completed: true,
      first_terminal_offset_frames: 240,
      accepted_improvement: true,
      censored: false,
    });
    expect(recordedAttempt?.observations?.map((observation) => observation.event)).toEqual([
      "start",
      "high_water",
      "high_water",
      "terminal",
      "end",
    ]);
  });

  test("keeps incomplete attempts explicitly censored", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "summary",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 50,
      policyBudgetFrames: 50,
      model: TEST_MODEL,
    });
    recorder.startAttempt({
      kind: "repair",
      searchSeed: 7,
      hasFallback: true,
      anchorGapIndex: 2,
      startTotalSpentFrames: 10,
      ceilingTotalSpentFrames: 50,
      includeStartup: false,
    });
    recorder.endActive(50, "local_ceiling", false);
    recorder.recordSegment("unattributed", 0, 10, "pre-attempt");
    recorder.recordSegment("repair_attempt", 10, 50, "local_ceiling", 0);
    const attempt = recorder.snapshot(50, true)?.attempts[0];
    expect(attempt?.outcome.completed).toBe(false);
    expect(attempt?.outcome.censored).toBe(true);
    expect(attempt?.observations).toBeUndefined();
    expect(attempt?.end?.event).toBe("end");
  });

  test("is byte-behavior-neutral at off, summary, and trace levels", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const options = { budget: 20_000, maxNodes: 12, polish: false } as const;
    const off = compileHandoff(spec, 0, { ...options, budgetTelemetry: "off" });
    const summary = compileHandoff(spec, 0, { ...options, budgetTelemetry: "summary" });
    const trace = compileHandoff(spec, 0, { ...options, budgetTelemetry: "trace" });
    const traceAgain = compileHandoff(spec, 0, { ...options, budgetTelemetry: "trace" });

    for (const candidate of [summary, trace, traceAgain]) {
      expect(candidate.track).toEqual(off.track);
      expect(candidate.report).toEqual(off.report);
      expect(candidate.stats).toEqual(off.stats);
    }
    expect(off.budgetTelemetry).toBeNull();
    expect(summary.budgetTelemetry?.level).toBe("summary");
    expect(trace.budgetTelemetry?.level).toBe("trace");
    expect(traceAgain.budgetTelemetry).toEqual(trace.budgetTelemetry);
    expect(trace.budgetTelemetry?.compile.total_spent_frames).toBe(trace.stats.sim_frames);
    expect(
      trace.budgetTelemetry?.segments.reduce((sum, segment) => sum + segment.spent_frames, 0),
    ).toBe(trace.stats.sim_frames);
  }, 120_000);
});
