# Complete prefix reuse in terminal scoring

The owner requested a stronger implementation of the prior prefix-scoring trial,
which measured −2.498% [−3.197%, −1.997%] on the larger workload and narrowly
missed its predeclared 2% threshold. That [trial](engine-performance-20261104.md)
remains closed with its original result. This is a new candidate; no extra pairs
are added to the old sample. Reference sources are `61c88f1c`, whose executable
tree is identical to `4edec76a`. Work stays on `perf/compiler-after-foundations`.

**Adopted:** the revised scorer passes both the 2% screen and fresh confirmation,
with a confirmed 2.90% larger-workload improvement, default-workload equivalence,
all resource guards and the complete structural validation gate.

## What changed

Terminal continuations share an immutable physical prefix. The previous version
cached span measurements and support motion costs, but still concatenated a full
prefix of motion samples and rescanned completed contact engagements each time.
The revised implementation:

- measures only requested objective axes, retaining completed span reductions;
- retains completed support motion costs, with no cached motion-sample array;
- observes only the earliest unfinished support and the preceding burst window;
- retains completed contact-engagement measurements, recomputing any engagement
  still open at the prefix boundary;
- accounts the already-continued strike events, avoiding duplicate detection and
  unused speed-gain diagnostics.

The cache belongs to one interval search, never to a candidate or memo. Changed
raw or physical prefix boundaries use the full corresponding calculation. There
is one production scoring formula, with the original operation and accumulation
order. No search policy, scoring rule, native engine or charged-work definition
changes. A separate frozen full-rescore oracle exists only in tests.

## Correctness and work diagnostic

Typecheck, reachability and 30 focused tests pass. Tests compare exact losses and
regret arrays against the frozen original traversal across prefix boundaries,
different suffixes, reused borrowed detections, replaced physical prefixes, open
engagements, all strike contracts and disabled scoring preferences. Motion window
restarts are also checked with extreme finite values and signed zero.

An isolated compiler shadow compares all six default and 388 larger-workload
terminal scores against that original traversal, with exact agreement on losses,
regret arrays, complete tracks and charged work.

| Rows examined by terminal selection | Default: full → revised | Larger budget: full → revised |
| --- | ---: | ---: |
| Motion samples | 10,560 → 2,250 | 682,880 → 52,982 |
| Contact-engagement inputs | 10,686 → 2,216 | 691,028 → 49,002 |

These counts concern terminal selection, not the whole compiler, and are not
speedup evidence. The engagement counts exclude the original terminal impact
evaluation's additional, unused speed-gain diagnostic. Full data, frozen source
hashes and reproduction scripts are in the
[diagnostic record](engine-prefix-scoring-20261104-diagnostics.json).

## Predeclared decision

Use paired protocol v3 on CPU 2: five warmups, three measured repetitions per
fresh process, requested 95% confidence, 2% practical margin. Require cell 62 to
be FASTER in a fixed 12-pair screen and 24 fresh confirmation pairs. Separately,
a fixed 12-pair default-cell-61 guard must bound regression at +2%. Screen and
guard use order seed 1729; confirmation uses 2718.

Require unchanged WASM linear-memory capacity and no more than 15% higher fresh
process peak RSS, plus the full structural validation gate and a clean design.
Source is frozen before screening. No builds, tests or other heavy work overlap
timings. An unchanged trial is never extended or restarted. A larger-workload
gain cannot establish the default workload's 7,000 ns target.

## Results

| Stage | Pairs | Median paired time change | Confidence interval | Reference → candidate median ns/frame | Verdict |
| --- | ---: | ---: | --- | ---: | --- |
| [Larger-workload screen](engine-prefix-scoring-20261104-screen.json) | 12 | −2.641% | [−3.246%, −2.271%] | 7,571 → 7,365 | FASTER |
| [Default-workload guard](engine-prefix-scoring-20261104-default-guard.json) | 12 | −0.176% | [−1.228%, +0.601%] | 7,540 → 7,527 | EQUIVALENT |
| [Fresh larger-workload confirmation](engine-prefix-scoring-20261104-confirm.json) | 24 | −2.903% | [−3.111%, −2.657%] | 7,581 → 7,365 | FASTER |

The exact intervals have conservative coverage of 96.14% for 12 pairs and 97.73%
for 24 pairs, with 95% requested. Per-arm medians describe absolute timings;
paired percentage changes are calculated within each process pair. Confirmation
qualifies the candidate against production. There is no separate timing claim
against the earlier prototype, and the default 7,000 ns/frame target remains unmet.

All 768 warmup/measured compiles and six fresh resource compiles preserve exact
tracks and charged work. The same frozen source hash appears in all three stages:
`269dd38b72e05f76f19aa3a1a30f4b59784c2880c0127d28cd492a957bc0be47`.
Both arms use the identical native WASM, SHA-256
`b0fc5d3bd8da5e7c136607de11e347ce8823c88909da075b4f2cbe1471b7481c`.

| Fresh resource observation | WASM capacity, both arms | Reference → candidate peak RSS |
| --- | ---: | ---: |
| Larger-workload screen | 32.5 MiB | 531.3 → 507.4 MiB |
| Default-workload guard | 17.3125 MiB | 366.2 → 331.9 MiB |
| Larger-workload confirmation | 32.5 MiB | 522.7 → 506.4 MiB |

All resource limits pass. These are individual process-peak observations, not
retained-live allocation estimates or a separate statistical memory claim.

`npm run check` passes on the same frozen candidate: zero type errors or
unreachable files, 439 JavaScript tests, 29 Rust tests, 65 saved and live physics
cases (68,827 exact frame states and 432,018 ordered collisions), 68,827 raw-frame,
body-motion and cached-contact observations, 63 exact compiler cells and 33 judge
tracks. The [diagnostic record](engine-prefix-scoring-20261104-diagnostics.json)
includes the complete validation log and its hash. No parity reference changed.
