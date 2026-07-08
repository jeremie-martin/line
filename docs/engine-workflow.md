# WASM engine workflow

Use this document as the current working prompt for engine-speed work. The older
`engine_speed_methodology.md` is background and statistics detail; this is the
concise operating procedure.

## Goal

Improve the standard Rust/WASM engine and its hot JS boundary/driver code while
keeping compiler behavior byte-identical.

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
`OPTIMIZATION_LOG.md`; avoid speculative cleanup that is not tied to measured
cost.

For Rust/WASM artifact changes:

```bash
npx tsx scripts/v0/bench/perf_ab.ts --rounds=100
```

For JS wrapper, detector, or compiler-driver hot-path changes:

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
5. If rejected, revert the code and log the result in `OPTIMIZATION_LOG.md`.
6. If accepted, log the result with correctness commands, A/B command, effect size,
   and current standing, then commit.

Rejected code does not stay in the tree. Accepted engine-speed code must be
byte-identical by the gates above.

## Suggested prompt

Improve the WASM engine.

Use only general engine, WASM boundary, detector-transport, or compiler-driver
hot-path mechanisms. The standard engine is Rust/WASM; do not optimize for the
legacy vendored JS path. Do not change compiler quality behavior, scorer inputs,
golden specs, or baseline artifacts to improve speed.

For every mechanism, reason from the current hot path and prior log first.
Implement one mechanism at a time. Verify byte identity with `npm run verify`; use
`npm run verify:optimizer:wide` and `npm run wasm:all` for serious or boundary
changes. Decide speed with paired `perf_ab`, using `--js` only for JS hot-path
changes. Keep only correctness-green candidates whose paired A/B accepts. Revert
and log rejected candidates. Commit accepted candidates with the log entry.
