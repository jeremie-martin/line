# Skip provably empty collision sweeps

Adopt on `perf/compiler-after-foundations`, against `b893beee`: bound the
occupied grid conservatively and omit all ten point queries when every point is
beyond a common face. Constraint solving, trace capture, history-producing
sweeps, frame charging, search order and arithmetic remain unchanged. Point-query
storage now has ten slots; the two binding-status entities need none.

## Why the shortcut is exact

For a registered cell coordinate range `[lo, hi]`, the physical bounds are
`(lo - 2) * 14` and `(hi + 2) * 14`. These integer products are exactly
representable in the supported coordinate domain. Monotone rounded division
therefore puts a point beyond either face at least two cells from an occupied
cell. Its 3×3 neighborhood is empty. The common-face test must hold for every
colliding point before a sweep is omitted.

Coordinates are restricted to a domain where the signed cell-pair encoding
cannot overflow or alias distinct cells. Unsupported registered coordinates
make the envelope unbounded; unsupported point coordinates use ordinary
queries. Unbounded intervals remain unbounded under subsequent unions and
copies, so no validity flag or invalidation protocol is necessary. Bounds only
expand on registration, remain conservative on removal, and accompany geometry
when caches are copied. History-producing sweeps retain every snapshot.

An instrumented shadow executes every original query, checks every excluded
neighborhood for empty grid buckets, and reproduces both full compiler
checkpoints and JSON field order. It counts:

| Workload | Ordinary sweeps | Excluded sweeps | Point queries avoided |
| --- | ---: | ---: | ---: |
| Default automatic, cell 61 | 861,894 | 246,491 (28.60%) | 2,464,910 |
| Larger automatic, cell 62 | 4,430,052 | 1,212,820 (27.38%) | 12,128,200 |

These are work counts, not timing estimates. Other compiler and solver work
limits the end-to-end benefit.

## Fixed timing and resource decision

Protocol v3 on CPU 2 of the i7-12800H laptop, Node 22.22.2 and Rust 1.95.0:
five warmups, three measured compiles per process, balanced randomized process
pairs, requested 95% confidence. Screen/default guard use 12 pairs and seed
1729; independent confirmation uses 24 pairs and seed 2718. No candidate edits,
extra pairs or heavy concurrent work occurred during these measurements.

The speed margin is zero: require a complete interval below zero, without a
minimum percentage benefit. Default non-regression uses an upper bound of +2%.
The tool now accepts `--margin-pct=0`; positive margins remain appropriate for
practical equivalence and null controls. Live pair counts/medians are descriptive,
with no interim probability or qualification.

| Workload | Pairs | Median paired change | Exact interval | Verdict |
| --- | ---: | ---: | --- | --- |
| Larger, screen | 12 | −1.449% | [−1.730%, −1.217%] | FASTER at 0% |
| Default guard | 12 | −0.603% | [−0.975%, +0.391%] | EQUIVALENT at ±2% |
| Larger, fresh confirmation | 24 | −1.566% | [−1.774%, −1.178%] | FASTER at 0% |

All 24 confirmation pairs favor the candidate. The default interval passes its
regression guard but does **not** establish a default speedup. Descriptive
candidate medians are **7,359 ns per charged frame** for default compilation
(reference 7,376) and **6,895 ns** for the larger confirmation workload
(reference 6,996). These include compiler work. Separate arm medians are not the
paired estimator. The default <7,000 ns target remains open.

**Resource policy revision:** the initial sweep implementation passed timing
but raised larger-workload WASM capacity from 32.5 to 33.25 MiB, failing its
unchanged-capacity rule. It was closed without confirmation. The new point-only
representation removes unused slots and the redundant validity flag. Untimed
probes found default capacity falling from 17.3125 to 17 MiB, with larger
capacity changing from 32.5 to 32.5625 MiB.

After those probes, **before any timing of the new candidate**, the assistant
explicitly revised the resource allowance to at most one additional 64 KiB
WASM page per workload, alongside the existing +15% fresh peak RSS limit.
This is an engineering judgment accepting a small bounded resource tradeoff;
the owner did not explicitly approve this exact allowance. The original rule,
failed observation and timestamped revision are retained. This is not a claim
that the original no-growth rule passed.

The formal resource observations reproduce those capacities: default saves
320 KiB; larger uses 64 KiB more (0.19%). Fresh peak RSS observations all pass
and are lower than their references; they do not establish a retained-memory
saving. The independent isolated diagnostic reports branching −5.39%
[−6.37%, −4.40%], replay −0.34% [−1.35%, +0.69%], and noisy registration +9.68%
[−5.19%, +26.89%]. Those are paired log-ratio intervals from eight diagnostic
rounds, not substitutes for the compiler experiment.

`npm run check` passes: types, zero unreachable files, 449 JS tests, 30 Rust
tests, 65 saved/live physics cases (68,827 exact states and 432,018 ordered
collisions), all 63 compiler track/work references and all 33 judge tracks.
Frozen runtime/test hashes remain unchanged. Adopt under the explicitly revised
resource allowance; the original no-growth rule remains failed.

## Other attempts and broader findings

- Whole-guide construction fusion passed 12,162 geometry comparisons and both
  full checkpoints. Its screen was abandoned after eight pairs: four slower
  pairs made a below-zero upper endpoint impossible in the declared 12-pair
  interval. The partial median was −0.295%; there is no completed verdict.
- Two physical-cell-bound variants passed physics/checkpoint checks but were
  slower in isolated replay/branch workloads. Neither entered compiler timing.
  The mechanism also had older negative evidence in the November 3 JSON archive;
  working guidance now explicitly checks both research narratives and JSON.
- A compact nearest-neighbor heap preserved stable ordering and full checkpoints.
  Its screen was abandoned after ten pairs, seven faster and three slower,
  at a descriptive −0.163%. Even the best possible remaining pairs could not
  qualify the declared experiment. No completed verdict or speedup claim.
- Demand instrumentation found that known earlier collisions could avoid only
  302/1,015 history replays in default/larger compilation. Streaming history
  reconstruction could avoid at most 2,554/8,423 suffix replays, with extra
  collision-query work. These are diagnostic limits, not a demonstrated gain.
- An earlier November 4 whole-grid probe stopped at 23.28% eligibility under a
  declared 25% gate, before implementing the shortcut. This round revisits its
  actual cost/benefit under a new declaration. The new exact boundary derivation
  uses two cells on both sides; the older probe used three on the upper side.

Sharing more simulation between sibling candidates is a separate design issue:
visible cache extension controls the compiler's budget, so retaining additional
frames can change search behavior. This shortcut avoids that coupling by
removing empty queries inside the same charged frames.

## Evidence and reproduction

[Diagnostics](engine-empty-sweeps-20261105-diagnostics.json) preserve every
candidate patch, declaration and policy revision, isolated results, profiles,
work counters, validation logs and one-off scripts. Raw paired records retain
all warmups/repeats, orders, resources and source/artifact identities:

- Final [screen](engine-empty-sweeps-20261105-sweep-points-screen.json),
  [default guard](engine-empty-sweeps-20261105-sweep-points-default-guard.json),
  [confirmation](engine-empty-sweeps-20261105-sweep-points-confirm.json).
- Initial sweep [screen](engine-empty-sweeps-20261105-sweep-bounds-screen.json)
  and [default guard](engine-empty-sweeps-20261105-sweep-bounds-default-guard.json).
- Abandoned [guide](engine-empty-sweeps-20261105-guide-screen.json) and
  [heap](engine-empty-sweeps-20261105-heap-screen.json) screens remain incomplete.
  Their hypothetical best completions only establish futility; they are not
  actual measurements or inferential verdicts.

To reproduce, check out `b893beee`, freeze that reference with
`tools/measure/engine_sources.ts`, apply the desired archived `candidate.patch`,
and adapt its archived scripts to fresh directories. The final timing candidate
is `sweep-points`. Use its resource-policy revision as well as its original
declaration. Documentation added after timing does not alter the measured
runtime/test files or WASM. Do not append to or reuse the archived experiments.
