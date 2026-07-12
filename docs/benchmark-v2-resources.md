# Benchmark V2 Resource Validation

Reference host: 64 logical CPUs, 62.6 GiB RAM. Engine: WASM. Concurrency: 48.

## Results

| Workload | Wall time | Peak process CPU | Peak host CPU | Peak RSS | Result |
|---|---:|---:|---:|---:|---|
| Prior 42-case probe, 252 compiles | 57.6s | 48.8 cores | 77% | 6.67 GiB | 441.6099, bit-identical |
| Canonical plus qualification, 564 compiles | 2m36s | 50.6 cores | 79% | 7.39 GiB | 451.3303 / 385.6812 |
| Linked baseline, 816 compiles | 3m35s | 50.5 cores | 79% | 7.80 GiB | 442.997 / 451.3303 / 385.6812 |
| Prior 42-case probe, 252 compiles | 58.6s | 50.5 cores | 81% | 6.36 GiB | 446.0945 |
| Canonical development pass, 1,008 compiles | 4m21s | — | — | — | derived from the retained v2-initial baseline summaries |
| Qualification sidecar, 120 compiles | 43s | — | — | — | derived from the retained v2-initial baseline summaries |
| Prior 8-seed promotion confirmation, 2,136 compiles | ~10–12 min | — | — | — | historical 42-case workflow |
| Current eval stage 0, 264 compiles | 1m08s | 52.0 cores | 82% | 6.84 GiB | +16.66 screen; 22 validity gains, 0 losses |
| Current depth-48 confirmation, 12,672 development + 120 qualification | 58m13s | — | — | — | accepted attempt `c8f9c284`; no worker failure |
| Current light rebaseline, 264 compiles | 1m10s | 52.0 cores | 82% | 6.45 GiB | fresh probe 462.73 |
| Eval wave, 126 compiles/arm + interim look | ~90 s | — | — | — | measured, live validation V3 |
| Eval futility stop at look k=2 (two-arm) | 173 s | — | — | — | measured (smoke): ~96% of the attempt's compute saved |
| Eval depth-48 confirmation, 12,096 compiles two-arm + workspaces | ~45–50 min | — | — | — | measured, live validation V3 |
| Runner-compat replay (current probe: 264 compiles in a workspace) | ~4 min | — | — | — | historical timing; current count is normative |

The first 48-worker trial exposed a worker-lifecycle defect: the pool reused a slot when
a worker posted its result, before the worker thread and WASM memory had terminated. RSS
therefore accumulated across waves, reaching 59 GiB during canonical validation. The run
was stopped before OOM.

The runner now waits for worker termination before releasing each slot. Repeating the
probe reduced peak RSS from 37.76 GiB to 6.67 GiB, and the complete canonical remained
below 7.39 GiB. No swap was required. Track hashes, scores, validity, and the headline
are unchanged, establishing that the lifecycle correction affects resource ownership,
not compiler behavior.

The first three rows are retained V2.2 measurements; the historical canonical rows derive
from the retained v2-initial baseline artifacts (summary timestamps and
per-run elapsed times). The current depth-48 promotion runs 6,336 fresh
baseline-snapshot development compiles, 6,336 candidate development compiles,
and 120 candidate qualification compiles after acceptance. The current probe
and rebaseline establish that the 48-worker memory envelope remains controlled
under execution protocol V4; the 12-seed calibration reference deliberately
uses 32 workers for additional memory margin.

Public commands default to 48 workers and print a resource sample every five seconds:
process cores, whole-host CPU, RSS, JavaScript heap, system memory, and one-minute load.
Use `--resource-interval=N`, `--no-resource-stats`, or `--jobs=N` when needed.
