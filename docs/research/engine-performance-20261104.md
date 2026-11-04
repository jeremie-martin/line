# Compiler performance after the foundation calibration

Reference: `4edec76a`; branch: `perf/compiler-after-foundations`. This is structural
performance work: physics, tracks, scores, search policy and charged work must
remain identical. The target remains below 7,000 ns per charged physics frame
for the default automatic compiler workload. Compile time per charged frame
includes search, geometry registration and observations as well as physics.

**Outcome: no production change qualified.** All three implemented candidates
are reverted, and the compiler and native engine remain exactly the reference.
The 7,000 ns target is still unmet. This record preserves the failed trials and
their limits so they need not be repeated as new hypotheses.

## Measurements

The current laptop is an i7-12800H with 16 GB RAM, Node 22.22.2. Paired compiler
timing trials use CPU 2, five warmups and three measured compiles in each fresh process. The
unprofiled starting point is approximately 7,500 ns/frame for cell 61 (default)
and 7,700 for cell 62 (larger budget). These numbers cannot establish a gain over
historical measurements with a different warmup policy.

The experiment uses [protocol v3](../engine-validation.md#timing-protocol-v3):
fixed balanced randomized AB/BA process pairs, a paired median-change interval,
and fresh confirmation required before adopting a speedup. Tests, builds and diagnostic
compiles never overlap timings. Each iteration verifies the expected track hash
and charged-frame count. Resources come from separate fresh processes.

Six V8 Inspector CPU profiles (250 µs sampling) show native replay and geometry
registration as the main costs. Candidate recording accounts for 0.99% of the
default workload and 8.34% of the larger workload, including its callees; its own
body accounts for 0.61% and 4.39%. Sampled stacks are diagnostic, not speedup
evidence. Linux `perf` is unavailable under the machine's current permissions.
A differently built symbol-bearing WASM is not used as an exact symbol map.

[Diagnostics and study code](engine-performance-20261104-diagnostics.json) retain
the baseline observations, profile summaries, operation counts and reproduction
scripts. Raw `.cpuprofile` files are saved locally under
`generated/engine-performance-20261104/`, with hashes in that manifest; Chrome
DevTools can import them. These local artifacts are not part of the commit.

## Closed hypotheses

| Hypothesis | Evidence | Decision |
| --- | --- | --- |
| Remove redundant candidate-object copies | Twelve paired rounds: aggregate −0.32%, interval [−1.26%, +0.16%]; default guard upper bound +4.38% | Reverted; no qualified speedup or confirmation |
| Normalize control-object shapes | All 9,905 default controls keep fast properties; only 255 of 44,631 larger-workload controls lose them | No production rewrite |
| Share direction filtering across the ten points in a frame | Conservative default cost: +95.26% direction dots, +29.01% collision-line visits | No production cache |
| Certify reused filters with bounds over line normals | Estimated arithmetic rises 64.84% / 57.81%, including maintenance and fallback | No production cache |
| Defer unused terminal scoring during local refinement | None of the six default or 388 larger-workload terminal scores comes from local refinement; planning needs all of them | No lazy scores or phase flags |

The collision diagnostics check every proposed result against the unchanged
solver and retain exact tracks/work. They are conservative operation estimates,
not measured slowdowns. The first candidate's full timing record is
[preserved unchanged](engine-owned-candidate-20261104-screen.json).

## Prefix scoring candidate

Competing terminal continuations share most of their physical trajectory. The
candidate reuses completed span-axis reductions, motion samples with an available
next velocity, and completed support motion terms. It accounts already-continued
strike events instead of detecting the same prefix again. A changed prefix uses
the complete calculation. Shared formulas and accumulation order are preserved;
no borrowed detection arrays survive their callback.

The cache belongs to one interval search, never to a candidate or memo entry.
It introduces no runtime switch, search approximation, learned artifact or native
engine change. Unit cases cover prefix boundaries, changing suffixes, overwritten
borrowed detections, invalid impact accounts, all strike contracts and exact
motion-window splitting. A shadow run compares all 394 actual terminal losses
and regret arrays against complete rescoring, with exact agreement.

The predeclared adoption policy requires cell 62 to be FASTER with a 2% margin
in a fixed 12-pair screen and fresh 24-pair confirmation. A separate 12-pair
cell-61 guard must bound regression at +2%. WASM capacity must stay unchanged,
separately measured peak RSS must not rise more than 15%, and the full structural
gate must pass. Results are reported per workload; a cell-62 gain does not
establish the default workload's absolute target.

The [fixed screen](engine-objective-prefix-20261104-screen.json) measures a
−2.498% median change, interval [−3.197%, −1.997%]. It narrowly misses the
predeclared 2% FASTER boundary. No confirmation, extended sample or adoption
follows. The [default-workload guard](engine-objective-prefix-20261104-default-guard.json)
is EQUIVALENT: −0.102% [−0.945%, +0.281%]. All 384 warmup/measured compiles and
four resource compiles preserve exact tracks/work. The candidate is reverted;
its source patch is retained with the diagnostic code.

| Workload | Reference median ns/frame | Candidate median ns/frame |
| --- | ---: | ---: |
| Default (61) | 7,578 | 7,571 |
| Larger budget (62) | 7,603 | 7,426 |

These are medians of process-level measurements. The paired percentage-change
interval is calculated from each pair, not from the ratio of these two medians.

## History velocity storage candidate

Velocities remain fixed through a frame's six solver sweeps. This candidate
retains exact intermediate positions and point identities in one 24-byte snapshot
record, reading velocity from the owning saved frame instead of duplicating it
in every 40-byte linked record. Cloning and rollback remain under `FrameCache`.
The trial allows a resource tradeoff, requiring at least 15% lower WASM capacity
in both workloads, at most 15% higher process peak RSS, then separate fixed
12-pair timing guards bounding CPU regression at +2%.

All 30 Rust tests, 65 saved/live physics cases and 12 fresh resource compiles
pass exactly. [Resource observations](engine-history-velocity-20261104-resources.json)
reproduce 17.3125 → 15.625 MiB for cell 61 (−9.75%) and 32.5 → 31.375 MiB for
cell 62 (−3.46%) in all three processes per arm. Both miss the 15% eligibility
gate, so there is no timing trial or adoption. Source and packaged binary are
reverted; the patch and reproduction script are in the diagnostic archive.

## Final validation

`npm run check` passes on the restored production tree: 424 JavaScript tests,
29 Rust tests, zero type errors or unreachable files, all 65 saved/live physics
cases (68,827 frame states and 432,018 ordered collisions), all 63 exact compiler
track/work cells in 254 seconds, and all 33 judge tracks. The final log is saved
locally with its hash in the diagnostic archive.

All 788 warmup, timed and fresh-resource compiles across the implemented trials
preserve exact tracks/work. No trial reaches confirmation. Executable sources,
tests, fixtures and the packaged native WASM are unchanged from `4edec76a`;
the WASM SHA-256 remains
`b0fc5d3bd8da5e7c136607de11e347ce8823c88909da075b4f2cbe1471b7481c`.
