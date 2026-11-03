# Compiler physics backend

The compiler imports `engine.ts` directly. It preserves the reference engine's
state arithmetic, ordered collisions and path-dependent frame budget while
supporting prefix sharing, rollback and compiler observations. The independent
judge remains in `engine-rs`, with its own adapter and replay instance.

## Ownership and boundaries

| module | owns |
|---|---|
| `engine.ts` | JavaScript handle lifetimes, synchronous scopes and consumer-facing reads |
| `wasm.ts` | the typed private ABI and borrowed memory views |
| `src/engine.rs` | version ancestry, lineage reconciliation and requested observations |
| `src/cache.rs` | geometry, computed frames, event storage and compact read summaries |
| `src/history.rs` | lazy collision indexes, snapshots and rollback boundaries |
| `src/kernel.rs` | stepping, collision queries and recording into an explicit trace |
| `src/line.rs`, `src/grid.rs` | immutable line geometry, cell traversal and lookup tables |
| `src/abi.rs` | input/output marshalling; it owns no engine state |

A version belongs to one lineage. Reads reconcile its shared frame cache before
observing or extending it. Live descendants and the current cache retain the
ancestry they need; unused branches are reclaimed, with handle slots reserved
until lineage death. Detached lineages share a cache snapshot until a write.
Cached reads do not copy it; releasing the source transfers ownership directly.
Body motion is a pure, lazy per-frame observation stored in a `OnceCell`. Shared
snapshots may fill that memo without copying simulation data. Copies preserve
valid observations; rollback and reset discard them with their frames.

One checked arena borrow encloses each native operation. Frame-cache storage is
private: geometry edits, resets and truncation maintain its derived indexes.
History length comes from its boundaries. Grid edits invalidate borrowed line
queries; rollback/reset invalidate history shortcuts before releasing nodes.
Copies start with empty shortcuts; ownership transfers preserve their owner.

Each wrapper uniquely owns its native handle. Empty line batches return the
existing wrapper. `dispose()` is idempotent; every later read through that
wrapper fails explicitly, even after the native slot has been reused.
`retainOnly()` prunes live engines, and `disposeEngines()` releases the current
scope's engines. `withEngineScope()` is synchronous, protects caller-owned engines
through nested success/failure, and releases its local engines on exit. Return
plain data from a scope; an escaped local wrapper is already disposed.

Traces belong to the requesting version, including when sibling versions are
interleaved. Preparing a trace evicts the requested frame; a pending trace also
exposes that eviction before a metered read if another sibling filled the cache.
Only the explicit replay records it. Lazy history reconstruction never records
observations. Cached contact/body observations cannot advance physics.
Each observation checks and reads in one native operation. Contact-presence reads
do not copy events. Raw-frame reads reuse cached contact ids and first-contact
point order, rather than re-deriving them from collisions in JavaScript.

## ABI and output lifetime

The compiler ABI is private and ships with `wasm.ts`; it is not the frozen judge
ABI. Line insertion has one chunked batch path. The retired batch simulator,
its input buffer and the unused single-line export are absent.

State/trace buffers have topology-defined sizes. Variable event and window
outputs grow as needed and retain their initialized high-water storage. Returned
counts define the logical prefix: output is never silently capped. Candidate
contacts have their own buffer, separate from ordinary event reads.

Views borrow WASM memory until the next engine call. The adapter refreshes them
when memory grows or a vector moves, even inside the same memory buffer. Copy
before retaining a window across calls. `getCachedContactPositions()` and
`readCollisionTrace()` already return owned observations. Transport buffers still
require synchronous access; this is not a concurrent native C API.

The neighborhood cache builds ordered 3×3 queries on demand and retains a
filtered list per point. Velocity is fixed across the six sweeps; filters refresh
at a frame boundary or cell change. Original cell order, descending line ids,
duplicates and direction-predicate NaN behavior are preserved. A sweep retains
its original list when a collision moves a point. These specializations remain
because they improve measured performance while preserving parity.

## Build and verify

`npm run build:native` uses locked Cargo release output for
`wasm32-unknown-unknown` in `generated/native-motion-target`. It packages the WASM
and discovers all Rust/TypeScript sources and Cargo inputs for the manifest.
The original accepted-source provenance remains recorded separately. A test
checks manifest completeness and hashes. The judge build is untouched.

Structural backend changes require `npm run verify:engine`, `npm run parity`
(exact tracks and charged work), `npm run parity:judge`, `npm test`,
`npm run typecheck`, `npm run reach`, and the native Rust tests:

```sh
cargo test --locked --manifest-path scripts/lib/native_motion/Cargo.toml
```

## Measure on the current machine

Save both release binaries before measuring. `bench:engine` is a fixed-workload
diagnostic; `perf:engine` uses fresh warmed processes, alternating order, a fixed
sample count and a frozen candidate. It checks states, ordered events, cached
contacts and work counts. Compile mode checks exact committed tracks and work
on every warmup and timed compile. Use a quiet machine; on the November 3 hybrid
CPU, pin to CPU 2. Never overlap timings with builds or correctness checks.

```sh
taskset -c 2 npm run perf:engine -- --reference=/tmp/before.wasm --candidate=/tmp/after.wasm --rounds=12 --confirm-rounds=24 --out=generated/engine-ab/screen
taskset -c 2 npm run perf:engine -- --reference=/tmp/before.wasm --candidate=/tmp/after.wasm --stage=confirm --rounds=24 --screen=generated/engine-ab/screen/result.json --out=generated/engine-ab/confirm
```

By default, both arms use the current source and differ only in WASM. For wrapper
or consumer changes, add `--reference-root=/path/to/earlier-checkout` to both
commands. Both frozen source versions run in the same disposable cwd, switching
changed files outside timing. The runner and independent judge binary are fixed;
differing fixtures, dependencies or judge source are rejected. Results record
both source hashes. An A/A control requires identical source and binary hashes.

Add `--mode=compile --cells=61` for standalone default automatic construction.
Check it separately before adopting engine changes; an aggregate win cannot hide
a default-path regression. Cell 62 checks its larger budget. If costs shift
between registration and simulation, also report isolated stepping. For storage
changes, report WASM linear-memory high-water size separately from live memory
or process RSS.

Declare the protocol before timing. KEEP requires favorable paired-bootstrap
support, a negative median and the exact sign safeguard. Only a fresh KEEP
confirmation with identical frozen identities and protocol qualifies a speedup.
Predeclared cleanup regression guards can instead establish an adoption decision
without claiming a speedup. Never extend or restart an unchanged run until it
passes. Bootstrap support is neither a posterior nor an anytime-valid rule.
Historical studies and discarded experiments are in `REWORK.md` and
`docs/research/`; their timings are not a new machine's baseline.
