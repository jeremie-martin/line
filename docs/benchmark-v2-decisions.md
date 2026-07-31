# Benchmark V2 Comparison Decisions

## Estimand

For the active campaign, the primary estimate is the paired difference:

`candidate 750k headline - active 750k campaign-baseline headline`

at the same literal seed prefix. The maximum contains 48 slots; the governed
experiment may stop at N=8, N=16, N=32, or N=48. Invalid runs score zero
under the ordinary V2 scoring contract; validity changes are therefore part of
the product effect, not removed as outliers.

## Uncertainty

The comparison reports a paired seed-block jackknife SE, a central interval,
one-sided fixed-look bounds, and a reference Student-t probability that the
headline delta is positive. The measured seed-to-seed variation therefore
enters the directional probability directly: the same mean with a noisier
paired seed pattern produces a larger SE and weaker evidence. Budget, stratum,
case, and validity breakdowns remain diagnostic.

For an active improvement, a calibrated O'Brien-Fleming boundary controls all
four looks. At depth N, cross when
`T_N >= c / sqrt(N / 48)`, where the retained scorer-bound calibration sets
`c = 1.96392337`. The negative boundary is symmetric.

- `accept` means the positive repeated-look boundary was crossed;
- `reject` means the negative repeated-look boundary was crossed;
- `continue` means another predeclared look is allowed;
- `inconclusive` means neither boundary was crossed by N=48.

The policy has one operator-facing tolerance: one-sided total alpha 5% per
direction. Per-look thresholds are derived, not independently hardcoded. The
calibration used 10,000 studentized trials and 10,000 independent validation
trials for Gaussian, heavy-tailed Student-t(5), and zero-inflated observations;
every Wilson-95 false-promotion and false-harm upper bound remained below 5%.
The calibration is scorer-, suite-, policy-, inference-, generator-, and
reference-archive-bound.

The displayed directional probability is interpretable but not an unadjusted
promotion cutoff. Repeated-look protection comes from the calibrated boundary.
There is no predictive-futility stop: only clear evidence of harm rejects
early, so a merely weak start can continue.

For a deliberate simplification, use
`--mode=simplify --margin=POINTS`. The threshold becomes `-margin`; a favorable
result means the simplification is supported as non-inferior at that margin.
This is a separate fixed-N=48 experiment with no interim looks; it does not
borrow the active improvement boundary.

## Execution and N

The command declares N=48 once. The runner completes and decides strict waves
at N=8/16/32/48; later rows are not queued before an earlier `continue`.
Within a wave, work is seed-major across all 44 cases, so the first look covers
every specification rather than running all seeds of one specification first.
These are planned looks in one experiment, not post-result choices. Arbitrary
active-campaign depths and N=2/N=4 probes remain disabled.

The baseline cache is prefix-addressable. If the next baseline prefix is
missing, candidate execution pauses, the baseline tail is explicitly extended,
and the same frozen request/checkpoint resumes. A candidate accepted at an
early look publishes that exact prefix as the next baseline. Any later cache
completion is descriptive monitoring and cannot replace its promotion
headline. The full-ladder historical cache remains intact outside current
acceptance.

## Promotion judgment

A sequential `accept` is necessary for the ordinary automated promotion
command, but the agent or operator should also check:

- representative behavior is not being traded for one capability rescue;
- validity losses and largest case regressions are acceptable;
- the 750k movement is coherent and the mechanism itself remains scale-free;
- the measured effect fits the mechanism hypothesis;
- the source default is general and maintainable.

The accepted comparison artifact is the explicit handoff to `rebaseline`.
There is no implicit latest attempt and no cross-run accounting state.
