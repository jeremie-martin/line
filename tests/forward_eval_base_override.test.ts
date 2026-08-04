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
import {
  compileHandoff,
  handoffCandidatePool,
  redrawFirstHopOnEmpty,
  setHandoffRolloutProbeHook,
} from "../scripts/v0/optimizer/handoff.ts";
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
/** Big enough that `impactBestForwardEvalConfig`'s budget ramp is open (it is
 *  0 below 300k and saturates at 500k) and small enough to run in a test. */
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
    const { track } = compileHandoff(s, 0, { budget });
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
  setNormalPoolSnapshotHook(null);
});

describe("LR_FWD_EVAL_BASE — the composable base-shape override", () => {
  test("unset is byte-identical to the default shape written out explicitly", async () => {
    const s = await spec();
    const base = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: undefined }, s);
    const explicit = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: "greedy:2" }, s);
    const empty = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: "" }, s);

    expect(explicit.track).toBe(base.track);
    expect(empty.track).toBe(base.track);
    // Non-vacuity: the default compile really did run the adaptive layer.
    expect(base.shapes.get("greedy:2:1+fb3")).toBeGreaterThan(0);
    expect(base.shapes.get("greedy:2:1")).toBeGreaterThan(0);
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
      compileHandoff(s, 0, { budget });
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

  test("LR_STUDY_IMPACT_ASK_START and LR_STUDY_IMPACT_BRANCH", async () => {
    const s = await spec();
    for (const bad of ["-0.1", "1.1", "high"]) {
      expect(() => withEnv({ LR_STUDY_IMPACT_ASK_START: bad }, () =>
        compileHandoff(s, 0, { budget: BUDGET })))
        .toThrow(/LR_STUDY_IMPACT_ASK_START must be a finite number in \[0, 1\]/);
    }
    for (const bad of ["0", "9", "three", "2.5"]) {
      expect(() => withEnv({ LR_STUDY_IMPACT_BRANCH: bad }, () =>
        compileHandoff(s, 0, { budget: BUDGET })))
        .toThrow(/LR_STUDY_IMPACT_BRANCH must be an integer in \[1, 8\]/);
    }
  }, 300_000);

  test("LR_STUDY_IMPACT_BRANCH moves the widening it names, and only that", async () => {
    const s = await spec();
    const two = compiledUnder({ LR_STUDY_IMPACT_BRANCH: "2" }, s);
    const base = compiledUnder({ LR_FWD_EVAL: undefined, LR_FWD_EVAL_BASE: undefined }, s);

    expect(two.shapes.get("greedy:2:1+fb2")).toBeGreaterThan(0);
    expect(two.shapes.has("greedy:2:1+fb3")).toBe(false);
    expect(base.shapes.get("greedy:2:1+fb3")).toBeGreaterThan(0);
    // The GATE has not moved, so the arm still owns a comparable slice of the
    // traffic; only the width it spends there is smaller. (Not an equality: a
    // narrower rollout is a different search, so the call counts drift.)
    const ratio = (two.shapes.get("greedy:2:1+fb2") as number) /
      (base.shapes.get("greedy:2:1+fb3") as number);
    expect(ratio).toBeGreaterThan(0.7);
    expect(ratio).toBeLessThan(1.4);
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
