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
| `src/shared_prefix.rs` | visible append-only prefixes and shared immutable chunks |
| `src/history.rs` | lazy collision indexes, snapshots and rollback boundaries |
| `src/kernel.rs` | stepping, collision queries and recording into an explicit trace |
| `src/line.rs`, `src/grid.rs` | immutable line geometry, cell traversal and lookup tables |
| `src/abi.rs` | input/output marshalling; it owns no engine state |

The ordered solver calls are the single definition of iterating constraint
endpoints and binding endurance. Rest lengths derive from those fixed endpoints
and fold into constants in the packaged code; no runtime topology table or
per-engine rest arrays are needed.

Each registration batch owns contiguous immutable geometry and raster footprints.
Line references retain the batch and an index; version patches, grid buckets and
the line-id index share that ownership. Removing one line may retain its storage
while another member of its batch remains live. Cache copies and reconciliation
reuse these records without recomputing geometry or cell traversal.

A version belongs to one lineage. Reads reconcile its shared frame cache before
observing or extending it. Live descendants and the current cache retain the
ancestry they need; unused branches are reclaimed, with handle slots reserved
until lineage death. Detached lineages share a cache snapshot until a write.
Cached reads do not copy it; releasing the source transfers ownership directly.
Body motion is computed from a frame's saved state when an observer asks for it.
Saved states and collision-history snapshots share immutable 64-entry chunks
across cache copies through the same append-only prefix store. Truncation changes the
visible prefix; appending copies only a shared partial tail. Up to 63 hidden tail
entries per store can remain allocated until that chunk is replaced or released. The mutable
solver state is separate, and indexing cannot expose truncated states.

Registration queries one earliest invalidation over the whole batch, then
truncates once. Consecutive raster cells reuse borrowed history lists only for
that query. A history frame lazily caches component bounds to exclude impossible
collisions; survivors use the original predicate and operation order. Nonfinite
inputs fall back to the snapshot scan. Appending clears the affected bound.

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
Impact observation consumes packed cached whole-body motion/contact windows in one
native call, then computes strike frames directly without temporary motion objects.
The window validates the entire range before reading and cannot step physics.
Raw trajectory extraction also reads already simulated windows in one native
call, returning owned ordinary frame objects. It preserves contact order and both
work counters. The unused computing candidate-window API has been removed.
Prefix validation compares a rider state directly with its saved ballistic state,
without allocating point objects or serializing JSON. Signed zero and nonfinite
values keep their previous comparison semantics.

## ABI and output lifetime

The compiler ABI is private and ships with `wasm.ts`; it is not the frozen judge
ABI. Individual lines and connected solid paths use one chunked batch writer.
The compiler can register paths before materializing its reporting records;
only candidates that survive prefix and binding checks need those records.
The retired batch simulator,
its input buffer and the unused single-line export are absent.

State/trace buffers have topology-defined sizes. Variable event and window
outputs grow as needed and retain their initialized high-water storage. Returned
counts define the logical prefix: output is never silently capped. Raw-frame
contacts have their own buffer, separate from ordinary event reads.

Private adapter views borrow WASM memory until the next engine call. The adapter
refreshes them when memory grows or a vector moves, even inside the same memory
buffer. Public `readCachedMotionWindow()` passes a read-only view to a synchronous
callback and blocks engine calls until it returns, including calls on other
engines. Return owned results; TypeScript cannot prevent deliberate capture of a
borrowed reference. `getCachedContactPositions()` and
`readCollisionTrace()` already return owned observations. Transport buffers still
require synchronous access; this is not a concurrent native C API.

The neighborhood cache builds ordered 3×3 queries on demand and retains a
filtered list per point. Velocity is fixed across the six sweeps; filters refresh
at a frame boundary or cell change. Original cell order, descending line ids,
duplicates and direction-predicate NaN behavior are preserved. A sweep retains
its original list when a collision moves a point. Of that list, a point tests only
the lines it can reach from within two pixels of where its near lines were chosen,
and the full rest of the list after a hit. These specializations remain because
they improve measured performance while preserving parity. Only physical points need per-point query storage; binding-status entities do not.

## Build and verify

`npm run build:native` uses locked Cargo release output for
`wasm32-unknown-unknown` in `generated/native-motion-target`. It packages the WASM
and discovers all Rust/TypeScript sources and Cargo inputs for the manifest.
The original accepted-source provenance remains recorded separately. A test
checks manifest completeness and hashes. The judge build is untouched.
Rust 1.95.0 is pinned at the repository root; the manifest records the actual
rustc/Cargo versions, target, profile, pin hash and environment overrides. Node
22.22.2 is the qualified consumer runtime. Requalify changes to either toolchain.

`npm run check:physics` gives quick feedback against the saved independent oracle.
`npm run verify:engine` checks live reference physics and derived public observations.
`npm run check` runs the full structural gate, including compiler track/work parity,
judge parity, JS/Rust tests, types and reachability. It does not rebuild the backend.

See [the validation workflow](../../../docs/engine-validation.md) for corpus and
reference maintenance, scoped research probes, paired timing protocol v3, resource
interpretation and examples. Current operation belongs there; historical timing
and optimization decisions remain in `REWORK.md` and `docs/research/`.
