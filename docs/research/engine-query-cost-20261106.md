# Compiler query-cost audit

Reference: `f5b207ac`, with production code unchanged from `8bfb6f9e`.
Instrument actual default and larger compiles without changing their decisions.
Both complete checkpoints match the uninstrumented compiler. These are
opportunity counts, not performance qualification.

| Opportunity | Default cell 61 | Larger cell 62 | Decision |
| --- | ---: | ---: | --- |
| Reuse consecutive identical model-distance queries | 0 of 195 queries; 0 of 796,643 model-row visits | 0 of 600 queries; 0 of 2,372,974 model-row visits | Reject; no distance cache added. |
| Exclude physical distances using a global partition-rank bound | 102,531 of 119,954 calls (85.5%) | 288,747 of 357,282 calls (80.8%) | Exceeds the predeclared 30% opportunity gate; develop a separate exact pruning trial. |
| Capture memo-key inputs | 10,244 calls | 46,964 calls | Compare simpler encoders before changing production. |

For the key experiment, all captured default inputs and 1,380 generated numerical
boundary cases produce byte-identical keys. Two warmups precede six balanced
three-method blocks, on CPU 2. Each sample performs roughly 100,000 encodings
and real Map lookups, forcing string hashing/comparison rather than only reading
rope lengths. Original map/String/join takes a median 1,021 ns/key; numeric
map/join takes 1,119 (+9.6%), and direct accumulation 1,245 (+22.0%). Both fail the
prospective 20% improvement prerequisite. Keep the original implementation.
These microbenchmarks are diagnostics, not compiler speed measurements.

The partition opportunity uses the existing primary ordering: partition distance
plus `d/(1+d)`. For finite nonnegative `d`, the latter is in [0,1], including
rounding to exactly one. If at least the retained limit of rows has partition
distance at most p, rows with partition distance greater than p+1 cannot enter
the final neighborhood. An implementation must certify finite physical distances
and preserve original row order, equality ties and nonfinite fallback behavior.
This audit does not assume those implementation obligations are already solved.

Plans, source instrumentation, scripts, counts, exact-check record and all encoder
samples are in `engine-query-cost-20261106.json`. Large captured inputs and
checkpoints remain in `generated/engine-query-cost-20261106/`, with hashes in the
record. No memory-query cache or key-encoding change was retained.

A subsequent static audit of just the authored-future suffix (features 47 onward)
finds 961 distinct suffixes in 14,340 V6 rows (93.3% duplicates), versus 15,782 in
17,077 V3 rows (7.6%). The predeclared 50% prerequisite passes only for V6. These
are static counts, not evidence that a shared suffix bound will prune enough
actual queries; execution-weighted work must be measured before adding an index.
