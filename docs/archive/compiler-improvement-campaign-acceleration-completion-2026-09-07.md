# Compiler Improvement Campaign

The above-650 goal is achieved. The active 750k Benchmark V2 baseline is
**761.9107**, promoted as `native-motion-feedback` on 2026-09-07, with
**352/352 valid runs** at N=8. The prior promoted headline was 607.2582 at N=32.
The benchmark, score, validity rules, compute accounting, and evaluation physics
are unchanged.

The final governed comparison measures **+154.6787 paired points** (SE 0.9294)
against the matching old-baseline N=8 prefix, whose headline is 607.2320.
It accepts at the first declared look: t=166.4286 versus the required 4.8106.
No force override was used. The new cache retains exactly that accepted prefix;
N=48 was the declared maximum, not the number of executed seeds.

## What changed

The compiler constructs physical motion directly from the authored contact,
air, speed, amplitude, and impact targets. Native energy-line geometry controls
the rider's actual next-frame velocity and corrects pose error. Ballistic release,
contact timing, and feedback over the existing impact window replace dependence
on the old catch templates for ordinary air/speed/amplitude requests. The
construction uses generic spec data and honors manual starts.

An isolated compiler simulation backend adds exact computed-prefix reuse and
collision-position observation. It retains the physical equations. All simulation
work, including branch trials and replay, is charged. Every completed track must
match a full cold replay with the frozen benchmark engine. The final canonical
compiles use 58,495–238,907 physical frames each, median 133,581, within the actual
750k limit. This is frame accounting, not a measured wall-clock speedup.

The public compiler selects the new implementation by default for supported
ordinary requests. Explicit legacy diagnostics and other axes retain their
existing compiler path. Undefined optional arguments are correctly treated as
absent, including the production and low-budget caller shapes.

## Evidence

| Surface | Final result | Interpretation |
|---|---|---|
| Governed development, 44 sources × 8 seeds at 750k | 761.9107; 352/352 valid; accept | Promoted headline |
| Standing mini manifest, 11 sources × 48 seeds at 250k | 528/528 valid versus 465/528; 63 rescued, zero lost | Separate non-promoting reading |
| Qualification, 5 sources × 8 seeds × 3 budgets | 120/120 valid; monitor 694.0037 | Frozen candidate, no qualification tuning |
| Budget range, two sources at 150k/750k/1M/3M | 8/8 valid; every run within budget | No special 750k dispatch; larger-budget outputs match 750k |
| Published JavaScript engine replay, two full tracks | Exact entire raw trajectories | Ordinary geometry works outside the compiler backend |

All four canonical strata improve. One source-level aggregate regresses:
`high_air_drive`, by 12.3385 points; all its runs remain valid. Dense recovery,
high-air impact, and amplitude remain useful places to investigate in future
work. No further improvement target is substituted for the completed goal.

The 250k mini-manifest score rises from 552.3198 to 793.8142; it is a
renormalized subset score, not the suite headline. Its seed-blocked arithmetic
per-cell gain is 265.2030 (SE 4.9870). The same archived arms were reported after
the initial and final evaluations; this is one physical sample, not two.
Qualification monitor scores are 695.2786 / 693.7097 / 693.6437 at
250k / 500k / 750k, respectively, and do not alter baseline governance.

Seventeen focused compiler and identity tests, 65 broader compiler/CLI/budget
tests, seven post-fix compiler/CLI tests, and five baseline-analysis contract
tests pass. These suites overlap and are not an additive unique-test count.
The packaged backend also passes 360 prefix/trace checks and full trajectory
comparisons. The repository-wide TypeScript check retains unrelated existing
failures; none points to the new production files or final audit/report changes.

The first accepted candidate preceded an optional-argument dispatch correction.
The corrected final compiler received a new canonical comparison. All 352 tracks,
reports, and frame counts exactly match the initial evaluation on the same
seeds. These are separate candidate evaluations, not independent replicates;
only the final N=8 comparison is promoted.

## Reproduction and retained records

- Final candidate: `b4c9bff756e14a0d4cbd07d0062bf824ce4f587a8cd88211b528b98e7c85ae23`.
- Source: `9522c81e47961ec7f83e40e2e33dd7f7e82e1b3f80be7f57589df9afa6896d34`.
- Compiler commit: `75c3e990`; implementation commits `3135826e` and `0d6bde19`.
- Active manifest: [campaign-baseline.json](../benchmark/v2/campaign-baseline.json).
- Checksummed validation index: [native-motion-feedback-validation.json](../benchmark/v2/studies/native-motion-feedback-validation.json).
- [Current baseline analysis](benchmark-v2-current-baseline-analysis.md) describes the exact promoted N=8 archive.

The retained development archive, snapshot, comparison, and comparison request
are under `benchmark/v2/runs/native-motion-feedback-*`. Generated research and
monitor archives remain outside commits; the validation index records their
paths, identities, and hashes. `npm run benchmark -- status` verifies the active
baseline and reports the next governed comparison command.

The full sequence of hypotheses, failures, corrections, physical costs, commands,
and evidence is in [the detailed campaign](unrestricted-650-campaign.md).
The [pre-promotion campaign](archive/compiler-improvement-campaign-before-native-motion-promotion-2026-09-07.md)
and [pre-restart history](archive/compiler-improvement-campaign-through-2026-08-16.md)
are preserved. Their old closures inform future work without restricting the
compiler authorization in [goal.md](../goal.md).
