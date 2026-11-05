# Prepare interval controls once

Adopt a small compiler optimization on `perf/compiler-after-foundations`, against
`09220d44`. Resolve active control fields and their definitions once per interval,
then apply the same normalization to each candidate. The registry remains the
single source of field rules; its order still normalizes support before dependent
turn timing. Each candidate gets its own copy. The interval context is captured
by value, with no cache, invalidation scheme, generated code or alternate path.
Native physics, scoring, search order, tracks and charged work are unchanged.

## Evidence and decision

Fresh V8 CPU profiles used five warmups followed by three sampled compiles per
cell. `normalizeArcControl` accounted for 1.21% of sampled self time in default
automatic construction (61) and 0.98% in its larger-budget workload (62). Rechecking
interval-invariant field activation and registry lookups was avoidable work.

The frozen candidate used protocol v3 on CPU 2, Node 22.22.2, the existing
Core i7-12800H laptop: five warmups, three timed repeats per process, balanced
randomized pairs, requested 95% confidence. Screen/default guard used 12 pairs
and seed 1729; fresh confirmation used 24 pairs and seed 2718. Negative changes
are faster. No extra pairs, restarted experiments or candidate edits occurred.

| Workload | Pairs | Median change | Exact interval | Tool verdict at 0.5% |
| --- | ---: | ---: | ---: | --- |
| Larger automatic, screen | 12 | −0.981% | [−1.353%, −0.707%] | FASTER |
| Default automatic, guard | 12 | −0.704% | [−1.342%, −0.186%] | INCONCLUSIVE |
| Larger automatic, fresh confirmation | 24 | −0.660% | [−0.840%, −0.434%] | INCONCLUSIVE |

**Policy correction, disclosed:** the initial assistant declaration made a 0.5%
benefit another hard adoption minimum. After observing 17 confirmation pairs,
it was explicitly revised to honor the owner's earlier instruction to weigh
supported smaller gains and simplicity rather than enforce a universal minimum.
The revision requires the full fresh confirmation interval below zero, the
default-workload upper bound at most +2%, unchanged WASM capacity, peak process
RSS at most +15%, exact correctness and clean design. This was **not** a
predeclared adoption rule. The original declaration and timestamped revision
are both retained in diagnostics. The original experiment and verdicts are
unchanged: `performanceQualified` remains false at the 0.5% comparison margin.

Adopt under that revised policy: the complete fresh interval supports benefit,
23 of 24 confirmation pairs favor the candidate, and the separate default guard
also bounds a positive benefit. The implementation adds nine lines in the
normalization module and removes repeated work without changing its rules.
There is no claim of a confirmed improvement exceeding 0.5%.

Descriptive median process timings are **7,403 ns per charged frame** for the
default candidate (baseline 7,465), and **7,071 ns** for the larger candidate in
confirmation (baseline 7,113). These include compiler work, not just solver
stepping. The default <7,000 ns goal remains open. Paired changes above are the
inference; ratios of these separate arm medians are not substitutes for it.

WASM high-water capacity remains 17.3125 MiB / 32.5 MiB in default/larger
workloads. All fresh resource observations satisfy the +15% process peak RSS
bound. These single-process observations do not establish a retained-memory
improvement. The native binary is unchanged.

## Correctness and workflow

A differential check covers 202,176 normalizations across 648 interval contexts,
including omitted fields, signed zero, nonfinite values and property order.
Complete compiler checkpoints and JSON field order match the reference on both
timing workloads. A maintained test covers context capture, candidate ownership,
omission and dependent timing. All timed compiles enforce exact track/work parity.

`npm run check` passes: types, reachability, 448 JS tests, 29 Rust tests, 65
saved/live physics cases, all 63 compiler references and all 33 judge tracks. Full output and
validated file hashes are retained in diagnostics.

After timing finished, improve observability without changing inference:
`perf:engine` prints the running median and faster/slower/tied pair counts.
`--report` reads unfinished v3 evidence as descriptive progress, exits nonzero,
and never reports qualification or an interim confidence interval/probability.
Snapshots are replaced atomically. Clearly losing trials can be abandoned with
their partial evidence retained; completed adoption still needs fixed runs and
fresh confirmation. Tests cover empty/partial records, malformed pairs, attempts
to present unfinished evidence as qualified, and unchanged fixed-sample inference.
These reporting changes were made after measurement; they are not part of the
frozen performance patch.

## Reproduction

The [screen](engine-control-normalization-20261105-screen.json),
[default guard](engine-control-normalization-20261105-default-guard.json) and
[confirmation](engine-control-normalization-20261105-confirm.json) retain every
warmup/repeat, paired order, resource observation, source/binary identity and
original verdict. [Diagnostics](engine-control-normalization-20261105-diagnostics.json)
retain declarations, profiles, checks, the frozen patch and one-off scripts.

For the original comparison, check out `09220d44`, freeze that reference with
`tools/measure/engine_sources.ts`, apply `performanceCandidatePatch` from the
diagnostics, and adapt the archived `measure.py` paths to fresh directories.
Keep the original runner for exact measurement provenance. Do not reuse output
directories or splice new observations into these completed experiments.
