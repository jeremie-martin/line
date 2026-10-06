# Compiler simulation backend

This is an isolated copy of the accepted Rust physics engine with compiler
facilities for copying an already computed prefix cache, observing state before
each collision sweep, and observing resolved collision positions. Observation evicts the requested frame or window; the compiler then
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
After any backend change, `npm run parity` must stay byte-identical (the audit
script used when this backend was accepted is at tag archive/pre-rework-2026-10-03).
Source and WASM bytes are included in the compiler identity.
