import { describe, expect, test } from "vitest";
import {
  DEFAULT_BUDGETS,
  FAST_PROBE_BUDGETS,
  FULL_SEEDS_PER_BUDGET,
  GOLDEN_SEEDS,
  PROBE_SEEDS,
  PROBE_SEEDS_PER_BUDGET,
  GOLDEN_SPECS,
  REPORT_VARIANTS,
  actualSeedForBudgetSlot,
  applyVariant,
  budgetSeedSchedule,
  budgetWeights,
  compilerWorkerTimeoutBudget,
  compilerWorkerTimeoutMs,
  headlineCases,
  loadGoldenSpec,
  variantCases,
} from "../scripts/v0/golden_suite.ts";
import {
  AXES,
  AXIS_VALUE_MAX,
  FRAME_SPAN_AXES,
  SPEED_RULER,
  SPEED_AXIS,
  authoredSpeedToPx,
  hasAnyTargetAxis,
  hasExactlyTargetAxes,
  speedPxToAuthored,
  type Spec,
} from "../scripts/v0/types.ts";

const COMBINED_ELEVATION_AMPLITUDE_SPECS = [
  "canyon_steps",
  "ridge_pulse",
  "valley_bounce",
  "switchback_pop",
  "terrace_sprint",
  "glide_stairs",
  "dense_echo_climb",
  "rolling_drop",
  "skyline_push",
  "syncopated_lift",
] as const;

function expectValidSpec(spec: Spec): void {
  expect(spec.duration).toBeGreaterThan(0);
  let last = -Infinity;
  for (const contact of spec.contacts) {
    expect(contact.t).toBeGreaterThanOrEqual(0);
    expect(contact.t).toBeLessThanOrEqual(spec.duration);
    expect(contact.t).toBeGreaterThanOrEqual(last);
    last = contact.t;
  }
  // Golden specs are authored as axis curves; each present curve must stay in
  // range across the track (air in [0, 0.99], others in [0, 1]).
  expect(spec.axes).toBeDefined();
  const durationFrames = Math.round(spec.duration * 40);
  for (const name of AXES) {
    const curve = spec.axes?.[name];
    if (curve === undefined) continue;
    const hi = AXIS_VALUE_MAX[name];
    for (let f = 0; f <= durationFrames; f++) {
      const v = curve(f / 40);
      if (v === undefined) continue;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(hi);
    }
  }
}

describe("v0 golden configuration", () => {
  test("axis target-set helpers are canonical and exact", () => {
    expect(hasExactlyTargetAxes({}, [])).toBe(true);
    expect(hasExactlyTargetAxes({ air: 0.5 }, ["air"])).toBe(true);
    expect(hasExactlyTargetAxes({ air: 0.5, speed: 0.4 }, ["air"])).toBe(false);
    expect(hasExactlyTargetAxes({ speed: 0.4 }, ["air"])).toBe(false);
    expect(hasAnyTargetAxis({ speed: 0.4 }, ["air"])).toBe(false);
    expect(hasAnyTargetAxis({ air: 0.4, speed: 0.4 }, ["air"])).toBe(true);
  });

  test("frame-span axis category is explicit", () => {
    expect([...FRAME_SPAN_AXES]).toEqual(["air", "speed"]);
    for (const axis of FRAME_SPAN_AXES) {
      expect(AXES).toContain(axis);
    }
  });

  test("authored speed maps to the calibrated raw velocity range", () => {
    expect(SPEED_RULER.MIN_PX_PER_FRAME).toBeCloseTo(5.4, 10);
    expect(SPEED_RULER.MAX_PX_PER_FRAME).toBeCloseTo(12.6, 10);
    expect(SPEED_RULER.RANGE_PX_PER_FRAME).toBeCloseTo(7.2, 10);
    expect(SPEED_AXIS.MIN_PX_PER_FRAME).toBe(SPEED_RULER.MIN_PX_PER_FRAME);
    expect(SPEED_AXIS.MAX_PX_PER_FRAME).toBe(SPEED_RULER.MAX_PX_PER_FRAME);
    expect(SPEED_AXIS.RANGE_PX_PER_FRAME).toBe(SPEED_RULER.RANGE_PX_PER_FRAME);
    expect(authoredSpeedToPx(0)).toBeCloseTo(5.4, 10);
    expect(authoredSpeedToPx(1)).toBeCloseTo(12.6, 10);
    expect(speedPxToAuthored(5.4)).toBeCloseTo(0, 10);
    expect(speedPxToAuthored(12.6)).toBeCloseTo(1, 10);
    expect(speedPxToAuthored(4.68)).toBeCloseTo(-0.1, 10);
    expect(speedPxToAuthored(13.32)).toBeCloseTo(1.1, 10);
  });

  test("headline suite is the hand-authored spec registry", async () => {
    expect([...GOLDEN_SPECS]).toEqual([
      "drums_signature",
      "drums_pendulum",
      "drums_crescendo",
      "dense_sprint",
      "syncopated_switchback",
      "opening_burst",
      "grain_staircase",
      "rhythm_ladder",
      "cold_start",
      "mini_burst",
      "tiny_dance",
      "solo_run",
      "verse_chorus",
      "drums_swell",
      "drums_crosscut",
      "drums_tide",
      "drums_dropout",
      "drums_breath",
      "drums_pulse",
      "drums_zigzag",
      "climb_terrace",
      "swoop_dive",
      "rolling_hills",
      "summit_push",
      "mixed_grade",
      "big_air_ramp",
      "pop_train",
      "soar_settle",
      "leap_cadence",
      "float_bounds",
      "canyon_steps",
      "ridge_pulse",
      "valley_bounce",
      "switchback_pop",
      "terrace_sprint",
      "glide_stairs",
      "dense_echo_climb",
      "rolling_drop",
      "skyline_push",
      "syncopated_lift",
    ]);
    expect(headlineCases()).toHaveLength(GOLDEN_SPECS.length);

    for (const name of GOLDEN_SPECS) {
      expectValidSpec(await loadGoldenSpec(name, "base"));
    }
  });

  test("report variants are configured separately from headline specs", () => {
    expect([...REPORT_VARIANTS]).toEqual(["contact_phase_plus_25ms", "time_stretch_102"]);
    expect(variantCases()).toHaveLength(GOLDEN_SPECS.length * REPORT_VARIANTS.length);
    for (const testCase of variantCases()) {
      expect(testCase.variant).not.toBe("base");
    }
  });

  test("combined elevation/amplitude specs target active four-axis pressure", async () => {
    for (const name of COMBINED_ELEVATION_AMPLITUDE_SPECS) {
      const spec = await loadGoldenSpec(name, "base");
      expect(spec.jitter).toBe(0.05);
      expect(spec.axes.air).toBeDefined();
      expect(spec.axes.speed).toBeDefined();
      expect(spec.axes.elevation).toBeDefined();
      expect(spec.axes.amplitude).toBeDefined();
      expect(spec.axes.grain).toBeUndefined();
    }
  });

  test("canonical and probe budget grids are fixed", () => {
    expect([...DEFAULT_BUDGETS]).toEqual([75_000, 150_000, 225_000, 350_000, 475_000, 550_000]);
    expect([...FAST_PROBE_BUDGETS]).toEqual([75_000, 200_000, 500_000]);
  });

  test("budget weights are value-proportional, keyed by budget, sum to 1, increasing", () => {
    const w = budgetWeights(DEFAULT_BUDGETS);
    expect(w.map((x) => x.budget)).toEqual([...DEFAULT_BUDGETS]);
    const sum = DEFAULT_BUDGETS.reduce((s, b) => s + b, 0);
    for (const { budget, weight } of w) expect(weight).toBeCloseTo(budget / sum, 9);
    expect(w.reduce((s, x) => s + x.weight, 0)).toBeCloseTo(1, 9);
    for (let i = 1; i < w.length; i++) expect(w[i].weight).toBeGreaterThan(w[i - 1].weight);
  });

  test("golden and probe seed slots are contiguous", () => {
    expect([...GOLDEN_SEEDS]).toEqual([
      0, 1, 2, 3, 4, 5,
      6, 7, 8, 9, 10, 11,
    ]);
    expect(FULL_SEEDS_PER_BUDGET).toBe(12);
    expect([...PROBE_SEEDS]).toEqual([0, 1, 2, 3, 4, 5]);
    expect(PROBE_SEEDS_PER_BUDGET).toBe(6);
  });

  test("budget seed policy uses disjoint contiguous actual seeds per budget", () => {
    const full = budgetSeedSchedule(DEFAULT_BUDGETS, 0, FULL_SEEDS_PER_BUDGET);
    expect(full.seed_slots).toEqual([...GOLDEN_SEEDS]);
    expect(full.budget_seeds).toEqual([
      { budget: 75_000, seeds: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
      { budget: 150_000, seeds: [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23] },
      { budget: 225_000, seeds: [24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35] },
      { budget: 350_000, seeds: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47] },
      { budget: 475_000, seeds: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59] },
      { budget: 550_000, seeds: [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71] },
    ]);
    const probe = budgetSeedSchedule(FAST_PROBE_BUDGETS, 0, PROBE_SEEDS_PER_BUDGET);
    expect(probe.budget_seeds).toEqual([
      { budget: 75_000, seeds: [0, 1, 2, 3, 4, 5] },
      { budget: 200_000, seeds: [6, 7, 8, 9, 10, 11] },
      { budget: 500_000, seeds: [12, 13, 14, 15, 16, 17] },
    ]);
    expect(actualSeedForBudgetSlot(42, 1, 1)).toBe(43);
  });

  test("worker timeout budget is the SUM of the independent per-budget runs", () => {
    // Each budget is now an independent full run, so one worker's work for a
    // (spec, seed slot) is the SUM of the grid's budgets, not the max of one shared run.
    const sum = DEFAULT_BUDGETS.reduce((s, b) => s + b, 0); // 1_825_000
    expect(compilerWorkerTimeoutBudget(DEFAULT_BUDGETS)).toBe(sum);
    expect(compilerWorkerTimeoutBudget([50_000])).toBe(50_000);
    // more budgets -> at-least-as-large a timeout
    expect(compilerWorkerTimeoutMs(compilerWorkerTimeoutBudget([50_000]))).toBeLessThanOrEqual(
      compilerWorkerTimeoutMs(compilerWorkerTimeoutBudget(DEFAULT_BUDGETS)),
    );
  });

  test("deterministic variants preserve valid spec timelines", async () => {
    for (const name of GOLDEN_SPECS) {
      const base = await loadGoldenSpec(name, "base");
      for (const variant of REPORT_VARIANTS) {
        const spec = applyVariant(base, variant);
        expectValidSpec(spec);
      }
    }
  });
});
