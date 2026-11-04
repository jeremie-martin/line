# Fixed calibration of engine timing protocol v3

Predeclared November 4, 2026, before any v3 timing controls. This is tooling and
ownership foundation work, not a new optimization or an absolute speed claim.
The earlier failed eight-pair v2 A/A record remains unchanged.

Two exploratory warmup pilots on unchanged cell 61 used 8 and 16 compiles in one
process each. Cold wall time was 2.33–2.36 s, the second compile 1.30–1.32 s,
and later compiles about 1.05–1.15 s. All charged 147,209 physics frames. These
pilots motivate an explicit warmed workload; they do not prove stationarity.

The calibration consists of exactly three complete experiments, in this order:

| Experiment | Code/WASM | Extra candidate CPU work | Order seed |
| --- | --- | --- | --- |
| null-1 | identical | none | 1729 |
| null-2 | identical | none | 1730 |
| slowdown-5 | identical | 5% of each operation's measured CPU time | 1731 |

For every experiment: compile cell 61, 12 fresh process pairs, five warmup compiles
and three measured compiles per process, CPU 2 affinity, Node 22.22.2, 95% requested
confidence, 2% practical margin. Replicates are aggregated within a process. No
other builds, tests, parity or performance trials run concurrently. Inputs and
sources are frozen before each experiment, and identities must match across all
three. Additional CPU work is actually executed and recorded separately; it is
not added to saved numbers after measurement. Resource observations remain clean.

The two null controls must each resolve EQUIVALENT within ±2%. The positive
control must resolve SLOWER beyond +2%. Any failure or uncertainty is retained;
there is no extension, reseeding or repeat-until-pass. These three controls assess
this workload's resolution and gross mistakes, not a calibrated false-positive
rate across machines or future experiments. Exact interval coverage is tested
separately by enumerating all sign patterns for several sample sizes.

## Completed results

All three predeclared experiments completed once and exited zero. No run was
extended or repeated. The exact interval's discrete coverage is 96.1426% for
12 pairs at the requested 95% confidence.

| Experiment | Median paired change | Interval | Verdict |
| --- | ---: | --- | --- |
| [null-1](compiler-foundations-20261104-null-1.json) | −0.0037% | [−0.1314%, +0.5651%] | EQUIVALENT |
| [null-2](compiler-foundations-20261104-null-2.json) | −0.5882% | [−0.9942%, +0.5525%] | EQUIVALENT |
| [slowdown-5](compiler-foundations-20261104-slowdown-5.json) | +5.0937% | [+4.6246%, +5.4063%] | SLOWER |

All 576 warmup/measured compiles and the six separate resource compiles preserve
cell 61's exact track and 147,209 charged physics frames. Control cost was checked
against each iteration's measured CPU work; resource observations contain no
injected cost. All six resource observations report 18,153,472 bytes (17.3125 MiB)
of WASM linear-memory capacity. This is a control, not a memory improvement.
Every record has `performanceQualified: false`, as required for controls.

The frozen source hash is
`5e4f33f58923672d9b31a78e42c164efb20e7d444dabee176644b7eb6ef7490f` in both arms
of all three experiments. WASM is unchanged:
`b0fc5d3bd8da5e7c136607de11e347ce8823c88909da075b4f2cbe1471b7481c`.
Host: Intel i7-12800H, Linux 7.0.0-38-generic, Node 22.22.2,
V8 12.4.254.21-node.39, CPU affinity 2. Raw records are copied without editing.
After freezing calibration, the only executable source change was the research
CLI `tools/research/catch_price.ts`: require a fresh study directory, record the
new preparation policy, and reject invalid worker counts. A source-tree comparison
verified that the compiler, physics and measurement code remained identical.

The [two exploratory warmup pilots](compiler-foundations-20261104-warmup.json)
are retained separately. Calibration profiles also show continuing iteration
structure: in null-1 the reference medians were 2391 ms for the first compile,
1329 ms for the second, and 1124/1152/1081 ms for the three measured compiles.
This is a reproducible **fixed warmed workload**, not demonstrated steady state.
It must not be compared with the previous one-warmup ns/frame as an engine gain.

These controls support resolving a 5% slowdown and ±2% equivalence on cell 61
under this protocol. They do not establish a universal false-positive rate,
sub-percent precision, or qualification of other compiler workloads. The earlier
[failed v2 A/A control](compiler-foundations-20261104-aa.json) remains unchanged.

## Other foundation checks

- The initial live engine gate took 2.84 s for 33 tracks. A standard Node CPU
  profile attributed about 0.75 s of samples to deep comparison and 0.23 s to GC;
  wrapper allocation also occupied a substantial share. The new saved-reference
  check took 0.61 s in its standalone run, covering 65 cases, 68,827 frame states
  and 432,018 ordered collisions. These are individual diagnostic timings, not
  a paired speedup qualification. The saved reference is 53,298 bytes.
- The live comparison now covers those same 65 cases, including raw-frame,
  motion and cached-contact observations. Generated lifecycle tests retain cold
  independent JS replays; compiler parity verifies work accounting separately.
- `npm run check` passed: 412 JS tests at that checkpoint, 29 Rust tests, zero
  type/reach errors, all 63 exact compiler track/work cells (255 s), and all 33
  judge tracks. Later timing-option and research-CLI additions passed their
  17 focused tests plus fresh type/reach checks, bringing the suite to 418 tests.
- Counterfactual success/failure tests preserve the compiled track and complete
  compiler statistics. The study owns its memories, memo values and rebuilt
  engines; no private mutable arrays are saved and restored manually.
- Saved v3 reporting passes; the old failed v2 control still exits nonzero.
  Attempting to confirm an A/A control fails before timing starts.

The current operational workflow is [engine-validation.md](../engine-validation.md).
No physics equation, compiler search policy, quality measure, budget or existing
compiler/judge parity reference changed in this pass.
