# WASM engine workflow

Use this document as the current working prompt for engine-speed work. The older
`engine_speed_methodology.md` is background and statistics detail; this is the
concise operating procedure.

## Goal

Improve the standard Rust/WASM engine while keeping compiler behavior
byte-identical.

The standard engine is WASM. `LR_ENGINE=wasm` and an unset `LR_ENGINE` both select
the Rust/WASM path. `LR_ENGINE=js` and `LR_ENGINE=official` are parity references,
not routine development targets.

The metric is:

```bash
npm run perf
```

This reports `ns / physics-frame` for the current standard engine. Lower is
better. Use the paired A/B gate for decisions; do not trust a single perf run as a
keep/reject decision.

## Right to modify

Engine-speed work may modify only:

- `engine-rs/**`: the Rust/WASM engine, ABI implementation, engine data
  structures, kernel, grids, line handling, Cargo build settings, and Rust tests;
- `scripts/lib/_lr_engine_wasm.ts`: the JS wrapper for the WASM engine ABI;
- `scripts/lib/_lr_engine.ts` only when the change is strictly about selecting or
  routing to the standard WASM engine;
- engine-only benchmark/check helpers under `scripts/v0/bench/**`, only when the
  helper is used to inspect or validate the engine and does not change the
  accepted metric or correctness baseline;
- docs and the active engine optimization log.

Do not modify optimizer, scorer, or compiler policy code for this goal. In
particular, do not change `scripts/v0/optimizer/**`, `scripts/v0/core/**`,
`scripts/v0/score.ts`, specs, golden data, generated verifier baselines,
production tracks, or `vendor/lr-core` to improve this metric.

The JS wrapper boundary is allowed because it is part of the standard WASM engine
interface. General detector, optimizer, scorer, search-policy, and
compiler-driver hot paths are not allowed.

## Active log

Absolute `ns/physics-frame` standings are machine-specific. At the start of a
session, identify the active log for the current host. If none exists, create
`OPTIMIZATION_LOG.<hostname>.md` and record the verified baseline there. Use the
older top-level `OPTIMIZATION_LOG.md` only as background mechanism history when it
was measured on another machine; do not compare absolute standings across
machines.

## Do not move

Engine-speed work must not change compiler output. Do not change the scorer,
golden specs, evaluator fingerprint, weighted-average metric, budget grid,
disjoint seed policy, optimizer acceptance rule, or compiler-quality mechanisms to
make an engine result look better.

Do not rebaseline correctness artifacts during ordinary engine optimization. A
speed candidate that changes `verify` output is rejected. Rebaseline only when the
project intentionally accepts a compiler behavior change outside engine-speed work.

Do not run legacy vendored/official parity checks in the normal loop. The current
WASM engine is the standard, already established as bit-identical. Use JS/official
checks only after editing the parity scaffolding, editing `vendor/lr-core`, or
auditing the foundation.

## Correctness gates

Run the gates before speed measurement, and again before keeping a change.

Fast per-edit gate:

```bash
npm run verify
```

This runs the engine trace oracle and the 4-case optimizer output hash against
recorded baselines.

Wider confidence gate:

```bash
npm run verify:optimizer:wide
```

This runs 12 representative compiler-output hashes against the recorded
vendored-JS baseline, but the normal check itself runs only the standard WASM
engine. It should be cheap enough for serious candidates and before commits.

Rust-specific gates:

```bash
cargo test --manifest-path engine-rs/Cargo.toml
npm run build:wasm
```

For artifact A/B work, snapshot the candidate immediately after a source-triggered
WASM build. `npm run build:wasm` runs `wasm-opt` in place, so repeating it when
Cargo decides the Rust artifact is already fresh can rewrite already-optimized
bytes. Do not use that byte churn as evidence for or against an engine change;
restore the saved accepted artifact after rejected candidates.

Boundary or replay-sensitive changes:

```bash
npm run wasm:all
```

This rebuilds the WASM artifact and runs the kernel, stateful engine, trace,
numeric diff, forking/budget, compile-hash, replay, and low-level bench checks.

Occasional foundation audits only:

```bash
npm run wasm:compile
npm run wasm:compile -- --official
```

The first is a live vendored-JS vs WASM compile comparison. The second also checks
published official lr-core. They are not required in the daily engine loop.

## Speed decision

Use one mechanism at a time. First reason from the hot path, profiles, and
the active engine optimization log; avoid speculative cleanup that is not tied to
measured engine or WASM-wrapper cost.

If a current profile shows that the allowed engine/WASM-wrapper surface is too
small to plausibly close the remaining gap to the `npm run perf` target, record
that evidence in the active log and stop for a scope decision. Do not compensate
by editing optimizer, scorer, detector, or compiler-driver code.

For Rust/WASM artifact changes:

```bash
npx tsx scripts/v0/bench/perf_ab.ts --rounds=100
```

For WASM wrapper-boundary changes only:

```bash
npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100
```

Keep a candidate only if:

- correctness gates pass;
- paired A/B reports `P(candidate faster) >= 0.95`;
- median delta is faster;
- the change is a general engine or boundary mechanism, not a benchmark-specific
  shortcut.

Periodically confirm a stack of accepted small wins against an older baseline at
3-sigma:

```bash
npx tsx scripts/v0/bench/perf_ab.ts --rounds=100 --p=0.9987 --ref=<old-good-ref>
npx tsx scripts/v0/bench/perf_ab.ts --js --rounds=100 --p=0.9987 --ref=<old-good-ref>
```

## Accept/reject workflow

For each candidate:

1. State the mechanism and why it should reduce measured work.
2. Implement the smallest version that tests that mechanism.
3. Run the appropriate correctness gate.
4. Run paired A/B.
5. If rejected, revert the code and log the result in the active host log.
6. If accepted, log the result with correctness commands, A/B command, effect size,
   and current standing, then commit.

Rejected code does not stay in the tree. Accepted engine-speed code must be
byte-identical by the gates above.

## Suggested prompt

Improve the WASM engine.

Use only general Rust/WASM engine mechanisms and the WASM wrapper boundary. The
standard engine is Rust/WASM; do not optimize for the legacy vendored JS path.
Do not change optimizer internals, compiler/search policy, detector behavior,
compiler quality behavior, scorer inputs, golden specs, or baseline artifacts to
improve speed.

For every mechanism, reason from the current hot path and prior log first.
Implement one mechanism at a time. Verify byte identity with `npm run verify`; use
`npm run verify:optimizer:wide` and `npm run wasm:all` for serious or boundary
changes. Decide speed with paired `perf_ab`, using `--js` only for WASM-wrapper
changes. Keep only correctness-green candidates whose paired A/B accepts. Revert
and log rejected candidates. Commit accepted candidates with the log entry.
