# Foundations rework (started 2026-10-03)

## November 4: qualify scalar two-dimensional norms at 9,076 ns

Deferring terminal rider-state materialization past trajectory/construction
validation removes 1,985 cached full-state reads (5,592 → 3,607). The complete
default compiler checkpoint is byte-identical, integrating reads and detailed
work match, and 16 focused tests/typecheck pass. Screen12 is **+0.36%
[−0.61,+1.37]**, 4/12 wins, INCONCLUSIVE. Required KEEP fails; no confirmation,
tuning or cleanup bypass follows (`docs/research/engine-deferred-state-20261104.json`).

Inlining the direction filter into the shared point loop passes 27 Rust tests
and exact native replay, but screen12 is **−0.54% [−1.20,+0.03]**, 7/12 wins,
INCONCLUSIVE. Required KEEP fails. No confirmation, tuning or adoption follows
(`docs/research/engine-filter-inline-20261104.json`).

An untimed shared direction-range diagnostic preserves exact track/work and
checks every predicted hit against the complete ordered result. Fixed ±0.25
velocity rectangles could skip 1,832,622 of 15,779,285 direction dots, but their
certificates need 13,741,636 extra dots: **75.47% more**, before cache overhead.
The declared reduction gate fails. No cache, parameter tuning or timing follows
(`docs/research/engine-direction-ranges-20261104.json`).

Separating raster offsets from hot collision geometry and calculating acceleration
only on an acceleration hit reduces the actual WASM line record from 104 to
80 bytes. All 29 Rust tests and independent native replay pass; 96 additional
acceleration scenarios match 7,776 states and 19,318 ordered collisions. Its
screen12 remains **INCONCLUSIVE: −0.27% [−1.23,+0.67]**, 7/12 wins. Required
KEEP fails; no confirmation, tuning or adoption follows. Full evidence:
`docs/research/engine-hot-line-record-20261104.json`.

Sharing immutable geometry buckets across cache copies passes 28 Rust tests and
independent native replay, including ownership and edit-isolation checks. The
fixed screen12 is **+1.07% [−0.20,+2.48]**, 5/12 wins, INCONCLUSIVE. Required
KEEP fails; no follow-up timing, tuning or adoption follows. Source, tests and
raw pairs: `docs/research/engine-shared-grid-buckets-20261104.json`.

An owned numeric-column impact representation passes 36 focused tests, typecheck
and 41,971 exact frozen-reference comparisons. It nevertheless loses all 12
timing pairs: **+5.24% [+4.04,+6.56]**, REJECT. No confirmation, tuning or
adoption follows (`docs/research/engine-strike-columns-20261104.json`).

Untimed diagnostics also close two cache proposals. All 195 physical-prefix
observations are unique. Even an unlimited exact whole-state map could reuse
only 8.86% of ordinary collision-free steps, before validation or lookup cost;
this fails the declared 25% eligibility gate. Neither cache is implemented.
The impact read-demand counts and both exact track/work checks are preserved in
`docs/research/engine-prefix-demand-20261104.json`.

Indexed strike traversal and avoiding an empty-prefix continuation copy pass
17 focused tests, typecheck and 23,061 frozen-reference comparisons. The fixed
screen12 is inconclusive: **+0.45% [−0.36,+1.36]**, 5/12 wins. Required KEEP
fails; no confirmation, retry or adoption follows. The qualified implementation
and open 7,000 ns target remain unchanged. Full evidence is retained in
`docs/research/engine-strike-iteration-20261104.json`.

Full default automatic compilation now takes **9,076 ns per charged physics
frame**, with an absolute 95% interval of **9,037–9,115**. Against qualified
`974e4d2e`, screen12 passes at −4.36% [−5.10,−3.71], 12/12 wins; fresh confirm24
passes at **−3.81% [−4.32,−3.29]**, 24/24 wins. The **7,000 ns target remains
open**. Every timed compile preserves the same track and 147,209 charged frames.

One small `hypot2` helper replaces 47 two-argument calls across 18 compiler
modules. For finite numbers it scales before squaring and keeps the original
two-term operation order; the first compensation in the reference builtin's
Kahan sum is exactly zero. The zero vector returns positive zero, and nonfinite
inputs delegate to the builtin. Three-argument calls remain unchanged. This
removes temporary argument storage without approximate arithmetic or changes
to physics, search, budgets, scoring or the independent judge.

The native guard24 passes its +0.5% upper-bound condition: −0.21%
[−0.49,+0.07], INCONCLUSIVE. Both arms use the identical native binary, so this
is a non-regression check, not a native speedup claim. The larger compile guard8
passes at **8,608 → 8,244 ns/frame**, −4.23% [−4.74,−3.75], 8/8 wins.
Fresh sampled allocations fall about **15.8%**, from 1,146 to 965 MiB per
compile in the profiling protocol; the `hypot` attribution falls from about
124 to 2.4 MiB. Sampling includes collected objects and fixture loading and is
neither live memory, RSS nor timing evidence. WASM memory high-water stays at
**58.8125 MiB** for the default compile and **134.6875 MiB** for the larger one.

All 63 compiler cells, 33 judge tracks and independent native replay pass.
The helper also passes **944,722** numerical comparisons covering signed zero,
nonfinite values, subnormals, arbitrary binary64 inputs and nearby magnitudes
in both orders. JavaScript has 389 passes and the same pre-existing missing-audio
failure; typecheck and reachability are clean. Rust source and binary are
unchanged from the preceding 27-test qualification. Before any helper timing,
the reference was advanced to the newly qualified topology solver and combined
validation was repeated; the original checks and amendment remain archived.
Full source, tests, raw pairs, audits, memory readings, sampled profiles and
upstream algorithm provenance are in `docs/research/engine-hypot2-20261104.json`.

Follow-up state compaction keeps all velocities in one representation and moves
the mixed entity layout to the output boundary. It passes 28 Rust tests and
independent native replay, but screen12 is inconclusive: **+0.08%
[−0.85,+1.00]**, 5/12 wins. Its required KEEP fails, so it is not adopted,
confirmed or rerun (`docs/research/engine-dense-state-20261104.json`). A separate
snapshot diagnostic finds only **0.5268%** exact consecutive-per-point repeats
among 600,761 history submissions. No deduplication path is added. That diagnostic
and fresh CPU profiles of the qualified compiler are preserved in
`docs/research/engine-after-hypot2-diagnostics-20261104.json`; profile timings
include inspector overhead and are not promotion evidence.

Further fixed 12-pair screens leave the qualified implementation unchanged:

| candidate | paired time delta, 95% interval | favorable pairs |
|---|---|---:|
| paired SIMD direction predicates | +0.31% [−0.62,+1.30] | 6/12 |
| streaming motion summaries | −0.46% [−1.82,+0.96] | 7/12 |
| adjacent x/y state with scoped compiler vectorization | −0.93% [−2.04,+0.19] | 9/12 |

All three are **INCONCLUSIVE** and fail their declared KEEP/minimum-benefit
gates. None is adopted, extended, confirmed or rerun. The direction helper
passes 3,257,049 comparisons with independent scalar JavaScript; the streaming
summary passes 1,000 exact trajectory comparisons against its frozen batch
predecessor. Both native candidates pass 27 Rust tests and exact native replay.
The coordinate layout emits vectorized point stepping and loads/stores, but
static inspection does not show vectorized constraint multiplication.
Full source, tests, plans and raw pairs are retained in
`docs/research/engine-simd-direction-pairs-20261104.json`,
`docs/research/engine-stream-motion-20261104.json` and
`docs/research/engine-vector-state-20261104.json`.

An untimed redundant-work diagnostic finds 195 distinct retrieval queries in
195 calls, with only 1,086 duplicate feature rows among 796,643 query-weighted
model rows. Only 55,336 of 492,859 adjacent raw-frame observations repeat
exactly (11.23%). These counts do not justify additional caches, and equality
does not authorize sharing owned mutable observations. No such implementation
is added. Exact track/work and diagnostic code are preserved in
`docs/research/engine-observation-retrieval-counts-20261104.json`.

Replacing manual grid flooring with `floor()` passes 28 Rust tests, exact native
replay and 1,060,016 independent WASM/JavaScript conversion comparisons. Its
fixed screen12 is **+0.20% [−0.61,+0.96]**, 6/12 wins, INCONCLUSIVE. The upper
bound also exceeds the separately predeclared +0.5% cleanup guard, so neither
speedup nor cleanup adoption qualifies. No further run follows; the original
conversion remains. Evidence: `docs/research/engine-grid-floor-20261104.json`.

Constructing complete impact records and avoiding the account's extra spread
array passes 20 focused tests and typecheck, but screen12 rejects it:
**+2.46% [+1.20,+3.80]**, 1/12 wins. No further qualification or variant follows
(`docs/research/engine-impact-records-20261104.json`). Reusing previous nearest
rows only as initial heap seeds preserves exhaustive stable retrieval and passes
16 focused tests. Its untimed distance-term count falls 7.38%, below the declared
10% minimum, so no timing follows. The extra membership workspace is not adopted
(`docs/research/engine-retrieval-seeds-20261104.json`). These trials leave the
qualified 9,076 ns implementation unchanged.

A separately declared explicit Vec2 primitive trial addresses the automatic
layout's missing vector multiplication. It emits 88 `f64x2.mul` instructions
and passes 27 Rust tests, native replay and 8,228,488 scalar-JavaScript numeric
comparisons (exact non-NaN bits, including signed zero; NaN classification).
Screen12 is still inconclusive: **−0.37% [−1.05,+0.36]**, 7/12 wins. It fails
both KEEP and its stronger −2% upper-bound gate. No variant, confirmation or
conditional ablation follows. The production solver retains scalar coordinate
arrays; source, numeric probes and raw pairs are archived in
`docs/research/engine-vector-operators-20261104.json`.

## November 4: qualify the simpler topology solver at 9,495 ns

The new qualified checkpoint takes **9,495 ns per charged physics frame** for
full default automatic compilation; its absolute 95% interval is **9,447–9,538**.
Against the preceding qualified `c942b254` implementation, fixed screen12 and
fresh confirm24 both pass KEEP and the stronger predeclared minimum benefit:
the paired interval's upper bound must be at most −1%. Confirmation gives
**−1.53% [−2.05,−1.04]**, with 21/24 favorable pairs. The **7,000 ns target
remains unmet**; exact work remains 147,209 frames.

Rest lengths and endurance now derive from the fixed topology instead of
per-cache arrays. One ordered point/friction table replaces ten duplicated
collision calls. Safe constraint indexing produces the same optimized binary
as the earlier unchecked accesses. Equations, floating-point order, zero-friction
behavior, point/collision order, search and scoring are unchanged. The packaged
WASM shrinks from 116,065 to **94,087 bytes**. Neither isolated predecessor was
adopted or rerun: this jointly declared candidate has its own identity and
stronger acceptance gate.

The native guard24 passes at **3,124 → 3,095 ns/frame**, −0.94%
[−1.17,−0.70], 23/24 wins. The larger-budget guard8 passes at **8,665 → 8,607**,
−0.67% [−0.96,−0.38], 8/8 wins. Isolated post-registration stepping is a
diagnostic, **2,647 → 2,619**, −1.06% [−1.98,−0.12], but only 7/12 wins:
its verdict is INCONCLUSIVE, not a separately confirmed speedup.

Fresh WASM linear-memory high-water falls from **64.6875 to 58.8125 MiB** on
the default compile and **146.75 to 134.6875 MiB** on the larger compile.
Native registration/replay/branches remain **3.0625/6.3125/2.0625 MiB**.
These readings are neither live memory nor RSS. All 63 compiler cells, 33 judge
tracks, independent native replay and 27 Rust tests pass. JavaScript has 386
passes and the existing missing-audio failure; typecheck and reachability are
clean. The evidence audit reproduces decisions and checks every timed compile's
exact track/work. Full evidence: `docs/research/engine-topology-solver-20261104.json`.

A separate untimed chunk-copy diagnostic finds only 1,395 avoidable state copies
(under 1 MiB) per default compile. That opportunity does not justify another
ownership path; no implementation or timing trial follows. Counts, original
instrumented code and exact work/hash are archived in
`docs/research/engine-visible-frame-prefix-20261104.json`.

## November 4: qualify a 9,658 ns compiler checkpoint; 7,000 ns remains open

Full default automatic compilation now takes **9,658 ns per charged physics
frame**, compared with **13,527 ns** at `421c0e81` (production code `265545b6`).
The fresh 24-pair confirmation gives **28.60% less time**, paired 95% interval
**28.26–28.95%**, with 24/24 favorable pairs. The candidate mean's separate
fixed-sample bootstrap interval is **9,617–9,699 ns**. This qualifies a useful
checkpoint, but **does not meet the user's 7,000 ns target**. The denominator
remains exactly 147,209 charged frames, and the track hash is unchanged.

Construction memory now retrieves exact stable nearest neighborhoods with a
bounded heap and expands only when adaptation needs more examples. Conservative
partial-distance bounds preserve the original floating-point summation order
for retained rows; nonfinite or ragged input keeps stable full sorting. Local
examples remain fresh. Policy neighborhoods use stable insertion. Model weights,
proposal order, search allowances, scoring and the independent judge stay fixed.

Native registration batches share contiguous immutable geometry and raster
footprints. Registration takes one minimum invalidation over a batch; borrowed
history lists are reused within that query. Lazy component bounds exclude
impossible snapshot collisions before the exact predicate scan. Saved states
share 64-frame chunks across detached caches. Connected solid paths use the same
batch writer as individual lines, and rejected prefix/binding checks avoid
unneeded reporting records. Cached raw windows cross the ABI once; direct
ballistic-state reads/comparisons and native binding-stop replay share the frame
meter. The unused computing candidate-window API is removed.

One detector workspace owns each interval's prefix observations and scalar
checkpoint. Evaluation consumes its borrowed detection synchronously and saves
only owned measurements. Construction inspection, geometry generation and motion
summaries also avoid duplicated scans and temporary records. Ownership, bounds,
fallbacks and output lifetimes are documented in the backend README.

Qualification uses the existing frozen full-source scaffold, Node 22.22.2,
Rust 1.95.0, CPU 2, one warmup and unchanged workloads. Fixed screen12 precedes
fresh confirm24; no timing overlaps correctness checks or profiling.

| Separate guard or diagnostic | Baseline → candidate ns/frame | Paired time delta, 95% interval |
|---|---:|---:|
| Native workloads, guard24 | 3,194 → 3,135 | −1.85% [−2.20, −1.41] |
| Larger automatic budget, guard8 | 12,094 → 8,666 | −28.34% [−28.68, −28.04] |
| Isolated post-registration stepping, diagnostic12 | 2,695 → 2,676 | −0.69% [−1.93, +0.58] |

Both regression guards pass. They are not separate fresh-confirmation speedup
claims; isolated stepping is inconclusive. Fresh WASM linear-memory high-water
is mixed: default compilation **60.8125 → 64.6875 MiB**, larger compilation
**168.625 → 146.75 MiB**. Native registration/replay/branches fall from
**3.5/10.3125/2.125** to **3.0625/6.3125/2.0625 MiB**. These readings are neither
live allocations nor RSS. Shared batches may retain removed members, and a
truncated chunk can retain at most 63 hidden tail states. The packaged binary
is 116,065 bytes, up from 111,085; the build remains ordinary Cargo release output.

Validation: all 63 compiler cells preserve exact tracks and charged work;
all 33 judge tracks pass; independent replay matches 61,115 states, 305,336
ordered collisions and 61,115 raw observations. All 27 Rust tests pass;
JavaScript has 386 passes and the existing missing-audio failure in
`tests/eval_evidence.test.ts` (`productions/amor_na_praia_46s/audio.mp3`).
Typecheck and reachability are clean.

`docs/research/engine-under7k-20261103.json` preserves the frozen patch, source
and binary identities, raw pairs, checks, memory readings, profiles and failed
experiments. Early screens are cumulative comparisons against the original
baseline, not isolated evidence for each added optimization. Later experiments
use direct frozen development references. Ablations that failed their declared
non-regression criterion were restored. Spatial-miss caching, compact grid
storage, raw-frame object reuse and Binaryen O3 did not qualify; frame-local
solver copies failed their static instruction prerequisite. None remains as a
production option. The final raw-sample audit independently reproduces every
completed paired decision and checks each measured compile's exact work/hash.

Follow-up probes leave this production checkpoint unchanged. There are no exact
repeat feature queries across 195 construction-memory retrievals, so a result
cache has no demonstrated opportunity. A shadow 64-slot history-list cache saves
27.52% of map reads but hashes every query; the current slots avoid hashing on
72.27% of queries. Retaining two neighborhoods instead saves only 0.422% of map
reads. Neither cache is added. Direct fixed screen12 comparisons also fail to
qualify a leading-edge bucket shortcut (+0.11%, interval [−0.54,+0.79]) or an
owning line pointer (−0.45%, [−1.43,+0.57]). The latter also fails its stronger
predeclared minimum 1% benefit condition for adding an unsafe invariant. Both
are restored without reruns or confirmations. Exact track/work and native replay
pass throughout. `docs/research/engine-under7k-followup-20261104.json` records the
diagnostics, patches, artifacts, raw pairs and independent decision audit.

Two further collision-loop prototypes also remain outside production. Conservative
per-line position enclosures safely reject 96.16% of candidate visits, but their
fixed direct screen12 is slower: +7.22% [6.64,7.79], 0/12 wins. Grouped direction
extrema classify 33.76% of entries uniformly, yet their screen is also slower:
+2.76% [2.17,3.35], 0/12 wins. Shadow assertions, native tests and independent
replay pass for both. Neither earns confirmation or retention; reducing arithmetic
counts alone does not establish a speedup. Full code, binaries, raw pairs and
decision audits are in `docs/research/engine-line-bounds-20261104.json` and
`docs/research/engine-direction-blocks-20261104.json`.

Flat numeric support/guide paths pass 3,000 exact geometry comparisons and
20 targeted tests, with an identical native binary, but their screen12 is
inconclusive: −0.33% [−1.03,+0.42], 8/12 wins. A separate native constraint-phase
working record removes 37 generated stores in each solver variant; safe indexing
produces that same candidate binary. It passes 27 native tests and independent
replay, but its screen12 is also inconclusive: +0.27% [−0.49,+1.03], 6/12 wins.
Both required KEEP, so neither is retained or rerun. Their frozen evidence is in
`docs/research/engine-packed-paths-20261104.json` and
`docs/research/engine-constraint-phase-20261104.json`.

Deriving rest/endurance constants directly from the fixed topology removes the
per-cache arrays, 30 loads per solver and 1,476 binary bytes. Exact constant
checks, 27 Rust tests and native replay pass. Its screen12 remains inconclusive:
−0.71% [−1.40,−0.03], but only 8/12 wins, failing the declared sign safeguard.
It is not promoted or rerun (`docs/research/engine-fixed-constraints-20261104.json`).
An untimed line-use diagnostic also closes the lazy-bound follow-up: 69.22% of
constructed lines are visited, and profiles do not show a substantial collision
solver saving to justify further certificate machinery. Counts, exact work/hash,
raw profiles and cautiously mapped names are in
`docs/research/engine-line-use-20261104.json`; no new lazy implementation is added.

An ordered point/friction loop shrinks the two generated solver bodies by about
65% and 61%, and the binary by 20,490 bytes. Rust tests and native replay pass,
but its isolated screen12 is inconclusive: −1.20% [−2.06,−0.32], 9/12 wins,
failing the sign safeguard. Binary control memo keys also preserve all 41,495
equivalence cases but fail their screen: −0.36% [−1.31,+0.62], 7/12 wins.
Neither isolated candidate is adopted or rerun. Evidence is in
`docs/research/engine-point-loop-20261104.json` and
`docs/research/engine-binary-control-key-20261104.json`.

Fresh untimed stage counts find 9,550 geometry builds, 5,397 successful replays,
3,412 successful inspections and 3,365 measured candidates. Native raw-window
reads materialize 492,859 frame records across 5,592 calls. Sampled allocation
profiles identify substantial temporary storage in `Math.hypot`; these include
collected objects and fixture loading, and are neither live memory nor timing
evidence. The raw profile, instrumentation and exact track/work checks are in
`docs/research/engine-candidate-stages-20261104.json`.

## November 3: reject inline native version slots; finish three experiments

Third sequential experiment, against accepted `265545b6`: replace boxed versions
with inline optional arena slots. References stay inside a checked arena call,
so movement is safe. All 20 Rust ownership tests, 14 targeted wrapper/cache tests,
33 independent replay fixtures (61115 states and 305336 ordered collisions),
typecheck and reach pass.

The frozen full-source default compile screen12 REJECTs: +0.768% time,
95% interval [+0.503,+1.043], 11/12 pairs slower, with exact track/work parity.
No confirmation follows a rejected screen. Raw-engine WASM high-water is
unchanged. Fresh compile high-water falls from 60.8125 to 57.625 MiB and from
168.625 to 149.125 MiB for the default/larger-budget cases; WASM is 51 bytes
smaller. These storage benefits do not override the declared performance gate.
Restore the boxed arena and archive the experiment.

All three trials are complete: retain packed cached observations; reject shared
trajectory spans and inline versions. Final production sources, tests and packaged
WASM exactly match the fully validated `265545b6`; later commits contain study
evidence only. `docs/research/engine-data-oriented-20261103.json` retains every
fixed run, candidate patch, artifact identity, validation log and memory reading.


## November 3: reject shared trajectory spans

Second sequential data-oriented experiment, against accepted `265545b6`.
A read-only two-span view retained physical prefix/suffix arrays separately;
detection, motion scoring and construction checks read it without whole-trajectory
concatenation. Targeted tests covered every trajectory split, slice boundaries,
resumed detection, motion and authored construction windows; all ten passed,
with zero type errors/unreachable files.

The frozen full-source default compile screen12 REJECTs: +0.695% time,
95% interval [+0.389,+1.009], 11/12 pairs slower. Every timed compile preserves
track/work parity. No confirmation or full promotion checks follow a rejected
screen. Fresh compiler WASM high-water is unchanged (60.8125/168.625 MiB).
The removed allocation does not justify this implementation's added access
abstraction; restore the simpler flat candidate arrays. The prototype patch,
raw paired samples and checks remain in `docs/research/engine-data-oriented-20261103.json`.


## November 3: packed cached physics observations

First of three sequential data-oriented experiments, against `32da1e18`.
The compiler reads contiguous [vx, vy, angular momentum, radius, contact]
records with one cached-only native call per observed window. Strike frames
consume those values directly, sharing the scalar path's arithmetic without
intermediate motion objects. Reads validate the complete window, never simulate,
and borrow output only until the next engine call. The independent judge is
unchanged.

CPU 2, frozen full source/binary arms: A/A12 is inconclusive (+0.072%,
95% interval [-0.136,+0.295]); default automatic screen12 and fresh confirm24
both KEEP. Confirmation is -1.768% time [-1.963,-1.556], 24/24 favorable pairs.
Engine guard24 is +0.001% [-0.313,+0.429], within the predeclared +0.5% upper
bound. The separate 750k-budget guard8 is -2.889% [-3.247,-2.533]; it is a
regression guard, not independently confirmed speedup evidence. Adopt.

Engine-panel WASM high-water remains 3.5/10.3125/2.125 MiB for registration,
replay and branching. Fresh compile high-water is mixed: default 70.3125 to
60.8125 MiB; larger-budget 151.25 to 168.625 MiB. These single-process readings
include allocator/GC lifetime effects and are not live allocations or RSS;
no memory-reduction claim is made. WASM grows by 670 bytes to 111085 bytes.

Validation: exact tracks and work in all 63 compiler cells; 33 judge tracks;
61115 independent frame states/packed observations and 305336 ordered collisions;
20 Rust tests; zero type errors and unreachable files. JavaScript: 367 pass,
one existing missing-audio fixture failure in `eval_evidence.test.ts`.
Raw paired samples, protocol, source patch, identities, memory readings and logs:
`docs/research/engine-data-oriented-20261103.json`.


## November 3: overlap independent loading and render preparation

A fresh async-path audit scanned 206 first-party source files, including the
compiler, engine adapters, producer/evaluation tools, browser review pages,
dashboard and mirror helper. Physics stepping and search were already
synchronous. Their code, WASM artifacts, ownership rules and accounting remain
unchanged. Independent startup imports now load together in the producer,
evaluation adapter, judge and research workers. Saved-cell lookup and its
comparison-state caller now return synchronously instead of creating and
awaiting promises around synchronous reads and already resolved inputs.

Render preparation now overlaps overlay-data generation with the dependent
ride-export/audio-mux chain. Composition waits for both; failure cleanup waits
for both writers to settle. The worker and Remotion resource limits remain.
Static requests bypass asynchronous API misses through namespace dispatch.

Gallery artifacts fetch their bytes and checksum together, and an optional
video response is reused instead of downloaded twice. Music downloads overlap
native preparation; video metadata and library/job loading also overlap their
independent work. Pair/night pages load independent resources together, while
the night report still renders before optional resources finish. Dashboard
audio starts while analysis loads. Checksum verification, superseded-selection
cancellation, optional-media fallbacks and audio-failure scrubbing are preserved.

The audit deliberately retains sequential physics/replay, bounded worker loops,
benchmark arms, produced-file dependencies, save-before-reload operations and
validation-before-publication. Promise grouping does not parallelize synchronous
CPU work. External renderer readiness waits were not proven unnecessary.

Validation: all 63 compiler parity cells retain exact tracks and charged work;
judge parity passes all 33 tracks. JavaScript has 366 passes and the same
pre-existing missing-audio fixture failure in `tests/eval_evidence.test.ts`.
Typecheck and reachability pass. Deferred-operation tests prove overlap and
cleanup barriers without relying on wall-clock thresholds. Four browser checks
cover overlapping loads, superseded selection, bad-audio recovery and dashboard
audio/analysis loading. They use synthetic signed artifacts and the installed
Chromium; the unavailable generated production collection was not re-rendered.

A predeclared controlled latency diagnostic used eight alternating pairs after
one warmup per arm, pinned to CPU 2, after correctness work completed. With an
80 ms delay per loopback response, verified JSON plus checksum averaged
167.3 ms before and 84.4 ms after. Every result was identical and both candidate
requests overlapped in every pair. This is evidence for removing the network
wait, not an end-to-end application or physics speedup. The plan, full source
inventory, decisions about retained ordering, frozen hashes, tests and raw
latency pairs are in `docs/research/async-hot-paths-20261103.json`.

## November 3: simplify engine ownership, observations and private ABI

The engine now has explicit owners: `EngineArena` manages versions and lineage
reconciliation; `FrameCache` owns geometry, computed frames and derived read
summaries; `CollisionHistory` owns rollback indexes; the kernel only steps the
state and records into an explicitly supplied trace. The former `frame` module
is named `history`, and `Holder` is named `Lineage`. Redundant forwarding functions
and cached-read layers are gone. Cache storage is private, so edits, reset and
truncation maintain its invariants in one place.

Collision traces now belong to the requesting version. Interleaved siblings
cannot overwrite each other's observations, and pending trace eviction happens
before metered reads report available frames. History reconstruction never
records a requested trace. The private ABI has a typed adapter with centralized
view refresh, including vectors moving within an unchanged memory buffer.
Dynamic retained outputs replace fixed event/window arrays and their silent
limits. Batch insertion is the only insertion ABI; the unused batch simulator,
single-line export, recording selector and wrapper compatibility fallbacks are
removed. The independent judge and reference implementations stay independent.

JavaScript wrappers have one construction path and one handle registration.
Explicit disposal, finalization and scope cleanup share an idempotent release;
disposed wrappers fail even after a slot is reused. Empty insertion keeps its
existing owner. Synchronous scopes protect caller-owned engines and reject
asynchronous callbacks. The old study-specific cleanup name becomes
`disposeEngines`. Build manifests discover the current source set and tests
check completeness and hashes. The root, architecture, judge and native manuals
now describe the actual boundaries and workflows.

Cached observations check availability and read in one native operation.
Raw frames use cached contact IDs and first-contact point order. Body motion
is a pure lazy `OnceCell` observation owned by each frame summary; shared cache
snapshots may fill it without copying simulation state, and rollback discards
it with its frame. It preserves the reference arithmetic order. Extra solver
trace specialization and a finite contact-order interning table were tried and
removed: neither justified the added complexity.

**Measure the entire change, including its wrapper.** `perf:engine` now accepts
`--reference-root` to compare frozen source arms in one disposable execution
directory, with a fixed runner and judge binary. It rejects differing fixtures,
dependencies and judge source, records both source identities and requires both
source and binary equality for an A/A control. Fresh confirmation checks both
identities. The initial cleanup passed its engine panel but regressed default
automatic compilation by 3.79% and the larger budget by 1.17%; it was rejected.
Profiles and twelve fixed, changed-candidate diagnostics led to the compact
observations and lazy memo. All failures remain in the evidence; no unchanged
run was extended or restarted to obtain acceptance.

**Final cleanup regression guards against `2a5ef4f1`, without a speedup claim:**
the final source and packaged binary were frozen before full correctness checks
and fresh fixed guards. Runs used CPU 2, Node 22.22.2 and plain Rust 1.95.0 release
builds, without simultaneous builds or tests. Adoption requires no REJECT in
any guard and upper 95% time-delta bounds below +0.5% for the engine panel and
default automatic. Engine arms have two measured repetitions after one warmup;
compiler arms have one. The twelve-pair identical-source/binary control is
INCONCLUSIVE.

| workload | pairs | mean time delta | 95% paired-bootstrap interval |
|---|---:|---:|---:|
| combined engine panel | 24 | +0.07% | -0.25% to +0.47% |
| standalone automatic, cell 61 | 24 | -0.92% | -1.15% to -0.70% |
| 750k-budget automatic, cell 62 | 8 | -0.58% | -0.82% to -0.33% |

All three guards pass. Every warmup and measured compile preserves the committed
track and charged work (147,209 or 741,902 frames). These cleanup screens do not
qualify an independently confirmed speedup. The twelve-pair isolated
post-registration stepping diagnostic is INCONCLUSIVE, with mean time delta
+0.43% (95% interval -0.33% to +1.26%). It alternates arms in one
process after three warmups; it is a phase diagnostic, not promotion confirmation.
It does not exclude a small stepping regression.

Measured WASM linear-memory high-water sizes fall from 5.0625 to 3.5 MiB for
registration, 10.8125 to 10.3125 MiB for replay, and 3.75 to 2.125 MiB for branches.
The inline lazy memo consumes part of the removed fixed buffers' savings.
These macro workloads do not request variable window/event outputs, which grow
and retain storage when used. These are buffer sizes, not live allocations or
RSS. The package shrinks from 112,337 to 110,415 bytes and exactly matches the
frozen measured artifact. ABI transport remains synchronous and module-global;
this cleanup does not make it a concurrent native C API.

Validation: all 63 compiler parity cells preserve exact tracks and charged work.
Independent replay passes on 33 tracks, 61,115 states and 305,336 ordered
collisions. The expanded gate also checks raw frames, body motion, contact IDs
and cached-only observation behavior on all 61,115 frames. Judge parity passes
all 33 tracks. All 20 Rust tests pass; JavaScript has 355 passes and the same
pre-existing missing-audio failure in `tests/eval_evidence.test.ts`.
Typecheck and reachability pass. New regression coverage exercises disposed
handle reuse, scope lifetimes, interleaved traces, rollback/memo isolation,
memory growth, output beyond former limits and frozen source overlays.

The plans, rejected candidates, prototype patches, profiles, 20 fixed paired
runs (232 pairs), isolated stepping/memory diagnostics and reproducible final
identity/decision audit are archived in
`docs/research/engine-design-cleanup-20261103.json`. The archive explicitly marks
coverage limits of historical prototype source snapshots; the final complete
source identities, binary, manifest and every frozen changed file are verified.

## November 3: scope engine ownership and centralize history rollback

The native engine now owns version slots, lineage holders, free lists and
reconciliation scratch in one `EngineArena`. Stateful operations borrow it
through one checked scope; internal references cannot escape that call.
This removes every mutable static and unsafe block from `engine.rs`.
The existing ABI exchange buffers and trace state remain synchronous and
module-global; this change does not make the whole backend concurrent.

`CollisionHistory` now owns the invalidation indexes, snapshots, active-cell
shortcuts and rollback boundaries. Its boundary length replaces the redundant
tracked-length counter. Reset, rollback and frame completion maintain all
boundaries together; the kernel takes one history owner instead of six mutable
history arguments. Clone clears borrowed shortcuts, and reset/rollback invalidate
them before releasing nodes. Physics arithmetic, collision order, cached public
frames, charged work and the ABI are unchanged.

**Cleanup regression guards against `b512e1ae`, without a speedup claim:**
the predeclared cleanup guards use the existing paired-process scaffolding,
pinned to CPU 2 with Node 22.22.2 and plain Rust 1.95.0 release builds. Adoption
requires no REJECT in any guard, upper 95% time-delta bounds below +0.5% in
engine and standalone automatic, unchanged or lower measured memory and exact
structural gates. Engine arms use two measured repetitions after one warmup;
compile arms use one. The twelve-pair identical-binary control is INCONCLUSIVE.

| workload | pairs | mean time delta | 95% paired-bootstrap interval |
|---|---:|---:|---:|
| combined engine panel | 24 | -0.48% | -0.69% to -0.25% |
| standalone automatic, cell 61 | 24 | -2.08% | -2.22% to -1.92% |
| 750k-budget automatic, cell 62 | 8 | -0.66% | -0.86% to -0.42% |

All three guards pass. These fixed runs were not extended, and their screening
decisions are not presented as independently confirmed speedups. Every warmup
and timed compile preserves the committed track and charged work (147,209 or
741,902 frames). The twelve-pair isolated post-registration stepping diagnostic
has mean time delta +0.98% (95% interval -0.42% to +2.28%).
Its result is INCONCLUSIVE and does not exclude a small stepping regression.
It alternates arms in one process after three warmups and is not a promotion
confirmation.

Measured WASM linear-memory high-water sizes match baseline: 5.06 MiB for
registration, 10.81 MiB for replay and 3.75 MiB for branches. These are memory
buffer sizes, not live allocations or RSS. The package grows from 111,336 to
112,337 bytes and exactly matches the frozen measured artifact.

A further experiment combined three boundary vectors into one record array.
It preserved exact diagnostics and memory, but its isolated stepping result
was slower by 1.88% (interval +0.78% to +2.93%). It was rejected; the accepted
owner keeps separate private arrays with centralized operations. The arena-only
and history-only probes, combined candidate, rejected boundary layout, source
patches, plans and all raw pairs are archived in
`docs/research/engine-ownership-cleanup-20261103.json`.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115 states and 305,336
ordered collisions; judge parity passes on all 33 tracks. All eighteen Rust
tests pass, including arena reentry rejection, independent ownership, and
history clone/rollback isolation. Typecheck and reachability pass. JavaScript
has 340 passes and the same pre-existing missing-audio failure in
`tests/eval_evidence.test.ts`.

## November 3: compact collision direction filters directly in reserved space

The physics kernel now compacts accepted line pointers directly into the
already-reserved query buffer. Each input writes at the current output count;
only a passing direction predicate advances that count. This removes both
per-entry vector growth checks and a direction-dependent branch. The vector
publishes only the initialized accepted prefix. Before input i, the output
count is at most i, so every write fits within the reserved input length.
The original arithmetic, NaN rejection, order and cross-cell duplicates remain
unchanged. No search code, simulation equations or work accounting changed.

**Confirmed against `71bab968` on this machine:** fixed twelve-pair screens,
then twenty-four fresh pairs for each workload, pinned to CPU 2 with Node
22.22.2 and plain Rust 1.95.0 release builds. The engine panel uses two measured
repetitions per arm; standalone automatic uses one, both after one warmup.
A fresh twelve-pair identical-binary control was INCONCLUSIVE.

| workload | time reduction | 95% paired-bootstrap interval | faster pairs |
|---|---:|---:|---:|
| combined engine panel | 2.25% | 1.86–2.61% | 23/24 |
| standalone automatic, cell 61, 150k allowance | 1.26% | 1.06–1.46% | 24/24 |

Within the confirmed panel, component averages are 22.6→22.2 ms for registration,
189.1→182.1 ms for replay including registration, and 332.3→327.4 ms for
branches/edits. Registration's paired result is INCONCLUSIVE.
The separately declared eight-pair 750k-budget regression
check was KEEP, with mean time delta -1.62% (95% interval -2.12% to -1.21%).
It is not a separately confirmed speedup claim. Every warmup and timed compile
preserves the committed track and charged work (147,209 or 741,902 frames).

The final twelve-pair isolated post-registration stepping diagnostic has mean
time delta **-4.63% (95% interval -5.52% to -3.64%)** against this round's baseline.
A separate, predeclared twelve-pair comparison with `4be353e8`, before lazy
queries, has delta **-2.09% (95% interval -2.59% to -1.57%)**. These alternate
arms in one process after three warmups; they are phase diagnostics, not
fresh-process promotion confirmations.
The older-baseline check was declared after engine confirmation and does not
change the promotion criteria.

Measured WASM linear-memory high-water sizes match baseline: 5.06 MiB for
registration, 10.81 MiB for replay and 3.75 MiB for branches. These are memory
buffer sizes, not live allocations or RSS. The package grows from 111,185 to
111,336 bytes and exactly matches the frozen measured binary.

This round also tested a conservative spatial filter to skip history replay
for disjoint edits, outlined collision functions, suppression of unused history
events, direct writes retaining the direction branch, and contiguous query
normals. The spatial filter and outlining were slower; suppressing history
events showed no reliable benefit. Contiguous normals did not establish an
additional benefit over the simpler chosen design. All prototype patches,
profiles, raw pairs and decisions remain in
`docs/research/engine-direction-compaction-20261103.json`.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115 states and 305,336
ordered collisions; judge parity passes on all 33 tracks. All fifteen Rust
tests pass, including full, empty, growing and shrinking filter buffers.
Typecheck and reachability pass. JavaScript has 340 passes and the same
pre-existing missing-audio failure in `tests/eval_evidence.test.ts`.

## November 3: transfer detached physics caches without eager copying

The native engine now shares an immutable cache snapshot between detached
lineages until either needs to write. If the source is released first, the
remaining lineage keeps the storage without copying geometry, frames or
history. Cached reads never trigger a copy. If both remain live, the first
writer receives its own cache before any edit, extension, reset or trace
eviction. An actual cache copy clears borrowed line queries; ownership transfer
keeps those queries with their owning grid. Solver equations, frame storage,
the ABI and physical-frame accounting are unchanged.

Fresh replay and automatic-workload profiles guided this round. Kernel
experiments included SIMD, constraint factoring, predicate short-circuiting,
empty-query reuse and inactive-trace call removal. None qualified for adoption.
Compact saved frames reduced memory but did not pass the compiler screening
gate. The automatic profile also exposed prefix detachment cost, leading to
the accepted ownership change. All prototype patches and measurements are
preserved in `docs/research/engine-copy-on-write-20261103.json`.

**Confirmed against `6a0f4c01` on this machine:** the frozen candidate used
plain Rust 1.95.0 release builds, Node 22.22.2 and CPU 2. Before screening it,
standalone automatic compilation was declared primary because it frequently
detaches prefixes; the broad engine panel has few detachments. Twelve screen
pairs followed by twenty-four fresh confirmation pairs, with one warmup and
one measured compile per arm, give **3.39% less compile time** on cell 61
(150k allowance), interval **3.17–3.60%**, winning **24/24 pairs**. Every warmup
and measured compile preserves the committed track and 147,209 charged frames.
A fresh twelve-pair identical-binary control was INCONCLUSIVE.

The predeclared twenty-four-pair engine regression guard was INCONCLUSIVE:
mean time delta +0.15%, interval −0.12% to +0.44%, with two measured repetitions
after one warmup. The eight-pair 750k-budget guard won all eight pairs,
averaging 1.57% less time (interval 1.12–1.99%) with exact tracks and 741,902
charged frames. These are regression checks, not independently confirmed
speedup claims. This change removes engine ownership overhead; the results
do not establish faster solver arithmetic.

Separate twelve-pair diagnostics after three warmups in one process found
no detectable stepping change (−0.10%, interval −0.40% to +0.22%). Twenty
detach-and-release cycles per committed track remove almost all copying cost
(−99.88%). Keeping the source alive and including the detached cache's first
write instead gives +0.13%, interval −0.15% to +0.41%, INCONCLUSIVE. This
explicitly includes the deferred copy cost. These phase diagnostics are not
fresh-process promotion confirmations.

WASM linear-memory high-water size is unchanged for registration (5.06 MiB)
and replay (10.81 MiB); the branch workload falls from 3.875 to 3.750 MiB.
These are memory-buffer sizes, not live allocations or RSS. The packaged WASM
grows from 110,887 to 111,185 bytes and is byte-identical to the measured
candidate. The independent judge and compiler search code remain unchanged.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115 states and 305,336
ordered collisions; judge parity passes on all 33 tracks. All fourteen Rust
tests pass. New tests exercise the first mutation of a shared snapshot from
either live lineage and continuation after all source handles are released.
Typecheck and reachability pass. JavaScript tests have 340 passes and the same
pre-existing missing-audio failure in `tests/eval_evidence.test.ts`.

## November 3: reuse collision direction checks within each frame

The physics kernel now filters nearby lines with the original
normal-dot-velocity > 0 predicate when a point starts a frame or changes cell.
Velocity stays fixed through the six solver sweeps, so the intervening sweeps
reuse that ordered list. Cell order, cross-cell duplicates, NaN rejection and
all response arithmetic are preserved. Each step resets the filtered lists,
including history replay at an already-used frame index. A shared refill
routine keeps list construction out of each specialized point solver.

**Confirmed against `d63cd32a` on this machine:** twelve screening pairs followed
by twenty-four fresh pairs for each primary workload, pinned to CPU 2, plain
Rust 1.95.0 release builds and Node 22.22.2. The engine panel uses two measured
repetitions per arm; the standalone compiler case uses one, both after one
warmup. A fresh twelve-pair identical-binary control was INCONCLUSIVE.

| workload | time reduction | 95% paired-bootstrap interval | faster pairs |
|---|---:|---:|---:|
| combined engine panel | 1.76% | 1.30–2.13% | 23/24 |
| standalone automatic, cell 61, 150k allowance | 2.42% | 2.18–2.67% | 24/24 |

Engine component averages are 22.8→22.9 ms for registration,
197.8→190.9 ms for replay including registration, and 337.0→334.0 ms for
branches/edits. The separately declared eight-pair 750k-budget regression check
won all eight pairs, averaging 2.47% less compile time. It is not a separately
confirmed speedup claim. Every warmup and timed compile preserved its committed
track hash and physical-frame charge.

The final twelve-pair post-registration diagnostic takes **4.23% less time**
than `d63cd32a` (interval 3.17–5.27%). A fresh comparison with the pre-lazy-query
engine still takes **1.88% more time** (interval 1.19–2.56%). This recovers part
of the previous stepping cost; it does not establish a universal solver gain.
These diagnostics use alternating pairs in one process, separately from the
fresh-process promotion confirmations.

**Memory affected selection.** The first filtered candidate passed confirmation
at 1.82% less engine time and 4.40% less automatic compile time, but replay WASM
linear-memory high-water grew from 10.81 to 13.31 MiB. It was not adopted.
Reserving the full query length before filtering avoids repeated buffer growth.
That revised binary went through its own screening and fresh confirmations.
Its measured high-water sizes match the baseline on all three workloads:
5.06 MiB registration, 10.81 MiB replay and 3.88 MiB branches. These are WASM
linear-memory sizes, not live allocations or RSS. The package itself shrinks
from 114,166 to 110,887 bytes.

Spatial cache slots, cached neighboring buckets, a separate unfiltered point
list and world-coordinate cache bounds were also explored. They were slower
or inconclusive and were not adopted. Source patches, raw measurements, frozen
artifact hashes and both candidate decisions are preserved in
`docs/research/engine-direction-filter-20261103.json`. The packaged rebuild is
byte-identical to the final measured artifact.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115 states and 305,336
ordered collisions; judge parity passes on all 33 tracks. All thirteen Rust
tests pass, including the new frame/velocity filtering cases. Typecheck and
reachability pass. JavaScript tests have 339 passes and the same pre-existing
missing-audio failure in `tests/eval_evidence.test.ts`.

## November 3: lazy nearby-line queries in the compiler engine

The native compiler backend now registers a line only in its original raster
cells. Previously each registration expanded into nine neighboring buckets.
That made edits and version reconciliation costly; a fresh automatic-workload
profile put substantial time in registration and reconciliation.

A shared cache now flattens nearby-line queries on demand. Each point retains
its own copy of the ordered line pointers until it changes cell or the grid is
edited. Query buffers reuse capacity. The grid owns the immutable lines, edits
invalidate both query levels (including empty queries), and detached engines
start with empty queries. Cell order, descending ids within cells and duplicates
across cells are preserved. A collision keeps traversing its original list even
if it moves the point into another cell. Physics arithmetic and the ABI are
unchanged; the independent judge is untouched.

**Confirmed against `4be353e8` on this machine:** twelve screening pairs followed
by twenty-four fresh pairs for each primary workload, pinned to CPU 2, plain
Rust 1.95.0 release builds and Node 22.22.2. Both confirmations won 24/24 pairs.

| workload | time reduction | 95% paired-bootstrap interval |
|---|---:|---:|
| combined engine panel | 20.99% | 20.74–21.24% |
| standalone automatic, cell 61, 150k allowance | 13.52% | 13.36–13.68% |

The confirmed engine components average 78.6→22.9 ms for registration,
241.6→195.8 ms for full replay including registration, and 381.3→335.5 ms for
branches/edits. A separately declared eight-pair standalone 750k-budget check
(cell 62) won all eight pairs, averaging 16.20% less compile time. It is a
regression guard, not a separately confirmed speedup claim. Every measured and
warmup compile matched its committed track hash and charged frame count.

**Tradeoff:** stepping after registration takes 8.37% more time in a separate
twelve-pair diagnostic (interval 7.69–9.02%). The registration and edit savings
outweigh that cost in the measured compiler workloads. This is an optimization
for the compiler backend, not a universal solver-speed improvement. The study
reports this phase separately so the combined replay result cannot conceal it.
WASM linear-memory high-water size on replay falls from 14.50 to 10.81 MiB;
registration falls from 6.44 to 5.06 MiB, and the branch workload stays at
3.88 MiB. These are linear-memory sizes, not process RSS or live allocations.

Development tried cached bucket arrays, compact bucket lists, separate flat
lists per point and a shared flat cache before combining the two query levels.
The final candidate was frozen before confirmation. The package rebuild is
byte-identical to that measured binary; its sources, prototype patches and raw
measurements are in `docs/research/engine-lazy-neighborhoods-20261103.json`.

Validation: all 63 compiler cells preserve exact tracks and charged work.
Independent engine parity is exact on 33 tracks, 61,115
frame states and 305,336 ordered collisions; judge parity passes on 33 tracks.
All twelve Rust tests pass, including cache eviction, grid edits, epoch wrap,
duplicate ordering and movement during a sweep. Typecheck and reachability
pass. The suite has 339 passing tests and the same pre-existing missing-audio
failure.

## November 3: restore the paired engine promotion workflow

The archived `archive/pre-rework-2026-10-03:scripts/v0/bench/perf_ab.ts`
contains the right foundation: alternate paired, fresh, warmed processes;
change only WASM; normalize by physical work; preserve samples and make an
explicit decision. The earlier `bench:engine` diagnostic did not restore that
whole workflow. `npm run perf:engine` now adapts it to the current backend and
uses the actual parity worker for compiler timings.

The adapter snapshots source and fixtures in a private directory instead of
swapping the live package. It fixes the old bootstrap RNG's floating-point
integer multiplication, treats ties neutrally, requires an exact sign test as
well as bootstrap support and a favorable median, and requires fixed sample
counts plus a fresh confirmation of frozen artifacts. Source/input/WASM hashes
are checked between stages; the final adapter also enforces host, Node and CPU
affinity identity. Installed dependencies must remain fixed. Bootstrap support
is a resampling fraction, not a posterior probability or an anytime-valid rule.

All measurements used the same November 3 laptop, Rust 1.95.0 plain release
builds, Node 22.22.2, CPU 2, and sequential workers without concurrent builds or
tests. A real identical-binary A/A control was INCONCLUSIVE: 6 wins/6 losses,
mean delta +0.10%, 95% bootstrap interval −0.31% to +0.54%.

**Retained:** the already committed collision-cache reuse passed 12 screening
and 24 fresh confirmation pairs against a same-toolchain pre-change rebuild.
Confirmation reduced composite engine time by 2.11% (95% interval 1.88–2.33%),
winning all 24 pairs. This composite includes registration, replay and branch
edits; it is different from the earlier 4.3% replay-only result.

The separate default automatic case (cell 61, seed 101, 150k allowance) also
passed 12 screening and 24 fresh confirmation pairs: **1.18% less compile time**
(95% interval 0.94–1.42%), winning 23/24 confirmation pairs. Every warmup and
timed compile preserved its track hash and 147,209 charged physics frames.
This supports a gain on that warmed case, not on every song or budget.

**Further experiments were not promoted:**

| candidate versus the retained cache | evidence | decision |
|---|---|---|
| shared immutable geometry alone | 12 engine pairs: 0.48% slower | reject |
| shared geometry plus cached raster cells | 24 fresh engine pairs: 0.92% less time; 12 fresh three-case compiler pairs: 1.21% less time | reject after default-path check |
| one lookup to edit/remove empty grid buckets | 24 engine pairs: estimated 0.18% less time, interval −0.48% to +0.16% delta; 12 automatic pairs: no detected difference | inconclusive; do not promote |

The raster-cache trial is the important counterexample. In the three-case
150k-budget compiler panel (fold, terraces, automatic), the automatic case was
0.41% slower despite the aggregate win. A subsequently declared standalone
automatic check lost **all 24 fresh pairs**, averaging 1.55% slower (interval
1.26–1.86%). Lower WASM memory and faster explicit layouts did not justify
that default-path regression. Its source and WASM were removed from the package.

The final report now exposes individual compile-cell decisions and blocks
qualification on a detected cell regression. The workflow also requires a
separate default automatic workload before adoption: mixed-case warming can
produce a different context from standalone use. No inconclusive run was
extended until it passed; no new native-engine change was adopted in this round. Candidate patches,
artifact hashes and every raw sample are preserved in
`docs/research/engine-promotion-20261103.json`.

Validation: 63/63 compiler track/work cells, 33/33 judge tracks, 61,115 frame
states and 305,336 ordered collisions exact; ten Rust tests pass, typecheck has
zero errors, reachability has zero unreachable files. The suite has 339 passing
tests and the previously reproduced missing-audio failure in
`eval_evidence.test.ts`.

## November 3: physics-engine baseline and collision lookup reuse

Structural physics work on the new host: i7-12800H, 20 logical CPUs, 16 GB RAM,
Node 22.22.2, Rust 1.95.0. Earlier host timings are not this machine's baseline.
The compiler's `native_motion` backend is separate from `engine-rs`, and is not
selected by `LR_ENGINE`. The independent reference engine and compiler search
are unchanged.

**Kept:** collision-grid lookup shortcuts now survive frame boundaries, and
each point retains its current bucket. Grid edits invalidate both cache levels,
including cached misses. A detached grid starts with empty shortcuts, so it
cannot retain pointers into its source grid. Physics arithmetic, collision
order, trajectories and charged frame counts are unchanged.

**Measurements:** 12 sequential pairs per workload, alternating order after
four warmups, pinned to CPU 2 with GC before each sample. Both arms consume the
same 33 committed tracks. Against the originally shipped binary:

| workload | before | after | time reduction |
|---|---:|---:|---:|
| registration | 77.1 ms | 76.3 ms | within noise |
| full replay | 251.5 ms | 240.6 ms | 4.3% (95% ratio interval: 0.944–0.970) |
| sibling edits, rollback and detached prefix | 388.8 ms | 381.5 ms | 1.9% (0.976–0.986) |

A separate comparison against a same-source, same-toolchain rebuild gives
4.3% and 2.0% reductions. These are engine workloads, not whole-compiler claims.
Six real compile pairs (arcs, scattered geometry and low-budget automatic;
two pairs each) range from 0.2% slower to 1.2% faster, all with exact track/work
parity. This small sample does not establish a reliable whole-compiler gain.
The intervals describe timing noise on these fixed workloads, not quality
across seeds or new songs. A conservative world-coordinate bounds shortcut
and a different cache slot hash did not add reliable gains and were removed.

**Workflow repairs:** `build:native` rebuilds and hashes the compiler package
without touching the judge. `verify:engine` uses committed tracks instead of
missing local trace fixtures. The legacy numeric diagnostic now fails on
missing references, mismatched frame counts, non-finite values or drift.
`bench:engine` records hardware, artifact/input hashes and all paired samples,
and checks states, events, cached contact positions and cache work outside
timing. Parity defaults to machine-appropriate concurrency (four here) and
rejects invalid worker counts or empty selections.

**Validation:** 63/63 compiler track/work cells and 33/33 judge tracks exact;
61,115 frame states and 305,336 ordered collisions match the independent
engine. Cache edits, sibling switches, resets and detachments also match
published JavaScript physics. Ten Rust tests pass; TypeScript has zero errors,
and reachability has zero unreachable files. The full suite has 335 passing
tests and one missing-audio failure, reproduced on untouched HEAD
(`productions/amor_na_praia_46s/audio.mp3` is absent on this host).

Evidence, including rejected trials and raw samples:
`docs/research/engine-performance-20261103.json`.

## October 31: geometry use in the bench report (tooling)

Report-only; no compiler, spec or ruler change, parity identical. Every new
cell records compact geometry facts from the plan and the realization, and
the stratified report gains section 4, Geometry: shares of ride time and of
sections by family × guidance, transfer vs paired, distinct families per
ride, short sections (under the shaped `minFrames`) by planned family, and
on complete cells fulfilled sections, guides never touched and shaped turns
realized. It is descriptive: variety is part of the owner's taste, not a
target. The evaluator identity changes; old runs load and say "not recorded"
(the facts are compiler output; remeasure cannot recover them).
- **Not recorded:** whether short-shape fitting changed a section. The plan
  keeps only the fitted family, and a guided-arcs draw looks the same. It
  needs a compiler-side field (the drawn family on the request); until then
  the report shows short shaped and short guided-arcs sections.
- **First look,** on recompiles of the minFrames pair (both arms reproduce
  `bench-minframes-20261031` and `bench-base-rm-20261031` track for track):
  the rule moves 0.19 sections per ride (mean over strata; all in P1, P2 and
  P4) from short shaped to short guided arcs; family shares move by at most
  0.3 points; every complete ride realizes every section, touches every guide
  and realizes its shaped turns.

## November 1: construction policies retrained on today's compiler (adopted)

**Why:** the owner suggested recalibrating the compiler's learned parts,
which were all fitted on October compilers, before judging any of them.
- Removing the learned future estimate cost −2.7 (it carries information).
- Retraining it did not help (−4.8; −2.1 at a level-matched weight). The
  October value model stays.
- The construction policies were the stale part.

**Data:** `tools/research/value_collect.ts`, run from a worktree frozen at
fc9a428a, at the standard allowance. It covers the benchmark/v4 training
cases without the four evaluation songs (168 records) and V6 transfer-layout
plans on non-evaluation music (30 records); no held-out song appears.
`train_construction_v3.py` gives 17,077 demonstrations. The artifact
replaces `repertoire_policy_model_v3.json(.gz)`; provenance is in its
pointer.

**Results** (no ride lost; physics frames unchanged):

| panel | change | interval / support |
|---|---|---|
| V7, 8 seeds | **+15.5** | [+12.4, +18.6], every block positive; 21 of 22 specs up, every category up |
| held out | **+10.5** | [+9.2, +11.8], > 0.99; 4 of 5 specs up |
| explicit requests | +12.3 | |

- Strong-ask bias +0.007, very strong +0.007.
- Air rms −0.003, speed rms −0.005.
- Head-down or backward strong arrivals −1.1 points.
- **Costs:**
  - body drag +0.66 s/min (about a third more; reported, per the owner an
    eye-only proxy for roof and control-rail use);
  - strong extra hits +0.018 per beat.
- No test needed re-deriving.

Parity references were refreshed.

## November 1: the heading prior keeps full weight in ranking (adopted)

**Found** (studies agent, `docs/research/compiler-ideas-20261101.md`): the
half-weight adoption cost Amour bench-long 8.8 points.
- Extra hits inside long floats doubled.
- More soft catches that open a float were reached steeper than 45°, where
  the heading prior starts charging.
- That prior prices a cost two catches ahead, which the one-interval probes
  behind the half-weight calibration did not see.

**Change:** each candidate records its heading-prior cost. `valueRank`
counts it fully and the other arrival priors at ½ (`arc_evaluate.ts`,
`arc_candidates.ts`).

**Results** (no ride lost; compute unchanged):

| panel | change | interval / support |
|---|---|---|
| V7, 8 seeds | +0.9 | [−1.1, +3.0], 0.85; Amour bench-long +9.1, other categories within ±2.4 |
| held out | **+4.7** | [+2.8, +6.6], > 0.99; 4 of 5 specs up |

- Strength rulers unchanged; body drag −0.05 s/min.
- No test needed re-deriving.

Parity references were refreshed.

## November 1: ranking counts the arrival priors at half weight (adopted)

**Found** (`docs/research/compiler-ideas-20261101.md`):
- **At strong catches, the search usually had a catch nearer the ask** (73%
  of pools) but kept a weaker one. About half of the kept candidate's rank
  came from the arrival priors, which steer toward a good next arrival.
- **Same-state probes measured the real cost** to the next interval of
  keeping the alternative. It was about 0.45 of what ranking charged (0.042
  against 0.093; 0.024 against 0.053). All 16 probed compiles were identical
  to the saved rides.

**Change:** in `valueRank` (`arc_candidates.ts`; prefix choice and beam
ranking), the arrival-prior part of a candidate's cost counts ½. Local search
keeps the priors in full, so proposals are steered as before. It calibrates
an estimate to what it was measured to estimate.

**Results** (no ride lost; compute and variety unchanged):

| panel | change | interval / support |
|---|---|---|
| V7, 8 seeds | **+7.2** | [+3.4, +10.9], every block positive |
| held out | +8.1 | [−1.7, +18.0], 0.96; all 5 specs up |
| explicit requests | +10.6 | |

- 19 of 22 V7 specs improve. Amour bench-long (P6) is −8.8.
- **Strength error² by ask:**
  - under 0.4: −4%;
  - 0.4–0.6: −21%;
  - 0.6–0.8: −11%;
  - 0.8+: −3%.
- **Other rulers:**
  - head-down or backward strong arrivals −1.3 points;
  - strong extras and contested beats fewer;
  - air and speed rms slightly better.
- Body drag +0.22 s/min (reported; per the owner, an eye-only proxy for
  roof and control-rail use).

**Tests re-derived:**
- Two budget scenarios get new allowances: 2100 (was 3500) and 2400 (was
  2600).
- The repair-sync test uses 0.8 asks: the coarse first search now gets the
  0.4 asks right, so nothing would exercise repairs.

Parity references were refreshed.

## November 1: catches placed mid-frame (adopted)

**Found** (`docs/research/compiler-ideas-20261101.md`): the catch line was
anchored at the rider points' positions at the beat frame's first collision
pass. Crossings therefore fell near the frame's start (median −0.4 frame from
its middle, in every offset and incidence group). 15% of hits, and 21% of
strong ones, tipped into the frame before, and those early hits were also the
weak ones.

**Change:** each point is placed half a frame of its own motion later
(`catchReceivers` in `arc_interval_state.ts`), so the line is crossed
mid-frame. It is a law of motion, not a fitted number.

**Results** (no ride lost anywhere; compute and variety unchanged):

| panel | change | interval / support |
|---|---|---|
| V7, 8 seeds | **+15.5** | [+11.8, +19.3], every block positive |
| V7, half the allowance | +15.0 | [+10.8, +19.1] |
| held out | +12.7 | all 5 specs up, `voice-drums` +9.6 |
| explicit requests | +10.5 | |

- All 22 V7 specs improve.
- Early hits fall from 15.3% to 4.4% (strong: 20.9% → 6.3%), and late hits
  do not rise (4.0% → 4.1%).
- Strong-ask bias improves, and body drag is lower.

**Tests re-derived:**
- Four scenarios had budgets or a seed tuned to the old construction's exact
  frame use; they get new values with comments, asserting the same things.
- The sync test now uses the shared placement function instead of its own
  copy.
- The scattered-incumbent fixtures are regenerated by a committed script.
  One assertion is generalised: at the ceiling the search returns the best
  already-validated realization, since the carriers can now realize. Its
  fresh-fragment check runs on Tiki only, because Luna's carriers now fail
  before reaching fragments.

Parity references were refreshed.

## November 1: target jitter removed (adopted)

**Found:** every Amour spec omitted `jitter`, so the compiler applied the
legacy default (σ 0.05). It perturbed each gap's air and speed targets at
random and aimed at them, while the scorer measures the authored targets.

**Change:**
- the compiler reads targets exactly (behavioural);
- then the feature was removed entirely: `Spec.jitter`, `CALIB.SIGMA`,
  `sampleGapTargets`, and the `jitter: 0` lines (structural, byte-identical,
  compile and judge parity pass). The range clamp stays.

**Result** (V7, 4 seeds): +7.2, interval [+4.5, +10.0], support > 0.99.
- Only the 8 Amour specs moved (up to +84 on a ride); the rest are
  identical.
- Air error is −0.004, speed −0.002, and no ride was lost.
- The held-out songs already used 0, so they are unchanged.

Specifications carry no randomness now. The search is deterministic, and a
seed reaches the compiler only through the plan
(`docs/research/compiler-ideas-20261101.md`).

## November 1: the steep-arrival threshold becomes a smooth step (adopted, first V7 decision)

**Why:** a hard switch at ask 0.6 turned four preferences on at once; on V7,
removing the mechanism cost −6.1 (Amour), so it is needed, but its cliff was
worth questioning.

**Change:**
- Structural, byte-identical: the switch becomes a weight.
- Behavioural: the weight rises smoothly from ask 0.4 to 0.8, centred on the
  old threshold.

**Results** (`npm run compare`, against `main`, every ride finished):

| panel | headline |
|---|---|
| V7 | +0.2 |
| V7 confirmation seeds | +3.8 |
| held-out songs | +4.7 |

- Body drag is lower.
- Disclosed: the long ride (P6), one spec, is −7.8 and −4.3.
- A linear law (weight = ask) was −0.9 and is not adopted.
- Details: `docs/research/v7-rejudge-20261101.md`.

**Correction after the tooling review.** With seed-block uncertainty over
8 seeds, the change is +2.0, interval [−1.9, +5.9], directional support 0.87.
It leans positive but is not established. The adoption rests on the smooth
law, no lost rides and lower drag, not on a demonstrated headline gain.

## November 1 (overnight): studies and ablations (nothing adopted)

Full log: `docs/research/overnight-20261101.md`. Each hypothesis was stated
before its run. Bench headline against the adopted HEAD, every ride complete
in every arm.

| arm | bench | other panels | verdict |
|---|---|---|---|
| A1: no future-value model | −10.2 | — | kept: the model earns its place |
| R0: no ending refinement | −0.18 | confirm −0.21, pairs8 −0.32, held out −0.07, sealed −3.8 (one ride: 532 → 466) | proposed for deletion, owner's call (`exp/no-tail-refinement`: −330 lines, ~5% faster) |
| G0: no passive-arrival gate | −1.4 | — | kept (P2 −7, P6 −14, more drag) |
| S1: steep arrival law at every catch | −12.5 | — | kept the 0.6 threshold (lower in every stratum) |
| uncapped per-section effort | 1×: −2.4, 2×: +7.8 | — | not adopted; design question (scale-free law) |

Studies (report only):
- **Stray hits:** about half are the body brushing a guide, half the
  shape's own steps. The rate is 0.4 per minute in plain arcs and 2.6–7.9 in
  shaped sections. The search already pays for them.
- **Headline loss:** impact strength 35%, air 24%, speed 19%, one-frame
  timing 16%, extras 7%. Strong asks undershoot (−0.07 even with ≥ 1 s of
  room; −0.22 for asks ≥ 0.8 after 10–19 frames).
- **Allowance:** ¼× 644, ½× 707, ¾× 727, 1× 739, 2× 739.
- **Compile time:** physics is 44% of CPU. The engine fork (`add_lines`)
  takes 24%, the largest single speed lever.
- **The sealed long ride's overnight drop** is one seed with a runaway
  ending (last-gap speed 1.29 against 0.32). Bad endings are 1 in 148 rides.

## November 1 (overnight): guides offered, never required (adopted)

**Why:** with no plan (plain unguided arcs everywhere), the headline was 753
against 717, with fewer stray hits and less body drag, but no variety. Shapes
*without* guides scored 686: the guide does real work for shapes. The forced
touch ("guide required") was the costly part. Graded shape fulfilment gained
only +4.4, so the cost of variety was not search waste.

**Hypothesis** (stated before the run): offering a guide instead of requiring
it keeps the shapes, removes forced touches, raises the headline and lowers
stray hits, at equal completion.

**Change:** the automatic planner's guided families ask for `optional`
guidance, and no transfer layout is drawn. Explicit plans keep `required` and
`transfer`.

**Results:** completion is equal everywhere, with no ride lost. Changes are
against the previous HEAD (section fallback).

| panel | headline | strong extras / beat | v3 loss |
|---|---|---|---|
| bench (experiment, same draws) | +25.6 | −0.032 | −0.003 |
| bench (clean version) | +22.4 | −0.023 | −0.003 |
| pairs8 | +23.1 | −0.022 | −0.003 |
| confirm | +17.3 | −0.027 | −0.002 |
| sealed | +26.7 | −0.029 | −0.002 |
| held out | +22.7 | −0.041 | −0.003 |

- **Air and speed:** equal or better on every panel.
- **Body drag:** mixed and small, from −0.2 to +0.17 s/min.
- **Guide use:** 78% of the sections that offer a guide touch it (folds 92%,
  plain arcs 59%). The rest are untouched clutter, for G1 to trim.
- **Disclosed:**
  - transfer receivers are gone from automatic rides; the owner liked them
    "with variety, not everywhere", and they caused most U2 bumps;
  - distinct families per ride are 5.65 against 5.93 (the random draws
    changed with the transfer draw removed).

**Gates:**
- tests, typecheck and reach pass; three tests updated to the new rule;
- judge parity passes;
- parity: 22 cells differ, as expected (every automatic cell with a guided
  section); references refreshed.

## November 1 (overnight): the 9-frame rule replaced by a section fallback (adopted)

**Hypothesis** (stated before the run): completion equals the 9-frame rule on
every stratum with no threshold; geometry and quality stay within noise; on
specs without short sections the tracks are identical.

**Change:** a shaped section that offers no viable candidate is asked for plain
arcs, keeping its guidance and rail layout, before backtracking. `minFrames`
and `fitShapesToSections` are deleted, and the plan is rewritten to the
realized requests. The planner again reproduces V6's frozen plans exactly.

**Results against the rule** (headline, completion):

| panel | headline | completion | lost |
|---|---|---|---|
| bench | +0.4 | 41/41 = 41/41 | 0 |
| bench-pairs8 | +3.6 | 32/32 = 32/32 | 0 |
| bench-confirm | +2.2 | 41/41 = 41/41 | 0 |
| sealed | −4.1 | 18/18 = 18/18 | 0 |
| held out | +44.0 | 16/16 vs 15/16 | 0 |

- **Held out:** X finishes the one Circus ride the rule still failed (seed
  303); it was not targeted.
- **Sealed:** the −4.1 comes from rides where the search now *keeps* a shape
  squeezed into a 7–8-frame section where it was feasible (serpentine 8, fold 8,
  scallops 7), at a cost of 10–28 points on those rides. The rule always
  replaced such shapes. Whether a 0.2 s shape is worth it is a question for
  the owner's eye.
- **Other rulers:** within noise. On bench P1, inverted strong arrivals are
  +0.08 (6 cells) and body drag is lower.

**Gates:**
- tests, typecheck and reach pass, and judge parity passes;
- parity: 5 of 63 cells differ. The V6 case the rule had changed returns to
  its original track (its fold was feasible). Four cells differ at the 150k
  allowance, where dead ends are frequent. References are refreshed in this
  commit.

## October 31: quick re-landings fixed by fitting shapes to section length (adopted)

**Hypothesis** (stated before the runs): quick-pair and voice-word completion
rises, with no completion loss elsewhere; quality on both-complete cells stays
within noise under every ruler; the shaped share drops only in sections under 9
frames.

**Change:** each shaped family (fold, serpentine, scallops, terraces) has a
measured `minFrames: 9`. A shorter section gets plain arcs with the same
guidance and rail layout, and its phrase is split around it. The plan's draws
are unchanged.
- **Probe on Luna:** 8-frame quick pairs failed for every shaped family; 9
  frames passed 150 of 150 for each; guided arcs passed every 8-frame section.
- **Why guided arcs:** the guide requirement itself was never the problem, so
  the guided shapes the owner likes are kept.

**Results:** completion, baseline → candidate; no ride lost anywhere.

| panel | before | after |
|---|---|---|
| bench | 38/41 | 41/41 |
| bench-pairs8 | 27/32 | 32/32 |
| bench-confirm | 40/41 | 41/41 |
| sealed | 18/18 | 18/18 |
| held out, at the decision point | 5/16 | 15/16 |

Held out, in detail: Trouble 1/4 → 4/4, Circus pairs3 0/4 → 3/4, Circus pairs4
0/4 → 4/4, Valhalla 4/4 → 4/4. The one failure left is Circus pairs3 seed 303
at 69.7 s.

**Quality** on cells complete in both arms:
- identical tracks where no section is under 9 frames (G, P3, P5, P6);
- within noise on P1 and P2, mostly slight gains: v3 window loss −0.002/−0.001,
  strong extra hits −0.025 on P1.

**Gates:**
- parity: 1 of 63 cells differs, the V6 automatic case whose 8-frame fold
  became arcs (references refreshed in their own commit);
- judge parity passes;
- the V6 test now states the one intended difference from V6's frozen plans
  (7 of 756 plans);
- tests, typecheck and reach pass.

## October 31: the new benchmark and its first baseline

**What was built:**
- **Tooling:** stratified panels, docs/research/benchmark-audit-20261031.md.
- **Panel songs:** each now has a measured `music.ts`, plus the full 108.5 s
  Amour for P6.
- **Bench specs:** 11 dev specs, all variants: P1 Amour/Tiki, P2 Tiki/Amour,
  P3 Tiki/Amor, P4 Amour/Luna, P5 Amor/Luna, P6 Amour 108 s.
- **Sealed siblings:** P1 Luna, P2 Luna, P3 Luna, P4 Amour 44 s (Amor has no
  dense section, so this sibling shares a recording with its dev spec), P5
  Tiki, P6 Amour 108 s.

**Baseline at edd318fa:**
- **`bench-base-20261031`:** 41 cells in 249 s.
  - Completion: G 8/8, P1 5/6, P2 5/6, P3 6/6, P4 5/6, P5 6/6, P6 3/3.
- **`pairs8-base-20261031`:** 32 cells in 179 s.
  - P1: Amour 5/8, Tiki 8/8.
  - P2: Amour 6/8, Tiki 8/8.
- **The three failures, recompiled with `produce`:** each stops at an 8-frame
  section with a guide-required family.
  - Amour pairs 202: fold, budget, 193 backtracks.
  - Amour words 101: scallops, no_arc.
  - Luna intense 303: scallops, budget, 98 backtracks.

  This is the step-back's finding, on panel material.

## October 31: what comes next (owner decision)

The spec work is closed out for now:
- Trouble prefers `contrast-clusters`.
- Valhalla prefers `words3` (production ready).
- Circus Minimus prefers `pairs3`; `pairs4` is the intended spec the compiler
  cannot yet realize.

Next, agreed with the owner:
1. **Compiler step back (Claude):** one map of every open compiler thread, with
   evidence, plus an investigation of why quick re-landings at speed fail. The
   result is a ranked proposal, with no code before the owner chooses.
2. **Benchmark audit (agent, read-only):** what the current benchmark contains,
   rewards and misses; what to keep, change, add or remove.
3. **Held out:** Trouble, Valhalla and Circus Minimus stay held out from all
   compiler decisions; they are the test of whether compiler changes help real
   authored specs. The benchmark gets new dev specs on the four panel songs that
   stress the same kinds of patterns (short audible pairs, voice-led stretches,
   intense sections), with weight set through how many specs stress each pattern.
   Use the categories only, never the held-out specs' exact parameters.

## October 31: stratified benchmark tooling

Tooling only (`tools/eval`); no compiler, spec or ruler change, parity
identical. It implements the evaluation side of the benchmark audit; the bench
specs themselves are written separately.
- **Panels.** `bench` (G: the four `spec.ts` × 2 seeds; every
  `productions/*/variants/bench-*.ts` × 3), `bench-confirm` (fresh seeds),
  `bench-pairs8` (P1 and P2 × 8 seeds), `sealed` (only with `--sealed`) and
  `heldout` (Trouble, Valhalla, Circus `spec.ts` and Circus `pairs4` × 4
  seeds; only with `--heldout`, at decision points). `dev` and `confirm` are
  unchanged. Specs are discovered from file names; each declares
  `bench = {stratum, pattern, windows}`.
- **Report.** Completion first per stratum (recovered and lost cells, failure
  time and beats reached), then quality on both-complete cells under every
  ruler, plus v3 loss parts and the v3 account inside each spec's windows.
  Per-spec seed sign counts; strata weigh equally; no intervals and no
  headline number.
- **Cells** now also store the replay terminus, the v3 timing part, per-beat
  timing error and the unrequested v3 events. The evaluator identity changes;
  old runs still load and report.

## October 31: geometry hygiene (diagnosis)

TODO item 7. Report only; no compiler, measure or ruler change
(docs/research/geometry-hygiene-20261031.md, evidence in the JSON beside it;
tools in `tools/measure/geometry_hygiene/`, outside the evaluation
fingerprint). 24 fresh rides at a7d680f1 (four songs, seeds 7101–7106), all
valid; Trouble as held-out examples only.
- **Pass-throughs.** 22 crossings per ride, mostly 1–2 px contact dips. A line
  drawn through the rider 3 px or more deep: 2.8 per ride, 1–8 frames.
  - The visible kind is the rider flying through the next section's lead-in
    from behind just before the beat, in 40 of 119 fold sections. The fold
    proposal rotates the lead-in by the turn (`arc_proposals.ts` 60–62).
  - A second kind: falling into a channel through a guide's leading end, in
    36 of 745 paired guided sections.
  - The crossed segments are never touched (154 of 156). Removing them leaves
    the ride byte-identical (179 of 179 replays).
- **Untouched geometry.** 62% of the drawn length is never touched, about
  6,000 px per ride. Removing it never changes a ride (24 of 24).
  - The judge's role inference and the shape checks read it: removing chain
    ends only fails 12 sections per ride.
  - 28% of guide chains are touched only by the body.
  - `contactSummary` counts sub-pixel fragments as guides, so the Trouble
    "681 of 1,137" is 150 of 606 for real guide rails.
- **Next, owner.** Watch the collection
  (`/generated/geometry-hygiene-20261031/collection.json`) and discuss G1–G7.
  No geometry change before that.

## October 31: review-page camera no longer lurches in spins

Review page only (docs/research/camera-20261031.md). The page centred on PEG,
a sled point that circles the body in a spin (camera speed +17% / −14% against
the body centre). It now uses the videos' follower (mirror module 560) on the
ten-point body centre: +3–5% / −2% in the same spins, with no spin-induced part.
- **Videos and clips** have a third of the artifact: their follower tracks a
  six-point body mean (+3–5% / −4–5%). The video path is not changed; the
  one-function fix is described in the report. (Later the same day, with the
  owner's go-ahead, the exporter was changed too: `mirror/helper.js`.)

## October 31: impact visibility study built (unanswered)

Pre-registration only; no tool, measure or compiler change used by the product.
- **Study `impact-visibility-2026-11`** (docs/research/impact-visibility-study-20261031.md):
  55 pairs, about 17–21 minutes, from 76 of the 96 unexamined held-out rides
  (seeds 9101–9124), chosen from measured values only (seed 20261031).
  - Block A (34): unrequested extras (0.05–0.10, 0.10–0.20, 0.20–0.35), launch
    pushes and in-contact pushes after quiet touchdowns, 4 anchors, each against
    a lit blank.
  - Block R (21): clean, upright requested hits at v3 ratios 1.25, 1.5, 2 (and 3
    at base 0.25), bases about 0.25 and 0.5. Information, not a case for
    flattening requested strengths.
- **Rules fixed before answers:** 5 of 6 seen = visible, 1 of 6 = not visible
  (block A), 2 of 6 = not visible (block R); void if an anchor is missed, block A
  void if blanks are picked more than twice.
- **Changed from the step-back plan:** blanks with nothing within ±8 frames
  exist in 4 of 96 rides, so the blank window is the lit span ±1 frame (0.05
  ceiling kept), and blanks come from the same song rather than the same ride.
- **Next, owner:** answer it. No measure or compiler change before.

## October 31: the impact measure (U1 stopped, step back)

Reports only; no tool, measure or compiler change merged.
- **U1 candidate stopped** (docs/research/u1-measure-study-20261031.md). v3
  with both detector fixes gets 45 of 63 decisive owner pairs against v3's 47;
  on the 4 pairs it re-ranks, his answers side with v3 (2 decisive, 1 same,
  1 neither). Its values there equal the old "strength" candidate he had
  already ruled against. The candidate code stays on branch
  `worktree-agent-a1f12a7790eda8a3d` (a804bc08); 96 held-out rides (seeds
  9101–9124) are compiled, unexamined, in that worktree.
- **Step back** (docs/research/measure-step-back-20261031.md). Validated:
  ordering of clearly different hits only. Not validated: scale, timing,
  extras, and what counts as the hit of a quiet beat (two October clips: v3
  matched a near-invisible touch; he saw one "late" hit 200–275 ms later).
  The October labels are now spent as test data.
- **Night study answered** (result in the step-back report). On 16 random
  strong beats he answered "same" 10 times, including pairs v3 rates 1.5–1.9×
  apart; v3 got 3 of 6 decisive. On 6 head-down vs upright pairs v3 got 6 of 6.
  Strength differences among ordinary strong hits are mostly not visible to
  him in isolation.
- **Next, owner:** the visibility study (extras, late pushes), now with a
  strength-resolution block. No measure or compiler change before fresh answers.

## October 30 follow-up: unwanted impacts (diagnosis)

TODO item 3. Report only, with no compiler, measure or ruler change
(docs/research/unwanted-impacts-20261030.md, evidence in the JSON beside it).
It covers the 48 dev and confirm panel rides, with Trouble as held-out
examples only.

- **Counted extras are real but mostly weak.** On authored rides there are
  7.8 per ride of strength 0.1 or more (median 0.05, max 0.33). They are 12%
  of the v3 loss.
  - The cost is carried by the shoulder or hands hitting an upper guide or
    receiving rail. That is 69% of the extra cost, and 71% of these come
    within 12 frames after a strong hit.
  - Long floats and seams are minor on the panel.
  - The Trouble slam "float" at 3.85 s is a guide-required terraces section.
    The shoulder grazes the guide, then the sled re-lands (0.38).
- **The account misses bigger pushes.** About 3 force maxima per ride lie in
  no event's frames (median about 0.3–0.37, up to 0.95). That is 155 of 0.2
  or more, against 48 counted. Two of the causes are detector defects:
  - a renewal whose 6-frame window ends before its own peak (6 panel cases,
    9 on Trouble);
  - a gentle touchdown followed by a hard turn with no valley, which can never
    form an event (86 cases, mostly after quiet beats).
- **The search exploits that window.** 55% of quiet catches meet an uncounted
  turn of 0.2 or more in the same contact. Its timing is 6–9 frames after
  contact (173 cases) and almost never 2–5 (8 cases).
- **Transfer layouts force extras.** They are 9% of sections but carry 48% of
  the extra cost. 324 of 332 touch their receiver only through unmatched
  events, because fulfilment requires a separated second contact.
- **Next.** U1–U5 are hypotheses. The measure fix (U1) comes first and needs
  owner pairs before it may become an objective.

Independent check before merging (2026-10-30). Simulating the four review
rides and taking the raw whole-body impulse over every 2-frame window,
independent of where the detector places events:
- requested strong hits (≥ 0.7) match v3 (medians 0.67–0.77 both ways), so
  the check is calibrated;
- amour 303 at 1.625 s: a raw 0.80 push with no requested beat within 0.3 s;
- tiki 101, quiet beat at 42.73 (asked 0.03, v3 0.04): raw 0.50 five frames
  later. Luna 404: quiet beats are followed 4–7 frames later by raw pushes of
  0.20–0.39 (1.5, 2.1, 3.4 s). On these two rides the raw peak after a
  quiet beat falls 4–6 frames after it in 17 of 23 cases;
- Trouble slam 101, 3.85 s: inside a terraces section with guide lines (frames
  141–231), as the report says.

## October 30 follow-up: cheaper candidate geometry

Structural (TODO item 1). After the crashed-candidate stop, physics stepping is
a minor part of a candidate. Profiles of the four songs (seed 3001) and the
93-second long case attributed each candidate's main-thread CPU to its parts
(innermost enclosing function):

| part | songs, before | songs, after | long, before | long, after |
|---|---|---|---|---|
| line registration and undo (native addLine) | 19–21% | 18–21% | 29% | 31% |
| construction inspection | 7–9% | 5–6% | 20% | 8% |
| geometry construction (motionArc) | 10–11% | 7–8% | 8% | 6% |
| physics stepping | 12–13% | 14% | 14% | 19% |
| objective, impact checks, detection | 25–30% | 29–33% | 11% | 16% |
| garbage collection | 7–8% | 8–9% | 11% | 13% |

Shares are of a smaller total afterwards; in seconds, physics is unchanged and
the other parts shrank. Registration in the long case went from 90 to 71 s of
sampled main-thread time, inspection from 63 to 17 s, motionArc from 26 to 13 s.

Four commits, each with identical tracks, frame counts and scores:

1. **Contacted guides only.** Construction inspection attributed every guide
   line (up to about 2,000) to its nearest main-rail segment, but only
   contacted lines are ever read. The long case spent 19% of its main thread
   there. The report fields, shared with the judge, are unchanged.
2. **motionArc helpers at module scope.** Two arrows defined inside the step
   loop cost a closure and, under tsx, an `Object.defineProperty` (`__name`)
   per step: about 3% of a song compile.
3. **Binary search in grid buckets.** Pays only in the long case.
4. **One native version per addLine batch.** Lines crossed the ABI one at a
   time and each became its own version node. A batch is now one version with
   the same `_addLine` sequence; reconciliation undoes and redoes its lines in
   the same order.

Paired process CPU, three pairs per case, every pair identical (medians):

| change | luna | amor | tiki | amour | long |
|---|---|---|---|---|---|
| 1. contacted guides | 0.978 | 0.974 | 0.974 | 0.967 | 0.867 |
| 2. motionArc helpers | 0.956 | 0.974 | 0.979 | 0.972 | 0.963 |
| 3. bucket search | 1.006 | 0.990 | 1.003 | 0.989 | 0.974 |
| 4. batch versions | 0.973 | 0.949 | 0.963 | 0.962 | 0.926 |
| all four, against 458fe8af | 0.917 | 0.906 | 0.925 | 0.889 | 0.731 |

The long case went from 287 to 210 s of process CPU (median of the combined
pairs). Peak RSS rose with change 4: songs by up to 60 MiB in most pairs, the
long case by about 140–250 MiB of 2.1 GiB. The cause is not established.

Gates at the series head: parity 63/63 identical, judge parity 33/33, 284
tests, 9 native tests (one new: bucket search against the old scans under
random churn), typecheck 0, reach 0, engine trace identical.

Dropped: storing each grid entry's line id beside it (pairs 0.99–1.02). The
profile with separated native functions had suggested pointer-chasing in the
bucket search; the timing did not confirm it.

What remains: registration is still the largest part. Most of it is the nine
center-cell buckets each line enters and leaves, the history lookup per cell,
and small allocations. Lazily materializing a center bucket only when the
rider reaches it could avoid registering lines the rider never approaches,
but invalidation must then reproduce the same truncations; it is a larger
engine change and was not attempted.

Behavioural opportunities noticed, not taken:

- Facet density, as on October 29: long sections are built from 1–4 px
  facets, so registration and undo scale with facet count. Coarser facets
  would change geometry.
- If CPU should be the budget, registration could be charged per line, as the
  binding-stop ruling noted; a crashed candidate still pays it in full.

Evidence: `docs/research/geometry-cpu-20261030.json` (all pairs with hashes,
frames, CPU and peak RSS; both profile breakdowns).


Review before merging (2026-10-30):
- Changes 1–3 checked by reading: change 1 attributes only the guides a
  report reads, and each guide's attribution is independent of the others;
  change 2 is the same arithmetic; change 3 keeps every bucket in the order
  the binary search assumes, and every write goes through the two functions.
- Change 4: the old loop never exposed versions inside a batch, undo and redo
  keep the per-line order, and Rust makes every match on the patch type
  handle the batch.
- Memory: the native engine's memory is lower after change 4 (luna 158 → 153
  MiB, amour 180 → 168 MiB), and the live JS heap after forced GC is the same
  (about 40 MiB). The higher peak RSS is garbage-collection timing, not
  retained memory.
- Independent CPU check, fresh seed 777, concurrent pairs against 458fe8af:
  luna 0.905, amor 0.920, tiki 0.897, amour 0.915, with identical charged and
  simulated frames.
- Owner ruling: the three noted opportunities (lazy collision grid, coarser
  facets, charging geometry to the allowance) are not taken. Keep the code
  lean; this was groundwork, not the focus.

## October 30 follow-up: stopping crashed candidates early

The owner ruled to take the first behavioural observation of the long-ride CPU
follow-up. A candidate whose rider or sled came unbound was simulated to the
interval horizon before being rejected.

**Step 1, structural (f763b5e3).** An unbinding is permanent in the kernel. The
replay now steps frame by frame and stops at the first unbound frame. It is
still charged, and checked against the limit, as the full read was.

The stop waits until one of the candidate's own lines has been hit. The engine
shares one frame cache per lineage, and reading another version truncates it
to the first collision of the lines it removes. Stopping before such a hit
could leave a sibling to re-simulate frames that the full read would have
cached. The new native test shows this: the sibling's charge goes from 80 to
149 frames.

- Every gate passes: parity 63/63 identical, judge parity 33/33, tests,
  typecheck 0, reachability 0, engine trace identical.
- The 48 dev and confirm panel cases are also identical to the base, in track
  and frame count.
- Five instrumented rides: every crash had already hit the candidate's own
  lines, so all frames after the crash are skipped. That is 18.2% (luna),
  18.4% (amor), 17.0% (tiki), 25.3% (amour) and 13.0% (long case) of physical
  frames.
- Paired process CPU, six concurrent pairs per case, every pair identical:
  median ratios 0.997 (luna), 0.988 (amor), 0.989 (tiki), 0.972 (amour) and
  0.980 (long case). The saving is only 0.3–2.8%, far below the frame share.
  Physics stepping is a small part of a candidate's cost (16% of the long
  case's CPU). A crashed candidate still builds and registers its geometry
  and replays up to its crash, and the new loop reads every frame once.

**Step 2, behavioural (the commit after this record).** It charges only the
frames simulated and stops at the first unbound frame. It was evaluated as
14dd3f72, kept as branch `bstop-step2-evaluated`. The hypothesis and decision
rule were written before any step-2 run (in the evidence file):

- freed allowance buys more search;
- completion and v3 loss equal or better;
- no other ruler worse with its song interval excluding zero.

Results:

- Work, five rides: 9–14% more fresh candidate evaluations. The search now
  ends at 84–98% of its allowance (step 1: 99.7% or more), so the allowance
  stops binding and frames fall 2–16%.
- Panels, paired against step 1 (48 cases, song bootstrap):
  - completion 48/48 in both arms;
  - v3 impact loss, authored: −0.0004 on dev (−1.7%) and −0.0011 on
    confirm (−4.5%), with intervals that only just exclude zero;
  - v3 impact loss, perturbed: +0.0004 and −0.0001, null;
  - strong and very strong bias, speed, contested beats and body drag show
    no change outside their intervals; air improves on confirm perturbed
    (−0.004);
  - quiet bias (−0.007) and inverted strong arrivals (−1.9 pp) improve on
    dev authored only;
  - worse, with intervals excluding zero: R1 strong extra hits on dev
    authored (+0.010/beat) and R1 strong strength rms on confirm authored
    (+0.006). Each is one of four panel cells, with the opposite sign
    elsewhere.
- Catalog, the Oct 5 audit's 336 training-catalog compiles (equal group
  weight, 15 groups; quality on the 317 complete in both):
  - completion 318/336 in both; one case recovered and one lost, all
    failures budget, as on Oct 5;
  - v3 impact loss −0.0006 (−3.4%), lower in 14 of 15 groups;
  - air (−0.0013) and speed (−0.0018) rms also improve, with intervals
    excluding zero;
  - quiet bias, body drag and R1 extra hits lean worse, but their intervals
    include zero.
- Paired CPU against step 1, three pairs per case: median ratios 1.09
  (luna), 1.09 (amor), 1.07 (tiki), 1.11 (amour) and 1.17 (long case).
  Catalog: +6.6%. The extra evaluations cost more than the frames saved.
- Parity references are refreshed in that commit. The V6 sentinel cells are
  neutral (mean 883.5 → 883.8, 18/18 valid). Three scenario tests now use the
  nearest allowance that reproduces them under the new accounting.

Decision, by the rule stated in advance: step 2 does not qualify. Two R1
cells are worse with intervals excluding zero, and it costs 7–17% more CPU.
Recommend merging step 1 alone; its saving is small but free.

Step 2's v3 gain is small but consistent (two authored panels and 14 of 15
catalog groups). The owner may still prefer it, at the CPU cost, if that
search is worth buying. The catalog evidence came after the rule and is
training-catalog data, so it does not change the rule.

Evidence: `docs/research/binding-stop-20261030.json`. Branch
`worktree-agent-a011b559a887ffc0e`.

**Owner ruling (2026-10-30): take step 2.** Verification before merging:

- Accounting audit (every engine method wrapped; frames the native engines
  actually stepped, against frames charged): before the change and with step 2,
  charged − stepped is the same constant (3,560 on luna seed 101, the final
  replays outside the wrapped engine). Step 1 alone charged about 430,000
  frames it never simulated (luna, amour, tiki). Step 2 neither leaves frames
  unbilled nor bills frames not simulated.
- Why about 11% of the allowance stays unused: the expansion search spends
  about 86% instead of 97% of it. The whole-ride refinement then stops at its
  12-attempt cap under both accountings, accepting 0–3 of its 48 proposals
  (luna, tiki, amour). The rest is not search cut short.
- Matched-CPU comparison (dev and confirm panels, 48 compiles per arm, all
  three arms run at the same time; step 1 at ×1.00 reproduces the agent's
  step-1 tracks 48/48):

  | arm | complete | mean v3 loss | compile time | physics frames |
  |---|---|---|---|---|
  | step 1, allowance ×1.00 | 48/48 | 0.02278 | baseline | baseline |
  | step 1, allowance ×1.10 | 48/48 | −0.5% | +5.5% | +8.3% |
  | step 2, allowance ×1.00 | 48/48 | −2.0% | +6.3% | −11.0% |

  Paired by song, step 2 against step 1 ×1.10 is within noise on most
  rulers. v3 loss is better on confirm perturbed and worse on dev perturbed;
  quiet bias, strong bias and inverted arrivals are mixed. So step 2's search
  is at least as efficient per CPU second as more allowance, not a free gain.
  Its own merit is that the allowance now counts the physics actually done.
- Consequence: the allowance counts physics frames, but most of a candidate's
  CPU is building its geometry. A crashed candidate is now nearly free in
  frames while still costing that CPU. If CPU should be the budget, geometry
  work must be charged too; that would be a separate decision.

## October 30: spec variants, old toolchain removed

- Owner rulings: remove the May–June `beats/` consensus toolchain entirely
  (done; Amour's files moved into its production folder; parity and judge
  parity pass); generate several whole-spec variants of a song from one
  measured reading, with no fixed set and no versioning machinery; take the
  stop-after-crash opportunity (agent, two steps).
- `productions/<song>/music.ts` holds the measured layers; `variants/*.ts` are
  whole specs; `spec.ts` re-exports the preferred one. `produce --variant`,
  `coverage --variant`, and the dashboard lists variants. Dashboard notes now
  snap to measured events (they snapped to madmom's wrong grid) at 10 ms.
- Trouble rides (`generated/trouble-variants-v1`): kick, voice, slam, pulse.
  All complete except pulse seed 101 (budget, in the groove). 50.07 lands;
  0.21 s pickups land; a landing at 0.13 s cannot. v3 loss: kick
  0.010/0.013, voice 0.007/0.009, slam 0.018/0.008, pulse 0.022.

## October 29–30 follow-up: music authoring

Structural for the compiler (no compiler change). A first
draft of a new song, Trouble, was mostly wrong by the owner's ear. The single-mix
analyzer had detected every flagged event; the draft was authored grid-first
(half-time, out of phase with a 3-3-2 kick), read a near-zero sub-band as
"beatless", and used onset strength as loudness. New workflow
(docs/music-authoring.md):
- Demucs stems and ADTOF drum transcription (`tools/music`);
- an event list per instrument and close-up sheets;
- a coverage report relative to the spec's own choices;
- the spec dashboard restored read-only (`spec-dashboard/`,
  `scripts/gallery/spec_api.ts`), with an events lane and clicks at landings.

Trouble was re-authored event by event (draft v1). It is new music: keep it out
of compiler tuning. The review pages now verify artifacts over plain HTTP on a
LAN/VPN (`motion-gallery/sha256.js`); `crypto.subtle` exists only on localhost
or HTTPS.

## October 29 follow-up: long-ride compiler CPU

This was structural work to prepare for longer songs. The 93-second catalog case
(`stretch_supported_speed_change`, seed 101) cost 164 µs of CPU per physical
frame, against 29.5 µs for luna_bala_44s (seed 3001). Its first 40 contacts
(45 s) took 593 s of CPU, against 89 s for luna with about the same number of
physical frames (3.1M vs 3.0M).

Profiles and work counters located the cost outside the search and outside
physics stepping. Stepping was 3% of the long case.

- **Construction inspection, 59% of the long case.** Each guide segment was
  attributed to its nearest main-rail segment by scanning every segment.
  Long supported sections produce candidates with up to about 2,000 segments
  on each rail, which made 5.6 billion pairs in the first 40 contacts.
- **Prefix rescans, quadratic in ride length.** Every candidate re-detected
  the whole ride from frame 0. On luna this scanned 89M frames for 3M physical
  frames.
- **Whole-ride terminal objective.** It recomputed whole-ride gains and motion
  filters once per contact.
- **Line undo.** Undoing each candidate scanned the cached events once per
  removed line.

Five commits fix these with identical tracks, frame counts and scores:

1. Resumable prefix detection.
2. Single-pass terminal objective.
3. Bounding-box skipping.
4. A cell grid for guide attribution.
5. One-scan line undo in the compiler engine (`engine.wasm` rebuilt).

Every commit passes 63/63 parity cells, judge parity, tests, typecheck and
reachability. Paired process CPU, with both arms running concurrently:

- **Long case:** 1,045 → 269 s and 1,038 → 266 s (0.257 and 0.256), with peak
  RSS about 6–16% lower.
- **Four production songs at seed 3001, two pairs each:** medians 0.842, 0.850,
  0.806 and 0.840.
- **Per-frame cost:** 37–45 µs at every truncation of the long case, from
  6.8 s to 92.7 s. Before, it rose from 40 to 191 µs.

Rejected because measured effects were within noise:

- set membership for main-rail contacts;
- 16 px grid cells, whose gain appeared only in an offline microbenchmark.

Behavioural observations, not implemented:

- **Simulation after a crash.** Candidates rejected for a broken binding are
  simulated to the interval horizon. Frames after the rider or sled first came
  unbound are 18.2% of luna's physical frames and 13.0% of the long case's.
  Stopping at that frame would reject the same candidates, but it would change
  the allowance accounting and therefore the tracks. (October 30, above: the
  stop can keep the accounting unchanged, and it saves only 0.3–2.8% of CPU.)
- **Facet density.** Long supported sections build rails from facets with
  median lengths of 1.1–3.7 px (three captured inspections). Their line
  registration remains about a quarter of the long case's CPU. Coarser facets
  would change geometry.

Evidence: `docs/research/speed-20261029.json`, with 65 paired records (hashes,
frames, CPU, peak RSS), both length-scaling batches, counts and profile shares.
Branch `worktree-agent-a9af6a2373848b41e`.

## October 29 follow-up: geometry-family registry

Structural. A geometry family is now one row of `geometry_families.ts`: its
review-page label, its fixed profile settings and, for a shaped family, its
tangent schedule. The planner's family list and default repertoire, the
section styles, the motion profiles and the review page's choices all read
that table.

Before, a new family had to touch at least four files: the profile schedule,
the planner's list and section style, the review-page labels, and a test that
counted six families. Two gallery recipe modules and the documentation needed
edits to stay consistent. Extending the value model's six-family features
was an undocumented trap: it breaks the model's 73-feature contract.

A toy family added only as a table row plans, builds, compiles valid and
passes its realization check (`tests/geometry_families.test.ts`). Adding a
real row is still a behavioural change: ARCHITECTURE.md lists what it changes
and which check fails on purpose. Parity cannot see it, because the automatic
cells pin the six-family repertoire.

Dead code removed:

- `motionArc`'s `flow` and `wave` arguments;
- rail contours and their gallery recipes;
- the retired composition documents (`repertoire_plan.ts`, presets and
  request validation) and the gallery recipe table they used.

Validation, at each of the three commits:

- compile parity 63/63 identical, judge parity 33/33;
- all tests pass;
- typecheck 0 errors, reachability 0 unreachable.

An equivalence digest also matches the previous commit over a grid of inputs.
It covers plans (including the default repertoire, which parity does not
reach), section styles with key order, profile headings (bit-exact), profile
validation and built geometry.

Looking a heading up in the table costs about 20–30 ns more per shaped step
than the old `switch`. One V6-budget automatic compile makes 1.09M such calls
in 79 s, so the cost is at most about 0.04%.

## October 28 follow-up: reuse candidate span measurements

Structural compiler work while the next behavioral direction is being considered.
Candidate scoring previously measured air, speed and amplitude twice on the same
trajectory window. It now reuses the reported axes and separately recovers raw
amplitude only when a targeted amplitude reaches the reporting cap. The reported
values remain capped; search residual arithmetic and physics accounting are
unchanged. The regression check covers capped and uncapped spans, untargeted
amplitude, immutable reported measurements and exclusion of survival grace.

An isolated span-scoring microbenchmark (20,000 measurements, five warmed pairs)
went from a median 80.5 ms to 56.5 ms with identical sums. This measures only that
scoring operation, not end-to-end compilation speed.

Validation: all 63 compiler parity cells preserve tracks, physics-work counts
and scores exactly; 33 judge tracks and all 280 tests pass. Typecheck and
reachability pass with zero unreachable files. No reference updates.

Branch `rework/foundations`, from `7e2a3dfb`. Everything before the rework is
preserved at tag `archive/pre-rework-2026-10-03` (code, docs, evidence, tests,
models). Deleting something from this branch never loses it.

## Why

The October 3 audit (memory note `codex-era-audit-2026-10-03`) found:

- **Measurement is misaligned with the goal.** Frozen V6 rewards accumulated
  landing impact inside a 150 ms window. It is inversely related to measured
  hit clarity (July tracks 514 / clarity 6.5; current 822 / 2.6). The
  experimental `line.contact-impact.v1` fixes event identity but keeps the
  strength kernel, times hits at onset rather than peak, and has a renewal
  blind spot the compiler already exploits. Its headline gains are self-graded.
- **Evaluation is weaker than it looks.** Seeds mostly reproduce identical
  tracks, every V6 input is a training input, the reserved panel is a sibling,
  the V2 sequential test cannot reject, V6 gains were ~87% completion.
- **The compiler is a monolith.** Key facts:
  - `compileArcMotionOnce` is 1,242 lines and `ArcMotionOptions` has 134 fields.
  - The budget caps were tuned to V4 and saturate.
  - The old search compiler is always loaded, and an unused 102 MB model is
    loaded too.
  - The frozen judge hashes 36 compiler files.
- **The repository is mostly dead weight.** 68% of the TypeScript is
  unreachable from production, `npm run verify` tests only the retired
  compiler, docs contradict each other, and there are 149 npm scripts.

## Principles for this rework

1. **One product.** The product is the automatic-arrangement compiler: music
   spec → seeded plan → normal-line geometry → native physics, plus the tools
   to author specs, review rides and render videos. Anything else is archived.
2. **Behaviour changes are separate from structure changes.**
   - Structural steps must leave tracks, frame counts and scores byte-identical,
     proven by the parity harness.
   - Behavioural steps are separate commits, with a stated hypothesis and an
     honest paired measurement.
3. **Never optimize an unvalidated measure.** A measure becomes an objective
   only after it agrees with the owner's blind judgments on held-out passages.
   Every result is also reported under the other rulers, so self-grading is
   visible.
4. **Honest comparisons.** The song is the unit. Report completion separately
   from quality, use intervals rather than point estimates, and use real
   perturbations rather than repeated seeds. Report on new music when making
   claims about generality.
5. **Lean by default.** Delete rather than flag-off. Experiments live on
   branches. The codebase holds what the product uses, plus the instruments
   that judge it.
6. **Few, current documents.**
   - `README.md` — what it is and how to run it.
   - `ARCHITECTURE.md` — how it works.
   - `WORKING.md` — the rules for changing it.
   - `docs/decisions/` — dated decisions with evidence.

## Decisions (owner can overturn; all reversible via the tag)

- **D1 — Retire the old search compiler and the non-arrangement routes.**
  - What goes: `legacy_handoff.ts` and its closure; the ordinary
    connected-arcs route and its preview rollout; the 102 MB arc policy model;
    grain/elevation axes; non-WASM compile backends.
  - Why: production and V6 never use them.
  - What stays: the JS reference engine, kept for engine parity checks only.
- **D2 — V6 becomes a frozen sentinel defined by outputs, not file hashes.**
  - It runs only at delivery boundaries, as a regression check.
  - It is no longer a target; no further benchmark versions get built for
    chasing.
  - V2–V5 runners and data are archived.
- **D3 — Two impact rulers coexist explicitly until Phase 3 decides.**
  - The frozen landing ruler (for the sentinel) and the contact-impact ruler.
  - Both live in one `contract/` module that has no compiler dependencies.
- **D4 — Learned artifacts must earn their place.**
  - Each needs provenance, size and an ablation.
  - Models must be trained on data disjoint from what judges them.

## Phases

Each phase ends with a gate. Phases 0–2 must be byte-identical on the parity
harness.

### Phase 0 — Safety net (done)

- **Parity harness** (`npm run parity`):
  - Fixed V6 cells covering every fixed family and the automatic panel,
    including the production songs, in default and contact-impact modes.
  - Each cell must match the stored reference exactly: track hash,
    physics-frame count and score.
  - Runtime should be a few minutes.
- **Judge parity:** re-score every stored V6 track; scores must be identical.
- **Typecheck:** a `typecheck` script that works, with the error count
  recorded as a ceiling that only goes down.

### Phase 1 — Prune (done)

- Archive the unreachable code: studies, probes, old benchmark runners,
  galleries and dashboards that are not the production player, and
  stale docs.
- Retire the old compiler (D1).
- Remove force-added data and dead npm scripts.
- Rewrite `README`, `CLAUDE.md` and the working rules to describe what
  actually exists.
- **Gate:** parity, judge parity, live tests and typecheck ceiling.

### Phase 2 — Restructure (done; judge/compiler file separation remains)

- **Separate the contract.** Measurement (detector, impact rulers, scoring,
  layout checks) moves out of the compiler into `contract/`. It has an
  explicit section map, no env reads and no compiler types.
- **Redefine the sentinel's identity** as stored-output parity.
- **Split the compiler into stages:** plan → interval solve → sequence →
  refine → validate.
  - Production configuration is kept separate from research overrides.
  - Dead options are removed, and the memo key is derived from declared
    option sets.
  - There is one validity predicate.
- **Geometry-family registry**, so a new family touches one module (done:
  `geometry_families.ts`).
- **Replace the legacy-schema telemetry shim** with native telemetry.
- **Gate:** parity (identical tracks), judge parity.

### Phase 3 — Measurement foundation (done: line.strike.v1, decided by physics and evidence at the owner's request; blind labelling remains available)

- **Candidate sync measures:**
  - the renewal fix;
  - "nothing hidden" accounting;
  - peak or centroid timing;
  - the 10-point external impulse as a diagnostic;
  - clarity.
- **A blind labelling tool**, built on the production player, with about 300
  beat-level judgments split into design and holdout halves.
- **Adopt one impact definition** only if it wins on holdout. It then becomes
  the single ruler for both the compiler and evaluation.

### Phase 4 — Evaluation foundation (done except held-out new music, which needs new songs)

- One evaluation command:
  - **Songs as units:** bootstrap intervals; completion and quality reported
    separately.
  - **Real perturbations** rather than repeated seeds.
  - **A held-out new-music set** that no training or tuning has touched.
  - **The V6 sentinel** as a regression check.
- One review page per track:
  - beat time and requested impact;
  - onset and peak;
  - strength;
  - competing hits;
  - every ruler's value.

### Current focus (owner, 2026-10-04): measuring impact, separately from producing it

Two problems, worked on in order. Status on 2026-10-05: see
docs/research/overnight-20261005.md and the dashboard (motion-gallery/night.html).

1. **Measuring impact: done** (line.strike.v3).
   - The owner's blind pairs chose the change of the rider's whole-body
     motion (travel and spin) within 50 ms.
   - Floor-then-rail opposite pushes are two impacts.
   - Open: the absolute scale (isolated maximal hits are physically
     possible; dense runs are capped near 0.6–0.7) and whether pass-throughs
     and body drag matter. Both are owner questions.
2. **Producing impact: at the measured frontier for tonight.**
   - Adopted: the v3 objective, the steep upright arrival before strong asks
     and a wider lookahead into them.
   - Result, evening → tonight: impact loss −60% on four panels; speed
     unchanged; air +0.005.
   - Past this, strength trades against speed (a slam spends speed the spec
     asks for) and survival.
   - Open: retraining the learned models on v3; owner choices on the
     speed/strength and air/impact trades.

### Phase 5 — Compiler quality (resumed 2026-10-04 night under line.strike.v3)

Only on validated measures:

- a scale-free, incumbent-preserving budget schedule (default allowance now
  scales with ride length; the width schedule is still saturating caps; see
  docs/research/compiler-budget-20261004.md);
- lookahead value per frame;
- learned models retrained on disjoint data, or removed;
- extensibility proven by adding a geometry family through the registry
  (shown with a toy family in `tests/geometry_families.test.ts`; a production
  family remains).

## Log

- 2026-10-03: branch and tag created; plan written.
- 2026-10-03: **Phase 0 done.** Parity harness: 23 cells, plus judge parity on
  483 stored tracks. Typecheck works (255 errors).
- 2026-10-03: **Phase 1 done.**
  - The V6 freeze moved from source hashes to outputs.
  - Retired: the legacy compiler, the ordinary route, studies and probes,
    V2–V5 runners and data, old dashboards, 210 dead tests and 137 npm
    scripts.
  - The server went from 1,952 to 70 lines.
  - Compiler identity is now git-based.
  - Docs went from 425 files to 43: owner-feedback research plus README,
    ARCHITECTURE, WORKING and CLAUDE.
  - Tracked files went from about 3,900 to about 1,450.
  - Typecheck: 16 errors. Parity holds and all tests pass.
- 2026-10-03: **Phase 2 started.**
  - The unused 102 MB arc policy and the ordinary compile route are removed;
    parity holds and is faster (88 → 81 s).
  - A focused agent is splitting `arc_motion.ts` on branch
    `rework/compiler-split`.
- 2026-10-03: **Phase 3 and 4 instruments.**
  - `tools/measure` (observations plus candidate per-beat measures).
  - A blind labelling study, `impact-2026-10`: 120 clips, waiting for owner
    labels.
  - `tools/eval`: a song-level behavioural evaluation.
  - Reading:
    - "Contested strong beats" separates the eras cleanly: July 0%, current
      28%, experimental 5%.
    - Contact mode against the default, paired: contested −19 pp, strong extra
      hits −0.25/beat and late peaks −6 pp, holding on perturbed inputs too.
      It costs +39% physics.
- 2026-10-03: **Phase 2, compiler split** (branch `rework/compiler-split`).
  - 61 research-only options removed: interval options went from 145 to 84
    (77 production fields, 7 set only inside the compiler); one search
    attempt instead of the preview/completion-first attempt layer.
  - `compileArcMotionOnce` (1,242 lines) is split into stage modules with
    explicit state; `arc_motion.ts` went from 1,519 to 56 lines.
  - Production configuration is declared separately from per-interval
    overrides; the memo context is derived from `EVALUATION_IDENTITY`.
  - One validity predicate (`ride_validity.ts`).
  - Every commit: parity byte-identical, output fingerprints of all 23 cells
    identical apart from deliberately dropped telemetry, typecheck 16.
- 2026-10-04: **Phase 2 gate passed.** The full V6 sentinel at 5eea516e is
  identical to the stored reference on all 460 runs (track hash, frames and
  score; headline 835.616).
- 2026-10-04: **Strike account.**
  - `line.strike.v1` (`scripts/lib/strike_impact.ts`;
    docs/research/strike-definition-20261004.md) is integrated through the
    impact-account registry.
  - Its search profile: preparation 2, which was accepted; H1 and H2 were
    rejected.
  - Paired against the default: strike loss −0.21, strong extra strikes
    −0.32/beat, contested strong beats −20 pp (to 5%, July 3%), late peaks
    −11 pp, at +0.67 M frames.
- 2026-10-04: **Strike adopted as the product objective.**
  - The registry holds `line.strike.v1` only; contact-impact v1 is now a
    research diagnostic.
  - Production, dashboard jobs and the library default to strike, with
    `landing` as a temporary comparison mode.
  - Parity gained strike cells.
  - The review library was regenerated: 12/12 fulfilled.
  - Motion checks all pass.
  - Perturbed panel against the old default: peak lag −47 ms, contested beats
    −24 pp, strike loss −0.20.
- 2026-10-04: **Old schema retired.**
  - `CompileStats` is lean (types.ts went from 1,743 to about 830 lines), and
    a native work record replaced the budget-telemetry shim.
  - Deleted: `selective_backtracking.ts`, `repair_branch_bound.ts`,
    `register.ts`, `budget_telemetry.ts`, `budget_estimator.ts` (with its model)
    and `budget_model.ts`, about 7,100 lines.
  - Typecheck errors: 0.
- 2026-10-04: **Budget study** (docs/research/compiler-budget-20261004.md).
  - Every search width saturates by about 0.52M on 45 s songs, and the
    saturated search costs 1,200–1,550 frames per ride frame.
  - Ablations: A1 (no value model) and A2 (no construction policies) are both
    slightly worse, so both are kept.
  - Rejected: R1 (refine every section), K1 (recalibrated allowance), P1
    (fair-share pacing of local search), L1 (lookahead off: −1.65M frames
    but strike loss +0.007) and P2 (reserve factor 1.2).
  - Adopted, S1: the default allowance is 1,700 frames per ride frame
    (`production_budget.ts`), so long songs are not starved. It is neutral on
    the panel; requests may omit `budget`.
- 2026-10-04: **Review library regenerated** with the current compiler
  (`generated/production-repertoire/library-strike-s1`; the earlier strike
  library predates the work record, so it cannot render).
  - 12/12 fulfilled; published to the dashboard against library-candidate-8.
  - Motion check: 4- and 10-frame burst burdens 0, reported windows and
    openings pass. **The 1-frame burden ratio is 0.52 against a 0.50 limit**
    (the earlier strike draw was 0.34). It is driven by amour #303 (142 vs
    the previous library's 272) and tiki #303, a draw-to-draw difference: a
    single-frame spike is also what a strong requested hit looks like.
- 2026-10-04: **Constant options removed** (structural, branch
  rework/constant-options, merged).
  - Interval options went from 84 to 58: 17 constant base options, 9
    repertoire and intentional-plan flags, `arrivalMode` (now an internal
    passive-arrival flag), and `guidance` narrowed to 'clearance'.
  - Research knobs were removed from `arc_motion_control.ts`. v1 plans are
    rejected explicitly.
  - Tests went from 266 to 255; each deleted case only compared a removed
    option on and off.
  - Parity now also pins 18 low-budget cells (150k and 750k), where the
    budget-gated options take other values. All 41 cells and judge parity
    pass.
- 2026-10-04: The review library is rendered (12/12 videos).
- 2026-10-04: **Impact measured as the owner sees it: line.strike.v2.**
  - Owner blind pair studies: 3 rounds, 77 pairs (`labels/studies/impact-pairs-*`).
  - Strike v1's strength matched the owner on 31 of 63 decisive pairs. The
    pairs were chosen where the measures disagree; head to head, v2 won
    22 : 7.
  - The whole-body motion change (travel and spin) within 50 ms matched on
    46 of 63. Spin: 8 : 3 where it was the only difference (p ≈ 0.11, so
    supported but weakly; an earlier "12 : 4" counted 5 pairs twice, as the
    code review found).
  - v2 is the product default: v2 impact loss 0.078 → 0.037, with no
    completion or timing cost.
  - Parity gained 11 strike2 cells (52 in all).
  - Problem 1 (measuring) is done apart from the absolute scale and the
    separation of floor-then-ceiling hits. Problem 2 (producing strong hits)
    is next.
  - The review library was regenerated under v2
    (`generated/production-repertoire/library-strike-v2`): 12/12 fulfilled,
    published to the dashboard.
  - Motion check: the 4- and 10-frame burst burdens fell by 90–100%, and the
    windows and openings pass. The 1-frame burden ratio is 1.06, which fails
    the halving rule.
  - The 1-frame rule counts single-frame speed GAINS (kicks), not slams. There
    are only 13 such frames in 12 rides, about half away from any beat: a
    small item to watch in problem 2.
- 2026-10-04 night: **Pre-registered H-v3** (double hits). Under line.strike.v3,
  opposite pushes (floor then upper rail) are separate impacts.
  - Measurement check: on rides with rails, 94% of the added splits start on an
    opposite-facing surface; July (no rails) has none; the count is insensitive
    to the threshold (107°–135°: 181–189).
  - Hypothesis: compiling with v3 instead of v2 reduces double impacts per beat
    (v3 − v2) and v3 loss, with no worse-than-noise change in v2 strength rms,
    completion, peak timing, contested beats, air/speed/amplitude rms, bursts
    or compile cost.
  - Adopted as default only if all hold on both panels.
- 2026-10-04 night: **H-v3 result** (s3-a against s2-base).
  - Primary goals passed on both panels: double impacts per beat −0.13 / −0.16;
    v3 loss −0.011 / −0.021; strong extra impacts per beat −0.08 / −0.10.
  - Completion, timing, contested beats, bursts and air are unchanged or better.
  - **Two guards regressed on the authored panel only:** v2 strength rms
    +0.008 [0.002, 0.016] and speed rms +0.007 [0.001, 0.012]. Amplitude was
    mixed (−0.005 / +0.011). The pre-registered rule therefore strictly fails.
  - **Adopted anyway, as an explicit exception:** the owner asked directly for
    double hits to be fixed; they fall about 75%; the regressions are small.
    The cause is unexplained. The history brief
    (docs/research/producing-impact-brief-20261004.md) finds the rail push is
    the bigger push in only 15 of 111 doubles, and re-scoring the library under
    v3 costs a median of 0.00. So "rail bounces helped" is not supported; fewer
    viable catches or speed effects are untested alternatives.
  - Recovering both guards is compiler hypothesis H-1.
  - The default account and eval mode are now v3; parity gained 11 strike3 cells.
- 2026-10-04 night: **Compiler experiments under v3** (each against s3-base,
  both panels):
  - Rejected: H-1a (catch turn seeded in 2 frames: null), H-1b (impact weight
    2: strong bias +0.02 but speed rms +0.026), L6 (release reserve 3: null,
    contested +0.7 pp), L1 at weight 1 (no better than 0.3, air +0.008).
  - **Adopted, L1 (steep, ask-driven arrival prior before asks ≥ 0.6):**
    - v3 strong bias +0.020 / +0.024, very strong +0.033 / +0.024;
    - v2 strength rms −0.015 / −0.015; v3 loss −0.004 / −0.002;
    - speed rms −0.014 / −0.022;
    - contested strong beats +1.1 / +1.0 pp (the only cost; v3 strong extras
      unchanged);
    - air, bursts and frames within noise.
  - Survival envelope: the strongest single hit the rider survives is about
    0.9 on a flat floor; a 1.0 request is physically out of reach for a clean
    hit (an absolute-scale question for the owner).
  - Rejected: L1 thresholds 0.4 and 0.75 (0.6 is bracketed).
  - **Adopted, L9 (lookahead width and sample caps ×1.3 for the interval
    leading into a strong ask), against s3-l1:**
    - v3 strong bias +0.009 / +0.005; v3 loss −0.005 / −0.001;
    - contested strong beats −0.8 / −0.2 pp (earns back most of L1's cost);
    - +0.32M frames and +20 s compile per ride.
    - At ×1.6 the gain was similar for +100 s, so it was held.
  - Agent B (exp/sharp-catch, against the pre-L1 base):
    - Catches are already sharp (turn done in 2.8 frames); sharper or larger
      turns mostly crash (42–81%).
    - Energy audit: passages are not energy-bound; the real speed bill of a
      strong hit is about 5× smaller than first estimated.
    - Arrival-speed headroom 0.5 helped on that base (+0.015 strong bias).
  - Rejected on top of L1 + L9 (against s3-l9):
    - headroom 0.5: speed rms +0.010, very strong −0.037;
    - headroom 0.5 + impact weight 1.5: mixed, air +0.005.
    - L1's steep-arrival speed formula already does this bookkeeping for
      strong catches.
  - Rejected T1 (search aims at most 0.85): strong strength fell, no guard
    improved. The search is not trading guards for unreachable requests.
  - Agent A (exp/catch-pose): pose-matched catches add nothing on top of L1.
    An arrival prior on sled pitch makes things worse (contested +4 pp).
    Physics: a slam at an angle loses speed (tan(incidence/2) per unit of
    impact), which the spec's speed target charges for; sharper turns crash.
    Past L1, strength trades against speed and survival: a frontier.
  - **Confirmation on fresh seeds** (`--panel=confirm`: seeds 505–808,
    perturbations 3–4), L1 + L9 against the same code with both off:
    - v3 strong bias +0.031 / +0.023; v3 loss −0.005 / −0.007;
    - speed rms −0.025 / −0.023; contested and air neutral.
    - The gains generalize beyond the dev panel.
  - Per-gap diagnosis (s3-l9b): air and speed errors concentrate in the
    densest, most strongly asked song (amour: air rms 0.105, speed 0.135,
    against about 0.06 elsewhere) and around strong asks. Measured
    strength spans about 0.06 (gentlest touchdown) to about 0.9 (hardest
    survived hit), narrower than the authored 0–1 scale.
  - Learned models under v3 (against s3-l9b):
    - A1′, no value model: slightly worse (strong bias −0.007, air +0.005,
      speed +0.009), so kept.
    - A2′, no construction policies: much worse (completion −12.5 pp, speed
      rms +0.096), so kept.
    - Policy samples 32: null, rejected.
    - Retraining on v3 needs the archived training pipeline: a follow-up.
  - Calm impact multiplier 3 (quiet asks): quiet bias −0.024 / −0.036, but
    authored strong bias −0.013 and v3 loss +0.004. Mixed, not adopted.
  - **Blind-spot audit** (docs/research/scorecard-blind-spots-20261005.md,
    tools/measure/blind_spots.ts):
    - L1 raised head-down or backward strong arrivals from 24% to 31%
      (July 13%), invisible to the scorecard; the owner's one explicit
      negative example was such an arrival.
    - Also: more body drag than July; 6–8 pass-throughs of 3 px or more per
      ride; the motion check's 1-frame rule counts body-on-sled motion.
    - The eval gains three guard rows: strong arrivals inverted/backward,
      body drag s/min, off-beat kicks per ride.
  - **Adopted, uprightArrival 1** (the steep arrival penalizes a head-down
    or backward sled; search profile v4), against s3-l9c:
    - strong arrivals inverted/backward 29% → 15% (perturbed 31% → 15%;
      against the evening product about 22% → 15%). This is judged by the
      same geometric test as the penalty (the review's point), and the
      owner evidence is one disliked example; perceptual confirmation is
      pending;
    - body drag −0.14 s/min;
    - impact and every guard neutral; fresh-seed panel impact-neutral.
  - Rejected: uprightArrival 2 (authored inverted −4.6 pp more, air +0.004);
    calm multiplier 2.2 (quiet −0.016, very strong −0.015 / −0.023).
  - Agent C (exp/amour), why amour is hard:
    - The spec asks more: 77 of 85 beats strong, 47% of asks ≥ 0.9, 26 gaps
      under 14 frames. Consecutive strong hits about 13 frames apart sit
      near a momentum limit (the centre-of-mass part is capped near 0.34
      strength); delivered strength is about 0.6 in every song at such
      spacing.
    - Air overshoot is a construction trade (catch, ride 6–8, fly 17–19).
    - The intro speed targets cannot be reached from the authored start.
    - Not budget-bound: 1.5× allowance gave no gain, with zero interruptions.
    - Rejected: gap-length-weighted search residuals; lookahead deepened to
      40 frames.
  - **Structural: native whole-body read** (`bodyMotionAt` in
    native_motion/engine.ts, used by the v2/v3 observation). It allocates
    no point states; the arithmetic order is unchanged. Compile 75 s → 60 s
    per ride (−20%), byte-identical: parity passes on all 63 cells.
  - Robustness at half budget (1.5M), tonight's profile against the same code
    with its options off:
    - completion +6 pp authored; strong bias +0.036 / +0.030;
    - head-down strong arrivals −10 pp; contested −1 pp.
    - The hardest song (amour) loses one perturbed ride in each version at
      this budget: low-budget completion there is fragile either way.
  - Housekeeping: unused steepArrivalWeight removed (parity unchanged).
    Shared eval summaries (tools/eval/summary.ts), the night report
    (tools/report, motion-gallery/night.html) and shared clip rendering
    added.
  - Rejected: air weight 1.5 in the search (air −0.003 / −0.007 but strong
    bias −0.010 / −0.014): a dial for the owner, not a free gain.
  - **Headline, evening → tonight**, under the impact account and independent diagnostics, on
    four panels (dev and fresh seeds × authored and perturbed):
    - impact loss 0.092–0.097 → 0.033–0.038;
    - strong bias −0.28 → −0.13; very strong −0.35 → −0.17;
    - double impacts about 0.11 → under 0.01 per beat; contested −2 to −3 pp;
    - peak lag −5 to −9 ms; head-down strong arrivals about 22% → 15%;
    - speed rms unchanged: the v3 adoption's regression (0.075 → 0.094)
      is recovered by L1, which closes H-1;
    - air rms +0.004 to +0.006; +0.4M physics frames; completion 100%.
  - Rejected: upright penalty before every catch (null; very strong −0.028
    authored).
- 2026-10-05: **Code review of tonight's changes** (agent; no correctness bug in
  product code), fixes in 85b09cf3 and 6736cf38:
  - per-account search profiles: v1/v2 back to the evening profile, so
    `--mode=strike` reproduces the evening product;
  - evidence corrected: spin 8 : 3 (p ≈ 0.11), not 12 : 4; v1's 31/63 is on
    disagreement-selected pairs (head to head 22 : 7); the upright change is
    judged by its own geometric test, about 22% → 15% against the evening;
  - tool safety (clip cache key, unmatched beats, case-set checks, ties) and
    tests (v2/v3 incremental = cold; native read exact).
  - **Survival corrected.** The fine grid (`survival_envelope.ts --fine`)
    shows a near-vertical drop onto flat ground surviving strength 1.00
    (about 9 px/frame into the floor); at 45° the rider crashes above about
    0.9. "1.0 is out of physical reach" was wrong. Dense passages are capped
    by time and energy (about 0.6–0.7), not survival.
- 2026-10-05: **Pressing rail (agent, exp/pressing-rail)**, negative:
  - a roof that forces the descent breaks the sled–body binding or removes
    the hit;
  - in dense runs, descent refills each hit's speed bill almost exactly;
  - a gravity-ride continuation was null on the panel, so rejected;
  - a strong hit costs about 6 px/frame of speed per unit of strength.
- 2026-10-05: **Learned artifacts retrained under v3** (agent, exp/retrain-v3,
  merged for provenance: tools/research/*, plus a probe hook in
  arc_lookahead.ts that leaves tracks unchanged under parity).
  - Hygiene finding: both V6-era artifacts were trained partly on the four
    evaluation songs, against WORKING.md's disjointness rule.
  - Value model retrained on disjoint data: no better. Old, retrained,
    constant and none land within about 0.01, so it is not adopted.
  - **Construction policies rebuilt under v3 on disjoint songs (C), adopted
    for the v3 profile (search profile v5; v1/v2/landing keep the V6-era
    policies).** Reproduced in main, against s3-up1 / c-up1:
    - impact loss −0.008 / −0.006 (dev), −0.007 / −0.005 (fresh seeds);
    - strong bias +0.017 / +0.009, +0.014 / +0.017;
    - very strong bias +0.018 / +0.036 / +0.031 / +0.024;
    - air rms −0.005 / −0.003 / −0.007 / −0.005 (recovers tonight's air
      cost); contested −1.1 pp (dev authored); fewer physics frames.
    - Exceptions, explicit: body drag +0.4 to +0.5 s/min (about +30%) and
      quiet bias +0.010 (fresh seeds, authored).
    - The archive is 10.3 MB, beside the 8.5 MB V6-era one.
- 2026-10-05: **Construction policies, round 2** (collected with the round-1
  v3 policies searching; agent, exp/policy-round2): not adopted.
  - Impact loss −0.003 on all four panels, about half of round 1's gain.
  - Body drag +0.5 / +0.95 s/min (dev), on top of round 1's +0.4–0.5; quiet
    bias +0.019 (fresh seeds, perturbed).
  - Diminishing returns, and the body-drag trade needs the owner's ruling.
  - Round 1 retrains byte-identically from its sources
    (tools/research/construction_v3_round1_sources.json); the round-2
    archive (sha256 a19c42b3…) stays out of git.


Evidence correction (2026-10-05): earlier “double impacts” figures based on
v3-minus-v2 thresholded counts are historical proxies, not literal counts.
The corrected overnight report uses direct opposite-push boundaries and counts
adjacent pairs with both strengths ≥0.2. R1 bend-peak timing remains a separate
diagnostic. See `docs/research/overnight-20261005.md` for the remeasurement,
preserved evidence and corrected blind-study sampling.

2026-10-05: **Evidence integrity implemented** (structural; compiler output unchanged).
Evaluation now declares resolved inputs, timing, compiler and measurement identity
before any workers run. Each saved result belongs to that plan and its saved track;
reports require the complete panel. Worker failures fail the command, while an
incomplete ride remains an explicit result. Evaluation and production collections
have one writer and reject stale resumes. Measurement identity follows indirect
dependencies and both replay engine artifacts.

Compilation and historical replay share one measurement path. Direct opposite-push
observations replace the invalid difference between thresholded event counts.
The independent R1 bend diagnostic stays intact and is explicitly named. Scorecard
posture and blind selection share the same first-contact observation. Published
studies remain immutable; a new 22-pair study corrects the sampling instant.
Review renders verify their source inputs, renderer identity and movie bytes.

Remeasured all 33 historical runs with saved tracks (792 tracks), preserving their
compiler identities and outputs; the 31 table-only runs and all originals remain
archived locally. The six displayed runs retain the 67–70% impact-loss reduction.
Direct opposite-push counts are 863 → 58, or 414 → 9 when both hits reach 0.2.
The report distinguishes those observations from a universal visual definition.
Validation and artifact identities are recorded in
`docs/research/evidence-integrity-20261005.json`.

## Compiler quality campaign, October 5 evening

Owner direction: improve the actual automatic-arrangement rides while preserving
the lean foundations and trustworthy comparisons. Strong, precise musical hits,
smooth quiet passages and meaningful geometric variety must improve together.
The existing impact contract, authored requests and engine remain fixed. A high
score alone is not grounds for adopting a change.

Plan of work:

1. Reproduce the current compiler on the complete development panel; analyze
   residual errors and where search work goes, using saved tracks and telemetry.
2. Investigate how adjacent supports are searched jointly: continuation quality,
   dimensionality of refinement, and whether complete-track revision can usefully
   preserve an incumbent. State each hypothesis before its paired experiment.
3. Explore better physical proposals or search only where the measurements expose
   a limitation. Keep construction requests and variety fixed for comparisons;
   do not hide difficult requests or trade them away through authoring changes.
4. Judge candidates on all rulers and guards, including completion, strength by
   requested band, timing, extra hits, air, speed, amplitude, motion and work.
   Diagnose regressions before accepting or rejecting an idea; first attempts
   are not conclusions about a mechanism's potential.
5. Confirm useful changes on reserved seeds and perturbations, retain compact
   evidence and rejected experiments, and update the real production review with
   comparable landscape examples. Generalization to new music remains unproved
   until new music is actually tested. Visual judgments remain the owner's.

Experiments run in an isolated checkout, so the existing production dashboard and
baseline remain usable throughout. Each adopted behavior change gets tests,
updated parity references and a coherent implementation; research switches do not
accumulate in production.

21:30 UTC: Fresh baseline reproduces all 24 `s3-c` tracks and physics counts exactly. Q1 (spending unused pair-response allowance) is mixed, not promoted: authored impact loss +0.002; perturbed −0.004 but body dragging +0.56 s/min. Q2 tests better local fitting inside continuation probes at unchanged nominal allowance. Full ledger: `docs/research/quality-20261005.json`. Earlier review pages and unanswered questions remain untouched.

21:42 UTC: Q2 and Q3 remain research-only: neither provides a convincing overall improvement, and sharper catch proposals increase body dragging. Replay diagnostics cover 1,890 matched hits; response instrumentation reproduces all four original tracks and work counts exactly. Testing a coherent arrival prior and rebased response steps; collecting 336 disjoint catalog compiles to examine geometry-aware future prediction. A separate four-ride feasibility study checks whether bounded repair can make full-track refinement useful. No product change promoted; prior dashboard untouched.

22:21 UTC: No product change promoted. The full ledger now includes 13 complete paired comparisons with all rulers and per-song intervals. Preserving scattered arrival alternatives is the first promising candidate across both development subsets; reserved-seed confirmation is running. A separate 179-catch fixed-prefix study reproduced every saved impact and exposed two cases where extra scattered search discarded a verified incumbent. The retention fix reproduces both successfully. Disjoint value-model collection continues; prior review pages remain untouched.

22:41 UTC: Adopted the structural configuration cleanup: select the impact profile before loading its construction archive. V3 no longer loads and discards the V6 policies. Exact parity: 63 compiler cells and 493 judge tracks; all 274 tests, typecheck and reachability pass. The resolved options digest is identical; the cold configuration retains about 17 MB less JS heap. Track behavior is unchanged. Scattered-search and learned-value work continues separately.

22:57 UTC: Complete disjoint future-model study: 336 compiles (318 complete rides), 15 source groups, 82,903 probe rows. Better held-group prediction did not reliably improve complete tracks; keep both models experimental. Q16 scattered alternatives improves average impact loss across development and reserved confirmation, with explicit strongest-hit and individual-clip regressions. New campaign page at `generated/report/quality-20261005/` preserves all earlier reports and questions; 20 complete comparisons and eight paired clips are available. Testing ranking without local model gradients, budget scaling, and persistent physical-prefix beam search.

23:32 UTC: Persistent physical-prefix search with disjoint geometry-aware ranking improves impact loss on both development and earlier confirmation, but a new 48-case panel catches two completion failures. Bounded recovery is under test; no behavioral promotion. Confirmed three search inconsistencies: scattered incumbent eligibility, authored-span replacement windows, and duplicated whole-track objectives. Native counterfactual tests verify the defects and proposed invariants. The span correction alone has quality tradeoffs; testing coherent integration rather than equating a bug fix with better rides. Full evidence now includes 35 complete comparisons; previous dashboard and questions remain unchanged.

23:43 UTC: Recovery now completes and fulfills 48/48 recheck rides. The coherent beam retains musical gains after accounting corrections, but body-drag and specific quiet inverted contacts remain concerns. Physical clips and travel/spin decomposition show real stronger upright catches as well as counterexamples. Testing whole-incumbent suffix repair at ordinary and doubled allowance, with explicit model ablations. New whole-objective tests pass and fail on the old implementation. No behavioral promotion yet; original reports remain preserved.

00:10 UTC: Fifty complete paired comparisons now retained. Disjoint future ranking helps, but the strongest beam still raises body dragging. Preserving the existing arrival prior during future ranking reduces that tradeoff; confirmation is running. Doubling the allowance and repairing suffixes spends roughly 3.2M more frames for a small gain, so testing complete-objective joint repair and narrower beams instead. Previous reports, clips, questions and the production compiler remain intact; current research results live on the separate campaign page.

00:34 UTC: Adopted shared complete-track selection objective (Q31). The old terminal, refinement and final paths disagreed about motion/engagement terms; native tests reproduce the disagreement and enforce equality. Development and confirmation cover 48 paired rides with negligible quality changes under every ruler. All 63 parity cells were compiled: six track hashes intentionally change, including three low-budget cells; 33 saved judge tracks pass, 276 tests pass, typecheck and reachability pass. Historical metric definitions are unchanged. The stronger physical-prefix search remains isolated while its implementation and visual tradeoffs are checked.

00:59 UTC: Lean beam implementation qualifies with 63 exact compiler references, 33 judge tracks, 273 tests, typecheck and zero unreachable files; it remains a candidate while arrival and budget variants are compared. Native contact observation matches 219,681 reference-engine collisions across 24 tracks, and remeasurement preserves all 37 measures on 48 saved tracks. Testing removal of the duplicate JavaScript contact replay; no physics equation, benchmark engine or impact ruler changes. A fresh 48-case confirmation panel is predeclared, and a new disjoint 336-compile training collection is in progress. Earlier reports and unanswered questions remain untouched.

01:16 UTC: Native observation alone passes all 63 exact track/work cells and 33 judge tracks. Replacing the JS observer with native replay (Q51) is mixed and not promoted; its long-case peak memory drops only 4446→4381 MiB. Testing cached collision positions instead (Q52): reference contact positions match exactly, reads add no physics, and the separate observer/replay is deleted. Extra-budget arrival search helps authored strong impacts but worsens some perturbed motion; preserve that tradeoff. Fresh confirmation and disjoint training continue; historical review material remains untouched.

01:36 UTC: Cached-contact construction completes 48/48 development and confirmation rides. Confirmation v3 loss improves ~.006 authored/.008 perturbed, with explicit body-drag and older-ruler caveats; all63 instrument-only compiler tracks/work are exact. The long stress case remains valid, with peak RSS about 3.1 GB versus 4.4 GB for Q42, but 512 MB heaps fail and will not become a default. Allocation profiling reveals oversized vacant native version slots and retained dead branches; testing compact storage and ownership-based reclamation without physics/search changes. New Q48 clips include upright strong-hit gains, the worst strong-hit regression and a quiet passage. Old reports/questions remain unchanged.

01:54 UTC: Native branch reclamation passes all63 exact compiler tracks/work, 33 judge tracks, 275 tests, typecheck and eight Rust ownership/kernel tests. Long-case sampled peak RSS falls 3235→1459 MiB for the identical track and 5,297,435 frames. Six paired normal cases show CPU +8%, so testing dense storage to avoid per-node allocation cost. Cached-contact arrival forecast is mixed across 48 cases; model removal weakens strong impacts and increases dragging on development, with confirmation running. New disjoint collection has passed 240/336 compiles. Earlier review material remains intact.

02:10 UTC: Q52 physical review includes a stronger upright Luna catch (.664→.941 for request1), a gentler but still overshooting quiet Tiki catch (.326→.154 for request.03), and the real worst Amour regression (.827→.419). Re-observed timing is not broadly later: strong-response-window absolute error averages about11ms versus13ms, with four-song uncertainty recorded. The no-model ablation confirms weaker perturbed strong hits. Dense native storage shows no direct resource advantage over simpler boxed ownership and is rejected. Separate campaign page updated; original reports/questions untouched.

02:34 UTC: Fresh catalog replays confirm one completion regression in Q52; retaining all distinct measured alternatives at four recent boundaries, reopened eight at a time, fixes it within the same allowance. The other two suspected regressions already complete with cached contacts. All three refitted continuation models weaken strong production hits and are not adopted. Q52 completes63 compatibility cells; the lean recovery candidate passes276 tests, typecheck and reachability. Full336 paired catalog compiles with all rulers are starting, followed by the untouched48-case musical confirmation. Evidence now covers81 complete paired comparisons; previous reports and unanswered questions remain unchanged.

02:45 UTC: Q62 recovery fixes the dense catalog case while all48 development/confirmation music tracks and work counts remain exactly Q52. Frozen candidate954d0353 is running untouched48-case confirmation and the336-case paired catalog audit under every ruler. Replayed all48 development tracks to reproduce the existing body-contact guard exactly: added contact concentrates in strong passages, but Amour404 has a worse inverted quiet opening. The separate report now includes both this counterexample and an upright scattered-contact example. Testing the existing posture preference on passive catches separately; no new aesthetic metric or impact definition. Mobile review passes with37 measures, eight impact pairs and two diagnostic pairs; earlier pages/questions remain intact.

03:07 UTC: Frozen Q62 completes all48 fresh musical cases; v3 impact loss falls16.6%/26.7% against adopted Q31, with explicit extra body-contact and older-ruler tradeoffs. Strong response-window timing improves on cold replay. All63 compiler references and33 judge tracks qualify;276 tests pass. Six exact production cases use9.4% more CPU, so no speedup claim. Passive-catch posture preparation visibly repairs the quiet inverted opening and reduces authored quiet dragging on two panels, but has mixed strong-hit results; a new untouched48-case comparison and336-candidate catalog audit are running. Full paired Q62 catalog continues. Old reports, clips and questions remain untouched;90 complete comparisons are preserved on the separate campaign page.

03:54 UTC: The final untouched48-case panel confirms v3 impact-loss reductions24.5% authored/13.5% perturbed against adopted Q31. Cold replay reproduces every saved strength; strong response-window timing improves15.1→10.3ms authored and12.9→10.1ms perturbed. Quiet body-contact contributions fall, while aggregate body contact rises and some strongest perturbed hits weaken. New paired movies include real upright-catch gains, the worst upper-contact regression and a quiet improvement. Native ownership scope fixes retained-engine corruption with63 exact track/work references,33 judge tracks and278 tests. Full catalog audits continue; no final behavioral adoption yet. Old reports and unanswered questions remain untouched.

04:16 UTC: Fresh physical review now includes eight impact pairs, three body-contact counterexamples and all four full songs at fixed seed3001. Phone-sized playback and source switching pass. The worst quiet Amour upper-body slide remains visible; the Luna quiet example changes an inverted slide into an upright exit. Archive verification covers107 runs,13 datasets and6,188 files. All336 model-source records match provenance and exclude the evaluation songs. The related continuation-collector ownership failure is reproduced and fixed, with identical labels/work under retained caller engines. Catalog validation now also checks identical construction plans and exact budget accounting. Full audits and adoption remain pending; previous dashboard material is unchanged.

04:41 UTC: Final musical evidence and four full landscape pairs are preserved on the separate campaign page. Catalog audits continue (266/336 original–Q62 pairs;308/336 final-candidate records); no partial averages or adoption decision. Final packaging audit corrected the native wrapper manifest hash and added a source/WASM identity check. Earlier report and questions remain intact. Preparing an exact four-ride integration check and durable catalog/media manifests.

05:12 UTC: Both336-case catalog audits are complete and verified against their saved plans, tracks, work accounting and identical construction requests. Final candidate v3 loss falls14.6% across all cases and26.4% on317 common completions. Both versions complete318/336: one pickup case recovers, one dense terrace transition regresses after56 backtracks exhaust the allowance. All31,000 requests are accounted for; this is a bounded-search limitation, not infeasibility. Strong delivery/air/posture improve; body contact rises. All279 tests pass under normal settings; typecheck and reachability pass. Complete catalog controls and movies pass the mobile review check. Q69 now replays one costly case with synchronized compilers to separate runtime behavior from the catalog's unequal concurrent loads.

05:34 UTC: Adopted the qualified coherent search and passive-catch preference, with all63 refreshed references in the same commit. Fresh musical v3 loss improves24.5%/13.5%; catalog improves14.6% overall with unchanged318/336 completion and explicit case tradeoff. Final six-case matched timing is+6.9% CPU/-2.1% peak RSS; controlled long-case timing confirms a2.06x CPU cost. All279 tests/type/reach and33 judge checks pass. Previous review is preserved. Final main-checkout replay will bind the four full musical videos to the integrated code and all saved physical measurements.

05:41 UTC: Campaign complete. Integrated commit abdad07e reproduces all four full musical review tracks, work counts and every saved physical measurement exactly. Main typecheck/reach pass; final mobile scorecards, catalog controls and movie playback pass. Preserved107 complete evaluation runs,19 research datasets and the separate review:9,136 files/6.83GB, all bytes and source aliases verified. Large artifacts stay local; code, compact evidence and research scripts are committed/pushed. Previous report, blind study and unanswered questions remain untouched. Decision and limits: `docs/research/quality-20261005-decision.json`.
