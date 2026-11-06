# Reject the larger V8 nursery on its memory bound

Reference: `8bfb6f9e`, pinned Node 22.22.2. Increasing V8's maximum semi-space
size to 32 MiB improves compiler timing, but **fails the declared memory bound**.
The candidate is rejected. No `.npmrc`, runtime flag or compiler change remains.
The last qualified default result remains **7,172.5 ns per charged frame**.

The fresh profile showed substantial garbage-collection cost. This trial tested
Node's documented throughput/memory tradeoff through one standard npm setting,
without changing input preparation, the compiler clock, search or physics.
A 24 MiB exploratory request was observed to select the same V8 capacity as
32 MiB; formal qualification used the explicit 32 MiB value. The exploratory
ABBA result motivated qualification and was not itself adoption evidence.

## Prospective decision and results

The default screen fixed 12 process pairs, five warmups, three measured compiles,
CPU 2, requested 95% confidence and a zero minimum speed margin. Fresh confirmation
would require 24 pairs. Larger-workload and cold-start guards fixed 12 pairs with
upper regression bounds of 2% and 5%, respectively. Every resource observation
had to stay within 1.05× WASM capacity and **1.15× lifetime peak RSS**, including
separate warmed observations before confirmation. Complete structural validation
and checkpoint equality were independent requirements.

| Stage | Paired median change | Interval | Arm medians, ns/charged frame | Tool verdict |
| --- | ---: | --- | ---: | --- |
| default screen | -1.488% | [-2.581%, -0.943%] | 7,112.9 → 6,997.0 | FASTER |
| larger guard | -1.994% | [-2.556%, -1.566%] | 6,815.9 → 6,677.6 | INCONCLUSIVE at 2% |
| cold guard | -2.376% | [-2.883%, -1.978%] | 16,059.9 → 15,698.6 | EQUIVALENT at 5% |

Both timing guards pass their declared upper regression bounds. However, the
larger workload's separate cold-process peak RSS is **436.1 → 507.3 MiB (+16.3%)**,
exceeding 15%. WASM remains 33.5 MiB. The driver stops before warmed-resource
checks, confirmation and the planned native null control. The bound is not
relaxed after seeing the result. A screen below 7,000 ns does **not** establish
that the target has been reached.

All 414 warmup, measured and resource compiles in these three completed stages
match their committed track and charged work. `npm run check` also passes under
the proposed runtime setting: 449 JS tests, 31 Rust tests, 65 saved/live physics
cases, 63 compiler cells, 33 judge tracks, types and zero unreachable code.
Complete compiler checkpoints match for cells 61 and 62.

## Corrected setup and retained evidence

The initial complete 12-pair run was invalid for qualification: preparation
imported the snapshot function before editing its optional-file list, so the
frozen runner missed the new `.npmrc`. Per-arm runtime flags were applied and
recorded, but control detection considered only source and WASM identity and
misclassified the treatment as a null control. That run and its failure remain
in `engine-nursery-20261106-invalid-screen.json`.

Before fresh screening, copy and assert the exact configuration bytes and compare
actual per-arm runtime options when identifying a null control. The candidate,
thresholds and timing protocol remain unchanged. The corrected source delta is
`.npmrc`, and the frozen machine record explicitly lists both runtime settings.
The ordinary production timing tool is unchanged.

Complete results are `engine-nursery-20261106-{fixed-screen,larger,cold}.json`.
The diagnostics JSON preserves plans, scripts, both runner versions, correction,
configuration bytes, logs, exploratory observations and checkpoint hashes.
Local complete checkpoints remain in `generated/engine-nursery-20261106/`.

[Node's pinned flag documentation](https://github.com/nodejs/node/blob/v22.22.2/doc/api/cli.md#--max-semi-space-sizesize-in-mib)
describes the memory/throughput tradeoff. [npm's configuration documentation](https://docs.npmjs.com/cli/v10/using-npm/config#node-options)
describes propagation to lifecycle scripts. Direct `node` commands require an
explicit flag; merely freezing `.npmrc` does not change the runtime.
