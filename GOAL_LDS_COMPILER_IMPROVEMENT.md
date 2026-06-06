# Goal - improve the compiler

> **Read this first.** Optimize the compiler, not a local proxy.
>
> - **Metric:** `HEADLINE = alpha * q(b_max) + (1 - alpha) * logAUC`, `alpha=0.7`.
>   `q(b_max)` is the suite score at the largest scored budget; `logAUC` is the
>   normalized area under quality vs log budget.
> - **Canonical decision:** 20 specs x 24 seeds `{0..23}` x dense 5k-175k budget
>   grid, judged by `npm run decide`.
> - **Engine:** use `LR_ENGINE=wasm` for compiler, benchmark, verification, and
>   performance commands that run physics. Pure analyzers such as `npm run decide`
>   do not need it.
> - **Jobs:** use `--jobs=6` for golden runs.
> - **Promotion gate:** first require `VERDICT: ACCEPT`; then commit only if the
>   canonical 24-seed `Δheadline` is greater than `+5`.

## Objective

Carefully improve `compileHandoff`, the compiler that turns a musical `Spec` into
a beat-synced Line Rider `Track`.

This is a trajectory-constrained procedural-generation problem with fragile forward
dependency: every local catch changes the rider state that future catches inherit.
The compiler should keep converting additional simulated-frame budget into better,
more reliable tracks. Prefer mechanisms that raise the achievable ceiling and
reduce structural plateaus. Do not buy early-budget prettiness by lowering the
ceiling.

Good changes are generic compiler improvements: better prefix search, candidate
generation, validation, ranking, reuse, repair, start handling, diagnostics, or
performance that preserves the measured contract. The route is open; the ruler is
not.

## What Success Means

A candidate succeeds only when the canonical decision says it does.

```bash
npm run decide -- <candidate>/golden.json <baseline>/golden.json
```

Keep/promote a change only when:

- `decide` prints `VERDICT: ACCEPT`;
- the canonical 24-seed `Δheadline` is greater than `+5`;
- validity does not regress at the ceiling budget;
- the mechanism is generic, budget-oblivious, deterministic, and not keyed to the
  benchmark specs.

After an accepted promotion, commit it before starting the next mechanism and treat
that candidate as the new baseline. Re-run the baseline only after a kept change or
a deliberate ruler/scope change.

## Run Workflow

Use tiny probes to find bugs and shape hypotheses. Use canonical runs to decide.
Budget checkpoints inside one run are cheap; the largest budget drives the work.
Canonical decision archives should be compact: do not pass `--details` on the
20-spec x 24-seed dense run. `--details` is useful for smaller diagnostic probes,
but the full canonical archive can become too large to serialize.

```bash
# Tiny probe: 5 seeds, 10k-spaced checkpoints to 125k. Not a decision basis.
LR_ENGINE=wasm GOLDEN_SEEDS_OVERRIDE=0,1,2,3,4 npm run golden -- \
  --specs=tiny_dance,opening_burst \
  --budgets=5000,15000,25000,35000,45000,55000,65000,75000,85000,95000,105000,115000,125000 \
  --jobs=6 \
  --archive-dir=generated/golden-runs/<label>-tiny

# Canonical candidate run: the only promotable evidence.
LR_ENGINE=wasm npm run golden -- \
  --jobs=6 \
  --archive-dir=generated/golden-runs/<label>

# Decision against the current baseline of record.
npm run decide -- \
  generated/golden-runs/<label>/golden.json \
  generated/golden-runs/<baseline>/golden.json
```

For compiler tests and verification, also use the WASM engine:

```bash
LR_ENGINE=wasm npx vitest run tests/optimizer_handoff.test.ts tests/handoff_policy.test.ts
LR_ENGINE=wasm npm run verify
```

## Rules That Must Not Move

- The search policy must not read requested budgets. Budgets are checkpoints along
  one deterministic search sequence.
- No spec-name branches, no thresholds that identify the test suite indirectly,
  and no logic tuned to a single seed, budget, or known fragile row.
- Do not edit the scorer, golden specs, evaluator fingerprint, metric, seed set, or
  budget grid to make a compiler change look better. If the ruler changes
  deliberately, re-baseline and compare only like with like.
- Validity is a guardrail, not a lever. A candidate should become valid because the
  generated track is better, not because the gates were weakened.
- Wall-clock is diagnostic only. The work budget is simulated rider frames.

## How To Think About Changes

Start from the failure shape, not from a favorite knob:

- Where does quality stop improving as budget rises?
- Which rows flip validity, miss contacts, land off-beat, die, or plateau with
  unchanged track hashes?
- Are full evaluations starved, duplicate, too local, too expensive, or ranking the
  wrong prefixes?
- Does a local improvement preserve the future state needed by later contacts?
- Does extra compute create new useful alternatives, or just more versions of the
  same basin?

Prefer changes that make the compiler's search space healthier: more viable
continuations, better ordering of genuinely promising prefixes, less duplicate
work, stronger suffix recovery, and clearer engine-grounded diagnostics.

## Reading Results

Read the `headline` block first: `score`, `ceiling`, `log_auc`, `validity`, and
`score_budgets`. Then inspect:

- per-budget score and validity curves;
- largest last-budget regressions and improvements;
- validity flips at the ceiling budget;
- `compile_stats` for search depth, full evaluations, duplicates, repair attempts,
  candidate viability, and plateaued checkpoints;
- worst contacts and worst axes for rows that changed.

Do not trust an eyeballed HEADLINE delta. The metric rationale in
`docs/metric_problem_statement.md` shows why paired comparisons matter and why 24
seeds are now the right canonical population for resolving roughly 5-point gains.
