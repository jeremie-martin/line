# Engine and compiler validation

Use the pinned Node (`nvm use`) and Rust versions. The engine kernel, compiler
search and judge are different contracts; passing one does not imply the others.

| Command | Purpose |
| --- | --- |
| `npm run check:physics` | Fast exact saved-reference states and ordered collisions; no local judge, compiler or audio inputs |
| `npm test` | Unit, ownership, failure, cache and generated-operation tests |
| `npm run verify:engine` | Live independent physics and wrapper/derived-observation comparison |
| `npm run parity` | All 63 compiler tracks **and charged physics work**, exact |
| `npm run parity:judge` | Independent judge results on 33 committed tracks |
| `npm run check` | Complete structural gate, including types, reachability, JS/Rust tests and all checks above |
| `npm run bench:engine` | Registration, stepping and branch workload diagnostics |
| `npm run perf:engine -- --help` | Paired engine/compiler timing and resource comparisons |

After editing packaged native Rust or TypeScript, run `npm run build:native`
before checking. The manifest test rejects stale packages. `npm run build:wasm`
builds the separate local judge needed by live comparison, judge tests and the
full gate. A native optimization does not require rebuilding that judge.

## Correctness layers

Both physics checks cover 33 committed rides and 32 seeded stress cases with
normal, acceleration and scenery lines, extensions, reversed/flipped geometry,
zero-length lines, grid boundaries and different starting velocities. Saved
fingerprints cover every binary64 state value and ordered collision triple,
including the collision iteration. They localize failures to 256-frame blocks;
the live check compares individual frames and derived public observations.

The saved reference separates its encoding `format` from historical `provenance`.
`check:physics` checks the format, the complete case/input identities, and every
expected state/event block. It never loads the local judge or compares current
source hashes with the generator's hashes. Rebuilding or optimizing the judge,
or refactoring the generator without changing its inputs/encoding, does not
invalidate saved physics. Oracle, generator and corpus-source hashes record
what originally produced the evidence; verification never refreshes them.

Explicit generation reads the local independent judge and records its exact
binary hash alongside source provenance. To extend the corpus, generate to a
**new path**:

```sh
npm run check:physics -- --write-reference=/tmp/new-engine-reference.json
```

Build the judge first if it is absent. Generation always uses that independent
oracle, including when its binary differs from the original build. Review the
provenance and corpus change before replacing `tools/parity/engine-reference.json`. Existing physical
expectations must not be changed merely to make a candidate pass. The live check
and generated lifecycle tests remain necessary: saved straight replays alone do
not verify branch/reset/detach/release behavior or budget accounting.

Counterfactual research uses `withArcStudy`: owned learning, memo values, counters
and a fresh engine rebuilt from declared geometry. Prefix preparation runs through
the next entry frame outside the probe budget; search then uses the caller's
remaining budget. No original engine is observed or detached. These study costs
are diagnostics under this explicit preparation policy, not production costs.
Authored inputs are shared read-only; callbacks return owned data. Failure tests
require identical compiler tracks and complete statistics with and without studies.
`catch_price.ts run` requires a fresh output directory and records its preparation
policy. It cannot silently resume older probe results or a different seed.

## Timing protocol v3

Declare the workload, pair count, warmup, repeats, confidence and practical margin
before collecting data. Work on a quiet machine; never overlap timings with
builds, tests, parity or other substantial work. CPU affinity reduces migration;
it does not isolate a core from interrupts, SMT siblings, temperature or frequency
changes. On this laptop the established affinity is CPU 2.

```sh
taskset -c 2 npm run perf:engine -- --mode=compile --cells=61 --reference=/tmp/before.wasm --candidate=/tmp/after.wasm --rounds=12 --confirm-rounds=24 --out=generated/engine-ab/screen
taskset -c 2 npm run perf:engine -- --mode=compile --cells=61 --reference=/tmp/before.wasm --candidate=/tmp/after.wasm --stage=confirm --rounds=24 --screen=generated/engine-ab/screen/result.json --out=generated/engine-ab/confirm
```

Add `--reference-root=/path/to/earlier-checkout` to both commands for compiler or
wrapper changes. Both arms run frozen source in the same disposable directory,
with fixed runner, reference engine, fixtures and dependencies. Source/binary
identities, runtime, environment options and CPU affinity are recorded. Every
warmup and measured compile must match its committed track and work count.

Each pair contains two fresh processes. AB and BA order is balanced and shuffled
with a recorded seed. Compile defaults are five warmups and three measured
repeats per process; engine defaults are one and two. All iterations are saved,
with a per-iteration median profile. Fixed warmup defines a repeatable workload;
it is **not a claim of steady state**. Cold and warmed timings must be identified
separately. Changing warmup can change ns/frame without improving any code.

Within-process repeats are summed first. The inference unit is the process pair,
not a frame, track or repeat. For each pair, compute `100 × (candidate/base − 1)`.
Report its sample median and an exact, conservative order-statistic confidence
interval for the population median. This is the binomial sign interval; it assumes
independent pairs with a common median and tolerates asymmetric distributions.
Ties are conservative. Actual discrete coverage is reported (96.14% for 12 pairs
requested at 95%). Temporal dependence or changing machine conditions can still
invalidate the interpretation. No bootstrap support or posterior is reported.

With the default practical margin of 2%:

- **FASTER:** the entire interval is below −2%.
- **SLOWER:** the entire interval is above +2%.
- **EQUIVALENT:** the entire interval lies within ±2%.
- **INCONCLUSIVE:** the experiment does not resolve those alternatives.

Only a fresh FASTER confirmation of the frozen screened candidate qualifies a
speedup beyond the declared practical margin. Every declared compile cell must
also have an upper bound no larger than the margin; uncertainty about harm does
not pass that guard. Check default
automatic construction (cell 61), and its larger budget (62) where relevant.
Correctness, code design and the declared adoption policy are separate gates.
The margin describes effect size, not a probability of benefit. An interval
entirely below zero can support a smaller improvement while remaining
INCONCLUSIVE at 2%. That default is not a universal adoption minimum: weigh
the interval, simpler design and resource changes under the stated policy.
Record an owner-led policy revision explicitly without relabeling the experiment.
For a memory/CPU tradeoff, predeclare the allowed regression and resource goal;
do not reinterpret an inconclusive speed result as equivalence. Never extend or
restart an unchanged experiment until it passes. There is no intermediate verdict.

CPU and wall clocks enclose `compileHandoff` with prepared inputs, excluding
loading, hashing and output. Resources use separate fresh processes per arm/cell:
WASM high-water capacity, post-compile heap/RSS, and lifetime process peak RSS.
Heap snapshots are not retained-live allocation counts; WASM capacity is not RSS.
When work shifts between registration and stepping, inspect both workload costs.
Full compile ns per charged frame includes search and observations, not just the
solver. Relative speed evidence alone cannot establish an absolute ns target.

Identical sources and binaries automatically form an A/A control. Add
`--slowdown-pct=5` for a positive control: actual measured extra CPU work after
each operation, recorded separately. Null controls require EQUIVALENT; slowdown
controls require SLOWER. Failed or inconclusive controls exit nonzero. Neither
can qualify a candidate or enter confirmation. These are checks of this experiment,
not proof that all future measurements are calibrated.

`npm run perf:engine -- --report=/path/to/result.json` reads saved v2/v3 evidence
without recomputing decisions or rewriting it. V2 used a different decision rule
and warmup policy; v1 also used different CPU timing boundaries. Historical
records in `docs/research/` retain their original meaning and are not current
machine baselines.

Method references: [NIST median confidence limits](https://www.itl.nist.gov/div898/software/dataplot/refman1/auxillar/mediancl.htm),
[Google Benchmark warmup](https://github.com/google/benchmark/blob/main/docs/user_guide.md),
[random interleaving](https://github.com/google/benchmark/blob/main/docs/random_interleaving.md),
[pyperf system guidance](https://pyperf.readthedocs.io/en/stable/system.html).
