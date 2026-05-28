import { describe, expect, test } from "vitest";
import { compile } from "../scripts/v0/compile.ts";
import type { Spec } from "../scripts/v0/types.ts";

const TRIVIAL: Spec = { duration: 1, contacts: [], sections: [] };

describe("v0 compile options and stats", () => {
  test("legacy compile returns deterministic work stats", () => {
    const a = compile(TRIVIAL, 0);
    const b = compile(TRIVIAL, 0);

    expect(a.track).toEqual(b.track);
    expect(a.report).toEqual(b.report);
    expect(a.stats.work_units_used).toBeGreaterThan(0);
    expect(a.stats.sim_frames).toBeGreaterThan(0);
    expect(a.stats.sim_frames).toBe(a.stats.physics_frames_computed);
    expect(a.stats.work_units_used).toBeGreaterThanOrEqual(a.stats.sim_frames);
    expect(a.stats.trajectory_frames_read).toBeGreaterThan(0);
    expect(a.stats.physics_frames_computed).toBeGreaterThanOrEqual(0);
    expect(a.stats.engine_add_lines).toBe(0);
    expect(a.stats.budget_exhausted).toBe(false);
  });

  test("lds strategy starts from a native scored fallback", () => {
    const result = compile(TRIVIAL, {
      seed: 0,
      strategy: "lds",
      budget: { kind: "work", units: 1 },
    });

    expect(result.track.lines).toHaveLength(0);
    expect(result.stats.subfloor_fallback_units).toBeGreaterThan(0);
    expect(result.stats.leaves_scored).toBeGreaterThan(0);
    expect(result.stats.scored_leaf_fingerprints.length).toBe(result.stats.leaves_scored);
    expect(result.stats.sim_frames).toBe(result.stats.physics_frames_computed);
    expect(result.stats.work_units_used).toBeGreaterThanOrEqual(result.stats.sim_frames);
    expect(result.stats.budget_exhausted).toBe(true);
  });
});
