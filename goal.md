# Active Compiler Improvement Goal

Improve the accepted Benchmark V2 development headline toward 550 through
broad, source-default compiler changes.

Read `docs/HOW_TO_WORK.md`, `docs/benchmark-v2-context.md`,
`docs/benchmark-v2.md`, `docs/benchmark-v2-decisions.md`, and
`docs/compiler-improvement-campaign.md` before substantial work. Use
`npm run benchmark -- prepare` after benchmark-definition changes and
`npm run benchmark -- status --seeds=N` to inspect exact cache/compute needs.

Each candidate should express a falsifiable mechanism-level hypothesis using
continuous physical or authored inputs. Do not key behavior to case identity,
production monitor results, or one known failure. Keep normal candidates in
the pool and let the exact engine evaluator and ordinary ranker choose them.

Use compute in proportion to uncertainty:

1. focused tests and a small cross-regime scope panel;
2. `npm run benchmark -- eval` for the smallest canonical cached comparison;
3. `npm run benchmark -- eval --seeds=N` for any useful heavier comparison.

All comparisons reuse the immutable baseline-cache prefix and compile only
the candidate. The operator or agent chooses `N`; no registry, declaration
slot, or attempt budget is required. If cache coverage is missing, extend only
the missing baseline tail explicitly with
`baseline-cache extend --seeds=N`. Never recompute an already cached baseline.

Judge evidence by headline delta and uncertainty, budget and stratum movement,
validity gains/losses, material case regressions, and mechanism plausibility.
Repeated runs are allowed when useful, but do not pretend adaptively selected
results are one pooled independent experiment.

Promote a favorable, source-default candidate explicitly with
`npm run benchmark -- rebaseline --from=COMPARISON --label=LABEL`. Rebaseline
verifies the exact candidate snapshot, refreshes the quick reference, runs the
qualification monitor, and publishes the new baseline. Qualification remains
monitoring evidence, never a tuning target.

Keep `docs/compiler-improvement-campaign.md` concise: hypothesis, commands and
elapsed compute, decisive evidence, retain/revise/retire decision, workflow
friction, and next step. Do not commit raw generated run archives or bulk study
reports.
