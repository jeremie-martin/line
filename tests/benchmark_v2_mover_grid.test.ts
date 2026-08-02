import { describe, expect, test } from "vitest";
import {
  CANONICAL_SOURCE_MANIFEST,
  CANONICAL_SUITE_MANIFEST,
  DEFAULT_SOURCE_SUBSET,
  deriveMiniManifests,
  loadCanonicalManifests,
  resolveSourceSubset,
  serializeManifest,
  verifyMiniManifestIdentity,
} from "../scripts/benchmark/mini_manifest.ts";
import {
  actionSetPower,
  binomialAtMost,
  binomialUpperBound,
  breakEvenRate,
  formatActionSetPower,
  requiredChangedCells,
  zeroEventProbability,
} from "../scripts/benchmark/action_set_power.ts";
import { resolveSources } from "../scripts/v0/benchmark_v2/model.ts";
import { scoreV2Report } from "../scripts/v0/benchmark_v2/evaluator.ts";

const canonical = loadCanonicalManifests(CANONICAL_SOURCE_MANIFEST, CANONICAL_SUITE_MANIFEST);

function derive(selector: string) {
  const ids = resolveSourceSubset(selector, canonical.resolved, canonical.suite);
  return deriveMiniManifests(canonical.sources, canonical.suite, ids);
}

describe("mini manifest derivation", () => {
  test("the default subset is the capability stratum plus one control per other stratum", () => {
    const mini = derive(DEFAULT_SOURCE_SUBSET);
    const capability = canonical.suite.strata.find((stratum) => stratum.id === "capability")!;
    const capabilityMembers = capability.groups.flatMap((group) => group.members);
    expect(mini.keptIds).toEqual(expect.arrayContaining(capabilityMembers));
    expect(mini.controlIds).toHaveLength(3);
    expect(mini.keptIds).toHaveLength(capabilityMembers.length + 3);
    // Every capability group survives whole, so its score stays canonical.
    expect(mini.groups.filter((group) => group.stratum === "capability").every((group) => group.complete))
      .toBe(true);
  });

  test("the p1b-collapse preset reproduces the collapse investigation's 7 sources", () => {
    expect(derive("p1b-collapse").keptIds.sort()).toEqual([
      "believer_56_6s",
      "frontier_dense_recovery",
      "frontier_dense_recovery_240ms_figures",
      "frontier_pickup_progression",
      "frontier_pickup_progression_shifted",
      "regression_transition_mosaic",
      "river_reentry",
    ]);
  });

  test("selectors compose and are order-insensitive and deduplicating", () => {
    const a = derive("group:low_air_frontier,frontier_dense_recovery");
    const b = derive("frontier_dense_recovery,group:low_air_frontier,group:low_air_frontier");
    expect(a.keptIds).toEqual(b.keptIds);
    expect(a.keptIds).toContain("frontier_low_air_endurance_7s");
  });

  test("an unknown selector term fails loudly rather than silently narrowing the grid", () => {
    expect(() => derive("frontier_not_a_source")).toThrow(/unknown source/);
    expect(() => derive("group:nope")).toThrow(/unknown group/);
    expect(() => derive("stratum:nope")).toThrow(/unknown stratum/);
  });

  test("derivation is deterministic and byte-stable", () => {
    const first = derive(DEFAULT_SOURCE_SUBSET);
    const second = derive(DEFAULT_SOURCE_SUBSET);
    expect(serializeManifest(first.sourceManifest)).toBe(serializeManifest(second.sourceManifest));
    expect(serializeManifest(first.suiteManifest)).toBe(serializeManifest(second.suiteManifest));
  });
});

describe("compile identity", () => {
  // The property that makes a mini grid evidence: a kept cell compiles and
  // scores exactly as it would under the canonical manifests.
  for (const selector of ["capability", "p1b-collapse", "group:low_air_frontier", "all"]) {
    test(`--sources=${selector} preserves compile identity`, () => {
      const mini = derive(selector);
      const identity = verifyMiniManifestIdentity(canonical.sources, canonical.suite, mini);
      expect(identity.checks.filter((check) => !check.ok)).toEqual([]);
      expect(identity.ok).toBe(true);
    });
  }

  test("kept sources resolve to byte-identical compiler inputs", () => {
    const mini = derive(DEFAULT_SOURCE_SUBSET);
    const full = new Map(canonical.resolved.map((source) => [source.id, source]));
    for (const source of resolveSources(mini.sourceManifest)) {
      expect(source).toEqual(full.get(source.id));
    }
  });

  test("the scorer's entire suite dependency is carried across unchanged", () => {
    // scoreV2Report is typed to read exactly these two fields, so equality here
    // is equality of every scored quantity, not a sample of them.
    const mini = derive(DEFAULT_SOURCE_SUBSET);
    const dependency: Parameters<typeof scoreV2Report>[3] = {
      component_weights: mini.suiteManifest.component_weights,
      axis_quality_tolerance: mini.suiteManifest.axis_quality_tolerance,
    };
    expect(dependency).toEqual({
      component_weights: canonical.suite.component_weights,
      axis_quality_tolerance: canonical.suite.axis_quality_tolerance,
    });
    expect(mini.suiteManifest.transform).toEqual(canonical.suite.transform);
  });

  test("the derived manifests cannot masquerade as canonical evidence", () => {
    const mini = derive(DEFAULT_SOURCE_SUBSET);
    expect(mini.suiteManifest.description).not.toBe(canonical.suite.description);
    expect(mini.sourceManifest.description).not.toBe(canonical.sources.description);
    expect(serializeManifest(mini.suiteManifest)).toContain("NOT the suite headline");
  });

  test("group weights renormalize inside the stratum, stratum weights do not move", () => {
    const mini = derive("p1b-collapse");
    for (const stratum of mini.suiteManifest.strata) {
      const total = stratum.groups.reduce((sum, group) => sum + group.weight, 0);
      expect(total).toBeCloseTo(1, 12);
      const original = canonical.suite.strata.find((entry) => entry.id === stratum.id)!;
      expect(stratum.weight).toBe(original.weight);
    }
    const pickup = mini.groups.find((group) => group.id === "rapid_pickup_frontier")!;
    // 0.40 of a surviving 0.40 + 0.35.
    expect(pickup.weight).toBeCloseTo(0.4 / 0.75, 12);
  });

  test("a kept group's parents keep a surviving base case first", () => {
    const mini = derive("frontier_pickup_progression_shifted");
    const group = mini.suiteManifest.strata
      .flatMap((stratum) => stratum.groups)
      .find((entry) => entry.id === "rapid_pickup_frontier")!;
    expect(group.members).toEqual(["frontier_pickup_progression_shifted"]);
    expect(group.parents).toEqual([{
      id: "frontier_pickup_progression_shifted",
      members: ["frontier_pickup_progression_shifted"],
    }]);
  });
});

describe("action-set power", () => {
  test("the rule of three and the exact bound agree on the 1b preview", () => {
    // 14 changed cells, zero collapses: exact 1 - 0.05^(1/14).
    expect(binomialUpperBound(14, 0)).toBeCloseTo(1 - Math.pow(0.05, 1 / 14), 12);
    expect(binomialUpperBound(14, 0)).toBeCloseTo(0.1926, 4);
    expect(3 / 14).toBeCloseTo(0.2143, 4);
  });

  test("P(zero collapses) reproduces the measured 1b coin flip", () => {
    // The eval measured 4 collapses over 90 changed cells.
    expect(zeroEventProbability(14, 4 / 90)).toBeCloseTo(0.53, 2);
  });

  test("break-even is value per changed cell over event cost, independent of this observation", () => {
    // +13 headline points over ~88 changed cells against ~50 points per lost
    // completion => the ~0.3% the campaign recorded.
    const priced = breakEvenRate({ value: 13, eventCost: 50, valueCells: 88 }, 14);
    expect(priced.rate).toBeCloseTo(0.003, 3);
    expect(breakEvenRate({ value: 13, eventCost: 50, valueCells: 88 }, 900).rate).toBe(priced.rate);
    expect(priced.requiredChangedCells).toBeGreaterThan(900);
  });

  test("the 1b preview is reported as underpowered, and the eval as refuted", () => {
    const preview = actionSetPower({
      changedCells: 14,
      adverseEvents: 0,
      totalCells: 352,
      breakEven: { value: 13, eventCost: 50, valueCells: 88 },
    });
    expect(preview.breakEven!.powered).toBe(false);
    expect(preview.breakEven!.refuted).toBe(false);
    expect(formatActionSetPower(preview, "lost completion")).toContain("UNDERPOWERED");

    const evaluation = actionSetPower({
      changedCells: 90,
      adverseEvents: 4,
      totalCells: 336,
      breakEven: { value: 13, eventCost: 50, valueCells: 88 },
    });
    expect(evaluation.observedRate).toBeCloseTo(4 / 90, 12);
    expect(evaluation.breakEven!.refuted).toBe(true);
    expect(formatActionSetPower(evaluation, "lost completion")).toContain("REFUTED");
  });

  test("an empty action set tests nothing and says so", () => {
    const power = actionSetPower({ changedCells: 0, adverseEvents: 0, totalCells: 336 });
    expect(power.exclusionBound).toBeNull();
    expect(formatActionSetPower(power)).toContain("changed nothing");
  });

  test("a large enough clean action set becomes powered", () => {
    const power = actionSetPower({
      changedCells: 2000,
      adverseEvents: 0,
      breakEven: { value: 13, eventCost: 50, valueCells: 88 },
    });
    expect(power.breakEven!.powered).toBe(true);
    expect(formatActionSetPower(power)).toContain("POWERED");
  });

  test("the exact bound inverts the binomial CDF at the confidence level", () => {
    for (const [n, k] of [[14, 0], [90, 4], [79, 0], [30, 2], [200, 11]] as const) {
      const bound = binomialUpperBound(n, k);
      expect(binomialAtMost(k, n, bound)).toBeCloseTo(0.05, 8);
      expect(bound).toBeGreaterThanOrEqual(k / n);
    }
  });

  test("required action-set size inverts the zero-event probability", () => {
    for (const rate of [0.003, 0.01, 0.044, 0.2]) {
      const n = requiredChangedCells(rate);
      expect(zeroEventProbability(n, rate)).toBeLessThanOrEqual(0.05);
      expect(zeroEventProbability(n - 1, rate)).toBeGreaterThan(0.05);
    }
  });

  test("degenerate inputs are rejected rather than silently priced", () => {
    expect(() => binomialUpperBound(10, 11)).toThrow();
    expect(() => binomialUpperBound(-1, 0)).toThrow();
    expect(() => breakEvenRate({ value: 1, eventCost: 0 }, 10)).toThrow();
    expect(() => breakEvenRate({ value: 0, eventCost: 1 }, 10)).toThrow();
    expect(() => requiredChangedCells(0)).toThrow();
  });
});
