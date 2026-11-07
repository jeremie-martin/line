# Engine and compiler validation

Use Node 26 and the pinned Rust. `perf:engine` compares commits with the same tracks,
so a commit before the latest change of parity references cannot serve as its reference.
The engine kernel, compiler
search and judge are different contracts; passing one does not imply the others.

| Command | Purpose |
| --- | --- |
| `npm run check:physics` | Fast exact saved-reference states and ordered collisions; no local judge, compiler or audio inputs |
| `npm test` | Unit, ownership, failure, cache and generated-operation tests |
| `npm run verify:engine` | Live independent physics and wrapper/derived-observation comparison |
| `npm run parity` | All 25 compiler tracks **and charged physics work**, exact |
| `npm run parity:judge` | Independent judge results on the committed tracks |
| `npm run check:smoke` | The real tools end to end: a small `perf:engine` comparison, a production compile, and the review pages in Chromium |
| `npm run check` | Complete structural gate, one line per step; logs in `generated/check/` |
| `npm run bench:engine` | Registration, stepping and branch workload diagnostics |
| `npm run perf:engine` | Is a change faster? Paired real compiles, one line per run |
| `npm run perf:score` | The speed score: ns per charged frame on real compiles, one at a time, on the cores it is given |
| `npm run perf:profile` | Where a real compile spends time or allocates: native, JS and GC, by file and by function |

After editing packaged native Rust or TypeScript, run `npm run build:native`
before checking. The manifest test rejects stale packages. `npm run build:wasm`
builds the separate local judge needed by live comparison, judge tests and the
full gate. A native optimization does not require rebuilding that judge.

## Correctness layers

Both physics checks cover the 33 rides in `tools/parity/physics-tracks` and 32 seeded stress cases with
normal, acceleration and scenery lines, extensions, reversed/flipped geometry,
zero-length lines, grid boundaries and different starting velocities. Saved
fingerprints cover every binary64 state value and ordered collision triple,
including the collision iteration. They localize failures to 256-frame blocks;
the live check compares individual frames and derived public observations.
Both adapters' cached contact readers are checked against the judge's full
ordered event stream, including contact presence and first-occurrence ID order.
These observation reads must not extend the simulated trajectory.

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

## Timing

**Measure what production runs.** A real compile spends the standard allowance (about
2.8 M charged frames, 15 s) in one fresh process. Small budgets measure something else:
at 150 k frames, fixed per-compile costs dominate, and a 4.4% gain there was 0.6% at
750 k. `PERF_CELLS` are two songs at the standard allowance.

```sh
taskset -c 4-7 npm run perf:engine -- --against=HEAD --name=my-idea
npm run perf:engine                       # the latest runs, one line each
npm run perf:engine -- --report=a,b       # these runs
```

It ends with one line per run, and one per song when there are several:

```
my-idea  FASTER  -2.9% [-4.3, -1.2]  8 faster, 0 slower  5460 -> 5301 ns  memory +0 MB
```

`--candidate=<ref>` measures a commit instead of the checkout, and `--reference=<wasm>`
swaps only the engine. Each arm is a frozen copy of its source, run with the same Node,
`node_modules`, measuring runner and judge. Measurement inputs (parity cells, fixtures,
productions, vendored engines) must be identical, and every compile must reproduce its
committed track and charged work. Only `result.json` stays, with every sample.

**Reading it.** Each round compiles every cell once per arm, in balanced AB or BA order.
For each round the change is `100 × (candidate/base − 1)`; the run reports its median and
an exact order-statistic interval at 95% (the sign test's binomial interval: independent
pairs, no assumption about the shape of the distribution). With the default margin of
0.5%, FASTER means the interval lies entirely below −0.5%, SLOWER entirely above +0.5%,
EQUIVALENT within ±0.5%, and unclear otherwise. Eight rounds, the default, are the fewest
with a 95% interval; on this laptop they resolve about 2% and take about 8 minutes.

**Habits that keep it honest.** Run on a quiet machine, never alongside builds, tests or
other timings. Give it two performance cores: V8 collects garbage and compiles on
background threads, and pinning to one CPU makes a real compile about 8% slower. On this
laptop, `taskset -c 4-7` keeps an identical-arms run within ±2% per pair, typically under
1%. Decide the rounds before starting and read the run when it ends; do not stop a run
because it looks good, or rerun an unchanged one until it does. A result that matters
deserves a second, fresh run. An unclear interval entirely below zero can still support a
small gain: weigh it with the design, not as a verdict.

CPU and wall clocks enclose `compileHandoff` with prepared inputs, excluding loading,
hashing and output. Memory is each compile's peak process RSS. Full ns per charged frame
includes search and observations, not only the solver. Records in `docs/research/` keep
their original protocols and are not current baselines.
