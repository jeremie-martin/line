/**
 * Step 3 verification — the minimal greedy chainer.
 *
 * Contract:
 *   - Deterministic: same (spec, seed, K) → byte-identical Track.
 *   - Either produces a Track or throws clearly when a gap has zero
 *     viable candidates (no implicit fallback).
 *
 * "Happy path" tests use small specs (tiny_dance, mini_burst) where
 * greedy at K=48 is empirically expected to succeed; specs where
 * greedy_v2 fails are the subject of Step 4's K-sweep documentation,
 * not this verification step.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { compileGreedy_v2 } from "../scripts/v0/optimizer/greedy.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";

function hashTrack(t: unknown): string {
  return createHash("sha256").update(JSON.stringify(t)).digest("hex");
}

describe("optimizer/greedy.ts — Step 3 minimal chainer", () => {
  test("determinism: two compiles with same (spec, seed, K) produce hash-identical Track", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const a = compileGreedy_v2(spec, 0, { K: 48 });
    const b = compileGreedy_v2(spec, 0, { K: 48 });
    expect(hashTrack(a.track)).toBe(hashTrack(b.track));
    expect(a.stats.total_committed_cost).toBe(b.stats.total_committed_cost);
  });

  test("happy path: tiny_dance seed=0 K=48 produces a contract-passing Track", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const r = compileGreedy_v2(spec, 0, { K: 48 });
    expect(r.report.contacts.every((c) => c.status === "hit")).toBe(true);
    expect(r.report.off_beat_landings.length).toBe(0);
    expect(r.report.terminus.reason).toBe("endOfSpec");
  });

  test("happy path: mini_burst seed=0 K=48 produces a contract-passing Track", async () => {
    const spec = await loadGoldenSpec("mini_burst", "base");
    const r = compileGreedy_v2(spec, 0, { K: 48 });
    expect(r.report.contacts.every((c) => c.status === "hit")).toBe(true);
    expect(r.report.off_beat_landings.length).toBe(0);
    expect(r.report.terminus.reason).toBe("endOfSpec");
  });

  test("stats record per-gap costs and the total in agreement", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const r = compileGreedy_v2(spec, 0, { K: 48 });
    const sum = r.stats.committed_costs_per_gap
      .filter((c): c is number => c !== null)
      .reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(r.stats.total_committed_cost, 10);
  });

  test("invalid K throws", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    expect(() => compileGreedy_v2(spec, 0, { K: 0 })).toThrow();
    expect(() => compileGreedy_v2(spec, 0, { K: -1 })).toThrow();
    expect(() => compileGreedy_v2(spec, 0, { K: 1.5 })).toThrow();
  });
});
