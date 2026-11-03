# Compiler simulation backend

This isolated copy of the accepted Rust physics engine provides the compiler
with shared prefix caches, metered collision observation, and cached resolved
collision positions. Reading cached contacts does not step or replay physics.
Live descendants and the current cache retain the ancestry they need; released
branch payloads are reclaimed once neither needs them. These facilities do not
change the stepping equations or permit supplying a rider state.

Detached lineages share an immutable cache snapshot until either needs to
mutate it. Cached reads leave that snapshot shared. A first write copies the
cache if another lineage still owns it; releasing the source first transfers
the storage without copying. Grid edits, start resets, frame extension and
trace eviction remain local to their lineage, including physical-frame charges.

Version slots, lineage holders, free lists and reconciliation scratch have one
`EngineArena` owner. Stateful operations enter through a scoped `RefCell` borrow;
internal methods use ordinary references and cannot leak arena references across
calls. Nested arena entry is rejected. There are no mutable statics or unsafe
blocks in `engine.rs`. This is not a concurrent ABI: exchange buffers and kernel
trace state remain module-global and require synchronous access.

`CollisionHistory` owns collision indexes, snapshots, active-cell shortcuts and
per-frame rollback boundaries. The boundary length defines the tracked prefix,
removing the separate history-length counter. Its three private boundary arrays
advance, reset and truncate together. Cloning starts with empty borrowed
shortcuts; reset and rollback invalidate shortcuts before releasing nodes.
The kernel receives this owner instead of six separate mutable history objects.

The benchmark engine remains in `engine-rs`. Every completed compiler output is
cold-replayed with that engine and must match the full raw trajectory exactly.
The independent judge is unchanged. Native callers retain ownership of their
engines across compilation: pruning and cleanup occur inside a synchronous
`withEngineScope`, including independent continuation-label collection.

`manifest.json` keeps the original accepted-source provenance and the current
packaged source/WASM hashes. A test checks every packaged hash. Source and WASM
bytes also enter the compiler identity independently of this manifest.

Rebuild with `npm run build:native` (requires the Rust
`wasm32-unknown-unknown` target). It builds into `generated/native-motion-target`,
packages `engine.wasm`, and updates the generated source/WASM and manifest
hashes. It does not overwrite the independent judge build in `engine-rs`.

The collision grid registers lines only in their original raster cells. A shared
query cache flattens the 3×3 neighborhood when it is read. Each point filters
that list with the original normal-dot-velocity > 0 predicate at its first
sweep in a frame and whenever it changes cell. Velocity stays fixed through
all six sweeps, so later sweeps reuse the filtered list. Filtering preserves the
predicate's NaN behavior; the remaining collision arithmetic is unchanged.
Lists preserve cell order, descending line ids within cells and duplicates
across cells. Buffers reserve the full input query length before filtering and
retain capacity; this avoids repeated growth and the increased WASM memory
high-water size seen with individual pushes in the unreserved prototype.
Filtering now compacts directly into that reserved space, removing per-entry
vector growth checks and direction-dependent branches. Only the initialized,
accepted prefix becomes visible; order and duplicates remain unchanged.

Grid insertion/removal invalidates both query levels, including cached misses.
The grid owns the immutable lines; cached pointers are borrowed. A collision
keeps its original query while moving the point, and the next sweep refreshes
the point's list. Every step refreshes filtered point lists, including history
replays that reuse a frame index; the shared queries persist until grid edits.
Copying a shared cache starts with empty borrowed queries; ownership transfer
keeps the owning grid and its valid queries together. Solver arithmetic,
collision order and physical-frame accounting are unchanged.

For a performance change, build both binaries with the same Rust toolchain and
save them before measuring. `npm run perf:engine` adapts the archived
`scripts/v0/bench/perf_ab.ts` workflow to the current compiler. It snapshots the
source and fixtures in a disposable directory, switches only that directory's
WASM, and alternates fresh, warmed Node processes. The live package is untouched.
Use a quiet machine; on the November 3 hybrid CPU, pin to CPU 2:

```sh
taskset -c 2 npm run perf:engine -- --reference=/tmp/before.wasm --candidate=/tmp/after.wasm --rounds=12 --confirm-rounds=24 --out=generated/engine-ab/screen
taskset -c 2 npm run perf:engine -- --reference=/tmp/before.wasm --candidate=/tmp/after.wasm --stage=confirm --rounds=24 --screen=generated/engine-ab/screen/result.json --out=generated/engine-ab/confirm
```

The engine panel includes registration, replay and sibling edits/rollback over
all committed tracks. It verifies raw states, ordered events, cached contact
positions and cache-work counts before timing. Its primary measurement is total
panel wall time per simulated frame, including registration cost. The lighter
`npm run bench:engine -- --reference=/tmp/before.wasm --candidate=/tmp/after.wasm`
remains useful for per-workload diagnosis, but has no promotion decision.
When a change shifts cost between registration and stepping, measure and report
those phases separately too. The November 3 lazy-query study improves compiler
and combined engine workloads but increases isolated post-registration stepping
time; see `docs/research/engine-lazy-neighborhoods-20261103.json` and `REWORK.md`.
The subsequent direction-filter study recovers part of that stepping cost with
unchanged measured memory high-water sizes; its final candidate has separate
fresh engine and automatic confirmations in
`docs/research/engine-direction-filter-20261103.json`.
The subsequent copy-on-write study targets detached-prefix ownership. Its
predeclared primary is standalone automatic compilation, which frequently
detaches prefixes; the broad engine panel is a regression guard. Fresh
confirmation reduces that compile time by 3.39%, with no detected change in
the broad panel or isolated stepping. See
`docs/research/engine-copy-on-write-20261103.json` for the complete evidence,
including the deferred copy cost when both lineages remain live.
The subsequent direction-compaction study confirms 2.25% less combined engine
time and 1.26% less standalone automatic compile time, with unchanged measured
memory high-water sizes. See
`docs/research/engine-direction-compaction-20261103.json` and `REWORK.md` for
phase diagnostics, rejected experiments and exact correctness gates.

The subsequent ownership cleanup uses the same paired-process scaffolding as
predeclared regression guards, without a new speedup claim. Adoption requires
no REJECT in engine, standalone automatic and larger-budget checks, upper 95%
time-delta bounds below +0.5% for engine and automatic, unchanged or lower
measured memory and exact structural gates. These guards do not replace fresh
confirmation when claiming a performance improvement. The complete cleanup
study is `docs/research/engine-ownership-cleanup-20261103.json`.

For actual compiler timings, add `--mode=compile --cells=57,59,61` to both
commands (or predeclare another set of indices in `tools/parity/cells.json`).
Each warmup and timed compile must match its committed track and work count.
The primary metric uses the parity worker's compile time per physical frame;
CPU time is diagnostic and also includes worker bookkeeping.
The report also shows individual cell decisions and blocks qualification when
one detects a regression. Always check default automatic construction separately
(`--mode=compile --cells=61`) before adoption. Its process warms only that
workload; the mixed panel warms every selected case. An aggregate win cannot
override a default-path regression.

Declare rounds, repetitions, warmups, cells and the confirmation count before
screening. The tool preserves the protocol and every raw pair, refuses to
overwrite evidence, and issues no interim verdict. KEEP requires favorable
paired bootstrap support (default 95%), a negative median delta, and an exact
one-sided sign-test p-value at most `1-p` (0.05 by default). Ties supply no sign
evidence. Only a fresh KEEP confirmation with identical source, inputs, WASM hashes, host, Node
and CPU affinity qualifies performance; full correctness gates still apply.
Do not repeatedly extend or restart a run until it passes. Bootstrap support describes resampling these
fixed workloads, not a posterior probability, an anytime-valid stopping rule,
or quality across seeds and unseen songs. An identical-binary A/A run should be
INCONCLUSIVE; it is a host sanity check, not proof of universal calibration.

Both arms share the installed dependencies through a symlink: keep dependencies,
Node, affinity and the machine workload fixed throughout screening and
confirmation. Historical timings are not a new machine's baseline.

Structural backend changes require `npm run verify:engine`, exact compile/work
and judge parity, the native ownership/cache tests, typecheck and reachability.
The independent reference engine remains unchanged.
