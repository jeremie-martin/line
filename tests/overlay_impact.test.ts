import { describe, expect, test } from "vitest";
import {
  impactStrength,
  traumaAt,
  type ImpactContact,
} from "../remotion/src/impact.ts";

describe("production overlay impact contract", () => {
  test("drives effects only from the current measured field", () => {
    expect(impactStrength({ t: 1, impactMeasured: 0.6 })).toBe(0.6);
    expect(impactStrength({
      t: 1,
      impactMeasured: null,
      impactRedir: 1,
      impact: 1,
    } as ImpactContact & { impactRedir: number; impact: number })).toBe(0);
  });

  test("applies the current value to the trauma gate and decay", () => {
    const contacts: ImpactContact[] = [
      { t: 1, impactMeasured: 0.5 },
      { t: 2, impactMeasured: 0.1 },
    ];
    expect(traumaAt(1, contacts, {
      decayPerSec: 2,
      gain: 1,
      minImpact: 0.2,
      power: 1,
    })).toBeCloseTo(0.5, 12);
    expect(traumaAt(2, contacts, {
      decayPerSec: 2,
      gain: 1,
      minImpact: 0.2,
      power: 1,
    })).toBeCloseTo(0.5 * Math.exp(-2), 12);
  });
});
