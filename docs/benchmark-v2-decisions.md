# Benchmark V2 Comparison Decisions

## Estimand

The primary estimate is the paired difference:

`candidate canonical headline - accepted-baseline canonical headline`

at the same literal seed slots and canonical budgets. Invalid runs score zero
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

Any N from 2 through the cache maximum is runnable. Larger N generally reduces
seed noise and costs proportionally more candidate compiles. Reasonable uses
include:

- a small N for directional triage;
- N=48 or N=100 for a serious candidate;
- N=300 for a modest or high-stakes effect;
- an extra heavy run when compute is available and uncertainty warrants it.

N must be chosen before that candidate run. Looking at N=48 and then running
N=100 is allowed, but the N=100 result should be read as an adaptively chosen
follow-up—not pooled with N=48 as independent evidence.

## Promotion judgment

A favorable interval is necessary for the ordinary automated promotion
command, but the agent or operator should also check:

- representative behavior is not being traded for one capability rescue;
- validity losses and largest case regressions are acceptable;
- budget movement is coherent;
- the measured effect fits the mechanism hypothesis;
- the source default is general and maintainable.

The accepted comparison artifact is the explicit handoff to `rebaseline`.
There is no implicit latest attempt and no cross-run accounting state.
