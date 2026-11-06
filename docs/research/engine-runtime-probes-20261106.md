# Runtime and retrieval probes after native TypeScript execution

Reference: `8bfb6f9e`, pinned Node 22.22.2 and identical physics/search behavior.
None of these probes led to an adopted runtime upgrade or retrieval cache.

| Probe | Observation | Decision |
| --- | --- | --- |
| Node 24.22.2 LTS | Four fresh ABBA processes, five warmups and three timed compiles; arm medians 7,052.6 → 7,118.2 ns/charged frame | Missed the declared 2% feasibility gate. No full requalification. |
| Node 26.13.0 LTS | Same diagnostic design; arm medians 7,027.6 → 7,006.0 ns/charged frame | About 0.3% benefit, below the same gate. No full requalification. |
| Share distances for exactly repeated model feature vectors | V6 has 187 duplicated rows of 14,340; V3 has 30 of 17,077. Only a tiny 57-row group has a large duplicate fraction. | No index/cache implementation; too little opportunity in the large groups. Counts are static and not query-weighted. |

The runtime probes use the existing compiler worker and unchanged timing
boundary. Their clocks exclude catalog preparation, hashing and output. Every
warmup and timed iteration matched the saved default track and charged work.
These are exploratory measurements, not qualified improvements or evidence that
the <7,000 ns target has been reached. Node 22.22.2 remains pinned. Official
archives were checked against their published SHA256 values; URLs, archive hashes,
actual binary hashes and V8 versions are retained.

A fresh Inspector profile of the accepted native-Node execution path shows that
garbage collection remains substantial. This profile surrounds the actual
`compileWorker`, so it also contains catalog loading, output and inspector
control overhead. Those samples are not all compiler time. In particular,
`loadCatalog` runs outside the established compiler clock. The profiling result
motivated a separate, explicitly bounded nursery-size tradeoff experiment; it
did not change benchmark preparation or timing boundaries.

Plans, scripts, complete probe iterations, decisions and profile summaries are
in `engine-runtime-probes-20261106.json`. Raw CPU profiles remain locally under
`generated/engine-runtime-probes-20261106/` with hashes in that record. Runtime
release sources: [Node 24.22.2](https://nodejs.org/en/blog/release/v24.22.2) and
[Node 26.13.0](https://nodejs.org/en/blog/release/v26.13.0).
