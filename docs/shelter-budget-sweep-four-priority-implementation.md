# Shelter budget sweep: four-priority implementation record

## Scope and evidence discipline

This record follows up the 116-run, seed-0 WASM sweep of
`scripts/v0/specs/shelter_impact_sync.ts` from 0.1M through 11.6M frames. The
source bundle is
`generated/shelter_impact_sync_wasm_sweep_20260810/`; its starting points are
`preliminary_report.md`, `preliminary_analysis.json`, `metric_dictionary.csv`,
`run_metric_summary.csv`, and `scalar_metric_summary.csv`. The authored impact,
amplitude, speed, and air targets remain the scoring contract. Impact
feasibility bounds are diagnostics only.

Claims below are deliberately labelled:

- **Observation** means a value reproduced directly from retained artifacts.
- **Association** means a relationship in this deterministic budget trajectory;
  adjacent budgets are not treated as independent samples.
- **Hypothesis** means a proposed compiler explanation.
- **Decision** means the result of a controlled compiler arm, not a claim that
  the underlying physical limitation is fully explained.

## Priority 1: make budget work and resume work identifiable

**Observation.** At 11.6M, 6,386,736 charged frames preceded the first terminal
and 5,298,670 followed it. The latter consisted of 5,182,027 repair-attempt
frames and 116,643 resumed-search frames. The raw ledger balances exactly;
`preliminary_report.md`, `budget_segments.csv`, `budget_attempts.csv`, and
`b11600000.budget-telemetry.json` support the split. The old telemetry could not
cleanly distinguish the hard ceiling from policy coordinates, so an apparent
"budget" relationship could mix search shaping, repair admission, and actual
charged work.

**Implementation.** Budget telemetry now records schema-v2 hard, general
policy, search-policy, and repair-budget coordinates; hard remaining/overrun;
first-terminal work; exact phase segments; attempts; and resume admission. The
compiler and scale-study interfaces independently expose `searchPolicyBudget`,
`repairBudget`, and `resumePolicy`. Raw scorer amplitude is emitted in pixels
alongside its normalized value. A 100k identity replay established that these
observation changes do not alter the compiled track.

**Controlled decision.** `legacy`, `none`, and `remainder-aware` resume modes
were compared without rewriting earlier search or repair. On the 44-source
seed-0 panel, remainder-aware was identical at 250k and 1.5M and moved 750k
from 602.1707 to 602.1380. A wider identity check found one real 750k validity
loss (`amplitude_tides`). On Shelter at 1M it removed the policy-shaped overrun,
but did not create enough valuable resumed work to justify the loss. Legacy
therefore remains the production policy; remainder-aware remains a diagnostic
arm. Supporting artifacts:
`four-priority-resume-legacy-s0.json` and
`four-priority-resume-remainder-s0.json` in
`generated/benchmark-v2/studies/`, plus the `v2_none_b1000000.*` and
`v2_remainder_b1000000.*` Shelter artifacts.

**Conclusion.** The large post-first-terminal fraction is real, but the tiny
resumed-search fraction is neither a hidden second search nor a headline-sized
efficiency opportunity. Repair must be judged separately.

## Priority 2: test whether mature candidate breadth is wastefully linear

**Association.** Shelter candidate sampling grows strongly with budget while
score is non-monotone: 15.44M candidates were sampled across the sweep, yet the
best observed score rose only from 525.652 at 0.1M to 570.454 at 11.6M and fell
from 570.276 at 7.4M to 564.010 at 10M. This motivates, but does not establish,
a breadth-efficiency problem (`sweep_metrics.csv`, `search_behavior.png`, and
`run_score_relationships.csv`).

**Implementation.** A fixed-policy study seam controls only the mature
candidate-count exponent. Exponents 1.0, 0.75, 0.5, and 0.25 were exercised at
250k, 750k, and 1.5M, followed by seeds 1-2 and a six-point Shelter high-budget
check. Accounting, scoring, targets, branch limit, and downstream ranking were
held fixed.

**Controlled decision.** Exponent 0.75 rescued the two seed-0 failures at 250k
and gained 0.62 at 1.5M, but seeds 1-2 lost three additional valid runs at 250k.
On Shelter it lost at every checked mature budget: 554.8 versus 558.8 at 1M,
562.2 versus 565.9 at 2.7M, 559.5 versus 567.6 at 5.7M, 564.6 versus 570.3 at
7.4M, 559.5 versus 564.0 at 10M, and 566.6 versus 570.5 at 11.6M. Production
therefore retains the linear law. Supporting artifacts are the
`four-priority-ncand-exp-*`, `four-priority-exp1-s1s2`, and
`four-priority-exp0p75-s1s2` studies and Shelter's `high_budget_exp075/` runs.

**Conclusion.** Sampled-candidate volume is not interchangeable with exact
search value. Sublinear breadth changes which candidates exist and can reduce
both completion reliability and high-budget quality; it is not a safe way to
harvest the observed compute growth.

## Priority 3: require repair value to survive beyond local admission

**Observation.** Repair consumes nearly all post-first-terminal work at 11.6M,
while accepted attempt improvements remain sparse. Register improvements, tail
improvements, and accepted repair improvements are different scopes and are
now kept separate in telemetry.

**Implementation and tests.** Two increasingly strict tests were run:

1. A response-aware allocator stopped revisiting a gap after an accepted global
   improvement failed to improve that gap's exact local SSE.
2. The held-out auxiliary-repair selections were tagged observation-only, then
   joined to exact final current-gap and next-gap results. The tag never entered
   proposal, ranking, traversal, repair, or register decisions.

**Controlled decision.** Response-aware allocation was byte-identical in all
132 cases at 750k. It changed only 4/132 cases at 250k (raw score sum -4.38) and
7/132 at 1.5M (raw sum -9.76), with no validity benefit. It is not promoted.

The exact join explains why the earlier local certificate failed. All 83
selected auxiliary fits improved both local SSE and projected outgoing quality
when emitted, yet the 27 affected held-out runs summed -28.1148 score points
(14 positive, 13 negative), and final next-gap SSE worsened by 0.00618 on
average. Among 296 source-blind single-feature threshold rules with minimum
coverage eight, none eliminated losses. See
`four-priority-repair-aux-certificate-heldout.json` and
`four-priority-repair-aux-certificate-join.json`.

**Conclusion.** The strange result is genuine: an exact local improvement plus
a better uncharged outgoing projection is not a sufficient completion
certificate. Later coupled-state and selector interactions erase it. Further
repair admission rules based on the same local feature family are closed;
future repair work needs a downstream state/value model or a genuinely
different physical actuator.

## Priority 4: diagnose persistent gap-axis errors and add the missing model output

**Observation.** At Shelter's 11.6M result, impact supplies 62.4% of total axis
squared error and amplitude 26.0%. Four amplitude errors are especially
persistent (`axis_gap_values.csv` and
`outgoing_amplitude/production_b11600000.report.json`):

| gap | authored target | achieved | raw target | raw achieved |
| ---: | --------------: | -------: | ---------: | -----------: |
| 68  | 0.3844 | 1.0000 | 23.06 px | 101.66 px |
| 69  | 0.5508 | 0.1217 | 33.05 px | 7.30 px |
| 101 | 0.5567 | 1.0000 | 33.40 px | 96.43 px |
| 102 | 0.7335 | 0.1238 | 44.01 px | 7.43 px |

**Hypothesis.** Alternating saturation and collapse are a duration/transition
authority conflict, not merely a bad normalization cap. Changing the authored
target as a function of feasible airtime was therefore tested only as a
diagnostic; it helped Shelter at 1M but lost at 5.7M and 11.6M and did not move
the four persistent gaps. The targets remain untouched.

**Actuator falsifier.** A fixed-count `post_contact_extent` control varied the
native release distance without increasing candidate or probe count. Tail and
contact-window configurations scored 599.995-601.016 at 750k versus 602.171 for
the control. Shelter's window-turn arm reached 562.1 at 1M versus 558.8, but did
not resolve gaps 68/69/101/102. The study seam remains default-off; the extent
family is closed.

**Missing model output.** Code verification found that the primary joint arc
response model predicted outgoing speed, air, and optional elevation, while the
ballistic projection and scorer already supported amplitude. The response row,
scalar and vector models, base-fit reuse, and outgoing surrogate now carry
`next.amplitude`. The production eligibility law is source-blind and target
preserving: budget at least 500k, mean authored amplitude at least 0.25, and
mean authored air at most 0.60. Explicit `off` remains the exact control.

**Evidence before the governed look.** The law was exact-control neutral at
250k and on Shelter at 1M. On discovery seeds 0-2 it scored 602.396 at 750k and
609.597 at 1.5M with 264/264 valid runs. A genuine seeds-3-6 held-out pair was
601.353 versus 600.706 with 352/352 valid runs; every seed block was positive.
Only five continuously eligible amplitude sources changed. The raw paired sum
was +114.034 points, although 6 of the 20 changed source-seed cells were
negative. Supporting artifacts are the
`four-priority-outgoing-amplitude-mature-distinct-*`,
`four-priority-outgoing-amplitude-heldout-*`, and
`four-priority-outgoing-amplitude-baked-default-s0.json` studies.

## Promotion, validation, and next compiler frontier

The outgoing-amplitude response law is the only positive production candidate
from these four priorities. Its immutable sequential evaluation is retained
under `generated/benchmark-v2/eval/cached-N48-2026-08-10T12-36-02Z*`. At the
terminal N=32 look it scored 602.0877 against 601.8791, a +0.2086 delta with
SE 0.0597, a 95% interval of [+0.0447, +0.3725], and 99.93% directional
probability. Both arms were 1,408/1,408 valid. Representative, capability,
legacy, and development-music deltas were respectively +0.1545, 0, +1.0045,
and 0, so every governed promotion gate passed. The result was accepted and
published as `outgoing-amplitude-response-750k` in commit `e218385`.

The new and preceding compiler snapshots were also run independently over the
canonical held-out qualification panel: five sources, three budgets, and eight
seeds per budget. Both produced 120/120 valid runs, monitor score 426.0155,
and identical track hashes and scores in every cell. The retained archives are
`generated/benchmark-v2/qualification/outgoing-amplitude-response-canonical-N8.json`
and
`generated/benchmark-v2/qualification/curve-joint-incoming-extension-canonical-N8.json`.
All rejected allocation, breadth, target-rewrite, and extent mechanisms remain
non-default study seams.

The predeclared high-budget N=16 panel was not silently rounded into a pass. At
1M its canonical point estimate missed the strict gate by 0.0126 points and
legacy was -0.3993, although the arithmetic seed-block mean was +0.0117 (SE
0.2322) and both arms were 704/704 valid. At 1.5M it passed: +0.2634 total,
+1.5870 legacy, capability 0, and 704/704 valid. Because the 1M miss was near
zero and concentrated in two legacy outliers, no source-profile threshold was
fit to those seeds. A frozen, disjoint N=16 replication on seeds 7016-7031
instead scored +0.3294 total and +2.6198 legacy with 704/704 valid. Recomputing
the canonical summary over both untouched 1M panels gives N=32 +0.1582 total,
+1.1088 legacy, capability 0, and 1,408/1,408 valid. The original failed panel,
replication, and pooled reading are all retained respectively as
`four-priority-outgoing-amplitude-safety-paired-s7000s7015.json`,
`four-priority-outgoing-amplitude-safety-replication-paired-s7016s7031.json`,
and `four-priority-outgoing-amplitude-safety-pooled-s7000s7031.json`. The
remediation therefore changed no compiler law and did not erase the initial
miss.

The accepted gain does not explain away the headline gap to 650: the refreshed
baseline analysis leaves 47.9123 points, with the capability stratum accounting
for 53.0% of that weighted gap. The next mechanism should model or directly
control the coupled native state across the current and following contact. It
should use fixed proposal count, preserve authored targets, and be evaluated
first on the persistent impact/amplitude spans rather than reopening raw
breadth or another local repair gate.
