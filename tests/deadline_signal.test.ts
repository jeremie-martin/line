import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { makeRng } from "../scripts/lib/rng.ts";
import { setCompileBudgetFrames } from "../scripts/v0/arc_placement.ts";
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
import { setAimCompileBudgetFrames } from "../scripts/v0/optimizer/aim.ts";
import {
  budgetEstimatorStructuralScale,
  estimateRemainingBudgetWork,
} from "../scripts/v0/optimizer/budget_estimator.ts";
import { structuralRemainingWork } from "../scripts/v0/optimizer/budget_telemetry.ts";
import {
  CompileDeadline,
  DEADLINE_MARGIN_AT_RISK,
  DEADLINE_MARGIN_FULL_PRESSURE,
  DEADLINE_MARGIN_NO_PRESSURE,
  deadlineAtRisk,
  deadlinePressure,
  underFullDeadlinePressure,
} from "../scripts/v0/optimizer/deadline.ts";
import {
  getCandidatesSorted,
  makeRootNode,
  setAimLaneDeadlineThrottled,
} from "../scripts/v0/optimizer/node.ts";
import type { Candidate, SpecContext } from "../scripts/v0/optimizer/sample.ts";
import { CALIB, secToFrame, type Gap } from "../scripts/v0/types.ts";

const GAPS: Gap[] = [
  { index: 0, startFrame: 0, endFrame: 20, endsWithContact: true, targets: {} },
  { index: 1, startFrame: 20, endFrame: 50, endsWithContact: false, targets: {} },
  { index: 2, startFrame: 50, endFrame: 80, endsWithContact: true, targets: {} },
  { index: 3, startFrame: 80, endFrame: 100, endsWithContact: false, targets: {} },
];
const DURATION_FRAMES = 100;
const BUDGET = 750_000;

function deadline(overrides: { includeStartup?: boolean; budget?: number } = {}): CompileDeadline {
  return new CompileDeadline({
    gaps: GAPS,
    durationFrames: DURATION_FRAMES,
    policyBudgetFrames: overrides.budget ?? BUDGET,
    anchorGapIndex: 0,
    includeStartup: overrides.includeStartup ?? true,
  });
}

/** What the estimator gives for the same position, computed independently. */
function expectedWork(
  gapIndex: number,
  includeStartup: boolean,
  path: number | null,
  budget = BUDGET,
): number {
  const structural = budgetEstimatorStructuralScale(budget) *
    structuralRemainingWork(GAPS, DURATION_FRAMES, gapIndex, includeStartup);
  return estimateRemainingBudgetWork({
    structural,
    path,
    pace: null,
    progressFraction: 0,
  });
}

describe("optimizer/deadline.ts — the one live deadline signal", () => {
  test("at the first node the margin IS the static structural estimate", () => {
    const margin = deadline().marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    expect(margin).toBeCloseTo(BUDGET / expectedWork(0, true, null), 9);
  });

  test("the startup intercept is charged once, at the anchor only", () => {
    const withStartup = deadline().marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    const resumed = deadline({ includeStartup: false })
      .marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    expect(withStartup).toBeLessThan(resumed);
    // Past the anchor the intercept is no longer due either way; only the
    // progress the two anchors imply (and so the pace weight) differs.
    expect(deadline().marginAt({ spentFrames: 0, gapIndex: 2, costToEnd: null }))
      .toBe(deadline({ includeStartup: false })
        .marginAt({ spentFrames: 0, gapIndex: 2, costToEnd: null }));
  });

  test("spending lowers the margin", () => {
    const start = deadline().marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    const spent = deadline().marginAt({ spentFrames: 300_000, gapIndex: 0, costToEnd: null });
    expect(spent).toBeLessThan(start);
  });

  test("the compile's own cost per unit progress enters the estimate", () => {
    // Same position, same budget, different spend to get there: the cheap
    // traversal keeps its margin and the expensive one loses it, which the
    // structural suffix alone cannot express (it is identical for both).
    const cheap = deadline().marginAt({ spentFrames: 50_000, gapIndex: 2, costToEnd: null });
    const grinding = deadline().marginAt({ spentFrames: 400_000, gapIndex: 2, costToEnd: null });
    const structuralOnly = (spent: number): number => {
      const structural = budgetEstimatorStructuralScale(BUDGET) *
        structuralRemainingWork(GAPS, DURATION_FRAMES, 2, false);
      return (BUDGET - spent) /
        estimateRemainingBudgetWork({ structural, path: null, pace: null, progressFraction: 0 });
    };
    expect(structuralOnly(400_000) / structuralOnly(50_000))
      .toBeCloseTo((BUDGET - 400_000) / (BUDGET - 50_000), 9);
    // The margin falls faster than the budget alone: the denominator grew too.
    expect(grinding / cheap).toBeLessThan((BUDGET - 400_000) / (BUDGET - 50_000));
    // With no progress yet there is no pace evidence, so the estimate is the
    // static one at any spend.
    expect(deadline().marginAt({ spentFrames: 400_000, gapIndex: 0, costToEnd: null }))
      .toBeCloseTo((BUDGET - 400_000) / expectedWork(0, true, null), 9);
  });

  test("the measured cost-to-end profile replaces the structural suffix where defined", () => {
    // A profile also means the pace term is dropped: the path IS the evidence.
    const costToEnd = [-1, -1, 40_000, -1, -1];
    const withPath = deadline().marginAt({ spentFrames: 100_000, gapIndex: 2, costToEnd });
    expect(withPath).toBeCloseTo(
      (BUDGET - 100_000) / expectedWork(2, false, 40_000),
      9,
    );
    // -1 (the profile's "no measurement at this anchor") falls back to structure,
    // exactly as the recorder treats a non-positive path.
    const unmeasured = deadline().marginAt({ spentFrames: 100_000, gapIndex: 1, costToEnd });
    expect(unmeasured).toBeCloseTo((BUDGET - 100_000) / expectedWork(1, false, null), 9);
  });

  test("a terminal position has no deadline and an exhausted budget has no margin", () => {
    expect(deadline().marginAt({ spentFrames: 0, gapIndex: GAPS.length, costToEnd: null }))
      .toBe(Infinity);
    expect(deadline().marginAt({ spentFrames: 2 * BUDGET, gapIndex: 0, costToEnd: null }))
      .toBe(0);
  });

  test("the margin scales with the budget through the law, not linearly", () => {
    const low = new CompileDeadline({
      gaps: GAPS,
      durationFrames: DURATION_FRAMES,
      policyBudgetFrames: 150_000,
      anchorGapIndex: 0,
      includeStartup: true,
    }).marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    const high = deadline().marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    const budgetRatio = BUDGET / 150_000;
    expect(high / low).toBeGreaterThan(1);
    // A budget-linear coordinate (the paced slack this replaced) would give the
    // full ratio; the law's exponent damps it to B^(1-alpha).
    expect(high / low).toBeLessThan(budgetRatio);
  });

  test("the ramp reads its three anchors in margin units", () => {
    expect(DEADLINE_MARGIN_AT_RISK).toBe(1);
    expect(DEADLINE_MARGIN_FULL_PRESSURE).toBe(1.25);
    expect(DEADLINE_MARGIN_NO_PRESSURE).toBe(2);
    expect(deadlinePressure(Infinity)).toBe(0);
    expect(deadlinePressure(DEADLINE_MARGIN_NO_PRESSURE)).toBe(0);
    expect(deadlinePressure(DEADLINE_MARGIN_FULL_PRESSURE)).toBe(1);
    expect(deadlinePressure(0)).toBe(1);
    expect(deadlinePressure(1.625)).toBeCloseTo(0.5, 12);
    expect(underFullDeadlinePressure(DEADLINE_MARGIN_FULL_PRESSURE)).toBe(true);
    expect(underFullDeadlinePressure(1.26)).toBe(false);
    expect(deadlineAtRisk(0.999)).toBe(true);
    expect(deadlineAtRisk(1)).toBe(false);
  });
});

describe("aim-lane throttle — H2 closure", () => {
  /**
   * 0a's fact 1, pinned: the throttle flag has exactly one live writer, and it
   * is scoped by try/finally around ONE `getCandidatesSorted` call. Every other
   * pool build in the compile therefore runs unthrottled, which is what keeps
   * the un-keyed pool memo's exposure to the transition small.
   */
  test("the throttle flag is scoped to a single pool build, restored in finally", () => {
    const source = readFileSync("scripts/v0/optimizer/handoff.ts", "utf8");
    const writes = [...source.matchAll(/setAimLaneDeadlineThrottled\(([^)]*)\)/g)];
    expect(writes.map((match) => match[1])).toEqual(["aimLaneThrottled", "false"]);
    const opened = source.indexOf("setAimLaneDeadlineThrottled(aimLaneThrottled)");
    const closed = source.indexOf("setAimLaneDeadlineThrottled(false)");
    const scoped = source.slice(opened, closed);
    expect(scoped.match(/getCandidatesSorted\(/g)).toHaveLength(1);
    expect(scoped).toMatch(/\btry\s*\{/);
    expect(scoped).toMatch(/\}\s*finally\s*\{\s*$/);
  });

  /**
   * 0a's fact 2, pinned: 3,271 measured cache lifetimes straddle a transition
   * and every one of them is resolved by a path that REBUILDS. A pool built at
   * a smaller nCand and read at a larger one must therefore come back sorted
   * under the live throttle state, identical to a fresh build under that state
   * and different from one under the other state.
   */
  test("an extended cache re-sorts under the live throttle state", async () => {
    const spec = await loadGoldenSpec("dense_sprint", "base");
    validateSpec(spec);
    const durationFrames = secToFrame(spec.duration);
    const allContactFrames = spec.contacts
      .map((contact) => secToFrame(contact.t))
      .sort((a, b) => a - b);
    const gaps = sliceTimeline(allContactFrames, durationFrames);
    const targetRng = makeRng(0);
    for (const gap of gaps) {
      gap.targets = sampleGapTargets(effectiveAxes(gap, spec), CALIB.SIGMA, targetRng);
    }
    const ctx: SpecContext = { allContactFrames, durationFrames, gaps };
    const fingerprint = (pool: readonly Candidate[]): string =>
      `${pool.length}#` +
      pool.map((candidate) => `${candidate.cost.toFixed(6)}:${candidate.lines.length}`).join("|");
    const build = (prebuildNCand: number | null, nCand: number, throttled: boolean): string => {
      resetPerCompileState();
      setCompileBudgetFrames(BUDGET);
      setAimCompileBudgetFrames(BUDGET);
      const node = makeRootNode(makeBaseEngine(resolveStartState(spec)), gaps.length);
      if (prebuildNCand !== null) getCandidatesSorted(node, gaps, ctx, 19, prebuildNCand);
      setAimLaneDeadlineThrottled(throttled);
      try {
        return fingerprint(getCandidatesSorted(node, gaps, ctx, 19, nCand));
      } finally {
        setAimLaneDeadlineThrottled(false);
      }
    };
    const straddled = build(3, 12, true);
    expect(straddled).toBe(build(null, 12, true));
    expect(straddled).not.toBe(build(null, 12, false));
  }, 60_000);
});
