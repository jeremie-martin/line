import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { makeRng } from "../scripts/lib/rng.ts";
import { beginEnvFlagEpoch } from "../scripts/v0/env_flags.ts";
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
  BUDGET_ESTIMATOR_MODEL,
  BUDGET_ESTIMATOR_TRAVERSAL_MODEL,
  budgetEstimatorStructuralScale,
  estimateRemainingBudgetWork,
  structuralRemainingWork,
} from "../scripts/v0/optimizer/budget_estimator.ts";
import { TRAVERSAL_BUDGET_MODEL_V1 } from "../scripts/v0/optimizer/budget_model.ts";
import { compileHandoff } from "../scripts/v0/optimizer/handoff.ts";
import {
  CompileDeadline,
  DEADLINE_MARGIN_FULL_PRESSURE,
  DEADLINE_MARGIN_NO_PRESSURE,
  deadlineMarginAnchors,
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

/** Run `body` with `env` applied, restoring the environment afterwards. The
 *  compile-scoped readers cache per epoch, and a direct call opens none of its
 *  own, so the epoch is bumped on both edges. */
function withEnv<T>(env: Record<string, string | undefined>, body: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(env)) {
    saved.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  beginEnvFlagEpoch();
  try {
    return body();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    beginEnvFlagEpoch();
  }
}

/** What the estimator gives for the same position, computed independently. */
function expectedWork(
  gapIndex: number,
  includeStartup: boolean,
  path: number | null,
  budget = BUDGET,
): number {
  const structural = budgetEstimatorStructuralScale(budget) *
    structuralRemainingWork(
      GAPS,
      DURATION_FRAMES,
      gapIndex,
      includeStartup,
      BUDGET_ESTIMATOR_TRAVERSAL_MODEL,
    );
  return estimateRemainingBudgetWork({
    structural,
    path,
    pace: null,
    progressFraction: 0,
  });
}

describe("optimizer/deadline.ts — the one live deadline signal", () => {
  /**
   * The base-shape decision, pinned.
   *
   * `structuralRemainingWork` used to DEFAULT to `TRAVERSAL_BUDGET_MODEL_V1`,
   * and taking that default silently is how the shipped margin spent one era
   * being V1-shaped under the artifact's law scale — a signal ~1.9x looser than
   * the one its anchors were derived on, measured at +52.9 / +26.9 on two
   * canonical capability groups when corrected. The default is gone, so the
   * model argument is now required as well as load-bearing, and this test fails
   * if a future edit passes the wrong one.
   */
  test("the structural base is the ARTIFACT's shape, never the function default", () => {
    expect(BUDGET_ESTIMATOR_TRAVERSAL_MODEL.contactFrames)
      .not.toBeCloseTo(TRAVERSAL_BUDGET_MODEL_V1.contactFrames, 6);
    const v1Work = budgetEstimatorStructuralScale(BUDGET) *
      structuralRemainingWork(GAPS, DURATION_FRAMES, 0, true, TRAVERSAL_BUDGET_MODEL_V1);
    const v1Margin = BUDGET / estimateRemainingBudgetWork({
      structural: v1Work,
      path: null,
      pace: null,
      progressFraction: 0,
    });
    const margin = deadline().marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    expect(margin).not.toBeCloseTo(v1Margin, 6);
    expect(margin).toBeLessThan(v1Margin);
  });

  test("at the first node the margin IS the static structural estimate", () => {
    const margin = deadline().marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    expect(margin).toBeCloseTo(BUDGET / expectedWork(0, true, null), 9);
  });

  test("the startup intercept is charged once, at the anchor only", () => {
    const withStartup = deadline().marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    const resumed = deadline({ includeStartup: false })
      .marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    expect(withStartup).toBeLessThan(resumed);
    // Past the anchor the intercept is no longer due either way, and nothing
    // else in the margin remembers which anchor the compile started from.
    expect(deadline().marginAt({ spentFrames: 0, gapIndex: 2, costToEnd: null }))
      .toBe(deadline({ includeStartup: false })
        .marginAt({ spentFrames: 0, gapIndex: 2, costToEnd: null }));
  });

  test("spending lowers the margin", () => {
    const start = deadline().marginAt({ spentFrames: 0, gapIndex: 0, costToEnd: null });
    const spent = deadline().marginAt({ spentFrames: 300_000, gapIndex: 0, costToEnd: null });
    expect(spent).toBeLessThan(start);
  });

  /**
   * THE PRE-COMPLETION MARGIN, IN CLOSED FORM — the pin the pace-term removal
   * ships behind.
   *
   * Before first completion the denominator is ONE term: the artifact-shaped
   * structural suffix, times the budget law's scale, times the artifact's
   * without-path correction. Not "approximately that": bit-for-bit that, at
   * every gap and every spend. The compile's own spend reaches the margin
   * through the NUMERATOR ONLY.
   *
   * It used to reach the denominator as well, through an episode-pace blend
   * (`spent * structural / progressed`, geometrically blended at the structural
   * progress fraction), which made two compiles at the same position with
   * different spend disagree about how much work was left. That term was
   * measured at -0.016 +/- 0.381 (750k, 352 cells) and -0.224 [-1.051, +0.578]
   * (250k, 40 seeds) and removed; the tombstone in `deadline.ts` carries the
   * rest of the evidence. This test is what makes putting it back a visible
   * act rather than a plausible-looking patch.
   */
  test("the pre-completion margin is the law-scaled structural base and nothing else", () => {
    const scale = budgetEstimatorStructuralScale(BUDGET);
    const correction = BUDGET_ESTIMATOR_MODEL.combination.correctionWithoutPathFactor;
    expect(correction).toBeGreaterThan(0);
    for (const gap of [0, 1, 2, 3, 4]) {
      // The startup intercept is due at the anchor (gap 0 here) and nowhere else.
      const work = scale * structuralRemainingWork(
        GAPS,
        DURATION_FRAMES,
        gap,
        gap === 0,
        BUDGET_ESTIMATOR_TRAVERSAL_MODEL,
      ) * correction;
      for (const spentFrames of [0, 50_000, 400_000, 700_000]) {
        const margin = deadline().marginAt({ spentFrames, gapIndex: gap, costToEnd: null });
        // gap 4 is terminal: no work left, no deadline.
        if (gap === GAPS.length) {
          expect(margin).toBe(Infinity);
          continue;
        }
        expect(margin).toBe((BUDGET - spentFrames) / work);
      }
    }

    // The same statement without the closed form, in case a future artifact
    // changes the constants: the denominator does not depend on the spend, so
    // the margin is exactly proportional to what is left of the budget.
    const at = (spent: number): number =>
      deadline().marginAt({ spentFrames: spent, gapIndex: 2, costToEnd: null });
    expect(at(400_000) / at(50_000))
      .toBeCloseTo((BUDGET - 400_000) / (BUDGET - 50_000), 12);
  });

  test("the measured cost-to-end profile replaces the structural suffix where defined", () => {
    // Post-completion the path IS the evidence, and it carries the artifact's
    // OTHER correction factor (`correctionWithPathFactor`) — the one place the
    // two phases' denominators differ by more than which suffix they read.
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

  /**
   * THE PRE-REPAIR POST-COMPLETION WINDOW — the defect, and why it is now
   * unreachable rather than merely fixed.
   *
   * Post-completion the caller switches `gapIndex` from the compile's high
   * water to the NODE'S OWN gap, because the pass is a restart from an anchor.
   * Under the episode-pace term, a null profile at that position made
   * `marginAt` price the compile's GLOBAL spend against the progress implied by
   * ONE shallow node's depth, and the margin collapsed on a node that was doing
   * nothing wrong. Two things closed it: `handoff.ts` now builds the profile at
   * the instant the first completion is ADOPTED rather than when repair starts
   * (pinned by the source test below), and the pace term is gone, so the shape
   * of the defect no longer exists — an all-unmeasured profile and a null
   * profile at the same position are now the SAME number, not merely close.
   */
  test("an all-unmeasured profile reads exactly as the structural suffix", () => {
    const spent = 400_000;
    const shallowGap = 1;
    // Every entry -1: the shape `handoff.ts` produces below the repair minimum,
    // where the reach maps are deliberately never stamped.
    const unmeasured = [-1, -1, -1, -1, -1];
    const structuralOnly = (BUDGET - spent) / expectedWork(shallowGap, false, null);

    const withProfile = deadline()
      .marginAt({ spentFrames: spent, gapIndex: shallowGap, costToEnd: unmeasured });
    expect(withProfile).toBe(structuralOnly);

    // The defect's old signature: a null profile at the same position used to
    // read STRICTLY LOWER, because the pace term fired on it. There is no term
    // left that can tell the two apart.
    expect(deadline().marginAt({ spentFrames: spent, gapIndex: shallowGap, costToEnd: null }))
      .toBe(withProfile);
  });

  /**
   * The handoff side of the same contract. WHERE an assignment lives is not
   * observable from a unit-level call, so this is a source pin, in the style of
   * the aim-lane throttle test below: the profile must be written in the branch
   * that stamps `firstCompletionFrame` — the phase flip — and the repair
   * phase's own rebuild must be the only other writer.
   */
  test("the cost-to-end profile is established at first adopted completion", () => {
    const source = readFileSync("scripts/v0/optimizer/handoff.ts", "utf8");
    const writes = [...source.matchAll(/\bincumbentCostToEnd = ([^;]*);/g)].map((m) => m[1]);
    expect(writes).toEqual(["buildIncumbentCostToEnd()", "costToEnd"]);
    const stamp = source.indexOf("firstCompletionFrame = getSimFrames();");
    const build = source.indexOf("incumbentCostToEnd = buildIncumbentCostToEnd();");
    expect(stamp).toBeGreaterThan(0);
    expect(build).toBeGreaterThan(stamp);
    // Nothing closes between the two: same block, so the profile cannot come to
    // exist without the phase having flipped, or the flip happen without it.
    expect(source.slice(stamp, build)).not.toContain("}");
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

  test("the ramp reads its two anchors in margin units", () => {
    expect(DEADLINE_MARGIN_FULL_PRESSURE).toBe(1.25);
    expect(DEADLINE_MARGIN_NO_PRESSURE).toBe(2);
    expect(deadlinePressure(Infinity)).toBe(0);
    expect(deadlinePressure(DEADLINE_MARGIN_NO_PRESSURE)).toBe(0);
    expect(deadlinePressure(DEADLINE_MARGIN_FULL_PRESSURE)).toBe(1);
    expect(deadlinePressure(0)).toBe(1);
    expect(deadlinePressure(1.625)).toBeCloseTo(0.5, 12);
    // The boolean verdict and the ramp's full-pressure end are the SAME anchor:
    // no consumer may carry a private, stricter alarm beside the shared ramp.
    expect(underFullDeadlinePressure(DEADLINE_MARGIN_FULL_PRESSURE)).toBe(true);
    expect(underFullDeadlinePressure(1.26)).toBe(false);
    for (const margin of [0, 0.5, 0.999, 1, 1.25, 1.2500001, 1.5, 2, Infinity]) {
      expect(underFullDeadlinePressure(margin)).toBe(deadlinePressure(margin) >= 1);
    }
  });

  /**
   * The anchor re-bracket knobs.
   *
   * The pair is filed STALE by the module header (derived on the V1-shaped
   * signal, three neighbouring mechanisms have moved since), and these two
   * variables are how the re-bracket is measured. Production is the shipped
   * pair — the knobs unset must be exactly today's ramp — and an out-of-range
   * or degenerate pair must REFUSE, because a sweep arm that silently ran at
   * the default is worse than no arm.
   */
  test("LR_STUDY_DEADLINE_{NO,FULL}_PRESSURE re-bracket the ramp and refuse rather than clamp", () => {
    // Unset is the shipped pair, exactly.
    expect(withEnv({}, deadlineMarginAnchors))
      .toEqual({ noPressure: DEADLINE_MARGIN_NO_PRESSURE, fullPressure: DEADLINE_MARGIN_FULL_PRESSURE });
    expect(withEnv(
      { LR_STUDY_DEADLINE_NO_PRESSURE: "", LR_STUDY_DEADLINE_FULL_PRESSURE: "" },
      deadlineMarginAnchors,
    )).toEqual({ noPressure: 2, fullPressure: 1.25 });

    // Both anchors move, independently, and the ramp follows them.
    expect(withEnv({ LR_STUDY_DEADLINE_NO_PRESSURE: "3" }, deadlineMarginAnchors))
      .toEqual({ noPressure: 3, fullPressure: 1.25 });
    expect(withEnv({ LR_STUDY_DEADLINE_NO_PRESSURE: "3" }, () => deadlinePressure(3))).toBe(0);
    expect(withEnv({ LR_STUDY_DEADLINE_NO_PRESSURE: "3" }, () => deadlinePressure(2)))
      .toBeCloseTo(1 / 1.75, 12);
    expect(withEnv({ LR_STUDY_DEADLINE_FULL_PRESSURE: "1.5" }, () => deadlinePressure(1.5))).toBe(1);
    expect(withEnv({ LR_STUDY_DEADLINE_FULL_PRESSURE: "1.5" }, () => underFullDeadlinePressure(1.4)))
      .toBe(true);
    // The boolean face tracks the SAME anchor under the study arm too — the
    // identity the shipped pair satisfies is a property of the ramp, not of the
    // two numbers that happen to be in it.
    expect(withEnv(
      { LR_STUDY_DEADLINE_NO_PRESSURE: "2.5", LR_STUDY_DEADLINE_FULL_PRESSURE: "1" },
      () => [0.9, 1, 1.01, 1.75, 2.5, 3].map((m) =>
        underFullDeadlinePressure(m) === (deadlinePressure(m) >= 1)
      ),
    )).toEqual([true, true, true, true, true, true]);

    for (const bad of ["0", "-1", "10.1", "two", "NaN", "1e400", " "]) {
      expect(() => withEnv({ LR_STUDY_DEADLINE_NO_PRESSURE: bad }, deadlineMarginAnchors))
        .toThrow(/LR_STUDY_DEADLINE_NO_PRESSURE must be a finite number in \(0, 10\]/);
      expect(() => withEnv({ LR_STUDY_DEADLINE_FULL_PRESSURE: bad }, deadlineMarginAnchors))
        .toThrow(/LR_STUDY_DEADLINE_FULL_PRESSURE must be a finite number in \(0, 10\]/);
    }
    // A degenerate pair is refused, not silently repaired: at full == no the
    // ramp divides by zero, and inverted it reads pressure backwards.
    for (const pair of [["2", "2"], ["1.5", "2"], ["1.25", "3"]]) {
      expect(() => withEnv(
        { LR_STUDY_DEADLINE_NO_PRESSURE: pair[0], LR_STUDY_DEADLINE_FULL_PRESSURE: pair[1] },
        deadlineMarginAnchors,
      )).toThrow(/must be strictly below/);
    }
  });

  /**
   * POLICY RUNS THE ARTIFACT AS WRITTEN.
   *
   * There used to be a local copy of the artifact here with `paceSchedule`
   * forced from `"none"` to `"linear_progress"`, a load-time assert guarding
   * that override, and an `LR_STUDY_PACE_WEIGHT` knob to re-price it — and, in
   * this file, three tests. All of it is gone with the term (see the tombstone
   * in `deadline.ts`), and what replaces the assert is this: the live margin is
   * BIT-FOR-BIT what the artifact-as-written prices, so a divergence between
   * policy and the recorded artifact cannot exist to be asserted about.
   *
   * The equality is `toBe`, not `toBeCloseTo`, on purpose. The old override
   * could only be compared to double-rounding, because the estimator's
   * geometric blend returns `exp(log(base))` even at weight zero; running the
   * artifact means never entering the blend at all.
   */
  test("the artifact says `none` and policy prices exactly that", () => {
    expect(BUDGET_ESTIMATOR_MODEL.combination.paceSchedule).toBe("none");
    for (const [gapIndex, spent] of [[0, 0], [2, 400_000], [3, 700_000]] as const) {
      const live = deadline().marginAt({ spentFrames: spent, gapIndex, costToEnd: null });
      expect(live).toBe((BUDGET - spent) / expectedWork(gapIndex, gapIndex === 0, null));
    }
  });
});

/**
 * The mechanism shipped with no production telemetry: no archive could say how
 * often the ramp engaged or what margin the compile ran at, which is why the
 * filed 1.25/2.0 re-bracket and the pace re-price had no data to run on. These
 * pin that the counters exist, that they are internally consistent, and — the
 * part that actually matters — that they are counting the RAMP and not
 * something adjacent to it.
 */
describe("deadline telemetry — the signal is visible in compile_stats", () => {
  test("the ramp counters agree with the ramp's own anchors", async () => {
    const spec = await loadGoldenSpec("tiny_dance", "base");
    const { stats } = compileHandoff(spec, 0, { budget: 150_000, polish: false });
    const deadlineStats = stats.deadline;
    expect(deadlineStats).toBeDefined();
    const d = deadlineStats!;

    // Every compile builds pools; builds whose caller passed no margin belong
    // to neither phase, so the two phases can only under-count the total.
    expect(d.deadline_pool_builds).toBeGreaterThan(0);
    expect(d.deadline_pre_builds + d.deadline_post_builds)
      .toBeLessThanOrEqual(d.deadline_pool_builds);
    expect(d.deadline_pre_full_pressure).toBeLessThanOrEqual(d.deadline_pre_pressured);
    expect(d.deadline_pre_pressured).toBeLessThanOrEqual(d.deadline_pre_builds);

    // The engagement counters ARE the ramp: a build is counted pressured iff its
    // margin was under the no-pressure anchor, so "any pressured build" and
    // "the smallest margin is under the anchor" have to be the same statement.
    expect(d.deadline_pre_builds > 0).toBe(d.deadline_pre_margin_min !== null);
    if (d.deadline_pre_margin_min !== null) {
      expect(d.deadline_pre_pressured > 0)
        .toBe(d.deadline_pre_margin_min < DEADLINE_MARGIN_NO_PRESSURE);
      expect(d.deadline_pre_full_pressure > 0)
        .toBe(d.deadline_pre_margin_min <= DEADLINE_MARGIN_FULL_PRESSURE);
      // min <= mean, so the pair really is a distribution summary of one set.
      expect(d.deadline_pre_margin_min)
        .toBeLessThanOrEqual(d.deadline_pre_margin_sum / d.deadline_pre_builds);
    }
    expect(d.deadline_post_builds > 0).toBe(d.deadline_post_margin_min !== null);

    // THE POST SIDE. Its live pressure is 0 by the phase gate, never by the margin, so the
    // twins are computed from the margin through the same ramp — and they have to satisfy
    // the same anchor identities as the pre side, or they are measuring something else.
    expect(d.deadline_post_full_pressure).toBeLessThanOrEqual(d.deadline_post_pressured);
    expect(d.deadline_post_pressured).toBeLessThanOrEqual(d.deadline_post_builds);
    if (d.deadline_post_margin_min !== null) {
      expect(d.deadline_post_pressured > 0)
        .toBe(d.deadline_post_margin_min < DEADLINE_MARGIN_NO_PRESSURE);
      expect(d.deadline_post_full_pressure > 0)
        .toBe(d.deadline_post_margin_min <= DEADLINE_MARGIN_FULL_PRESSURE);
      expect(d.deadline_post_margin_min)
        .toBeLessThanOrEqual(d.deadline_post_margin_sum / d.deadline_post_builds);
    }
    // The counters MOVE on a real compile — the whole point of adding them is that the post
    // arm's frequency was unmeasured, and a pair of always-zero counters would measure it
    // just as badly. This spec is post-completion-dominated (it completes at ~10% of budget),
    // and the post margin gets pressed there where the pre margin never does.
    expect(d.deadline_post_builds).toBeGreaterThan(0);
    expect(d.deadline_post_pressured).toBeGreaterThan(0);
    // Every `rankedOptions` call site passes a finite margin today, so the phase split is
    // exhaustive. If this ever fails, a lane started building pools with no margin and the
    // unpaced remainder went non-zero — that is a finding, not a broken assertion.
    expect(d.deadline_pre_builds + d.deadline_post_builds).toBe(d.deadline_pool_builds);

    // The two-counters window: the estimator's target event (any terminal)
    // cannot post-date the controller's phase flip (a terminal that improved).
    expect(d.deadline_terminal_without_improvement)
      .toBeLessThanOrEqual(d.deadline_terminal_considers);
    if (d.deadline_first_improving_terminal_frame !== null) {
      expect(d.deadline_first_terminal_frame).not.toBeNull();
      expect(d.deadline_first_terminal_frame!)
        .toBeLessThanOrEqual(d.deadline_first_improving_terminal_frame);
    }
  }, 120_000);
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
