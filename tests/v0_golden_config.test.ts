import { describe, expect, test } from "vitest";
import {
  GOLDEN_SPECS,
  REPORT_VARIANTS,
  applyVariant,
  budgetFor,
  headlineCases,
  loadGoldenSpec,
  variantCases,
} from "../scripts/v0/golden_suite.ts";
import type { Spec } from "../scripts/v0/types.ts";

function expectValidSpec(spec: Spec): void {
  expect(spec.duration).toBeGreaterThan(0);
  let last = -Infinity;
  for (const contact of spec.contacts) {
    expect(contact.t).toBeGreaterThanOrEqual(0);
    expect(contact.t).toBeLessThanOrEqual(spec.duration);
    expect(contact.t).toBeGreaterThanOrEqual(last);
    last = contact.t;
  }
  for (const section of spec.sections) {
    expect(section.t0).toBeGreaterThanOrEqual(0);
    expect(section.t1).toBeLessThanOrEqual(spec.duration);
    expect(section.t1).toBeGreaterThan(section.t0);
  }
}

describe("v0 golden configuration", () => {
  test("headline suite has eight hand-authored specs", async () => {
    expect(GOLDEN_SPECS).toHaveLength(8);
    expect([...GOLDEN_SPECS]).toEqual([
      "drums_signature",
      "drums_pendulum",
      "drums_crescendo",
      "dense_sprint",
      "syncopated_switchback",
      "opening_burst",
      "grain_staircase",
      "rhythm_ladder",
    ]);
    expect(headlineCases()).toHaveLength(8);

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

  test("work budgets are deterministic and scale with spec size", () => {
    const small: Spec = { duration: 1, contacts: [], sections: [] };
    const large: Spec = { duration: 2, contacts: [{ t: 1 }], sections: [] };

    expect(budgetFor(small)).toEqual(budgetFor(small));
    expect(budgetFor(small).kind).toBe("work");
    expect(budgetFor(large).units).toBeGreaterThan(budgetFor(small).units);
  });
});
