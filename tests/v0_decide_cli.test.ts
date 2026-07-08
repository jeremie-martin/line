import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const TSX = "./node_modules/.bin/tsx";

/** A stored headline block in the shape golden.ts writes (weighted-budget-average). */
function headlineBlock(
  budgets: number[],
  tier: "canonical" | "probe" = "canonical",
  weights?: number[],
  score = 300,
): unknown {
  const sum = budgets.reduce((s, b) => s + b, 0);
  const weight_by_budget = budgets.map((b, i) => ({
    budget: b,
    weight: weights ? weights[i] : b / sum,
  }));
  return {
    kind: "weighted_budget_average",
    tier,
    n_seeds: 1,
    score,
    weight_by_budget,
    budgets,
    ceiling: score,
    log_auc: score,
    validity: [],
  };
}

/** Minimal golden archive sufficient for `analyze_golden_curve.ts decide`. */
type ArchiveOpts = { budgets?: number[]; headline?: unknown | null; score?: number };
function seedPolicy(budgets: number[], seedSlots = [0]): unknown {
  return {
    kind: "budget_disjoint_contiguous",
    seed_base: seedSlots[0] ?? 0,
    seeds_per_budget: seedSlots.length,
    seed_slots: seedSlots,
    budget_seeds: budgets.map((budget, budgetIndex) => ({
      budget,
      seeds: seedSlots.map((seed) => seed + budgetIndex * seedSlots.length),
    })),
  };
}

function archive(seed: number, fingerprint = "fp_aaaa", opts: ArchiveOpts = {}): unknown {
  const budgets = opts.budgets ?? [50_000, 150_000];
  const score = opts.score ?? 300;
  const ck = (budget: number, score: number, budgetIndex: number) => ({
    budget,
    seed: seed + budgetIndex,
    status: "pass",
    score,
    contract_passed: true,
  });
  const a: Record<string, unknown> = {
    evaluator_fingerprint: fingerprint,
    curve_score: 0,
    budgets,
    seed_policy: seedPolicy(budgets, [seed]),
    budget_scores: budgets.map((b) => ({ budget: b, score, passed: 1, total: 1 })),
    scope: { seed_slots: [seed], seeds: [seed] },
    rows: [{ name: "spec_a", seed, variant: "base", checkpoints: budgets.map((b, i) => ck(b, score, i)) }],
  };
  // Default to a valid weighted-average headline; opts.headline overrides, and
  // `null` simulates a legacy archive that predates the metric (no headline block).
  if (opts.headline === null) {
    /* no headline */
  } else {
    a.headline = opts.headline ?? headlineBlock(budgets, "canonical", undefined, score);
  }
  return a;
}

function write(obj: unknown): string {
  const dir = mkdtempSync(join(tmpdir(), "decide-"));
  const path = join(dir, "golden.json");
  writeFileSync(path, JSON.stringify(obj));
  return path;
}

function decide(args: string[]) {
  return spawnSync(TSX, ["scripts/v0/analyze_golden_curve.ts", "decide", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

const out = (r: ReturnType<typeof decide>) => `${r.stdout}\n${r.stderr}`;

describe("decide scope guard (cannot silently compare incomparable archives)", () => {
  test("rejects removed metric-scope flags before reading archives", () => {
    const flag = "--score-budgets=50k,150k";
    const r = decide([flag, "/tmp/missing-candidate.json", "/tmp/missing-baseline.json"]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("unsupported decide flag");
    expect(out(r)).toContain(flag);
    expect(out(r)).not.toContain("ENOENT");
    expect(out(r)).not.toContain("VERDICT");
  });

  test("rejects malformed decide policy flags before reading archives", () => {
    const r = decide(["--alpha=wat", "/tmp/missing-candidate.json", "/tmp/missing-baseline.json"]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("--alpha must be");
    expect(out(r)).not.toContain("ENOENT");
    expect(out(r)).not.toContain("VERDICT");
  });

  test("refuses on no overlapping seed slots instead of reporting 'inconclusive'", () => {
    const cand = write(archive(0));
    const base = write(archive(100));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("REFUSING");
    expect(out(r)).toContain("no overlapping seed slots");
    expect(out(r)).not.toContain("VERDICT");
  });

  test("refuses on evaluator-fingerprint mismatch (scorer/specs changed)", () => {
    const cand = write(archive(0, "fp_new"));
    const base = write(archive(0, "fp_old"));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("fingerprint differs");
  });

  test("refuses a LEGACY archive that predates the weighted-average metric (no kind)", () => {
    const cand = write(archive(0));
    const base = write(archive(0, "fp_aaaa", { headline: null }));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("weighted_budget_average");
    expect(out(r)).not.toContain("VERDICT");
  });

  test("refuses a legacy ceiling-blend headline (has alpha, no kind)", () => {
    const legacy = { score: 300, ceiling: 300, log_auc: 300, alpha: 0.7, score_budgets: [50_000, 150_000], validity: [] };
    const cand = write(archive(0));
    const base = write(archive(0, "fp_aaaa", { headline: legacy }));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("re-baseline");
  });

  test("accepts a matching, comparable canonical pair (guard does not over-refuse; promotable)", () => {
    const cand = write(archive(0));
    const base = write(archive(0));
    const r = decide([cand, base]);
    expect(r.status).toBe(0);
    expect(out(r)).toContain("VERDICT");
    expect(out(r)).not.toContain("non-promotable");
  });

  test("default improvement mode rejects a deterministic tiny headline regression", () => {
    const cand = write(archive(0, "fp_aaaa", { score: 299.91 }));
    const base = write(archive(0, "fp_aaaa", { score: 300 }));
    const r = decide([cand, base]);
    expect(r.status).toBe(0);
    expect(out(r)).toContain("policy=improvement");
    expect(out(r)).toContain("Δheadline = -0.1");
    expect(out(r)).toContain("VERDICT: REJECT");
  });

  test("simplification mode accepts a deterministic tiny headline regression inside the margin", () => {
    const cand = write(archive(0, "fp_aaaa", { score: 299.91 }));
    const base = write(archive(0, "fp_aaaa", { score: 300 }));
    const r = decide(["--mode=simplification", "--margin=0.1", "--alpha=0.20", cand, base]);
    expect(r.status).toBe(0);
    expect(out(r)).toContain("policy=simplification/non-inferiority");
    expect(out(r)).toContain("P(Δ≤-0.1)=0.0%");
    expect(out(r)).toContain("VERDICT: ACCEPT");
  });

  test("simplification mode rejects when non-inferiority is not established", () => {
    const cand = write(archive(0, "fp_aaaa", { score: 299.8 }));
    const base = write(archive(0, "fp_aaaa", { score: 300 }));
    const r = decide(["--mode=simplification", "--margin=0.1", "--alpha=0.20", cand, base]);
    expect(r.status).toBe(0);
    expect(out(r)).toContain("P(Δ≤-0.1)=100.0%");
    expect(out(r)).toContain("VERDICT: REJECT");
    expect(out(r)).toContain("non-inferiority not established");
  });

  test("refuses when archives disagree on the headline weighting over common budgets", () => {
    // base uses uniform weights; cand uses value-proportional -> not like-with-like.
    const cand = write(archive(0));
    const base = write(archive(0, "fp_aaaa", { headline: headlineBlock([50_000, 150_000], "canonical", [0.5, 0.5]) }));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("weighting");
  });

  test("a probe-tier archive still compares but is labeled non-promotable", () => {
    const cand = write(archive(0, "fp_aaaa", { headline: headlineBlock([50_000, 150_000], "probe") }));
    const base = write(archive(0));
    const r = decide([cand, base]);
    expect(r.status).toBe(0);
    expect(out(r)).toContain("VERDICT");
    expect(out(r)).toContain("non-promotable");
  });

  test("refuses an archive without the new seed policy", () => {
    const cand = archive(0) as Record<string, unknown>;
    delete cand.seed_policy;
    const base = write(archive(0));
    const r = decide([write(cand), base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("seed policy");
    expect(out(r)).not.toContain("VERDICT");
  });

  test("refuses different budget grids because the budget-indexed seed policy differs", () => {
    const cand = write(archive(0, "fp_aaaa", { budgets: [50_000, 100_000, 150_000] }));
    const base = write(archive(0, "fp_aaaa", { budgets: [50_000, 150_000] }));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("different budget seed policies");
    expect(out(r)).not.toContain("VERDICT");
  });

  test("refuses seed-count subsets because the seed policy differs", () => {
    const budgets = [50_000, 150_000];
    const checkpoints = (score: number, seed: number) => budgets.map((budget, budgetIndex) => ({
      budget,
      seed: seed + budgetIndex * 2,
      status: "pass",
      score,
      contract_passed: true,
    }));
    const base = write({
      evaluator_fingerprint: "fp_aaaa",
      curve_score: 0,
      budgets,
      seed_policy: seedPolicy(budgets, [0, 1]),
      budget_scores: budgets.map((budget) => ({ budget, score: 500, passed: 2, total: 2 })),
      scope: { seed_slots: [0, 1], seeds: [0, 1] },
      rows: [
        { name: "spec_a", seed: 0, variant: "base", checkpoints: checkpoints(100, 0) },
        { name: "spec_a", seed: 1, variant: "base", checkpoints: checkpoints(900, 1) },
      ],
      headline: headlineBlock(budgets),
    });
    const cand = write({
      evaluator_fingerprint: "fp_aaaa",
      curve_score: 0,
      budgets,
      seed_policy: seedPolicy(budgets, [0]),
      budget_scores: budgets.map((budget) => ({ budget, score: 999, passed: 1, total: 1 })),
      scope: { seed_slots: [0], seeds: [0] },
      rows: [{ name: "spec_a", seed: 0, variant: "base", checkpoints: checkpoints(120, 0) }],
      headline: headlineBlock(budgets, "probe"),
    });

    const r = decide([cand, base]);

    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("different budget seed policies");
  });
});
