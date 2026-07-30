# Benchmark V2 Comparison Decisions

## Estimand

For the active campaign, the primary estimate is the paired difference:

`candidate 750k headline - active 750k campaign-baseline headline`

at the same 48 literal seed slots. Invalid runs score zero
under the ordinary V2 scoring contract; validity changes are therefore part of
the product effect, not removed as outliers.

## Uncertainty

The comparison reports a seed-block jackknife SE, a central interval, and
one-sided bounds using the retained V2 decision model. It also reports budget,
stratum, case, and validity breakdowns.

For an improvement:

- `accept` means the conservative lower bound is above zero;
- `reject` means the conservative upper bound is below zero;
- `inconclusive` means the available N does not resolve the sign.

The CLI describes these as stronger than baseline, not better than baseline,
or inconclusive. The interval is evidence for judgment; it does not create a
scarce permission token.

For a deliberate simplification, use
`--mode=simplify --margin=POINTS`. The threshold becomes `-margin`; a favorable
result means the simplification is supported as non-inferior at that margin.

## Choosing N

N is fixed at 48 for every active-campaign comparison. Directional N=2/N=4/N=8
probes and adaptive depth follow-ups are disabled. The full-ladder historical
cache remains intact but is outside current acceptance.

## Promotion judgment

A favorable interval is necessary for the ordinary automated promotion
command, but the agent or operator should also check:

- representative behavior is not being traded for one capability rescue;
- validity losses and largest case regressions are acceptable;
- the 750k movement is coherent and the mechanism itself remains scale-free;
- the measured effect fits the mechanism hypothesis;
- the source default is general and maintainable.

The accepted comparison artifact is the explicit handoff to `rebaseline`.
There is no implicit latest attempt and no cross-run accounting state.
