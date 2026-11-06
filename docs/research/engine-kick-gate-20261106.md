# Reject an angular exclusion after inconclusive confirmation

Reference: `961dbdb8` (production code identical to `8bfb6f9e`). A conservative
angle predicate passes correctness and screening, but **fresh confirmation does
not qualify its speedup**. Remove the implementation and candidate-specific tests;
keep their source and complete evidence here. The last qualified default result
remains **7,172.5 ns per charged physics frame**, above the 7,000 ns target.

## Mechanism and correctness

For kick thresholds of at least 15 degrees, `dot > 4 * abs(cross)` excludes an
angle calculation: this positive cone is narrower than `atan(1/4)`, about 14.04
degrees. Multiplication by four is exact unless it overflows, which prevents the
strict comparison from passing. All emitted angles retain their original
`atan2` arithmetic. Zero vectors, small/custom thresholds and cases outside the
cone retain the original behavior. No extra cache or runtime flag is involved.

An untimed shadow computes every original angle and asserts every proposed
exclusion. It excludes 515,873 of 519,100 calculations in the default workload
(99.38%) and 2,602,929 of 2,620,592 in the larger workload (99.33%). Complete
checkpoints match for both the shadow and actual implementation, on cells 61/62.
Numerical tests cover the cone and event thresholds, zero and signed zero,
subnormal/large values, infinities, NaN and generated velocities. The full gate
passes: 451 JS tests, 31 Rust tests, 65 saved/live physics cases, 63 compiler
cells, 33 judge tracks, types and zero unreachable code.

## Fixed experiment and decision

Use unchanged v3 tooling, Node 22.22.2, default runtime options and CPU 2.
Prospectively fix a 12-pair screen, 24 fresh confirmation pairs, five warmups,
three measured compiles, requested 95% confidence and a zero minimum speed
margin. The larger guard permits at most +2%; a separate zero-warmup, one-compile
cold guard permits +5%. WASM capacity may not increase; peak RSS is bounded at
1.15×. The existing native-Node null control remains the unchanged experiment's
calibration.

| Stage | Pairs | Paired median change | Interval | Verdict |
| --- | ---: | ---: | --- | --- |
| screen | 12 | -0.442% | [-1.250%, -0.025%] | FASTER |
| larger guard | 12 | -0.748% | [-1.131%, +0.374%] | EQUIVALENT at 2% |
| cold guard | 12 | -0.555% | [-1.145%, -0.171%] | EQUIVALENT at 5% |
| fresh confirmation | 24 | -0.379% | [-0.869%, +0.082%] | INCONCLUSIVE at 0% |

Confirmation arm medians are 7,151.1 → 7,119.4 ns per charged frame. Its interval
crosses zero, so the declared adoption rule fails despite the favorable point
estimate. All resource guards pass, and all **800** warmup, measured and separate
resource compiles match their exact track and charged work. No target claim,
threshold change or repeated unchanged trial follows this result.

Results are `engine-kick-gate-20261106-{screen,larger,cold,confirm}.json`.
The diagnostics JSON preserves the plan, original/shadow/candidate patch, tests,
logs, counters, scripts and checkpoint hashes. Complete checkpoints remain under
`generated/engine-kick-gate-20261106/`. The large reduction in transcendental
calls does not translate into a sufficiently supported full-compiler benefit.
