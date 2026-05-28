/**
 * Stage 2 verification — anytime budget cutoff + monotonicity-in-budget.
 *
 * The property that runs in CI forever:
 *
 *   For any (spec, seed) and budgets B' > B,
 *     axis_quality(compile(spec, seed, B')) ≥ axis_quality(compile(spec, seed, B))
 *
 * This is Property 1 (monotonicity-in-budget) — the architectural
 * contract of the whole rebuild. With LDS-ordered enumeration + the
 * best-so-far register's strict-improvement rule, it holds by
 * construction: a larger budget enumerates a SUPERSET of the leaves
 * the smaller budget enumerates, and the max over a superset never
 * decreases.
 *
 * Tested on tiny_dance (smallest spec — keeps the test under ~2 min
 * even at the largest budget we use). For a one-off acceptance check
 * across the full suite × 5 seeds × 4 budgets, see Stage 5's sweep.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { compileLDS } from "../scripts/v0/optimizer/api.ts";
import { scoreReport } from "../scripts/v0/optimizer/scorer.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";

function hashTrack(t: unknown): string {
  return createHash("sha256").update(JSON.stringify(t)).digest("hex");
}

describe("optimizer/api.ts — Stage 2 anytime budget", () => {
  test("PROPERTY (in CI forever): axis_quality non-decreasing in budget", async () => {
    // tiny_dance: smallest spec, fastest to run. Use a small maxDiscrepancy
    // cap so "exhaustive" is reachable in a reasonable budget — this lets
    // us also verify the budget_exhausted flag at both ends.
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const seed = 0;
    const budgets = [50_000, 250_000, 2_000_000]; // sim_frames
    const maxDiscrepancy = 2; // ~125 leaves total on tiny_dance; reachable

    const results = budgets.map((units) =>
      compileLDS(spec, seed, { maxDiscrepancy, budget: { kind: "work", units } })
    );
    const qualities = results.map((r) => scoreReport(r.report));

    // The load-bearing assertion: monotonicity in budget.
    expect(qualities[0]).toBeLessThanOrEqual(qualities[1] + 1e-9);
    expect(qualities[1]).toBeLessThanOrEqual(qualities[2] + 1e-9);

    // sim_frames cap: the op boundary is "after each leaf scoring".
    // Per-op cost includes any cache-miss candidate generation along
    // the path to that leaf (uncached new-prefix gaps each trigger
    // K candidate evaluations). On tiny_dance maxD=2 the cumulative
    // per-op cost can be substantial. Log here so we can see the
    // actual numbers when calibrating.
    for (let i = 0; i < budgets.length; i++) {
      const r = results[i];
      const overshoot = r.stats.budget_exhausted
        ? r.stats.sim_frames - budgets[i]
        : 0;
      console.error(
        `[budget-cap] budget=${budgets[i]} sim_frames=${r.stats.sim_frames} ` +
        `exhausted=${r.stats.budget_exhausted} overshoot=${overshoot} q=${qualities[i].toFixed(4)}`,
      );
    }
    // Loose ceiling: even worst-case overshoot is bounded by one
    // full enumeration pass through the deepest path. For tiny_dance
    // maxD=2 with N_CAND=32, that's bounded by ~1M sim_frames.
    for (let i = 0; i < budgets.length; i++) {
      if (results[i].stats.budget_exhausted) {
        expect(results[i].stats.sim_frames).toBeLessThan(budgets[i] + 1_000_000);
      }
    }

    // Sanity: the largest budget didn't get exhausted (enumeration
    // ran to maxDiscrepancy completion). Diagnostic only — the
    // structural test is the monotonicity above.
    expect(results[2].stats.budget_exhausted).toBe(false);
  }, 300_000);

  test("PROPERTY (in CI forever): same (spec, seed, budget) → hash-identical Track", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const a = compileLDS(spec, 0, { budget: { kind: "work", units: 100_000 } });
    const b = compileLDS(spec, 0, { budget: { kind: "work", units: 100_000 } });
    expect(hashTrack(a.track)).toBe(hashTrack(b.track));
    // Stats including sim_frames must also be identical (deterministic
    // op count, not just deterministic Track).
    expect(a.stats.sim_frames).toBe(b.stats.sim_frames);
    expect(a.stats.budget_exhausted).toBe(b.stats.budget_exhausted);
  }, 120_000);

  test("unset budget = run to natural completion (default Infinity)", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const r = compileLDS(spec, 0, { maxDiscrepancy: 1 });
    expect(r.stats.budget_exhausted).toBe(false);
    expect(r.stats.sim_frames).toBeGreaterThan(0);
  }, 120_000);

  test("invalid budget throws", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    expect(() =>
      compileLDS(spec, 0, { budget: { kind: "work", units: 0 } })
    ).toThrow(/units must be positive/);
    expect(() =>
      compileLDS(spec, 0, { budget: { kind: "work", units: -1 } })
    ).toThrow(/units must be positive/);
  });

  test("budget=1 returns the d=0 leaf (always evaluated first), budget_exhausted=true", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    // The op-boundary cutoff is checked AFTER each leaf is scored, so
    // the d=0 leaf is always considered regardless of budget. This is
    // intentional — we always at least get the greedy track.
    const r = compileLDS(spec, 0, { budget: { kind: "work", units: 1 } });
    expect(r.stats.budget_exhausted).toBe(true);
    expect(r.report.contacts.every((c) => c.status === "hit")).toBe(true);
    expect(r.stats.sim_frames).toBeGreaterThan(1); // overshoot
  }, 60_000);

  test("budget_exhausted survives the register's stat re-stitch", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    // Mid-range budget: should both succeed AND set the exhausted flag.
    const r = compileLDS(spec, 0, { budget: { kind: "work", units: 150_000 } });
    expect(r.stats.budget_exhausted).toBe(true);
    expect(r.report.contacts.length).toBeGreaterThan(0); // got a real track
  }, 120_000);
});
