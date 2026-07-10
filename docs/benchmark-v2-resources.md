# Benchmark V2 Resource Validation

Reference host: 64 logical CPUs, 62.6 GiB RAM. Engine: WASM. Concurrency: 48.

## Results

| Workload | Wall time | Peak process CPU | Peak host CPU | Peak RSS | Result |
|---|---:|---:|---:|---:|---|
| Probe, 252 compiles | 57.6s | 48.8 cores | 77% | 6.67 GiB | 441.6099, bit-identical |
| Canonical plus qualification, 564 compiles | 2m36s | 50.6 cores | 79% | 7.39 GiB | 451.3303 / 385.6812 |
| Linked baseline, 816 compiles | 3m35s | 50.5 cores | 79% | 7.80 GiB | 442.997 / 451.3303 / 385.6812 |

The first 48-worker trial exposed a worker-lifecycle defect: the pool reused a slot when
a worker posted its result, before the worker thread and WASM memory had terminated. RSS
therefore accumulated across waves, reaching 59 GiB during canonical validation. The run
was stopped before OOM.

The runner now waits for worker termination before releasing each slot. Repeating the
probe reduced peak RSS from 37.76 GiB to 6.67 GiB, and the complete canonical remained
below 7.39 GiB. No swap was required. Track hashes, scores, validity, and the headline
are unchanged, establishing that the lifecycle correction affects resource ownership,
not compiler behavior.

The linked-baseline row is the complete `baseline` command: probe, canonical development,
and qualification in one process under the final decision and compiler-identity protocols.

Public commands default to 48 workers and print a resource sample every five seconds:
process cores, whole-host CPU, RSS, JavaScript heap, system memory, and one-minute load.
Use `--resource-interval=N`, `--no-resource-stats`, or `--jobs=N` when needed.
