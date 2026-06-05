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
| **`npm run wasm:all`** | **Start here.** Builds the `.wasm`, then runs every check and prints a summary. Exits nonzero only on a regression (WASM diverging from JS); not-yet-implemented gates are reported, not failures. |
| **`npm run wasm:compile`** | The swap-in acceptance gate (fast inner loop): compiles 4 cases under **wasm** and **vendored** and asserts identical `{track, stats}` hash. This is the red→green target while building the WASM engine. |
| `npm run wasm:compile -- --official` | Also re-checks **vendored ≡ official** (the slow published engine). That leg is a stable fact, so it's opt-in — run it after editing `vendor/lr-core`, not every time. Since `vendored ≡ official` is transitive, `wasm ≡ vendored ⇒ wasm ≡ official`. |
| `npm run build:wasm` | Rebuild `lr_engine.wasm` after editing `src/lib.rs`. |
| **`LR_ENGINE=wasm npm run perf`** | Speed of the WASM engine, end-to-end. `perf` is engine-aware, so this reports the same `ns/physics-frame` (hyperfine-style mean ± σ / median / range) as plain `npm run perf` — run both and compare directly. No separate baseline to maintain. |

Individual checks (all also run by `wasm:all`):

| command | checks |
|---|---|
| `npm run wasm:check` | kernel vs recorded JS dumps (5 fixtures) — f64/sqrt bit-identity |
| `npm run wasm:engine` | stateful lazy engine vs dumps |
| `LR_ENGINE=wasm npm run trace` | per-frame oracle (state + contacts) via WASM |
| `LR_ENGINE=wasm npm run trace:diff` | numeric microscope (max err 0) via WASM |
| `npm run wasm:budget` | mid-stream `addLine` budget/invalidation parity |
| `npm run wasm:diff` | differential (forking + op-space) |
| `npm run wasm:replay` | replays a real recorded compile op-DAG through both engines |
| `npm run wasm:bench` | low-level kernel-only throughput (forward sim of a fixture, no compile). For the end-to-end speed that matters, use `LR_ENGINE=wasm npm run perf` above. |

## The `LR_ENGINE` switch (`scripts/lib/_lr_engine.ts`)

| value | engine |
|---|---|
| (unset) | our optimized vendored `lr-core` (default) |
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

## Current state

**The WASM engine is a bit-identical drop-in.** All gates green: `wasm:check`,
`wasm:engine`, `trace`/`trace:diff` (max err 0), `wasm:diff`, `wasm:budget`,
`wasm:replay` (0 mismatches on the real op-DAG), and `wasm:compile` (`wasm ≡
vendored` track-hash on all 4 specs). `vendored ≡ official` still holds (run
`wasm:compile -- --official` to re-confirm), so `wasm ≡ official` transitively.

Performance: the kernel alone is ~5× the JS engine (`wasm:bench`), but end-to-end
(`LR_ENGINE=wasm npm run perf`) is currently ~20% **slower** than the JS engine —
the JS↔WASM per-read boundary (rebuilding the stateMap/entity objects from the
scratch buffer on every `getRider`/`getStateMapAtFrame`) dominates. Bit-identity is
done; closing that boundary is the next optimization.
