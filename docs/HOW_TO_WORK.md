# How to work — the handoff compiler

The single entry point for working on the compiler. **Read this first**, then open the
campaign doc for whatever you're improving. The doc map is `docs/README.md`.

## Goal & boundary

- **What:** turn a musical/rhythm `Spec` into a beat-synced Line Rider `Track`. Problem
  statement and success criteria: [`PROBLEM.md`](../PROBLEM.md).
- **Frozen contract** (what must not change) **and the HEADLINE metric definition:**
  [`docs/compiler_goals.md`](compiler_goals.md) — the single source of truth for both.
- **Active algorithm reference:** [`docs/optimizer/12_handoff_prefix_search.md`](optimizer/12_handoff_prefix_search.md).

## How to run

Each budget is an **independent full run** (no anytime/shared checkpoints): passing N
budgets runs N compiles per (spec, seed). Two tiers, cheap → authoritative:

1. **probe** — fast iteration, **not a decision basis**. A lower-power preview in the
   same score space (the fast-probe budget endpoints + a few seeds), comparable to
   canonical via `decide` on the shared specs/seeds/budgets; archives are `tier:"probe"`
   and non-promotable:

   ```bash
   LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2 npm run golden -- \
     --specs=tiny_dance,opening_burst \
     --budgets=25000,200000 \
     --jobs=6
   ```

2. **canonical** — 20 specs × 24 seeds × budgets `{25,50,100,150,200}k`; the **only
   promotable basis**:

   ```bash
   LR_ENGINE=wasm npm run golden -- --jobs=6
   ```

- **Jobs:** use `--jobs=6` unless you deliberately need a different worker count.
  Very high job counts can OOM (~1 GB/worker).
- **Baseline reuse:** the baseline is produced **once and reused**. For each idea, run
  only the *candidate*, then `decide` it against the committed baseline — do **not**
  re-run the baseline per candidate. There is intentionally no "two configs in one run"
  mode: when memory caps usable cores, two runs at N/2 cores ≈ two serial runs at N
  cores, so it saves no wall-clock.
- **Artifacts:** every run archives `golden.json` + checkpoint tracks/reports under
  `generated/golden-runs/` (gitignored working artifacts, not source).
- **Per-axis diagnostics** need `--details` (or `--json-full`); plain `--json` is compact
  and drops the per-axis data.

## Deciding

```bash
npm run decide -- <candidate>/golden.json <baseline>/golden.json
```

Paired cluster-bootstrap VERDICT: **accept** iff the headline-Δ 95% CI lower bound > 0.
The HEADLINE is the budget-value-weighted average of the per-budget suite scores;
validity is **reported per budget but never gates** (an invalid run already scores ~0).
`decide` recomputes both sides on the shared budgets, so a `probe`-tier or
fewer-seed archive still produces a valid paired comparison — just **indicative /
non-promotable** (and `decide` labels it so). It **refuses** legacy (pre-weighted-average)
archives and never compares raw scalars across different budget grids. The metric and
ruler live in [`docs/compiler_goals.md`](compiler_goals.md); the implementation is
`scripts/v0/metric.ts` + `scripts/v0/analyze_golden_curve.ts`. A raw score delta is not
an acceptance rule; the active compiler campaign adds a promotion threshold after
`decide`. On a positive-but-inconclusive result, `decide` prints how many more seeds
would resolve it. Statistical rationale (noise floor, seed counts):
[`docs/metric_problem_statement.md`](metric_problem_statement.md).

## Current baseline (of record)

The baseline of record is the **generated** [`docs/handoff-compiler.html`](handoff-compiler.html)
(per-budget / per-spec table), regenerated from a canonical `golden.json` — never
hand-transcribe scores. Procedure: [`docs/REBASELINE.md`](REBASELINE.md).

- Evaluator fingerprint: **`9b9776df145f`** (`scripts/v0/golden_suite.ts`).
- Current committed compiler: `compileHandoff`. Latest 24-seed canonical baseline
  (budgets `{25,50,100,150,200}k`, weighted-average HEADLINE): **HEADLINE ≈ 534.2**
  (ceiling ≈ 588.1, logAUC ≈ 408.2), validity 480/480 at 200k. Refresh the generated
  HTML from a fresh 24-seed rebaseline before quoting live numbers.

## Active campaigns

Point work at one of these; each carries its own particularities (the *what to try* and
the *scoreboard*), but all share the metric, decision rule, and principles here:

- **Compiler improvement** — [`GOAL_LDS_COMPILER_IMPROVEMENT.md`](../GOAL_LDS_COMPILER_IMPROVEMENT.md).
  The primary (and current standard) campaign for raising HEADLINE across the compiler.

Earlier campaigns (arc placement, fragile specs, plateau, low-budget) live under
`docs/archive/` (historical record, not live guidance).

## Working principles

- **Be honest.** Report what the data shows, including failures and "polish was a
  no-op." Never claim a win without a measured number behind it. If a property turns
  out unreachable, that finding is a deliverable — say so.
- **Decide, don't stall.** When the data points somewhere (e.g. "d=0 doesn't complete
  drums → backtracking is the real next step"), take that decision and act, recording why.
- **Diagnose every failure.** When something fails, find the cause before reacting — is
  it one off-beat frame, a dead gap, or budget starvation? Fix the cause, not the symptom.
- **Fast first, big later.** Before any big sweep: a quick rough run (one spec / tiny
  budget / `polish:false`) to surface bugs cheaply. Fix, re-probe, then launch the real
  sweep. Never burn an hour to discover a typo.
- **Sweeps are for understanding the equation, not ritual.** The deliverable of a sweep
  is the *shape*: budget→quality and budget→wall_ms per spec, first-completion cost,
  the saturation knee, ms/physframe stability. If a curve looks
  wrong, explain why before moving on.
- **No bandaids, no overfitting.** No spec-name branching. Density/contact-spacing
  heuristics are OK (they generalize); re-baseline any constant kept. Prefer the simple
  change that's correct by construction.
- **Don't change everything at once.** One mechanism per step, validated before the next.
- **Never break what already works — at EVERY step.** Before moving on, confirm the
  change didn't regress other specs, the CI property tests, or any of the four properties.
  A gain on one spec that breaks another, or any overfit / spec-name special-case / bandaid
  workaround, is not acceptable — back it out and find the sane change. Everything must stay
  compatible with the goals AND with the rest of the system, and we must understand *why* a
  change helps before keeping it.
- **COMMIT AFTER EVERY POINT.** Each work item ends with a commit to `master` (clear
  message, no push) once it is validated. This is mandatory, not optional — do not batch
  multiple items into one commit, and do not proceed to the next item with the previous one
  uncommitted. Keep throwaway probes (`_probe_*`) out of commits.
- **Be smart about cost.** Empirical evidence for every decision, but don't launch a
  3-hour run for every point. Use the smallest experiment that answers the question
  (one/few specs, small budget, fast mode); only scale up when the question genuinely needs it.
- **Don't spawn polling loops.** Long runs background and notify on completion; wait on
  the notification, don't spin `until ...; sleep` shells (that caused stray shells today).
