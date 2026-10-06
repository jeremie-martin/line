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

To rebuild `engine.wasm`, use a separate Cargo target directory with this
manifest and the `wasm32-unknown-unknown` release target, copy `lr_engine.wasm`
to `engine.wasm`, and update the generated hashes. Do not overwrite a shared
judge build. Structural backend changes require exact track and work parity,
independent judging, and the native ownership/cache tests.
