import { afterEach, describe, expect, test } from "vitest";
import { beginEnvFlagEpoch } from "../scripts/v0/env_flags.ts";
import { makeRng } from "../scripts/lib/rng.ts";
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
import { deadlinePressure } from "../scripts/v0/optimizer/deadline.ts";
import {
  compileLegacyHandoff,
  handoffCandidatePool,
  postCompletionPhaseWeight,
  redrawFirstHopOnEmpty,
  setHandoffDeadlineProbeHook,
  setHandoffRolloutProbeHook,
} from "../scripts/v0/optimizer/legacy_handoff.ts";
import {
  getCandidatesSorted,
  isRolloutAimSuppressed,
  makeRootNode,
  setNormalPoolSnapshotHook,
} from "../scripts/v0/optimizer/node.ts";
import type { SpecContext } from "../scripts/v0/optimizer/sample.ts";
import { CALIB, secToFrame, type Gap, type Spec } from "../scripts/v0/types.ts";

/**
 * The composable base-shape override (`LR_FWD_EVAL_BASE`) and the study-only
 * env gates that ride with it.
 *
 * Three properties, in the order they matter:
 *  1. production is byte-identical — the knob unset is exactly today's compiler;
 *  2. the base override COMPOSES — the adaptive arms still fire, at their own
 *     shapes, on the gaps they own (this is the thing `LR_FWD_EVAL` cannot do);
 *  3. `LR_FWD_EVAL` keeps its old semantics — full override, arms off — because
 *     every study arm ever run under it is only readable if that stays true.
 *
 * Plus the refusal paths of every study-only knob: an out-of-range value must
 * throw, never clamp. A study that silently ran at the default because its env
 * said `six` is worse than no study.
 */

const SPEC_NAME = "dense_sprint";
/** Big enough that `impactBestForwardEvalConfig` fires — its one budget
 *  coordinate is traversal slack (`B / D(spec)` past 2.5), saturated on this
 *  spec from ~300k — and small enough to run in a test. Before 2026-08-04 a
 *  raw-budget ramp (offender d3, 300k/200k) was the binding gate here and is
 *  why the constant is 400k; it was removed, the slack coordinate keeps the arm
 *  firing at this budget, so the constant stays. */
const BUDGET = 400_000;

type Shape = { variant: string; depth: number; branch: number; firstBranch: number };

let cachedSpec: Spec | null = null;
async function spec(): Promise<Spec> {
  if (cachedSpec === null) cachedSpec = await loadGoldenSpec(SPEC_NAME, "base");
  return cachedSpec;
}

/** Run one compile with `env` applied, restoring the environment afterwards. */
function withEnv<T>(env: Record<string, string | undefined>, run: () => T): T {
  const saved = new Map<string, string | undefined>();
  for (const [k, v] of Object.entries(env)) {
    saved.set(k, process.env[k]);
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  // Compile-scoped readers cache per epoch; a compile opens its own, but the
  // direct-call tests below do not.
  beginEnvFlagEpoch();
  try {
    return run();
  } finally {
    for (const [k, v] of saved) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    beginEnvFlagEpoch();
  }
}

/** Compiles are ~6 s each; several tests want the same one. Keyed on the env
 *  the compile ran under, which is the only thing that varies here. */
const compileMemo = new Map<string, { track: string; shapes: Map<string, number> }>();

function compiledUnder(
  env: Record<string, string | undefined>,
  s: Spec,
): { track: string; shapes: Map<string, number> } {
  const key = JSON.stringify(Object.entries(env).sort());
  const hit = compileMemo.get(key);
  if (hit !== undefined) return hit;
  const result = withEnv(env, () => compileWithShapes(s));
  compileMemo.set(key, result);
  return result;
}

/** Compile once and return the track bytes plus the rollout shape histogram. */
function compileWithShapes(s: Spec, budget = BUDGET): { track: string; shapes: Map<string, number> } {
  const shapes = new Map<string, number>();
  setHandoffRolloutProbeHook((record) => {
    // Start-selection rollouts run their own policy (LR_START_EVAL) and are not
    // part of the candidate ranker's shape question.
    if (record.source === "start") return;
    const key = shapeKey(record);
    shapes.set(key, (shapes.get(key) ?? 0) + 1);
  });
  try {
    const { track } = compileLegacyHandoff(s, 0, { budget });
    return { track: JSON.stringify(track), shapes };
  } finally {
    setHandoffRolloutProbeHook(null);
  }
}

function shapeKey(shape: Shape): string {
  return `${shape.variant}:${shape.depth}:${shape.branch}` +
    (shape.firstBranch > 1 ? `+fb${shape.firstBranch}` : "");
}

afterEach(() => {
  setHandoffRolloutProbeHook(null);
  setHandoffDeadlineProbeHook(null);
  setNormalPoolSnapshotHook(null);
});

describe("LR_FWD_EVAL_BASE — the composable base-shape override", () => {
  test("unset is byte-identical to the default shape written out explicitly", async () => {
    const s = await spec();
    const base = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: undefined }, s);
    const explicit = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: "greedy:1" }, s);
    const empty = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: "" }, s);

    expect(explicit.track).toBe(base.track);
    expect(empty.track).toBe(base.track);
    // Non-vacuity: the default compile really did run the adaptive layer — the
    // impact arm's own depth-2 shape beside the depth-1 base.
    expect(base.shapes.get("greedy:2:1+fb3")).toBeGreaterThan(0);
    expect(base.shapes.get("greedy:1:1")).toBeGreaterThan(0);
  }, 300_000);

  test("a moved base composes: the impact arm still fires, at its OWN shape", async () => {
    const s = await spec();
    const composed = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: "best:1:3" }, s);

    // The base moved on the gaps nobody owns...
    expect(composed.shapes.get("best:1:3")).toBeGreaterThan(0);
    // ...and the impact widening still runs its own greedy:2:1+fb3 on the gaps
    // it owns. That is the whole point of the knob: `LR_FWD_EVAL` cannot do it.
    expect(composed.shapes.get("greedy:2:1+fb3")).toBeGreaterThan(0);
    // The arm's shape is PINNED, not inherited: no `best:1:3+fb3` exists, which
    // would have been the silently-dropped widening (`forwardArcValue`
    // dispatches firstBranch on variant === "greedy" alone).
    expect([...composed.shapes.keys()].filter((k) => k.startsWith("best") && k.includes("fb")))
      .toEqual([]);
  }, 300_000);

  test("LR_FWD_EVAL keeps its full-override semantics: the adaptive arms are OFF", async () => {
    const s = await spec();
    const full = compiledUnder({ LR_FWD_EVAL: "best:1:3", LR_FWD_EVAL_BASE: undefined }, s);

    expect(full.shapes.get("best:1:3")).toBeGreaterThan(0);
    expect([...full.shapes.keys()]).toEqual(["best:1:3"]);
  }, 300_000);

  test("LR_FWD_EVAL wins when both are set, and the two arms differ", async () => {
    const s = await spec();
    const full = compiledUnder({ LR_FWD_EVAL: "best:1:3", LR_FWD_EVAL_BASE: "greedy:2" }, s);
    const composed = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: "best:1:3" }, s);

    expect([...full.shapes.keys()]).toEqual(["best:1:3"]);
    // Same nominal shape, different regime — so the two must NOT agree, or the
    // composability enabler would be measuring nothing.
    expect(composed.track).not.toBe(full.track);
  }, 300_000);

  test("an unparsable base falls back to the knob default rather than disabling the ranker", async () => {
    const s = await spec();
    const warnings: string[] = [];
    const realWarn = console.warn;
    console.warn = (msg: string) => void warnings.push(String(msg));
    let typo: { track: string; shapes: Map<string, number> };
    try {
      typo = withEnv({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: "bestest:1:3" }, () => compileWithShapes(s));
    } finally {
      console.warn = realWarn;
    }
    const base = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: undefined }, s);

    expect(warnings.join("\n")).toContain("LR_FWD_EVAL_BASE");
    expect(typo.track).toBe(base.track);
  }, 300_000);
});

describe("scoped aim suppression for wide base shapes", () => {
  /** Watch the aim-suppression flag at every fresh pool build of a compile. */
  function suppressionByWidth(s: Spec, budget: number): Map<number, Set<boolean>> {
    const seen = new Map<number, Set<boolean>>();
    setNormalPoolSnapshotHook(({ nCand }) => {
      const at = seen.get(nCand) ?? new Set<boolean>();
      at.add(isRolloutAimSuppressed());
      seen.set(nCand, at);
    });
    try {
      compileLegacyHandoff(s, 0, { budget });
    } finally {
      setNormalPoolSnapshotHook(null);
    }
    return seen;
  }

  test("engages at base width > 1 and is never touched at width 1", async () => {
    const s = await spec();
    const wide = withEnv(
      { LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: "best:1:3" },
      () => suppressionByWidth(s, BUDGET),
    );
    const narrow = withEnv(
      { LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: undefined },
      () => suppressionByWidth(s, BUDGET),
    );

    // The rollout's own pool builds under a best:1:3 base are the nCand = 3
    // ones (the top-level pool is built at the breadth law's much larger nCand).
    expect(wide.get(3)).toBeDefined();
    expect([...(wide.get(3) as Set<boolean>)]).toEqual([true]);
    // Under the default base the rollout draws one candidate and the flag is
    // left alone — node.ts's own `nCand > 1` gate already keeps the lane out,
    // which is why C === D was byte-identical in the Phase 3 decomposition.
    expect(narrow.get(1)).toBeDefined();
    expect([...(narrow.get(1) as Set<boolean>)]).toEqual([false]);
  }, 300_000);
});

describe("study-only env gates refuse rather than clamp", () => {
  test("LR_STUDY_HANDOFF_POOL", () => {
    expect(withEnv({ LR_STUDY_HANDOFF_POOL: undefined }, () => handoffCandidatePool())).toBe(5);
    expect(withEnv({ LR_STUDY_HANDOFF_POOL: "" }, () => handoffCandidatePool())).toBe(5);
    expect(withEnv({ LR_STUDY_HANDOFF_POOL: "6" }, () => handoffCandidatePool())).toBe(6);
    expect(withEnv({ LR_STUDY_HANDOFF_POOL: "3" }, () => handoffCandidatePool())).toBe(3);
    expect(withEnv({ LR_STUDY_HANDOFF_POOL: "8" }, () => handoffCandidatePool())).toBe(8);
    // Surrounding whitespace is tolerated (env values pick it up); anything
    // that is not an integer in range is refused, never clamped.
    expect(withEnv({ LR_STUDY_HANDOFF_POOL: " 6 " }, () => handoffCandidatePool())).toBe(6);
    for (const bad of ["2", "9", "0", "-1", "six", "5.5", "5x"]) {
      expect(() => withEnv({ LR_STUDY_HANDOFF_POOL: bad }, () => handoffCandidatePool()))
        .toThrow(/LR_STUDY_HANDOFF_POOL must be an integer in \[3, 8\]/);
    }
  });

  test("LR_STUDY_ROLLOUT_REDRAW re-draws at width + dose and refuses out of range", async () => {
    const { s, gaps, ctx } = await redrawFixture();
    const fingerprint = (pool: readonly { cost: number; lines: unknown[] }[]): string =>
      `${pool.length}#` + pool.map((c) => `${c.cost.toFixed(6)}:${c.lines.length}`).join("|");

    const freshRoot = () => {
      resetPerCompileState();
      setAimCompileBudgetFrames(750_000);
      return makeRootNode(makeBaseEngine(resolveStartState(s)), gaps.length);
    };

    for (const dose of [1, 3]) {
      const node = freshRoot();
      expect(getCandidatesSorted(node, gaps, ctx, 19, 0)).toHaveLength(0);
      const widened = withEnv(
        { LR_STUDY_ROLLOUT_REDRAW: dose === 1 ? undefined : String(dose) },
        () => redrawFirstHopOnEmpty(node, gaps, ctx, 19, 0),
      );
      const reference = getCandidatesSorted(freshRoot(), gaps, ctx, 19, dose);
      expect(fingerprint(widened)).toBe(fingerprint(reference));
    }

    // Dose 0 is the pre-redraw world: no draw, and no counter traffic either.
    const zeroNode = freshRoot();
    getCandidatesSorted(zeroNode, gaps, ctx, 19, 0);
    expect(withEnv({ LR_STUDY_ROLLOUT_REDRAW: "0" }, () =>
      redrawFirstHopOnEmpty(zeroNode, gaps, ctx, 19, 0))).toHaveLength(0);

    for (const bad of ["8", "-1", "one", "1.5"]) {
      const node = freshRoot();
      expect(() => withEnv({ LR_STUDY_ROLLOUT_REDRAW: bad }, () =>
        redrawFirstHopOnEmpty(node, gaps, ctx, 19, 0)))
        .toThrow(/LR_STUDY_ROLLOUT_REDRAW must be an integer in \[0, 7\]/);
    }
  }, 300_000);

  test("LR_STUDY_IMPACT_ASK_START, LR_STUDY_IMPACT_BRANCH and LR_STUDY_IMPACT_DEPTH", async () => {
    const s = await spec();
    for (const bad of ["-0.1", "1.1", "high"]) {
      expect(() => withEnv({ LR_STUDY_IMPACT_ASK_START: bad }, () =>
        compileLegacyHandoff(s, 0, { budget: BUDGET })))
        .toThrow(/LR_STUDY_IMPACT_ASK_START must be a finite number in \[0, 1\]/);
    }
    for (const bad of ["0", "9", "three", "2.5"]) {
      expect(() => withEnv({ LR_STUDY_IMPACT_BRANCH: bad }, () =>
        compileLegacyHandoff(s, 0, { budget: BUDGET })))
        .toThrow(/LR_STUDY_IMPACT_BRANCH must be an integer in \[1, 8\]/);
    }
    // Depth is closed at 2 on purpose: 3 was measured negative on 5 of 6
    // sources, so the knob refuses it rather than making the deeper hop one
    // typo away.
    for (const bad of ["0", "3", "two", "1.5", "-1"]) {
      expect(() => withEnv({ LR_STUDY_IMPACT_DEPTH: bad }, () =>
        compileLegacyHandoff(s, 0, { budget: BUDGET })))
        .toThrow(/LR_STUDY_IMPACT_DEPTH must be an integer in \[1, 2\]/);
    }
  }, 300_000);

  test("LR_STUDY_IMPACT_DEPTH moves the arm's own depth, and only the arm's", async () => {
    const s = await spec();
    const one = compiledUnder({ LR_STUDY_IMPACT_DEPTH: "1" }, s);
    const two = compiledUnder({ LR_STUDY_IMPACT_DEPTH: "2" }, s);
    const base = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: undefined }, s);

    // 2 is the pinned shape: setting it explicitly is the production compile.
    expect(two.track).toBe(base.track);
    // 1 collapses the arm to a single hop while KEEPING its widening — the
    // point of the probe is the second hop alone, not the width.
    expect(one.shapes.get("greedy:1:1+fb3")).toBeGreaterThan(0);
    expect(one.shapes.has("greedy:2:1+fb3")).toBe(false);
    expect(base.shapes.get("greedy:2:1+fb3")).toBeGreaterThan(0);
    // The depth-1 production BASE is untouched — the arm is the only shape that
    // moved, so `greedy:1:1` (base) and `greedy:1:1+fb3` (arm) coexist.
    expect(one.shapes.get("greedy:1:1")).toBeGreaterThan(0);
    expect(one.track).not.toBe(base.track);
  }, 300_000);

  test("LR_STUDY_IMPACT_BRANCH moves the widening it names, and only that", async () => {
    const s = await spec();
    const two = compiledUnder({ LR_STUDY_IMPACT_BRANCH: "2" }, s);
    const base = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: undefined }, s);

    expect(two.shapes.get("greedy:2:1+fb2")).toBeGreaterThan(0);
    expect(two.shapes.has("greedy:2:1+fb3")).toBe(false);
    expect(base.shapes.get("greedy:2:1+fb3")).toBeGreaterThan(0);
    // The GATE has not moved, so the arm still fires at the same order of
    // magnitude; only the width it spends there is smaller. Not an equality,
    // and not a tight band either: the compiles diverge at the first rank the
    // narrower rollout decides differently, and under the depth-1 production
    // base (DEFAULT_FWD_EVAL_BASE) that divergence is larger than it was under
    // greedy:2 — the measured ratio moved from ~1.0 to ~0.38 when the base
    // changed, with the gate untouched. What must hold is that the arm is
    // neither silenced nor exploded by the study knob.
    const ratio = (two.shapes.get("greedy:2:1+fb2") as number) /
      (base.shapes.get("greedy:2:1+fb3") as number);
    expect(ratio).toBeGreaterThan(0.2);
    expect(ratio).toBeLessThan(5);
  }, 300_000);

  test("LR_STUDY_POST_DEADLINE_W / _SCOPE refuse rather than clamp", () => {
    expect(withEnv({ LR_STUDY_POST_DEADLINE_W: undefined }, postCompletionPhaseWeight)).toBe(0);
    expect(withEnv({ LR_STUDY_POST_DEADLINE_W: "" }, postCompletionPhaseWeight)).toBe(0);
    expect(withEnv({ LR_STUDY_POST_DEADLINE_W: "0" }, postCompletionPhaseWeight)).toBe(0);
    expect(withEnv({ LR_STUDY_POST_DEADLINE_W: "1" }, postCompletionPhaseWeight)).toBe(1);
    expect(withEnv({ LR_STUDY_POST_DEADLINE_W: "0.25" }, postCompletionPhaseWeight)).toBe(0.25);
    expect(withEnv({ LR_STUDY_POST_DEADLINE_W: " 0.5 " }, postCompletionPhaseWeight)).toBe(0.5);
    for (const bad of ["-0.1", "1.1", "half", "NaN", "1e400", " "]) {
      expect(() => withEnv({ LR_STUDY_POST_DEADLINE_W: bad }, postCompletionPhaseWeight))
        .toThrow(/LR_STUDY_POST_DEADLINE_W must be a finite number in \[0, 1\]/);
    }
    // The scope knob is only consulted once a weight is set — an out-of-range
    // scope with no weight is silently irrelevant, which is the right shape: the
    // arm is one knob, the scope is its modifier.
    expect(withEnv({ LR_STUDY_POST_DEADLINE_SCOPE: "sideways" }, postCompletionPhaseWeight)).toBe(0);
    expect(withEnv(
      { LR_STUDY_POST_DEADLINE_W: "1", LR_STUDY_POST_DEADLINE_SCOPE: "nonrepair" },
      postCompletionPhaseWeight,
    )).toBe(1);
    expect(withEnv(
      { LR_STUDY_POST_DEADLINE_W: "1", LR_STUDY_POST_DEADLINE_SCOPE: " all " },
      postCompletionPhaseWeight,
    )).toBe(1);
    for (const bad of ["repair", "ALL", "none", "1"]) {
      expect(() => withEnv(
        { LR_STUDY_POST_DEADLINE_W: "1", LR_STUDY_POST_DEADLINE_SCOPE: bad },
        postCompletionPhaseWeight,
      )).toThrow(/LR_STUDY_POST_DEADLINE_SCOPE must be "all" or "nonrepair"/);
    }
  });

  test("the post-completion phase weight is a magnitude on the head ramp, and off by default", async () => {
    const s = await spec();
    /** One compile, returning every deadline read the pool builds made. */
    const readsUnder = (env: Record<string, string | undefined>) => {
      const reads: {
        post: boolean;
        repair: boolean;
        margin: number;
        pressure: number;
        narrowed: boolean;
      }[] = [];
      const track = withEnv(env, () => {
        setHandoffDeadlineProbeHook((r) => {
          reads.push({
            post: r.hasCompletion,
            repair: r.repairLane,
            margin: r.margin,
            pressure: r.pressure,
            narrowed: r.forwardEvalTop < r.poolSize,
          });
        });
        try {
          return JSON.stringify(compileLegacyHandoff(s, 0, { budget: BUDGET }).track);
        } finally {
          setHandoffDeadlineProbeHook(null);
        }
      });
      return { reads, track };
    };

    const off = readsUnder({ LR_STUDY_POST_DEADLINE_W: undefined });
    const full = readsUnder({ LR_STUDY_POST_DEADLINE_W: "1" });
    const half = readsUnder({ LR_STUDY_POST_DEADLINE_W: "0.5" });
    const nonrepair = readsUnder({
      LR_STUDY_POST_DEADLINE_W: "1",
      LR_STUDY_POST_DEADLINE_SCOPE: "nonrepair",
    });

    // Non-vacuity: the fixture really does run post-completion pool builds at a
    // margin the ramp responds to, and they are overwhelmingly repair-lane ones
    // (measured 93.6% of post-completion builds across 20 canonical 750k cells).
    const postOff = off.reads.filter((r) => r.post);
    expect(postOff.length).toBeGreaterThan(20);
    expect(postOff.some((r) => r.margin < 2)).toBe(true);
    expect(postOff.filter((r) => r.repair).length / postOff.length).toBeGreaterThan(0.5);

    // DEFAULT = the Phase-1a boundary: the ramp is off after first completion no
    // matter what the margin says, and the head is never narrowed there.
    expect(postOff.every((r) => r.pressure === 0)).toBe(true);
    expect(postOff.every((r) => !r.narrowed)).toBe(true);
    // ...and it is untouched BEFORE first completion, in every arm.
    for (const arm of [off, full, half, nonrepair]) {
      expect(arm.reads.filter((r) => !r.post).every((r) => r.pressure === deadlinePressure(r.margin)))
        .toBe(true);
    }

    // WEIGHT 1 = the original ungated form: post-completion pressure is the raw
    // ramp, and it actually narrows heads.
    const postFull = full.reads.filter((r) => r.post);
    expect(postFull.every((r) => r.pressure === deadlinePressure(r.margin))).toBe(true);
    expect(postFull.some((r) => r.pressure > 0)).toBe(true);
    expect(postFull.some((r) => r.narrowed)).toBe(true);
    // The intervention is the narrowed candidate head above. Register output
    // equality is a possible outcome, not evidence that the arm was inactive.

    // WEIGHT 0.5 = a magnitude, not a mode: same ramp, halved.
    const postHalf = half.reads.filter((r) => r.post);
    expect(postHalf.every((r) => r.pressure === 0.5 * deadlinePressure(r.margin))).toBe(true);
    expect(postHalf.some((r) => r.pressure > 0)).toBe(true);

    // SCOPE nonrepair leaves every repair-episode build unweighted — the
    // repair-ROI conflict the scope exists to hold out.
    expect(nonrepair.reads.filter((r) => r.post && r.repair).every((r) => r.pressure === 0))
      .toBe(true);
    expect(nonrepair.reads.filter((r) => r.post && !r.repair)
      .every((r) => r.pressure === deadlinePressure(r.margin))).toBe(true);
  }, 300_000);
});

let redrawCache: { s: Spec; gaps: Gap[]; ctx: SpecContext } | null = null;
async function redrawFixture(): Promise<{ s: Spec; gaps: Gap[]; ctx: SpecContext }> {
  if (redrawCache !== null) return redrawCache;
  const s = await spec();
  validateSpec(s);
  const durationFrames = secToFrame(s.duration);
  const allContactFrames = s.contacts.map((c) => secToFrame(c.t)).sort((a, b) => a - b);
  const gaps = sliceTimeline(allContactFrames, durationFrames);
  const targetRng = makeRng(0);
  for (const gap of gaps) {
    gap.targets = sampleGapTargets(effectiveAxes(gap, s), CALIB.SIGMA, targetRng);
  }
  redrawCache = { s, gaps, ctx: { allContactFrames, durationFrames, gaps } };
  return redrawCache;
}
