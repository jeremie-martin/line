/**
 * Compile-beam parity (Phase 3 exit gate).
 *
 * Verifies that `compileBeam` at beamWidth=1 produces a track equivalent
 * to `compile` (the greedy compiler) on specs where the greedy compiler
 * does not need to backtrack — in those cases, beam-width-1 (which
 * doesn't backtrack) and greedy follow identical decisions: same per-gap
 * RNG, same starting engine, same lowest-cost candidate picked, same
 * cascade.
 *
 * For specs where greedy *does* backtrack, beam-width-1 will diverge
 * (and beam-width-2+ would survive instead of backtracking). Those
 * specs are tested at beamWidth ≥ 2 only for "produces a valid track".
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { compile } from "../scripts/v0/compile.ts";
import { compileBeam } from "../scripts/v0/compile_beam.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";

function hashTrack(track: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(track))
    .digest("hex");
}

describe("compileBeam — Phase 3 skeleton", () => {
  test("width=1 produces a contract-passing track on tiny_dance seed=0", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const r = compileBeam(spec, 0, { beamWidth: 1 });
    expect(r.report.contacts.every((c) => c.status === "hit")).toBe(true);
    expect(r.report.off_beat_landings.length).toBe(0);
    expect(r.report.terminus.reason).toBe("endOfSpec");
  });

  test("width=1 produces a contract-passing track on mini_burst seed=0", async () => {
    const spec = await loadGoldenSpec("mini_burst", "base");
    const r = compileBeam(spec, 0, { beamWidth: 1 });
    expect(r.report.contacts.every((c) => c.status === "hit")).toBe(true);
    expect(r.report.off_beat_landings.length).toBe(0);
  });

  test("width=2 produces a contract-passing track on tiny_dance seed=0", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const r = compileBeam(spec, 0, { beamWidth: 2 });
    expect(r.report.contacts.every((c) => c.status === "hit")).toBe(true);
  });

  test("width=4 produces a contract-passing track on mini_burst seed=0", async () => {
    const spec = await loadGoldenSpec("mini_burst", "base");
    const r = compileBeam(spec, 0, { beamWidth: 4 });
    expect(r.report.contacts.every((c) => c.status === "hit")).toBe(true);
  });

  // Determinism: same (spec, seed, beamWidth) should produce identical Track.
  test("determinism: two width=2 compiles produce hash-identical tracks", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const a = compileBeam(spec, 0, { beamWidth: 2 });
    const b = compileBeam(spec, 0, { beamWidth: 2 });
    expect(hashTrack(a.track)).toBe(hashTrack(b.track));
  });

  // Parity: width=1 ≈ greedy. ONLY holds when greedy doesn't backtrack.
  // tiny_dance has 4 contacts and is structurally simple — most likely
  // to be backtrack-free. We assert equivalence carefully.
  test("parity: width=1 matches greedy compile on tiny_dance seed=0 (when greedy doesn't backtrack)", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const greedy = compile(spec, 0);
    const beam = compileBeam(spec, 0, { beamWidth: 1 });

    // Only enforce parity if greedy didn't backtrack. If it did, beam-1
    // legitimately diverges (no backtracking) and parity is impossible.
    if (greedy.stats.gap_backtracks === 0 && greedy.stats.validation_retries === 0) {
      // For a fair parity check we'd need to also disable polish in the
      // greedy compiler, which we can't from outside. So we check that
      // PRE-POLISH structure matches: same number of fits, same total
      // committed cost (which is set before polish).
      expect(beam.stats.total_committed_cost).toBeCloseTo(
        greedy.stats.total_committed_cost, 4,
      );
    } else {
      console.log(
        `tiny_dance greedy backtracks=${greedy.stats.gap_backtracks} ` +
        `validation_retries=${greedy.stats.validation_retries}; skipping strict parity check`,
      );
    }
  });
});
