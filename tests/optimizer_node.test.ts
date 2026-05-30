import { describe, expect, test } from "vitest";
import { makeRng } from "../scripts/lib/rng.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../scripts/v0/core/substrate.ts";
import { withOptimizedPrerollStart } from "../scripts/v0/core/preroll.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import { CALIB, secToFrame } from "../scripts/v0/types.ts";
import {
  extendNode,
  getCandidatePrefix,
  getCandidatesSorted,
  makeRootNode,
  N_CAND,
  type SearchNode,
} from "../scripts/v0/optimizer/node.ts";
import { solveOneGap } from "../scripts/v0/optimizer/solver.ts";
import type { Candidate, SpecContext } from "../scripts/v0/optimizer/sample.ts";
import type { Gap } from "../scripts/v0/optimizer/types.ts";

function candidateKey(candidate: Candidate): string {
  return JSON.stringify({
    cost: candidate.cost,
    lines: candidate.lines,
  });
}

async function setupNodeFixture(name: "tiny_dance", seed: number) {
  const raw = await loadGoldenSpec(name, "base");
  validateSpec(raw);
  const spec = withOptimizedPrerollStart(raw, seed);
  const startState = resolveStartState(spec);
  const durationFrames = secToFrame(spec.duration);
  const allContactFrames = [...spec.contacts]
    .map((contact) => secToFrame(contact.t))
    .sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const masterRng = makeRng(seed);
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(effectiveAxes(gap, spec), CALIB.SIGMA, masterRng);
  }

  const ctx: SpecContext = { allContactFrames, durationFrames };
  const root = makeRootNode(makeBaseEngine(startState), gaps.length);
  return { root, gaps, ctx, seed };
}

function advanceToContact(node: SearchNode, gaps: Gap[]): SearchNode {
  let out = node;
  while (out.gapIndex < gaps.length && !gaps[out.gapIndex].endsWithContact) {
    out = extendNode(out, null);
  }
  return out;
}

describe("optimizer/node.ts candidate cache", () => {
  test("preview prefix reuse preserves the full sorted candidate stream", async () => {
    const { root, gaps, ctx, seed } = await setupNodeFixture("tiny_dance", 0);
    const [first] = getCandidatesSorted(root, gaps, ctx, seed);
    expect(first).toBeDefined();

    const previewed = advanceToContact(extendNode(root, first), gaps);
    const fresh = advanceToContact(extendNode(root, first), gaps);
    expect(previewed.gapIndex).toBeLessThan(gaps.length);

    const preview = getCandidatePrefix(previewed, gaps, ctx, seed, 2);
    const directPreview = solveOneGap(
      fresh.prefixEngine,
      gaps[fresh.gapIndex],
      makeRng((Math.imul(seed | 0, 1000003) + fresh.gapIndex + 1) | 0),
      2,
      ctx,
      fresh.prefixNextLineId,
    );
    expect(preview.map(candidateKey)).toEqual(directPreview.map(candidateKey));

    const fromPreviewCache = getCandidatesSorted(previewed, gaps, ctx, seed);
    const fromFreshSolve = getCandidatesSorted(fresh, gaps, ctx, seed);
    expect(fromPreviewCache.map(candidateKey)).toEqual(fromFreshSolve.map(candidateKey));
    expect(previewed._candidateAttemptCache?.attempts).toBe(N_CAND);
  }, 60_000);
});
