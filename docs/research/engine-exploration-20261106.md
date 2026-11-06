# Algorithm and allocation experiments, November 5–6

Reference: `61a41117` (collision-grid bucket reuse). None of the native changes
below was adopted. The compiler still produced exactly the same tracks and
charged work in the diagnostic cases. Full adoption gates were not run for
rejected candidates. Raw evidence, plans, patches and study scripts are in
`engine-exploration-20261106.json`; large profiles and checkpoints are retained
locally under `generated/engine-exploration-20261106/`, with hashes in the record.

## Results

| Mechanism | Evidence | Decision |
| --- | --- | --- |
| Delay candidate construction until after trajectory/impact rejection | Only 6,999 of 199,214 proposed lines could be avoided (3.51%). Deferring full-state reads repeats the already rejected November 4 experiment. | No new implementation. |
| Maintain an engagement trough incrementally | 23,895 default trough-scan iterations versus 82,374 contact observations needing extra bookkeeping. The larger workload has the same imbalance. | No implementation; insufficient evidence of a worthwhile reduction. |
| Reserve hash capacity only when consuming an empty slot | Most apparent unnecessary growth was merely postponed; default rehashes changed from 64 to 65. WASM capacity rose 6.06%, beyond the declared 5% bound. | Rejected before timing. |
| Reconstruct lazy history from exact saved collision events | Avoided 579,900 point queries and 1,672,694 line visits in default history replay. Every history snapshot, collision and rollback boundary matched an instrumented original solver. Isolated branching improved about 7.4%, but compiler measurements did not. | First screen abandoned after six pairs (five slower); separate-history-function refinement abandoned after four pairs (all slower). Partial evidence, no completed verdict. |
| Store conservative grid bounds on each immutable geometry version | Proved-empty ordinary sweeps increased from 246,491 to 405,162 of 861,894 (28.6% to 47.0%), with all original queries executed and predictions checked in a shadow. | Complete 12-pair screen inconclusive: −0.433%, interval [−0.877%, +0.113%]. Isolated straight replay regressed 4.53%, interval [0.75%, 8.44%]. Reverted. |
| Stop constraint iteration at an exact fixed point | Only 33 of 861,894 default sweeps and 49 of 4,430,052 larger sweeps were removable; every subsequent sweep was checked for identical bits. | Far below the declared 10% opportunity gate; no implementation. |
| Skip constraints at exact squared rest length | 2,514 of 17,131,167 default calls and 8,191 of 88,218,807 larger calls qualified. Original arithmetic verified the predicted zero factors. | Far below the declared 20% gate; no implementation. |

The version-bounds trial also explicitly tested repeated line IDs, ghost grid
entries, detached caches and irreversible loss of the empty-sweep certificate.
Those lifecycle cases mattered even though the performance result was rejected.

## Profiling

V8 allocation sampling was first checked with a known transient allocation probe:
the collected-object flags preserve sampled allocations that disappear after GC.
The default compiler sampled roughly 890 MB of cumulative JavaScript allocation
per compile; the larger workload roughly 4.29 GB. These are estimates of allocation
traffic, not live memory, WASM capacity or process RSS. Raw frames, path generation,
contact detection and motion observations dominate that traffic. Previously failed
record-packing and iteration proposals were checked before considering repeats.

CPU profiles of history reconstruction used readable WASM function names. A
study-only tool matched function instruction bodies and call relationships, then
appended a name custom section to the original binary. Executable sections were
unchanged; unmatched functions remained unnamed. Profile sampling and inspector
commands are diagnostics and were never included in the paired timing study.

The profiles also exposed transpiler-generated function-name helpers in the
JavaScript path. That led to the separate native-Node runtime experiment. It is a
compiler execution-path treatment, not a change to the physical equations or
solver. Its runtime policy, complete experiments and decision are recorded
separately.
