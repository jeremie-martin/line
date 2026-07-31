# Active Compiler Improvement Goal

Raise the active 750k Benchmark V2 development headline above 650 through
broad, source-default compiler changes. The current N=48 campaign baseline is
`contact-redir-impulse-v2-750k` at **593.5031**, with 2111/2112 valid runs.
It is the first scorer-bound baseline for accumulated contacted-frame
redirection impulse: suite `7bd878d8aaea08a9`, scoring protocol
`c71466608589ae757`, Golden evaluator `07cf88383150`.

Current candidate: the scorer-bound readiness refresh under target protocol
`next-arc-readiness-targets-v3-contacted-frame-impulse`. Development OOF selects
only impact feasibility plus the disabled air diagnostic; catchability and
speed remain unchanged. Locked-seed shipped-product MSE improves 23.1%, but
this is not a campaign acceptance claim until the exact 750k/N=48 compiler
comparison is complete. Durable offline evidence is
`benchmark/v2/studies/readiness-contact-impulse-v3.json`.

Read `docs/HOW_TO_WORK.md`, `docs/benchmark-v2-context.md`,
`docs/benchmark-v2.md`, `docs/benchmark-v2-decisions.md`, and
`docs/compiler-improvement-campaign.md` before substantial work. Use
`npm run benchmark -- prepare` after benchmark-definition changes and
`npm run benchmark -- status` to verify the exact campaign baseline and work.

The official campaign scope is temporarily **750k only, N=48 only**:

```bash
npm run benchmark -- status
npm run benchmark -- eval --seeds=48 --jobs=48
```

The frozen three-budget V2 contract and its retained old-ruler evidence remain
unchanged in `benchmark/v2/baseline.json`. The 250k and 500k budgets are
deferred from the official headline, not deleted or redefined. Its scores are
not comparable to the active scorer-bound baseline. Inspect that legacy full
ladder explicitly with
`npm run benchmark -- status --seeds=48 --baseline=benchmark/v2/baseline.json`;
do not use it for campaign acceptance until this temporary scope is retired.

Each candidate should express a falsifiable mechanism-level hypothesis using
continuous physical or authored inputs. Do not key behavior to case identity,
production monitor results, one known failure, or benchmark budget identity.
Keep normal candidates in the pool and let the exact engine evaluator and
ordinary ranker choose them.

Compiler laws must remain meaningful beyond the measured operating point:
exercise representative mappings at 150k and 1M-3M in focused tests whenever
a mechanism depends on compute. Acceleration/kinematic-line work remains
explicitly deferred.

Use compute in proportion to uncertainty, but publish campaign decisions only
at N=48:

1. focused tests and a small cross-regime scope panel;
2. one cache-backed `npm run benchmark -- eval --seeds=48`;
3. no N=2/N=4/N=8 probes and no adaptive seed-depth ladder.

The active campaign cache is fixed at N=48 and already complete. It is the
exact fresh 750k archive from the governed scorer-bound bootstrap, using
literal seeds 16–23 and 608–647. Never recompute that baseline.

Do not compare the active headline to a pre-`c7146660` score: the old baseline
used net redirection arc, while the active ruler uses accumulated contacted-
frame impulse. The old schedule was reused only as a literal seed schedule.

Judge evidence by headline delta and uncertainty, stratum movement, validity
gains/losses, material case regressions, and mechanism plausibility. Repeated
runs are allowed when useful, but do not pretend adaptively selected results
are one pooled independent experiment.

Promote a favorable, source-default candidate explicitly with
`npm run benchmark -- rebaseline --from=COMPARISON --label=LABEL`. Rebaseline
verifies the exact candidate snapshot and publishes the new campaign baseline
directly from its retained 750k archive. It does not compile or mutate the
deferred 250k/500k evidence.

Keep `docs/compiler-improvement-campaign.md` concise: hypothesis, commands and
elapsed compute, decisive evidence, retain/revise/retire decision, workflow
friction, and next step. Do not commit raw generated run archives or bulk study
reports.
