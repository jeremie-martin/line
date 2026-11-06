# Four exact optimization trials toward 6,500 ns

Reference `1908fc83`, on `perf/compiler-after-foundations`. No candidate is
adopted. Production source and the packaged WASM are restored byte for byte to
the accepted `0b5402df` implementation. The last qualified default timing remains
**6,979.3 ns per charged physics frame**; the 6,500 ns target remains open.

| Candidate | Evidence | Outcome |
| --- | --- | --- |
| [Fuse detector and summary traversal](engine-fused-detection-20261106.md) | 12-pair screen −0.317%, interval [−1.116%, +0.270%], zero margin | INCONCLUSIVE; remove |
| [Certify cache hits with bounded world-coordinate interiors](engine-bounded-cells-20261106.md) | 12-pair screen +0.597%, interval [−0.122%, +0.806%], 0.5% margin | INCONCLUSIVE; remove |
| [Use a narrower cell-coordinate conversion](engine-narrow-cells-20261106.md) | Eight pairs, descriptive median +0.389%; fixed rule no longer attainable | Abandon; remove |
| [Remove duplicated cell validity](engine-cell-intervals-20261106.md) | Four pairs, descriptive median +1.181%; fixed rule no longer attainable | Abandon; remove |

All trials use the established v3 process-pair workflow on CPU 2 with pinned
Node 22.22.2 and Rust 1.95.0, five warmups and three measured compiles per
process, without overlapping heavy work. The two completed screens request 95%
confidence and have 96.14% exact coverage. The two abandoned trials have no
completed inferential verdict; remaining hypothetical wins were used only to
prove that the predeclared full experiment could no longer qualify.

All **584 compiler calls** retained in completed pairs and separate resource
probes match tracks and charged work exactly. Both complete compiler checkpoints
match for every candidate. Detector differential testing passes 37,800 cases;
the native candidates pass Rust tests and all 65 saved/live physics cases.
Private WASM checks pass another 2,002,697 conversion comparisons and 3,033,246
cache-state comparisons. Candidate correctness was not the obstacle.

The world-bound audit certifies about 86% of cell queries without divisions,
and generated code actually skips those divisions on hits, but the complete
workload does not improve reliably. Narrow conversions retain saturation
checks. Even deleting redundant state shrinks the binary without improving this
screen. These results justify rejecting the implementations; they do not prove
a particular microarchitectural cause or establish a limit on future gains.

No larger/cold guard, fresh confirmation or full adoption suite is run after a
failed screen. All experimental code and tests are removed. No framework, flag,
new production dependency or fallback remains. Further work should seek a
measurable reduction in total workload rather than infer speed from source
operation counts alone.

[Restored-source verification, recomputed decisions and artifact checks](engine-cache-round-20261106.json)
link the final state to the archived evidence. Each candidate's document links
its prospective plan, patch, drivers, correctness results and timing samples.
