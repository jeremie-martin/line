/**
 * Step 5 verification — the best-so-far envelope's monotonicity
 * property (Property 1 from the rebuild charter).
 *
 * The load-bearing property: for any prefix `P` of a list of
 * explorations `L`, `score(envelope(P)) ≤ score(envelope(L))`. By
 * construction, the envelope never returns worse than the prior best.
 *
 * Tested with `greedy_v2` at multiple K values as the explorers on a
 * small spec (tiny_dance — fast and known to succeed at low K).
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { compileWithEnvelope, type Exploration } from "../scripts/v0/optimizer/envelope.ts";
import { compileGreedy_v2 } from "../scripts/v0/optimizer/greedy.ts";
import { scoreTrack } from "../scripts/v0/optimizer/scorer.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";

function hashTrack(t: unknown): string {
  return createHash("sha256").update(JSON.stringify(t)).digest("hex");
}

/** Build an exploration list of greedy_v2 at the given K values. */
async function greedyExplorations(name: string, seed: number, Ks: number[]): Promise<Exploration[]> {
  const spec = await loadGoldenSpec(name as never, "base");
  return Ks.map((K) => ({
    name: `greedy_v2_K${K}`,
    run: () => compileGreedy_v2(spec, seed, { K }),
  }));
}

describe("optimizer/envelope.ts — Step 5 best-so-far", () => {
  test("PROPERTY (monotonicity, in CI forever): every prefix scores ≤ full envelope", async () => {
    // tiny_dance is the cheapest spec; seeds 0-4 succeed at K=8 already.
    // Build explorations across 5 K values; each K produces a different
    // greedy_v2 result (verified in Step 4 — pure quality is non-
    // monotonic in K for greedy_v2 alone). The envelope must absorb
    // the non-monotonicity.
    const Ks = [8, 16, 32, 48];
    const explorations = await greedyExplorations("tiny_dance", 0, Ks);
    const fullScore = scoreTrack(compileWithEnvelope(explorations));
    for (let n = 1; n <= explorations.length; n++) {
      const prefix = explorations.slice(0, n);
      const prefixScore = scoreTrack(compileWithEnvelope(prefix));
      // Numerical tolerance is 1e-9 — scores from greedy_v2 are
      // deterministic doubles so they should match exactly when the
      // envelope picks the same winner.
      expect(prefixScore).toBeLessThanOrEqual(fullScore + 1e-9);
    }
  }, 120_000);

  test("PROPERTY: deterministic — same explorations in same order ⇒ hash-identical Track", async () => {
    const Ks = [8, 16, 32];
    const a = compileWithEnvelope(await greedyExplorations("tiny_dance", 0, Ks));
    const b = compileWithEnvelope(await greedyExplorations("tiny_dance", 0, Ks));
    expect(hashTrack(a.track)).toBe(hashTrack(b.track));
  }, 60_000);

  test("envelope of [E1, E2] returns whichever of E1, E2 scores higher", async () => {
    // Force a known ordering by handcrafting two explorations with
    // different known scores. Use a min-cost-track contract trick:
    // we don't have one, so just verify behaviorally with greedy_v2.
    const Ks = [8, 16];
    const explorations = await greedyExplorations("tiny_dance", 0, Ks);
    const e1 = compileGreedy_v2(await loadGoldenSpec("tiny_dance", "base"), 0, { K: 8 });
    const e2 = compileGreedy_v2(await loadGoldenSpec("tiny_dance", "base"), 0, { K: 16 });
    const envResult = compileWithEnvelope(explorations);
    const envScore = scoreTrack(envResult);
    expect(envScore).toBe(Math.max(scoreTrack(e1), scoreTrack(e2)));
  }, 60_000);

  test("throws are caught — envelope picks best of survivors", async () => {
    // Build a list mixing a guaranteed-success and a guaranteed-throw.
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const goodResult = compileGreedy_v2(spec, 0, { K: 8 });
    const explorations: Exploration[] = [
      { name: "throws-always", run: () => { throw new Error("nope"); } },
      { name: "tiny_dance_K8", run: () => compileGreedy_v2(spec, 0, { K: 8 }) },
      { name: "also-throws", run: () => { throw new Error("nope"); } },
    ];
    const r = compileWithEnvelope(explorations);
    expect(hashTrack(r.track)).toBe(hashTrack(goodResult.track));
  }, 30_000);

  test("all-throw → envelope itself throws clearly", async () => {
    const explorations: Exploration[] = [
      { name: "a", run: () => { throw new Error("a fail"); } },
      { name: "b", run: () => { throw new Error("b fail"); } },
    ];
    expect(() => compileWithEnvelope(explorations)).toThrow(/all 2 explorations failed/);
  });

  test("empty exploration list → envelope throws clearly", () => {
    expect(() => compileWithEnvelope([])).toThrow(/all 0 explorations failed/);
  });

  test("onProgress reports per-exploration status and best-so-far", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const explorations: Exploration[] = [
      { name: "throws", run: () => { throw new Error("nope"); } },
      { name: "ok1", run: () => compileGreedy_v2(spec, 0, { K: 8 }) },
    ];
    const trace: string[] = [];
    compileWithEnvelope(explorations, {
      onProgress: (t) => trace.push(`${t.name}/${t.status}/${t.becameBest}`),
    });
    expect(trace).toEqual(["throws/throw/false", "ok1/ok/true"]);
  }, 30_000);
});
