import { describe, expect, test } from "vitest";
import { makeRng } from "../scripts/lib/rng.ts";
import { getPhysicsFrameCount } from "../scripts/lib/detector.ts";
import { axisLookaheadEndFrame } from "../scripts/v0/core/candidate.ts";
import { resetPerCompileState } from "../scripts/v0/core/compile_lifecycle.ts";
import {
  effectiveAxes,
  makeBaseEngine,
  resolveStartState,
  sampleGapTargets,
  sliceTimeline,
  validateSpec,
} from "../scripts/v0/core/substrate.ts";
import { loadGoldenSpec } from "../scripts/v0/golden_suite.ts";
import {
  setAimBaseFitReuseAllowed,
  setAimCompileBudgetFrames,
} from "../scripts/v0/optimizer/aim.ts";
import {
  evaluateArcKnobSequence,
  projectJointArcBaseFit,
} from "../scripts/v0/optimizer/arc_probe.ts";
import { solveOneGap } from "../scripts/v0/optimizer/solver.ts";
import type { Candidate, SpecContext } from "../scripts/v0/optimizer/sample.ts";
import {
  getCandidatesSorted,
  makeRootNode,
  setAimLaneDeadlineThrottled,
} from "../scripts/v0/optimizer/node.ts";
import { CALIB, secToFrame } from "../scripts/v0/types.ts";

describe("joint arc base-fit projection", () => {
  test("reproduces the exact zero-control short probe outputs", async () => {
    const spec = await loadGoldenSpec("dense_sprint", "base");
    validateSpec(spec);
    const engine = makeBaseEngine(resolveStartState(spec));
    const durationFrames = secToFrame(spec.duration);
    const allContactFrames = spec.contacts
      .map((contact) => secToFrame(contact.t))
      .sort((a, b) => a - b);
    const gaps = sliceTimeline(allContactFrames, durationFrames);
    const targetRng = makeRng(0);
    for (const gap of gaps) {
      gap.targets = sampleGapTargets(
        effectiveAxes(gap, spec),
        CALIB.SIGMA,
        targetRng,
      );
    }
    const ctx: SpecContext = { allContactFrames, durationFrames, gaps };
    const gap = gaps[0];
    const nextGap = gaps.find((candidate) =>
      candidate.index > gap.index && candidate.endsWithContact
    );
    if (nextGap === undefined) throw new Error("fixture needs a following contact");
    const bases: Candidate[] = [];
    for (let seed = 0; seed < 32 && bases.length < 24; seed++) {
      bases.push(...solveOneGap(
        engine,
        gap,
        makeRng(seed),
        64,
        ctx,
        1,
      ));
    }
    if (bases.length < 24) throw new Error("fixture produced too few viable candidates");

    const options = {
      includeElevation: nextGap.targets.elevation !== undefined,
      includeAmplitude: true,
      targetEndsWithContact: nextGap.endsWithContact,
    };
    const compared = bases
      .filter((base) => base.ballisticLaunch !== undefined)
      .slice(0, 12);
    expect(bases.some((base) => base.ballisticLaunch === undefined)).toBe(true);
    for (const base of compared) {
      const exact = evaluateArcKnobSequence(
        engine,
        base.lines,
        ["tail_pitch", "post_contact_pitch"],
        [0, 0],
        { pitchDeg: 0, rotateDeg: 0 },
        gap,
        allContactFrames,
        axisLookaheadEndFrame(gap, allContactFrames),
        nextGap.endFrame,
        options,
      );
      const reused = projectJointArcBaseFit(
        base,
        gap,
        nextGap.endFrame,
        options,
      );

      expect(reused.outputs).toEqual(exact.outputs);
      expect(reused.suffixFrame).toBe(exact.suffixFrame);
      expect(reused.gate.currentOk).toBe(exact.gate.currentOk);
      expect(reused.gate.nextStateOk).toBe(exact.gate.nextStateOk);
    }

    const poolWith = (
      reuseBaseFit: boolean,
      budget: number,
      allowed = reuseBaseFit,
    ) => {
      resetPerCompileState();
      setAimCompileBudgetFrames(budget);
      setAimLaneDeadlineThrottled(false);
      setAimBaseFitReuseAllowed(allowed);
      if (reuseBaseFit) delete process.env.LR_AIM_REUSE_BASE_FIT;
      else process.env.LR_AIM_REUSE_BASE_FIT = "0";
      const freshContext: SpecContext = {
        allContactFrames,
        durationFrames,
        gaps,
      };
      const pool = getCandidatesSorted(
        makeRootNode(makeBaseEngine(resolveStartState(spec)), gaps.length),
        gaps,
        freshContext,
        19,
        27,
      );
      return {
        frames: getPhysicsFrameCount(),
        candidates: pool.map((candidate) => ({
          lines: candidate.lines,
          achieved: candidate.achieved,
          cost: candidate.cost,
          aimed: candidate.aimed,
          sampleAttempt: candidate.sampleAttempt,
        })),
      };
    };
    try {
      for (const budget of [150_000, 250_000, 750_000, 3_000_000]) {
        const reusedPool = poolWith(true, budget);
        const probedPool = poolWith(false, budget);
        const preCompletionPool = poolWith(true, budget, false);
        expect(reusedPool.candidates, `candidate pool at ${budget}`).toEqual(
          probedPool.candidates,
        );
        expect(reusedPool.frames, `physics frames at ${budget}`).toBeLessThan(
          probedPool.frames,
        );
        expect(
          preCompletionPool.candidates,
          `pre-completion pool at ${budget}`,
        ).toEqual(probedPool.candidates);
      }
    } finally {
      setAimBaseFitReuseAllowed(false);
      delete process.env.LR_AIM_REUSE_BASE_FIT;
    }
  }, 60_000);
});
