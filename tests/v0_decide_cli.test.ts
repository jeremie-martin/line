import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const TSX = "./node_modules/.bin/tsx";

/** Minimal golden archive sufficient for `analyze_golden_curve.ts decide`. */
type ArchiveOpts = { budgets?: number[]; headline?: unknown };
function archive(seed: number, fingerprint = "fp_aaaa", opts: ArchiveOpts = {}): unknown {
  const budgets = opts.budgets ?? [50_000, 150_000];
  const ck = (budget: number, score: number) => ({ budget, status: "pass", score, contract_passed: true });
  const a: Record<string, unknown> = {
    evaluator_fingerprint: fingerprint,
    curve_score: 0,
    budgets,
    budget_scores: budgets.map((b) => ({ budget: b, score: 300, passed: 1, total: 1 })),
    scope: { seeds: [seed] },
    rows: [{ name: "spec_a", seed, variant: "base", checkpoints: budgets.map((b) => ck(b, 300)) }],
  };
  if (opts.headline) a.headline = opts.headline;
  return a;
}

/** A stored headline block (the shape golden.ts writes). */
const hb = (alpha: number, scoreBudgets: number[]) => ({
  score: 300,
  ceiling: 300,
  log_auc: 300,
  alpha,
  score_budgets: scoreBudgets,
  validity: [],
});

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
  test("refuses on no overlapping seeds instead of reporting 'inconclusive'", () => {
    const cand = write(archive(0));
    const base = write(archive(100));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("REFUSING");
    expect(out(r)).toContain("no overlapping seeds");
    expect(out(r)).not.toContain("VERDICT");
  });

  test("refuses on evaluator-fingerprint mismatch (scorer/specs changed)", () => {
    const cand = write(archive(0, "fp_new"));
    const base = write(archive(0, "fp_old"));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("fingerprint differs");
  });

  test("rejects 'k'-suffixed --score-budgets instead of silently scoring zero", () => {
    const cand = write(archive(0));
    const base = write(archive(0));
    const r = decide([cand, base, "--score-budgets=50k,150k"]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("positive integer frames");
  });

  test("accepts a matching, comparable pair (sanity: guard does not over-refuse)", () => {
    const cand = write(archive(0));
    const base = write(archive(0));
    const r = decide([cand, base]);
    expect(r.status).toBe(0);
    expect(out(r)).toContain("VERDICT");
  });

  test("refuses when archives disagree on stored headline alpha (no flag)", () => {
    const cand = write(archive(0, "fp_aaaa", { headline: hb(0.5, [50_000, 150_000]) }));
    const base = write(archive(0, "fp_aaaa", { headline: hb(0.7, [50_000, 150_000]) }));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("disagree on headline alpha");
  });

  test("an explicit --alpha overrides disagreeing stored alpha", () => {
    const cand = write(archive(0, "fp_aaaa", { headline: hb(0.5, [50_000, 150_000]) }));
    const base = write(archive(0, "fp_aaaa", { headline: hb(0.7, [50_000, 150_000]) }));
    const r = decide([cand, base, "--alpha=0.7"]);
    expect(r.status).toBe(0);
    expect(out(r)).toContain("VERDICT");
  });

  test("refuses when archives disagree on stored score_budgets (no flag)", () => {
    const cand = write(archive(0, "fp_aaaa", { headline: hb(0.7, [50_000]) }));
    const base = write(archive(0, "fp_aaaa", { headline: hb(0.7, [50_000, 150_000]) }));
    const r = decide([cand, base]);
    expect(r.status).not.toBe(0);
    expect(out(r)).toContain("disagree on headline score_budgets");
  });

  test("different budget grids (same specs/seeds) are non-canonical, not refused", () => {
    const cand = write(archive(0, "fp_aaaa", { budgets: [50_000, 100_000, 150_000] }));
    const base = write(archive(0, "fp_aaaa", { budgets: [50_000, 150_000] }));
    const r = decide([cand, base]);
    expect(r.status).toBe(0); // overlap exists -> not refused
    expect(out(r)).toContain("non-canonical");
    expect(out(r)).toContain("VERDICT");
  });
});
