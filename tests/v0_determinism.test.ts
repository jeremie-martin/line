/**
 * Determinism: same Spec + same seed + same budget produces byte-identical Track.
 *
 * This is the v0 hard contract (1). It is a load-bearing precondition for
 * the beam-search rework: monotonicity-in-budget can only be verified if
 * the underlying compiler is fully deterministic.
 *
 * Test strategy: compile each golden spec twice at the same seed, hash
 * both Tracks, assert hashes match. We cover a sampling of specs (small,
 * medium, large) to keep the test under a few seconds.
 */
import { describe, test, expect } from "vitest";
import { createHash } from "node:crypto";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import type { CompileResult } from "../scripts/v0/optimizer/types.ts";

function hashTrack(track: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(track))
    .digest("hex");
}

function onlyCheckpoint(result: CompileResult) {
  return result.checkpoints[0];
}

describe("v0 compiler determinism (hard contract C1)", () => {
  const budget = 40_000;
  const cases: Array<[string, number]> = [
    ["tiny_dance", 0],
    ["syncopated_switchback", 1],
    ["drums_signature", 2],
  ];

  for (const [name, seed] of cases) {
    test(`${name} (seed=${seed}) — two compiles produce hash-identical Track`, async () => {
      const spec = await loadGoldenSpec(name as never, "base");
      const a = onlyCheckpoint(compileHandoff(spec, seed, { budgets: [budget] }));
      const b = onlyCheckpoint(compileHandoff(spec, seed, { budgets: [budget] }));
      expect(hashTrack(a.track)).toBe(hashTrack(b.track));
      expect(a.stats.sim_frames).toBe(b.stats.sim_frames);
    }, 120_000);
  }
});
