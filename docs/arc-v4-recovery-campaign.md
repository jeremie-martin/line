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

Research starts with an exact-reproduction check of the independent study harness,
then compares time-weighted optimization and construction allocation on a declared
eight-case diagnostic panel. A complete 3M-frame teacher panel tests what the
existing geometry can achieve with more search; that budget cannot qualify for
the public target. All candidate selection must be confirmed on the complete
176-case suite at 750k and then through the canonical public entry point.

The compiler must retain substantial coherent normal type-0 arcs. Runtime learned
features may describe physical state and upcoming targets, without benchmark case
or seed identifiers. No acceleration lines or point constellations. New cases are
related development programs, not independent musical works; no new audiovisual
approval or generalization claim is made. Code and compact evidence are pushed;
raw tracks, research datasets and unselected models remain local.
