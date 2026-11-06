# Run the compiler directly with Node

Adopt native TypeScript stripping on the existing pinned Node 22.22.2 runtime.
Fresh confirmation measures **7,172.5 ns per charged physics frame**, with a
**3.53% median paired improvement**. The <7,000 ns target remains open.

## Change and motivation

V8 CPU profiles showed transpiler-inserted function-name helpers in the compiler
path. The pinned Node runtime already supports erasing TypeScript directly.
Remove `--import tsx` from the CLI, workers and subprocess tests; replace the two
parameter-property constructors with explicit fields. Typechecking now enforces
`erasableSyntaxOnly` and `verbatimModuleSyntax`, preventing unsupported runtime
syntax or accidental value imports of types. Commands and active documentation
use the same direct execution path.

This removes a runtime transformation layer without changing the search or
physics solver. The WASM binary is identical in both arms. `tsx` is no longer a
direct dependency; the lockfile retains it as an optional development-tool peer.
No package version changed. Historical research commands remain as recorded.

## Qualification

This is an explicit **runtime-loader treatment**, not an isolated solver speedup.
The frozen reference is `61a41117`, with Node 22.22.2 and `--import tsx`; the
candidate uses the same Node binary without that loader. Both workers also use
`--expose-gc`. CPU 2, five warmups and three timed compiles per process, balanced
randomized AB/BA order, exact v3 median-change interval at requested 95% confidence.
Screening fixes 12 pairs and fresh confirmation fixes 24. The practical speed
margin is zero; the larger-workload guard allows at most +2%, and the separate
cold guard at most +5% with zero warmups and one compile per process.

The one-off study runner reuses the existing source overlay, worker clocks,
correctness checks, paired arithmetic and confirmation assertions. It records
flags by arm and admits only the exact audited lockfile metadata delta, with no
package-version differences. The production shared-input guard remains strict.
The compiler clock still encloses `compileHandoff` with prepared inputs; input
loading, track hashing, output and resource sampling remain outside it.

| Stage | Pairs | Paired median change | Interval | Arm medians, ns/frame | Verdict |
| --- | ---: | ---: | --- | ---: | --- |
| screen | 12 | -3.387% | [-3.896%, -2.733%] | 7,455.5 → 7,169.3 | FASTER |
| larger | 12 | -3.814% | [-4.487%, -3.571%] | 7,095.7 → 6,817.2 | FASTER |
| cold | 12 | -1.092% | [-1.724%, -0.442%] | 16,235.3 → 16,041.4 | EQUIVALENT |
| confirm | 24 | -3.530% | [-3.764%, -2.995%] | 7,441.5 → 7,172.5 | FASTER |
| native-null | 12 | +0.097% | [-0.530%, +1.112%] | 7,157.4 → 7,171.1 | EQUIVALENT |

The cold verdict uses its declared 5% margin; it passes the non-regression guard.
The native null uses identical source, WASM, Node and flags in both arms and its
2% tolerance. Neither guard nor control supplies a second opportunity to qualify
the speedup. Actual interval coverage is 96.14% for 12 pairs and 97.73% for 24.
Every warmup, timed compile and separate resource compile matched its saved track
and charged work: **994 exact compiles** across these five experiments.

Separate fresh-process resource observations meet the predeclared limits of
1.05× WASM capacity and 1.15× peak RSS in every stage. Default confirmation keeps
WASM at 16.5 MiB and observes peak RSS 356.7 → 296.1 MiB. The larger workload keeps
WASM at 33.5 MiB and observes peak RSS 554.7 → 420.1 MiB. These are individual
observations of process residency, not a confidence interval or live allocation
count.

`npm run check` passes: types, zero unreachable code, 449 JS tests, 31 Rust tests,
65 saved/live physics cases, all 63 compiler track/work cells and 33 judge tracks.
Complete checkpoints also match between loader paths for cells 61 and 62. A fresh
`npm ci` also passes all 65 saved physics cases and the five subprocess/ownership
test files, verifying the documented install and direct-Node CLI path.
The exploratory direct-loop diagnostic had lower absolute numbers; those were
not used to claim the target or replace the established worker workload.

## Evidence

- `engine-node-types-20261106-{screen,larger,cold,confirm,native-null}.json`:
  complete results, all warmups and timed samples, identities and resources.
- `engine-node-types-20261106-diagnostics.json`: prospective plans, scripts,
  frozen patch, modified study runner, exact-check logs and adoption decision.
- `generated/engine-node-types-20261106/`: large checkpoint artifacts, with
  hashes in the diagnostic record.
- `engine-exploration-20261106.md` and its JSON record: allocation profiling and
  rejected algorithm experiments that preceded this trial.

The underlying runtime feature is documented by
[Node](https://github.com/nodejs/node/blob/v22.22.2/doc/api/typescript.md), and the
static restrictions by [TypeScript](https://www.typescriptlang.org/tsconfig/erasableSyntaxOnly.html).
