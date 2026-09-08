# Planning continuity at the frame budget

September 2026. Active branch: `codex/arc-planning-continuity`.

The active compiler is **771.3015**, promoted through the unchanged headline
gate. This adopts the previously accepted continuation-boundary value research
and fixes the general defect behind its qualification failure. The original
767.6851 compiler and the intermediate 771 compiler remain preserved.

## What qualification meant

The previous candidate passed the complete canonical headline evaluation:
44 development cases × seeds 16–23 at 750k, **352/352 valid**. Separately, the
qualification panel had **119/120 valid**, with one missing final contact at
250k. The scorer already assigns invalid runs zero; the canonical evaluation
had not failed. The prior non-promotion decision added a conservative veto.
The owner clarified that aggregate headline performance governs the campaign.
Qualification remains useful diagnostic evidence, with its regressions disclosed.

This does not change the benchmark, scorer, authored targets, catalog, physics,
validity rules or actual-frame accounting. Tracks still use coherent, visible
physical arcs made entirely from normal type-0 lines.

## Root cause and correction

The failed run was `amour_de_ma_vie_short_44s`, seed 0, at 250k. It spent
249,985 frames and returned 84 of 85 contacts after 34 backtracks. Diagnostic
instrumentation found **24 fully evaluated alternatives for the final interval**
before a frame-limit exception escaped the entire compile loop. None was committed.

Local search now retains and commits its fully validated best-so-far curve when
another proposal exhausts the frame allowance. Continuation planning likewise
preserves the validated current curve and any fully returned plan. If there is
no validated candidate, the interruption propagates. A partially explored deeper
continuation never counts as a completed horizon. Unrelated errors propagate.
Search exhaustion remains visible in telemetry even when the retained track
completes. Search, reconstruction and both final cold replays remain metered.

This fixes a state transition, with no song-specific fallback, budget-specific
threshold, extra samples, scoring adjustment or geometry change. The original
failure now completes all **85 contacts at the same 249,985 frames**.

## Measured results

| Panel | Original 767 compiler | Intermediate 771 compiler | Finished compiler |
| --- | ---: | ---: | ---: |
| Canonical headline, 750k | 767.6851 | 771.3015 | **771.3015** |
| Canonical validity | 352/352 | 352/352 | **352/352** |
| Full 44-case development panel, 150k | 481.1128 | — | **504.1253** |
| Development validity, 150k | 38/44 | — | **39/44** |
| Qualification monitor, three budgets | 691.0046 | 681.9938 | **698.5414** |
| Qualification validity | 120/120 | 119/120 | **120/120** |
| Qualification monitor, 250k | 601.2726 | 517.4043 | 600.1427 |
| Qualification monitor, 500k | 690.5581 | 701.5806 | 701.5806 |
| Qualification monitor, 750k | 751.5702 | 759.0753 | 759.0753 |

All **352 canonical tracks, reports, scores and frame counts** match the
intermediate 771 compiler exactly. Its boundary-value change supplies the
+3.6164 headline gain; the interruption fix adds completion reliability.
The combined release passed the ordinary first N=8 look, with a declared N=48
maximum, against the preserved original 767 reference. Promotion was not forced.
The resulting normally generated manifest was installed as the active baseline;
the separate original-reference file was restored for reproducibility.

At 150k, `regression_amplitude_mosaic_contrast_10` changes from invalid zero to
516.327 at the same 149,995 frames. All 38 previously valid tracks remain exact.
Three other partial tracks change but remain invalid and score zero. Five of
44 cases still fail at this allowance. This is a one-seed development panel,
not an additional canonical headline.

Qualification comprises five sources, three budgets and eight seeds per budget.
Only the originally failed run changes: its score goes from zero to 372.5599.
The other 119 tracks, reports and frame counts are exact. All runs stay within
their budgets. The 250k monitor remains 1.1299 below the original compiler;
the overall monitor is 7.5368 higher. After diagnosis, this is a reused regression
panel, not a fresh holdout or a new selection objective.

## Independent checks and limits

An independent four-second synthetic specification was evaluated at 78 matched
budgets from 600 to 16,000, step 200. The fix gains five valid settings
(4,800–5,600), with no validity losses: 57 valid versus 52. A separate depth-two
planning interruption retains an additional validated interval at exactly
10,490 frames and correctly leaves the unfinished track invalid. Neither test
requires changing the production configuration.

There are **53 passing focused tests across seven files**: 52 passed in the
initial run, and all five interruption tests passed after adding the final
planning regression. They cover retained valid candidates, no valid incumbent,
interrupted deeper planning, truthful exhaustion telemetry, unrelated exceptions,
connected arcs, continuation value, refinement and budget accounting. The
repository TypeScript check has the same **251 pre-existing diagnostics**, with
no added or removed diagnostics against the intermediate compiler.

Canonical zero-jitter seeds repeat **44 distinct tracks**, not 352 independent
geometries. Seed SE is zero; the unchanged catalog sensitivity interval for the
headline gain is [1.7381, 5.5258]. The intermediate compiler's separate 176-track
jitter study remains supporting boundary-value evidence; it was not rerun for
this interruption-only fix. No new videos were rendered in this follow-up.

The result supports keeping an explicitly validated incumbent throughout
planning. Future research can build on this to reconsider construction reserves,
continuation reuse and completed-track repair, judging each by aggregate results
and retained failure evidence. There is no new performance ceiling or research cap.

## Evidence and preservation

- [Compact validation and checksums](../benchmark/v2/studies/arc-planning-continuity-validation.json)
- [Local archive manifest](../benchmark/v2/studies/arc-planning-continuity-local-archive.json)
- [Local archive index](../archives/arc-planning-continuity-2026-09-08/index.html)
- [Adopted boundary-value research](arc-continuation-boundary-study.md)
- [Cleanup audit](compiler-foundations.md)

The raw reports, checkpoints, synthetic comparisons, frozen compiler snapshot,
judge and promotion artifacts remain local under
`archives/arc-planning-continuity-2026-09-08/`. Code and compact evidence are pushed.
Preservation branches are `archive/arc-continuation-boundary-771` for the
intermediate compiler and `archive/arc-planning-continuity-771` for this result.
