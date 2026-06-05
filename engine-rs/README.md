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
| `npm run wasm:bench` | kernel speed vs the ~73k ns/frame optimized-JS baseline |

## The `LR_ENGINE` switch (`scripts/lib/_lr_engine.ts`)

| value | engine |
|---|---|
| (unset) | our optimized vendored `lr-core` (default) |
| `official` | the untouched published `lr-core` (parity reference) |
| `wasm` | this Rust→WASM engine |
| `record` | wraps vendored, logs the compile's op-DAG → `generated/trace/compile_ops.json` (for `wasm:replay`) |

## Current state

The verification scaffolding is current and proves `vendored ≡ official`. The
WASM engine is **not yet bit-identical**: the committed `.wasm` / `src/lib.rs`
predate the official-parity grid-snapshot fix, so its `addLine` invalidation must
be brought in line with the current JS before `wasm:compile`'s `wasm ≡ vendored`
leg goes green. Let the gate's hash — not the phase label — tell you when it's a
drop-in.
