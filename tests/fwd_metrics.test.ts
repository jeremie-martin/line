import { gzipSync } from "node:zlib";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, test } from "vitest";
import {
  aggregate,
  extractCells,
  rate,
  readInput,
  render,
  type FwdCell,
} from "../scripts/benchmark/fwd_metrics.ts";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** A compile's `fwd_eval` block, defaulted to zeros so a test names only what
 *  it cares about — exactly how the compiler's own snapshot behaves. */
function fwdBlock(overrides: Record<string, number> = {}): Record<string, number> {
  return {
    fwd_eval_frames_charged: 0,
    fwd_eval_calls: 0,
    start_eval_frames_charged: 0,
    fwd_rollout_no_candidate: 0,
    fwd_rollout_redraws: 0,
    fwd_rollout_redraw_refuted: 0,
    fwd_pools: 0,
    fwd_top1_agree: 0,
    fwd_rank_of_quality_top1_sum: 0,
    fwd_quality_rank_of_winner_sum: 0,
    fwd_disagree_value_gap_sum: 0,
    fwd_disagree_count: 0,
    ...overrides,
  };
}

function deadlineBlock(overrides: Record<string, number> = {}): Record<string, number> {
  return {
    deadline_pool_builds: 0,
    deadline_pre_builds: 0,
    deadline_pre_pressured: 0,
    deadline_pre_full_pressure: 0,
    deadline_pre_margin_sum: 0,
    deadline_post_builds: 0,
    deadline_post_pressured: 0,
    deadline_post_full_pressure: 0,
    deadline_post_margin_sum: 0,
    deadline_terminal_considers: 0,
    deadline_terminal_without_improvement: 0,
    ...overrides,
  };
}

function statsOf(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    sim_frames: 100_000,
    search_nodes_expanded: 100,
    first_completion_frame: 50_000,
    handoff_requested_normal_proposals_per_ranked_option_call_mean: 27,
    fwd_eval: fwdBlock(),
    deadline: deadlineBlock(),
    ...overrides,
  };
}

const scratch = mkdtempSync(join(tmpdir(), "fwd-metrics-test-"));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));

function writeJson(name: string, payload: unknown, gzip = false): string {
  const path = join(scratch, name);
  const text = JSON.stringify(payload);
  writeFileSync(path, gzip ? gzipSync(Buffer.from(text, "utf8")) : text);
  return path;
}

// ---------------------------------------------------------------------------
// rate(): the 0/0 contract
// ---------------------------------------------------------------------------

describe("rate", () => {
  test("forms the ratio when the denominator is positive", () => {
    const r = rate(3, 12, "why");
    expect(r.value).toBe(0.25);
    expect(r.note).toBeNull();
    expect([r.num, r.den]).toEqual([3, 12]);
  });

  test("0/0 is null with the reason, never NaN", () => {
    const r = rate(0, 0, "no redraws");
    expect(r.value).toBeNull();
    expect(r.note).toBe("no redraws");
    expect(Number.isNaN(r.value as unknown as number)).toBe(false);
  });

  test("a non-finite input degrades to the explained-null form", () => {
    expect(rate(Number.NaN, 5, "why").value).toBeNull();
    expect(rate(5, Number.POSITIVE_INFINITY, "why").value).toBeNull();
    expect(rate(1, -1, "why").value).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// aggregate(): the math
// ---------------------------------------------------------------------------

function cell(overrides: Partial<FwdCell> = {}): FwdCell {
  return {
    sourceId: "src",
    budget: 250_000,
    seed: 0,
    simFrames: 100_000,
    nodesExpanded: 100,
    firstCompletionFrame: 50_000,
    nCandMean: 27,
    fwd: {
      framesCharged: 0,
      calls: 0,
      startFramesCharged: 0,
      noCandidate: 0,
      redraws: 0,
      redrawRefuted: 0,
      pools: 0,
      top1Agree: 0,
      qualityRankOfWinnerSum: 0,
      rankOfQualityTop1Sum: 0,
      disagreeValueGapSum: 0,
      disagreeCount: 0,
    },
    deadline: null,
    ...overrides,
  };
}

describe("aggregate", () => {
  test("rates are ratios of sums, not means of ratios", () => {
    // Two very unequal compiles: a mean of ratios would read 0.30, a ratio of
    // sums reads 0.11 — the second is the honest "where did the frames go".
    const cells = [
      cell({
        simFrames: 1_000,
        fwd: { ...cell().fwd!, framesCharged: 500, startFramesCharged: 0, calls: 10 },
      }),
      cell({
        simFrames: 99_000,
        fwd: { ...cell().fwd!, framesCharged: 10_000, startFramesCharged: 0, calls: 200 },
      }),
    ];
    const { pooled } = aggregate(cells);
    expect(pooled.m1RolloutShare.value).toBeCloseTo(10_500 / 100_000, 12);
    expect(pooled.m2FramesPerRollout.value).toBeCloseTo(10_500 / 210, 12);
  });

  test("start-eval frames count towards M1 but not towards M2", () => {
    const cells = [
      cell({
        simFrames: 1_000,
        fwd: { ...cell().fwd!, framesCharged: 100, startFramesCharged: 50, calls: 4 },
      }),
    ];
    const { pooled } = aggregate(cells);
    expect(pooled.m1RolloutShare.value).toBeCloseTo(0.15, 12);
    expect(pooled.m2FramesPerRollout.value).toBeCloseTo(25, 12);
  });

  test("M3 pools numerators and denominators across cells (the thermometer)", () => {
    const cells = [
      cell({ fwd: { ...cell().fwd!, redraws: 100, redrawRefuted: 10, calls: 1_000 } }),
      cell({ seed: 1, fwd: { ...cell().fwd!, redraws: 300, redrawRefuted: 90, calls: 1_000 } }),
    ];
    const { pooled } = aggregate(cells);
    expect(pooled.m3RedrawRefutation.value).toBeCloseTo(100 / 400, 12);
    expect([pooled.m3RedrawRefutation.num, pooled.m3RedrawRefutation.den]).toEqual([100, 400]);
    expect(pooled.m4RedrawTrigger.value).toBeCloseTo(400 / 2_000, 12);
  });

  test("groups split on (source, budget) and pool into one POOLED row", () => {
    const cells = [
      cell({ sourceId: "a", budget: 250_000, fwd: { ...cell().fwd!, calls: 10, redraws: 4, redrawRefuted: 1 } }),
      cell({ sourceId: "a", budget: 750_000, fwd: { ...cell().fwd!, calls: 10, redraws: 4, redrawRefuted: 3 } }),
      cell({ sourceId: "b", budget: 250_000, fwd: { ...cell().fwd!, calls: 10, redraws: 2, redrawRefuted: 0 } }),
    ];
    const { groups, pooled } = aggregate(cells);
    expect(groups.map((g) => `${g.sourceId}@${g.budget}`)).toEqual([
      "a@250000",
      "b@250000",
      "a@750000",
    ]);
    expect(pooled.cells).toBe(3);
    expect(pooled.m3RedrawRefutation.value).toBeCloseTo(4 / 10, 12);
    // A pooled row spanning two budgets reports no single budget.
    expect(pooled.budget).toBeNull();
    expect(pooled.budgets).toEqual([250_000, 750_000]);
  });

  test("a single-budget pooled row keeps its budget", () => {
    const { pooled } = aggregate([cell(), cell({ seed: 1 })]);
    expect(pooled.budget).toBe(250_000);
    expect(pooled.budgets).toEqual([250_000]);
  });

  test("M8 fc/B sums only over cells that completed and counts the rest", () => {
    const cells = [
      cell({ budget: 100_000, firstCompletionFrame: 40_000 }),
      cell({ budget: 100_000, firstCompletionFrame: 60_000, seed: 1 }),
      cell({ budget: 100_000, firstCompletionFrame: null, seed: 2 }),
    ];
    const { pooled } = aggregate(cells);
    expect(pooled.m8FirstCompletionOverBudget.value).toBeCloseTo(100_000 / 200_000, 12);
    expect(pooled.cellsWithoutCompletion).toBe(1);
  });

  test("M8 nCand is a mean over the compiles that reported one", () => {
    const { pooled } = aggregate([
      cell({ nCandMean: 27 }),
      cell({ nCandMean: 81, seed: 1 }),
      cell({ nCandMean: null, seed: 2 }),
    ]);
    expect(pooled.m8NCandMean.value).toBeCloseTo(54, 12);
  });
});

// ---------------------------------------------------------------------------
// The 0/0 and missing-field paths
// ---------------------------------------------------------------------------

describe("explained nulls", () => {
  test("a shape that never dead-ends reads M3 as 0/0, not 0%", () => {
    const { pooled } = aggregate([cell({ fwd: { ...cell().fwd!, calls: 500 } })]);
    expect(pooled.m3RedrawRefutation.value).toBeNull();
    expect(pooled.m3RedrawRefutation.note).toMatch(/0\/0/);
    // ...while the traffic metric it must be read with is a real 0.
    expect(pooled.m4RedrawTrigger.value).toBe(0);
  });

  test("the agreement family is null (not zero) when the instrument is off", () => {
    const { pooled } = aggregate([cell({ fwd: { ...cell().fwd!, calls: 500 } })]);
    for (const metric of [
      pooled.m5Top1Agreement,
      pooled.m5WinnerQualityRank,
      pooled.m6DisagreementValueGap,
      pooled.m7DecisionsPerKiloframe,
    ]) {
      expect(metric.value).toBeNull();
      expect(metric.note).toMatch(/LR_FWD_EVAL_AGREEMENT/);
    }
  });

  test("with the instrument on, a pool with no disagreements says so", () => {
    const { pooled } = aggregate([
      cell({ fwd: { ...cell().fwd!, calls: 500, pools: 40, top1Agree: 40 } }),
    ]);
    expect(pooled.m5Top1Agreement.value).toBe(1);
    expect(pooled.m6DisagreementValueGap.value).toBeNull();
    expect(pooled.m6DisagreementValueGap.note).toMatch(/no disagreeing pools/);
    expect(pooled.m7DecisionsPerKiloframe.value).toBe(0);
  });

  test("cells with no fwd_eval block name that as the reason", () => {
    const { pooled } = aggregate([cell({ fwd: null }), cell({ fwd: null, seed: 1 })]);
    expect(pooled.cellsWithoutFwd).toBe(2);
    expect(pooled.m1RolloutShare.value).toBeNull();
    expect(pooled.m1RolloutShare.note).toMatch(/no fwd_eval counters/);
    expect(pooled.m3RedrawRefutation.note).toMatch(/no fwd_eval counters/);
  });

  test("cells with no deadline block name that as the reason", () => {
    const { pooled } = aggregate([cell()]);
    expect(pooled.cellsWithoutDeadline).toBe(1);
    expect(pooled.deadlinePreMarginMean.value).toBeNull();
    expect(pooled.deadlinePreMarginMean.note).toMatch(/no deadline counters/);
  });

  test("the deadline companion divides by the right build counts", () => {
    const { pooled } = aggregate([
      cell({
        deadline: {
          poolBuilds: 300,
          preBuilds: 100,
          prePressured: 20,
          preFullPressure: 1,
          preMarginSum: 350,
          postBuilds: 200,
          postPressured: 80,
          postFullPressure: 36,
          postMarginSum: 2_000,
          terminalConsiders: 87,
          terminalWithoutImprovement: 86,
        },
      }),
    ]);
    expect(pooled.deadlinePrePressuredShare.value).toBeCloseTo(0.2, 12);
    expect(pooled.deadlinePreFullShare.value).toBeCloseTo(0.01, 12);
    expect(pooled.deadlinePreMarginMean.value).toBeCloseTo(3.5, 12);
    expect(pooled.deadlinePostMarginMean.value).toBeCloseTo(10, 12);
    // The post twins are counterfactual (the phase gate zeroes the live pressure there), so
    // they are denominated in POST builds and read directly against the pre pair above.
    expect(pooled.deadlinePostPressuredShare.value).toBeCloseTo(0.4, 12);
    expect(pooled.deadlinePostFullShare.value).toBeCloseTo(0.18, 12);
    expect(pooled.deadlineTerminalWithoutImprovement.value).toBeCloseTo(86 / 87, 12);
  });

  test("the rendered table never prints NaN and explains every n/a", () => {
    const { groups, pooled } = aggregate([cell({ fwd: null })]);
    const text = render("in.json", "stats-sidecar", 1, 0, groups, pooled, false);
    expect(text).not.toMatch(/NaN/);
    expect(text).toMatch(/n\/a/);
    expect(text).toMatch(/no fwd_eval counters/);
    // The anti-gaming contract travels with the numbers.
    expect(text).toMatch(/ONLY promotion metric/);
    expect(text).toMatch(/NOT monotone/);
    expect(text).toMatch(/NO good direction/);
  });
});

// ---------------------------------------------------------------------------
// Input readers
// ---------------------------------------------------------------------------

describe("extractCells", () => {
  test("reads a benchmark v2 run archive", () => {
    const payload = {
      schema: "line.benchmark-v2.run-archive.v5",
      runs: [
        {
          task: { sourceId: "high_air_drive", budget: 750_000, actualSeed: 16 },
          source: { id: "high_air_drive" },
          stats: statsOf({ fwd_eval: fwdBlock({ fwd_rollout_redraws: 10, fwd_rollout_redraw_refuted: 2 }) }),
        },
        {
          task: { sourceId: "high_air_drive", budget: 750_000, actualSeed: 17 },
          stats: statsOf({ fwd_eval: fwdBlock({ fwd_rollout_redraws: 30, fwd_rollout_redraw_refuted: 8 }) }),
        },
        { task: { sourceId: "high_air_drive", budget: 750_000 }, status: "error" },
      ],
    };
    const { kind, cells, skipped } = extractCells(payload);
    expect(kind).toBe("v2-run-archive");
    expect(cells).toHaveLength(2);
    expect(skipped).toBe(1);
    expect(cells[0].sourceId).toBe("high_air_drive");
    expect(cells[0].budget).toBe(750_000);
    expect(cells[0].seed).toBe(16);
    const { pooled } = aggregate(cells);
    expect(pooled.m3RedrawRefutation.value).toBeCloseTo(10 / 40, 12);
  });

  test("falls back to runs[].source.id when the task has no sourceId", () => {
    const { cells } = extractCells({
      runs: [{ source: { id: "sparse_lowline" }, stats: statsOf() }],
    });
    expect(cells[0].sourceId).toBe("sparse_lowline");
  });

  test("reads a golden archive's checkpoints", () => {
    const payload = {
      rows: [
        {
          name: "cold_start",
          variant: "base",
          seed: 3,
          checkpoints: [
            { budget: 90_000, seed: 3, compile_stats: statsOf() },
            { budget: 250_000, seed: 3, compile_stats: null },
          ],
        },
      ],
    };
    const { kind, cells, skipped } = extractCells(payload);
    expect(kind).toBe("golden");
    expect(skipped).toBe(1);
    expect(cells).toHaveLength(1);
    expect(cells[0].sourceId).toBe("cold_start/base");
    expect(cells[0].budget).toBe(90_000);
    expect(cells[0].seed).toBe(3);
  });

  test("reads a run.ts stats sidecar and derives the source from the spec path", () => {
    const { kind, cells } = extractCells({
      spec: "scripts/v0/specs/shelter_amp.ts",
      seed: 0,
      budget: 750_000,
      stats: statsOf(),
    });
    expect(kind).toBe("stats-sidecar");
    expect(cells).toHaveLength(1);
    expect(cells[0].sourceId).toBe("shelter_amp");
    expect(cells[0].budget).toBe(750_000);
  });

  test("an unrecognized payload names the three shapes it accepts", () => {
    expect(() => extractCells({ hello: 1 })).toThrow(/run archive|golden|stats sidecar/);
    expect(() => extractCells([1, 2, 3])).toThrow(/not a JSON object/);
  });
});

describe("readInput", () => {
  test("reads plain JSON and gzipped JSON to the same cells", () => {
    const payload = {
      schema: "line.benchmark-v2.run-archive.v5",
      runs: [{ task: { sourceId: "s", budget: 750_000, actualSeed: 0 }, stats: statsOf() }],
    };
    const plain = readInput(writeJson("archive.json", payload));
    const gz = readInput(writeJson("archive.json.gz", payload, true));
    expect(extractCells(gz).cells).toEqual(extractCells(plain).cells);
  });
});
