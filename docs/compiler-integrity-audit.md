# Compiler integrity audit, September 2026

Work branch: `codex/compiler-integrity-audit`, starting from `990a6067` and
771.3015. The owner requested code inspection, analysis of retained measurements,
new experiments, and fixes supported by reproductions. This audit changes the
compiler; the V2 benchmark, scorer, authored targets, detector, physics and
actual-frame accounting remain fixed. Production uses coherent normal type-0 arcs.

## Method and coverage

The audit follows the implementation from public dispatch through timeline
validation, scheduling, geometry, local search, guide/response proposals, learned
value, continuation planning, backtracking, optional suffix repair, cold replays
and public reporting. It also inspects the shared engine/cache/meter interfaces,
Rust handle/cache behavior, compile lifecycle, legacy routing/input/register and
budget-capture boundaries, and the retained mechanism inventory.

The current arc implementation and these interfaces received detailed inspection.
The much larger historical aiming/readiness/search implementation received
boundary and targeted call-site inspection, not a fresh line-by-line verification
of every historical branch. The 251 existing TypeScript diagnostics remain a
separate limitation. This report does not certify that the entire repository is
free of defects.

The retained canonical run has 44 sources × 8 seed slots = 352 compiles. With
zero target jitter, these are 44 distinct tracks. Distributions below collapse
those repeats; the seed slots are not presented as independent robustness trials.
New instrumentation records scalar counters and geometry hashes without making
extra engine reads, because shared cache invalidation can make observation itself
change work. All 44 instrumented tracks, reports and frame counts match the
accepted reference exactly.

Raw evidence and executable probes are under
`generated/benchmark-v2/compiler-integrity-audit/`; the preservation index links
the local archive. Negative and inconclusive experiments are retained too.

## Findings and dispositions

| ID | Finding | Disposition |
|---|---|---|
| A1 | Repeated proposals evaluate identical geometry in the same prefix. | Reuse completed exact evaluations in production. |
| A2 | Recursive planning loses a completed branch when a sibling hits the frame limit. | Preserve the completed winner; propagate interruption if none exists. |
| A3 | Accepted suffix reflow leaves later row controls and measurements stale. | Update every rebuilt row on acceptance. |
| A4 | Exhausted backtracking can erase all completed intervals. | Restore the deepest completed prefix before cold replay. |
| A5 | Proposal allowances leave response remainders unused; full-prefix detection repeatedly rescans cached frames. | Measured opportunities; no speculative detector or allocation rewrite. |
| A6 | Progress can be attributed to the preceding beat; a changed traversal model inherits old calibration claims. | Attribute by contact position and explicitly mark the model unvalidated. |
| A7 | Nonfinite timeline values, unsorted contacts and obsolete early-contact filtering violate input/report contracts. | Validate before routing; order whole contacts; preserve authored early beats. |
| A8 | Empty line batches create two wrappers owning one native handle. | Avoid those aliases at arc compiler construction/replay/repair call sites. |
| A9 | Quality retry affordability uses the current frame although the retry may start earlier. | Estimate from the actual restart boundary, including rebuilding its prefix. |

### A1 — exact candidate reuse

Across 44 headline tracks, 1,338,916 proposals include **130,698 repeated exact
geometries** and 115,857 repeated normalized controls. Repeated geometry consumes
**3,189,340 physics frames**, 10.12% of the total 31,511,204. These are measured
same-search duplicates, not a comparison of visually similar curves.

The cache is scoped to one search's fixed physical prefix, interval, targets and
options. Its key includes every normalized geometry control and the implicit
clearance default. Absent guide endpoints remain distinct from explicit full-span
endpoints: the latter have a minimum-length rule. Signed zero and nonfinite values
are represented separately. Only completed evaluations and definitive rejections
are cached. Interrupted proposals never enter the cache.

A hit retains the proposal and viability accounting used by search. It recreates
a live child from the validated lines; it never reuses a wrapper that
`retainOnly` may have released. Subsequent simulation and the final two cold
replays remain charged normally. Production enables `memoCandidates`; raw
historical research settings remain opt-in, and an explicit false is the ablation.

With fixed breadth and no adaptive planning/retries, three independent synthetic
contexts (ordinary, changed start, jitter) preserve complete track/report equality,
proposal counts and viability counts. Work changes respectively from 21,831 to
18,557; 20,547 to 17,490; and 21,276 to 18,577 frames. Both valid and rejected cache
hits are exercised. Budget-limited search can make different later decisions with
saved work, so these equality tests do not imply equal budgeted outputs.

The isolated memo experiment gives 777.8193 at 750k, 44/44 valid, using 30,330,979
frames across the suite: **3.75% less work**, not the entire 10.12% duplicate cost.
Saved work partly funds different decisions. At 1M it gives 805.7234, 44/44 valid.
At 150k it initially regresses from 504.1253 to 495.0579, with 39/44 valid in both.
One formerly incomplete track completes, while a different track loses completion.
That adverse result led to A9 rather than a budget-specific cache gate.

### A2 — recursive interruption safety

A 250-cell independent synthetic panel varies budget from 4,000 to 35,000 and
planning depth two/three. Instrumenting the old recursive loop identifies **14
cells with a completed winner discarded by a sibling interruption**. All 14
retain that winner after the fix. Hit counts and total frames stay unchanged in
this panel: the demonstrated benefit is preserving completed planning information,
not a claimed headline or completion gain.

Only fully returned continuations compete. Without a completed branch, a frame
limit exception still propagates; strict horizons do not turn partial work into a
completed plan. Non-budget exceptions still propagate. The prior 10,500-frame test
used unsupported boolean guidance and described one of these completed branches
as partial. It is replaced by a supported-clearance reproduction in
`tests/arc_integrity.test.ts`; the no-usable-proposal test remains.

Evidence: `planning-before.json`, `planning-after.json`,
`planning-comparison.json`, the original instrumented source and probe scripts.

### A3 — reflow metadata must describe the accepted continuation

The first generous-search probe did not reproduce stale rows: either no reflow
was accepted or the retained controls happened to remain the same. A stronger
repair-relative-to-construction probe (24 initial samples; following searches of
12 or 24 samples) does reproduce it. Accepted tracks contain a changed interval
whose stored row still contains its former controls.

The check reconstructs each interval from the actual preceding geometry, recorded
control and measured incoming state, then compares every line. Those independent
reconstruction reads are explicitly outside compiler work accounting. Both failing
variants reconstruct exactly after the fix. With 12 following samples, two repairs
are now accepted instead of one because subsequent repair sees the updated
continuation. Loss remains nonincreasing and the complete track remains valid.

Anchor metadata and each reflow row now carry the accepted controls, local cost,
achieved axes, impact, release, line count and work observation. Old lookahead
annotations are cleared. Retained alternatives remain proposals subject to fresh
physical evaluation; inspection did not establish unvalidated reuse of an old
prefix state. Completed-track repair remains disabled in production defaults.

### A4 — preserve progress through exhausted backtracking

An initial 60-cell random panel completes all cases despite 190 backtracks and
does not demonstrate a defect. A controlled short dead end does: contacts at
0.6, 1.2, 1.35 and 1.95 seconds complete two intervals, then exhaust 80 backtracks.
The old compiler returns zero rows and zero hits after 12,257 frames. The fixed
compiler returns the two completed rows and one authored hit at the same work.
It correctly remains incomplete; V2 does not receive a valid-track score for it.

The compiler snapshots its deepest completed prefix immediately before a
destructive backtrack, rather than copying the entire track on every commit.
Recovery still goes through both cold replays. Evidence:
`prefix-deadend-before.json`, `prefix-deadend-after.json` and regression tests.

### A5 — further efficiency work has measured targets

The observation run visits **1,124,889,977 detector frames** while charging
31,511,204 actual physics frames. Prefix reads are cached, but `detect` still
rescans the assembled trajectory. One sampled CPU profile of `river_reentry`
attributes about 11.7% inclusively to `detect` and 8.6% to its own body. This is one
profile under concurrent load, not a controlled wall-time speedup measurement.
An exact incremental representation could be useful, but it must preserve event
history and complete cold-replay parity without changing the frozen detector.

Coupled response fitting consumes batches of `2 * dimensions + 3` proposals. The
allocation subtracts the requested allowance before rounding to complete batches,
leaving up to 22 proposal slots unused for ten dimensions. At the maximum shipped
allowance, 70 reserved slots execute three 23-slot batches, leaving one. A singular
response solve can leave more slots unexecuted. This is unused proposal allowance,
not uncharged physics or automatically wasted runtime: later planning may use the
remaining physical budget. Reallocation needs an explicit experiment.

Continuation planning accounts for 6,392,709 frames (20.29%), 6,575 probes and 339
failed probes, changing 1,595 local choices in the retained reference. These counts
identify a substantial cost center; they do not establish that planning is wasteful.

### A6 — distinguish observation from calibrated policy

The old public wrapper locates a reached contact with `gap.endFrame >= row.frame`.
An exactly timed contact is then assigned to the preceding interval, while a
one-frame scheduling shift can change its attribution. Row/contact position is
the stable identity. A public trace regression now checks every reached contact.

The shared recorder accepts a custom traversal model but previously copied the
legacy model's calibrated flag and applicability verdicts. Arc coefficients and
model identity differ. The recorder now verifies the traversal model identity and
coefficients before claiming that calibration applies. Different models report
`unvalidated_traversal_model`, no calibrated completion margin, and conservative
uncertainty bounds. Point estimates remain visible as unvalidated estimates; the
arc planner does not use this recorder for decisions. Existing legacy calibration
semantics are retained and covered by the shared recorder tests.

### A7 — the authored timeline is a contract

Before validation, infinite duration hangs the frame-by-frame validation loop;
NaN duration fails later with an unrelated trajectory error. NaN contact time is
silently removed by fallback filtering. Reversing a six-contact array yields no
hits despite the chronological equivalent completing. These are reproduced in
isolated child processes; the infinite-duration reproduction has a five-second
timeout, not an invented completion time.

The new compiler boundary checks finite, representable timeline values before
routing or iteration and orders whole contact objects without mutating input.
Impact remains attached to its authored contact. Ordered specifications retain
object identity. Telemetry option validation is consistent across entry points.
A raw arc allowance that only covers the two final replays now gives an explicit
construction-work error instead of trying to install a zero frame limit.

The legacy fallback's early-beat filter assumed only long-airborne landings could
satisfy a contact. The current fixed detector also recognizes bounces for very
short intervals. Removing the obsolete filter preserves all authored targets.
A fresh independent judge replay confirms all seven reported contacts, including
0.025 seconds, for the early-beat probe. Its 180 replay frames are recorded
separately from compiler work. Neither detector nor scorer changes.

Duplicate/same-frame contacts are not silently merged or removed; they can still
produce an incomplete result. Sub-frame positive durations on the legacy path
retain their earlier behavior. These checks are not a complete schema redesign.

**Remaining defect:** the legacy search checks its hard budget after an atomic
expansion, rather than enforcing an interruptible limit throughout that expansion.
The early-beat probe consumes 30,770 frames against 30,000; the meter and overrun
telemetry report that work honestly. Fixing this requires preserving a registered
incumbent and closing telemetry episodes when any nested expansion is interrupted,
including bootstrap before an incumbent exists. An outer catch that discards all
work would recreate A2. This audit does not claim that defect is fixed. The active
arc path enforces the hard limit and retains its two replay reserves.

### A8 — native handle ownership

`addLine([])` returns another JavaScript wrapper for the same native handle. Both
wrappers register finalizers, so collecting either can invalidate the surviving
one. An isolated `--expose-gc` reproduction changes a live engine's last frame from
0 to -1 and returns an invalid zero state after collection. Avoiding the empty
batch keeps the live rider state identical across the same collection cycles.

`createArcEngine` handles empty construction/rebuild/repair prefixes without this
alias; final judge replay also skips an empty batch. No native physics or engine
wrapper implementation changes. This demonstrates a lifetime hazard, not an
observed production crash: synchronous compilation usually does not yield for
finalizer delivery. Other consumers of the shared wrapper still need the same
ownership discipline or a separately verified wrapper-level fix.

### A9 — retry admission must include the path it actually rebuilds

At 150k, exact candidate reuse makes `frontier_low_air_endurance_4s` admit
additional quality retries, increasing backtracks from 28 to 33 and ending with
89 of 90 authored contacts. The old affordability expression estimates the
remaining suffix from the current frame. The actual backtrack can resume at an
earlier fork, and its engine is rebuilt cold. That omits part of the work the
admission decision is meant to estimate.

The fix locates the next backtracking alternative and estimates from that fork's
frame, adding the cold prefix rebuild. It keeps the existing sample-based heuristic
and safety factor: this is a corrected estimate, not a mathematical guarantee that
all future search fits. The actual frame limit remains authoritative. No named
specification or benchmark budget enters the rule.

The full 150k panel changes exactly two tracks relative to memo-only search:
`frontier_low_air_endurance_4s` and `frontier_dense_recovery` both complete. The
result is **509.7855, 41/44 valid**, compared with memo-only 495.0579, 39/44 and the
accepted reference 504.1253, 39/44. Across all 44 cases at 750k and 1M, the corrected
retry rule preserves the memo-only scores (777.8193 and 805.7234); the 750k tracks,
reports and actual frames are all exactly equal. The final public 150k rerun
confirms the same 509.7855 result. Regression tests exercise both recovered cases.

## Final results and preservation

The combined compiler is promoted as `compiler-integrity`, source commit
`2d724c7e`, candidate fingerprint
`baf7999a450270741ef0730fedb4b1cac3ddfc9b6cc1f9708ae20c6599cf1fc1`.
The canonical comparison accepts at the unchanged N=8 look, from a declared
maximum of 48 seeds. All scorer, suite, execution and judge identities match the
accepted reference. No benchmark or detector implementation changes.

| Measurement | Accepted reference | Final compiler |
|---|---:|---:|
| Canonical 750k headline | 771.3015 | **777.8193** |
| Canonical valid, 44 cases × seeds 16–23 | 352/352 | **352/352** |
| Physics frames, one distinct 44-case headline panel | 31,511,204 | **30,330,979** |
| Full 150k development panel, one seed | 504.1253; 39/44 valid | **509.7855; 41/44 valid** |
| Qualification monitor, 120 reused diagnostic runs | 698.5414; 120/120 valid | **707.3395; 120/120 valid** |
| Full 1M public compiler panel, one seed | — | **805.7234; 44/44 valid** |

The +6.5178 headline gain is accompanied by 3.75% less physics work on the
headline panel. Not every case improves: 33 of 44 improve and 11 regress at 750k.
The unchanged catalog-sensitivity calculation gives a 95% interval of
+3.5624 to +9.4739. Seed variation is zero on the canonical zero-jitter tracks;
that is not evidence of 352 independently successful geometries.

A separate final-source stress run uses jitter 0.02 and seeds 101–104 over all
44 cases: **176/176 valid, 176 distinct tracks**, maximum 708,673 charged frames.
The retry correction preserves every track, score and statistic from the prior
memo-only jitter run. Its unweighted mean cell score is 763.8003; this is a stress
measurement, not another canonical headline. Qualification is reused diagnostic
evidence, not a new holdout: its per-budget monitors rise from 600.1427, 701.5806
and 759.0753 to 611.0994, 711.1263 and 765.1882 at 250k/500k/750k.

The correctness changes before reuse preserve every headline track, complete
report and frame count. The final source passes **79 tests in 13 files**.
TypeScript comparison adds no diagnostics: 251 in both reference and candidate.
Geometry inspection covers 4,100 intervals: 1,056 single curves and 3,044
support/guide pairs; all 281,996 physical segments are normal type 0. No point
controls or acceleration geometry are introduced. No new videos were rendered.

The remaining concrete priorities are interruption-safe hard limits in the legacy
fallback, ownership-safe empty-batch handling for other wrapper consumers, and
exact prefix detection reuse. Response-allocation remainders are a separate
measured hypothesis. Three 150k cases remain incomplete. Further work should
preserve these distinctions between a confirmed defect and an unproven speedup.

[Compact validation](../benchmark/v2/studies/compiler-integrity-audit-validation.json)
contains identities, results, reproductions and hashes of the local evidence.
Rebuild it with `python3 scripts/benchmark/analyze_compiler_integrity.py` after
restoring the local archive. The [archive index](../benchmark/v2/studies/compiler-integrity-audit-local-archive.json)
records checksums and restoration details. Large raw traces, tracks, profiles and
source snapshots stay local; code, regression tests and compact evidence are pushed.
The accepted 771 branch and the intermediate memo-only 777 source remain preserved.
