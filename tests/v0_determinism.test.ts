/**
 * Determinism: same Spec + same seed produces byte-identical Track.
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
import { compile } from "../scripts/v0/compile.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";

function hashTrack(track: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(track))
    .digest("hex");
}

describe("v0 compiler determinism (hard contract C1)", () => {
  // Pick three representative specs across the size spectrum:
  //   tiny_dance (4 contacts), syncopated_switchback (24), drums_signature (55)
  const cases: Array<[string, number]> = [
    ["tiny_dance", 0],
    ["syncopated_switchback", 1],
    ["drums_signature", 2],
  ];

  for (const [name, seed] of cases) {
    test(`${name} (seed=${seed}) — two compiles produce hash-identical Track`, async () => {
      const spec = await loadGoldenSpec(name as never, "base");
      const a = compile(spec, seed);
      const b = compile(spec, seed);
      expect(hashTrack(a.track)).toBe(hashTrack(b.track));
    });
  }
});
