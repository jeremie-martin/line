# Planning continuity at the frame budget

September 2026. Work branch: `codex/arc-planning-continuity`.

The owner questioned an additional qualification veto after the boundary-value
compiler passed the unchanged headline gate. The 771.3015 candidate is adopted
from its exact accepted artifact, with no forced promotion or new evaluation
rule. The previous 767.6851 compiler and all evidence remain preserved.

The reported failure was a missing final authored contact at 250k, on
`amour_de_ma_vie_short_44s`, seed 0. The compiler spent 249,985 frames after
34 backtracks and returned 84 of 85 contacts. It did not exceed the budget.
The separate qualification panel had 119/120 valid runs. Canonical 750k had
352/352; the independent jitter panel had 176/176 distinct valid tracks.

Initial code inspection identifies an exception-safety concern: local candidate
search holds a valid best-so-far curve, but a frame-limit exception escapes the
entire compile loop before that curve is committed. Continuation planning can
also interrupt between finding a usable current curve and committing it. First
observe whether this actually caused the reported failure, then address the
state transition generally. An interrupted partial continuation must not count
as a completed planning horizon, and failed candidate geometry must never become
part of the returned track. All replays and search work remain metered.

Investigate the supplied failure to understand the defect. Select the algorithm
using independent synthetic/development workloads and unchanged benchmark panels,
without a song-specific fallback or a named benchmark-budget gate. Qualification
results remain disclosed, with the original panel now explicitly a regression
check rather than a newly untouched holdout.

## Root cause and correction

The diagnostic reproduction found 24 fully validated alternatives for the final
interval before the exception; none was committed. The fix catches frame-limit
interruptions locally, retains only a fully evaluated incumbent, and commits it.
No-incumbent interruptions still propagate, unrelated errors still propagate,
and a partial deeper continuation never masquerades as a completed horizon.
Planning interruption preserves the current validated curve and any fully
returned plan. Exhaustion remains visible in telemetry even if the track completes.

The failed run now completes all 85 contacts at the same 249,985 frames. A
separate synthetic four-second track gains five valid budget settings, with no
validity losses across 78 settings. The complete 44-case 750k panel matches the
771.3015 intermediate compiler's tracks, reports and metering exactly.

Final combined-release validation uses the preserved original 767.6851 reference
from before this task, plus exact parity against the 771.3015 intermediate. This
binds the finished source to the overall improvement without attributing a new
headline gain to the interruption fix. It uses the normal unchanged sequential
gate and no forced promotion. The prior qualification panel is explicitly reused
as a regression check after diagnosing its failure, not called a fresh holdout.
