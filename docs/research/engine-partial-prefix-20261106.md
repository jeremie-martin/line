# Reuse partially invalidated trajectory prefixes, November 6

**Adopted.** Fresh 24-pair default confirmation measures **6,979.3 ns per charged
physics frame**, meeting the <7,000 ns target. The paired improvement is **1.864%**,
with an exact interval of **1.525–2.311%**. All 24 confirmation pairs are faster.
Reference `bbacc2ea` has the same production implementation as `8bfb6f9e`.

## Remove repeated prefix work

The [scoped profile](engine-scoped-profile-20261106.md) identified native raw-frame
decoding as the largest JavaScript allocation site. Candidate evaluation treated
prefix validity as a boolean: if geometry invalidated even the final prefix
frame, it decoded and detected the entire trajectory again. An exact shadow
found that every successful partial invalidation on the two workloads affected
only one or two prefix frames. About 97% of the full-path decoding was redundant.

The implementation follows the native invalidation boundary instead. It reuses
unchanged prefix objects and decodes the changed suffix. Each interval keeps its
existing detector continuation and one boundary count. If a candidate preserves
less, the checkpoint moves earlier; subsequent candidates reuse that checkpoint.
The constructor still accounts for contact-persistence lookahead. Checking only
the last processed frame would be insufficient because detection reads ahead.
No invalidation depth is assumed or hard-coded.

Observed-receiver geometry simulates between its support and guide edits. Its
unchanged prefix is bounded by both edits, captured before the intervening
simulation. This prevents the later cache length from overstating prefix validity.
One trajectory read path and one continuation path replace the full-prefix
fallbacks. Raw prefix values remain immutable; callbacks consume borrowed
observations synchronously and candidates retain owned facts. There is no new
public API, cache map, runtime setting, build dependency or scoring formula.

| Candidate raw frames decoded | Reference | Candidate | Reduction |
| --- | ---: | ---: | ---: |
| Default cell 61 | 339,730 | 123,954 | 63.5% |
| Larger cell 62 | 1,451,389 | 690,165 | 52.4% |

These counts describe candidate reads, not all compiler reads or physics work.
Charged physics frames remain exactly 147,209 and 741,902 respectively. The
secondary observation-read counter correctly reflects the reads avoided.

## Qualification

The prospective plan requires a supported speedup: CPU 2, twelve balanced
randomized fresh-process screen pairs and twenty-four fresh confirmation pairs,
five warmups and three measured compiles per process, zero practical speed
margin, 95% requested confidence. The larger workload must bound regression
below 2%; cold starts below 5% (twelve pairs each, cold: zero warmups/one compile).
Separate resource processes must stay within 5% higher WASM capacity and 15%
higher peak RSS. Correctness and design gates are independent of timing.

| Experiment | Median paired change | Exact interval | Reference → candidate median ns/frame | Decision |
| --- | ---: | ---: | ---: | --- |
| [Default screen](engine-partial-prefix-20261106-screen.json), 12 pairs | −1.443% | [−2.373%, −0.678%] | 7,094.5 → 7,004.2 | FASTER |
| [Larger guard](engine-partial-prefix-20261106-larger.json), 12 pairs | −1.419% | [−2.275%, −1.109%] | 6,786.6 → 6,681.9 | Regression guard passes |
| [Cold guard](engine-partial-prefix-20261106-cold.json), 12 pairs | −0.957% | [−1.347%, −0.648%] | 15,962.4 → 15,851.6 | EQUIVALENT within 5% |
| [Fresh default confirmation](engine-partial-prefix-20261106-confirm.json), 24 pairs | −1.864% | [−2.311%, −1.525%] | 7,109.6 → 6,979.3 | FASTER; target met |

The larger tool verdict is INCONCLUSIVE at a 2% practical margin: it establishes
neither a full 2% gain nor equivalence within ±2%. Its upper bound is below +2%,
so it satisfies the declared regression guard. Exact interval coverage is
96.14% for twelve pairs and 97.73% for twenty-four. Absolute arm medians and
within-pair percentage changes are different summaries. Historical 7,172.5 ns
is not used as the causal comparison; the fresh reference is 7,109.6 ns.

All 800 timed, warmup and resource compiles preserve exact tracks and charged
work. Every stage has frozen source hash
`f1fb8b99f3291d6657e0496cfd3034e3ae267871e9ca2d991c3b9da7babc9371`,
verified again against the final source tree. Both arms use the identical
94,646-byte compiler WASM, SHA-256
`784e1f69c86d855565d662b7aee0f1317f1bd5e0e0a13ccd655240d80f658cf7`.
Measurements use pinned Node 22.22.2 on the i7-12800H laptop. No build, test,
profile or other substantial work overlaps the fixed experiments.

| Fresh resource observation | WASM capacity, reference → candidate MiB | Peak RSS, reference → candidate MiB |
| --- | ---: | ---: |
| Default screen | 16.5 → 16.8125 | 299.6 → 299.7 |
| Larger guard | 33.5 → 33.9375 | 439.9 → 444.5 |
| Cold guard | 16.5 → 16.8125 | 300.6 → 296.7 |
| Default confirmation | 16.5 → 16.8125 | 300.5 → 295.8 |

All resource limits pass. These individual high-water observations are not a
statistical memory-saving claim. Fewer decoded frames do not imply lower native
capacity: that capacity increased slightly, within the declared 5% bound.

## Correctness and design

`npm run check` passes: zero type errors/unreachable files, 450 JavaScript tests,
31 Rust tests, 65 saved/live physics cases (68,827 exact states and 432,018
ordered collisions), 63 exact compiler cells and 33 judge tracks. Complete
checkpoints for both timing workloads equal the reference. The new real-engine
ownership test exercises successive supports that partially invalidate a prefix,
compares resumed detection with full detection, compares trajectories with full
native reads, and verifies immutable prefix and retained candidate facts.

A separate shadow checks all 34,379 successful workload replays, including 1,125
partial-prefix cases, against full native trajectories and full detection. Two
additional transfer-layout seeds check 9,304 replays, including 7,142 observed
receivers. Their complete results also equal the reference. No parity reference
or independent judge changed.

The [evidence record](engine-partial-prefix-20261106.json) contains plans, source
patch, scripts, counts, validation logs, source checks and the adoption decision.
Large checkpoint artifacts remain under `generated/engine-partial-prefix-20261106/`
with hashes in the record. The target is met; no further optimization trial was
started after confirmation.
