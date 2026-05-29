import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { compile } from "../scripts/v1/compile.ts";
import type { CompileResult, Spec } from "../scripts/v1/types.ts";

const ONE_CONTACT: Spec = {
  duration: 1.5,
  contacts: [{ t: 1 }],
  sections: [{ t0: 0, t1: 1.5, air: 0.7 }],
};

const DENSE_OPENING: Spec = {
  duration: 2.5,
  contacts: [{ t: 0.5 }, { t: 0.75 }, { t: 1 }],
  sections: [{ t0: 0, t1: 2.5, air: 0.82, speed: 0.9, grain: 0.6, contact_style: 0.3 }],
  preroll: 5,
};

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function canonical(result: CompileResult): object {
  return {
    track: result.track,
    report: result.report,
    stats: result.stats,
  };
}

describe("v1 compile determinism", () => {
  test("same spec, seed, and work budget returns byte-identical output", () => {
    const cases: Array<{ spec: Spec; seed: number; units: number }> = [
      { spec: ONE_CONTACT, seed: 0, units: 8_000 },
      { spec: ONE_CONTACT, seed: 2, units: 8_000 },
      { spec: DENSE_OPENING, seed: 0, units: 30_000 },
    ];

    for (const testCase of cases) {
      const a = compile(testCase.spec, {
        seed: testCase.seed,
        budget: { kind: "work", units: testCase.units },
      });
      const b = compile(testCase.spec, {
        seed: testCase.seed,
        budget: { kind: "work", units: testCase.units },
      });

      expect(hash(canonical(a))).toBe(hash(canonical(b)));
    }
  });
});
