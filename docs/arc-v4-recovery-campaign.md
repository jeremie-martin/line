# V4 expansion and compiler recovery

Current target: **926.5382**, starting from the corrected V4 baseline
**915.6860**. All 352 baseline runs are valid. The real V3-to-V4 drop is
**14.4696** points, and the target recovers 75% of it. Corrected freeze:
`98936eeb`; [canonical baseline](../benchmark/v4/baseline.json).

The frozen V4 catalog contains all 88 V3 specifications unchanged plus 88 matched
companions. The design was committed and pushed at `a1837655` before the first
compiler evaluation. The shared V3 scoring implementation, physics, aggregation
weights and 750,000 actual-frame budget remain fixed. See the
[design](../benchmark/v4/README.md) and [static audit](../benchmark/v4/static-audit.json).

The initial draft with compiler `3420e481` scored **900.0351** over 176 specifications ×
seeds 16/17, with 350/352 valid runs and 176 distinct tracks. Its V3 subset scores
**930.1556**, reproducing all 176 archived tracks, scores and frame counts exactly.
The extension-only score is **876.2727**. The actual overall drop is **30.1205**;
the expected 50–100-point drop was not a design target. The predeclared 75%
recovery formula gives **922.6255**, rounded upward to four decimals. See the
[superseded baseline evidence](../benchmark/v4/provisional/baseline.json).

One companion, `stretch_bridge_frontier_dense_recovery`, exhausts its budget
without completing the ride. Both deterministic seeds reproduce that failure.
Other losses concentrate in dense impacts, stronger amplitude contrasts and long
supported passages. As a diagnostic counterfactual only, replacing the incomplete
case's zero by 800–900 would put the full headline at 915.4600–915.7933. Thus
completion alone would recover about half the drop, and the goal also requires
broader quality improvement. No hypothetical score is treated as a compiler result.

## Timing erratum and corrected freeze

Further diagnosis proved that the failing companion contained an impossible
timing request at frames 1371, 1379, 1387 and 1395. Each normal landing needs
three grounded persistence samples followed by six airborne samples before the
next landing: at least 27 frames across the three intervals. The authored span
plus both tolerance endpoints provides only 26. The initial static audit checked
individual air counts but missed this whole-sequence constraint. This was an
authoring/audit defect, not a compiler optimization problem.

The initial draft, baseline, all completed pilots and unfinished studies are
preserved under `benchmark/v4/provisional/` and their original local paths.
Teacher and full-panel optimization studies were stopped. A deterministic
minimum-movement repair changes one authored contact by one frame in that single
companion. It retains every V3 case, contact count, duration and the same requested
target-generation rules. All 176 cases now have independent persistent-contact
timing witnesses. Eighteen contract tests pass, including the impossible triple,
feasible pair and minimum repair. This necessary timing condition still does not
prove that all requested motion axes are jointly attainable.

The corrected catalog was frozen at `98936eeb` before measuring it. Its complete
baseline is 915.6860, with 352/352 valid runs and 176 distinct tracks. The V3
subset reproduces 930.1556 exactly; the extension-only panel scores 901.5040.
The original 75% recovery formula gives 926.5382. No scorer, detector, physics or
frame-budget rule changed.

Completed research cells from the draft can be reused only with identical case
objects, compiler, options, seed and frame allowance. All shared scoring code
and physics hashes must agree. The harness independently scores each imported
track again and records its original cell and plan hashes. The changed case
must be compiled again. This preserves 72 completed teacher cells and 36 full
time-objective cells without claiming they were compiled twice.

A retrieval optimization skips physical-distance arithmetic when the supervised
partition distance already proves an example cannot enter the retained
neighborhood. It preserves all 2,048 compared proposal lists exactly on 512
measured and perturbed queries, and eight policy tests pass. Its local timing
comparison runs alongside other work and is not an end-to-end speed claim.

## Initial recovery experiments

These results use the complete 176-case seed-16 research panel at 750k actual
frames. All cases are valid unless indicated. They require canonical public confirmation before
promotion; the recovery target remains 926.5382.

| Change from the corrected baseline | Headline |
| --- | ---: |
| Preserved compiler | 915.6860 |
| Time-weighted local objective | 912.2860 |
| New initial-proposal forest, existing measured examples | 914.5635 |
| New measured examples and supervised retrieval, existing mean predictor | 919.0800 |
| New mean predictor and new measured examples together | 919.9843 |
| Learned corrections to the existing mean, with new measured examples | **921.5679** |
| New continuation-value predictor alone | 913.6620 |
| Learned mean corrections plus the new value predictor | 920.7629 |
| Learned mean corrections, 80 base / 176 guidance / 161 response allocation | **922.2635** |
| Equal predicted/measured proposal weights | 921.5070 |
| Corrections learned from fixed-prefix teacher queries | 917.4498 |
| Measured examples from fixed-prefix queries (175/176 valid) | 895.5296 |
| Refined allocation plus time-weighted terminal optimization | 920.9307 |
| Combined complete-trajectory and fixed-prefix teaching examples | 927.1957 |
| Combined examples with incoming-feature cache fix (selected) | **926.9397** |
| Refreshed complete-trajectory corrections and examples | 924.5037 |
| Refreshed complete-trajectory examples, existing corrected mean | 925.2330 |

The 3M-frame teacher reaches 926.7191 over all 176 cases, with maximum work
2,915,481 frames. This larger allowance cannot qualify for the public goal.
Independent reconstruction checks 33,046 controls across that complete teacher,
the complete time-objective study and an eight-case time-objective teacher pilot.
The training dataset contains 15,962 non-startup controls from all 176 cases:
148 complete trajectories from the ordinary teacher, 26 from the 750k
time-objective study and two from its larger-budget pilot. Selecting these
training trajectories is not a compiler run or score. See
[transfer provenance](../benchmark/v4/studies/initial-teacher-transfer.json).

The full time-objective regression prevents promoting a tempting pilot result.
Its useful complete trajectories can still teach proposals without forcing that
objective everywhere. Further complete panels test jointly replacing the mean
and measured examples, learning residual corrections to the existing mean, and
updating the continuation predictor. The latter is trained on 73,969 logged
probes; family-held-out mean ranking regret falls from 0.0087109 to 0.0072335.
Its 32 exported predictions match TypeScript exactly. These predictor checks
are not a live compiler score or independent end-to-end generalization claim.

[Frozen-loss counterfactuals](../benchmark/v4/studies/baseline-loss-diagnosis.json)
identify impact error as the largest isolated opportunity in the extension.
Setting only extension impact errors hypothetically to zero would raise that
panel by 19.9076 points; this does not prove joint physical attainability.
An eight-case [geometry audit](../benchmark/v4/studies/pilot-curvature-audit.json)
finds the radius bound active in 51 of 770 accepted arcs, including 14 of the
27 impact errors above 0.1. This motivates testing modestly tighter curvature,
without changing the connected normal-arc primitive. The audit is correlational;
only physical compilation can establish whether the change helps.

The complete selective-curvature prototype scores **900.9156**, with 175/176
valid cases. One track exhausts its budget before the last catch; among all cases,
50 improve and 57 regress relative to 921.5679. Its initial small-panel gains
therefore do not justify promotion. Global tighter-radius pilots and larger catch
offsets are also mixed. Soft offset penalties help some strong impacts but do not
resolve the tradeoff on the diagnostic panel. These are rejected executions,
not evidence that expressive geometry has no further potential. Their exact
patches and paired changes are preserved in the research summary.

The selected research result is now 926.9397, above the 926.5382 target;
canonical confirmation remains outstanding.
The 80/176 allocation retains a nominal total of 256 evaluations but directs
more work to joint arc refinement. These research overrides also raise smaller
duration-dependent allocations and need a production budget formula if selected.
A new 3M teacher query evaluates improved controls at
the exact 921.5679 student arrival states, while forcibly reproducing its original
completed tracks. Its replay headline describes that student, not a new teacher
rollout. Each proposed teacher control must subsequently pass an independent
physical replay at the same prefix and input features. A separate free-running
3M teacher tests stronger complete trajectories. Further 750k studies test
transferring those controls and shifting effort from initial search to joint
refinement. Higher teacher allowances remain outside qualification.

The fixed-prefix query completes with exact reproduction of 921.5679 and all
176 cases valid. Independent replay verifies 16,138 controls (15,962 after
excluding startup) at exact student prefixes and features. See the
[counterfactual transfer proof](../benchmark/v4/studies/replay-residual-transfer.json).
Two candidates independently test corrected mean predictions and replacement
measured examples. Their 24 Python/TypeScript mean fixtures agree within
2.23e-16; this checks export arithmetic, not compiler performance.

The example-only query study exposed a budget-handling defect. A diagnostic
replay exactly reproduces its failed track and work: after validating the final
arc, recording control memory re-reads the incoming velocity and requests one
additional frame beyond the construction limit. This read sits outside the
search-interruption handler, so the valid final arc is never committed. The fix
reuses incoming features already measured before candidate construction, both
for control memory and teacher-query records. No physics work is refunded.
The failed case now completes at 891.2618 within 750k. A 5,050-frame regression
fixture reproduces the defect and passes with the fix; all 18 focused tests pass,
and TypeScript retains the same 251 inherited diagnostics. See the
[repair proof](../benchmark/v4/studies/arrival-cache-budget-repair.json).
The complete fixed compiler with queried examples scores 922.7930, all 176 valid.
Combining the initial complete-trajectory and queried datasets gives 31,924
measured actions and reaches 927.1957 before the cache fix, or **926.9397** with
the fix. The latter is selected for canonical validation. The original normal-arc
geometry is unchanged.

Production caps base search at 80 and joint guidance at 176, reserving 161/176 of
guidance for the response solver. Guidance grows as 1.5 times the preceding
budget-dependent guidance allowance, while proposal and continuation quotas keep
their existing calibration. All non-model options, model bytes and shared solver
sources match the selected research candidate across all 176 cases. Direct JSON
data loading resolves the larger model's test-transform import failure without
changing its values. All 121 focused tests across 29 files pass after rerunning
the eight affected import suites; TypeScript retains 251 inherited diagnostics.

The stronger free-running 3M teacher reaches **931.6814**, all 176 cases valid.
The refreshed, replay-validated dataset chooses 78 complete trajectories from
that teacher, 40 from the original teacher, 22 from the refined allocation,
15 from equal proposal weights, 14 from the original residual policy, five from
the time-weighted 750k study and two from its 3M pilot. This selection supplies
training controls, not a new rollout or headline. New complete panels test its
measured examples and a newly fitted correction to the original mean predictor.
Higher-budget teachers cannot qualify for the public target. All selected
changes require the complete 176-case suite at 750k and canonical public confirmation.

The compiler must retain substantial coherent normal type-0 arcs. Runtime learned
features may describe physical state and upcoming targets, without benchmark case
or seed identifiers. No acceleration lines or point constellations. New cases are
related development programs, not independent musical works; no new audiovisual
approval or generalization claim is made. Code and compact evidence are pushed;
raw tracks, research datasets and unselected models remain local.
