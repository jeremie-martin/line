import { describe, expect, test } from "vitest";
import {
  GOLDEN_SPECS,
  REPORT_VARIANTS,
  applyVariant,
  headlineCases,
  loadGoldenSpec,
  variantCases,
} from "../scripts/v0/golden_suite.ts";
import { AXES, type Spec } from "../scripts/v0/types.ts";

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
    const hi = name === "air" ? 0.99 : 1;
    for (let f = 0; f <= durationFrames; f++) {
      const v = curve(f / 40);
      if (v === undefined) continue;
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(hi);
    }
  }
}

describe("v0 golden configuration", () => {
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
      "drums_winddown",
      "drums_dropout",
      "drums_accelerando",
      "drums_breath",
      "drums_pulse",
      "drums_archway",
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
