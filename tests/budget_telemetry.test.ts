import { describe, expect, test } from "vitest";
import {
  compileLegacyHandoff,
  REPAIR_LAST_CHANCE_COST_RATIO,
  setHandoffExpansionProbeHook,
  type HandoffExpansionProbeRecord,
} from "../scripts/v0/optimizer/legacy_handoff.ts";
import {
  adaptiveEstimate,
  BUDGET_TELEMETRY_SCHEMA,
  CompileBudgetTelemetryRecorder,
  replayBudgetRepairSelection,
  type BudgetRepairDecision,
} from "../scripts/v0/optimizer/budget_telemetry.ts";
import type { Gap } from "../scripts/v0/types.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import {
  BUDGET_ESTIMATOR_MODEL,
  BUDGET_ESTIMATOR_MODEL_SCHEMA_V1,
  BUDGET_ESTIMATOR_MODEL_SCHEMA_V2,
  budgetEstimateInterval,
  budgetEstimateUsesPath,
  budgetEstimatorApplicability,
  budgetEstimatorStructuralScale,
  estimateRemainingBudgetWork,
  parseBudgetEstimatorModel,
  remainingStructure,
  structuralRemainingWork,
  type BudgetEstimatorModelArtifact,
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

const TEST_REPAIR_DECISION: BudgetRepairDecision = {
  iteration_index: 0,
  incumbent_revision: 0,
  incumbent_track_hash: "a".repeat(64),
  working_track_source: "global_incumbent",
  working_track_hash: "a".repeat(64),
  remaining_budget_frames: 500,
  headroom_fraction: 0.2,
  usable_budget_frames: 400,
  selection_policy: "worst_gap_deepest_affordable",
  parent_depth: 1,
  affordable_target_gap_indices: [2],
  affordable_anchor_gap_indices: [1],
  target_gap_index: 2,
  target_gap_sse: 0.25,
  anchor_gap_index: 1,
  mutable_suffix_sse: 0.25,
  estimated_anchor_cost_frames: 200,
  estimated_anchor_cost_upper_frames: 300,
  anchor_cost_source: "measured_cost_to_end",
  considered_targets: [{
    target_gap_index: 2,
    target_gap_sse: 0.25,
    anchor_options: [{
      parent_depth: 1,
      anchor_gap_index: 1,
      estimated_anchor_cost_frames: 200,
      estimated_anchor_cost_upper_frames: 300,
      anchor_cost_source: "measured_cost_to_end",
      affordability: "affordable",
    }],
  }],
};

test("replays an anchor-first suffix-density decision beyond the option radius", () => {
  const costs = [100, 95, 90];
  const sse = [10, 10, 15];
  const decision: BudgetRepairDecision = {
    ...TEST_REPAIR_DECISION,
    remaining_budget_frames: 100,
    headroom_fraction: 0,
    usable_budget_frames: 100,
    selection_policy: "suffix_opportunity_per_cost",
    parent_depth: 2,
    affordable_target_gap_indices: [0, 1, 2],
    affordable_anchor_gap_indices: [0, 1, 2],
    target_gap_index: 2,
    target_gap_sse: 15,
    anchor_gap_index: 0,
    mutable_suffix_sse: 35,
    estimated_anchor_cost_frames: 100,
    estimated_anchor_cost_upper_frames: 100,
    considered_targets: sse.map((targetSse, gap) => ({
      target_gap_index: gap,
      target_gap_sse: targetSse,
      anchor_options: [{
        parent_depth: 0,
        anchor_gap_index: gap,
        estimated_anchor_cost_frames: costs[gap]!,
        estimated_anchor_cost_upper_frames: costs[gap]!,
        anchor_cost_source: "measured_cost_to_end" as const,
        affordability: "affordable" as const,
      }],
    })),
  };
  expect(replayBudgetRepairSelection(decision)).toMatchObject({
    targetGapIndex: 2,
    anchorGapIndex: 0,
    parentDepth: 2,
    mutableSuffixSse: 35,
  });
  expect(replayBudgetRepairSelection({
    ...decision,
    selection_policy: "max_suffix_opportunity",
  })).toMatchObject({
    targetGapIndex: 2,
    anchorGapIndex: 0,
    parentDepth: 2,
    mutableSuffixSse: 35,
  });
});

test("replays a worst-gap decision that reserves the cheapest current repair", () => {
  const point = [90, 75, 55, 25, 8];
  const upper = [95, 80, 60, 30, 10];
  const observedTarget = (gap: number, sse: number) => ({
    target_gap_index: gap,
    target_gap_sse: sse,
    anchor_options: Array.from({ length: gap + 1 }, (_, parentDepth) => {
      const anchor = gap - parentDepth;
      return {
        parent_depth: parentDepth,
        anchor_gap_index: anchor,
        estimated_anchor_cost_frames: point[anchor]!,
        estimated_anchor_cost_upper_frames: upper[anchor]!,
        anchor_cost_source: "measured_cost_to_end" as const,
        affordability: "affordable" as const,
      };
    }),
  });
  const decision: BudgetRepairDecision = {
    ...TEST_REPAIR_DECISION,
    remaining_budget_frames: 100,
    headroom_fraction: 0,
    usable_budget_frames: 100,
    selection_policy: "worst_gap_reserve_cheapest_repair",
    parent_depth: 3,
    affordable_target_gap_indices: [2, 4],
    affordable_anchor_gap_indices: [0, 1, 2, 3, 4],
    target_gap_index: 4,
    target_gap_sse: 20,
    anchor_gap_index: 1,
    mutable_suffix_sse: 25,
    estimated_anchor_cost_frames: 75,
    estimated_anchor_cost_upper_frames: 80,
    considered_targets: [observedTarget(2, 5), observedTarget(4, 20)],
  };
  expect(replayBudgetRepairSelection(decision)).toMatchObject({
    targetGapIndex: 4,
    anchorGapIndex: 1,
    parentDepth: 3,
    mutableSuffixSse: 25,
  });
  expect(replayBudgetRepairSelection({
    ...decision,
    selection_policy: "worst_gap_reserve_cheapest_else_deepest",
  })).toMatchObject({
    targetGapIndex: 4,
    anchorGapIndex: 1,
    parentDepth: 3,
    mutableSuffixSse: 25,
  });
});

test("replays the explicit one-gap-later repeated-rejection decision", () => {
  const point = [90, 70, 50, 30, 10];
  const upper = [95, 75, 55, 35, 15];
  const decision: BudgetRepairDecision = {
    ...TEST_REPAIR_DECISION,
    remaining_budget_frames: 100,
    headroom_fraction: 0,
    usable_budget_frames: 100,
    selection_policy: "worst_gap_repeated_rejection_step_later",
    parent_depth: 3,
    affordable_target_gap_indices: [0, 1, 2, 3, 4],
    affordable_anchor_gap_indices: [0, 1, 2, 3, 4],
    target_gap_index: 4,
    target_gap_sse: 20,
    anchor_gap_index: 1,
    mutable_suffix_sse: 23,
    estimated_anchor_cost_frames: 70,
    estimated_anchor_cost_upper_frames: 75,
    considered_targets: Array.from({ length: 5 }, (_, gap) => ({
      target_gap_index: gap,
      target_gap_sse: gap === 4 ? 20 : 1,
      anchor_options: Array.from({ length: gap + 1 }, (_, parentDepth) => {
        const anchor = gap - parentDepth;
        return {
          parent_depth: parentDepth,
          anchor_gap_index: anchor,
          estimated_anchor_cost_frames: point[anchor]!,
          estimated_anchor_cost_upper_frames: upper[anchor]!,
          anchor_cost_source: "measured_cost_to_end" as const,
          affordability: "affordable" as const,
        };
      }),
    })),
  };
  expect(replayBudgetRepairSelection(decision)).toMatchObject({
    targetGapIndex: 4,
    anchorGapIndex: 1,
    parentDepth: 3,
    mutableSuffixSse: 23,
  });
});

test("replays a worst-gap runway-opportunity decision", () => {
  const point = [100, 80, 60, 40, 10];
  const observedTarget = (gap: number, sse: number) => ({
    target_gap_index: gap,
    target_gap_sse: sse,
    anchor_options: Array.from({ length: gap + 1 }, (_, parentDepth) => {
      const anchor = gap - parentDepth;
      return {
        parent_depth: parentDepth,
        anchor_gap_index: anchor,
        estimated_anchor_cost_frames: point[anchor]!,
        estimated_anchor_cost_upper_frames: point[anchor]!,
        anchor_cost_source: "measured_cost_to_end" as const,
        affordability: "affordable" as const,
      };
    }),
  });
  const decision: BudgetRepairDecision = {
    ...TEST_REPAIR_DECISION,
    remaining_budget_frames: 100,
    headroom_fraction: 0,
    usable_budget_frames: 100,
    selection_policy: "worst_gap_runway_opportunity_per_cost",
    parent_depth: 0,
    affordable_target_gap_indices: [0, 1, 2, 3, 4],
    affordable_anchor_gap_indices: [0, 1, 2, 3, 4],
    target_gap_index: 4,
    target_gap_sse: 20,
    anchor_gap_index: 4,
    mutable_suffix_sse: 20,
    estimated_anchor_cost_frames: 10,
    estimated_anchor_cost_upper_frames: 10,
    considered_targets: Array.from({ length: 5 }, (_, gap) =>
      observedTarget(gap, gap === 4 ? 20 : 1)
    ),
  };
  expect(replayBudgetRepairSelection(decision)).toMatchObject({
    targetGapIndex: 4,
    anchorGapIndex: 4,
    parentDepth: 0,
    mutableSuffixSse: 20,
  });
});

test("replays a worst-gap window-opportunity decision", () => {
  const point = [100, 80, 60, 40, 10];
  const observedTarget = (gap: number, sse: number) => ({
    target_gap_index: gap,
    target_gap_sse: sse,
    anchor_options: Array.from({ length: gap + 1 }, (_, parentDepth) => {
      const anchor = gap - parentDepth;
      return {
        parent_depth: parentDepth,
        anchor_gap_index: anchor,
        estimated_anchor_cost_frames: point[anchor]!,
        estimated_anchor_cost_upper_frames: point[anchor]!,
        anchor_cost_source: "measured_cost_to_end" as const,
        affordability: "affordable" as const,
      };
    }),
  });
  const decision: BudgetRepairDecision = {
    ...TEST_REPAIR_DECISION,
    remaining_budget_frames: 100,
    headroom_fraction: 0,
    usable_budget_frames: 100,
    selection_policy: "worst_gap_window_opportunity_per_cost",
    parent_depth: 0,
    affordable_target_gap_indices: [0, 1, 2, 3, 4],
    affordable_anchor_gap_indices: [0, 1, 2, 3, 4],
    target_gap_index: 4,
    target_gap_sse: 20,
    anchor_gap_index: 4,
    mutable_suffix_sse: 20,
    estimated_anchor_cost_frames: 10,
    estimated_anchor_cost_upper_frames: 10,
    considered_targets: Array.from({ length: 5 }, (_, gap) =>
      observedTarget(gap, gap === 4 ? 20 : 1)
    ),
  };
  expect(replayBudgetRepairSelection(decision)).toMatchObject({
    targetGapIndex: 4,
    anchorGapIndex: 4,
    parentDepth: 0,
    mutableSuffixSse: 20,
  });
});

/**
 * A schema-v1 artifact, whatever schema the checked-in one currently declares:
 * the shipped model with every v2 feature stripped back off.
 */
function v1Artifact(): BudgetEstimatorModelArtifact {
  const model = structuredClone(BUDGET_ESTIMATOR_MODEL);
  model.schema = BUDGET_ESTIMATOR_MODEL_SCHEMA_V1;
  delete model.structural.referenceBudgetFrames;
  delete model.structural.budgetExponent;
  delete model.interval.byEventAndPath;
  model.applicability.pathEstimate = "calibrated_when_available";
  return model;
}

/** The same artifact carrying an exact, hand-checkable budget law. */
function lawArtifact(budgetExponent: number): BudgetEstimatorModelArtifact {
  const model = v1Artifact();
  model.schema = BUDGET_ESTIMATOR_MODEL_SCHEMA_V2;
  model.structural.referenceBudgetFrames = 750_000;
  model.structural.budgetExponent = budgetExponent;
  model.applicability.structuralPolicyBudgetFrames = { min: 150_000, max: 1_500_000 };
  return model;
}

describe("budget estimator budget law", () => {
  test("reads a v1 artifact as a zero-exponent law, byte for byte", () => {
    const model = v1Artifact();
    const parsed = parseBudgetEstimatorModel(model);

    expect(parsed).toEqual(model);
    // The artifact fingerprint is a hash of exactly this serialization, so
    // key-for-key identity is what keeps an unchanged artifact unchanged.
    expect(JSON.stringify(parsed)).toBe(JSON.stringify(model));
    expect(parsed.structural).not.toHaveProperty("budgetExponent");
    for (const budget of [1, 75_000, 750_000, 2_250_000]) {
      expect(budgetEstimatorStructuralScale(budget, model)).toBe(1);
    }
    // A v2 artifact that simply has no exponent is the same model again.
    const emptyLaw = { ...model, schema: BUDGET_ESTIMATOR_MODEL_SCHEMA_V2 };
    expect(budgetEstimatorStructuralScale(150_000, emptyLaw)).toBe(1);
  });

  test("scales structural work by (budget / reference)^exponent", () => {
    const half = lawArtifact(0.5);
    expect(budgetEstimatorStructuralScale(3_000_000, half)).toBeCloseTo(2, 12);
    expect(budgetEstimatorStructuralScale(750_000, half)).toBe(1);
    expect(budgetEstimatorStructuralScale(187_500, half)).toBeCloseTo(0.5, 12);
    // Degenerate budgets have no ratio to raise and must not zero an estimate.
    expect(budgetEstimatorStructuralScale(0, half)).toBe(1);

    const law = lawArtifact(0.8185);
    expect(budgetEstimatorStructuralScale(150_000, law))
      .toBeCloseTo(Math.pow(0.2, 0.8185), 12);
    // The scale multiplies the structural quantity, so a path-free estimate
    // moves with it and the corrections stay untouched.
    const structural = 100_000;
    const scaled = structural * budgetEstimatorStructuralScale(150_000, law);
    expect(estimateRemainingBudgetWork({
      structural: scaled,
      path: null,
      pace: null,
      progressFraction: 0,
    }, law)).toBeCloseTo(scaled * law.combination.correctionWithoutPathFactor, 6);
  });

  test("marks the calibrated domain edges and refuses an unreadable law", () => {
    const law = lawArtifact(0.8185);
    const domain = law.applicability.structuralPolicyBudgetFrames;
    for (const [budget, expected] of [
      [domain.min - 1, "extrapolated_policy_budget"],
      [domain.min, "calibrated"],
      [domain.max, "calibrated"],
      [domain.max + 1, "extrapolated_policy_budget"],
      // The out-of-range edges the study measured, and the 2M music corpus.
      [75_000, "extrapolated_policy_budget"],
      [2_000_000, "extrapolated_policy_budget"],
      [2_250_000, "extrapolated_policy_budget"],
    ] as const) {
      expect(budgetEstimatorApplicability({
        pathAvailable: false,
        policyBudgetFrames: budget,
        attemptKind: "initial",
      }, law)).toBe(expected);
    }

    // A path-backed estimate is calibrated everywhere under the original claim
    // and only inside the domain under the scoped one. The four-budget panel
    // forced the option: path-backed estimates are unbiased at 300k-1.5M and
    // 19% biased at 150k, so a fit above 150k cannot vouch for them there.
    for (const [claim, atEdge] of [
      ["calibrated_when_available", "calibrated"],
      ["calibrated_when_available_in_domain", "extrapolated_policy_budget"],
    ] as const) {
      const scoped = structuredClone(law);
      scoped.applicability.pathEstimate = claim;
      for (const [budget, expected] of [
        [domain.min - 1, atEdge],
        [domain.min, "calibrated"],
        [domain.max + 1, atEdge],
      ] as const) {
        expect(budgetEstimatorApplicability({
          pathAvailable: true,
          policyBudgetFrames: budget,
          attemptKind: "repair",
        }, scoped)).toBe(expected);
      }
    }
    // The scoped claim is a v2 feature for the same reason the law is: a reader
    // that predates it would report `calibrated` where this artifact does not.
    expect(() => parseBudgetEstimatorModel({
      ...law,
      schema: BUDGET_ESTIMATOR_MODEL_SCHEMA_V1,
      structural: { ...law.structural, referenceBudgetFrames: undefined, budgetExponent: undefined },
      applicability: { ...law.applicability, pathEstimate: "calibrated_when_available_in_domain" },
    })).toThrow(/domain-scoped path claim/);

    expect(parseBudgetEstimatorModel(law)).toEqual(law);
    // A v1 artifact carrying a law is the dangerous artifact: every reader that
    // predates schema v2 would parse it and silently drop the exponent.
    expect(() => parseBudgetEstimatorModel({ ...law, schema: BUDGET_ESTIMATOR_MODEL_SCHEMA_V1 }))
      .toThrow(/cannot carry a budget law/);
    expect(() => parseBudgetEstimatorModel({
      ...law,
      structural: { ...law.structural, referenceBudgetFrames: 0 },
    })).toThrow(/referenceBudgetFrames/);
    expect(() => parseBudgetEstimatorModel({
      ...law,
      structural: { ...law.structural, budgetExponent: -0.1 },
    })).toThrow(/budgetExponent/);
    const orphan = lawArtifact(0.8);
    delete orphan.structural.referenceBudgetFrames;
    expect(() => parseBudgetEstimatorModel(orphan)).toThrow(/requires a positive referenceBudgetFrames/);
  });

  test("resolves intervals stratum, then event, then aggregate", () => {
    const model = v1Artifact();
    model.interval = {
      lowerRatio: 0.5,
      upperRatio: 4,
      nominalCoverage: 0.95,
      byEvent: {
        start: { lowerRatio: 0.8, upperRatio: 1.2 },
        high_water: { lowerRatio: 0.7, upperRatio: 1.3 },
      },
    };

    // Without strata the path dimension changes nothing at all: this is the
    // pre-stratification artifact and it must answer exactly as it used to.
    for (const pathAvailable of [true, false, undefined]) {
      expect(budgetEstimateInterval(100, { event: "start", pathAvailable }, model))
        .toEqual({ lower: 80, upper: 120 });
    }
    expect(budgetEstimateInterval(100, { event: "end", pathAvailable: true }, model))
      .toEqual({ lower: 50, upper: 400 });
    expect(budgetEstimateInterval(100, {}, model)).toEqual({ lower: 50, upper: 400 });

    const stratified = structuredClone(model);
    stratified.schema = BUDGET_ESTIMATOR_MODEL_SCHEMA_V2;
    stratified.interval.byEventAndPath = {
      // A path-backed estimate measures the incumbent's own suffix and is
      // tighter; a path-free one is a regression and is not.
      start: { withPath: { lowerRatio: 0.95, upperRatio: 1.05 } },
      high_water: {
        withPath: { lowerRatio: 0.9, upperRatio: 1.1 },
        withoutPath: { lowerRatio: 0.6, upperRatio: 1.5 },
      },
    };
    expect(budgetEstimateInterval(100, { event: "start", pathAvailable: true }, stratified))
      .toEqual({ lower: 95, upper: 105 });
    // `start` has no path-free stratum, so it falls back to its event.
    expect(budgetEstimateInterval(100, { event: "start", pathAvailable: false }, stratified))
      .toEqual({ lower: 80, upper: 120 });
    expect(budgetEstimateInterval(100, { event: "high_water", pathAvailable: false }, stratified))
      .toEqual({ lower: 60, upper: 150 });
    // A caller that cannot say uses the event band, never a guessed stratum.
    expect(budgetEstimateInterval(100, { event: "high_water" }, stratified))
      .toEqual({ lower: 70, upper: 130 });
    // `end` has neither stratum nor event, so it lands on the aggregate.
    expect(budgetEstimateInterval(100, { event: "end", pathAvailable: true }, stratified))
      .toEqual({ lower: 50, upper: 400 });

    // "Path-backed" means the selector actually used the path. Under a
    // structural base mode it never does, so such an estimate reads the
    // path-free band however much measured path it had.
    const structuralBase = structuredClone(stratified);
    structuralBase.combination.baseMode = "structural";
    expect(budgetEstimateUsesPath(true, structuralBase)).toBe(false);
    expect(budgetEstimateInterval(100, { event: "high_water", pathAvailable: true }, structuralBase))
      .toEqual({ lower: 60, upper: 150 });

    expect(parseBudgetEstimatorModel(stratified)).toEqual(stratified);
    expect(() => parseBudgetEstimatorModel({
      ...stratified,
      schema: BUDGET_ESTIMATOR_MODEL_SCHEMA_V1,
    })).toThrow(/interval strata/);
    expect(() => parseBudgetEstimatorModel({
      ...stratified,
      interval: {
        ...stratified.interval,
        byEventAndPath: { start: { withPath: { lowerRatio: 1.2, upperRatio: 1.5 } } },
      },
    })).toThrow(/invalid budget estimator interval for start\/withPath/);
    expect(() => parseBudgetEstimatorModel({
      ...stratified,
      interval: {
        ...stratified.interval,
        byEventAndPath: { start: { sometimes: { lowerRatio: 0.9, upperRatio: 1.1 } } },
      },
    })).toThrow(/unknown budget estimator interval stratum/);
  });

  test("applies one budget scale per compile and leaves progress and pace invariant", () => {
    const record = (policyBudgetFrames: number) => {
      const recorder = new CompileBudgetTelemetryRecorder({
        level: "trace",
        gaps: GAPS,
        durationFrames: 100,
        hardBudgetFrames: 2_000_000,
        policyBudgetFrames,
        model: TEST_MODEL,
      });
      recorder.startEpisode({
        lane: "initial",
        searchSeed: 1,
        frontierHasFallbackLane: false,
        anchorGapIndex: 0,
        startTotalSpentFrames: 0,
        ceilingTotalSpentFrames: 2_000_000,
        includeStartup: true,
      });
      recorder.observeActiveEpisode(2, 10_000);
      recorder.endEpisode(20_000, "compile_finished");
      recorder.recordSegment("initial_search", 0, 20_000, "compile_finished", 0);
      return recorder.snapshot(20_000, false)!.episodes[0];
    };
    const scarce = record(150_000);
    const rich = record(1_500_000);
    const expected = budgetEstimatorStructuralScale(150_000) /
      budgetEstimatorStructuralScale(1_500_000);

    // The whole law is one scalar per compile: structural work carries it and
    // nothing else does.
    expect(scarce.start.structural_work_prior_frames /
      rich.start.structural_work_prior_frames).toBeCloseTo(expected, 12);
    for (const index of [0, 1]) {
      const a = scarce.observations![index];
      const b = rich.observations![index];
      // Both ratios cancel the scale exactly in exact arithmetic and to float
      // noise in this one, so they are the same measurement at both budgets.
      expect(a.structural_progress_fraction).toBeCloseTo(b.structural_progress_fraction, 12);
      expect(a.episode_pace_work_estimate_frames === null)
        .toBe(b.episode_pace_work_estimate_frames === null);
      if (a.episode_pace_work_estimate_frames !== null) {
        expect(a.episode_pace_work_estimate_frames / b.episode_pace_work_estimate_frames!)
          .toBeCloseTo(1, 9);
      }
      expect(a.structural_work_prior_frames / b.structural_work_prior_frames)
        .toBeCloseTo(expected, 12);
    }
  });
});

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
    expect(budgetEstimateInterval(100, { event: "start" }, model)).toEqual({ lower: 80, upper: 120 });
    expect(budgetEstimateInterval(100, { event: "end" }, model)).toEqual({ lower: 50, upper: 200 });
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
    // This artifact makes the original unscoped path claim, so a path-backed
    // estimate is calibrated at any budget.
    model.applicability.pathEstimate = "calibrated_when_available";
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
    expect(budgetEstimatorApplicability({
      pathAvailable: false,
      policyBudgetFrames: model.applicability.structuralPolicyBudgetFrames.min,
      attemptKind: "deferred_value",
    }, model)).toBe("unvalidated_attempt_kind");
    expect(parseBudgetEstimatorModel(model)).toEqual(model);
    expect(() => parseBudgetEstimatorModel({ ...model, schema: "wrong" })).toThrow(/schema/);
  });

  test("records contiguous intervals, episode outcomes, and exact budget identities", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "trace",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 1_000,
      policyBudgetFrames: 800,
      model: TEST_MODEL,
    });
    const episode = recorder.startEpisode({
      lane: "initial",
      searchSeed: 42,
      frontierHasFallbackLane: false,
      anchorGapIndex: 0,
      startTotalSpentFrames: 0,
      ceilingTotalSpentFrames: 800,
      includeStartup: true,
    });
    recorder.recordSegment("startup", 0, 20, "ready", episode);
    recorder.observeActiveEpisode(1, 80);
    recorder.observeActiveEpisode(2, 160);
    recorder.recordEvaluation({
      totalSpentFrames: 240,
      gapIndex: GAPS.length,
      terminal: true,
      origin: "frontier",
      firstTimeSearchNode: true,
      terminalTrackKey: "track-a",
      registerImproved: true,
    });
    recorder.endEpisode(260, "compile_finished", {
      registerKeyAtEnd: {
        contract_passed: true,
        axis_quality: 0.9,
        internal_full_score: 900,
        drift_quality: 0.8,
      },
    });
    recorder.recordSegment("initial_search", 20, 260, "compile_finished", episode);

    const telemetry = recorder.snapshot(260, false, 240, 240);
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
    // A different traversal model has no claim on the shipped calibration.
    expect(telemetry?.compile.initial_structural_applicability).toBe("unvalidated_traversal_model");
    expect(telemetry?.model.calibrated).toBe(false);
    expect(telemetry?.episodes[0].start.estimator_applicability).toBe("unvalidated_traversal_model");
    expect(telemetry?.execution_intervals.map((interval) => interval.spent_frames)).toEqual([20, 240]);
    const recordedEpisode = telemetry?.episodes[0];
    expect(recordedEpisode?.ceiling_source).toBe("hard_budget");
    expect(recordedEpisode?.work).toMatchObject({
      register_offers: 1,
      terminal_node_evaluations: 1,
      first_time_terminal_node_evaluations: 1,
      distinct_terminal_tracks: 1,
      register_improvements: 1,
      terminal_register_improvements: 1,
    });
    expect(recordedEpisode?.outcome).toEqual({
      stop_reason: "compile_finished",
      end_total_spent_frames: 260,
      spent_frames: 260,
      terminal_reached: true,
      first_terminal_offset_frames: 240,
      register_improved: true,
      accepted_alternative: false,
      first_register_improvement_offset_frames: 240,
      final_register_improvement_offset_frames: 240,
      first_terminal_register_improvement_offset_frames: 240,
      internal_full_score_delta: null,
      terminal_offer_target_gap: null,
      incumbent_target_gap_after: null,
      working_to_offer_divergence: null,
      rejected_local_improvement_followup: "not_rejected_local_improvement",
      rejected_local_improvement_bridge_assessment: null,
      terminal_offer_track_hash: null,
      terminal_observation_censored: false,
    });
    expect(recordedEpisode?.observations?.map((observation) => observation.event)).toEqual([
      "start",
      "high_water",
      "high_water",
      "terminal",
      "end",
    ]);
  });

  test("attributes a deferred-value suffix without repair semantics", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "summary",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 1_000,
      policyBudgetFrames: 800,
      repairBudgetFrames: 900,
    });
    const initialEpisodeId = recorder.startEpisode({
      lane: "initial",
      searchSeed: 42,
      frontierHasFallbackLane: false,
      anchorGapIndex: 0,
      startTotalSpentFrames: 0,
      ceilingTotalSpentFrames: 1_000,
      ceilingSource: "hard_budget",
      includeStartup: true,
    });
    recorder.endEpisode(200, "handoff_to_repair");
    recorder.recordSegment("initial_search", 0, 200, "handoff_to_repair", initialEpisodeId);
    const episodeId = recorder.startEpisode({
      lane: "deferred_value",
      parentEpisodeId: initialEpisodeId,
      searchSeed: 42,
      frontierHasFallbackLane: true,
      anchorGapIndex: 2,
      startTotalSpentFrames: 200,
      ceilingTotalSpentFrames: 500,
      ceilingSource: "deferred_value_allowance",
      includeStartup: false,
      pathEstimateByGap: null,
    });
    recorder.recordEvaluation({
      totalSpentFrames: 350,
      gapIndex: GAPS.length,
      terminal: true,
      origin: "frontier",
      firstTimeSearchNode: true,
      terminalTrackKey: "deferred-track",
      registerImproved: true,
    });
    recorder.endEpisode(350, "first_terminal_return", {
      registerKeyAtEnd: {
        contract_passed: true,
        axis_quality: 0.9,
        internal_full_score: 900,
        drift_quality: 0.8,
      },
    });
    recorder.recordSegment(
      "deferred_value_suffix",
      200,
      350,
      "terminal_reached",
      episodeId,
    );
    const telemetry = recorder.snapshot(350, false, 350, 350)!;
    const episode = telemetry.episodes[1]!;
    expect(episode).toMatchObject({
      lane: "deferred_value",
      ceiling_source: "deferred_value_allowance",
      repair_decision: null,
      outcome: {
        terminal_reached: true,
        accepted_alternative: false,
        stop_reason: "first_terminal_return",
      },
    });
    expect(episode.start.estimator_applicability).toBe("unvalidated_attempt_kind");
    expect(telemetry.compile.final_output_lane).toBe("deferred_value");
  });

  test("treats a zero incumbent path as absent rather than as a path-backed estimate", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "trace",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 1_000,
      policyBudgetFrames: 800,
    });
    recorder.startEpisode({
      lane: "repair",
      searchSeed: 3,
      frontierHasFallbackLane: true,
      anchorGapIndex: 1,
      startTotalSpentFrames: 0,
      ceilingTotalSpentFrames: 500,
      ceilingSource: "measured_cost_to_end",
      includeStartup: false,
      // Gap 1 has no measured cost; gap 2 does.
      pathEstimateByGap: [0, 0, 250, 0, 0],
      repairDecision: {
        ...TEST_REPAIR_DECISION,
        remaining_budget_frames: 800,
        headroom_fraction: 0.5,
      },
      incumbentTargetGapBefore: { status: "measured", gap_index: 2, sse: 0.25, axes: {} },
      workingTargetGapBefore: { status: "measured", gap_index: 2, sse: 0.25, axes: {} },
    });
    recorder.observeActiveEpisode(2, 100);
    recorder.endEpisode(200, "frontier_exhausted", {
      incumbentTargetGapAfter: { status: "measured", gap_index: 2, sse: 0.25, axes: {} },
    });
    recorder.recordSegment("repair_frontier", 0, 200, "frontier_exhausted", 0);
    const episode = recorder.snapshot(200, false)?.episodes[0];
    const [start, advanced] = episode?.observations ?? [];

    // The estimator's selector discards a non-positive path, so admitting one
    // here would label a structural estimate as path-backed.
    expect(start.incumbent_path_work_estimate_frames).toBeNull();
    expect(start.estimator_applicability).not.toBe("calibrated");
    expect(advanced.incumbent_path_work_estimate_frames).toBe(250);
    // A path-backed observation is classified by the path rule, whatever the
    // shipped artifact's domain says about this budget; a path-free repair
    // would instead be `unvalidated_attempt_kind`.
    expect(advanced.estimator_applicability).toBe(budgetEstimatorApplicability({
      pathAvailable: true,
      policyBudgetFrames: 800,
      attemptKind: "repair",
    }));
    expect(advanced.estimator_applicability).not.toBe("unvalidated_attempt_kind");
    expect(start.estimator_applicability).toBe("unvalidated_attempt_kind");
    expect(episode?.ceiling_source).toBe("measured_cost_to_end");
  });

  test("separates terminal node identity from terminal track geometry", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "summary",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 1_000,
      policyBudgetFrames: 1_000,
      model: TEST_MODEL,
    });
    recorder.startEpisode({
      lane: "initial",
      searchSeed: 1,
      frontierHasFallbackLane: false,
      anchorGapIndex: 0,
      startTotalSpentFrames: 0,
      ceilingTotalSpentFrames: 1_000,
      includeStartup: true,
    });
    recorder.recordEvaluation({
      totalSpentFrames: 100,
      gapIndex: GAPS.length,
      terminal: true,
      origin: "tail_completion",
      firstTimeSearchNode: true,
      terminalTrackKey: "same-geometry",
      registerImproved: true,
    });
    recorder.recordEvaluation({
      totalSpentFrames: 120,
      gapIndex: GAPS.length,
      terminal: true,
      origin: "tail_completion",
      firstTimeSearchNode: false,
      terminalTrackKey: "same-geometry",
      registerImproved: false,
    });
    recorder.endEpisode(120, "compile_finished", {
      registerKeyAtEnd: {
        contract_passed: true,
        axis_quality: 0.8,
        internal_full_score: 800,
        drift_quality: 0.7,
      },
    });
    recorder.recordSegment("initial_search", 0, 120, "compile_finished", 0);
    const work = recorder.snapshot(120, false, 100, 100)!.compile.work;

    expect(work).toMatchObject({
      terminal_node_evaluations: 2,
      first_time_terminal_node_evaluations: 1,
      revisited_terminal_node_evaluations: 1,
      distinct_terminal_tracks: 1,
      repeated_terminal_track_evaluations: 1,
    });
    expect(work.by_evaluation_origin.tail_completion).toEqual({
      register_offers: 2,
      terminal_node_evaluations: 2,
      register_improvements: 1,
      terminal_register_improvements: 1,
    });
  });

  test("keeps incomplete episodes explicitly censored", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "summary",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 50,
      policyBudgetFrames: 50,
      model: TEST_MODEL,
    });
    recorder.startEpisode({
      lane: "repair",
      searchSeed: 7,
      frontierHasFallbackLane: true,
      anchorGapIndex: 2,
      startTotalSpentFrames: 10,
      ceilingTotalSpentFrames: 50,
      includeStartup: false,
      repairDecision: {
        ...TEST_REPAIR_DECISION,
        remaining_budget_frames: 40,
        usable_budget_frames: 32,
        target_gap_index: 3,
        target_gap_sse: 0.1,
        anchor_gap_index: 2,
        affordable_target_gap_indices: [3],
        affordable_anchor_gap_indices: [2],
        mutable_suffix_sse: 0.1,
        estimated_anchor_cost_frames: 20,
        estimated_anchor_cost_upper_frames: 30,
        considered_targets: [{
          target_gap_index: 3,
          target_gap_sse: 0.1,
          anchor_options: [{
            parent_depth: 1,
            anchor_gap_index: 2,
            estimated_anchor_cost_frames: 20,
            estimated_anchor_cost_upper_frames: 30,
            anchor_cost_source: "measured_cost_to_end",
            affordability: "affordable",
          }],
        }],
      },
      incumbentTargetGapBefore: { status: "measured", gap_index: 3, sse: 0.1, axes: {} },
      workingTargetGapBefore: { status: "measured", gap_index: 3, sse: 0.1, axes: {} },
    });
    recorder.endEpisode(50, "local_ceiling", {
      incumbentTargetGapAfter: { status: "measured", gap_index: 3, sse: 0.1, axes: {} },
    });
    recorder.recordSegment("startup", 0, 10, "pre-episode");
    recorder.recordSegment("repair_frontier", 10, 50, "local_ceiling", 0);
    const episode = recorder.snapshot(50, true)?.episodes[0];
    expect(episode?.outcome.terminal_reached).toBe(false);
    expect(episode?.outcome.terminal_observation_censored).toBe(true);
    expect(episode?.observations).toBeUndefined();
    expect(episode?.end?.event).toBe("end");
  });

  test("finalizes a hard-budget capture of an open repair without inventing an offer", () => {
    const recorder = new CompileBudgetTelemetryRecorder({
      level: "summary",
      gaps: GAPS,
      durationFrames: 100,
      hardBudgetFrames: 50,
      policyBudgetFrames: 50,
      model: TEST_MODEL,
    });
    const target = { status: "measured", gap_index: 3, sse: 0.1, axes: {} } as const;
    const registerKey = {
      contract_passed: true,
      axis_quality: 0.9,
      internal_full_score: 900,
      drift_quality: 0.8,
    };
    recorder.startEpisode({
      lane: "repair",
      parentEpisodeId: null,
      searchSeed: 7,
      frontierHasFallbackLane: true,
      anchorGapIndex: 2,
      startTotalSpentFrames: 10,
      ceilingTotalSpentFrames: 50,
      includeStartup: false,
      repairDecision: {
        ...TEST_REPAIR_DECISION,
        remaining_budget_frames: 40,
        usable_budget_frames: 32,
        target_gap_index: 3,
        target_gap_sse: 0.1,
        anchor_gap_index: 2,
        affordable_target_gap_indices: [3],
        affordable_anchor_gap_indices: [2],
        mutable_suffix_sse: 0.1,
        estimated_anchor_cost_frames: 20,
        estimated_anchor_cost_upper_frames: 30,
        considered_targets: [{
          target_gap_index: 3,
          target_gap_sse: 0.1,
          anchor_options: [{
            parent_depth: 1,
            anchor_gap_index: 2,
            estimated_anchor_cost_frames: 20,
            estimated_anchor_cost_upper_frames: 30,
            anchor_cost_source: "measured_cost_to_end",
            affordability: "affordable",
          }],
        }],
      },
      incumbentTargetGapBefore: target,
      workingTargetGapBefore: target,
      registerKeyAtStart: registerKey,
    });

    const episode = recorder.snapshot(50, true)!.episodes[0]!;
    expect(episode.outcome).toMatchObject({
      stop_reason: "budget_capture",
      terminal_reached: false,
      terminal_observation_censored: true,
      terminal_offer_target_gap: null,
      incumbent_target_gap_after: target,
      internal_full_score_delta: 0,
    });
    expect(episode.register_key_at_end).toEqual(registerKey);
  });

  test("is byte-behavior-neutral at off, summary, and trace levels", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const options = { budget: 20_000, maxNodes: 12, polish: false } as const;
    const off = compileLegacyHandoff(spec, 0, { ...options, budgetTelemetry: "off" });
    const summary = compileLegacyHandoff(spec, 0, { ...options, budgetTelemetry: "summary" });
    const trace = compileLegacyHandoff(spec, 0, { ...options, budgetTelemetry: "trace" });
    const traceAgain = compileLegacyHandoff(spec, 0, { ...options, budgetTelemetry: "trace" });

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
      trace.budgetTelemetry?.execution_intervals.reduce(
        (sum, interval) => sum + interval.spent_frames,
        0,
      ),
    ).toBe(trace.stats.sim_frames);
  }, 120_000);

  test("stays behavior-neutral at a repair-enabled budget", async () => {
    // The 20k cell above never reaches the repair gate, so it cannot prove that
    // the repair-phase and resumed-search instrumentation is observation-only.
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const options = { budget: 150_000, polish: false } as const;
    const off = compileLegacyHandoff(spec, 0, { ...options, budgetTelemetry: "off" });
    const summary = compileLegacyHandoff(spec, 0, { ...options, budgetTelemetry: "summary" });
    const trace = compileLegacyHandoff(spec, 0, { ...options, budgetTelemetry: "trace" });

    for (const candidate of [summary, trace]) {
      expect(candidate.track).toEqual(off.track);
      expect(candidate.report).toEqual(off.report);
      expect(candidate.stats).toEqual(off.stats);
    }
    expect(trace.budgetTelemetry?.episodes.some((episode) => episode.lane === "repair")).toBe(true);
  }, 180_000);

  test("attributes repair and resumed search at a repair-enabled budget", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const result = compileLegacyHandoff(spec, 0, {
      budget: 150_000,
      polish: false,
      budgetTelemetry: "trace",
    });
    const telemetry = result.budgetTelemetry!;
    const episodes = telemetry.episodes;
    const repairs = episodes.filter((episode) => episode.lane === "repair");
    const observations = episodes.flatMap((episode) => episode.observations ?? []);

    expect(repairs.length).toBeGreaterThan(0);
    expect(observations.some((observation) =>
      (observation.incumbent_path_work_estimate_frames ?? 0) > 0
    )).toBe(true);
    // A measured path routes the estimate through the path branch, so such an
    // observation is never classified by the path-free attempt-kind rule. It
    // may still be out of the artifact's policy-budget domain.
    for (const observation of observations) {
      if ((observation.incumbent_path_work_estimate_frames ?? 0) <= 0) continue;
      expect(observation.estimator_applicability).not.toBe("unvalidated_attempt_kind");
    }

    // Every repair carries its full self-contained decision; other lanes do not.
    for (const episode of episodes) {
      if (episode.lane === "repair") continue;
      expect(episode.repair_decision).toBeNull();
      expect(episode.incumbent_target_gap_before).toBeNull();
      expect(episode.working_target_gap_before).toBeNull();
    }
    let previousIteration = -1;
    for (const repair of repairs) {
      expect(repair.repair_decision).not.toBeNull();
      expect(repair.repair_decision!.iteration_index).toBeGreaterThan(previousIteration);
      previousIteration = repair.repair_decision!.iteration_index;
      expect(repair.repair_decision!.parent_depth).toBeGreaterThanOrEqual(0);
      expect(repair.repair_decision!.anchor_gap_index).toBe(repair.anchor.gap_index);
      expect(repair.repair_decision!.working_track_source).toBe("global_incumbent");
      expect(repair.repair_decision!.working_track_hash)
        .toBe(repair.repair_decision!.incumbent_track_hash);
      expect(repair.incumbent_target_gap_before?.status).toBe("measured");
      expect(repair.working_target_gap_before).toEqual(repair.incumbent_target_gap_before);
      const incumbentBefore = repair.incumbent_target_gap_before;
      expect(incumbentBefore?.status === "measured" ? incumbentBefore.sse : -1)
        .toBeGreaterThanOrEqual(0);
      expect(repair.outcome.incumbent_target_gap_after).not.toBeNull();
      expect(repair.outcome.terminal_offer_target_gap === null)
        .toBe(!repair.outcome.terminal_reached);
      if (repair.outcome.accepted_alternative) {
        expect(repair.outcome.terminal_offer_target_gap)
          .toEqual(repair.outcome.incumbent_target_gap_after);
      } else {
        expect(repair.outcome.incumbent_target_gap_after)
          .toEqual(repair.incumbent_target_gap_before);
      }
      expect(["measured_cost_to_end", "per_gap_fallback", "repair_budget_remaining"])
        .toContain(repair.ceiling_source);
      // A repair always knows what it did to the incumbent's score; the
      // improvement offset exists exactly when the register took something.
      expect(repair.outcome.internal_full_score_delta).not.toBeNull();
      expect(repair.outcome.rejected_local_improvement_followup).not.toBe("scheduled");
      const offset = repair.outcome.first_register_improvement_offset_frames;
      if (repair.outcome.register_improved) {
        expect(offset).not.toBeNull();
        expect(offset!).toBeGreaterThanOrEqual(0);
        expect(offset!).toBeLessThanOrEqual(repair.outcome.spent_frames!);
      } else {
        expect(offset).toBeNull();
        expect(repair.outcome.internal_full_score_delta).toBe(0);
      }
    }

    // The resumed frontier owns charged work and can hold a terminal, so it
    // must be an attempt and not only a segment.
    const resumedIntervals = telemetry.execution_intervals.filter((interval) =>
      interval.kind === "resumed_search"
    );
    const resumed = episodes.filter((episode) => episode.lane === "resumed");
    expect(resumed.length).toBe(resumedIntervals.length);
    for (const interval of resumedIntervals) {
      const episode = episodes.find((candidate) => candidate.episode_id === interval.episode_id);
      expect(episode?.lane).toBe("resumed");
      expect(episode?.start_total_spent_frames).toBe(interval.start_total_spent_frames);
      expect(episode?.outcome.end_total_spent_frames).toBe(interval.end_total_spent_frames);
      expect(episode?.parent_episode_id).toBe(episodes[0].episode_id);
      expect(episode?.ceiling_total_spent_frames).toBe(telemetry.compile.hard_budget_frames);
      const inside = episode?.observations ?? [];
      expect(inside.length).toBeGreaterThan(0);
      for (const observation of inside) {
        expect(observation.total_spent_frames).toBeGreaterThanOrEqual(interval.start_total_spent_frames);
        expect(observation.total_spent_frames).toBeLessThanOrEqual(interval.end_total_spent_frames);
      }
    }

    // The compiler's own first-terminal counter must agree with attribution.
    const attributed = episodes
      .filter((episode) => episode.outcome.first_terminal_offset_frames !== null)
      .map((episode) =>
        episode.start_total_spent_frames + episode.outcome.first_terminal_offset_frames!
      );
    expect(telemetry.compile.first_terminal_total_spent_frames).toBe(Math.min(...attributed));
    expect(telemetry.compile.first_terminal_total_spent_frames)
      .toBe(result.stats.first_completion_frame);

    // Segments still partition all charged work exactly.
    let cursor = 0;
    for (const interval of telemetry.execution_intervals) {
      expect(interval.start_total_spent_frames).toBe(cursor);
      expect(interval.spent_frames).toBe(interval.end_total_spent_frames - cursor);
      cursor = interval.end_total_spent_frames;
    }
    expect(cursor).toBe(telemetry.compile.total_spent_frames);
    expect(telemetry.execution_intervals.some((interval) => interval.kind === "unattributed"))
      .toBe(false);
  }, 180_000);

  test("counts every actual ranked pool request at its authoritative boundary", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const builds: HandoffExpansionProbeRecord[] = [];
    setHandoffExpansionProbeHook((record) => builds.push(record));
    try {
      const output = compileLegacyHandoff(spec, 0, {
        budget: 20_000,
        maxNodes: 12,
        polish: false,
        budgetTelemetry: "summary",
      });
      const work = output.budgetTelemetry!.compile.work;
      expect(builds.length).toBeGreaterThan(0);
      expect(work.ranked_option_calls).toBe(builds.length);
      expect(work.requested_normal_proposals).toBe(
        builds.reduce((sum, build) => sum + build.nCand, 0),
      );
      expect(work.actual_candidate_samples).toBe(
        Object.values(work.candidate_samples_by_stream).reduce((sum, count) => sum + count, 0),
      );
    } finally {
      setHandoffExpansionProbeHook(null);
    }
  });

  test("protects repair-anchor breadth while narrowing only descendant pools", async () => {
    const previousPolicy = process.env.LR_STUDY_NCAND_POLICY;
    const spec = await loadGoldenSpec("cold_start", "base");
    const builds: HandoffExpansionProbeRecord[] = [];
    process.env.LR_STUDY_NCAND_POLICY = "repair-descendants-three-quarter";
    setHandoffExpansionProbeHook((record) => builds.push(record));
    try {
      const output = compileLegacyHandoff(spec, 0, {
        budget: 150_000,
        polish: false,
        budgetTelemetry: "trace",
      });
      const repairs = output.budgetTelemetry!.episodes.filter((episode) =>
        episode.lane === "repair"
      );
      const repairBuilds = builds.filter((build) => build.repairLane);
      const anchorBuilds = repairBuilds.filter((build) =>
        build.gapIndex === build.repairAnchorGapIndex
      );
      const descendantBuilds = repairBuilds.filter((build) =>
        build.repairAnchorGapIndex !== null && build.gapIndex > build.repairAnchorGapIndex
      );
      expect(repairs.length).toBeGreaterThan(0);
      expect(repairBuilds.length).toBeGreaterThan(0);
      expect(repairBuilds.every((build) => build.repairAnchorGapIndex !== null)).toBe(true);
      expect(anchorBuilds.length).toBeGreaterThan(0);
      expect(descendantBuilds.length).toBeGreaterThan(0);
      const fullWidth = Math.max(...repairBuilds.map((build) => build.nCand));
      const descendantWidth = Math.max(8, Math.round(fullWidth * 3 / 4));
      expect(anchorBuilds.every((build) => build.nCand === fullWidth)).toBe(true);
      expect(descendantBuilds.every((build) => build.nCand === descendantWidth)).toBe(true);
      expect(builds.filter((build) => !build.repairLane).every((build) =>
        build.repairAnchorGapIndex === null
      )).toBe(true);
    } finally {
      setHandoffExpansionProbeHook(null);
      if (previousPolicy === undefined) delete process.env.LR_STUDY_NCAND_POLICY;
      else process.env.LR_STUDY_NCAND_POLICY = previousPolicy;
    }
  }, 180_000);

  test("recomputes an independent deepest-affordable decision after accepted and rejected alternatives", async () => {
    const spec = await loadGoldenSpec("cold_start", "base");
    const options = {
      budget: 150_000,
      polish: false,
      budgetTelemetry: "trace" as const,
    };
    const first = compileLegacyHandoff(spec, 0, options);
    const second = compileLegacyHandoff(spec, 0, options);
    expect(second.track).toEqual(first.track);
    expect(second.report).toEqual(first.report);
    expect(second.stats).toEqual(first.stats);
    expect(second.budgetTelemetry).toEqual(first.budgetTelemetry);

    const repairs = first.budgetTelemetry!.episodes.filter((episode) =>
      episode.lane === "repair"
    );
    expect(repairs.length).toBeGreaterThan(1);
    expect(repairs.every((episode) => episode.work.terminal_node_evaluations <= 1))
      .toBe(true);
    const completed = repairs.filter((episode) => episode.outcome.terminal_reached);
    expect(completed.length).toBeGreaterThan(0);
    expect(completed.every((episode) => episode.outcome.stop_reason === "first_terminal_return"))
      .toBe(true);
    expect(new Set(repairs.map((episode) => episode.repair_decision!.iteration_index)).size)
      .toBe(repairs.length);
    expect(repairs.every((episode) =>
      episode.repair_decision!.parent_depth >= 0 &&
        episode.repair_decision!.parent_depth <= 6
    )).toBe(true);
    expect(repairs.every((episode) => episode.repair_decision!.headroom_fraction === 0)).toBe(true);
    expect(repairs.every((episode) =>
      episode.repair_decision!.anchor_gap_index ===
        episode.repair_decision!.target_gap_index - episode.repair_decision!.parent_depth
    )).toBe(true);
    expect(repairs.every((episode) =>
      episode.repair_decision!.affordable_target_gap_indices.includes(
        episode.repair_decision!.target_gap_index,
      )
    )).toBe(true);
    for (const repair of repairs) {
      const decision = repair.repair_decision!;
      const replayed = decision.considered_targets
        .filter((candidate) => candidate.anchor_options.some((anchor) =>
          anchor.affordability === "affordable"
        ))
        .sort((a, b) => b.target_gap_sse - a.target_gap_sse ||
          a.target_gap_index - b.target_gap_index)[0];
      const replayedAnchor = replayed.anchor_options
        .filter((anchor) => anchor.affordability === "affordable")
        .sort((a, b) => b.parent_depth - a.parent_depth)[0];
      expect(replayed).toMatchObject({
        target_gap_index: decision.target_gap_index,
        target_gap_sse: decision.target_gap_sse,
      });
      expect(replayedAnchor).toMatchObject({
        parent_depth: decision.parent_depth,
        anchor_gap_index: decision.anchor_gap_index,
        estimated_anchor_cost_frames: decision.estimated_anchor_cost_frames,
        estimated_anchor_cost_upper_frames: decision.estimated_anchor_cost_upper_frames,
        anchor_cost_source: decision.anchor_cost_source,
      });
      expect(decision.incumbent_track_hash).toMatch(/^[a-f0-9]{64}$/);
      if (repair.outcome.terminal_reached) {
        expect(repair.outcome.terminal_offer_track_hash).toMatch(/^[a-f0-9]{64}$/);
      } else {
        expect(repair.outcome.terminal_offer_track_hash).toBeNull();
      }
    }
    for (let index = 1; index < repairs.length; index++) {
      const previous = repairs[index - 1]!;
      const current = repairs[index]!;
      expect(current.repair_decision!.remaining_budget_frames)
        .toBeLessThan(previous.repair_decision!.remaining_budget_frames);
      expect(current.repair_decision!.incumbent_revision).toBe(
        previous.repair_decision!.incumbent_revision +
          (previous.outcome.accepted_alternative ? 1 : 0),
      );
      expect(current.repair_decision!.incumbent_track_hash).toBe(
        previous.outcome.accepted_alternative
          ? previous.outcome.terminal_offer_track_hash
          : previous.repair_decision!.incumbent_track_hash,
      );
    }
    expect(repairs.some((episode) => !episode.outcome.accepted_alternative)).toBe(true);
    expect(repairs.some((episode) => episode.outcome.accepted_alternative)).toBe(true);
    expect(new Set(repairs.map((episode) => episode.repair_decision!.target_gap_index)).size)
      .toBeGreaterThan(1);
    expect(completed.every((episode) =>
      episode.outcome.working_to_offer_divergence !== null &&
      episode.outcome.working_to_offer_divergence.divergent_suffix_gap_count > 0
    )).toBe(true);
  }, 180_000);

  test("protects a rejected local improvement for exactly one working-track follow-up", async () => {
    const previous = process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE;
    process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE = "1";
    try {
      const spec = await loadGoldenSpec("cold_start", "base");
      const result = compileLegacyHandoff(spec, 0, {
        budget: 150_000,
        polish: false,
        budgetTelemetry: "summary",
      });
      const repairs = result.budgetTelemetry!.episodes.filter((episode) =>
        episode.lane === "repair"
      );
      const bridges = repairs.filter((episode) =>
        episode.repair_decision!.working_track_source === "rejected_local_improvement"
      );
      expect(bridges.length).toBeGreaterThan(0);
      for (const bridge of bridges) {
        const parent = result.budgetTelemetry!.episodes[bridge.parent_episode_id!];
        expect(parent?.lane).toBe("repair");
        expect(parent?.outcome.accepted_alternative).toBe(false);
        expect(parent?.outcome.rejected_local_improvement_followup).toBe("scheduled");
        expect(bridge.repair_decision!.working_track_hash)
          .toBe(parent?.outcome.terminal_offer_track_hash);
        expect(bridge.repair_decision!.incumbent_track_hash)
          .toBe(parent?.repair_decision?.incumbent_track_hash);
        expect(bridge.outcome.rejected_local_improvement_followup).not.toBe("scheduled");
      }
      for (const repair of repairs) {
        if (repair.outcome.rejected_local_improvement_followup !== "scheduled") continue;
        const next = repairs[repair.repair_decision!.iteration_index + 1];
        expect(next?.parent_episode_id).toBe(repair.episode_id);
        expect(next?.repair_decision!.working_track_source)
          .toBe("rejected_local_improvement");
      }
    } finally {
      if (previous === undefined) delete process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE;
      else process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE = previous;
    }
  }, 180_000);

  test("records and enforces the optimistic bridge quality bound", async () => {
    const previous = process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE;
    process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE = "optimistic-axis-bound";
    try {
      const spec = await loadGoldenSpec("cold_start", "base");
      const result = compileLegacyHandoff(spec, 0, {
        budget: 150_000,
        polish: false,
        budgetTelemetry: "summary",
      });
      const repairs = result.budgetTelemetry!.episodes.filter((episode) =>
        episode.lane === "repair"
      );
      const assessed = repairs.filter((episode) =>
        episode.outcome.rejected_local_improvement_bridge_assessment !== null
      );
      expect(assessed.length).toBeGreaterThan(0);
      for (const episode of assessed) {
        const assessment = episode.outcome.rejected_local_improvement_bridge_assessment!;
        expect(assessment.policy).toBe("optimistic_axis_quality_bound");
        expect(assessment.mutable_suffix_axis_sse)
          .toBeLessThanOrEqual(assessment.total_axis_sse + 1e-9);
        expect(episode.outcome.rejected_local_improvement_followup).toBe(
          assessment.bound_can_beat_incumbent
            ? "scheduled"
            : "optimistic_bound_cannot_beat_incumbent",
        );
      }
    } finally {
      if (previous === undefined) delete process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE;
      else process.env.LR_REPAIR_REJECTED_LOCAL_BRIDGE = previous;
    }
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
    const result = compileLegacyHandoff(spec, 0, {
      budget: 150_000,
      polish: false,
      budgetTelemetry: "trace",
    });
    const repairs = result.budgetTelemetry!.episodes.filter((episode) => episode.lane === "repair");
    expect(repairs.length).toBeGreaterThan(0);

    for (const repair of repairs) {
      expect(repair.start.incumbent_path_work_estimate_frames).not.toBeNull();
      expect(repair.start.incumbent_path_work_estimate_frames!).toBeGreaterThan(0);
      // Path-backed, therefore never `unvalidated_attempt_kind`. Whether it is
      // additionally `calibrated` depends on the artifact's domain and its
      // declared path claim, which this test is not about.
      expect(repair.start.estimator_applicability).not.toBe("unvalidated_attempt_kind");
      // Wherever a reach stamp exists the ceiling is sized from it, never from
      // the per-gap average. `per_gap_fallback` now means a node in neither
      // reach map, which a stamped incumbent path cannot be.
      expect(repair.ceiling_source).not.toBe("per_gap_fallback");
    }
  }, 180_000);

  test("sizes a measured repair ceiling at its declared estimator upper bound", async () => {
    // The affordability test and the ceiling are the estimator's upper interval
    // bound for the attempt's own start observation — no hand-set feasibility
    // margin sits between them. Policy and recorder reach it independently
    // through the same pure functions and no shared state, which makes the
    // sizing tautology exact and checkable from the archive alone. The one
    // declared exception is the last-chance narrow breadth, whose decision
    // records the conservative cost ratio applied to both point and upper.
    //
    // The bound is the CALIBRATED one, `point x start/withPath upper ratio`.
    // The recorded `estimate_upper_frames` is not always the same number: out
    // of the artifact's policy-budget domain the recorder widens it to the
    // hard budget remaining, which is a scoping rule about what it may CLAIM,
    // not a different bound. This compile runs at 150k, outside that domain,
    // so it exercises exactly that divergence.
    const spec = await loadGoldenSpec("cold_start", "base");
    const result = compileLegacyHandoff(spec, 0, {
      budget: 150_000,
      polish: false,
      budgetTelemetry: "trace",
    });
    const sized = result.budgetTelemetry!.episodes.filter((episode) =>
      episode.lane === "repair" && episode.ceiling_source === "measured_cost_to_end"
    );
    expect(sized.length).toBeGreaterThan(0);
    for (const repair of sized) {
      const path = repair.start.incumbent_path_work_estimate_frames;
      expect(path).not.toBeNull();
      const point = estimateRemainingBudgetWork({
        structural: 0,
        path,
        pace: null,
        progressFraction: 1,
      });
      // The recorder's own start point estimate is that same number: at a start
      // there is no pace term yet, and the artifact's base mode takes the path.
      expect(repair.start.estimated_remaining_work_frames).toBeCloseTo(point, 9);
      const upper = budgetEstimateInterval(point, { event: "start", pathAvailable: true }).upper;
      const decision = repair.repair_decision!;
      const costRatio = decision.selection_policy ===
          "worst_gap_three_quarter_last_chance"
        ? REPAIR_LAST_CHANCE_COST_RATIO
        : 1;
      // The incumbent path observation remains the measured full-width cost.
      // A last-chance repair declares and applies its conservative narrow-width
      // cost ratio in the decision estimates; ordinary repairs use ratio one.
      expect(decision.estimated_anchor_cost_frames).toBeCloseTo(path! * costRatio, 9);
      expect(decision.estimated_anchor_cost_upper_frames).toBeCloseTo(
        upper * costRatio,
        9,
      );
      expect(repair.allocated_frames).toBe(
        Math.ceil(decision.estimated_anchor_cost_upper_frames),
      );
    }
  }, 180_000);

  test("uses the hard budget as the initial attempt ceiling when policy budget is lower", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const hardBudget = 20_000;
    const result = compileLegacyHandoff(spec, 0, {
      budget: hardBudget,
      policyBudget: 10_000,
      maxNodes: 12,
      polish: false,
      budgetTelemetry: "trace",
    });
    const episode = result.budgetTelemetry?.episodes[0];

    expect(result.stats.sim_frames).toBeGreaterThan(10_000);
    expect(episode?.ceiling_total_spent_frames).toBe(hardBudget);
    expect(episode?.allocated_frames).toBe(hardBudget);
    expect(episode?.end?.episode_remaining_frames).toBe(
      Math.max(0, hardBudget - (episode.end?.total_spent_frames ?? 0)),
    );
    expect(episode?.end?.episode_overrun_frames).toBe(0);
    expect(episode?.ceiling_source).toBe("hard_budget");
  }, 120_000);
});
