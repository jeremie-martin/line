# Arc V3 above-920 campaign

Active target: **strictly above 920** on the frozen full V3 benchmark, starting
from **910.5248**, compiler `f0ca9434`. All 176 baseline runs pass within 750k
actual compiler physics frames. The owner approved the new Luna video's visual
alignment before opening this campaign. Preserve its coherent normal-arc style.

Initial work examines remaining measured loss and transfers deeper-search
knowledge to the fixed execution allowance. The preceding campaign retained
7,981 independently validated teacher choices queried at the 901 student's
actual physical prefixes. Those data were not used in the 910 compiler. Testing
whether they improve proposals is a concrete first hypothesis; stronger offline
prediction alone will not count as compiler improvement.

The full 88-specification result, including invalid-run zeros, governs this
campaign. Partial studies remain pilots with no headline. Final confirmation
uses seeds 16/17 through the public entry point. Benchmark/scorer/physics remain
fixed. Raw research artifacts stay local under `generated/benchmark-v3/arc-920/`;
code and compact favorable and adverse evidence are committed and pushed.

## First complete studies

All figures here cover the complete 88-case seed-16 research panel at 750k;
they are not canonical promotion claims. Every run is valid.

| Change from 910 | Headline |
| --- | ---: |
| Forest trained on verified student-prefix teacher choices | 916.0723 |
| Student-prefix teacher examples instead of previous examples | 915.3571 |
| Both forest and examples replaced | 910.1642 |
| Continuation predictor trained on student-prefix probes | 912.4524 |
| New forest and new continuation predictor | 914.1346 |
| New examples and new continuation predictor | 911.9437 |
| Forest trained on both old and student-prefix data | 913.5299 |
| New forest with learned-guidance weight 0.5 | 912.7065 |

The stronger forest uses the same 32-tree/depth-14/leaf-4 architecture and
proposal quota. Only its training states and labels change. Both successful
single transfers recover much of the preceding campaign's three largest
regressions. Their gains do not add when combined. The new value predictor's
family-disjoint offline mean regret is worse (0.007611 versus 0.006253), despite
its standalone live improvement; these are different measurements. Forest
runtime predictions match independent Python fixtures within 7.11e-15 in
decoded control units; the new value predictor matches exactly on 32 fixtures.

## Ending diagnosis and initial correction

The [baseline audit](../benchmark/v3/studies/arc-920-baseline-diagnosis.json)
matches all 88 research tracks, scores and frame counts to canonical evidence.
Endings account for 20.47% of case-pooled squared loss, with no claim that this
pool is the weighted headline. They explain 92.44%, 82.71% and 75.34% of the
loss in `arches_at_new_tempos`, `rest_and_return` and `interleaved_recovery`.
Planning consumes 25,259,131 of 65,157,750 frames; only 46 of 7,981 decisions
choose depth two.

Final candidate selection already matches the full objective, but local
refinement uses a different span/impact balance and an amplitude-overflow
surrogate. The first optional ending change scores 910.3669. A focused physical
test exposes a mistake in that implementation: the span-weight closure still
reads the compile-wide flag, so the local override does not activate time
weighting. That adverse run is preserved as `full-terminal-objective`; it is
not evidence about the intended weighted correction. Moving weight calculation
into the local search fixes the discrepancy. The test independently reconstructs
the time-weighted ending, completed preceding boundary and event-weighted impact;
it now passes. `full-terminal-weighted` tests the corrected mechanism.

Another inspection finds 11 committed long arcs whose implicit five-frame turn
cannot be represented under the explicit turn-fraction clamp. All 11 are
endings. An isolated prototype lowers the minimum fraction only enough to
represent that existing turn. It retains the same coherent curve primitive.
Separate complete studies test it with both the 910 and stronger proposal model.

A new 3M teacher study uses the stronger forest; its larger allowance is research
only. Further training studies investigate physical interval duration weighting
and control-error scaling. These must earn gains in full live compilation.

## Transfer and correction models

The turn-timing correction reaches 912.7034 on the 910 compiler and 916.6226
with the stronger forest. Correct terminal weighting reaches 911.8197 on the
910 compiler, but 911.8030 with the stronger forest; adding both corrections
there reaches 912.3751. The mathematically consistent ending objective does not
automatically improve a changed controller. It remains optional.

The stronger compiler's 3M rollout reaches **927.0162**, all 88 valid. After
independent prefix replay, its examples paired with the student-prefix forest
reach **918.1369** at 750k. Replacing both forest and examples reaches 917.8568;
the new forest alone reaches 911.0367, and replacing the value predictor as well
reaches 914.1180. Training with duration weights (912.4830) or control-error
rescaling (911.1216) does not improve the reference.

A second 3M teacher runs at fixed prefixes of the 916.0723 student. All 88
replays exactly preserve those student tracks; all 8,069 queried arcs are
independently revalidated, yielding 7,981 non-startup training examples.
The replay score is the student's score, not a new teacher rollout result.
Replacing the forest using these queries reaches 918.9292 with the 927
examples; replacing the examples alone reaches 918.9415; replacing both reaches
918.5770. Increasing the earlier example share reaches 917.5470, while a
20-proposal quota reaches 917.3805. All these full 88-case runs are valid.

The residual-policy experiment predicts **teacher controls minus a frozen
forest's mean prediction**. The runtime adds predicted corrections to that
mean, then physically evaluates the resulting arcs. It also changes the
proposal distribution: the old individual-tree proposals are not retained,
and zero correction is not a replay of the old compiler. Independent Python
and TypeScript predictions agree within 2.23e-16 in encoded control units.
Full correction reaches 918.3255 with the older examples; half correction
reaches 912.3431. Pairing full correction with the 927 examples reaches
**919.8782**, all 88 valid. The target remains strictly above 920.

The next complete panels calibrate correction strength (0.85 and 1.15) and
learned geometry-guidance weight (0.125 and 0.375). The frozen scorer, physical
budget and arc primitive are unchanged. Five tests cover residual-control
decoding, correction strength, long-arc timing and the complete ending loss.
Type checking retains 251 inherited diagnostics and none in changed files at
the check before residual-policy integration. Code and compact evidence retain
the unsuccessful studies as well as improvements.

## Candidate above the target

Correction strength **1.15** reaches **922.6418**, all 88 cases valid at 750k,
up 12.1170 from canonical 910.5248. Strength 0.85 reaches 919.9351. The two
guidance-weight alternatives reach 916.3554 and 918.5275. Every completed
candidate and its paired case results remains in the compact research ledger.

The selected policy has a 32-tree base forest trained on the earlier
student-prefix queries, a 32-tree residual forest trained on the 927 teacher's
verified controls, and 7,981 examples from that teacher. The proposal quota and
future-value predictor remain unchanged. The turn-timing correction is enabled;
the optional terminal-objective change is disabled. The general residual
builder reproduces both the original residual dataset and fitted model byte
for byte. Its Python fixtures supply independent checks of decoded controls.

Selected model SHA-256:
`e51a2cb249022d4cba91d64312bcc4316f47ed8da959ffa1c1256451d57acf0d`.
It occupies 34,920,171 bytes. This is a headline improvement within the fixed
physics allowance; no reduction in wall-clock inference cost is claimed.

The model is integrated into the public compiler. Full canonical two-seed
confirmation, final focused tests and separate jitter checks must finish before
the goal is marked achieved.
