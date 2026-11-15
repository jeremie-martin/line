# Compiler throughput and memory on the i7-12800H

The owner primarily runs many specifications/seeds in parallel, with occasional
single-track generation. Investigate both throughput and latency, distinguishing
core types before attributing contention to the compiler.

## Foundation

`704dd39c`, on `geometry-improvements`, restores the compiler before the fold
experiment, retaining unused-support-end trimming. Compiler/test/parity files
match `e06720f9`. The fold experiment is preserved at
`archive/upward-folds-20261115` (`5f860649`), with its dashboards and experimental
branches. It is not active production code on this branch.

Full `npm run check` passes: 626 tests, 32 Rust tests, exact physics and engine
observations, compile/judge parity and end-to-end smoke, 2.4 minutes. The only
untracked user file is the supplied compiler transcript; it is untouched.

## Machine and protocol

Intel i7-12800H, 61 GiB RAM, Node 26.13.1, pinned Rust. CPUs 0–11 are six P cores
with SMT pairs (0,1), (2,3), etc.; CPUs 12–19 are eight E cores. All 20 CPUs are
available. The existing governor is `powersave`; it was not changed. Single-P
allows CPUs 4–7 (two physical P cores, for runtime background work); single-E
allows 12–13. P-only allows 0–11 and E-only allows 12–19.

A fresh Node process compiles each task through the existing parity worker, at
the standard production allowance. Tasks alternate the two existing performance
cells: Luna Bala automatic #101 and Tiki Tiki automatic #202 (2,941,177 and
2,993,528 charged frames). Every output must match its committed track hash and
charged work. These are compile workloads, not music-quality evaluations; the
use of parity inputs does not claim a V8 quality result.

Batch wall time includes process startup, input loading, compilation, hashing and
output. It excludes the benchmark's subsequent evaluation/reporting pipeline.
The worker also reports compiler-only wall/CPU times and peak process RSS.
Every 200 ms the harness samples aggregate child RSS, thread count, main-thread
CPU placement and package temperature. Aggregate RSS sums processes, so shared
pages can be counted more than once; it is not unique physical memory or PSS.
No other builds, tests or timed workloads run alongside the batch measurements.

The package reaches 100°C and thermal-throttling counters rise during the study.
This makes core type, package power and cooling relevant; these measurements do
not isolate memory-bandwidth contention. Seven OS threads per Node process does
not mean seven continuously busy cores.

## Initial topology screen

Single runs use four tracks; parallel runs use 24. This screen is not a precise
ranking: small-batch tails and fixed order can bias comparisons.

| Configuration | Tracks/minute | Median compile seconds | Peak aggregate RSS, GiB |
|---|---:|---:|---:|
| Single P | 3.60 | 16.50 | 0.75 |
| Single E | 2.13 | 27.86 | 0.78 |
| Six workers, P only | 15.77 | 22.50 | 4.08 |
| Eight workers, E only | 12.37 | 38.22 | 5.47 |
| Six workers, all CPUs | 15.02 | 23.58 | 4.20 |
| Twelve workers, all CPUs | 18.93 | 36.19 | 7.56 |
| Fourteen workers, all CPUs | 19.02 | 38.89 | 9.05 |
| Twenty workers, all CPUs | 18.80 | 55.73 | 12.58 |

E cores are slower per job but contribute substantial useful throughput. Slower
per-track times with more workers are not themselves a throughput regression.
Native engine memory is only 33–39 MiB in these compiles, while process peak RSS
is roughly 700–750 MiB. Most process memory therefore lies outside that engine's
linear memory; this does not establish that it is all live JavaScript data.

## Allocation experiments: none retained

An Inspector allocation sample over one standard Luna compile reports 14.46 GB
of allocation traffic, not live memory. Geometry construction is a major source:
`motionArcPaths` 1.86 GB, `railMeetsSupport` 1.71 GB, `solidPathLines` 1.06 GB.
All trials preserve the original check on 10,000 varied sequential inputs;
the scratch-storage prototype additionally passes all 25 compile parity cases.

- Reuse grid buckets, point marks and gap lists: 14.37 GB total, clearance
  1.69 GB. Mechanism not supported strongly enough to justify shared scratch.
- Remove per-point intermediate result objects and empty iteration arrays:
  14.32 GB total, clearance 1.55 GB. Small reduction, no qualified timing benefit.
- Use nested integer grid coordinates instead of combined numeric keys:
  14.36 GB total, clearance 1.55 GB. The suspected boxed-key explanation is
  unsupported; no additional reduction.
- Hoist segment-distance helper functions: 14.43 GB total, clearance 1.70 GB.
  No meaningful reduction.

All prototypes were reverted. The scratch prototype's eight-round timing run was
stopped incomplete after the allocation/design decision; it supplies no speed
verdict. One later diagnostic profile briefly overlapped that run's termination;
no profiler wall time is used as speed evidence. No runtime flags, shared caches,
new worker default, geometry or scoring changes are retained.

## Longer batch confirmation

Declared before running: 60 tracks per batch, twelve versus twenty workers, all
CPUs available, order 12 / 20 / 20 / 12. Sixty divides evenly by both counts,
reducing the small-batch tail effect. Read the completed sequence, not an interim
result, before making a resource recommendation.

| Batch, in run order | Elapsed seconds | Tracks/minute | Median compile seconds | Peak aggregate RSS, GiB |
|---|---:|---:|---:|---:|
| long-12-a | 175.94 | 20.46 | 34.75 | 7.75 |
| long-20-a | 170.57 | 21.11 | 55.24 | 12.51 |
| long-20-b | 171.02 | 21.05 | 55.39 | 12.59 |
| long-12-b | 187.10 | 19.24 | 36.74 | 7.54 |

Pooling equal-sized batches, twenty workers deliver 21.08 tracks/minute versus
19.83 for twelve. Twelve trades about 5.9% of throughput for 39% lower mean peak
aggregate RSS (7.64 versus 12.55 GiB). The per-pair wall-time advantage for twenty
is 3.1% and 8.6%; two pairs do not support a precise confidence interval. The
second twelve-worker batch is slower, demonstrating why the first screen alone
would have been insufficient. All 392 complete timed compiles across the screen
and confirmation reproduce their expected track and charged-frame count.

**Decision:** keep the detected twenty-worker default on this machine for maximum
batch throughput. Use `--jobs=12` explicitly when memory headroom or responsiveness
matters more. This is an observed local tradeoff on two standard workloads, not a
universal recommendation for other machines or long/heavier specifications.
For latency-sensitive single generation, P cores are faster; the affinity used
here is a diagnostic control, not a new hard-coded production policy. Do not
exclude E cores from batch work: they contribute substantial throughput.

No compiler speedup or intrinsic memory reduction qualified. The production
compiler, engine, runtime flags and worker policy remain unchanged from the
checked foundation. The adopted changes are parking the provisional folds and
correcting performance guidance with measured evidence.

Raw local artifacts and the one-off reproduction harness are under
`generated/throughput/`: `machine.json`, `topology-sweep.json`, `sweep.py`, allocation
profiles and differential checks. No raw tracks, samples or study scripts are
committed. Existing `perf:engine` remains the paired single-track speed gate.
