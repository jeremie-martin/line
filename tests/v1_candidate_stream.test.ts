import { describe, expect, test } from "vitest";
import {
  candidateForOrdinal,
  firstNCandidates,
  stateAwareCandidateForOrdinal,
} from "../scripts/v1/candidate_stream.ts";
import { normalizeSpec } from "../scripts/v1/normalize.ts";
import type { Spec } from "../scripts/v1/types.ts";

const SPEC: Spec = {
  duration: 4,
  contacts: [{ t: 0.75 }, { t: 1.5 }, { t: 3 }],
  defaults: { air: 0.5, speed: 0.4 },
  sections: [
    { t0: 0, t1: 2, air: 0.7, grain: 0.2 },
    { t0: 2, t1: 4, speed: 0.8, contact_style: 0.4 },
  ],
};

describe("v1 deterministic candidate streams", () => {
  test("requesting more candidates preserves the earlier prefix", () => {
    const context = normalizeSpec(SPEC, 2);
    const first48 = firstNCandidates(context, 0, "root", "coverage", 48);
    const first96 = firstNCandidates(context, 0, "root", "coverage", 96);

    expect(first96.slice(0, 48)).toEqual(first48);
  });

  test("candidate ordinal is independent of revisit order", () => {
    const context = normalizeSpec(SPEC, 5);
    const late = candidateForOrdinal(context, 1, "prefix-a", "quality", 17);
    candidateForOrdinal(context, 1, "prefix-a", "quality", 0);
    const lateAgain = candidateForOrdinal(context, 1, "prefix-a", "quality", 17);

    expect(lateAgain).toEqual(late);
  });

  test("prefix hash participates in the candidate key and geometry", () => {
    const context = normalizeSpec(SPEC, 5);
    const a = candidateForOrdinal(context, 1, "prefix-a", "quality", 17);
    const b = candidateForOrdinal(context, 1, "prefix-b", "quality", 17);

    expect(a.key).not.toEqual(b.key);
    expect(a.geometryHash).not.toBe(b.geometryHash);
  });

  test("state-aware coverage candidates are counter-based and prefix-addressed", () => {
    const context = normalizeSpec(SPEC, 5);
    const gap = context.gaps[0];
    const baseInput = {
      context,
      gap,
      stream: "coverage" as const,
      ordinal: 1200,
      refX: 100,
      refY: 20,
      targets: gap.targets,
      targetState: {
        sledX: 100,
        sledY: 20,
        velocity: { x: 1, y: 0 },
        speed: 1,
        angleDeg: 0,
      },
    };

    const late = stateAwareCandidateForOrdinal({ ...baseInput, prefixHash: "prefix-a" });
    stateAwareCandidateForOrdinal({ ...baseInput, prefixHash: "prefix-a", ordinal: 0 });
    const lateAgain = stateAwareCandidateForOrdinal({ ...baseInput, prefixHash: "prefix-a" });
    const otherPrefix = stateAwareCandidateForOrdinal({ ...baseInput, prefixHash: "prefix-b" });

    expect(lateAgain).toEqual(late);
    expect(otherPrefix.key).not.toEqual(late.key);
    expect(otherPrefix.geometryHash).not.toBe(late.geometryHash);
  });
});
