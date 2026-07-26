import { describe, expect, test, vi } from "vitest";
import {
  enumerateObjectiveControlConfigurations,
  isObjectiveControlSourceDefault,
  objectiveControlEnvironment,
  OBJECTIVE_CONTROL_DEFAULT,
} from "../scripts/v0/optimizer/objective_control.ts";

describe("objective control configurations", () => {
  test("the source default maps to an empty environment", () => {
    // The baseline arm of a matrix must BE the production compiler, not a
    // re-encoding of it, or the sweep measures its own env plumbing.
    expect(isObjectiveControlSourceDefault(OBJECTIVE_CONTROL_DEFAULT)).toBe(true);
    expect(objectiveControlEnvironment(OBJECTIVE_CONTROL_DEFAULT)).toEqual({});
  });

  test("enumeration is the direct product with stable distinct ids", () => {
    const configurations = enumerateObjectiveControlConfigurations({
      settledPowers: [1],
      futurePowers: [1, 1.5, 2],
      readinessPowers: [0.5, 0.75, 1],
    });
    expect(configurations).toHaveLength(9);
    expect(new Set(configurations.map((c) => c.id)).size).toBe(9);
    expect(configurations[0].id).toBe("settled1--future1--readiness0.5");
  });

  test("'follow' and a pinned 1 are different cells", () => {
    // Unset means readiness tracks the future exponent, which is NOT the same
    // compiler as readiness pinned to 1 whenever the future exponent moves.
    const [follow, pinned] = enumerateObjectiveControlConfigurations({
      futurePowers: [1.5],
      readinessPowers: [null, 1],
    });
    expect(follow.id).not.toBe(pinned.id);
    expect(objectiveControlEnvironment(follow))
      .not.toHaveProperty("LR_OBJECTIVE_READINESS_POWER");
    expect(objectiveControlEnvironment(pinned).LR_OBJECTIVE_READINESS_POWER)
      .toBe("1");
  });

  test("an exponent outside the compiler's clamp is rejected, not clamped", () => {
    // Silently clamping would let two distinct ids name the same compiler and
    // report a spurious zero delta between them.
    expect(() =>
      enumerateObjectiveControlConfigurations({ futurePowers: [8] })
    ).toThrow(/outside the compiler's clamp/);
    expect(() =>
      enumerateObjectiveControlConfigurations({ readinessPowers: [0.1] })
    ).toThrow(/outside the compiler's clamp/);
    expect(() =>
      enumerateObjectiveControlConfigurations({ settledPowers: [0] })
    ).toThrow(/invalid settled exponent/);
  });

  test("the emitted environment actually drives the compiler's exponents", async () => {
    // The whole point of the scaffolding is that a matrix cell parametrizes the
    // REAL objective rather than a study-local copy. This asserts the variable
    // names line up end to end, which a rename would otherwise break silently.
    const configuration = enumerateObjectiveControlConfigurations({
      settledPowers: [2],
      futurePowers: [1.5],
      readinessPowers: [0.5],
    })[0];
    const environment = objectiveControlEnvironment(configuration);
    const saved = { ...process.env };
    try {
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("LR_OBJECTIVE_")) delete process.env[key];
      }
      Object.assign(process.env, environment);
      vi.resetModules();
      const objective = await import("../scripts/v0/optimizer/objective.ts");
      objective.setProposalUtilityPowers();
      const value = objective.proposalUtility(0.5, 0.5, { readiness: 0.5 });
      expect(value).toBeCloseTo(0.5 ** 2 * 0.5 ** 1.5 * 0.5 ** 0.5, 12);
    } finally {
      for (const key of Object.keys(process.env)) {
        if (key.startsWith("LR_OBJECTIVE_")) delete process.env[key];
      }
      Object.assign(process.env, saved);
      vi.resetModules();
    }
  });
});
