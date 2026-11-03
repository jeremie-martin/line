# Compiler simulation backend

This isolated copy of the accepted Rust physics engine provides the compiler
with shared prefix caches, metered collision observation, and cached resolved
collision positions. Reading cached contacts does not step or replay physics.
Live descendants and the current cache retain the ancestry they need; released
branch payloads are reclaimed once neither needs them. These facilities do not
change the stepping equations or permit supplying a rider state.

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

The collision lookup cache survives frame boundaries, and each point retains
its current bucket. Grid insertion/removal invalidates both cache levels,
including cached empty cells. Detaching starts with empty lookup shortcuts:
the copied grid owns different allocations. Solver arithmetic, collision order
and physical-frame accounting are unchanged.

For a performance change, save the previous WASM and use `npm run bench:engine
-- --reference=before.wasm --candidate=engine.wasm --out=results.json`.
The benchmark includes registration, replay and sibling edit/rollback workloads
over committed tracks. It verifies raw states, ordered events, cached contact
positions and cache-work counts outside timing. Use the same Rust toolchain for
both builds, warm both modules, and alternate sequential runs on a quiet machine.
On a hybrid CPU, pin to one core (`taskset -c 2 node --expose-gc --import tsx
tools/measure/engine.ts ...` on the November 3 host). Record CPU, Node, artifact
hashes, input hashes and raw samples. Its timing intervals describe these fixed
workloads, not quality across seeds or unseen songs. Confirm any end-to-end
claim with real paired compiles and exact track/work checks.

Structural backend changes require `npm run verify:engine`, exact compile/work
and judge parity, the native ownership/cache tests, typecheck and reachability.
The independent reference engine remains unchanged.
