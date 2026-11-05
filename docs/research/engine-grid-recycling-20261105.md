# Reuse empty collision-grid buckets — 2026-11-05

Accepted on `perf/compiler-after-foundations`, against `c49b4da4`. Fresh default
confirmation improved paired compile time by **0.717%** (97.73% exact confidence
interval: **0.305–1.078% faster**). Separate arm medians were 7,361.9 → **7,302.0 ns
per charged physics frame**. The 7,000 ns target remains unmet.

The private grid map had one use: ordered collision buckets. Removing the last
line dropped its vector allocation, even though subsequent candidates repeatedly
occupied those hash slots. `LineGrid` now keeps the empty buffer in the inactive
slot. Removed keys remain invisible and no line owners survive removal. Clones
copy no empty spare allocations; rehashing drops them. Specializing the map also
removes its generic insertion path and `Option` storage. Hashing, probing,
collision ordering, physics and search budgets are unchanged.

Instrumented exact compiles counted bucket growth requests falling from
192,451 to 22,617 (88.25%) for default cell 61, and 944,271 to 69,766 (92.61%)
for larger cell 62. These are allocation requests, not live-byte measurements.
The packaged WASM shrank from 96,152 to 94,646 bytes.

## Fixed measurements and adoption

CPU 2, Node 22.22.2, Rust 1.95.0, i7-12800H, 16 GB. No concurrent heavy work.
Independent balanced randomized process pairs; five warmups and three measured
compiles per process. Twelve screen/guard pairs, 24 fresh confirmation pairs.
Requested confidence 95%; discrete exact coverage is 96.14%/97.73%. The declared
speed margin was zero, with separate correctness, resource and design gates.

| Completed experiment | Median paired change | Confidence interval | Verdict |
| --- | ---: | ---: | --- |
| [Default screen](engine-grid-recycle-20261105-screen.json) | −1.428% | [−1.745, −0.622]% | FASTER |
| [Larger guard](engine-grid-recycle-20261105-larger-guard.json) | −0.371% | [−1.010, +0.135]% | EQUIVALENT within 2% |
| [Cold guard](engine-grid-recycle-20261105-cold-guard.json) | +0.014% | [−0.751, +0.174]% | EQUIVALENT within 5% |
| [Fresh default confirmation](engine-grid-recycle-20261105-confirm.json) | −0.717% | [−1.078, −0.305]% | FASTER; qualified |

The cold guard uses zero warmups and one compile per process. The CLI now accepts
that explicit configuration. All 800 compiles in these experiments, including
warmups and resource probes, matched tracks and charged work exactly.

Separate resource probes passed the declared limits: at most 5% greater WASM
capacity and 15% greater peak process RSS. Default WASM capacity fell from 17 to
16.5 MiB; larger capacity rose from 32.5625 to 33.5 MiB (+2.88%). RSS peaks were
lower in these probes, but are not estimates of retained native allocations.
Isolated registration, replay and branching ratios were 0.928 [0.707, 1.218],
1.029 [0.975, 1.087], and 0.976 [0.946, 1.007]. These broad intervals do not support
an isolated stepping-speed claim.

Full `npm run check` passed: 449 JS tests, 31 Rust tests, zero unreachable modules,
65 saved/live physics cases, 63 byte-identical compiler cases and 33 judge tracks.
Full serialized checkpoints also match for both timed cells. The new ownership
regression test covers removal, buffer reuse, clone independence and rehashing.
Frozen source and packaged-binary hashes were unchanged throughout validation.

## Other approaches investigated

V8 CPU profiles motivated examining collision exclusion, allocation and learned
control retrieval. The named diagnostic native build reordered function indices;
raw WASM indices were not treated as exact source attribution.

| Approach | Evidence and decision |
| --- | --- |
| Exact model-group bounding index | Exact initial-page neighbors; fewer distance operations, but local traversal 26–43% slower. No production change. |
| Rebuild tight bounds from surviving line footprints | Abandoned after three pairs with over 30% regression. |
| Rebuild tight bounds from occupied keys | Abandoned after eight pairs with roughly 6–7% regression. |
| Incremental occupancy counts | Failed the predeclared larger WASM-capacity bound. |
| Compact occupancy counts | Resource bound passed; partial timing could no longer meet the fixed experiment's speed criterion. Abandoned. |
| Amortized bounds refresh | Completed screen FASTER: −0.191% [−1.078, −0.050]%. Declined at the separate design/value gate: small benefit did not justify inverse-coordinate and refresh-counter machinery. No confirmation. |

None of those implementations remain. Partial experiments are retained as
abandoned evidence, not qualified results. The accepted change removes repeated
allocation without adding a second spatial index or another invalidation policy.

[Diagnostics and reproduction evidence](engine-grid-recycling-20261105-diagnostics.json)
include prospective plans, hashes, patches, work counts, scripts, validation logs,
isolated results and the unsuccessful experiments. Large captured queries and
raw V8 profiles remain in ignored `generated/engine-grid-recycling-20261105/`,
with their sizes and hashes recorded in that evidence.
