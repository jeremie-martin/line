# Candidate evaluation and reporting

Reference: `4d2346e8`, after the qualified prefix-scoring change. Work stays on
`perf/compiler-after-foundations`. These are new, separately frozen structural
trials; the earlier trials retain their original decisions.

## Final performance result

The adopted candidate combines one shared fact record, fixed future features
prepared per interval, minimal residual storage and reporting-only grain.
Production/research TypeScript is 49 lines smaller, excluding tests and docs.
There is no new cache or compatibility path; native source and binary are unchanged.

| Fixed experiment | Paired median time change | Confidence interval | Result |
| --- | ---: | ---: | --- |
| [Larger screen, 12 pairs](engine-candidate-reporting-20261104-screen.json) | −3.733% | [−4.244%, −3.390%] | FASTER at 2% |
| [Fresh larger confirmation, 24 pairs](engine-candidate-reporting-20261104-confirm.json) | −3.643% | [−4.002%, −3.090%] | FASTER at 2% |
| [Default guard, 12 pairs](engine-candidate-reporting-20261104-default-guard.json) | −1.739% | [−2.222%, −0.465%] | Non-regression guard passes |

Intervals request 95% confidence; exact discrete coverage is 96.14% for 12
pairs and 97.73% for 24. Descriptive process medians in confirmation are
7,345 → 7,081 ns per charged physics frame; the default guard is 7,548 → 7,432.
These include compilation/search/observation time, not just isolated physics.
Medians of paired changes and ratios of separate arm medians need not coincide.
The default 7,000 ns target remains unmet.

All 774 warmup, timed and resource compiles match exact tracks and charged work.
WASM capacity stays 32.5 MiB on the larger workload and 17.3125 MiB by default.
Fresh-process peak RSS observations are 533.47 → 511.27 MiB (screen),
519.74 → 513.18 MiB (confirmation), and 357.94 → 330.17 MiB (default).
All resource guards pass; these individual peaks are not statistical estimates
of retained-live allocation savings.

`npm run check` passes: zero TypeScript errors and unreachable files, 442 JS
tests, 29 Rust tests, 65 saved and live physics cases (68,827 exact states and
432,018 ordered collisions, plus raw/body/contact observations), 63 exact
compiler cases and 33 judge tracks. Complete checkpoints and JSON field order
also match the reference on both measured cells. All 20 frozen source/test
files match after validation; the only later edit removes an empty trailing
line from the test reference. Executable measured sources remain unchanged.

The [diagnostic archive](engine-candidate-records-20261104-diagnostics.json)
retains every trial's patch, frozen-file hashes, measurement/shadow drivers,
validation logs, operation counters and profile summaries. Local raw Inspector
profiles are copied to `generated/engine-candidate-records-20261104/` with hashes
in that archive. Raw timing records linked here retain every iteration and
their source, native-binary, runner and environment identities. The final code
qualifies under both the original 2% rule and the owner's revised adoption policy.

## Diagnostic profile

Fresh V8 Inspector profiles use CPU 2, five warmups, three profiled compiles and
250 us sampling. Inspector-control stacks are excluded from the reported sample
shares. Exact tracks and charged work hold throughout. Native stepping and its
collision lookups remain the largest costs; garbage collection accounts for
7.56% / 8.44% of default / larger-workload application samples. Candidate
recording accounts for 4.78% self samples on the larger workload. These are
sampled attribution, including possible inlined callees, not timing evidence.

## Closed query-normal trial

A private neighborhood entry stored its immutable normal components alongside
the existing borrowed line pointer. Direction filtering read contiguous values
while position/response calculations retained the original geometry. Query
order, duplicates, invalidation, ownership and arithmetic were unchanged.

The predeclared default-cell-61 screen required FASTER at a 2% practical margin
with 12 v3 pairs; adoption also required fresh confirm24, a larger-cell-62
guard12 at +2%, at most 5% higher WASM capacity and 15% higher peak RSS.
All 30 Rust tests and all 65 saved/live physics cases passed, including exact
raw/body/contact observations. Typecheck and reachability passed.

The fixed [screen](engine-query-normals-20261104-screen.json) is EQUIVALENT:
+0.231% paired median change, interval [−0.405%, +1.114%]. It fails the speed
requirement. No guard, confirmation, extended sample or adoption follows.
Source and packaged native artifacts are restored exactly. The diagnostic
archive retains the candidate patch and validation logs.

## Initial candidate-record consolidation

Successful candidate evaluation previously created seven overlapping records:
a live result, an owned measurement copy, a candidate, its metadata, a second
measurement copy, a copied candidate and a memo wrapper. The same facts had
several names and restoration paths.

The candidate consolidates these into one read-only measurement/arrival record
shared by the list and memo, plus the live evaluation that adds its engine.
There are two records per fresh success. Memo reuse still creates an owned
control-adjusted candidate and a separate live evaluation. Native wrappers never
enter a memo. Removed `measurement`, `meta` and memo `result` layers have no
compatibility aliases. Search, recovery, refinement and research consumers use
the same record; reporting fields are projected at selection.

A negative type contract rejects live engines in memos and reassignment of
shared candidate facts. Nine focused tests cover memo reuse, budget interruption,
recovery, terminal selection, scattered incumbents and counterfactual isolation.
Separate processes compare complete default/larger checkpoints with the original
using `assert.deepStrictEqual` after V8 serialization, including signed zero and
nonfinite values. Both agree exactly, beyond just tracks and work counts.

Adoption requires cell 62 FASTER in fixed screen12 and fresh confirm24 at 2%,
plus default-cell-61 guard12 bounding regression at +2%. CPU 2, five warmups,
three repeats per fresh process, requested 95% confidence, order seeds 1729
(screen/guard) and 2718 (confirmation). WASM capacity must remain unchanged;
peak RSS may rise at most 15%. Full structural correctness and design gates
remain separate. Sources are frozen before timing; no heavy work overlaps it.
An unchanged trial is never extended or restarted. This workload cannot
establish the default 7,000 ns/frame target.

The fixed [screen](engine-candidate-records-20261104-screen.json) measures
−1.140% [−1.585%, −0.008%], EQUIVALENT within ±2%. It does not meet the 2%
speed requirement; there is no confirmation or adoption of this version.
The [default guard](engine-candidate-records-20261104-default-guard.json) is
EQUIVALENT at −0.331% [−0.933%, +0.320%]. All 388 warmup/timed/resource
compiles retain exact tracks and work. Both resource guards pass.

## Separate facts from live handles

The follow-up removes the remaining whole-record spread. An evaluated candidate
pairs `{candidate, child}`: facts stay in their single owned record and only the
wrapper owns a live engine. Local search reads that record directly; selection
and refinement consume the explicitly selected candidate, removing the metadata
fallback lookup. Every affected consumer is adapted without compatibility aliases.

This is a new candidate against the same `4d2346e8` reference, independently
subject to the same screen12/confirm24 2% speed threshold, default guard12,
resource limits and correctness gates. It does not extend the failed sample.
Nine focused tests and type/reach checks pass. The memo test freezes measured
facts during real search and checks that reuse, cleanup and budget interruption
leave them unchanged. Complete default/larger checkpoints again match the
reference exactly. Type-only refinement annotations were tightened before the
freeze; the reporting/search behavior is unchanged. The candidate is frozen and
its independent screen is complete: −1.172% [−1.570%, −0.833%],
EQUIVALENT within ±2%. The speed gate fails. No confirmation or adoption
follows. The [default guard](engine-candidate-handles-20261104-default-guard.json)
passes at −0.732% [−1.249%, −0.376%], EQUIVALENT. All 388 warmup/timed/resource
compiles match exact tracks/work; both resource guards pass. At the owner's
request, retain this as an unadopted experimental base for a complementary
change. The closed results above remain unchanged.

## Combine ownership with fixed future features

Fresh profiles of the separate-handle candidate put recording at 3.78% self
samples on cell 62. Counters in an isolated source snapshot find 16,299 future
value feature constructions across 425 eligible interval searches. The future
targets and construction descriptors are identical for every candidate in an
interval; only its physical arrival changes. Default cell 61 never enables this
model. The same diagnostic finds zero excess-amplitude rescans in either cell,
so that initially considered path is left alone.

Split future feature encoding from arrival encoding. Opening a search prepares
its fixed future suffix once, and each candidate concatenates its arrival onto
that suffix. The resulting 57/67 proposal and 73 value feature vectors remain
exact. The interval lifetime matters: construction fallback can update the plan
between searches, so a compile-wide cache would be the wrong boundary. There is
no new cache, model format, compatibility alias or scoring path.

This combined candidate is independently compared with `4d2346e8` under the
same declared screen12/confirm24 2% policy, default guard12 and resource limits.
It does not measure the incremental speedup over the separate-handle prototype.
Before freezing, typecheck/reach and all 13 focused tests pass. Tests cover the
feature ordering, absent future supports, explicit section-style overrides,
plan changes between searches and candidate ownership with future value both
enabled and disabled. Full checkpoints again match the reference exactly on
both cells.

The fixed [screen](engine-candidate-combined-20261104-screen.json) measures
−2.470% [−2.798%, −1.960%], INCONCLUSIVE at 2%. Its bound narrowly misses
the declared speed requirement; the point estimate alone does not qualify it.
The [default guard](engine-candidate-combined-20261104-default-guard.json) passes
at −0.835% [−0.979%, −0.498%], EQUIVALENT. All 388 compiles match tracks/work
and both resource guards pass. No confirmation or extra pairs are run.

## Reuse the trajectory prefix within an interval

The next distinct candidate also replaces per-evaluation prefix concatenation
with one interval-owned working trajectory. Counters find 28,113 reusable
replays copying 25,021,462 unchanged prefix entries, compared with 669,523 new
suffix entries, in cell 62. Default cell 61 copies 4,431,336 prefix entries
across 5,141 reusable replays, compared with 117,886 suffix entries. There are
also 869 / 256 full replays (larger / default); these retain the existing full
native read when geometry invalidates the prefix.

Opening an interval copies its prefix into the working array once. Each
successful reusable replay truncates the previous suffix and appends the newly
read frames. Evaluation consumes this array synchronously, alongside borrowed
detector columns. The original prefix remains separate and immutable for
terminal scoring. Candidate records retain owned facts, never the working
array. This reuses storage at an existing lifetime boundary without another
cache, wrapper or alternate measurement formula.

Typecheck/reach, 27 focused tests and exact complete checkpoints on both cells
pass before freezing. A new real-engine test freezes the immutable prefix,
evaluates successive controls, compares the working trajectory with a full
native read, and checks that retained facts remain unchanged after reuse.
The same independently declared screen12/confirm24 2% policy, default guard12,
resource limits and full structural gate apply against `4d2346e8`.

The fixed [screen](engine-candidate-trajectory-20261104-screen.json) measures
−2.052% [−2.588%, −1.693%], INCONCLUSIVE. The
[default guard](engine-candidate-trajectory-20261104-default-guard.json) passes
at −0.759% [−1.226%, −0.287%], EQUIVALENT. All 388 compiles match tracks/work
and the resource guards pass. No confirmation or extra pairs are run. Remove
the working-array change from the next candidate; the earlier facts/future
implementation remains its base. These separate comparisons do not establish
an incremental regression from workspace reuse.

## Minimal facts and reporting-only geometry

The next audit finds two eager residual slices in each measured candidate:
`arrivalResiduals` has no consumer, and only a research report reads
`localResiduals`. Store one residual vector and its local partition count; that
report takes its slice when needed. Remove `optimizationCost`, which always
equals `cost`. Selection and response search now read that single value.

Grain measures geometry and never enters the search objective. Separate
trajectory measurement from the complete report: candidates retain trajectory
axes, and a reporting projection adds grain from the selected lines. Both full
gap measurement and candidate reporting use the existing grain reduction and
canonical axis field order. This removes the duplicated inline grain formula
and avoids sorting unselected candidates' line lengths. The legacy impact
fallback likewise requests just its impact reduction. Remove the unused
ballistic-prefix summary and stale comments from the affected measurement
module. The trajectory workspace experiment is absent.

Before freezing, typecheck/reach and 29 focused tests pass. A frozen full-axis
implementation from `4d2346e8` checks values and field order across window
offsets, empty/out-of-range spans, missing/nonfinite velocities, signed zero,
and empty/odd/even/nonfinite geometry. Complete default/larger checkpoints
match both by deep equality and by JSON serialization, covering field order
as well as every value. The same screen12/confirm24 2% policy, default guard12,
resource limits and full structural gate apply independently against `4d2346e8`.

The screen passes at −3.733% [−4.244%, −3.390%], FASTER at 2%. The default
guard passes at −1.739% [−2.222%, −0.465%]: it bounds regression below +2%,
although its two-sided verdict is INCONCLUSIVE at the ±2% margin. Both resource
guards pass, and fresh confirm24 starts with the same frozen source.

During confirmation, the owner asks to replace the rigid 2% adoption minimum
with an engineering judgment that weighs evidence of benefit and design quality.
The fixed experiment and its reported 2% verdict remain unchanged. Exact
correctness, a clean implementation and no unresolved meaningful regression
remain required; a narrow miss around 2% is no longer an automatic veto.
