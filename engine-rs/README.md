# engine-rs — Rust→WASM drop-in for the lr-core physics engine

Goal: a WASM engine that is a **bit-identical drop-in** for the physics engine —
swap it in for our optimized `vendor/lr-core` (or the published `official`
lr-core) and the compiler produces **exactly the same tracks and hashes**. The
cosmetic scarf is out of scope (our vendored engine doesn't simulate it, and the
compiler never reads it).

## Commands

Run from the repo root.

| command | what it does |
|---|---|
| `npm run build:wasm` | rebuild and Binaryen-optimize `lr_engine.wasm` after editing Rust (needs `wasm-opt`) |
| `npm run verify:engine` | compare compiler and independent reference engines on all 33 committed tracks: exact states and ordered collisions |
| `npm run build:native` | rebuild the separate compiler backend and update its packaged hashes; leaves this reference engine untouched |
| `npm run bench:engine -- --reference=before.wasm --candidate=after.wasm` | paired physics-only timings, with state/contact/cache-work checks before timing |
| `npm run perf:engine -- --reference=before.wasm --candidate=after.wasm --out=generated/engine-ab/screen` | isolated, fresh-process screening; follow with a frozen-candidate confirmation (see native backend README) |
| `npm run verify:engine:trace -- --fixture` | legacy fingerprint diagnostic; needs an explicitly recorded baseline |

Install the Rust target with `rustup target add wasm32-unknown-unknown`.
`build:wasm` additionally needs Binaryen's `wasm-opt`; a plain reference build
is `cargo build --release --target wasm32-unknown-unknown --manifest-path engine-rs/Cargo.toml`.
`build:native` uses plain Cargo release output in its own target directory.

The earlier `wasm:*` commands live at tag `archive/pre-rework-2026-10-03`.
The current engine gate requires no untracked trace files. The separate cache
regression test compares edits, sibling reads, start resets and detached prefixes
against published `lr-core`. Full structural gates remain `npm run parity`,
`npm run parity:judge`, tests, typecheck and reachability.

## The `LR_ENGINE` switch (`scripts/lib/_lr_engine.ts`)

This switch selects consumers of the legacy interop shim. The current compiler
imports `scripts/lib/native_motion/engine.ts` directly, so changing `LR_ENGINE`
does **not** switch its simulation backend. For compiler-engine A/B measurements,
use `perf:engine --mode=compile` with both binary paths. Its private snapshot
uses the same source for both arms and swaps only the compiler WASM. The
[native backend README](../scripts/lib/native_motion/README.md) documents the
fixed screening/confirmation protocol and probability interpretation.
For engine workload diagnostics, pass both binary paths to `bench:engine`.

| value | engine |
|---|---|
| (unset) | this Rust→WASM engine (default) |
| `js` | our optimized vendored `lr-core` |
| `official` | the untouched published `lr-core` (parity reference) |
| `wasm` | this Rust→WASM engine |
| `record` | wraps vendored, logs the compile's op-DAG → `generated/trace/compile_ops.json` (for `wasm:replay`) |

## Architecture (`src/`)

A clean-room reimplementation organized 1:1 with lr-core so each module audits
against one JS source file:

| module | mirrors | notes |
|---|---|---|
| `grid.rs` | hashNumberPair.js + getCellsFromLine.js + ClassicGrid geom | hash, classicCells, 3×3 cellsNearEntity |
| `line.rs` | Line/SolidLine/AccLine.js + cellLinesMap | geometry, `collidesWith`, grid registration |
| `kernel.rs` | states + constraints + SolidLine.collide | the per-frame solver (ported verbatim — proven) |
| `frame.rs` | Frame.js | collision-history grid + collisions map + invalidation scan |
| `engine.rs` | LineEngine.js + Immo | **one shared mutable cache per lineage**, version-patch tree, `updateComputed` walk |
| `abi.rs` | the WASM export surface | frozen contract + `sim()` regression harness |

The load-bearing insight: lr-core keeps ONE `__computed__` frame cache per lineage,
reconciled lazily on every read (`updateComputed` diffs the version's line-list and
replays `_addLine`/`_removeLine`, truncating the shared cache). This makes the
physics-frame budget path-dependent on the search's read order; `engine.rs` models
it as a version tree whose `compareTo` is a walk of the patch chain.

## Historical port results

The original port qualified as a bit-identical drop-in using `wasm:check`,
`wasm:engine`, `trace`/`trace:diff` (max err 0), `wasm:diff`, `wasm:budget`,
`wasm:replay` (0 mismatches on the real op-DAG), and `wasm:compile` (`wasm ≡
vendored` track-hash on all 4 specs). `vendored ≡ official` still holds (run
`wasm:compile -- --official` to re-confirm), so `wasm ≡ official` transitively.

Historical performance (not a baseline for a new machine): the kernel alone was ~5× the JS engine (`wasm:bench`), and end-to-end
(`LR_ENGINE=wasm npm run perf`) is now much faster than the JS engine
(roughly 13.1k ns/physics-frame on the current W9 stack). The biggest boundary win is a
fused raw-frame ABI for the detector hot path: Rust computes the BODY average,
binding states, and collision records in one cache read, and the wrapper returns
the detector's `RawFrame` shape directly instead of crossing wasm twice and
building lr-core-style rider/update objects for every extracted frame. The wrapper
also reuses the static scratch view across calls and memoizes the cold stateMap
fallback inside `getRider`.
