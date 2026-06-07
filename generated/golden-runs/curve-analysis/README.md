# Dead-end policy × budget-curve sweep (honest-repair env)

A controlled A/B/C/D of four frontier-DFS **dead-end re-selection policies** in the
handoff compiler, swept across a fine budget grid under the forward-eval + track-repair
configuration. Only the dead-end policy varies between variants; everything else
(specs, seeds, budgets, env, engine) is held fixed.

## Variants (env-gated in `scripts/v0/optimizer/handoff.ts`)

| label | flag | on a clean-lane dead end, the next pop … |
|---|---|---|
| `base` | (none) | takes the LIFO sibling — unmodified frontier-DFS |
| `backjump` | `LR_BACKJUMP=1` | jumps **positionally** to the nearest ancestor sibling (uncle) |
| `bestjump_w1` | `LR_BESTJUMP=1` | jumps to the **best-scored** of {siblings ∪ uncles} (depth window 1) |
| `bestjump_w2` | `LR_BESTJUMP=1 LR_BESTJUMP_WINDOW=2` | same, widened to {siblings ∪ uncles ∪ great-uncles} |

A "dead end" = the search node could not catch its required contact, so `expandNode`
emits a single skip child. All policies fall back to a normal LIFO pop when no
eligible node exists. The policy shapes only the **main search up to first completion**;
the repair phase's suffix re-search (`runFrontierFrom`) uses plain DFS in every variant.

## Fixed configuration

- **Env:** `LR_ENGINE=wasm LR_FWD_EVAL=greedy:2 LR_FWD_EVAL_CHARGE=1 LR_FWD_EVAL_MIN_BUDGET=75000 LR_REPAIR=1 LR_REPAIR_MAX_UPSTREAM=3`
  (forward-eval ranking charged, active ≥75k; track-repair active ≥150k).
- **Scope:** 20 golden specs × 12 seeds (0–11) × 20 budgets.
- **Budgets (k sim-frames):** 25, 50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300,
  325, 350, 375, 400, 425, 450, 475, 500 — each an INDEPENDENT full run.
- Per-checkpoint track/report artifacts disabled (`GOLDEN_NO_ARTIFACTS=1`); all stats
  retained in each run's `golden.json`.
- Non-canonical budget grid ⇒ golden reports `tier=probe`; this is a curve study, not a
  baseline-of-record. Same evaluator fingerprint across all four (compiler-only change).

Source archives: `../curve-{base,backjump,bestjump-w1,bestjump-w2}/golden.json`.

## Pipeline

```bash
node extract.mjs      # golden.json ×4  ->  long.csv, budget.csv, spec_budget.csv, summary.csv
Rscript analysis.R    # CSVs -> plots/*.png + plots/all.pdf + tables/*.csv + console summary
```

## Dataset schema

**`long.csv`** — one row per (variant, spec, seed, budget); the raw checkpoint grid
(4 × 20 × 12 × 20 = 19,200 rows).
`variant, spec, seed, budget, status, score, valid, contract_passed, axis_quality,
axis_loss, axis_error_rms, contacts, hits, missing, drift, sim_frames, search_nodes,
budget_exhausted, elapsed_ms, track_hash`

**`budget.csv`** — one row per (variant, budget); the aggregated suite metric.
`variant, budget, suite_score, passed, total, contract_pass_rate`

**`spec_budget.csv`** — one row per (variant, budget, spec); per-spec aggregate over seeds.
`variant, budget, spec, score, passed, total`

**`summary.csv`** — one row per variant; headline score + run metadata.

## Outputs

`plots/`: `01_score_curve`, `02_delta_vs_base`, `03_validity`, `04_per_spec_curves`,
`05_delta_heatmap`, `06_axis_quality`, `07_paired_delta` (PNG) + `all.pdf`.
`tables/`: `auc.csv` (area under the score×budget curve, Δ vs base), `paired_delta_by_budget.csv`,
`paired_delta_overall.csv`, `winner_by_budget.csv`.
