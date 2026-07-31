# Benchmark V2 Resource Validation

Reference host: 64 logical CPUs, 62.6 GiB RAM. Engine: WASM. Concurrency: 48.

## Results

The table preserves capacity measurements from several workflow generations.
Rows named probe, stage 0, confirmation, or futility are historical. Active
comparisons use the 750k-only strict N=8/16/32/48 candidate path.

| Workload | Wall time | Peak process CPU | Peak host CPU | Peak RSS | Result |
|---|---:|---:|---:|---:|---|
| Prior 42-case probe, 252 compiles | 57.6s | 48.8 cores | 77% | 6.67 GiB | 441.6099, bit-identical |
| Canonical plus qualification, 564 compiles | 2m36s | 50.6 cores | 79% | 7.39 GiB | 451.3303 / 385.6812 |
| Linked baseline, 816 compiles | 3m35s | 50.5 cores | 79% | 7.80 GiB | 442.997 / 451.3303 / 385.6812 |
| Prior 42-case probe, 252 compiles | 58.6s | 50.5 cores | 81% | 6.36 GiB | 446.0945 |
| Canonical development pass, 1,008 compiles | 4m21s | — | — | — | derived from the retained v2-initial baseline summaries |
| Qualification sidecar, 120 compiles | 43s | — | — | — | derived from the retained v2-initial baseline summaries |
| Prior 8-seed promotion confirmation, 2,136 compiles | ~10–12 min | — | — | — | historical 42-case workflow |
| Retired stage-0 screen, 264 compiles | 1m08s | 52.0 cores | 82% | 6.84 GiB | historical +16.66 screen; 22 validity gains, 0 losses |
| Retired depth-48 confirmation, 12,672 development + 120 qualification | 58m13s | — | — | — | historical accepted attempt `c8f9c284`; no worker failure |
| Retired probe refresh, 264 compiles | 1m10s | 52.0 cores | 82% | 6.45 GiB | historical probe 462.73 |
| Historical canonical N=100 candidate comparison, 13,200 compiles | completed | — | — | — | retired full-ladder workflow; zero baseline compiles |
| Retired eval wave, 126 compiles/arm + interim look | ~90 s | — | — | — | historical validation V3 |
| Retired predictive-futility stop at look k=2 (two-arm) | 173 s | — | — | — | historical validation V3 |
| Retired depth-48 confirmation, 12,096 compiles two-arm + workspaces | ~45–50 min | — | — | — | historical validation V3 |
| Historical runner-compat probe replay, 264 compiles in a workspace | ~4 min | — | — | — | retired workflow timing |

The first 48-worker trial exposed a worker-lifecycle defect: the pool reused a slot when
a worker posted its result, before the worker thread and WASM memory had terminated. RSS
therefore accumulated across waves, reaching 59 GiB during canonical validation. The run
was stopped before OOM.

The runner now waits for worker termination before releasing each slot. Repeating the
probe reduced peak RSS from 37.76 GiB to 6.67 GiB, and the complete canonical remained
below 7.39 GiB. No swap was required. Track hashes, scores, validity, and the headline
are unchanged, establishing that the lifecycle correction affects resource ownership,
not compiler behavior.

The first three rows are retained V2.2 measurements; the historical canonical
rows derive from the retained v2-initial baseline artifacts. An active wave
costs `44 × N`: 352 at N=8, 704 cumulative at N=16, 1,408 at N=32, and at most
2,112 at N=48. The next wave is not queued until the current look returns
`continue`. If the accepted baseline lacks that prefix, its same-sized missing
tail is compiled explicitly before candidate resume; already cached baseline
rows are never recomputed. The frozen full ladder remains `132 × N` if
explicitly restored. Scoped campaign promotion retains the selected prefix
without running deferred-budget or qualification work.

Public commands default to 48 workers and print a resource sample every five seconds:
process cores, whole-host CPU, RSS, JavaScript heap, system memory, and one-minute load.
Use `--resource-interval=N`, `--no-resource-stats`, or `--jobs=N` when needed.
