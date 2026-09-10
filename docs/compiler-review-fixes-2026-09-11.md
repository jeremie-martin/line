# Compiler review fixes — 2026-09-11

All five review findings are addressed in `476424cb`. The frozen benchmark,
scorer, judge wrapper and physics are unchanged. The 952.4115 compiler at
`549013df` remains preserved on `archive/arc-v4-940`.

## Engine ownership and reference imports

The arc compiler previously called isolate-wide disposal on the public judge
wrapper. That could free a caller's retained engines or snapshot handles and
later let them alias unrelated reused handles. Replay now uses a private module
instance of the exact same frozen judge wrapper. Its registry and WASM instance
belong only to synchronous compiler replays; deterministic cleanup cannot touch
the public engine registry. No judge or physics source was edited.

The public dispatcher also loads the arc module graph only when WASM is selected.
JS and official-reference processes can import and compile through the legacy
backend without a Rust build, native arc WASM, or the arc policy assets. Engine
selection follows the process environment at module loading, as in the existing
engine shim.

Regression tests retain a caller engine and a fork across successful compiles,
failed compiles, subsequent allocations and garbage collection, checking both
initial and later rider states. Separate temporary checkouts physically omit
WASM and arc model files; both reference engines reproduce explicit legacy
compilation exactly.

## Hook-driven diagnostics

29 research/probe scripts and four existing test modules now import
`compileLegacyHandoff` and legacy hooks explicitly. Their instrumentation no
longer depends on the public dispatcher's choice. The rollout-economics study
clears hooks in `finally` and rejects instrumented work with missing observations.

A real `sparse_lowline` study records 856 rollouts and 87 expanded nodes. Its
instrumented and bare arms have identical tracks, scores and 159,286 measured
physics frames. The requested legacy budget is 150,000: this retains the known
legacy expansion-boundary overrun and is a diagnostic, not a V4 qualification.
The migration does not claim to fix that inherited legacy budget behavior.

## Cached video reviews

Before reusing a saved compile, the review checks the specification hash, jolt,
seed, song, audio hash, render settings, options and implementation identity.
It also checks the compile record's checksum and every required output artifact.
Changed inputs fail before old metrics can be used to render or certify a new
video. The same identity is recorded when compiling a new review.

Tests cover unchanged-cache reuse, edited specs, changed jolt, changed audio and
render settings, other input changes, corrupted records and missing or damaged
output commitments.

## Active V2 cache test

The fixed-N planning assertions remain. The promoted-prefix score is recomputed
from the cache and compared with the promoted depth and headline in the active
baseline record, replacing the obsolete 607.232 assertion. The current archived
baseline reports 852.1248. No baseline or scorer data was changed.

## Validation

**198 focused tests pass across 42 files**: 194 compiler/legacy/cache tests
and four routing tests. Supported TypeScript checking retains the same 251
inherited diagnostics, with no additions or removals. This is a focused regression
suite, not a claim that the entire repository test suite passes.

The public canonical V4 run is **952.4115**, **352/352 valid**, over all 176
specifications and seeds 16/17. Every track hash, score, geometry statistic,
compiler statistic and actual physics-frame count exactly matches the saved
952.4115 run. Maximum work remains 749,997 frames. The frozen judge identity is
unchanged.

See [the checks and scope](../benchmark/v4/studies/review-fixes-20260911-checks.json)
and [canonical validation](../benchmark/v4/studies/review-fixes-20260911-validation.json).
Code and compact evidence are pushed on `codex/compiler-review-fixes` and
`codex/arc-v4-940`; large raw artifacts remain local.
