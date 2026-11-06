# Reject global partition pruning after two implementation studies

Reference: `f5b207ac`; production code remains identical to `8bfb6f9e`.
The query-cost audit identifies a large exact pruning opportunity, but neither
implementation qualifies for adoption. Remove both implementations and their
candidate-specific tests. The last qualified default result remains 7,172.5 ns per
charged physics frame.

For finite nonnegative distance d, `d/(1+d)` lies in [0,1], including rounding to
exactly one. If at least the retained limit of examples has partition distance
at most p, no example with partition distance greater than p+1 can enter that
neighborhood. Keep the original row order, strict inequality and tie handling.
Certify finite distances from an immutable model feature envelope; otherwise
retain the original scan for malformed or overflowing values.

## Synthetic-array implementation: abandon a regression

The first implementation uses the existing metric on synthetic upper-bound
vectors. Numerical tests, complete checkpoints for cells 61/62 and the full gate
pass: 452 JS tests, 31 Rust tests, 65 physics cases, 63 compiler cells, 33 judge
tracks, types and reach. The fixed screen planned 12 pairs, five warmups and three
measured compiles, CPU 2, requested 95% confidence and a zero speed margin.

Abandon after nine completed pairs, all slower (individual changes +0.65% to
+2.66%, descriptive median +1.77%). The result remains incomplete: **no completed
verdict or qualification**. Preserve the partial run rather than extending or
relabeling it.

Fresh Inspector profiles show proposal-selection self time decreasing from
19.8 to 12.7 ms, but nearest-control search increasing from 37.7 to 55.3 ms. These
profiles include untimed preparation/output and Inspector overhead; they are
not compiler timing qualification. Feeding synthetic arrays into the shared
hot distance function is a plausible specialization disturbance.

## Scalar implementation: correct the cost, but miss screening

A new scalar upper-bound function avoids those arrays and calls. It shares the
default weight rule with the metric. The next diagnostic profile restores
nearest-control self time to 37.4 ms, while proposal selection remains lower at
11.8 ms. Partition-index/bound work rises from 2.6 to about 6.3 ms, offsetting much
of the saving. This ablation supports the shared-function disturbance diagnosis;
no V8-specific representation trick is retained.

The revised implementation passes 11 focused tests and both complete checkpoints,
including bound monotonicity at extreme magnitudes, rounded cross-partition ties,
zero/large weights, overflow, nonfinite and missing features, source-array
replacement and feature-width changes. Its fresh 12-pair screen is **−0.410%
[−0.802%, +0.072%], INCONCLUSIVE** at the declared zero margin. It does not proceed
to larger/cold guards, full structural requalification or confirmation. The
initial version's full check is not relabeled as this revision's validation.

The primary result files are `engine-partition-bound-20261106-screen.json`
(incomplete first trial) and `engine-partition-scalar-20261106-screen.json`
(complete revised screen). `engine-partition-bound-20261106-diagnostics.json`
retains both plans, implementations, tests, logs, checkpoint hashes and profile
summaries. Large profiles/checkpoints remain under the matching `generated/`
directory. The failed implementations and their extra metadata are absent from
production.
