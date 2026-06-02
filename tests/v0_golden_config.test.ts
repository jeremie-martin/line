import { describe, expect, test } from "vitest";
import {
  DEFAULT_BUDGETS,
  GOLDEN_SPECS,
  REPORT_VARIANTS,
  applyVariant,
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
  hasExactlyTargetAxes,
  type Spec,
} from "../scripts/v0/types.ts";

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
  });

  test("frame-span axis category is explicit", () => {
    expect([...FRAME_SPAN_AXES]).toEqual(["air", "speed"]);
    for (const axis of FRAME_SPAN_AXES) {
      expect(AXES).toContain(axis);
    }
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

  test("default budget curve is the campaign grid", () => {
    expect([...DEFAULT_BUDGETS]).toEqual([
      35_000,
      40_000,
      45_000,
      50_000,
      55_000,
      60_000,
      65_000,
      70_000,
      75_000,
    ]);
  });

  test("checkpoint verification timeout accounts for standalone checkpoint compiles", () => {
    expect(compilerWorkerTimeoutBudget(DEFAULT_BUDGETS, false)).toBe(75_000);
    expect(compilerWorkerTimeoutBudget(DEFAULT_BUDGETS, true)).toBe(570_000);

    const normalTimeout = compilerWorkerTimeoutMs(
      compilerWorkerTimeoutBudget(DEFAULT_BUDGETS, false),
    );
    const verifyingTimeout = compilerWorkerTimeoutMs(
      compilerWorkerTimeoutBudget(DEFAULT_BUDGETS, true),
    );
    expect(verifyingTimeout).toBeGreaterThan(normalTimeout);
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
