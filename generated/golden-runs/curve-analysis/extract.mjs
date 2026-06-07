#!/usr/bin/env node
// Extract a tidy dataset from the dead-end-policy budget-curve sweep.
//
// Reads each variant's golden.json (produced by scripts/v0/golden.ts) and emits
// three tidy CSVs into this directory:
//
//   long.csv          one row per (variant, spec, seed, budget) — the raw checkpoint grid
//   budget.csv        one row per (variant, budget) — the aggregated suite metric
//   spec_budget.csv   one row per (variant, budget, spec) — per-spec aggregate over seeds
//   summary.csv       one row per variant — headline + run metadata
//
// Usage:
//   node extract.mjs                 # uses the built-in manifest below
//   node extract.mjs base=DIR bj=DIR # override label=dir pairs (DIR holds golden.json)

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const RUNS = resolve(HERE, "..");

// label -> archive dir (each contains golden.json). Order defines plot/legend order.
const MANIFEST = [
  ["base", "curve-base"],
  ["backjump", "curve-backjump"],
  ["bestjump_w1", "curve-bestjump-w1"],
  ["bestjump_w2", "curve-bestjump-w2"],
];

// Allow argv overrides: label=dir
const overrides = process.argv.slice(2).map((a) => a.split("="));
const manifest = overrides.length > 0
  ? overrides.map(([label, dir]) => [label, dir])
  : MANIFEST;

const csv = (rows, cols) => {
  const head = cols.join(",");
  const body = rows.map((r) => cols.map((c) => {
    const v = r[c];
    if (v === null || v === undefined) return "";
    if (typeof v === "number") return String(v);
    const s = String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(","));
  return [head, ...body].join("\n") + "\n";
};

const long = [];
const budget = [];
const specBudget = [];
const summary = [];

for (const [label, dir] of manifest) {
  const path = resolve(RUNS, dir, "golden.json");
  const j = JSON.parse(readFileSync(path, "utf8"));

  summary.push({
    variant: label,
    archive_dir: dir,
    headline_score: j.headline?.score ?? "",
    headline_tier: j.headline?.tier ?? "",
    n_seeds: j.headline?.n_seeds ?? "",
    fingerprint: j.evaluator_fingerprint ?? "",
    n_budgets: (j.budgets ?? []).length,
    git: j.source?.commit ?? j.source?.git ?? "",
  });

  // Aggregated suite metric per budget (+ per-spec breakdown).
  for (const b of j.budget_scores ?? []) {
    budget.push({
      variant: label,
      budget: b.budget,
      suite_score: b.score,
      passed: b.passed,
      total: b.total,
      contract_pass_rate: b.contract_pass_rate,
    });
    for (const s of b.spec_scores ?? []) {
      specBudget.push({
        variant: label,
        budget: b.budget,
        spec: s.name,
        score: s.score,
        passed: s.passed,
        total: s.total,
      });
    }
  }

  // Raw per (spec, seed, budget) checkpoint grid.
  for (const row of j.rows ?? []) {
    for (const cp of row.checkpoints ?? []) {
      const st = cp.compile_stats ?? {};
      long.push({
        variant: label,
        spec: row.name,
        seed: row.seed,
        budget: cp.budget,
        status: cp.status,
        score: cp.score,
        valid: cp.contract_passed ? 1 : 0,
        contract_passed: cp.contract_passed ? 1 : 0,
        axis_quality: cp.axis_quality ?? "",
        axis_loss: cp.axis_loss ?? "",
        axis_error_rms: cp.axis_error_rms ?? "",
        contacts: cp.contacts ?? "",
        hits: cp.hits ?? "",
        missing: cp.missing ?? "",
        drift: cp.drift ?? "",
        sim_frames: st.sim_frames ?? "",
        search_nodes: st.search_nodes_expanded ?? "",
        budget_exhausted: st.budget_exhausted === undefined ? "" : (st.budget_exhausted ? 1 : 0),
        elapsed_ms: cp.elapsed_ms ?? "",
        track_hash: cp.track_hash ?? "",
      });
    }
  }
}

const out = (name, rows, cols) => {
  const p = resolve(HERE, name);
  writeFileSync(p, csv(rows, cols));
  console.log(`wrote ${name}: ${rows.length} rows`);
};

out("long.csv", long, [
  "variant", "spec", "seed", "budget", "status", "score", "valid", "contract_passed",
  "axis_quality", "axis_loss", "axis_error_rms", "contacts", "hits", "missing", "drift",
  "sim_frames", "search_nodes", "budget_exhausted", "elapsed_ms", "track_hash",
]);
out("budget.csv", budget, [
  "variant", "budget", "suite_score", "passed", "total", "contract_pass_rate",
]);
out("spec_budget.csv", specBudget, [
  "variant", "budget", "spec", "score", "passed", "total",
]);
out("summary.csv", summary, [
  "variant", "archive_dir", "headline_score", "headline_tier", "n_seeds",
  "fingerprint", "n_budgets", "git",
]);
console.log("done.");
