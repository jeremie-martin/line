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
