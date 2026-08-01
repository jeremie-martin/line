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

    const telemetry = recorder.snapshot(260, false, 240);
    expect(telemetry?.schema).toBe(BUDGET_TELEMETRY_SCHEMA);
    expect(telemetry?.compile).toMatchObject({
      hard_budget_frames: 1_000,
      policy_budget_frames: 800,
      total_spent_frames: 260,
      hard_remaining_frames: 740,
      hard_overrun_frames: 0,
      budget_exhausted: false,
      first_terminal_total_spent_frames: 240,
    });
    // The compile-scope structural prior is a path-free estimate, so it carries
    // the structural domain's verdict rather than an implicit "calibrated".
    expect(telemetry?.compile.initial_structural_applicability).toBe(
      budgetEstimatorApplicability({
        pathAvailable: false,
        policyBudgetFrames: 800,
        attemptKind: "initial",
      }),
    );
    // Payloads copy the artifact's own claim; they never assert calibration.
    expect(telemetry?.model.calibrated).toBe(BUDGET_ESTIMATOR_MODEL.calibrated);
    expect(telemetry?.segments.map((segment) => segment.spent_frames)).toEqual([20, 240]);
    const recordedAttempt = telemetry?.attempts[0];
    expect(recordedAttempt?.ceiling_source).toBe("hard_budget");
    expect(recordedAttempt?.outcome).toEqual({
      stop_reason: "compile_finished",
      end_total_spent_frames: 260,
      spent_frames: 260,
      completed: true,
      first_terminal_offset_frames: 240,
      accepted_improvement: true,
      first_accepted_improvement_offset_frames: null,
      accepted_score_delta: null,
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

  test("treats a zero incumbent path as absent rather than as a path-backed estimate", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "trace",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 1_000,
      policyBudgetFrames: 800,
      model: TEST_MODEL,
    });
    recorder.startAttempt({
      kind: "repair",
      searchSeed: 3,
      hasFallback: true,
      anchorGapIndex: 1,
      startTotalSpentFrames: 0,
      ceilingTotalSpentFrames: 500,
      ceilingSource: "measured_cost_to_end",
      includeStartup: false,
      // Gap 1 has no measured cost; gap 2 does.
      pathEstimateByGap: [0, 0, 250, 0, 0],
    });
    recorder.observeActive(2, 100);
    recorder.endActive(200, "frontier_exhausted", false);
    const attempt = recorder.snapshot(200, false)?.attempts[0];
    const [start, advanced] = attempt?.observations ?? [];

    // The estimator's selector discards a non-positive path, so admitting one
    // here would label a structural estimate as path-backed and calibrated.
    expect(start.incumbent_path_work_estimate_frames).toBeNull();
    expect(start.estimator_applicability).not.toBe("calibrated");
    expect(advanced.incumbent_path_work_estimate_frames).toBe(250);
    expect(advanced.estimator_applicability).toBe("calibrated");
    expect(attempt?.ceiling_source).toBe("measured_cost_to_end");
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

  test("stays behavior-neutral at a repair-enabled budget", async () => {
    // The 20k cell above never reaches the repair gate, so it cannot prove that
    // the repair-phase and resumed-search instrumentation is observation-only.
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const options = { budget: 150_000, polish: false } as const;
    const off = compileHandoff(spec, 0, { ...options, budgetTelemetry: "off" });
    const summary = compileHandoff(spec, 0, { ...options, budgetTelemetry: "summary" });
    const trace = compileHandoff(spec, 0, { ...options, budgetTelemetry: "trace" });

    for (const candidate of [summary, trace]) {
      expect(candidate.track).toEqual(off.track);
      expect(candidate.report).toEqual(off.report);
      expect(candidate.stats).toEqual(off.stats);
    }
    expect(trace.budgetTelemetry?.attempts.some((attempt) => attempt.kind === "repair")).toBe(true);
  }, 180_000);

  test("attributes repair and resumed search at a repair-enabled budget", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const result = compileHandoff(spec, 0, {
      budget: 150_000,
      polish: false,
      budgetTelemetry: "trace",
    });
    const telemetry = result.budgetTelemetry!;
    const attempts = telemetry.attempts;
    const repairs = attempts.filter((attempt) => attempt.kind === "repair");
    const observations = attempts.flatMap((attempt) => attempt.observations ?? []);

    expect(repairs.length).toBeGreaterThan(0);
    expect(observations.some((observation) =>
      (observation.incumbent_path_work_estimate_frames ?? 0) > 0 &&
      observation.estimator_applicability === "calibrated"
    )).toBe(true);

    for (const repair of repairs) {
      expect(["measured_cost_to_end", "per_gap_fallback", "repair_budget_remaining"])
        .toContain(repair.ceiling_source);
      // A repair always knows what it did to the incumbent's score; the
      // improvement offset exists exactly when the register took something.
      expect(repair.outcome.accepted_score_delta).not.toBeNull();
      const offset = repair.outcome.first_accepted_improvement_offset_frames;
      if (repair.outcome.accepted_improvement === true) {
        expect(offset).not.toBeNull();
        expect(offset!).toBeGreaterThanOrEqual(0);
        expect(offset!).toBeLessThanOrEqual(repair.outcome.spent_frames!);
      } else {
        expect(offset).toBeNull();
        expect(repair.outcome.accepted_score_delta).toBe(0);
      }
    }

    // The resumed frontier owns charged work and can hold a terminal, so it
    // must be an attempt and not only a segment.
    const resumedSegments = telemetry.segments.filter((segment) => segment.kind === "resumed_search");
    const resumed = attempts.filter((attempt) => attempt.kind === "resumed");
    expect(resumed.length).toBe(resumedSegments.length);
    for (const segment of resumedSegments) {
      const attempt = attempts.find((candidate) => candidate.attempt_id === segment.attempt_id);
      expect(attempt?.kind).toBe("resumed");
      expect(attempt?.start_total_spent_frames).toBe(segment.start_total_spent_frames);
      expect(attempt?.outcome.end_total_spent_frames).toBe(segment.end_total_spent_frames);
      expect(attempt?.parent_attempt_id).toBe(attempts[0].attempt_id);
      expect(attempt?.ceiling_total_spent_frames).toBe(telemetry.compile.hard_budget_frames);
      const inside = attempt?.observations ?? [];
      expect(inside.length).toBeGreaterThan(0);
      for (const observation of inside) {
        expect(observation.total_spent_frames).toBeGreaterThanOrEqual(segment.start_total_spent_frames);
        expect(observation.total_spent_frames).toBeLessThanOrEqual(segment.end_total_spent_frames);
      }
    }

    // The compiler's own first-terminal counter must agree with attribution.
    const attributed = attempts
      .filter((attempt) => attempt.outcome.first_terminal_offset_frames !== null)
      .map((attempt) => attempt.start_total_spent_frames + attempt.outcome.first_terminal_offset_frames!);
    expect(telemetry.compile.first_terminal_total_spent_frames).toBe(Math.min(...attributed));
    expect(telemetry.compile.first_terminal_total_spent_frames)
      .toBe(result.stats.first_completion_frame);

    // Segments still partition all charged work exactly.
    let cursor = 0;
    for (const segment of telemetry.segments) {
      expect(segment.start_total_spent_frames).toBe(cursor);
      expect(segment.spent_frames).toBe(segment.end_total_spent_frames - cursor);
      cursor = segment.end_total_spent_frames;
    }
    expect(cursor).toBe(telemetry.compile.total_spent_frames);
    expect(telemetry.segments.some((segment) => segment.kind === "unattributed")).toBe(false);
  }, 180_000);

  test("sizes repairs from measured cost at gaps only the tail-completion pass built", async () => {
    // cold_start's first completion comes from the near-tail pass, whose nodes
    // the frontier never processes. Before those nodes were stamped, every gap
    // past the deepest processed one had no reach timestamp, so this compile
    // recorded zero path-backed repair observations.
    //
    // The stamps were telemetry-only at first, and this test then asserted the
    // split they created: a `per_gap_fallback` ceiling next to a path-backed
    // observation. Repair policy now reads the same profile the recorder does,
    // so that combination is gone by design — the measured cost that was good
    // enough to observe against is good enough to size the restart with.
    const spec = await loadGoldenSpec("cold_start", "base");
    const result = compileHandoff(spec, 0, {
      budget: 150_000,
      polish: false,
      budgetTelemetry: "trace",
    });
    const repairs = result.budgetTelemetry!.attempts.filter((attempt) => attempt.kind === "repair");
    expect(repairs.length).toBeGreaterThan(0);

    for (const repair of repairs) {
      expect(repair.start.incumbent_path_work_estimate_frames).not.toBeNull();
      expect(repair.start.incumbent_path_work_estimate_frames!).toBeGreaterThan(0);
      expect(repair.start.estimator_applicability).toBe("calibrated");
      // Wherever a reach stamp exists the ceiling is sized from it, never from
      // the per-gap average. `per_gap_fallback` now means a node in neither
      // reach map, which a stamped incumbent path cannot be.
      expect(repair.ceiling_source).not.toBe("per_gap_fallback");
    }
  }, 180_000);

  test("uses the hard budget as the initial attempt ceiling when policy budget is lower", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const hardBudget = 20_000;
    const result = compileHandoff(spec, 0, {
      budget: hardBudget,
      policyBudget: 10_000,
      maxNodes: 12,
      polish: false,
      budgetTelemetry: "trace",
    });
    const attempt = result.budgetTelemetry?.attempts[0];

    expect(result.stats.sim_frames).toBeGreaterThan(10_000);
    expect(attempt?.ceiling_total_spent_frames).toBe(hardBudget);
    expect(attempt?.local_budget_frames).toBe(hardBudget);
    expect(attempt?.end?.attempt_remaining_frames).toBe(
      Math.max(0, hardBudget - (attempt.end?.total_spent_frames ?? 0)),
    );
    expect(attempt?.end?.attempt_overrun_frames).toBe(0);
    expect(attempt?.ceiling_source).toBe("hard_budget");
  }, 120_000);
});
