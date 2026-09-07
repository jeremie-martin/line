# Compiler simulation backend

This is an isolated copy of the accepted Rust physics engine with two compiler
facilities: copying an already computed prefix cache, and observing state before
each collision sweep. Observation evicts the requested frame; the compiler then
uses the ordinary metered reader to charge its replay. Neither facility changes
the stepping equations or permits supplying a rider state.

The benchmark engine remains in `engine-rs`. Every native compiler output is
cold-replayed with that engine and must match the full raw trajectory exactly.
The packaged backend passes the 360-prefix cache/trace audit, and a completed
native track also matches the untouched published JavaScript engine exactly.
`manifest.json` records the accepted-source provenance and packaged hashes.

To rebuild `engine.wasm`, run Cargo with this directory's manifest for the
`wasm32-unknown-unknown` release target, then copy `lr_engine.wasm` from that
target directory to `engine.wasm` and update the manifest's generated hashes.
Re-run `scripts/benchmark/audit_planner_backend.ts` against this directory after
any backend change. Source and WASM bytes are included in compiler snapshots.
