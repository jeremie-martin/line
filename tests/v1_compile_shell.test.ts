import { createHash } from "node:crypto";
import { describe, expect, test } from "vitest";
import { compile, defaultBudgetFor } from "../scripts/v1/compile.ts";
import { normalizeSpec } from "../scripts/v1/normalize.ts";
import type { Spec } from "../scripts/v1/types.ts";

function hash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

const TRIVIAL: Spec = {
  duration: 1,
  contacts: [],
  sections: [],
};

const CONTACT_SPEC: Spec = {
  duration: 2,
  contacts: [{ t: 1 }],
  sections: [{ t0: 0, t1: 2, air: 0.6, speed: 0.4 }],
};

describe("v1 compile shell", () => {
  test("returns a deterministic fallback track and report", () => {
    const a = compile(CONTACT_SPEC, { seed: 7, budget: { kind: "work", units: 0 } });
    const b = compile(CONTACT_SPEC, { seed: 7, budget: { kind: "work", units: 0 } });

    expect(hash(a.track)).toBe(hash(b.track));
    expect(hash(a.report)).toBe(hash(b.report));
    expect(a.stats.no_contract_candidate_found).toBe(true);
    expect(a.track.label).toBe("v1-fallback");
    expect(a.track.creator).toBe("line/v1");
    expect(a.track.duration).toBe(Math.round(CONTACT_SPEC.duration * 40) + 20);
  });

  test("compatibility overload maps compile(spec, seed) to default work budget", () => {
    const seed = 3;
    const defaultBudget = defaultBudgetFor(TRIVIAL);
    const a = compile(TRIVIAL, seed);
    const b = compile(TRIVIAL, { seed, budget: defaultBudget });

    expect(hash(a.track)).toBe(hash(b.track));
    expect(hash(a.report)).toBe(hash(b.report));
    expect(defaultBudget.kind).toBe("work");
    expect(a.stats.work_units_requested).toBe(defaultBudget.kind === "work" ? defaultBudget.units : null);
  });

  test("manual start is reflected in TrackJson", () => {
    const spec: Spec = { ...TRIVIAL, start: { vx: 5, vy: -2, x: 3, y: -1 } };
    const { track } = compile(spec, { seed: 0, budget: { kind: "work", units: 0 } });

    expect(track.riders[0].startPosition).toEqual({ x: 3, y: -1 });
    expect(track.riders[0].startVelocity).toEqual({ x: 5, y: -2 });
  });

  test("normalization computes stable contact frames and gaps", () => {
    const context = normalizeSpec(CONTACT_SPEC, 11);

    expect(context.contactFrames).toEqual([40]);
    expect(context.gaps.map((gap) => [gap.startFrame, gap.endFrame, gap.endsWithContact]))
      .toEqual([[0, 40, true], [40, 80, false]]);
    expect(normalizeSpec(CONTACT_SPEC, 11).specHash).toBe(context.specHash);
  });

  test("validation rejects invalid starts and preroll", () => {
    expect(() => compile({ ...TRIVIAL, start: { vx: 9999, vy: 0 } }, 0))
      .toThrow(/sanity cap/);
    expect(() => compile({ ...TRIVIAL, start: { vx: Number.NaN, vy: 0 } }, 0))
      .toThrow(/finite/);
    expect(() => compile({ ...TRIVIAL, preroll: -1 }, 0))
      .toThrow(/must be ≥0/);
  });

  test("high-pressure preroll resolves to a deterministic non-default start", () => {
    const spec: Spec = {
      duration: 2,
      contacts: [{ t: 0.5 }, { t: 0.75 }],
      sections: [{ t0: 0, t1: 2, air: 0.82, speed: 0.94 }],
      preroll: 5,
    };
    const context = normalizeSpec(spec, 0);

    expect(context.startState.velocity.x).toBeGreaterThan(8);
    expect(context.startState.velocity.y).toBeGreaterThan(1);
    expect(normalizeSpec(spec, 0).startState).toEqual(context.startState);
  });

  test("high-air grippy preroll uses an upward switchback start", () => {
    const spec: Spec = {
      duration: 2,
      contacts: [{ t: 0.75 }, { t: 1.1 }],
      sections: [{ t0: 0, t1: 2, air: 0.75, speed: 0.82, contact_style: 0.7 }],
      preroll: 5,
    };
    const context = normalizeSpec(spec, 0);

    expect(context.startState.velocity.x).toBeCloseTo(8.468, 3);
    expect(context.startState.velocity.y).toBeCloseTo(-0.741, 3);
  });

});
