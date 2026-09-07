# Active Compiler Improvement Goal

Raise the active 750k Benchmark V2 development headline above 650 through
broad, source-default compiler changes. 

The next authorized campaign is
`docs/impact-delivery-650-campaign-new.md`: evaluator and authored targets stay
frozen, 620 is the internal checkpoint, >650 is the acceptance target, and no
new capability, legacy, validity, or production debt is allowed. The old
search-side veins are closed evidence, not a reason to keep retuning them.

Read `docs/HOW_TO_WORK.md`, `docs/benchmark-v2-context.md`,
`docs/benchmark-v2.md`, `docs/benchmark-v2-decisions.md`, and
`docs/compiler-improvement-campaign.md` before substantial work. Use
`npm run benchmark -- prepare` after benchmark-definition changes and
`npm run benchmark -- status` to verify the exact campaign baseline and work.

The official campaign scope is temporarily **750k only**, with a predeclared
maximum of N=48 and strict looks at **N=8/16/32/48**:

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
a mechanism depends on compute. Broad acceleration and kinematic planning stay
deferred. After the documented passive ceiling, the impact campaign has opened
only its default-off, geometry-preserving contacted-window active carrier; its
scope and frozen evidence schedule live in `docs/impact-delivery-650-campaign.md`.

Use compute in proportion to uncertainty. The governed improvement experiment
uses one O'Brien-Fleming Student-t boundary calibrated to one-sided total alpha
5% per direction:

1. focused tests and a small cross-regime scope panel;
2. one cache-backed `npm run benchmark -- eval --seeds=48`;
3. the runner queues N=8, decides it, and queues N=16/32/48 only after a
   `continue` result. A positive boundary crossing accepts; the symmetric
   negative crossing rejects; no predictive-futility rule stops a plausible
   recovery. An uncrossed N=48 result is inconclusive.

During a wave, terminal progress is one line per genuinely complete 44-case
seed block. It reports the observed paired delta, seed-block SE and directional
probability as they evolve, plus validity, failures, throughput, and ETA.
Intermediate rounds are diagnostic only; promotion and rejection remain
restricted to the predeclared N=8/16/32/48 looks. The same summaries are kept
in a reconstructable `.progress.jsonl` beside the governed checkpoint.

The active campaign cache contains the exact governed N=8 prefix: literal
seeds 16–23. Never recompute covered rows. If a later candidate continues,
extend only the missing next declared baseline prefix before compiling that
candidate's tail.

Do not compare the active headline to a pre-`c7146660` score: the old baseline
used net redirection arc, while the active ruler uses accumulated contacted-
frame impulse. The old schedule was reused only as a literal seed schedule.

Judge evidence by the governed sequential result, headline delta and uncertainty, stratum movement, validity
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
