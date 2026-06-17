import { describe, expect, test } from "vitest";
import { constant, keyframes, ramp, type Ease } from "../scripts/v0/core/curves.ts";

describe("constant", () => {
  test("returns the same value everywhere", () => {
    const c = constant(0.42);
    for (const t of [-10, 0, 1.7, 100]) expect(c(t)).toBe(0.42);
  });
});

describe("keyframes — hold ease reproduces step-function sections", () => {
  // Mirrors a 3-section spec: [0,10)=0.45, [10,20)=0.60, [20,..]=0.60-ish.
  const c = keyframes(
    [
      { t: 0, v: 0.45 },
      { t: 10, v: 0.6 },
      { t: 20, v: 0.25 },
    ],
    "hold",
  );

  test("steps at each boundary, last-value semantics", () => {
    expect(c(0)).toBe(0.45);
    expect(c(5)).toBe(0.45);
    expect(c(9.999)).toBe(0.45);
    // At/after a boundary the next keyframe's value takes over (matches the old
    // "last-declared section wins" at a shared t0==t1 boundary).
    expect(c(10)).toBe(0.6);
    expect(c(15)).toBe(0.6);
    expect(c(20)).toBe(0.25);
    expect(c(25)).toBe(0.25);
  });

  test("clamps before first and after last point", () => {
    expect(c(-5)).toBe(0.45);
    expect(c(1e6)).toBe(0.25);
  });
});

describe("ramp / linear interpolation", () => {
  test("hits both endpoints exactly and the midpoint linearly", () => {
    const r = ramp(0, 0, 10, 1); // default linear
    expect(r(0)).toBeCloseTo(0, 12);
    expect(r(10)).toBeCloseTo(1, 12);
    expect(r(5)).toBeCloseTo(0.5, 12);
    expect(r(2.5)).toBeCloseTo(0.25, 12);
  });

  test("clamps outside [t0, t1]", () => {
    const r = ramp(2, 0.3, 8, 0.9);
    expect(r(0)).toBe(0.3);
    expect(r(100)).toBe(0.9);
  });
});

describe("eases — endpoints exact, values bounded and monotonic", () => {
  const eases: Exclude<Ease, "hold">[] = ["linear", "smooth", "easeIn", "easeOut"];

  for (const ease of eases) {
    test(`${ease}: f(t0)=v0, f(t1)=v1, monotone non-decreasing, within [v0,v1]`, () => {
      const r = ramp(0, 0, 1, 1, ease);
      expect(r(0)).toBeCloseTo(0, 12);
      expect(r(1)).toBeCloseTo(1, 12);
      let prev = -Infinity;
      for (let i = 0; i <= 20; i++) {
        const u = i / 20;
        const y = r(u)!;
        expect(y).toBeGreaterThanOrEqual(-1e-9);
        expect(y).toBeLessThanOrEqual(1 + 1e-9);
        expect(y).toBeGreaterThanOrEqual(prev - 1e-9);
        prev = y;
      }
    });
  }

  test("smooth is symmetric about the midpoint (smoothstep)", () => {
    const r = ramp(0, 0, 1, 1, "smooth");
    expect(r(0.5)).toBeCloseTo(0.5, 12);
    // smoothstep(u) + smoothstep(1-u) == 1
    for (const u of [0.1, 0.25, 0.4]) {
      expect(r(u)! + r(1 - u)!).toBeCloseTo(1, 12);
    }
  });

  test("easeIn lags linear early; easeOut leads it", () => {
    const lin = ramp(0, 0, 1, 1, "linear");
    const ein = ramp(0, 0, 1, 1, "easeIn");
    const eout = ramp(0, 0, 1, 1, "easeOut");
    expect(ein(0.5)!).toBeLessThan(lin(0.5)!);
    expect(eout(0.5)!).toBeGreaterThan(lin(0.5)!);
  });
});

describe("keyframes — mixed eases per segment, unsorted input", () => {
  test("sorts points and applies per-point ease to its own segment", () => {
    const c = keyframes([
      { t: 10, v: 1, ease: "hold" },
      { t: 0, v: 0, ease: "linear" },
      { t: 20, v: 0 },
    ]);
    // [0,10] linear: midpoint 0.5
    expect(c(5)).toBeCloseTo(0.5, 12);
    // [10,20] hold: stays at 1 until 20
    expect(c(15)).toBe(1);
    expect(c(20)).toBe(0);
  });

  test("preserves source indices in sorted metadata", () => {
    const c = keyframes([
      { t: 10, v: 1 },
      { t: 0, v: 0 },
      { t: 20, v: 0 },
    ]);

    expect(c.meta?.points.map((point) => point.sourceIndex)).toEqual([1, 0, 2]);
  });

  test("throws on empty point list", () => {
    expect(() => keyframes([])).toThrow();
  });
});
