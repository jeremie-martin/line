# Engine optimization log

Chronological record of the effort to make the compiler faster on everything
engine/computation-related, **while keeping behavior bit-identical**. One entry
per change attempt, with its verification result and its measured effect.

## Goal & method

- **Optimize only** `vendor/lr-core` (the vendored JS physics engine). The lever
  is per-frame **allocation count**, not the math.
- **Single metric:** `ns / physics-frame` from `npm run perf` (wall-clock ÷
  physics frames actually simulated; work-normalized, lower is better).
  Default config: `mini_burst` @ 50k budget, 40 timed runs + 3 warmup.
  Fast inner-loop signal: `npm run perf -- --reps=5 --budget=20000`.
- **Correctness gates** (must all hold for every kept change):
  1. `npm run verify:engine` — per-frame oracle: non-scarf body state +
     `CollisionUpdate` records, byte-identical to recorded baseline over 5
     fixtures. (Was `npm run verify` before the engine/optimizer split.)
  2. `npm run verify:engine -- --diff` — numeric microscope: every non-scarf
     point position bit-identical (`max err 0`) over thousands of frames.
  3. `npm run verify:optimizer` — end-to-end compiler regression gate: runs the
     real `compileHandoff` on 4 curated golden cases and hashes the compiled
     track **+ deterministic search stats** against a recorded baseline. This is
     the gate for **compiler/optimizer-path** changes (`verify:engine` only
     exercises the engine on fixed tracks). `npm run verify` runs both.
- **Commit rule:** only keep a change whose perf win **holds >1.6%** under the
  current default WASM perf gate.

## Baselines

| date | engine state | config | ns/physics-frame |
|------|--------------|--------|------------------|
| 2026-06-05 | in-place point mutation (commit `0340295`) | 50k / 10 reps | 333,898 ± 1,860 |

Pristine compile-hash ground truth (budget 8000, used to prove output identity):

```
mini_burst seed=0  sim_frames=14305  5de1cabdfa2b80f3
mini_burst seed=1  sim_frames=14157  f09fbd8f32cb737f
tiny_dance seed=0  sim_frames=16853  31c1340edbe0dfe1
tiny_dance seed=1  sim_frames=15522  8bb0c210e58d07b8
```

## Scaffolding changes (not engine perf; enable safe optimization)

### S1 — Make the trace oracle compiler-faithful
`scripts/v0/bench/sim_trace.ts` `fingerprintFrame` now folds **only what the
compiler consumes**: non-scarf body state + `CollisionUpdate` records (line id +
contacted point ids). It no longer folds `Step`/`Constraint` update bookkeeping.

**Why:** the old oracle folded every update's type string and excluded the
cosmetic scarf only by *trusting the engine to tag the scarf constraint with a
`"SCARF"` id*. That coupled the correctness gate to an engine implementation
detail — it broke the moment update objects were shared/retagged, and it blocked
the bigger win of not simulating the scarf at all. The body state folded every
frame already captures every physics result; the detector reads `CollisionUpdate`
exclusively. Baselines re-recorded from the pristine engine.

### S2 — Strengthen the compile-hash ground truth
`scripts/v0/bench/compile_hash.ts` now hashes `{track, stats}` instead of just
`track`. For the handoff path `track.lines` is often empty; the meaningful
deterministic output is `cp.stats` (candidates sampled/viable/landed, sim_frames,
improvements…). The old hash was constant across budgets — a near-useless gate.

## Engine optimizations

### B1 — Shared singleton Step/Constraint updates
`vendor/lr-core/line-engine/LineEngine.js`. Replaced the per-call
`new ConstraintUpdate(...)` (~132/frame) and `new StepUpdate(...)` (1/frame, plus
its intermediate `.map` array) with two shared frozen singletons. The stateMap
mutation those updates used to drive is now applied directly in `_stepStates` /
`_resolveConstraints`. Nothing downstream reads their id/updated (the detector
consumes `CollisionUpdate` only).

- **Gates:** verify ✓ byte-identical · diff ✓ max err 0 · compile-hash ✓ identical
  (mini_burst/tiny_dance × seed 0,1).
- **Perf (clean back-to-back, 20k / 8 reps, same machine):**

  | engine | mean ns/frame | median |
  |--------|---------------|--------|
  | pristine | 333,033 ± 4,659 | 333,269 |
  | **B1**   | **323,865 ± 3,858** | **322,812** |

  **−2.75% mean / −3.1% median.** Medians separated by 10,457 ns (> either σ).
  Holds above the 2% bar → **kept** (commit `c6f7baa`).

### B2 — Don't simulate the cosmetic scarf
`vendor/lr-core/line-rider-engine/Rider.js`. The rider now drops the scarf from
the simulated state + constraints: the 7 `FlutterPoint` states (`SCARF_0..6`) and
the `DirectedChain` that drives them. The scarf is a non-collidable one-way
follower anchored at `SHOULDER` — no body part or constraint reads a scarf point,
the chain only *writes* the scarf, and the compiler never reads it. Removing it
eliminates the engine's only transcendental math (7× `sin`/`cos`/`expm1`/`pow`
per frame), 7 stepped-point allocations/frame, the chain resolve, and 7
stateMap entries cloned per frame. This was unblocked by the S1 oracle fix.

- **Gates:** verify ✓ byte-identical · diff ✓ max err 0 · compile-hash ✓ identical
  (the stateMap no longer contains `SCARF_*` keys, yet body + compiled output are
  unchanged — the strongest confirmation the scarf was pure overhead).
- **Perf (clean back-to-back, 20k / 8 reps):**

  | engine | mean ns/frame | median |
  |--------|---------------|--------|
  | B1 (scarf on) | 326,094 ± 4,282 | 326,624 |
  | **B2 (scarf off)** | **312,905 ± 5,466** | **312,874** |

  **−4.0% mean / −4.2% median.** → **kept**.

### B3 — Scalar in-place math in `stickResolve`
`vendor/lr-core/line-rider-engine/constraints/index.js`. The constraint solver's
hottest path ran ~132×/frame and allocated, per call, 2 `V2` temporaries + a
new `[p1, p2]` array (~264 V2 + ~132 arrays/frame). Rewrote it to mutate each
point's `pos.x/.y` in place with scalar math and return a shared frozen `[]`.

Safe because a point's `pos` object is freshly allocated every frame by
`step()`/`collide()` and owned solely by the current frame — its `prevPos` (the
only object shared with the previous frame) is never written by the solver — and
the two points of a stick are always distinct. Op order reproduced exactly
(`delta = (p1.pos−p2.pos)*diff; p1.pos−=delta; p2.pos+=delta`; the original's
final `delta+p2.pos` is commutative in IEEE-754).

- **Gates:** verify ✓ byte-identical · diff ✓ max err 0 · compile-hash ✓ identical.
- **Perf (clean back-to-back, 20k / 8 reps):**

  | engine | mean ns/frame | median |
  |--------|---------------|--------|
  | B2 | 308,924 ± 5,415 | 308,958 |
  | **B3** | **275,710 ± 3,464** | **275,659** |

  **−10.8% mean / −10.8% median.** → **kept**.

### B4 — Scalar offset in `SolidLine.collide`/`collidesWith` — REVERTED
Tried replacing the `offset` V2 with scalars. Measured **~2% slower** (279,065 vs
273,690, 10 reps, medians cleanly separated). Reverted.

**Why it failed — a useful rule:** the `offset` V2 doesn't escape (it's local,
consumed immediately to compute two scalars), so V8's escape analysis already
scalar-replaces it — there was no real allocation to remove, and the manual
version is marginally worse codegen. **Only *escaping* allocations are worth
targeting** (returned, stored in a field, or captured into a persistent
structure). `stickResolve`'s temporaries escaped (returned) → B3 won big; the
grid's Immy versions/patches escape → B6 won huge; local throwaway vectors are
already free.

### B6 — Skip redundant grid re-versioning  ⭐ biggest win
`vendor/lr-core/line-engine/Frame.js` `addToGrid`. When several rider points land
in the same grid cell on the same frame (the common case — points cluster, so
their 3×3 neighborhoods overlap heavily), `addEntityToCellFrames` mutates that
cell's `CellFrame` in place and returns the **same** list. The old code still
called `withKeySetToValue(cell, sameList)` every time, creating a fresh
persistent map version + reverse patch for an unchanged value — and doing a
`Map.get`+`Map.set` on the grid map, which accumulates every cell ever visited
(thousands of entries). We now re-version only when the value reference actually
changed, cutting ~70 of ~90 grid writes/frame and shortening the patch chain.

- **Gates:** verify ✓ byte-identical · diff ✓ max err 0 · compile-hash ✓ identical.
- **Perf (clean back-to-back, 20k / 10 reps):**

  | engine | mean ns/frame | median |
  |--------|---------------|--------|
  | B3 | 273,340 ± 2,871 | 273,374 |
  | **B6** | **116,462 ± 1,519** | **116,027** |

  **−57.4% mean / −57.5% median.** A 2.35× speedup, bit-identical. → **kept**.

### B7 — Compute the 3×3 cell neighborhood once per entity
`_collideEntities` called `getCellsNearEntity(entity)` twice for each entity —
once inside `addToGrid`, once inside `getLinesNearEntity` — each allocating a
9-element array + 9 `hashIntPair`s. Compute it once and pass it to both (optional
`cells` param, backward-compatible with `NoGrid`).

- **Gates:** verify ✓ byte-identical · diff ✓ max err 0 · compile-hash ✓ identical.
- **Perf (clean back-to-back, 20k / 10 reps):**

  | engine | mean ns/frame | median |
  |--------|---------------|--------|
  | B6 | 117,908 ± 695 | 118,197 |
  | **B7** | **109,955 ± 853** | **110,053** |

  **−6.8% mean / −6.9% median.** → **kept**.

### B8 — Monomorphize Immo version objects  ⭐ second breakthrough
`vendor/lr-core/immo/index.js`. `updateState` created each new version via
`Object.create(this.__init__, {__state__})`, so a version's prototype was its
*original* instance. The ~12 rider points each have a distinct `__init__`, so the
per-frame version objects had ~12 distinct hidden classes → every `entity.pos` /
`.vel` / `.prevPos` / `.friction` access (the Immo accessors, used in every hot
path) was **megamorphic**. Rebuilt version creation to use the stable **class
prototype** with the immo slots as plain own properties in a fixed order
(`__props__`/`__computed__`/`__holder__` shared by reference, `__state__` a fresh
copy), and moved `__current__` into a shared one-slot holder. Now all versions of
all instances of a class share **one** hidden class → monomorphic loads.

- **Gates:** verify ✓ byte-identical · diff ✓ max err 0 · compile-hash ✓ identical.
- **Perf (clean back-to-back, 20k / 10 reps):**

  | engine | mean ns/frame | median |
  |--------|---------------|--------|
  | B7 | 109,334 ± 755 | 109,274 |
  | **B8** | **70,504 ± 820** | **70,655** |

  **−35.5% mean / −35.3% median.** Bigger than the ~23% megamorphic self-time —
  monomorphic receivers also unlock inlining downstream. → **kept**.

### B9 — Replace `Immy.List` with lightweight persistent cons-lists *(JM)*
`vendor/lr-core/line-engine/Frame.js`. The per-cell frame lists (`CellFrames`)
and per-line collision-index lists were `Immy.List`s, which carry the same
patch-based persistence overhead as `ImmyMap` (a node + reverse patch per push).
Replaced them with purpose-built immutable cons-lists — `CellFrameList` and
`IndexList` — each a `{value, parent, length}` node with O(1) `push` and fast
paths for exactly the accesses the hot path makes: `.last()` (newest), `.get(0)`
(oldest, via a tracked `first`), and `.get(size-1)` (newest). A flat array is
materialized lazily only on arbitrary-index access, which happens just in the
cold `_addLine` invalidation scan — never during forward simulation. Persistence
(push → new node, parent shared) is preserved, so frame forking/rollback is
unaffected.

- **Gates:** verify ✓ byte-identical · diff ✓ max err 0 · compile-hash ✓ identical.
- **Perf (clean back-to-back, 20k / 10 reps):**

  | engine | mean ns/frame | median |
  |--------|---------------|--------|
  | B8 (`Immy.List`) | 72,024 ± 902 | 71,717 |
  | **B9 (cons-lists)** | **63,408 ± 662** | **63,313** |

  **−12.0% mean / −11.7% median.** → **kept** (this is the "collapse the per-cell
  Immy-List churn" item from the frontier list below).

## Cumulative

Each row is the "after" of an independent back-to-back pair (absolute numbers
drift a little between runs with machine load; the per-step Δ is the reliable
figure). Compounding the measured per-step deltas: **≈ −17% vs pristine.**

| milestone | per-step Δ | note |
|-----------|-----------|------|
| pristine (point-mutation) | — | baseline 333,033 |
| B1 singleton updates | −2.8% | |
| B2 scarf off | −4.0% | |
| B3 scalar in-place stickResolve | −10.8% | V2 temporaries were the bulk of GC |
| B4 scalar collide offset | (reverted) | non-escaping → already free |
| B6 skip redundant grid versions | −57.4% | **the dominant cost; 333,033 → 116,462 overall (≈2.86×)** |
| B7 cells computed once per entity | −6.8% | 333,033 → 109,955 overall (**≈3.03×**) |
| B8 monomorphize Immo versions | −35.5% | **333,033 → 70,504 overall (≈4.72×)** |
| B9 cons-lists for cell/collision lists (JM) | −12.0% | **333,033 → 63,408 overall (≈5.25×)** |

**End-to-end confirmation:** the full `npm test` suite (245 tests) dropped from
~313 s (pristine) to ~89 s — a 3.5× faster suite, i.e. the per-frame win
compounds across the whole compiler, not just the microbenchmark.

## Profile evolution (where the time goes)

`node --prof` on a `mini_burst@8k` compile, % of non-library ticks:

| | pristine-ish (after B3) | after B6 | after B8 |
|---|---|---|---|
| GC | 45% | 7% | 9% |
| grid: `addToGrid` | 20% | 12% | 16% |
| grid: `FindOrderedHashMapEntry` | 9% | 13% | 18% |
| grid: `getLinesNearEntity`/`getCellsNearEntity` | 7% | 10% | 11% |
| megamorphic `LoadIC`/`KeyedLoadIC` | — | 20% | ~8% (half now in the detector, out of scope) |
| constraint `resolve` | <1% | <1% | <1% |

We flipped from **GC-bound → compute-bound**, and the remaining hot spot is the
**spatial-hashing grid** (~45% of in-scope time): ~180 `Map` lookups/frame on the
line grid + the per-frame entity grid, which accumulate every cell ever visited.

## Next frontier (deeper / higher-risk)

The grid is the last big bucket but it backs the `addLine` invalidation that
drives the search **budget**, so any change there must keep `compile-hash`
(sim_frames + search stats) byte-identical — the gate covers it, but it's an
algorithmic redesign, not a surgical edit. Candidate directions:
- Entity grid: collapse the per-cell Immy-List churn / avoid the double `Map.get`
  in `addToGrid`'s changed-value path.
- A flatter grid representation keyed for SMI-fast `Map` access with fewer
  lookups per entity.
The first item (per-cell Immy-List churn) is **done** — see B9. The remaining
grid `Map` cost (the line grid + entity-grid lookups, `FindOrderedHashMapEntry`)
is a larger, riskier redesign, deferred pending a careful design pass.

## Code-review follow-up (hardening, perf-neutral)

A medium-effort review of B1–B8 surfaced no live bugs (all gated green) but 8
latent-risk / maintainability items, all addressed in one bit-identical commit
(verify ✓, diff ✓ max err 0, compile-hash ✓, perf 70,636 vs 70,504 — no change):

1. `Stick` constructor now asserts `p1 !== p2` (the in-place `stickResolve`
   mutation's distinct-points invariant), once at setup, not per-frame.
2. `immo`: extracted a single `setImmoSlots()` used by both the constructor and
   `updateState`, so the property set+order that the B8 monomorphism depends on
   has one source of truth and can't silently drift.
3. `Rider`: scarf is now identified from the authoritative `parts.SCARF` (not by
   `FlutterPoint`/`DirectedChain` class type), and a guard asserts no kept
   constraint references a removed point.
4. `immo`: dropped the dead `__init__` slot (written, never read after B8; it was
   also a `this`-self-cycle footgun for any accidental serialization).
5. `Frame.setStates()` factors the "index entities by id" loop shared by
   `updateStateMap` and the engine's constraint pass.
6. Shared `COLLISION_UPDATE_TYPE` constant (`scripts/lib/update_types.ts`) used by
   both the detector and the trace oracle, so the gate's coverage is explicitly
   tied to what the detector reads.
7. `NO_UPDATES` (shared frozen empty) now returned from all no-op constraint
   branches (RepelStick/BindStick/BindJoint), not a fresh `[]`.
8. Noted `FlutterPoint`/`DirectedChain` as retained-but-unsimulated (scarf), and
   removed the derivable `Rider.stateData` field (filter inline).

---

# Session 2 (2026-06-05 cont.) — compiler-aware levers & runtime tuning

A second round after B9, asking a different question: does the **compiler's use of
the engine** (forking, candidate fan-out, re-reads) have wins, separate from the
engine internals? And can the **Node/V8 runtime** be tuned? Net: the compiler
harness turned out to be already lean and the engine already compute-bound, so the
compiler-aware levers were washes or already-implemented — but a V8 GC flag
delivered a clean, byte-identical **−7.8%**. The negative results are recorded
below so they aren't re-explored. (This session deliberately expanded scope beyond
`vendor/lr-core` to the runtime, at the user's request.)

## S3 — Split `verify` into engine + optimizer gates  (commit `2b39d48`)
The B-series were all engine-internal, covered by the per-frame oracle. But the
compiler-aware work touches the **optimizer/search path**, which that oracle never
exercises — it replays fixed tracks and never runs `compileHandoff`. The existing
optimizer tests (`v0_determinism`, `optimizer_handoff`) only assert
*self-consistency* (compile twice → same hash), not regression vs a baseline, so a
deterministic output change passes them green.

- Renamed `verify` → `verify:engine`. Added `verify:optimizer`: runs the real
  `compileHandoff` on 4 curated cases (the determinism test's small/medium/large
  sample + `mini_burst`, the perf spec) and hashes `{track, stats}` against a
  local gitignored baseline, mirroring the engine oracle's UX (`--update` to
  re-baseline; baseline captured on clean HEAD). `verify` runs both. ~12s.
- Proven: clean pass; corrupting a baseline hash exits non-zero, **names and
  classifies** the drift (`track bytes` vs `sim_frames` vs `lines`).

## Lever 1 — batch an arc's lines into one `addLine`  (wash; kept as readability, commit `855057b`)
`addLine` already accepts an array (`_modifyLinesList` reduces over it → one
`updateState` for the whole arc); the handoff path was adding arcs one segment at
a time. Switched the 5 arc-writing sites (`node.ts`, `candidate.ts` ×2,
`handoff.ts`, `reachability.ts`) to the array form.

- Gate: verify:optimizer ✓ byte-identical · 245/245 tests.
- Perf (back-to-back): **wash** — 68,248 → 68,279 (+0.04% mean, inside noise).
- **Why no win:** the engine already shares the simulated prefix across forks (the
  Immo computed cache is truncated only at the new line's collision and the prefix
  is reused), recomputing only the suffix — so arc-as-1-call vs arc-as-N-calls does
  identical *simulation* work; only trivial allocation bookkeeping differs, roughly
  cancelled by the `.map()` array. Kept purely as readability (single `const` expr
  vs reassign-in-loop), committed honestly as "no perf change."

## Lever 2 — share the prefix extract/detect across candidates  (already implemented)
Hypothesis: candidates re-extract/re-detect the shared trajectory prefix `[0,
gap.startFrame)` per candidate. **Already done:** the sampler hardcodes
`useWindowDetection=true` (`sample.ts:121`), so candidate eval runs
`detectWindow(eng, gap.startFrame, horizon)` → `extractRawTrajectoryWindow`, which
reads only `[gap.startFrame, horizon]`, not from frame 0. No redundancy to remove.

## Why compiler-aware levers are largely off the table
`cbench:prof` on `mini_burst@50k`: **~92% of wall-clock is the physics engine**,
only **~5% is the compiler/search** (extract + detect + candidate gen + scoring).
And the search **budget *is* `sim_frames`** (charged by `getLastFrameIndex`
deltas) — so any compiler-aware lever that simulates *less* reduces the budget →
reshapes the search → changes the compiled track. "Compiler-aware" and
"bit-identical" are therefore nearly mutually exclusive here; the only two that
were compatible are Levers 1–2, and both are spent.

- Measured the biggest budget-changing lever — **early-terminate doomed
  candidates** (skip simulating frames past the detector's terminus): instrumented
  `detect()`, only **~1.3–2.8%** of the eval window is past terminus (the horizon
  `gap.endFrame+20` is already tight). Even discarding bit-identity, ~2%. Not
  pursued.

Self-time profile of the compile (3 reps, `mini_burst@50k`):

| % | function | layer |
|---|---|---|
| 20.3% | `_collideEntities` | engine collision |
| 11.7% | `addToGrid` | engine grid (persistent map) |
| 8.2% | garbage collector | engine alloc |
| 6.9% | `getCellsNearEntity` | engine grid |
| 6.7% | `getLinesNearEntity` | engine grid |
| ~13% | constraint `resolve` + grid add/remove | engine |
| **~5%** | extract + detect + arc placement | **compiler/search** |

## B10 — reuse a scratch buffer in `getCellsNearEntity` — REVERTED
Tried returning a reused 9-element instance buffer (`this._cellScratch`) instead of
a fresh `[]` (allocated ~72×/frame, escapes to two consumers).

- Gate: verify:engine ✓ byte-identical · verify:optimizer ✓.
- Perf: **+6.6% slower** (69,403 → 73,975, ranges fully disjoint). Reverted.
- **Why it failed (B4 redux):** V8 handles short-lived small arrays superbly
  (young-gen bump allocation, packed-SMI shape, cheap collection). A long-lived
  instance-property buffer adds a property load per call + write barriers, and
  `hashIntPair` can exceed SMI range → element-kind transitions. The transient
  array wasn't a real cost — `getCellsNearEntity` is **compute-bound** (`Math.floor`
  + 9× `hashIntPair`), not alloc-bound. This confirms the per-frame *transient*
  allocations are already effectively free; the 8% GC comes from the **persistent**
  structures (frame-grid versions, `CollisionUpdate`), which are budget-load-bearing
  and can't be cheaply restructured. The cheap bit-identical engine wins are spent.

## Runtime / configuration (outside `vendor/lr-core`)

### Bun vs Node — Node (V8) wins
Same code under bun 1.3.14 (JSC) vs node (V8), identical output (50,729 frames):
bun **−18% slower** and ~5× noisier (81,742 vs 69,170 ns/frame). This compile is a
long-running, hot, monomorphic numeric loop — V8/TurboFan's strength — and the
whole B-series was tuned *to V8* (B8 hidden classes, escape-analysis reliance, B10).
JSC's strengths (startup/IO) don't apply. Stick with node.

### V8 young-gen tuning — −7.8%, byte-identical  (commit `088238f`) ⭐ session win
The 8% GC is young-gen scavenge pressure we can't cheaply remove (allocations are
load-bearing or already V8-optimized — see B10). Instead, enlarge the young
generation so V8 collects it less often. Pure GC tuning → output byte-identical
(`sim_frames` constant throughout; verify:engine ✓, verify:optimizer ✓, 245/245).

- Perf (drift-bracketed, real `npm run perf`): 68,776 → ~63,434 ns/frame,
  **−7.8%**, non-overlapping ranges. Sweet spot at semi-space **64** (≈ 128MB total
  young-gen); 128 ≈ equal, 256 regresses (larger scavenges).
- **Delivery matters** (two gotchas, both baked in): the flag must hit the
  *isolate that runs the compile*. Routed through the `tsx` binary or
  `NODE_OPTIONS`+`npm` it diluted to ~2–4%; as a direct `node
  --max-semi-space-size=64` flag, the full ~8%. And worker `execArgv` **rejects**
  `--max-semi-space-size` — use `resourceLimits.maxYoungGenerationSizeMb`, which is
  *total* young-gen, so **128 ≈ semi-space 64** (measured in-worker: 128 → −6.3%,
  64 → only −1.8%).
- Applied at every compile site: `perf`/`cbench` (node flag), golden **worker pool**
  (`maxYoungGenerationSizeMb:128`), serve dashboard spawn (`NODE_OPTIONS`). Memory
  +0.77GB worst case across the 6-worker pool (43GB free).

> Note: `npm run perf` now runs with `--max-semi-space-size=64`, so post-`088238f`
> ns/frame figures (~63k) reflect production config. Pre-`088238f` figures (~69k,
> flagless) are the comparison baseline. The −7.8% is config, not engine code, so
> it is not folded into the B-series cumulative table above.

## Session 2 conclusion — the remaining lever is WASM
Two negative results (Lever 1 wash, B10 regression) plus the profile establish that
the engine hot path has gone **compute-bound**: the easy bit-identical allocation
wins are exhausted (B1–B9 took them, 5.25×; transient allocs are now V8-free), and
what remains is genuine collision/grid compute (~50%) + constraint solves (~13%) +
persistent-structure GC (~8%, budget-load-bearing). The only remaining
*order-of-magnitude* lever is the **Rust→WASM engine rewrite** (flat zero-alloc
memory, native kernel) — the profile (collision+grid+GC ≈ 70%) is exactly its
thesis. Incremental JS engine tuning is past the point of useful return.

---

# Post-rebase (2026-06-05) — official-parity fix changes the standing

A rebase pulled in commit `0074fdb engine: snapshot frame grid entities for parity`
(JM) — a **correctness fix** — plus a new `LR_ENGINE=official` reference path for
parity probes.

## What it fixes
`addToGrid` stored the **live** stateMap entity reference in `frame.grid` (the
historical invalidation records `getIndexOfCollisionInCell` replays during a later
`addLine`). But since B3/B8 the solver mutates point `pos` **in place** — so a
stored grid entity's coordinates were silently overwritten by later frames before
the invalidation replay read them. `snapshotEntity` now stores an immutable copy
(id, friction, airFriction, collidable, steppable + pos/prevPos/vel vectors).

## Correctness: now byte-identical to OFFICIAL lr-core (a stronger guarantee)
- `verify:engine` ✓ byte-identical — forward simulation on fixed tracks never used
  the corrupted grid records (only `addLine` invalidation does).
- `verify:optimizer` **diverged** — `sim_frames` shifted (mini_burst 40484→40489,
  syncopated_switchback 40300→40313, drums_signature 40499→40503; tiny_dance
  unchanged at 40965). Confirmed against `LR_ENGINE=official`: the new output
  **matches official lr-core exactly** on all probed cases. So this is a strict
  upgrade — our prior baseline was subtly divergent from official; the new output
  is correct. Baseline re-recorded: the optimizer gate now pins
  **parity-with-official**, stronger than parity-with-our-pristine-snapshot.

## Perf cost: +27%
`snapshotEntity` allocates a fresh object + 3 vectors per `addToGrid` call
(~72–90×/frame) in the hottest path — heavy young-gen churn, exactly what B6–B9 +
the young-gen flag had driven down.

| | ns/physics-frame | note |
|---|---|---|
| snapshot OFF (pre-rebase) | 63,218 ± 531 | subtly divergent from official |
| **snapshot ON (current HEAD)** | **~80,491** (80,288 / 80,695) | **+27%**, official-parity |

Current standing: **~80,500 ns/frame** — correct, ≈4.1× vs pristine (333k), but the
young-gen win (−7.8%) and part of the grid wins are now masked by the parity
allocation.

## This reopens a cheap lever (revises the "only WASM left" conclusion)
The snapshot is over-copied. The invalidation replay path —
`getIndexOfCollisionInCell` → `hasCollisionWith` → `SolidLine.collidesWith` —
reads **only `p.pos` (offset) and `p.vel` (`shouldCollide`'s `norm·vel`)**. It never
reads `prevPos`/`friction`/`airFriction`/`collidable`/`steppable`/`id`; those are
used only by `collide()` (the forward-sim response, run on the *live* point, never
the snapshot). So `snapshotEntity` can drop to `{ pos:{x,y}, vel:{x,y} }` (2 vectors
vs an 8-field object + 3 vectors) — fewer/smaller allocations, **parity preserved**
because `collidesWith` is unaffected (gate: `verify:optimizer` must stay equal to
`LR_ENGINE=official`). This is the obvious next lever, ahead of WASM: recover much
of the +27% without giving up correctness.

## B11 — slim the frame-grid snapshot to `{pos, vel}`  (−10%, official-parity, commit `f6b39d1`)
Implemented the lever above: `snapshotEntity` now copies only `{ pos:{x,y},
vel:{x,y} }` instead of the full entity (8 fields + 3 vectors). Dropped the
`snapshotVector` helper (inlined).

- **Gates:** verify:engine ✓ byte-identical · verify:optimizer ✓ · **direct parity
  vs `LR_ENGINE=official` ✓** on mini_burst/drums_signature/syncopated_switchback ·
  245/245 tests.
- **Perf (drift-bracketed, 8 reps):**

  | snapshot | ns/physics-frame |
  |---|---|
  | full entity (post-rebase HEAD) | 81,144 ± 360 |
  | **slim `{pos, vel}`** | **~73,068** (72,947 / 73,189) |

  **−10.0%.** Recovers ~8k of the ~17k parity cost. The floor here is 3 object
  allocations per snapshot (outer + 2 coord vectors); they persist in the grid so
  can't be pooled, and going lower means a flat-grid redesign or changing the
  shared `collidesWith` signature — neither cheap-and-parity-safe. So this is the
  clean win.

**Standing after B11:** **~73,000 ns/physics-frame** — byte-identical to **official
lr-core**, ≈4.6× faster than pristine (333k). (The young-gen flag and B1–B9 still
apply; the residual gap vs the pre-parity ~63k is the irreducible snapshot
allocation, the price of correctness.)

## W1 — WASM raw-frame detector ABI  (−26%, bit-identical)
`engine-rs` now exposes `get_raw_frame`, which computes the detector hot-path read
in one cache sync: BODY position/velocity, the two binding states, and collision
events. The WASM wrapper returns the detector's `RawFrame` shape directly via an
optional `getRawFrameAtFrame` method, and `detector.ts` uses that fast path only
when the selected engine provides it. Non-WASM engines keep the generic
`getRider` + `getUpdatesAtFrame` path.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical.
- **Perf (`LR_ENGINE=wasm npm run perf`, 20 runs + 3 warmup):**

  | path | ns/physics-frame |
  |---|---|
  | accepted WASM baseline | 41,750.1 ± 1,196.2 |
  | **fused raw-frame ABI** | **30,879.4 ± 657.4** |

  **−26.0% mean / −26.3% median.** This is a boundary win: it removes one wasm
  call per extracted frame and avoids allocating lr-core-compatible rider/update
  objects the detector immediately reduces back into raw-frame fields.

## W2 — Cache the WASM scratch view and lazy point stateMap  (−4.7%, bit-identical)
The WASM scratch address is static; only the `memory.buffer` identity changes after
`memory.grow`. The wrapper now reuses one `Float64Array` scratch view until the
buffer changes, instead of allocating a view on every read. `getRider` also
memoizes its cold full-stateMap fallback, so multi-point probes (`PEG`/`TAIL`/
`NOSE`/`STRING`) build the map once per rider object instead of once per point.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical.
- **Perf (`LR_ENGINE=wasm npm run perf`, 20 runs + 3 warmup):** 30,879.4 →
  **29,414.7 ns/physics-frame** (**−4.7% mean / −4.7% median**).

## W3 — Pair wrapper allocation cuts with `wasm-opt`  (−3.9%, bit-identical)
Two sub-threshold changes only held when measured together: the wrapper reuses the
static events view and shared empty contact arrays for collision-free raw frames,
while `npm run build:wasm` now runs Binaryen `wasm-opt -O3` with the wasm features
Rust emits (`bulk-memory`, non-trapping float-to-int, sign-ext). Individually,
these were below the 2% commit bar; together they clear it.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical.
- **Perf (`LR_ENGINE=wasm npm run perf`, 20 runs + 3 warmup):** 29,414.7 →
  **28,259.2 ns/physics-frame** (**−3.9% mean / −4.5% median**).

## W4 — Bit-mixing grid hasher + `codegen-units=1`  (−18%, bit-identical)
The per-frame hot loop (`kernel.rs::step_state`) does ~540 `cell_lines.get` + ~540
`hist.entry` HashMap ops per physics frame. The maps use a custom `IntHasher`
(`engine-rs/src/grid.rs`) that folded each integer key in **verbatim** (identity).
But std `HashMap` is hashbrown/SwissTable: it derives the home bucket from the low
bits **and a 7-bit control tag from the top 7 bits** of the hash. The keys are
small-magnitude Szudzik cell ids / small line ids, so identity hashing left the top
bits ~all zero — every key shared the same control tag, defeating the SIMD tag
filter and degrading every probe. `IntHasher::finish` now multiplies the folded key
by the golden-ratio odd constant `0x9E3779B97F4A7C15`, spreading entropy into both
the tag and bucket bits. Multiply-by-odd is bijective on u64, so no two distinct
keys collide; the hash affects only internal probe order/slot placement, never
key→value mapping or output ordering (bucket *contents* order is set explicitly by
`push_line`'s descending-id insert and by append order in `hist`/`coll`, and no map
is ever iterated in hash order to produce output). Bundled with it: `codegen-units=1`
in `Cargo.toml` `[profile.release]` (one codegen unit before LTO → more aggressive
cross-function inlining; pure codegen, no fast-math, so float op order is preserved).

The hasher is the headline; `codegen-units=1` measured ~−1.9% alone (marginal,
sub-2%), so it is bundled per the commit rule. `wasm-opt --converge` was also
evaluated and **dropped** — on the already-`-O3` binary it changed size by 90 bytes
(52,958 → 52,868), an unmeasurable runtime effect well below the bar.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical (engine fingerprint +
  optimizer hash) · `verify:engine --diff` ✓ **max err 0** over 1500/1220/1220/2260/
  740 frames across all 5 fixtures.
- **Perf (`LR_ENGINE=wasm npm run perf`, 20 runs + 3 warmup, back-to-back):**

  | engine | mean ns/frame | median |
  |--------|---------------|--------|
  | W3 baseline (this machine) | 28,727.2 ± 574.8 | 28,836.2 |
  | + `codegen-units=1` | 28,187.1 ± 591.7 | 28,262.9 |
  | **+ bit-mixed hasher (bundle)** | **23,543.9 ± 615.9** | **23,635.3** |
  | bundle (confirm run) | 23,189.7 ± 613.5 | 23,286.8 |

  **−18.0% mean / −18.0% median** vs the W3 baseline (the hasher alone accounts for
  ~−16.5% on top of `codegen-units`). Far above the ~2% noise band → **kept.**

**Standing after W4:** **~23,400 ns/physics-frame** — bit-identical to lr-core,
≈14.3× faster than pristine JS (333k) and ≈3.1× faster than the parity-correct JS
engine (B11 ~73k). The grid HashMap traffic is no longer probe-bound; the next
levers are the fixed per-frame math (irreducible without breaking bits) and the
fork-reconcile `Line` clones (deferred — high review cost, touches the
path-dependent budget).

## W5 — Integrate constraint-solver unroll + lean rider sled points  (−4%, bit-identical)
Two changes ported from the parallel `work-new-wams-opti-1` branch (which had forked
from the same W3 base) that compose cleanly with W4:
- **Unroll the constraint solver** (`engine-rs/src/kernel.rs`): the `for k in
  0..NITER { match kind … }` loop over the `ITER` table is replaced with 22 explicit
  `resolve_stick`/`resolve_repel`/`resolve_bind` calls in the table's exact order.
  Same ops, same order, so bit-identical. `resolve_bind` also defers the `dist`
  (sqrt) into the `fsu == -1` branch — the original computed `length` unconditionally
  but discarded it for already-unbound binds, so skipping that side-effect-free sqrt
  changes no state (free win for the airborne rider whose binds are intact).
- **Lean rider sled points** (`engine-rs/src/engine.rs` `rider_into` + the WASM
  wrapper): `get_rider` now also writes the PEG/TAIL/NOSE/STRING point states into
  scratch slots 6..29, and the wrapper serves those four ids from the lean payload
  instead of falling back to the cold full 12-entity stateMap rebuild. Read-path
  only; the values are identical to the fallback's.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical · `verify:engine
  --diff` ✓ **max err 0** over all 5 fixtures · `cargo test` ✓ (grid unit tests).
- **Perf (`LR_ENGINE=wasm npm run perf`, 20 runs + 3 warmup, back-to-back):**
  W4 baseline 23,189.7 / 23,286.8 → **22,486.8 / 22,637.8** (first), 21,870.9 /
  21,965.8 (confirm). **≈−4% mean / −4% median** → **kept.**

### W6 (rejected) — custom open-addressing integer grid map
The same branch's third commit replaced `std::HashMap` (with our identity `IntHasher`)
by a hand-rolled `Vec`-backed open-addressing `IntMap` (linear probing, golden-ratio
32-bit hash). It claimed −13.4% **there** — but that was measured against an
*identity-hashed* HashMap baseline that **W4 already superseded**. Applied on top of
W4+W5 and measured back-to-back against the bit-mixed `std::HashMap`, it **regressed**:
23,704.6 / 23,832.9 and 23,834.6 / 23,974.9 vs the hasher's 21,870.9 / 21,965.8 —
**≈+8% slower** (well outside the ~2% noise band; `verify` stayed byte-identical, so
this is purely a speed verdict). hashbrown's SIMD group probing beats the hand-rolled
linear-probe map once the key hash distributes well, which the W4 finalizer already
ensures. **Not integrated.**

**Standing after W5:** **~22,000 ns/physics-frame** — bit-identical to lr-core,
≈15.1× faster than pristine JS (333k).

## W6 — Integrate the `work-new-wams-opti-2` stack + re-mix the residual maps  (−27%, bit-identical)
The parallel `work-new-wams-opti-2` branch (also forked from the W3 base) carried a
deeper, interdependent set of engine rewrites that are largely **orthogonal** to W4/W5
and far faster. Adopted its four-commit stack wholesale (its kernel rewrite supersedes
W5's simpler unroll), then re-layered the parts of W4/W5 it does not contain:

- **Flat per-frame cache logs** (`engine.rs`, `frame.rs`): collision events, touched
  history cells, and touched collision-line ids move from per-frame `Vec<Vec<_>>` to
  flat vectors with per-frame offset tables — same replay/rollback slices, no per-frame
  inner-`Vec` churn in `compute_to`.
- **Arena-backed history-grid snapshots** (`frame.rs`, `engine.rs`, `kernel.rs`,
  `abi.rs`): the dominant remaining allocator bucket. `CellFrame` keeps its first
  snapshot inline and links extra same-cell/same-frame snapshots through one
  cache-owned flat `SnapNode` arena, truncated by per-frame offsets on rollback.
  Invalidation asks the same `any-snapshot-collides?` question; scan order is
  unobservable because `collides_with` is pure. **This is the headline win.**
- **Specialized kernel topology** (`kernel.rs`): the fixed rider topology lets the
  solver use unchecked array access, a const-generic tracked/untracked split, and 22
  explicit constraint calls in the original order (superset of W5's unroll).
  Arithmetic order is unchanged.
- **Flat open-addressed map for `cell_lines`** (`grid.rs`, `line.rs`): the hot
  collision-lookup grid moves off `std::HashMap` to a purpose-built open-addressed
  integer map (murmur-mix hash); cell buckets keep the same descending-id `Vec<Line>`.
  `hist`/`coll`/`lines_cells` stay on `std::HashMap`.

Re-layered on top (not present in opti-2): **`codegen-units=1`** (W4, untouched), the
**lean rider sled-points** payload (W5 — `rider_into` re-extended to write
PEG/TAIL/NOSE/STRING into scratch; wrapper untouched), and the **bit-mix hasher** (W4)
re-applied to `IntHasher::finish` — opti-2 left `hist`/`coll`/`lines_cells` on the
identity-hashed `std::HashMap`, and `hist.entry` is ~540 ops/frame, so the finalizer
still pays off there even though `cell_lines` now uses the flat map.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical (engine fingerprint +
  optimizer hash) · `verify:engine --diff` ✓ **max err 0** over all 5 fixtures ·
  `cargo test` ✓.
- **Perf (`LR_ENGINE=wasm npm run perf`, 20 runs + 3 warmup, back-to-back):**

  | stage | mean ns/frame | median |
  |-------|---------------|--------|
  | W5 standing (this machine) | ~22,000 | ~22,000 |
  | opti-2 stack + `codegen-units` + lean rider | 17,058.0 ± 268.1 | 17,013.5 |
  | **+ bit-mix hasher on residual maps** | **16,167.3 ± 246.3** | **16,138.8** |
  | hasher (confirm run) | 15,803.8 ± 241.0 | 15,793.4 |

  **≈−27% vs the W5 standing**, the bulk from the arena snapshots; the residual-map
  hasher adds a further **−5.2% / −5.1%** on its own (17,058 → 16,167) → **kept.**
  (Absolute numbers are not comparable to opti-2's own log, which was measured on
  Binaryen 130; this machine's `wasm-opt` is v108. The relative wins hold.)

**Standing after W6:** **~16,000 ns/physics-frame** — bit-identical to lr-core,
≈20.8× faster than pristine JS (333k) and ≈4.6× faster than the parity-correct JS
engine (B11 ~73k).

## Session 3 (2026-06-05 cont.) — data-structure probes, no kept engine change

At the current W6 standing the easy map/allocator wins are largely exhausted.
Default `perf` was increased from **20 → 30 timed runs** (+3 warmup unchanged) to
reduce noise now that one full WASM compile is cheap enough. Current 30-run
standing:

```
LR_ENGINE=wasm npm run verify  ✓ byte-identical
LR_ENGINE=wasm npm run perf    15,855.9 ns/physics-frame ± 310.1
median 15,869.1, range [14,817.7 … 16,557.7], frames=50,415, runs=30
```

Rejected probes, all reverted:

- **History grid on `FlatIntMap` instead of hashbrown/std `HashMap`:** regressed
  to **17,635 ns/frame** on an 8-run signal. W6's custom flat map is still right
  for `cell_lines`, but hashbrown remains better for the mutating history grid.
- **Per-frame active-cell cache for repeated history-grid writes:** regressed
  (lookback 32: **16,097 ns/frame**; lookback 8: **17,897 ns/frame**). Extra
  side-cache scans/pointers cost more than the hash lookups they skip.
- **`get_mut`+`insert` split instead of `entry(...).or_default()`:** regressed to
  **16,669 ns/frame**. The entry API still generates the better path here.
- **Force-inline `add_to_grid`/`add_to_cell`:** not a win (**16,032 ns/frame**).
- **WASM wrapper last-frame hint:** regressed/noise (**16,082 ns/frame**). The
  default extraction path only needs a trailing `getLastFrameIndex` per window,
  not per frame, so the hint bookkeeping is not worthwhile.
- **Stronger Murmur-style finalizer for residual `HashMap`s:** regressed to
  **16,690 ns/frame**. The current one-multiply finalizer is the right balance:
  it fixes SwissTable's high-bit control tags without spending too many cycles per
  integer key.

Crate/data-structure conclusion: no obvious drop-in crate is likely to beat the
current code. `std::collections::HashMap` is already hashbrown/SwissTable, and the
residual maps already use a tiny deterministic integer hasher tuned for this key
shape. `nohash`/identity hashing is the W4 failure mode (bad high-bit tags);
stronger hashers (`aHash`, foldhash-style, Murmur-style) add work that the integer
key distribution does not repay; `rustc-hash` is plausible but its own guidance
matches our result — for single integers, spending more cycles on hash quality
often does not win. A future crate-backed experiment that still looks defensible
is **direct `hashbrown` with raw-entry/prehashed APIs** for one residual map, but
only if a profile shows `Hash`/entry overhead specifically rather than table
probing or value work. The larger remaining wins are structural: frame storage /
rollback representation, line clone/reconcile shape, or moving more detector work
inside the WASM boundary.

## W7 — Direct-mapped active history-cell cache  (−11.4%, bit-identical)
The profiled hot function after W6 was still `add_to_grid`: every tracked snapshot
records into a 3×3 history-cell neighborhood, and most rider points overlap the
same cells within a physics frame. The rejected vector lookback cache proved the
hit rate exists but scans are too expensive. Replaced that with a tiny direct-mapped
`ActiveCellCache` (128 slots): `cell → *mut current CellFrame`, scoped by a
monotonic per-step epoch. On a hit, `add_to_cell` appends the `SnapNode` directly
to the current frame's node and skips `HashMap::entry`.

Safety/identity notes:
- Epochs are not frame numbers, so rollback and re-simulation of the same frame
  index cannot reuse stale pointers.
- The pointer targets the `Vec<CellFrame>` allocation for that cell. Rehashing the
  outer `HashMap` moves the `Vec` header, not the element buffer; the only operation
  that can reallocate the cell's buffer is starting a new `CellFrame`, and the cache
  pointer is refreshed immediately after that push.
- Snapshot insertion order inside a same-frame node is unchanged (`rest_head` push),
  and invalidation only asks "does any snapshot in this node collide?", so output
  stays byte-identical.

Slot tuning (8 reps + 2 warmup): 64 slots **14,455 ns/frame**, 128 slots
**14,202 ns/frame**, 256 slots **14,233 ns/frame** → kept 128.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical · `cargo test
  --manifest-path engine-rs/Cargo.toml` ✓.
- **Perf (`LR_ENGINE=wasm npm run perf`, 30 runs + 3 warmup):**

  | stage | mean ns/frame | median |
  |-------|---------------|--------|
  | W6 standing (30-run default) | 15,855.9 ± 310.1 | 15,869.1 |
  | **W7 active-cell cache** | **14,055.5 ± 376.2** | **14,129.4** |

  **−11.4% mean / −11.0% median**, well above the 1.6% commit bar → **kept**.

**Standing after W7:** **~14,100 ns/physics-frame** — bit-identical to lr-core,
≈23.7× faster than pristine JS (333k) and ≈5.2× faster than the parity-correct JS
engine (B11 ~73k).

## W8 — Direct-mapped line-cell lookup cache  (−3.4%, bit-identical)
After W7, `add_to_grid` was reduced but the fused compute loop still probed the
collision line grid for the same overlapping 3×3 cell neighborhoods. Added a
second tiny frame-local cache, `LineCellCache`, for `cell_lines.get(cell)` results
in `kernel.rs`. It caches both hits and misses (`cell → *const Vec<Line>` or null)
for the current physics frame, then falls back to the existing `FlatIntMap` probe
on a miss. The line grid is immutable during a frame, so the cached pointer is
stable until the next `begin_frame`; any `addLine`/`removeLine` happens outside
the step and cannot reuse the prior epoch.

Tuning: 128 slots **13,614 ns/frame**, 64 slots **13,431 ns/frame**, 32 slots
**14,123 ns/frame** on the 8-run signal → kept 64.

Rejected post-W7 probes, all reverted:
- `cells_near_entity` shared signed-coordinate encodings: **14,297 ns/frame**.
- Force-inline active-cache helpers / `add_to_grid`: **14,554 ns/frame**.
- Modest upfront reserves for cache vectors: **14,631 ns/frame**.
- Low-bit active-history-cache slot index instead of multiply: **14,400 ns/frame**.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical · `cargo test
  --manifest-path engine-rs/Cargo.toml` ✓.
- **Perf (`LR_ENGINE=wasm npm run perf`, 30 runs + 3 warmup):**

  | stage | mean ns/frame | median |
  |-------|---------------|--------|
  | W7 standing | 14,055.5 ± 376.2 | 14,129.4 |
  | **W8 line-cell cache** | **13,580.1 ± 315.8** | **13,582.8** |

  **−3.4% mean / −3.9% median**, above the 1.6% commit bar → **kept**.

**Standing after W8:** **~13,600 ns/physics-frame** — bit-identical to lr-core,
≈24.5× faster than pristine JS (333k) and ≈5.4× faster than the parity-correct JS
engine (B11 ~73k).

## Session 4 (2026-06-05 cont.) — crate/data-structure follow-up, no kept change

Post-W8 profile still has most self time in the WASM compute path, especially the
fused step/collision loop (`wasm-function[29]`) and history recording
(`wasm-function[24]`). JS `pointSegmentCollisionRisk`/detector work is visible but
smaller, so a Rust-side data-structure probe was still the right next experiment.

Rejected crate probes, all reverted:

- **`hashbrown 0.17.1` as a like-for-like replacement for residual `IntMap`:**
  bit-identical, but regressed to **14,742 ns/frame** on an 8-run signal. The
  standard map is already SwissTable-backed, and the crate swap did not improve
  this WASM build.
- **`hashbrown` raw-entry/prehashed append path for `HistGrid` and
  `Collisions`:** bit-identical and better than the plain crate swap, but still
  slower than W8 at **14,227 ns/frame** on the same 8-run signal. Rebuilt the
  no-dependency W8 implementation afterward and measured **13,893 ns/frame** on
  the dirty-worktree 8-run signal.

Conclusion: there is still no drop-in crate that looks adequate for the current
hot path. The only crate API that should have had a fair chance (`hashbrown`
raw-entry with our exact precomputed integer hash) could not beat the committed
`std::HashMap` + direct-mapped frame caches. `rustc-hash`, `foldhash`, `ahash`,
and `nohash` remain unattractive here: this is dominated by integer-key probing,
cache locality, and value work, not by generic hash quality. The next real wins
are more likely structural: reduce history-recording volume, change the
`CellFrame` storage/rollback shape, or avoid crossing back into JS for detector
queries that repeatedly read WASM frames.

## W9 — Shared history snapshot arena  (−2.3%, bit-identical)

`add_to_grid` remained a hot WASM function after W8. Each history snapshot is the
same `(px, py, vx, vy)` value fanned out into the entity's 3×3 cell neighborhood,
but the old storage copied that 32-byte `Snap` into every touched cell frame/link.
Changed the history representation so `add_to_grid` pushes one `Snap` into a
shared `hist_snap_values` arena and stores compact `i32` snap indices in
`CellFrame.first` / `SnapNode`. Rollback now truncates both the link arena and the
value arena. `index_of_collision_in_cell` follows the indices when scanning
candidate invalidations, so the predicate is unchanged.

Safety/identity notes:
- The shared snap value is frame-scoped and truncated with the same frame rollback
  boundary as the old snap-link list.
- Same-frame snapshot order still does not affect observable output:
  invalidation asks whether any snapshot in a cell/frame collides, then returns
  that frame index.
- The `sim()` ABI harness passes a dummy snap-value arena; `TRACK=false` never
  records history.

Rejected probe:
- Manual unroll of the fixed 9-cell `add_to_grid` loop: bit-identical, but
  regressed to **15,056 ns/frame** on an 8-run signal. The compact loop remains
  better after `wasm-opt`/V8.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical.
- **Perf (`LR_ENGINE=wasm npm run perf`, 30 runs + 3 warmup):**

  | stage | mean ns/frame | median |
  |-------|---------------|--------|
  | W8 standing | 13,580.1 ± 315.8 | 13,582.8 |
  | **W9 shared snap arena** | **13,115.4 ± 431.6** | **13,130.1** |

  **−3.4% mean / −3.3% median**, above the 1.6% commit bar → **kept**.

**Standing after W9:** **~13,100 ns/physics-frame** — bit-identical to lr-core,
≈25.4× faster than pristine JS (333k) and ≈5.6× faster than the parity-correct JS
engine (B11 ~73k).

## Session 5 (2026-06-05 cont.) — vendored lr-core follow-up, no kept change

Compared the post-W9 Rust path against the optimized vendored lr-core files:
`Frame.js`, `LineEngine.js`, `ClassicGrid.js`, `SolidLine.js`, and Immo. Most
vendored wins are already represented in Rust/WASM: shared `getCellsNearEntity`
work, direct per-cell line-bucket iteration, mutable point collision response,
minimal `{pos, vel}` history snapshots, singleton non-collision updates in the JS
wrapper, and re-versioning history only when a cell receives a new frame node.

Rejected probe, reverted:

- **Delay `line_pos` until after direction/perpendicular collision checks:**
  `SolidLine.js` notes normalized line-position as the slow part of collision.
  In Rust this was bit-identical, but full perf regressed to
  **13,449.5 ns/frame** (median **13,540.4**) versus W9's **13,115.4**. The
  extra branch shape costs more in the optimized WASM loop than the skipped dot
  products save.
- **WASM monotonic read metering / metered `getRider` export:** bit-identical and
  preserved `sim_frames`, but did not clear the commit bar. Monotonic JS-side
  charging alone measured **13,015.3 ns/frame** (median **13,035.0**); the combined
  Rust metered-rider export measured **13,126.2 ns/frame** (median **13,154.1**).
  Both are within W9 noise and below the required >1.6% win.
- **Post-W9 cache-size retune:** `LineCellCache` 128 slots (**13,237.6**) and 32
  slots (**13,553.0**) both lost to local W9 64-slot signal (**12,907.2**).
  `ActiveCellCache` 256 slots (**13,163.7**) and 64 slots (**13,370.6**) both lost
  to W9's 128-slot setting. Constants restored.

Conclusion: the vendored engine is a useful checklist, but no remaining obvious
vendored micro-optimization is unported and profitable. The next likely wins are
outside literal lr-core parity tricks: bulkier WASM-side detector/raw-frame
extraction, further history-storage reductions, or a larger change to the
step/history contract.

## W10 — Precomputed pre-target line-risk geometry  (−2.8%, bit-identical)

The CPU profile after W9 showed the largest non-WASM hotspot in
`hasPreTargetSledProximityFromTrace` / `pointSegmentCollisionRisk`, where every
pre-target sled point recomputed the same candidate-line `dx`, `dy`, `hypot`, and
`len * len`. This mirrors the vendored `SolidLine.getComputed()` idea, but on the
optimizer-side impact-anchor preclear path rather than the core engine.

Changed `hasPreTargetSledProximityFromTrace` to prepare compact per-line risk
records once per candidate, then reuse them across all traced sled points. The
boolean predicate is unchanged: same along-line bounds check, same signed-distance
side check, same `IMPACT_ANCHOR_PRECLEAR_DISTANCE`.

Drift bracket:

| stage | config | mean ns/frame | median |
|-------|--------|---------------|--------|
| W9 baseline, source-clean except log | 8 runs + 2 warmup | 13,297.0 ± 408.3 | 13,313.5 |
| prepared line-risk geometry | 8 runs + 2 warmup | 12,834.7 ± 357.3 | 12,854.3 |

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical.
- **Perf (`LR_ENGINE=wasm npm run perf`, 30 runs + 3 warmup):**

  | stage | mean ns/frame | median |
  |-------|---------------|--------|
  | W9 standing | 13,115.4 ± 431.6 | 13,130.1 |
  | **W10 prepared line-risk geometry** | **12,830.9 ± 436.1** | **12,902.0** |

  **−2.2% mean / −1.7% median**, above the 1.6% commit bar → **kept**.

**Standing after W10:** **~12,830 ns/physics-frame** — bit-identical to lr-core,
≈26.0× faster than pristine JS (333k) and ≈5.7× faster than the parity-correct JS
engine (B11 ~73k).

## W11 — Flat preclear trace/risk arrays  (−4.4%, bit-identical)

W10 moved repeated line geometry out of the inner pre-target sled proximity loop,
but the profile still showed `hasPreTargetSledProximityFromTrace` and
`readPreTargetSledTrace` as visible JS work. The remaining overhead was mostly
shape/iteration churn: the trace stored `{ frame, points: [{ x, y }] }` even
though the proximity predicate never reads `frame`, and prepared line-risk records
were small objects consumed in the innermost loop.

Changed the preclear data to flat numeric arrays:

- `PreTargetSledTrace` is now an x/y number sequence in the same frame-major,
  `SLED_POINTS` order as before.
- Prepared line-risk geometry is now a numeric stride
  `[x1, y1, dx, dy, len, lenSq, flippedFlag]`.
- The predicate is inlined in the nested loop with the same arithmetic order and
  branch conditions as W10.

Safety/identity notes:
- The check order is unchanged: ascending frame, sled point order, candidate line
  order.
- The trace frame number was not read by any caller; it was allocation-only
  metadata.
- Same along-line bounds, signed-distance side check, and
  `IMPACT_ANCHOR_PRECLEAR_DISTANCE`.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical.
- **Signal (`LR_ENGINE=wasm npm run perf -- --reps=8 --warmup=2`):**
  **12,548.0 ± 279.8** ns/frame, median **12,539.7**.
- **Perf (`LR_ENGINE=wasm npm run perf`, 30 runs + 3 warmup):**

  | stage | mean ns/frame | median |
  |-------|---------------|--------|
  | W10 standing | 12,830.9 ± 436.1 | 12,902.0 |
  | **W11 flat preclear arrays** | **12,265.0 ± 409.0** | **12,277.2** |

  **−4.4% mean / −4.8% median**, above the 1.6% commit bar → **kept**.

**Standing after W11:** **~12,265 ns/physics-frame** — bit-identical to lr-core,
≈27.2× faster than pristine JS (333k) and ≈6.0× faster than the parity-correct JS
engine (B11 ~73k).

## Session 6 (2026-06-05 cont.) — raw-frame / small-structure probes, no kept speed change

The perf harness default was raised from 30 to **40 timed runs** (+3 warmup) to
reduce decision noise now that the WASM engine is fast enough for longer samples.

Rejected probes, all reverted:

- **Packed raw trajectory extraction for the WASM detector path:** added a
  WASM-only packed raw trajectory plus a `detect()` fast branch to avoid per-frame
  `RawFrame` object construction. `LR_ENGINE=wasm npm run verify` stayed
  bit-identical, but the 8-run signal regressed to **13,059.7 ns/frame** (median
  **13,082.7**). The extra branch/packed-array path cost more than the object
  allocation it removed.
- **Cache `process.env` object for arc-placement env toggles:** bit-identical, but
  only a weak 8-run signal at **12,516.8 ns/frame** (median **12,486.2**), below
  the commit bar and consistent with prior JS-overhead probes. Reverted.
- **Field-snapshot `engineLineFromTrackLine` cache instead of signature strings:**
  bit-identical and positive, but the full 40-run perf was **12,178.1 ns/frame**
  (median **12,209.3**) versus W11's **12,265.0** — only ~0.7% mean, below the
  >1.6% commit bar. Reverted.
- **Packed Rust collision event records (`i64` instead of tuple):** bit-identical,
  but the 8-run signal was weak/regressive at **12,586.3 ns/frame** (median
  **12,716.3**). Reverted and rebuilt the standard artifact.

Conclusion: the obvious remaining JS-boundary and small-structure changes are
too small or counterproductive in isolation. Future work should bias toward a
larger structural change in the WASM history/frame-cache path or moving a whole
detector workflow across the WASM boundary, rather than making another tiny
object-shape/cache tweak.

## Session 7 (2026-06-05 cont.) — current hot-path profile and rejected WASM probes

Fresh profile (`LR_ENGINE=wasm`, 6 runs + 1 warmup) on the current dirty worktree
again showed the same shape: `wasm-function[30]` fused step/collision loop
~31%, `wasm-function[25]` history `add_to_grid` ~28%, `wasm-function[17]`
3×3 cell hashing ~7%, GC ~5%. JS-side hotspots were each ~1% or less
(`getRawFrameAtFrame`, `detect`, `engineLineSignature`, `envValue`), confirming
that further small JS object/cache tweaks are unlikely to clear the bar.

Rejected probes, all reverted:

- **Force-inline `cells_near_entity` / `hash_int_pair` / `cell_cor`:** verified
  bit-identical and did inline into the large step loop, but code growth only
  produced **12,300.1 ns/frame** on the 8-run signal (median **12,402.4**), below
  the bar.
- **Avoid recomputing `ActiveCellCache` slot on miss:** verified bit-identical,
  but only **12,495.9 ns/frame** on the 8-run signal (median **12,548.6**), below
  the bar.
- **Binaryen `--traps-never-happen`:** verified bit-identical, but the 8-run
  signal was **12,265.9 ns/frame** (median **12,316.3**), effectively W11.
- **Binaryen `--inline-functions-with-loops`:** verified bit-identical, but
  regressed to **12,542.3 ns/frame** on the 8-run signal (median **12,611.1**).
- **Positive-coordinate fast path for `cells_near_entity`:** verified
  bit-identical, but only **12,300.8 ns/frame** on the 8-run signal (median
  **12,351.1**), below the bar.

The standard artifact was rebuilt afterward and `LR_ENGINE=wasm npm run verify`
passed.

## Session 8 (2026-06-05 cont.) — flat history-snapshot invalidation tradeoff, rejected

Tested a larger structural swap for the hottest history path: instead of fanning
each history snapshot out into its 3×3 cell nodes during simulation, record each
snapshot once in the per-frame snap arena and, on `addLine`, scan frames
chronologically for the first snapshot that both collides with the new line and
has a 3×3 cell intersecting the line's `classicCells`.

This preserved the observable invalidation result under `LR_ENGINE=wasm npm run
verify` and initially looked promising:

- Dirty probe, old indexed code still present: **11,704.9 ns/frame** on 8 runs
  (median **11,684.2**).
- Cleaned probe, old history-grid plumbing removed: **11,951.6 ns/frame** on
  8 runs (median **11,958.8**).

However the required full gate did **not** hold:

| stage | config | mean ns/frame | median |
|-------|--------|---------------|--------|
| W11 standing | 30 runs + 3 warmup | 12,265.0 ± 409.0 | 12,277.2 |
| flat history-scan probe | 40 runs + 3 warmup | 12,282.7 ± 451.0 | 12,386.7 |

The tradeoff moves too much work into `addLine` invalidation for this compiler
shape; the short run under-sampled that cost. Reverted and rebuilt the standard
artifact; `LR_ENGINE=wasm npm run verify` passed afterward.

## Session 9 (2026-06-05 cont.) — vendored lr-core data-structure probes, no kept speed change

Re-read the vendored `lr-core` hot-path structures against the Rust port:

- `ClassicGrid` stores per-cell line buckets in descending line-id order with
  duplicate cell visits preserved. The Rust port already mirrors the observable
  order and intentionally visits per-cell buckets directly instead of allocating
  a candidate line array.
- `LineEngine._collideEntities` precomputes the 3×3 cell neighborhood once for
  both history recording and line lookup. The Rust port already does the same.
- `Frame` stores only `{pos, vel}` snapshots for invalidation, and `IndexList`
  caches the first collision frame. The Rust port already uses compact snapshot
  arenas and direct `Vec` lists with the same first-index behavior.
- `Immo`'s major trick is one shared mutable computed cache per version lineage;
  the Rust port already models that with holders, version nodes, and LCA patch
  replay.

Rejected probes, both reverted:

- **Ascending internal line buckets + reverse collision iteration:** preserved
  descending observable order under `LR_ENGINE=wasm npm run verify`, but the
  8-run signal regressed to **12,552.2 ns/frame** (median **12,513.8**). The
  collision-loop cost of reverse iteration outweighed cheaper monotonic appends.
- **Descending bucket high-id fast path:** preserved bit identity, but the
  8-run signal was **12,537.8 ns/frame** (median **12,597.3**), also worse than
  W11. Avoiding the duplicate scan in `push_line` is not material for this
  compile shape.

Crate/data-structure assessment: no dependency looks like an obvious win for
the current hot path. `smallvec`/`arrayvec` are attractive for tiny buckets, but
inline storage would bloat `FlatIntMap` values unless combined with a pool of
small ids, and the pool/indirection shape is risky for the collision loop.
`hashbrown`/`rustc-hash` do not clearly improve over the existing integer
hasher plus custom `FlatIntMap`; the hottest map is already specialized.
`bumpalo` fits phase-oriented allocation, but this engine already uses reusable
`Vec` arenas and needs fine-grained rollback, so arena reset semantics do not map
cleanly to the shared frame cache.

## Session 10 (2026-06-05 cont.) — cache-size / raw-frame / history probes, no kept speed change

Short CPU profile on the actual target path (`LR_ENGINE=wasm`, `perf` mini_burst,
6 timed runs + 1 warmup) confirmed the standing shape:

- `wasm-function[30]` fused solver/collision loop: **32.6%**
- `wasm-function[25]` history `add_to_grid`: **26.3%**
- `wasm-function[17]` 3×3 cell hashing: **7.1%**
- GC: **4.6%**
- Largest JS items: `getRawFrameAtFrame` **2.3%**, `pointStateFrom` **1.3%**,
  `detect` **1.1%**, `engineLineSignature` **0.9%**

Rejected probes, all verified bit-identical under `LR_ENGINE=wasm npm run verify`
and reverted:

- **Bigger direct-mapped frame caches:** `LineCellCache` 64→128 and
  `ActiveCellCache` 128→256 gave **12,286.3 ns/frame** on 8 runs (median
  **12,306.9**), effectively baseline and below the bar.
- **ActiveCellCache-only 128→256:** regressed to **12,454.6 ns/frame** (median
  **12,451.2**).
- **LineCellCache-only 64→128:** weak at **12,338.7 ns/frame** (median
  **12,310.8**), below the bar.
- **Pre-encode 3×3 cell coordinates in `cells_near_entity`:** mirrored vendored
  `ClassicGrid`'s reuse of encoded x/y coordinates, but regressed to
  **12,483.4 ns/frame** (median **12,486.7**), likely code-shape/inline cost.
- **Hoist WASM `getRawFrameAtFrame` lookup out of the extraction loop:** regressed
  to **12,548.6 ns/frame** (median **12,516.3**).
- **Filter raw-frame events to sled-side collisions in Rust:** preserved
  `RawFrame` semantics but regressed to **12,719.2 ns/frame** (median
  **12,744.1**); the extra Rust branch outweighed JS copy/filter savings.
- **Force-inline history `add_to_grid`:** regressed hard to
  **13,013.5 ns/frame** (median **13,038.6**), so keeping the history helper out
  of the fused step loop is better for this wasm code shape.

Conclusion: direct cache sizing, encoded-cell reuse, and small JS/WASM boundary
tweaks are exhausted for now. The next plausible path needs a larger redesign of
the history recording/invalidation data flow that avoids the flat-scan probe's
`addLine` penalty, or a much broader detector/measurement ABI that removes whole
object graphs rather than shaving per-frame wrapper work.

## Session 11 (2026-06-05 cont.) — history-map and build-pipeline probes, no kept speed change

Rejected probes, all verified bit-identical under `LR_ENGINE=wasm npm run verify`
and reverted/restored:

- **Use `FlatIntMap<Vec<CellFrame>>` for the history grid:** switched `HistGrid`
  from `HashMap<i64, Vec<CellFrame>, IntBuildHasher>` to the custom flat integer
  map already used by `cell_lines`. The 8-run signal regressed to
  **12,422.7 ns/frame** (median **12,421.3**). The tuned `HashMap` remains better
  for the history workload, likely because rollback/tombstone churn and larger
  `Vec<CellFrame>` values fit SwissTable better than the simple linear-probe map.
- **Unroll the fixed 9-cell `add_to_grid` fanout:** preserved identity but
  regressed hard to **13,191.6 ns/frame** (median **13,151.4**). Binaryen/Rust
  prefer the compact loop shape here.
- **Binaryen `-O4` instead of `-O3`:** preserved identity but regressed to
  **12,549.2 ns/frame** (median **12,625.9**). The standard `build:wasm` `-O3`
  artifact was rebuilt afterward.

Conclusion: the current history-grid map, compact fanout loop, and Binaryen `-O3`
pipeline are locally better than the obvious alternatives. Future work should
avoid more code-shape micro-probes and focus on changing what history is recorded
or how candidate evaluation consumes it.

## Session 12 (2026-06-05 cont.) — line-map lifecycle and conversion-cache probes, no kept speed change

Rejected probes, all verified bit-identical under `LR_ENGINE=wasm npm run verify`
and reverted:

- **Compact `FlatIntMap` tombstones after removals:** added a shrink/rehash path
  when removed cell buckets left the custom line grid with many tombstones. The
  8-run signal regressed to **12,505.3 ns/frame** (median **12,492.2**), so the
  compaction cost is not repaid by faster later lookups on the current compile
  shape.
- **Single-remove ordered line buckets:** replaced `retain(|e| e.id != id)` with
  `position` + `Vec::remove` because each cell bucket has at most one entry per
  line id. This preserved identity but regressed to **12,521.7 ns/frame** (median
  **12,602.2**), so the existing compact retain loop is better after wasm-opt.
- **Single-entry field-snapshot `engineLineFromTrackLine` cache:** avoided the
  string signature and nested `Map` in the JS line conversion cache. It preserved
  optimizer output but only produced **12,362.9 ns/frame** on 8 runs (median
  **12,357.6**), below the >1.6% bar and consistent with the prior full-gate
  result that this JS-side conversion path is too small to keep.

Conclusion: branch-reconcile line-map maintenance and JS line conversion are not
large enough in the target workload. Further work should stop circling these
secondary paths and either redesign history recording/invalidation or move a
larger detector/measurement slice across the WASM boundary in one ABI.

## Session 13 (2026-06-05 cont.) — state-cache and collision-history probes, no kept speed change

Rejected probes, all verified bit-identical under `LR_ENGINE=wasm npm run verify`
and reverted:

- **Make `State` `Copy` and push/copy cached frames directly:** removed explicit
  `clone()` calls around the large frame-cache state struct. The 8-run signal
  regressed to **12,480.6 ns/frame** (median **12,608.1**), so the generated
  wasm was not improved by the source-level copy shape.
- **Short-circuit the collision predicate before `line_pos`:** skipped the
  normalized along-line projection when direction/perpendicular force checks had
  already failed. This preserved identity, but the extra branch shape produced
  only **12,440.5 ns/frame** (median **12,386.4**), below the bar and worse than
  the eager arithmetic in this WASM loop.
- **Store only first collision frame per line:** `Frame.collisions` only serves
  `_removeLine`'s first-collision query, so the probe stored `line id -> first
  frame` and rolled back only first-collision touches. This was bit-identical but
  only **12,310.3 ns/frame** (median **12,371.8**) on 8 runs, far below the
  required >1.6% gate. Reverted to avoid keeping non-holding speed code.

Conclusion: some semantically valid simplifications do not translate into a
measurable WASM win after optimization. The remaining path to a large gain still
looks structural: reduce history work itself or move an entire measurement
workflow into a single ABI, rather than reshaping individual Rust statements.

## Session 14 (2026-06-05 cont.) — candidate gate staging and raw-frame JS probe, no kept speed change

Rejected probes, all verified bit-identical under `LR_ENGINE=wasm npm run verify`
and reverted:

- **Two-stage candidate gate detection:** for windowed candidate validation,
  first detected only through the survival/target-landing gate, and on early
  failure called metered `getRider(horizon)` to preserve identical `sim_frames`
  accounting without building raw-frame objects for the final suffix. This kept
  optimizer hashes and sim-frame stats identical, but regressed to
  **12,962.7 ns/frame** (median **12,934.7**) because successful candidates paid
  duplicate detection work and the extra metered call was not cheap enough.
- **Inline `contactLineIds` de-dupe loop in WASM raw-frame wrapper:** replaced
  `Array.includes` with an explicit loop in `getRawFrameAtFrame`. This preserved
  behavior but regressed to **12,637.0 ns/frame** (median **12,595.9**); V8's
  built-in small-array path is better than the hand-written loop here.

Conclusion: preserving sim-frame accounting while skipping only object extraction
does not clear the bar. The viable large move still appears to be an actual
single-pass measurement/detector ABI, not partial staging around the existing
`Detection` object model.

## Session 15 (2026-06-05 cont.) — event-buffer ABI probe, no kept speed change

Rejected probe, verified bit-identical under `LR_ENGINE=wasm npm run verify` and
reverted:

- **Use an `i32` collision-event exchange buffer instead of `f64` triples:** kept
  the internal event vector unchanged but changed the WASM `EVENTS` ABI from
  `[f64]`/`Float64Array` to `[i32]`/`Int32Array`. This looked plausible because
  the records are integer triples `(iteration, line_id, point_idx)`, but the
  8-run signal regressed to **12,543.4 ns/frame** (median **12,528.6**). The event
  boundary is too small, and/or the optimized `f64` path is already the better
  code shape for this module.

Conclusion: integer-packing the existing event ABI is not useful in isolation.
If event handling is revisited, it should be as part of a wider detector ABI that
returns the final measured facts directly instead of exposing per-frame event
records.

## Session 16 (2026-06-05 cont.) — center-cell history index  ⭐ kept

`Frame.grid` history recording no longer fans every entity snapshot out into all
9 neighboring cells during forward simulation. Instead, each snapshot is recorded
once under its entity center cell. When `_addLine` invalidates the frame cache,
each rasterized line cell queries the inverse 3×3 neighborhood of possible entity
center cells and returns the earliest colliding frame below the current truncation
limit.

This preserves lr-core's observable invalidation condition:

```
line cell ∈ cellsNearEntity(snapshot center) && line.collidesWith(snapshot)
```

but moves the 3×3 expansion from the hot per-frame write path to the much colder
line-add invalidation path. It also drops the post-collision history write from a
full `cells_near_entity` call to a single center-cell hash.

- **Gates:** `LR_ENGINE=wasm npm run verify` ✓ byte-identical engine traces and
  optimizer outputs/stat hashes.
- **Perf signal:** 8 runs → **8,792.8 ns/frame** (median **8,817.2**).
- **Full gate:** 40 runs + 3 warmup → **8,985.0 ns/frame ± 440.3** (median
  **9,071.5**) versus W11's **12,265.0 ns/frame** standing baseline.

**Effect:** about **−26.7% mean ns/frame** on the default WASM perf gate. Kept.

Safety/identity notes:

- The verifier's optimizer cases kept identical `sim_frames`, proving the shared
  cache invalidation path remains behaviorally identical for the compiler's
  branch/reconcile access pattern.
- Query expansion returns the minimum frame across inverse-neighborhood center
  cells; within-frame snapshot order is irrelevant because `_setFramesLength`
  truncates only to a frame index.

**Standing after center-cell history index:** **~8,985 ns/physics-frame** —
bit-identical to lr-core, ≈37.2× faster than pristine JS (333k) and ≈8.1× faster
than the parity-correct JS engine (B11 ~73k).

## Session 17 (2026-06-05 cont.) — post-center-index collision-loop probe, rejected

Rejected probe, verified bit-identical under `LR_ENGINE=wasm npm run verify` and
reverted:

- **Manual indexed loops for collision cell/bucket iteration:** replaced the
  iterator-based `for &cell in cells.iter()` and `for l in lns.iter()` loops in
  the fused collision path with explicit `while` loops and unchecked indexing.
  The 8-run signal looked positive at **8,745.7 ns/frame** (median **8,816.7**),
  but the required full 40-run gate regressed to **9,256.2 ns/frame** (median
  **9,382.6**) versus the center-index baseline of **8,985.0**. Reverted.

Conclusion: after wasm-opt, the idiomatic iterator loop remains the better code
shape for the hottest collision bucket walk.

## Session 18 (2026-06-05 cont.) — empty-line-grid fast path, rejected

Rejected probe, verified bit-identical under `LR_ENGINE=wasm npm run verify` and
reverted:

- **Skip 3×3 line lookup when the spatial line grid is empty:** added a
  `FlatIntMap::is_empty` check once per frame and, for empty grids, recorded only
  the center-cell history snapshot without computing the full
  `cells_near_entity` neighborhood. The 8-run signal was only
  **8,868.8 ns/frame** (median **8,873.4**), about 1.3% versus the
  center-index baseline and below the >1.6% keep bar. Reverted.

Conclusion: the compiler's measured path does not spend enough time simulating
empty line grids for this branch to justify keeping.

## Session 19 (2026-06-06) — expanded center-cell line lookup  ⭐ kept

The line collision grid now mirrors the center-cell idea used for history, but on
the lookup side. Instead of computing a 3×3 neighborhood and probing 9 line-cell
buckets for every collidable point, `push_line` expands each original
`classicCells` line cell into the possible entity center cells whose 3×3
neighborhood would include it. Each expanded center bucket is sorted by:

1. lr-core's original 3×3 cell order (`x-1/y-1`, `x-1/y`, ...), then
2. descending line id inside that original cell.

That preserves `ClassicGrid.getLinesNearEntity` order, including duplicate line
visits across neighboring cells, while the hot collision loop does one
center-cell hash + one bucket lookup per point.

- **Gates:**
  - `cargo test --manifest-path engine-rs/Cargo.toml` ✓
  - `LR_ENGINE=wasm npm run verify:engine` ✓ in the main worktree
  - `npm run wasm:replay` ✓ on a freshly recorded `syncopated_switchback`
    compiler op DAG (158,219 ops / 156,926 reads)
  - `LR_ENGINE=wasm npm run verify` ✓ in a clean temporary worktree with only
    this engine patch applied (the main worktree had unrelated dirty
    `arc_placement.ts` changes that currently alter optimizer hashes)
- **Perf signal:** 8 runs → **6,942.8 ns/frame** (median **7,011.6**).
- **Full gate:** 40 runs + 3 warmup → **6,990.0 ns/frame ± 481.0** (median
  **7,132.0**) versus the center-index baseline of **8,985.0 ns/frame**.

**Effect:** about **−22.2% mean ns/frame** on the default WASM perf gate. Kept.

Safety/identity notes:

- The expanded bucket stores a small `group` tag so center-cell iteration is
  exactly equivalent to lr-core's old 9-bucket concatenation, not merely a set of
  nearby lines.
- `remove_line` removes by `(line id, group)`, matching lr-core's per-original-cell
  bucket removal semantics even if a line id appears in multiple neighboring
  groups.

**Standing after expanded center-cell line lookup:** **~6,990 ns/physics-frame** —
bit-identical to lr-core, ≈47.8× faster than pristine JS (333k) and ≈10.4× faster
than the parity-correct JS engine (B11 ~73k).

## Session 20 (2026-06-06 cont.) — line-cache bypass after expanded lookup, rejected

Rejected probe, verified bit-identical under `LR_ENGINE=wasm npm run
verify:engine` and `npm run wasm:replay`, then reverted:

- **Bypass `LineCellCache` and call `FlatIntMap::get` directly:** after the
  expanded center-cell lookup reduced each point to one line bucket, the
  direct-mapped cache looked potentially unnecessary. The 8-run signal regressed
  to **7,042.9 ns/frame** (median **7,066.9**) versus the expanded-lookup
  baseline of **6,990.0**, so repeated center-cell hits still repay the cache.

Conclusion: keep `LineCellCache` in the expanded lookup design.

## Session 21 (2026-06-06 cont.) — expanded-lookup line-cache size, rejected

Rejected probe, verified bit-identical under `LR_ENGINE=wasm npm run
verify:engine` and reverted:

- **Increase `LineCellCache` from 64 to 128 slots:** after expanded center-cell
  lookup, the cache remains useful, so a larger table was retested. The 8-run
  signal was **6,960.7 ns/frame** (median **7,106.5**), effectively the
  expanded-lookup baseline and below the >1.6% keep bar.

Conclusion: keep the 64-slot cache.

## Session 22 (2026-06-06 cont.) — collision predicate short-circuit, rejected

Rejected probe, verified bit-identical under `LR_ENGINE=wasm npm run
verify:engine` and `npm run wasm:replay`, then reverted:

- **Short-circuit before `line_pos` in the expanded lookup collision loop:** this
  had failed before the expanded line grid, so it was retested against the new
  bucket shape. The 8-run signal looked weakly positive at **6,859.2 ns/frame**
  (median **6,900.8**), but the required 40-run gate was **6,984.7 ns/frame**
  (median **7,117.9**), effectively the expanded-lookup baseline of **6,990.0**.

Conclusion: the eager collision predicate arithmetic remains the better/neutral
wasm code shape after full-gate sampling.

## Session 23 (2026-06-06 cont.) — `GridLine` field order, rejected

Rejected probe, verified bit-identical under `LR_ENGINE=wasm npm run
verify:engine` and `npm run wasm:replay`, then reverted:

- **Move hot `GridLine.line` before cold `group`:** put the embedded `Line` at
  offset 0 so the collision loop did not read through a cold tag prefix. The
  8-run signal was weakly positive at **6,859.7 ns/frame** (median **6,986.0**),
  but the 40-run gate was **6,987.9 ns/frame** (median **7,119.3**), effectively
  baseline.

Conclusion: field order does not matter measurably after wasm-opt.

## Session 24 (2026-06-06 cont.) — skip detector angle magnitudes  ⭐ kept

`signedAngleDeg` used `Math.hypot` twice only to detect zero-length velocity
vectors before computing `atan2(cross, dot)`. The detector now checks exact zero
components directly:

```
(vx === 0 && vy === 0)
```

and otherwise computes the same dot/cross/atan2 result. The magnitudes were not
used in the returned angle.

- **Gates:**
  - `LR_ENGINE=wasm npm run verify` ✓ in a clean temporary worktree with only
    this detector patch applied (the main worktree had unrelated dirty
    `arc_placement.ts` changes that currently alter optimizer hashes)
- **Perf signal:** 8 runs → **6,761.6 ns/frame** (median **6,775.2**).
- **Full gate:** 40 runs + 3 warmup → **6,765.9 ns/frame ± 441.7** (median
  **6,914.1**) versus the expanded-lookup baseline of **6,990.0 ns/frame**.

**Effect:** about **−3.2% mean ns/frame** on the default WASM perf gate. Kept.

**Standing after detector angle zero-check:** **~6,766 ns/physics-frame** —
bit-identical to lr-core/optimizer baselines, ≈49.3× faster than pristine JS
(333k) and ≈10.8× faster than the parity-correct JS engine (B11 ~73k).

## Session 25 (2026-06-06 cont.) — single-entry engine-line conversion cache  ⭐ kept

`engineLineFromTrackLine` no longer builds a pipe-joined geometry signature and
looks it up in a per-line `Map` on every cache hit. It now keeps one structural
snapshot per `TrackLine` object in the existing `WeakMap`; if any field that
affects engine line construction changes, the snapshot misses and is refreshed.

This preserves the compiler's current-geometry semantics while removing hot
string allocation and `Map` work from repeated engine rebuilds. Historical
geometry entries for a mutated line object are not retained, which is acceptable:
the compiler only passes the current geometry to `addLine`, and converted line
object identity is not an observable API.

The default `npm run perf` gate was also raised from 40 to 50 timed runs (+3
warmup) because the WASM engine is now fast enough that the extra sampling cost
is small and gives a steadier mean.

- **Gates:**
  - `LR_ENGINE=wasm npm run verify` ✓ in a clean temporary worktree with only
    this cache/perf patch applied.
- **Perf signal:** 8 runs → **6,553.2 ns/frame** (median **6,662.9**).
- **Full gate:** 50 runs + 3 warmup → **6,616.4 ns/frame ± 375.9** (median
  **6,700.6**) versus Session 24's **6,765.9 ns/frame** standing baseline.

**Effect:** about **−2.2% mean ns/frame** on the default WASM perf gate. Kept.

**Standing after single-entry line conversion cache:** **~6,616 ns/physics-frame** —
bit-identical to lr-core/optimizer baselines, ≈50.3× faster than pristine JS
(333k) and ≈11.0× faster than the parity-correct JS engine (B11 ~73k).

## Session 26 (2026-06-06 cont.) — external Rust map crates, rejected

Rejected crate/data-structure probes:

- **Use `rustc-hash` for the remaining integer-keyed `HashMap`s:** replacing
  `IntMap`'s custom single-multiply hasher with `rustc_hash::FxBuildHasher`
  built successfully but did not improve the 8-run signal: **6,562.2 ns/frame**
  (median **6,636.5**) versus the same temp checkout's **6,554.9 ns/frame**
  baseline. Rejected without full gate.
- **Use `hashbrown::HashMap` for `FlatIntMap` line-grid buckets:** replacing the
  hand-rolled open-addressed table with `hashbrown` looked promising in the
  8-run signal at **6,290.2 ns/frame** (median **6,350.8**), but the required
  full gate was only **6,531.6 ns/frame ± 391.0** (median **6,577.8**) versus the
  standing **6,616.4 ns/frame** baseline: about **−1.3%**, below the >1.6% keep
  bar. Verified bit-identical before rejection (`cargo test` ✓,
  `LR_ENGINE=wasm npm run verify` ✓), then reverted.

Conclusion: for this workload, the current no-dependency map setup remains the
better choice. `hashbrown` is a good general SwissTable implementation, but the
custom `FlatIntMap` is competitive enough in the wasm hot path that the full
compiler gate does not justify the extra dependency. The more useful
data-structure wins continue to be workload-specific layout changes, not a
generic crate swap.

## Session 27 (2026-06-06 cont.) — streaming detector window fast path, rejected

Rejected probe:

- **Read WASM raw-frame parts into a reusable object and detect windowed
  trajectories without constructing `RawFrame` wrappers:** added a
  `getRawFrameAtFrameInto` method on the WASM wrapper and changed the hot
  candidate `detectWindow` path to build `Detection` measurements directly.
  The implementation still extracted through the full requested horizon to keep
  physics-frame accounting and optimizer stats identical.

Gating notes:

- Current `HEAD` (`75c9330`, arc cadence handling) changes optimizer outputs
  relative to the checked-in `generated/verify-optimizer/baseline.json`. Clean
  `HEAD` fails `verify:optimizer` for `syncopated_switchback|seed1` and
  `drums_signature|seed2`. For this probe, a temporary clean-worktree baseline
  was regenerated from `HEAD`, then the detector patch was checked against that
  baseline.
- With that temp current-HEAD baseline: `LR_ENGINE=wasm npm run verify` ✓.
- Clean current-HEAD 8-run baseline: **6,677.8 ns/frame** (median **6,784.1**).
- Patch 8-run signal: **6,498.3 ns/frame** (median **6,566.1**).
- Required 50-run gate with the patch: **6,777.1 ns/frame ± 411.9** (median
  **6,871.7**), a regression rather than a held win. Reverted.

Conclusion: avoiding the `RawFrame` wrapper object is not enough; the extra
branching and duplicated detector loop shape lose under full sampling. A future
detector optimization should move more work across the WASM boundary or compute
the final measured facts directly, not just stream the existing JS object model.

## Session 28 (2026-06-06 cont.) — cache arc env object, rejected

Rejected probe:

- **Cache the `process.env` object reference in `arc_placement.ts`:** kept dynamic
  property reads so tests that mutate `process.env.LR_*` would still see changes,
  but avoided repeated `globalThis.process?.env` optional-chain lookup in hot
  arc-placement mode checks.

Measurement:

- Current `HEAD` full baseline after `75c9330`: **6,534.1 ns/frame ± 375.7**
  (median **6,625.0**). This supersedes the older Session 25 standing number for
  local comparisons; the arc cadence commit shifted the compiler path.
- Patch 8-run signal: **6,490.6 ns/frame** (median **6,560.6**), only about
  **−0.7%** versus the full current-HEAD baseline and below the >1.6% keep bar.
  Reverted without full gate.

Conclusion: `envValue` showing in the profiler is mostly noise/leaf attribution;
the simple object-reference cache is too small to matter.

## Session 29 (2026-06-06 cont.) — batched WASM `addLine([...])`, rejected

Rejected probe:

- **Add a Rust-side `add_lines` ABI for JS array `addLine` calls:** the wrapper
  wrote line records into a shared f64 buffer, called one wasm function for the
  whole arc/candidate batch, and the engine represented the batch as one version
  node whose patch expanded to the same per-line `_addLine` order during
  reconciliation. Undo order was reverse-addition, redo order original-addition,
  matching the old chain of transient per-line version nodes.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓ and `npm run build:wasm` ✓.
- 8-run signal: **6,569.6 ns/frame** (median **6,633.0**), slower than the
  current full baseline of **6,534.1 ns/frame**. Reverted without full gate.

Conclusion: reducing wasm call count/version-node count does not pay for the
extra JS buffer fill and batch `Vec<Line>` construction in the current compiler
path. The hot wasm self-time is not dominated by per-line ABI overhead.

## Session 30 (2026-06-06 cont.) — one-pass grid-bucket insertion, rejected

Rejected probe:

- **Combine duplicate detection and sorted-position search in
  `insert_grid_line`:** the expanded line grid's add path scanned each bucket
  once for an existing `(group,id)` entry and again for the insertion position.
  The probe combined these into a single loop while preserving group order and
  descending line-id order.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓ and `npm run build:wasm` ✓.
- 8-run signal: **6,560.1 ns/frame** (median **6,659.0**), above the current full
  baseline of **6,534.1 ns/frame**. Reverted without full gate.

Conclusion: the two short iterator scans are not a meaningful bottleneck after
wasm-opt; the manual loop shape was neutral/slower.

## Session 31 (2026-06-06 cont.) — precompute version line cells, rejected

Rejected probe:

- **Store classic grid cells in AddLine version patches:** extended the version
  patch to keep each line's precomputed `classic_cells` alongside the line, with
  the goal of avoiding a repeated `line_cells` calculation during cache
  reconciliation redo.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓ and `npm run build:wasm` ✓.
- 8-run signal: **6,558.0 ns/frame**, above the current full baseline of
  **6,534.1 ns/frame**. Reverted without full gate.

Conclusion: the extra patch payload and clone traffic were not offset by saving
the cell recomputation. The existing `LineCellCache` and cheap cell generation are
already adequate for this path.

## Session 32 (2026-06-06 cont.) — open WASM batch addLine, rejected

Rejected probe:

- **Use the public `addLine([segments])` semantic without f64 buffer staging:**
  added begin/push/finish wasm calls so JS still passed each segment directly,
  while Rust synced the shared cache once, mutated it per segment, and recorded
  the whole batch as one public version node. This tested whether the compiler's
  multi-line call shape had leverage without the extra shared-buffer fill cost
  from Session 29.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓ and `npm run build:wasm` ✓.
- 8-run signal: **6,582.2 ns/frame** (median **6,643.6**), slower than the
  current full baseline of **6,534.1 ns/frame**. Reverted without full gate.

Conclusion: batching public `addLine([...])` versions is not the bottleneck by
itself. The compiler-aware opportunity is likely at a coarser boundary: add a
candidate's lines, compute the narrow detector/scoring facts, then discard the
candidate without materializing a general-purpose child engine.

## Session 33 (2026-06-06 cont.) — inline single-owner history snapshots  ⭐ kept

After the center-cell history redesign (Session 16), each history snapshot is
recorded in exactly one center-cell list. The older shared `hist_snap_values`
arena was introduced for the pre-center-index 9-cell fanout, where many cell
nodes referenced the same snapshot. With fanout gone, it had become pure extra
state: one `Snap` push, one extra offsets vector, one rollback truncate, and an
extra indexed load during invalidation.

`CellFrame.first` and `SnapNode.snap` now store `Snap` inline again, and the
separate `hist_snap_values` / `hist_snap_value_offsets` vectors are removed.
Rollback still truncates the same per-frame `hist_snaps` link arena; the first
snapshot of each cell-frame node lives inside the node that `rollback_grid`
already pops.

Correctness notes:

- Same-cell/same-frame insertion order remains irrelevant to observable output:
  invalidation only asks whether **any** snapshot in the cell-frame node collides,
  then truncates to the frame index.
- A clean temporary worktree at `HEAD` produced the same optimizer hashes and
  `sim_frames` as the patch. The local gitignored optimizer baseline was stale
  from the arc-cadence change, so it was refreshed to current `HEAD` before the
  final full verify.

Gates:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓
- `npm run build:wasm` ✓
- `LR_ENGINE=wasm npm run verify` ✓

Perf (default 50 runs + 3 warmup, `LR_ENGINE=wasm npm run perf`):

| engine | ns/physics-frame | median |
|---|---:|---:|
| clean `HEAD` baseline | 6,551.6 ± 398.6 | 6,636.6 |
| **inline snapshots** | **6,433.1 ± 374.2** | **6,508.7** |

**Effect:** **−1.8% mean / −1.9% median**, clearing the >1.5% keep bar. Kept.

**Standing after inline single-owner snapshots:** **~6,433 ns/physics-frame** —
bit-identical to the current lr-core/optimizer baselines, ≈51.8× faster than
pristine JS (333k), but still above the <3,000 ns/frame goal.

## Session 34 (2026-06-06 cont.) — fast metered sled-point trace  ⭐ kept

The profile after Session 33 showed the compiler still spending visible JS time
inside WASM `getRider` sled-point probes: `pointStateFrom`, `getRawFrameAtFrame`,
and the pre-target proximity trace were now large enough to matter. The hottest
trace path (`readPreTargetSledTrace`) needs only four sled-point positions
(`PEG`, `TAIL`, `NOSE`, `STRING`) per frame, but the old code called
`getRiderMetered(frame)` and then materialized four full point-state objects
with `pos`/`prevPos`/`vel` wrappers.

Added an optional WASM wrapper method:

```
getSledPointPositionsAtFrame(frame, out)
```

It reuses the existing `get_rider` ABI payload and writes the four sled-point
`pos.x/pos.y` pairs into a caller-provided numeric buffer. `detector.ts` exposes
`getSledPointPositionsMetered`, which preserves the exact same physics-frame
charging and hard-limit behavior as `getRiderMetered`, falling back to the old
rider API for non-WASM engines. `readPreTargetSledTrace` now reuses one small
buffer and appends those coordinates directly.

Gates:

- `LR_ENGINE=wasm npm run verify` ✓

Perf:

- 8-run signal: **6,142.7 ns/frame** (median **6,173.3**).
- Full gate (`LR_ENGINE=wasm npm run perf`, 50 runs + 3 warmup):

  | engine | ns/physics-frame | median |
  |---|---:|---:|
  | Session 33 standing | 6,433.1 ± 374.2 | 6,508.7 |
  | **fast sled trace** | **6,112.7 ± 317.4** | **6,179.3** |

**Effect:** **−5.0% mean / −5.1% median**, clearing the >1.5% keep bar. Kept.

**Standing after fast metered sled trace:** **~6,113 ns/physics-frame** —
bit-identical to the current lr-core/optimizer baselines, ≈54.5× faster than
pristine JS (333k), still above the <3,000 ns/frame goal.

## Session 35 (2026-06-06 cont.) — WASM SIMD autovectorized build, rejected

User asked whether SIMD/AVX had been tried. Direct AVX is not a WASM target
surface; the relevant route is WebAssembly SIMD (`simd128` / `v128`), which V8
may lower to host SIMD instructions. Tested a pure build-configuration probe:

```
RUSTFLAGS='-C target-feature=+simd128' cargo build --release --target wasm32-unknown-unknown ...
wasm-opt --enable-simd -O3 ...
```

The optimized artifact did contain `v128` / `f64x2` instructions and remained
bit-identical:

- `LR_ENGINE=wasm npm run verify` ✓

Perf signal:

- 8 runs: **6,153.0 ns/frame** (median **6,152.5**) versus the current standing
  **6,112.7 ns/frame**.

Rejected without the full 50-run gate. The autovectorized code did not improve
the target path; the remaining hot loop is still mostly branchy collision/grid
work over small dynamic buckets rather than a wide contiguous vector kernel. A
manual SIMD intrinsic rewrite would need a very specific f64x2 kernel target and
would still have to clear the same `verify` + default `perf` gates.

## Session 36 (2026-06-06 cont.) — lazy detector summary, rejected

Rejected probe:

- **Make `Detection.summary` lazy:** candidate-window detection uses
  `measurements`, `events`, and `terminus`, but not `summary`, so this tried
  returning a getter that computes `computeSummary()` only on first read. Full
  detection users would still observe the same summary values.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,560.1 ns/frame** (median **6,393.9**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: avoiding summary construction was not enough to offset changing the
`Detection` object shape / adding an accessor. Reverted without full gate.

## Session 37 (2026-06-06 cont.) — detector `Math.sqrt` speed, rejected

Rejected probe:

- **Replace `Math.hypot(vx, vy)` with `Math.sqrt(vx * vx + vy * vy)` in
  `detect()`:** aimed to speed per-frame detector speed calculation.

Result:

- `verify:engine` ✓ (physics traces unchanged).
- `verify:optimizer` failed on all 4 cases: same `lines`/`sim_frames`, but track
  bytes changed. The tiny numeric differences in speed measurements are enough
  to alter candidate ranking / output bytes.

Conclusion: detector speed must stay on `Math.hypot` for bit-identical compiler
behavior. Reverted without perf.

## Session 38 (2026-06-06 cont.) — skip kick events in `detectWindow`, rejected

Rejected probe:

- **Add `emitKicks: false` for candidate-window detection:** `evaluateGapFit`
  and bisection hard gates consume landing events, terminus, airborne/speed
  measurements, and contact line ids, but not kick events. The probe skipped
  `signedAngleDeg`/kick emission only for `detectWindow`; full-track detection
  kept the old default.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal was **6,158.7 ns/frame** (median **6,134.5**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: removing kick work in candidate windows is too small and/or changes
the detector call shape enough to lose. Reverted without full gate.

## Session 39 (2026-06-06 cont.) — compact history snapshots, rejected

Rejected probe:

- **Store point id instead of velocity in history snapshots:** after `Point.step`,
  `vx`/`vy` are stable for the whole frame, so `Frame.grid` snapshots can record
  `px`/`py`/`point` and read velocity from `frames[index]` during add-line
  invalidation. This shrank hot history snapshot writes but added a cold velocity
  lookup during invalidation.

Gates:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.

Perf signal:

- 8 runs: **6,081.1 ns/frame** (median **6,171.2**) versus the current standing
  **6,112.7 ns/frame**.

Conclusion: mean moved only ~0.5% and median worsened, so this did not clear the
>1.5% keep threshold. Reverted without full gate.

## Session 40 (2026-06-06 cont.) — const-index collidable loop unroll, rejected

Rejected probe:

- **Unroll the ten collidable point visits with const-generic point indices:**
  aimed to let LLVM/Binaryen specialize state-array and friction loads in the
  hottest collision loop while preserving the exact `COLLIDABLES` order.

Gates:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.

Perf signal:

- 8 runs: **6,135.2 ns/frame** (median **6,128.8**) versus the current standing
  **6,112.7 ns/frame**.

Conclusion: code-size/inlining tradeoff lost slightly. Reverted without full
gate.

## Session 41 (2026-06-06 cont.) — make `State` copyable, rejected

Rejected probe:

- **Derive `Copy` for the fixed-size Rust frame `State` and use direct copies
  instead of `.clone()` in the frame cache:** aimed to simplify the hot
  `compute_to` frame push and rollback restoration paths.

Gates:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.

Perf signal:

- 8 runs: **6,185.3 ns/frame** (median **6,165.8**) versus the current standing
  **6,112.7 ns/frame**.

Conclusion: direct `Copy` changed codegen for the worse; the derived clone path
is already efficient enough. Reverted without full gate.

## Session 42 (2026-06-06 cont.) — avoid redo `Line` clones, rejected

Rejected probe:

- **Collect redo version ids in `update_computed` instead of cloning full `Line`
  records into a redo vector, and pass `&Line` through `Cache::add_line` /
  `push_line`:** aimed to reduce reconciliation cloning in the visible
  `update_computed` profile bucket.

Gates:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.

Perf signal:

- 8 runs: **6,142.2 ns/frame** (median **6,181.6**) versus the current standing
  **6,112.7 ns/frame**.

Conclusion: avoiding one redo clone was too small and/or changed code shape for
the worse. Reverted without full gate.

## Session 43 (2026-06-06 cont.) — candidate hard-gate line-id ranges, rejected

Rejected probe:

- **Replace per-candidate owned-line `Set`s with contiguous id range checks and
  binary-search the sorted contact frames for off-beat landing checks:** aimed to
  trim JS hard-gate allocation/lookup overhead in `evaluateGapFit` and bisection.

Result:

- First patch had a scope bug (`lineIdStart` was not in `evaluateGapFit`);
  corrected by deriving the range from the generated line array.
- `LR_ENGINE=wasm npm run verify` ✓ after correction.
- 8-run signal: **6,223.9 ns/frame** (median **6,188.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the existing `Set` path is not the bottleneck; the replacement branch
shape regressed. Reverted without full gate.

## Session 44 (2026-06-06 cont.) — reciprocal multiply in `cell_cor`, rejected

Rejected probe:

- **Replace `x / GRID_SIZE` with `x * (1 / GRID_SIZE)` in Rust cell coordinate
  hashing:** aimed to avoid a hot `f64.div` in `cell_hash` / line rasterization.

Gates:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓; boundary behavior stayed identical for the
  pinned traces and optimizer cases.

Perf signal:

- 8 runs: **6,801.1 ns/frame** (median **6,890.2**) versus the current standing
  **6,112.7 ns/frame**.

Conclusion: despite removing an apparent division, the generated WASM/V8 code
shape regressed badly. Reverted without full gate.

## Session 45 (2026-06-06 cont.) — raw-frame metering piggyback, rejected

Rejected probe:

- **Write the post-raw-frame last computed frame index into WASM scratch and read
  it from JS instead of calling `getLastFrameIndex()` after every raw frame in
  budgeted extraction:** aimed to reduce one WASM boundary call per extracted
  detector frame while keeping physics-frame charging identical.

Gates:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.

Perf signal:

- 8 runs: **6,194.3 ns/frame** (median **6,180.7**) versus the current standing
  **6,112.7 ns/frame**.

Conclusion: the extra scratch/global JS path lost more than the removed
`getLastFrameIndex()` export call saved. Reverted without full gate.

## Session 46 (2026-06-06 cont.) — preallocate detector arrays, rejected

Rejected probe:

- **Pre-size `detect()` measurement arrays and `extractRawTrajectoryWindow()`
  frame arrays instead of growing them with `push`:** aimed to reduce JS array
  growth overhead in the visible detector/extraction path while preserving the
  exact same measurement contents and truncating on early terminus.

Gates:

- `LR_ENGINE=wasm npm run verify` ✓.

Perf:

- 8-run signal looked promising: **5,964.8 ns/frame** (median **6,000.6**).
- Required full gate (`LR_ENGINE=wasm npm run perf`) regressed to
  **6,229.4 ns/frame** (median **6,261.2**) versus the current standing
  **6,112.7 ns/frame**.

Conclusion: short-run improvement was noise; preallocated/holey array code shape
lost under the full gate. Reverted.

## Session 47 (2026-06-06 cont.) — unroll WASM rider/raw-frame summaries, rejected

Rejected probe:

- **Unroll the fixed six-body average and four sled-point writes in
  `rider_into` / `raw_frame_into`:** aimed to trim the WASM detector-boundary
  summary path while preserving the exact BODY order
  (`BUTT, SHOULDER, RHAND, LHAND, LFOOT, RFOOT`).

Gates:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.

Perf signal:

- 8 runs: **6,180.2 ns/frame** (median **6,248.5**) versus the current standing
  **6,112.7 ns/frame**.

Conclusion: the fixed unroll changed WASM code shape for the worse. Reverted
without full gate.

## Session 48 (2026-06-06 cont.) — preallocate pre-target sled trace, rejected

Rejected probe:

- **Preallocate the flat numeric `PreTargetSledTrace` array to its exact upper
  bound and fill by index instead of using `push`:** aimed to reduce allocation
  and growth overhead in the still-visible preclear trace path.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,178.0 ns/frame** (median **6,190.3**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: like detector preallocation, this worsened V8 array code shape.
Reverted without full gate.

## Session 49 (2026-06-06 cont.) — explicit short-lived engine disposal, rejected

Rejected probe:

- **Add `LineRiderEngine.dispose()` with FinalizationRegistry unregistering and
  explicitly dispose candidate child engines after detector extraction in
  `evaluateGapFit` and bisection:** aimed to reduce retained WASM version/cache
  pressure and finalizer backlog for short-lived candidates.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,202.9 ns/frame** (median **6,184.6**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: explicit unregister/free work landed directly on the hot candidate
path and cost more than any lifecycle benefit. Reverted without full gate.

## Session 50 (2026-06-06 cont.) — hoist frame-index method lookup, rejected

Rejected probe:

- **Cache the `getLastFrameIndex` method reference within detector extraction and
  metered rider/sled-point reads, then call a helper with the hoisted function:**
  aimed to reduce repeated optional property lookup in physics-frame accounting
  while preserving the same `try`/null behavior.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,248.6 ns/frame** (median **6,207.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the helper/hoist shape was slower than the simple existing helper.
Reverted without full gate.

## Session 51 (2026-06-06 cont.) — candidate-window plain summary skip, rejected

Rejected probe:

- **Add an `includeSummary` flag to `detect()` and call candidate-window
  detection with `includeSummary=false`, returning a plain `summary: undefined`
  data property instead of the earlier lazy accessor:** aimed to avoid
  `computeSummary()` without the accessor/object-shape penalty from Session 36.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,194.1 ns/frame** (median **6,169.9**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: even without an accessor, changing the detector call/object shape
lost more than skipping summary saved. Reverted without full gate.

## Session 52 (2026-06-06 cont.) — transient candidate WASM wrappers, rejected

Rejected probe:

- **Add `addLineTransient()` to the WASM wrapper, returning a child wrapper that
  never registers a finalizer, then explicitly free it after candidate detection:**
  narrower than Session 49 because it avoids `FinalizationRegistry.unregister()`
  on the hot path while still avoiding leaked handles.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,204.8 ns/frame** (median **6,240.2**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: even without unregister overhead, explicit `free_engine` on every
candidate is too expensive. Reverted without full gate.

## Session 53 (2026-06-06 cont.) — i32 WASM event buffer layout, rejected

Rejected probe:

- **Change the WASM collision-event exchange buffer from `f64` triples viewed as
  `Float64Array` to `i32` triples viewed as `Int32Array`:** aimed to halve event
  buffer bandwidth and avoid integer-to-float conversions when exporting
  `(iteration, line_id, point_idx)` records.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,141.0 ns/frame** (median **6,184.0**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the narrower ABI did not improve the measured hot path and worsened
the median, so the Float64 event buffer remains the faster shape for now.
Reverted without full gate.

## Session 54 (2026-06-06 cont.) — packed internal WASM events, rejected

Rejected probe:

- **Store collision events internally as packed `u64` records, while preserving
  the exported `f64` event-buffer ABI:** aimed to reduce hot-path `Vec` traffic
  in `Cache::compute_to` without changing the JavaScript wrapper contract.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,196.7 ns/frame** (median **6,226.6**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: unpack overhead and/or changed WASM code shape outweighed the smaller
internal event record. Reverted without full gate.

## Session 55 (2026-06-06 cont.) — pre-reserve frame side vectors, rejected

Rejected probe:

- **Reserve `frames` and per-frame side-offset vectors in `Cache::compute_to`
  before extending to the requested frame:** aimed to reduce incremental vector
  growth while preserving exact frame computation order.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,097.1 ns/frame** (median **6,095.0**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the signal was slightly faster but only about **0.25%**, below the
required **>1.5%** commit threshold. Reverted without full gate.

## Session 56 (2026-06-06 cont.) — compact `GridLine` bucket records, rejected

Rejected probe:

- **Replace per-bucket embedded `Line` clones with a compact `GridLine` record
  containing only the collision-loop fields:** aimed to shrink expanded
  center-cell line buckets and reduce line-copy work while preserving group/id
  ordering.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,119.8 ns/frame** (median **6,143.0**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the flatter record did not improve the optimized collision loop and
slightly worsened the short signal. Reverted without full gate.

## Session 57 (2026-06-06 cont.) — Binaryen `wasm-opt -O2`, rejected

Rejected artifact probe:

- **Optimize the release WASM artifact with `wasm-opt -O2` instead of the
  standard `-O3`:** aimed to test whether smaller/less-aggressive Binaryen output
  gave V8 a faster code shape for the current hot loop.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,123.4 ns/frame** (median **6,140.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: `-O2` did not improve the current artifact. Restored the standard
`npm run build:wasm` `-O3` output.

## Session 58 (2026-06-06 cont.) — unchecked `FlatIntMap` value access, rejected

Rejected probe:

- **Use unchecked value access in `FlatIntMap::get`/`get_mut` after `find`
  returns an occupied slot:** aimed to remove the redundant `Option` branch on
  hot line-grid lookups.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,164.3 ns/frame** (median **6,162.2**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the unsafe accessor shape was slower after optimization. Reverted
without full gate.

## Session 59 (2026-06-06 cont.) — next-contact frame cache, rejected

Rejected probe:

- **Cache `framesUntilNextContact(gap, allContactFrames)` by `Gap` object and
  contact-frame-array identity in `arc_placement.ts`:** aimed to avoid repeated
  `Array.find` scans during contact-centered proposal generation.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,216.7 ns/frame** (median **6,233.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the WeakMap lookup/object-cache shape cost more than the small
contact-frame scan in this workload. Reverted without full gate.

## Session 60 (2026-06-06 cont.) — lazy owned-line `Set`, rejected

Rejected probe:

- **Construct the candidate-owned line-id `Set` only after finding a landing
  event near the target frame:** aimed to avoid a `Set(lines.map(...))`
  allocation for candidates that fail the landing gate before line ownership is
  needed.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,317.5 ns/frame** (median **6,292.1**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: changing the hot `Array.some` predicate shape cost much more than
the avoided allocation. Reverted without full gate.

## Session 61 (2026-06-06 cont.) — direct gap-axis reducer, rejected

Rejected probe:

- **Inline `measureGapAxes` into direct air/speed/grain reductions instead of
  building a `GapMeasureCtx` and dispatching through `AXIS_MEASURE`:** aimed to
  reduce candidate scoring overhead after the detector returns a valid landing.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,210.4 ns/frame** (median **6,200.9**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the direct reducer shape was slower in V8 than the existing registry
helpers. Reverted without full gate.

## Session 62 (2026-06-06 cont.) — line-id range ownership checks, rejected

Rejected probe:

- **Replace candidate-owned line-id `Set` checks with a contiguous id-range
  helper plus `Set` fallback:** aimed to avoid allocation/probing for the common
  generated-candidate case where line ids are `lineIdStart + i`.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,252.6 ns/frame** (median **6,278.9**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the range helper/object shape was slower than V8's optimized small
`Set` path. Reverted without full gate.

## Session 63 (2026-06-06 cont.) — local arc env/span hoists, rejected

Rejected probe:

- **Hoist repeated `arcPlacementMode()` and `spanBlends()` reads within a single
  arc-placement sampling call:** aimed to reduce repeated env access while
  preserving dynamic env behavior between calls and tests.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,225.1 ns/frame** (median **6,215.3**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the local variable/object shape was slower than the existing small
helper calls. Reverted without full gate.

## Session 64 (2026-06-06 cont.) — two-way line-cell cache, rejected

Rejected probe:

- **Make `LineCellCache` two-way associative instead of direct-mapped:** aimed to
  reduce frame-local center-cell lookup conflict misses in the WASM collision
  loop without changing grid lookup semantics.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,212.5 ns/frame** (median **6,213.4**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the extra way checks cost more than any avoided `FlatIntMap` misses.
Reverted without full gate.

## Session 65 (2026-06-06 cont.) — two-way active history-cell cache, rejected

Rejected probe:

- **Make `ActiveCellCache` two-way associative instead of direct-mapped:** aimed
  to reduce conflict misses while appending same-frame history snapshots in
  `add_to_cell`.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,498.4 ns/frame** (median **6,465.2**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the added hot-path checks were far more expensive than any conflict
miss reduction. Reverted without full gate.

## Session 66 (2026-06-06 cont.) — shared raw-frame memory-buffer read, rejected

Rejected probe:

- **Pass a single post-`get_raw_frame` `memory.buffer` value into both scratch and
  event view refresh helpers in the WASM wrapper:** aimed to reduce repeated
  `WebAssembly.Memory.buffer` property reads in `getRawFrameAtFrame`.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,170.8 ns/frame** (median **6,220.1**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the optional-argument helper shape lost more than the avoided buffer
read saved. Reverted without full gate.

## Session 67 (2026-06-06 cont.) — direct `effectiveAxes` accumulation, rejected

Rejected probe:

- **Accumulate `effectiveAxes` directly from `spec.axes[key]?.(t)` instead of
  allocating an `axesAtFrame()` object for every frame:** aimed to reduce report
  and target-sampling overhead while preserving the same axis evaluation order.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,104.4 ns/frame** (median **6,142.3**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the mean was only about **0.14%** faster and the median was worse,
well below the required **>1.5%** threshold. Reverted without full gate.

## Session 68 (2026-06-06 cont.) — direct nearest-landing report scan, rejected

Rejected probe:

- **Replace `buildDriftReport`'s per-contact `filter().map().sort()[0]` nearest
  landing lookup with a single direct scan:** aimed to reduce final report
  allocation/sort overhead while preserving first-minimum tie behavior.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,210.0 ns/frame** (median **6,179.6**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the direct scan shape was slower in the measured run. Reverted
without full gate.

## Session 69 (2026-06-06 cont.) — Rust `opt-level=2`, rejected

Rejected build-profile probe:

- **Build the WASM release artifact with Rust `opt-level=2` while keeping the
  standard Binaryen `wasm-opt -O3` pass:** aimed to test whether smaller/less
  aggressive Rust output gave V8 a faster final hot-loop shape.

Result:

- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,257.8 ns/frame** (median **6,215.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: Rust `opt-level=2` made the current artifact slower. Restored
`opt-level=3` and rebuilt the standard artifact.

## Session 70 (2026-06-06 cont.) — first-collision-only line map, rejected

Rejected probe:

- **Store only the first collision frame per line in `Frame.collisions`:**
  `removeLine` only asks for the first collision frame, so later entries looked
  like avoidable collision-history writes.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,203.6 ns/frame** (median **6,239.3**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: even with less stored data, the simplified map shape was slower for
the current WASM hot path. Reverted without full gate.

## Session 71 (2026-06-06 cont.) — all-`i32` internal event tuple, rejected

Rejected probe:

- **Store collision events internally as `(i32, i32, i32)` instead of
  `(u8, i32, i32)`:** aimed to avoid iteration-byte packing/casts while
  preserving the exported `f64` event-buffer ABI.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,224.7 ns/frame** (median **6,268.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the larger/all-i32 tuple produced a slower WASM code shape. Reverted
without full gate.

## Session 72 (2026-06-06 cont.) — Rust WASM target features, rejected

Rejected artifact probe:

- **Build with `RUSTFLAGS='-C target-feature=+bulk-memory,+nontrapping-fptoint,+sign-ext,+mutable-globals'`:**
  aimed to let Rust/LLVM use the same safe WASM feature set already accepted by
  the Binaryen optimization pass.

Result:

- `npm run build:wasm` under those `RUSTFLAGS` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,254.3 ns/frame** (median **6,276.0**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: enabling those Rust target features made the current artifact
slower. Rebuilt the standard artifact without `RUSTFLAGS`.

## Session 73 (2026-06-06 cont.) — Rust `wide-arithmetic` target feature, rejected

Rejected artifact probe:

- **Build with `RUSTFLAGS='-C target-feature=+wide-arithmetic'`:** aimed to see
  whether LLVM's wasm wide-arithmetic codegen helped the integer-heavy cell
  hashing and map paths.

Result:

- `npm run build:wasm` under that `RUSTFLAGS` ✓, with Rust warning that
  `wide-arithmetic` is unstable.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,244.7 ns/frame** (median **6,253.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the unstable codegen feature was slower. Rebuilt the standard
artifact without `RUSTFLAGS`.

## Session 74 (2026-06-06 cont.) — direct raw-window candidate evaluator, rejected

Rejected probe:

- **Evaluate `useWindowDetection` candidate gates directly from
  `extractRawTrajectoryWindow()` frames instead of building a full `Detection`
  object:** aimed to preserve identical frame extraction/metering while avoiding
  detector measurement arrays, event objects, and summary work for candidate
  validation.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,257.5 ns/frame** (median **6,330.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the custom evaluator's JS loop/object shape was much slower than the
existing `detect()` path despite avoiding some allocations. Reverted without full
gate.

## Session 75 (2026-06-06 cont.) — collidable friction iterator payload, rejected

Rejected probe:

- **Iterate collision points as `(point_id, friction)` pairs instead of looking
  up `FRIC[point_id]` inside the hot collidable loop:** aimed to remove one
  static-array load while preserving the existing loop shape.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,246.2 ns/frame** (median **6,280.5**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: carrying friction in the iterator payload produced a slower WASM
code shape than the extra static-array lookup. Reverted without full gate and
rebuilt the standard artifact.

## Session 76 (2026-06-06 cont.) — direct point-only integration step, rejected

Rejected probe:

- **Replace the `0..NENT` `IS_POINT` branch in `step_state` with explicit
  binding-counter increments plus a point-only `PEG..NENT` integration loop:**
  aimed to remove two branch checks per frame while preserving point update
  arithmetic.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,208.2 ns/frame** (median **6,230.1**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the original small branch loop produced faster WASM than the split
binding/point loops. Reverted without full gate and rebuilt the standard
artifact.

## Session 77 (2026-06-06 cont.) — dedicated sled-point WASM export, rejected

Rejected probe:

- **Add `get_sled_points` to write only PEG/TAIL/NOSE/STRING positions for
  `getSledPointPositionsAtFrame`:** aimed to avoid the larger `get_rider`
  payload, which also writes body averages, binding state, and point velocities.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,246.6 ns/frame** (median **6,301.5**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the extra export/function code shape was slower than reusing the
existing `get_rider` payload. Reverted without full gate and rebuilt the
standard artifact.

## Session 78 (2026-06-06 cont.) — larger line-cell frame cache, rejected

Rejected probe:

- **Increase `LINE_CELL_CACHE_SLOTS` from 64 to 128:** aimed to reduce
  direct-mapped cache collisions for repeated center-cell line-bucket lookups
  inside `step_state`.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,244.1 ns/frame** (median **6,236.0**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the larger cache footprint/code shape was slower than the 64-slot
cache. Reverted without full gate and rebuilt the standard artifact.

## Session 79 (2026-06-06 cont.) — smaller active-cell frame cache, rejected

Rejected probe:

- **Reduce `ACTIVE_CELL_SLOTS` from 128 to 64:** aimed to lower the frame-local
  history-cache footprint and test whether the smaller direct-mapped cache shape
  helped V8's WASM codegen/cache behavior.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,234.9 ns/frame** (median **6,184.2**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: reducing active history-cell cache slots slowed the current WASM
hot path. Reverted without full gate and rebuilt the standard artifact.

## Session 80 (2026-06-06 cont.) — direct line-cell cache slot hash, rejected

Rejected probe:

- **Use `cell & (LINE_CELL_CACHE_SLOTS - 1)` instead of the 64-bit multiplicative
  mix in `LineCellCache::slot`:** aimed to remove one integer multiply from every
  frame-local line-bucket cache lookup.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,228.1 ns/frame** (median **6,251.6**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the cheaper slot function caused enough extra collision/miss cost, or
produced a worse code shape, to slow the current WASM hot path. Reverted without
full gate and rebuilt the standard artifact.

## Session 81 (2026-06-06 cont.) — `Copy` line records, rejected

Rejected probe:

- **Derive `Copy` for `Line` and `GridLine`:** aimed to let LLVM simplify the
  scalar line-record clone/copy paths used during add-line reconciliation and
  grid insertion.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,220.0 ns/frame** (median **6,228.5**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: explicit `Copy` produced a slower WASM code shape than the existing
`Clone`-only records. Reverted without full gate and rebuilt the standard
artifact.

## Session 82 (2026-06-06 cont.) — cached `process.env` object reference, rejected

Rejected probe:

- **Cache the `process.env` object reference used by `arc_placement.ts`
  `envValue()`:** aimed to avoid repeated `globalThis.process?.env` optional-chain
  work while preserving dynamic env-property reads.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,206.9 ns/frame** (median **6,238.6**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the changed JS access shape was still slower than the existing
global/optional-chain path under the current compiler workload. Reverted without
full gate.

## Session 83 (2026-06-06 cont.) — scalar contact-line dedup, rejected

Rejected probe:

- **Replace `contactLineIds.includes(lineId)` in the WASM raw-frame wrapper with
  scalar comparisons for the first four unique line ids, falling back to
  `includes` only after overflow:** aimed to reduce JS method-call overhead in
  `getRawFrameAtFrame` while preserving first-seen order.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,165.7 ns/frame** (median **6,185.1**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the scalar guards made the wrapper code shape slower than the simple
array `includes` path. Reverted without full gate.

## Session 84 (2026-06-06 cont.) — Rust-reduced raw-frame summary, rejected

Rejected probe:

- **Add `get_raw_frame_summary` to aggregate sled-contact point order and unique
  sled-contact line ids in Rust:** aimed to reduce JS per-event work in
  `getRawFrameAtFrame` by returning a compact raw-frame payload instead of full
  `(iteration, line_id, point_idx)` triples.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal was closer but below threshold: **6,053.2 ns/frame** (median
  **6,038.2**) versus standing **6,112.7 ns/frame**.
- Required full gate failed: **6,158.5 ns/frame** (median **6,208.0**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the compact Rust summary looked promising in the short sample but did
not hold under the full perf gate. Reverted and rebuilt the standard artifact.

## Session 85 (2026-06-06 cont.) — cheaper `FlatIntMap` hash mix, rejected

Rejected probe:

- **Replace the two-multiply Murmur-style `FlatIntMap::hash` with a single
  golden-ratio multiply plus xor fold:** aimed to reduce open-addressing lookup
  cost for line-grid probes while preserving key/value semantics.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,168.3 ns/frame** (median **6,171.2**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the cheaper mixer either increased probe cost or produced a worse
WASM code shape. Reverted without full gate and rebuilt the standard artifact.

## Session 86 (2026-06-06 cont.) — single-scan grid-line insertion, rejected

Rejected probe:

- **Combine `insert_grid_line` duplicate detection and insertion-position search
  into one bucket scan:** aimed to reduce add-line grid registration work in the
  visible `line::push_line` profile path.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,096.8 ns/frame** (median **6,097.7**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the short signal was only about **0.26%**, below the required 1.5%
hold threshold. Reverted without full gate and rebuilt the standard artifact.

## Session 87 (2026-06-06 cont.) — hoisted raw-frame fast-path lookup, rejected

Rejected probe:

- **Hoist `engine.getRawFrameAtFrame` detection out of `extractRawTrajectoryWindow`
  and run a dedicated fast-path extraction loop for WASM:** aimed to avoid a
  per-frame optional-property/type check and helper call in `extractRawFrame`.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,345.0 ns/frame** (median **6,279.4**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the duplicated-loop/call shape was much slower than the small
per-frame fast-path check. Reverted without full gate.

## Session 88 (2026-06-06 cont.) — integer raw-frame line ids, rejected

Rejected probe:

- **Coerce raw-frame collision line ids from the `Float64Array` event buffer with
  `| 0` before pushing into `contactLineIds`:** aimed to keep contact-line arrays
  in an integer/Smi-friendly JS representation while preserving the same numeric
  line ids.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,188.1 ns/frame** (median **6,217.3**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the extra coercion and changed JS array shape slowed the wrapper.
Reverted without full gate.

## Session 89 (2026-06-06 cont.) — Binaryen `wasm-opt -O4`, rejected

Rejected artifact probe:

- **Optimize the current release artifact with `wasm-opt -O4` instead of the
  build script's `-O3`:** aimed to see whether Binaryen's more aggressive pass
  set improved the hot WASM code shape.

Result:

- `cargo build --release --target wasm32-unknown-unknown --manifest-path engine-rs/Cargo.toml && wasm-opt ... -O4 ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,202.0 ns/frame** (median **6,239.3**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: `-O4` produced a slower artifact than the current `-O3` build.
Rejected and rebuilt the standard artifact.

## Session 90 (2026-06-06 cont.) — batched raw trajectory window, rejected

Rejected probe:

- **Add `get_raw_frames` plus a WASM-wrapper `getRawTrajectoryWindow()` fast path
  used only when `_physicsFrameLimit === null`:** aimed to reduce one WASM export
  call per extracted detector frame while preserving the existing hard-limit
  per-frame metering fallback.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- Initial 60-f64 summary stride: **6,060.1 ns/frame** (median **6,098.8**) versus
  standing **6,112.7 ns/frame**.
- Compact 8-f64 summary stride: **6,086.2 ns/frame** (median **6,078.1**) versus
  standing **6,112.7 ns/frame**.

Conclusion: batching reduced boundary calls but did not clear the required 1.5%
hold threshold; the best short signal was about **0.86%**. Reverted without full
gate and rebuilt the standard artifact.

## Session 91 (2026-06-06 cont.) — unified frame offset marks, rejected

Rejected probe:

- **Replace four parallel per-frame offset vectors in the Rust cache with one
  `FrameMark` vector:** aimed to reduce per-frame bookkeeping pushes/truncates for
  events, touched history cells, snapshot links, and touched collision lines.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,239.4 ns/frame** (median **6,211.5**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the unified struct vector changed the WASM/cache shape for the worse.
Reverted without full gate and rebuilt the standard artifact.

## Session 92 (2026-06-06 cont.) — one-pass detector summary accumulation, rejected

Rejected probe:

- **Accumulate `Detection.summary` inside the main `detect()` frame loop instead
  of walking the completed measurement arrays in `computeSummary()`:** aimed to
  remove the second summary pass while preserving the same measurement arrays,
  arithmetic order, and slide-segment boundaries.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,216.4 ns/frame** (median **6,229.5**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: adding summary bookkeeping to the primary detector loop made the hot
loop shape slower than the existing separate summary pass. Reverted without full
gate.

## Session 93 (2026-06-06 cont.) — Rust no-vectorizer artifact, rejected

Rejected artifact probe:

- **Build the WASM release artifact with
  `RUSTFLAGS='-C no-vectorize-loops -C no-vectorize-slp'`:** aimed to test whether
  avoiding LLVM vectorizer transforms produced a better scalar WASM shape for V8,
  given earlier SIMD/target-feature probes were slower.

Result:

- `RUSTFLAGS='-C no-vectorize-loops -C no-vectorize-slp' cargo build --release --target wasm32-unknown-unknown --manifest-path engine-rs/Cargo.toml && wasm-opt ... -O3 ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,233.7 ns/frame** (median **6,300.0**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: disabling LLVM vectorization produced a slower artifact. Rebuilt the
standard artifact without `RUSTFLAGS`.

## Session 94 (2026-06-06 cont.) — `u32` frame offset metadata, rejected

Rejected probe:

- **Store Rust per-frame offset vectors as `u32` instead of `usize`:** aimed to
  halve metadata write volume for event, touched-cell, snapshot-link, and
  touched-line offsets during `compute_to`.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal: **6,207.6 ns/frame** (median **6,249.6**) versus the current
  standing **6,112.7 ns/frame**.

Conclusion: the required casts and changed WASM code shape outweighed the smaller
metadata writes. Reverted without full gate and rebuilt the standard artifact.

## Session 95 (2026-06-06 cont.) — batched reduced raw-window combo, rejected

Rejected combined probe:

- **Combine a batched `get_raw_frame_summaries` window export with Rust-side
  sled-contact point and line-id reduction:** aimed to stack the near-miss batched
  raw-window boundary cut with the near-miss Rust raw-frame summary, reducing both
  per-frame WASM calls and JS per-event reduction work. The fast path remained
  guarded to `_physicsFrameLimit === null`.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal cleared the short threshold: **5,985.0 ns/frame** (median
  **6,027.1**) versus standing **6,112.7 ns/frame**.
- Required full gate did not hold the keep threshold: **6,048.1 ns/frame**
  (median **6,120.9**) versus standing **6,112.7 ns/frame**.

Conclusion: the combined boundary/reduction path improved mean full perf by only
about **1.06%** and had a worse median, below the required >1.5% hold threshold.
Reverted and rebuilt the standard artifact.

## Session 96 (2026-06-06 cont.) — flat history grid map, rejected

Rejected probe:

- **Store the Rust collision-history `HistGrid` in the existing `FlatIntMap`
  instead of `HashMap`:** aimed to speed up the `add_to_cell` hotspot by replacing
  generic hash-table entry lookup with the project’s integer-specialized flat map.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,382.4 ns/frame** (median **6,360.3**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the flatter map worsened the WASM/codegen shape and probe behavior for
this history workload. Reverted without full gate and rebuilt the standard artifact.

## Session 97 (2026-06-06 cont.) — coordinate-carrying line cells, rejected

Rejected probe:

- **Carry raster cell coordinates through `line_cells` instead of storing only
  Szudzik hashes:** aimed to avoid repeated `unhash_int_pair` inverse-pairing work
  in `push_line`, `remove_line`, and add-line history invalidation.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,192.9 ns/frame** (median **6,169.8**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: avoiding the inverse pairing was not enough to offset the larger cell
payload and changed WASM shape. Reverted without full gate and rebuilt the standard
artifact.

## Session 98 (2026-06-06 cont.) — scalar contact-line construction, rejected

Rejected probe:

- **Rewrite `buildPreContactLines`/`buildPostContactLines` to scalar loops instead
  of temporary vector objects:** aimed to reduce allocation pressure in the
  contact-centered placement path visible in the fresh profile.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal was noisy and worse: **10,423.2 ns/frame** mean with one large
  outlier, median **6,299.1**, versus the current standing **6,112.7 ns/frame**.

Conclusion: the scalar rewrite changed the V8 hot-loop shape for the worse despite
lower nominal allocation. Reverted without full gate.

## Session 99 (2026-06-06 cont.) — baked Rust constraint constants, rejected

Rejected probe:

- **Bake the fixed rider constraint rest/endurance values into the Rust kernel
  with `f64::from_bits`:** aimed to remove the per-cache `rest`/`endur` arrays and
  two `step_state` parameters from the dominant `compute_to` path while preserving
  exact floating-point values.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,219.2 ns/frame** (median **6,176.5**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the baked constants produced a slower wasm/kernel shape than the
array-backed cache values. Reverted without full gate and rebuilt the standard
artifact.

## Session 100 (2026-06-06 cont.) — reusable reconcile buffers, rejected

Rejected probe:

- **Keep reusable `undo_ids` and `redo_lines` vectors on each Rust `Holder` for
  `update_computed`:** aimed to avoid per-reconcile vector allocations and the
  explicit redo reverse in the visible version-tree reconciliation bucket.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,252.6 ns/frame** (median **6,228.5**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the reusable buffers and changed apply shape made reconciliation
slower despite avoiding fresh vector allocation. Reverted without full gate and
rebuilt the standard artifact.

## Session 101 (2026-06-06 cont.) — Binaryen `--converge`, rejected

Rejected artifact probe:

- **Run the release wasm artifact through `wasm-opt -O3 --converge`:** aimed to
  see whether repeated Binaryen optimization passes could find a better fixed
  point than the standard single `-O3` build.

Result:

- `npm run build:wasm && wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext -O3 --converge ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,217.2 ns/frame** (median **6,209.5**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: converged Binaryen optimization produced a slower artifact. Rebuilt
the standard artifact without `--converge`.

## Session 102 (2026-06-06 cont.) — broader compute flat-log reserves, rejected

Rejected probe:

- **Reserve both frame metadata vectors and flat per-frame logs before
  `Cache::compute_to` extends a frame cache:** aimed to build on the earlier
  side-vector reserve near-miss by also smoothing allocation for collision events,
  touched history cells, snapshot links, and touched collision lines.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,219.4 ns/frame** (median **6,244.8**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the additional flat-log reservations added enough allocation/memory
pressure or code-shape cost to lose versus the baseline. Reverted without full
gate and rebuilt the standard artifact.

## Session 103 (2026-06-06 cont.) — Binaryen `--optimize-for-js`, rejected

Rejected artifact probe:

- **Run the release wasm artifact through `wasm-opt -O3 --optimize-for-js`:**
  aimed to test Binaryen's JS-engine-oriented wasm shaping on the current V8
  workload without changing Rust source or floating-point semantics.

Result:

- `npm run build:wasm && wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext -O3 --optimize-for-js ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,241.9 ns/frame** (median **6,209.0**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the JS-oriented Binaryen pass produced a slower artifact. Rebuilt the
standard artifact without `--optimize-for-js`.

## Session 104 (2026-06-06 cont.) — Binaryen `--ignore-implicit-traps`, rejected

Rejected artifact probe:

- **Run the release wasm artifact through `wasm-opt -O3 --ignore-implicit-traps`:**
  aimed to test a narrower trap-related code motion assumption than the earlier
  `--traps-never-happen` probe.

Result:

- `npm run build:wasm && wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext -O3 --ignore-implicit-traps ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal did not beat baseline: **6,137.3 ns/frame** (median **6,085.1**)
  versus the current standing **6,112.7 ns/frame**.

Conclusion: the median was a little lower, but the mean was slower and the signal
did not clear the >1.5% threshold. Rebuilt the standard artifact without
`--ignore-implicit-traps`.

## Session 105 (2026-06-06 cont.) — `wee_alloc` wasm allocator, rejected

Rejected probe:

- **Use `wee_alloc` as the wasm32 global allocator:** aimed to test whether a
  smaller/simpler allocator improved the Rust/WASM engine's Vec/HashMap allocation
  traffic during cache construction and reconciliation.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed severely to **18,384.2 ns/frame** (median **18,175.6**)
  versus the current standing **6,112.7 ns/frame**.

Conclusion: `wee_alloc` is far too slow for this allocation-heavy workload.
Removed the dependency, restored the lockfile, and rebuilt the standard artifact.

## Session 106 (2026-06-06 cont.) — Binaryen `--low-memory-unused`, rejected

Rejected artifact probe:

- **Run the release wasm artifact through `wasm-opt -O3 --low-memory-unused`:**
  aimed to test whether assuming the low memory area is unused helps Binaryen
  simplify the current Rust/WASM artifact.

Result:

- `npm run build:wasm && wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext -O3 --low-memory-unused ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,194.3 ns/frame** (median **6,187.9**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the low-memory assumption produced a slower artifact. Rebuilt the
standard artifact without `--low-memory-unused`.

## Session 107 (2026-06-06 cont.) — Binaryen `--flatten`, rejected

Rejected artifact probe:

- **Run the release wasm artifact through `wasm-opt -O3 --flatten`:** aimed to
  test whether flattening control flow after the standard optimization pipeline
  improved V8's hot-path code generation.

Result:

- `npm run build:wasm && wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext -O3 --flatten ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,287.9 ns/frame** (median **6,277.1**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: flattening control flow made the artifact slower. Rebuilt the
standard artifact without `--flatten`.

## Session 108 (2026-06-06 cont.) — Binaryen `--flatten --rereloop`, rejected

Rejected artifact probe:

- **Run the release wasm artifact through `wasm-opt -O3 --flatten --rereloop`:**
  standalone `--rereloop` requires flattened IR, so this tested the paired
  control-flow reshape.

Result:

- Standalone `--rereloop` after standard `-O3` failed with Binaryen's "IR must be
  flat" requirement, so it was not treated as a perf probe.
- `npm run build:wasm && wasm-opt --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext -O3 --flatten --rereloop ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,219.5 ns/frame** (median **6,229.0**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the paired flatten/rereloop control-flow shape was slower. Rebuilt
the standard artifact.

## Session 109 (2026-06-06 cont.) — uncapped extractor loop split, rejected

Rejected probe:

- **Split `extractRawTrajectoryWindow` into a tight uncapped loop and the existing
  hard-limit metered loop:** aimed to remove the per-frame `_physicsFrameLimit`
  branch from the default perf path while preserving the same before/after
  physics-frame accounting.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,245.4 ns/frame** (median **6,219.9**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the branch split changed V8's loop shape for the worse. Reverted
without full gate.

## Session 110 (2026-06-06 cont.) — Rust `opt-level="s"`, rejected

Rejected build-profile probe:

- **Build the WASM release artifact with Rust `opt-level="s"` while keeping the
  standard Binaryen `-O3` pass:** aimed to test whether a smaller Rust-generated
  artifact improves V8 hot-path code layout versus the current `opt-level=3`.

Result:

- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,295.3 ns/frame** (median **6,339.0**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: size-focused Rust codegen made the current artifact slower. Restored
`opt-level=3` and rebuilt the standard artifact.

## Session 111 (2026-06-06 cont.) — squared-distance repel guard, rejected

Rejected source probe:

- **Guard `resolve_repel` with squared distance before taking `sqrt`:** aimed to
  skip the square root when the repel constraint is inactive, while preserving the
  original active-constraint math.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,236.3 ns/frame** (median **6,209.5**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the extra compare/multiply and changed branch shape cost more than
the skipped square roots on this workload. Reverted the source change and rebuilt
the standard artifact.

## Session 112 (2026-06-06 cont.) — single sled-contact array cache, rejected

Rejected wrapper probe:

- **Reuse frozen singleton `sledContacts` arrays for frames with exactly one sled
  contact point:** aimed to reduce per-frame allocation/GC in
  `getRawFrameAtFrame` while preserving event-order arrays for multi-contact
  frames.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,257.6 ns/frame** (median **6,272.7**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the extra branch/state in the raw-frame wrapper outweighed the saved
single-contact allocations on the perf workload. Reverted without a full gate.

## Session 113 (2026-06-06 cont.) — raw-frame event offset loop, rejected

Rejected wrapper probe:

- **Carry an event-buffer offset in `getRawFrameAtFrame` instead of recomputing
  `p * 3` for each field:** aimed to make the hot raw-frame collision scan a
  simpler indexed loop without changing emitted contact order.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,218.2 ns/frame** (median **6,220.2**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: V8's existing indexed loop shape was better than the carried-offset
variant. Reverted without a full gate.

## Session 114 (2026-06-06 cont.) — deferred bind distance, rejected

Rejected source probe:

- **Move `resolve_bind`'s `dist()` call inside the `fsu == -1` branch:** aimed to
  skip side-effect-free square roots after rider/sled bindings have already
  unbound. This was retested because the current source still had the unconditional
  distance calculation despite an older log note from the early constraint-unroll
  work.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal was **6,136.0 ns/frame** (median **6,142.0**) versus the current
  standing **6,112.7 ns/frame**, not a held >1.5% improvement.

Conclusion: on the current optimized baseline this branch move does not hold a
measurable win. Reverted the source change and rebuilt the standard artifact.

## Session 115 (2026-06-06 cont.) — remove point-step unit multiply, rejected

Rejected source probe:

- **Replace `(pos - prev) * (1.0 - 0.0) + gravity` with `(pos - prev) + gravity`
  in the point step:** aimed to remove an apparent no-op multiply while preserving
  the gravity addition, including the x-axis `+ 0.0` behavior.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,185.5 ns/frame** (median **6,165.6**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: LLVM/Binaryen/V8 prefer the original arithmetic shape. Reverted the
source change and rebuilt the standard artifact.

## Session 116 (2026-06-06 cont.) — lazy collision response loads, rejected

Rejected source probe:

- **Defer `prevx`, `prevy`, and friction loads in the collision loop until after
  `line_cache.lookup` finds a line bucket:** aimed to avoid unused state/friction
  loads for collidable points whose center cell has no candidate lines while
  preserving the same collision math and event order.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal improved only to **6,071.3 ns/frame** (median **6,071.8**) versus
  the current standing **6,112.7 ns/frame**: directionally positive but about
  **0.7%**, below the required >1.5% threshold.

Conclusion: the load deferral is a near miss, not a commit-worthy standalone win.
Reverted the source change and rebuilt the standard artifact.

## Session 117 (2026-06-06 cont.) — three-way Rust near-miss composite, rejected

Rejected composite probe:

- **Stack three independent below-threshold Rust near misses:** lazy collision
  response loads (Session 116), single-scan grid-line insertion (Session 86), and
  pre-reserving `compute_to` frame/offset vectors (Session 55). The goal was to
  see whether small verified wins compose into a commit-worthy >1.5% improvement.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal cleared the short threshold at **5,941.2 ns/frame** (median
  **5,894.5**) versus the current standing **6,112.7 ns/frame**.
- Required full gate (`LR_ENGINE=wasm npm run perf`) did **not** hold:
  **6,080.5 ns/frame** (median **6,151.8**) versus standing **6,112.7**.

Conclusion: the stacked near misses still only improved full-gate mean by about
**0.5%** and worsened the median, so it is not commit-worthy. Reverted all three
source changes and rebuilt the standard artifact.

## Session 118 (2026-06-06 cont.) — raw-frame pair event buffer, rejected

Rejected ABI/wrapper probe:

- **Make `get_raw_frame` write raw-frame collision pairs `(line_id, point_idx)`
  instead of full `(iteration, line_id, point_idx)` triples:** `getUpdatesAtFrame`
  still used the existing triple export, while the detector raw-frame path never
  reads iteration. This aimed to reduce Rust event-buffer writes and JS reads
  without moving line/contact de-duplication into Rust.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,194.4 ns/frame** (median **6,170.4**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the raw-frame pair layout changed the ABI/wrapper loop shape for the
worse. Reverted the Rust/JS changes and rebuilt the standard artifact.

## Session 119 (2026-06-06 cont.) — exact zero-angle detector fast path, rejected

Rejected detector probe:

- **Return `0` from `signedAngleDeg` when `cross === 0 && dot > 0`:** after the
  existing exact zero-vector guard, this is a strictly same-direction case where
  `Math.atan2(cross, dot)` cannot produce a kick. The goal was to skip a visible
  `atan2` leaf without changing kick events or angles.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,292.6 ns/frame** (median **6,296.1**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the extra branch hurt the detector loop shape more than any skipped
`atan2` helped. Reverted without a full gate.

## Session 120 (2026-06-06 cont.) — direct kick-angle threshold compare, rejected

Rejected detector probe:

- **Replace `Math.abs(a) >= P.thetaDeg` with `a >= P.thetaDeg || a <= -P.thetaDeg`
  for kick detection:** aimed to remove a visible `Math.abs` call while preserving
  the same kick threshold semantics for numeric signed angles.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,160.8 ns/frame** (median **6,116.4**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the direct two-sided comparison did not improve the detector loop.
Reverted without a full gate.

## Session 121 (2026-06-06 cont.) — inline raw-frame current-version check, rejected

Rejected Rust probe:

- **Inline the `update_computed` current-version fast path inside
  `raw_frame_into`:** aimed to avoid an extra version lookup/function path for the
  common sequential detector scan where the shared cache is already synced to the
  same engine handle, while still falling back to exact reconciliation when needed.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal improved only to **6,078.4 ns/frame** (median **6,130.6**) versus
  the current standing **6,112.7 ns/frame**: about **0.56%**, below the required
  >1.5% threshold, and median worsened.

Conclusion: the current-version inline check is a near miss but not a standalone
win. Reverted the source change and rebuilt the standard artifact.

## Session 122 (2026-06-06 cont.) — raw-frame holder precompute, rejected

Rejected Rust probe:

- **Use the initial raw-frame validity lookup to precompute the holder id before
  calling `update_computed`:** aimed to avoid the post-update `ver(h).holder`
  lookup in `raw_frame_into` while preserving the same reconcile behavior.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,172.2 ns/frame** (median **6,210.7**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: this version/holder lookup shape was slower than the existing
`valid` + `update_computed` + `ver` sequence. Reverted the source change and
rebuilt the standard artifact.

## Session 123 (2026-06-06 cont.) — object-attached engine-line cache, rejected

Rejected JS probe:

- **Store the `engineLineFromTrackLine` field snapshot directly on each
  `TrackLine` via a private symbol instead of using the existing `WeakMap`:**
  aimed to avoid the `WeakMap.get` lookup while preserving the same geometry
  mutation checks before reusing converted engine-line objects.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal improved only to **6,032.3 ns/frame** (median **6,064.3**) versus
  the current standing **6,112.7 ns/frame**: about **1.3%**, below the required
  >1.5% threshold.

Conclusion: object-attached caching is a near miss but not a commit-worthy
standalone win. Reverted without a full gate.

## Session 124 (2026-06-06 cont.) — object cache plus lazy collision loads, rejected

Rejected composite probe:

- **Combine Session 123's object-attached engine-line cache with Session 116's
  lazy collision response loads:** aimed to see whether two near misses stacked
  into a stable >1.5% improvement when the JS line-conversion path and Rust
  collision loop both avoided unnecessary memory work.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal improved to **6,011.9 ns/frame** (median **5,977.3**) versus the
  current standing **6,112.7 ns/frame**, clearing the short-run threshold.
- Full gate `LR_ENGINE=wasm npm run perf` measured **6,079.3 ns/frame** (median
  **6,138.1**) versus the current standing **6,112.7 ns/frame**: about **0.55%**,
  below the required >1.5% threshold, with median worse.

Conclusion: the composite looked promising in short signal but did not hold under
the full perf gate. Reverted both source changes and rebuilt the standard
artifact.

## Session 125 (2026-06-06 cont.) — Rust ThinLTO build profile, rejected

Rejected build-profile probe:

- **Switch `[profile.release] lto = true` to `lto = "thin"` for the WASM engine:**
  aimed to test whether ThinLTO's different inlining/layout decisions produced a
  faster V8 WASM code shape while preserving the same Rust source and floating
  point operation order.

Result:

- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **6,109.2 ns/frame** (median **6,153.5**) versus the
  current standing **6,112.7 ns/frame**: effectively flat mean and worse median,
  far below the required >1.5% threshold.

Conclusion: ThinLTO did not improve the current artifact. Restored `lto = true`
and rebuilt the standard WASM artifact.

## Session 126 (2026-06-06 cont.) — proximity side multiplier, rejected

Rejected JS probe:

- **Store a `+1`/`-1` side multiplier in pre-target segment-risk records and use
  `signedDistance * side` instead of branching on the flipped flag for each
  point/line proximity check:** aimed to reduce branch work in
  `hasPreTargetSledProximityFromTrace` while preserving the same collidable-side
  predicate.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,187.2 ns/frame** (median **6,170.6**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: V8 preferred the existing branch shape over the multiplier in this
hot heuristic loop. Reverted without a full gate.

## Session 127 (2026-06-06 cont.) — repel rest-load CSE, rejected

Rejected Rust probe:

- **Store `rest[k]` once in `resolve_repel` and reuse it for the active check and
  correction term:** aimed to avoid a repeated fixed-table load in the inlined
  repel-constraint path without changing the distance arithmetic.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **6,122.5 ns/frame** (median **6,194.2**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: LLVM/Binaryen already produce a better shape from the original
repeated unsafe load expression. Reverted the source change and rebuilt the
standard WASM artifact.

## Session 128 (2026-06-06 cont.) — fixed BindJoint unroll, rejected

Rejected Rust probe:

- **Replace the final three-item `JOINTS` loop with explicit inlined
  `resolve_joint` calls using unchecked state-array access:** aimed to remove the
  tiny fixed loop and bounds checks from the non-iterating BindJoint pass while
  preserving the original `cross >= 0.0` branch behavior.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,187.4 ns/frame** (median **6,203.9**) versus the
  current standing **6,112.7 ns/frame**.

Conclusion: the explicit unroll/code growth was slower than the compact loop in
the current optimized WASM artifact. Reverted the source change and rebuilt the
standard artifact.

## Session 129 (2026-06-06 cont.) — object cache plus one-pass grid insertion, rejected

Rejected composite probe:

- **Combine Session 123's object-attached engine-line conversion cache with
  Session 86's one-pass expanded-grid bucket insertion:** aimed to stack two
  independent below-threshold wins, reducing JS `WeakMap` lookup overhead during
  engine construction and Rust duplicate/position scans during line-grid
  registration.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal improved to **6,035.7 ns/frame** (median **6,087.1**) versus the
  current standing **6,112.7 ns/frame**: about **1.26%**, below the required
  >1.5% threshold.

Conclusion: the composite is another near miss but still not commit-worthy.
Reverted both source changes and rebuilt the standard WASM artifact.

## Session 130 (2026-06-06 cont.) — raw-frame sled-point range filter, rejected

Rejected JS probe:

- **Check `pointIdx < 2 || pointIdx > 5` before computing the sled-point bit in
  the WASM raw-frame wrapper:** aimed to avoid a bit shift/mask for rider-side
  collision records while preserving sled-contact order and line-id handling.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed slightly to **6,134.3 ns/frame** (median **6,116.7**)
  versus the current standing **6,112.7 ns/frame**.

Conclusion: the existing `SLED_POINT_MASK` bit-test remains the better V8 shape.
Reverted without a full gate.

## Session 131 (2026-06-06 cont.) — three-way construction/collision composite  ⭐ kept

Kept composite:

- **Object-attached engine-line conversion cache:** store the last converted
  engine-line snapshot on each `TrackLine` via a private symbol instead of using
  the exported `WeakMap`, avoiding the JS weak-map lookup on hot engine
  construction paths while preserving all geometry mutation checks.
- **One-pass expanded-grid bucket insertion:** combine duplicate detection and
  insertion-position search in `insert_grid_line`, preserving group order and
  descending line-id order inside each group.
- **Lazy collision response loads:** load `prevx`, `prevy`, and friction only
  after `line_cache.lookup` finds a candidate line bucket for the point's center
  cell, preserving collision response arithmetic while avoiding unused loads for
  empty cells.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal cleared the short gate at **5,962.6 ns/frame** (median
  **5,967.7**) versus the current standing **6,112.7 ns/frame**.
- Required full gate `LR_ENGINE=wasm npm run perf` held at
  **5,978.5 ns/frame** (median **6,039.2**) versus **6,112.7 ns/frame**:
  about **2.2%** mean improvement, above the required >1.5% threshold.

Conclusion: the individual near misses did not hold alone, but together they
change enough JS construction and Rust collision/grid work to clear the full
gate. Kept and committed.

**Standing after three-way construction/collision composite:** **5,978.5
ns/physics-frame**. Still above the <3,000 ns/frame goal.

## Session 132 (2026-06-06 cont.) — compute-to frame reserve retest, rejected

Rejected Rust probe:

- **Reserve `frames` and per-frame side-offset vectors before `Cache::compute_to`
  extends the shared frame cache:** retested Session 55's small reserve idea
  against the new Session 131 baseline, where allocation/code shape around
  construction and collision changed.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,942.3 ns/frame** (median **5,989.8**) versus the
  current standing **5,978.5 ns/frame**: only about **0.6%**, below the required
  >1.5% threshold.

Conclusion: pre-reserving frame metadata remains too small/noisy to keep.
Reverted the source change and rebuilt the standard WASM artifact.

## Session 133 (2026-06-06 cont.) — engine-line cache flag packing, rejected

Rejected JS probe:

- **Store `flipped`/`leftExtended`/`rightExtended` as one numeric `flags` field in
  the object-attached engine-line cache:** aimed to reduce hot cache-hit
  comparisons in `engineLineFromTrackLine` after Session 131 made this cache part
  of the committed baseline.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,964.0 ns/frame** (median **5,998.2**) versus the
  current standing **5,978.5 ns/frame**: effectively flat and below the required
  >1.5% threshold.

Conclusion: the packed flag field does not provide a material win and changes the
JS object shape enough to stay below the keep bar. Reverted without a full gate.

## Session 134 (2026-06-06 cont.) — indexed WASM `addLine` loop, rejected

Rejected JS wrapper probe:

- **Replace the WASM wrapper's `for...of` over batched `addLine` arrays with an
  indexed `for` loop:** aimed to avoid iterator overhead while adding candidate
  line batches through the WASM ABI.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,940.4 ns/frame** (median **5,953.4**) versus the
  current standing **5,978.5 ns/frame**: about **0.64%**, below the required
  >1.5% threshold.

Conclusion: the indexed loop is directionally positive but too small to keep on
the new baseline. Reverted without a full gate.

## Session 135 (2026-06-06 cont.) — current weak-positive composite, rejected

Rejected composite probe:

- **Stack Sessions 132, 133, and 134:** combine `compute_to` frame/offset
  pre-reserve, packed object-cache line flags, and indexed WASM `addLine` batch
  iteration to test whether the current-baseline weak positives compose into a
  keep-worthy win.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,974.5 ns/frame** (median **6,008.7**) versus the
  current standing **5,978.5 ns/frame**: effectively flat, far below the required
  >1.5% threshold.

Conclusion: these weak positives do not compose; the changed shapes interfere or
fall into noise. Reverted all three source changes and rebuilt the standard WASM
artifact.

## Session 136 (2026-06-06 cont.) — larger line-cell cache retune, rejected

Rejected Rust probe:

- **Increase `LINE_CELL_CACHE_SLOTS` from 64 to 128 on the Session 131 baseline:**
  retested the frame-local line-bucket cache size after lazy collision-response
  loads changed the surrounding collision-loop cost.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **5,991.0 ns/frame** (median **6,036.4**) versus the
  current standing **5,978.5 ns/frame**.

Conclusion: the larger cache footprint/code shape is still slower than the
64-slot direct-mapped cache. Reverted and rebuilt the standard WASM artifact.

## Session 137 (2026-06-06 cont.) — Binaryen `-O4` retest, rejected

Rejected build-pipeline probe:

- **Run the current Session 131 WASM artifact through `wasm-opt -O4` instead of
  the standard build script's `-O3`:** retested Binaryen's more aggressive pass
  after the kept construction/collision composite changed the final WASM code.

Result:

- `npm run build:wasm && wasm-opt ... -O4 ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,933.5 ns/frame** (median **5,950.0**) versus the
  current standing **5,978.5 ns/frame**: about **0.75%**, below the required
  >1.5% threshold.

Conclusion: O4 is directionally positive on the short signal but still too small
to keep. Rebuilt the standard `-O3` artifact.

## Session 138 (2026-06-06 cont.) — O4 plus indexed addLine loop, rejected

Rejected composite probe:

- **Combine Binaryen `-O4` with indexed WASM wrapper `addLine` iteration:**
  aimed to see whether the directionally positive O4 artifact and directionally
  positive indexed adapter loop stacked into a held >1.5% improvement on the
  Session 131 baseline.

Result:

- `npm run build:wasm && wasm-opt ... -O4 ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,026.1 ns/frame** (median **6,064.0**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the two changes do not compose; the indexed loop worsened the O4
artifact shape. Reverted the JS change and rebuilt the standard `-O3` artifact.

## Session 139 (2026-06-06 cont.) — inline FlatIntMap mutation helpers, rejected

Rejected Rust code-shape probe:

- **Add `#[inline]` to `FlatIntMap::get_or_insert_default`, `insert`, and
  `remove`:** aimed to improve the custom line-grid map's mutation call shape
  during line registration/removal after the kept one-pass bucket insertion
  change.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **6,007.0 ns/frame** (median **6,073.9**) versus current
  standing **5,978.5 ns/frame**.

Conclusion: the inlining hints changed the WASM/codegen shape for the worse on
the current baseline. Reverted the source change and rebuilt the standard WASM
artifact.

## Session 140 (2026-06-06 cont.) — narrow line-cache epochs, rejected

Rejected Rust cache-layout probe:

- **Change `LineCellCache` epochs/current epoch from `u32` to `u16`:** aimed to
  reduce the frame-local line-bucket cache footprint and compare width without
  changing lookup semantics; wrap still clears the epoch array and invalidates
  cache entries.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,979.9 ns/frame** (median **6,000.3**) versus current
  standing **5,978.5 ns/frame**, effectively flat and far below the required
  >1.5% threshold.

Conclusion: narrower epoch storage does not move the current baseline. Reverted
the source change and rebuilt the standard WASM artifact.

## Session 141 (2026-06-06 cont.) — first-collision-only line collision map retest, rejected

Rejected Rust collision-bookkeeping probe:

- **Store only the first collision frame per line in `Frame.collisions`:**
  retested the old structurally valid simplification on the Session 131 baseline.
  `_removeLine` only asks for the first collision frame, so later per-line
  collision entries are not semantically needed if rollback removes the first
  entry when its frame is truncated.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal looked keep-worthy at **5,871.4 ns/frame** (median **5,934.0**)
  versus current standing **5,978.5 ns/frame**.
- Required full gate failed: `LR_ENGINE=wasm npm run perf` measured
  **6,020.9 ns/frame** (median **6,084.8**), slower than the current standing.

Conclusion: this remains a noisy short-run near miss and does not hold under the
required full perf gate. Reverted the source change and rebuilt the standard WASM
artifact.

## Session 142 (2026-06-06 cont.) — first-collision map plus O4 artifact, rejected

Rejected composite probe:

- **Combine first-collision-only `Frame.collisions` storage with Binaryen `-O4`:**
  aimed to see whether the noisy full-gate failure from Session 141 composed with
  the directionally positive O4 artifact shape from Session 137.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm && wasm-opt ... -O4 ...` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,008.7 ns/frame** (median **5,965.8**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the source change and O4 artifact shape do not compose. Reverted the
Rust source and rebuilt the standard `-O3` artifact.

## Session 143 (2026-06-06 cont.) — adjacent duplicate collision-line skip, rejected

Rejected Rust hot-path probe:

- **Skip `add_to_collisions` when the immediately previous collision in the same
  frame had the same line id:** preserved the full collision history and event
  stream, but aimed to avoid duplicate line-collision HashMap work for adjacent
  repeated hits.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,001.5 ns/frame** (median **6,018.9**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the extra branch/local in the collision loop costs more than any
avoided duplicate collision-map call. Reverted the source change and rebuilt the
standard WASM artifact.

## Session 144 (2026-06-06 cont.) — latest-frame `cache.cur` read path, rejected

Rejected Rust export-path probe:

- **Use `cache.cur` instead of indexing `cache.frames[f]` when the requested
  frame is the latest cached frame:** aimed to speed the common sequential
  detector read path after `compute_to(f)`, where `cur` is maintained as
  `frames.last()`.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,969.8 ns/frame** (median **6,013.9**) versus current
  standing **5,978.5 ns/frame**: a tiny mean improvement, but far below the
  required >1.5% threshold and with worse median.

Conclusion: the extra branch/helper shape is not worth keeping. Reverted the
source change and rebuilt the standard WASM artifact.

## Session 145 (2026-06-06 cont.) — narrow active-cell cache epochs, rejected

Rejected Rust cache-layout probe:

- **Change `ActiveCellCache` epochs/current epoch from `u32` to `u16`:** aimed to
  reduce the frame-local history-cell cache footprint on the hot `add_to_grid`
  append path. Epoch wrap behavior still clears the epoch array and invalidates
  cache entries.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,966.7 ns/frame** (median **5,968.3**) versus current
  standing **5,978.5 ns/frame**: directionally positive but only about **0.2%**,
  far below the required >1.5% threshold.

Conclusion: narrower active-cache epochs do not move the current baseline enough
to keep. Reverted the source change and rebuilt the standard WASM artifact.

## Session 146 (2026-06-06 cont.) — unrolled invalidation 3x3 scan, rejected

Rejected Rust invalidation-path probe:

- **Unroll the fixed inverse 3x3 neighborhood scan in
  `index_of_collision_in_cell`:** preserved the exact current scan order
  `dx=-1..1`, `dy=-1..1` and the same running `best` cutoff, but removed the two
  small loop counters from add-line history invalidation.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,090.6 ns/frame** (median **6,147.8**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the fixed unroll bloats or worsens the invalidation code shape. The
compact nested loop is better on the current baseline. Reverted the source change
and rebuilt the standard WASM artifact.

## Session 147 (2026-06-06 cont.) — outline collision-map append helper, rejected

Rejected Rust code-layout probe:

- **Change `add_to_collisions` from `#[inline]` to `#[inline(never)]`:** aimed to
  keep the collision-success branch and the fused step loop smaller by forcing the
  HashMap append path out of line.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **5,993.7 ns/frame** (median **6,038.3**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the call overhead/code layout is worse than the existing inline
helper. Restored `#[inline]` and rebuilt the standard WASM artifact.

## Session 148 (2026-06-06 cont.) — active-cell slot carry retest, rejected

Rejected Rust history-cache probe:

- **Carry the computed `ActiveCellCache` slot through the `add_to_cell` miss
  path:** retested the old "avoid recomputing active-cache slot on miss" idea on
  the Session 131 baseline by using slot-aware `get`/`put` helpers.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,954.0 ns/frame** (median **5,968.6**) versus current
  standing **5,978.5 ns/frame**: directionally positive but only about **0.4%**,
  below the required >1.5% threshold.

Conclusion: slot carry remains too small to keep on the current baseline.
Reverted the source change and rebuilt the standard WASM artifact.

## Session 149 (2026-06-06 cont.) — active-cell slot carry plus narrow epochs, rejected

Rejected active-cache composite:

- **Combine Session 148's active-cache slot carry with Session 145's `u16`
  active-cache epochs:** aimed to see whether two directionally positive
  history-cell-cache layout changes compose into a keep-worthy improvement.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,961.0 ns/frame** (median **5,987.7**) versus current
  standing **5,978.5 ns/frame**, still far below the required >1.5% threshold.

Conclusion: the two active-cache tweaks do not compose into a material win.
Reverted both source changes and rebuilt the standard WASM artifact.

## Session 150 (2026-06-06 cont.) — history-grid `get_mut` fast path, rejected

Rejected Rust history-map probe:

- **Replace `grid.entry(cell).or_default()` in `add_to_cell` with a
  `grid.get_mut(&cell)` existing-cell fast path plus `entry` only for new
  cells:** aimed to avoid `Entry` construction on active-cache misses where the
  history cell already exists from prior frames.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,006.0 ns/frame** (median **6,073.2**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the extra branch/double-lookup shape is slower than the existing
single `entry(...).or_default()` path. Reverted the source change and rebuilt the
standard WASM artifact.

## Session 151 (2026-06-06 cont.) — explicit LineCellCache fill branch, rejected

Rejected Rust line-cache code-shape probe:

- **Replace `LineCellCache::lookup`'s `Option::map(...).unwrap_or(null)` miss-fill
  shape with an explicit `if let Some(bucket)` branch:** aimed to simplify the
  dominant line-bucket cache fill path without changing hit/miss caching
  semantics.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,965.3 ns/frame** (median **6,031.4**) versus current
  standing **5,978.5 ns/frame**: a tiny mean improvement, below the required
  >1.5% threshold and with worse median.

Conclusion: the explicit branch shape is not material and does not hold enough
to keep. Reverted the source change and rebuilt the standard WASM artifact.

## Session 152 (2026-06-06 cont.) — redo-vector pop instead of reverse, rejected

Rejected Rust reconciliation probe:

- **Apply `update_computed` redo lines with `while let Some(l) = redo_lines.pop()`
  instead of `redo_lines.reverse(); for l in redo_lines`:** preserved oldest-first
  replay because redo lines are collected most-recent-first, but avoided the
  explicit reverse pass.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,920.4 ns/frame** (median **5,924.3**) versus current
  standing **5,978.5 ns/frame**: directionally positive, but about **1.0%** and
  below the required >1.5% threshold.

Conclusion: redo-pop is a near miss but not commit-worthy by itself. Reverted the
source change and rebuilt the standard WASM artifact.

## Session 153 (2026-06-06 cont.) — redo-pop plus O4 artifact, rejected

Rejected composite probe:

- **Combine Session 152's redo-pop source shape with Binaryen `-O4`:** aimed to
  see whether a directionally positive reconciliation change and the directionally
  positive O4 artifact shape would compose into a held improvement.

Result:

- `wasm-opt ... -O4` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,000.2 ns/frame** (median **6,037.8**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: redo-pop and O4 do not compose. Reverted the Rust source and rebuilt
the standard `-O3` artifact.

## Session 154 (2026-06-06 cont.) — redo-pop plus active-cache slot carry, rejected

Rejected composite probe:

- **Combine redo-vector pop replay with active-cell slot carry:** aimed to see
  whether Session 152's ~1.0% reconciliation signal and Session 148's ~0.4%
  history-cache signal stack into a keep-worthy >1.5% improvement.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,929.3 ns/frame** (median **5,941.2**) versus current
  standing **5,978.5 ns/frame**: directionally positive, but still only about
  **0.8%** and below the required >1.5% threshold.

Conclusion: the two near-misses do not stack enough to keep. Reverted both source
changes and rebuilt the standard WASM artifact.

## Session 155 (2026-06-06 cont.) — current WASM SIMD artifact retest, rejected

Rejected artifact/build probe:

- **Build the current engine with WebAssembly SIMD enabled:** retested the SIMD
  route after the latest committed Rust/kernel changes, using
  `RUSTFLAGS='-C target-feature=+simd128'` and `wasm-opt --enable-simd -O3`.
  Direct AVX is not exposed for the `wasm32-unknown-unknown` target; this is the
  path V8 can lower to host SIMD instructions.

Result:

- `RUSTFLAGS='-C target-feature=+simd128' cargo build --release --target wasm32-unknown-unknown --manifest-path engine-rs/Cargo.toml` ✓.
- `wasm-opt --enable-simd ... -O3` ✓.
- `wasm-objdump` confirmed `v128`/lane SIMD instructions in the artifact.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,915.1 ns/frame** (median **5,923.5**) versus current
  standing **5,978.5 ns/frame**: directionally positive, but only about **1.1%**
  and below the required >1.5% threshold.

Conclusion: current WASM SIMD is still a near miss, not a keep. Rebuilt the
standard non-SIMD `npm run build:wasm` artifact and confirmed the source/WASM diff
is clean.

## Session 156 (2026-06-06 cont.) — one-entry frame-cache last-cell fast path, rejected

Rejected Rust cache-shape probe:

- **Add a one-entry "last cell" shortcut in front of `LineCellCache` and
  `ActiveCellCache`:** aimed to skip the multiplicative direct-mapped slot hash
  for immediate repeated center-cell lookups/writes, especially adjacent paired
  rider points that often share a grid cell. The existing direct-mapped cache
  tables were left intact; the shortcut used the same per-frame epoch guard.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,039.9 ns/frame** (median **6,059.2**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the extra branch/state in the hot lookup path costs more than any
avoided slot hash. Reverted the Rust source and rebuilt the standard WASM
artifact.

## Session 157 (2026-06-06 cont.) — outline `step_state`, rejected

Rejected Rust code-layout probe:

- **Add `#[inline(never)]` to `step_state`:** a fresh CPU profile showed the top
  anonymous WASM function is the large optimized `Cache::compute_to` body with
  the solver inlined. This probe tried to split the per-frame solver into a
  stable out-of-line hot function, reducing the wrapper/JIT body size without
  changing physics arithmetic or call order.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,004.6 ns/frame** (median **6,029.2**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the call/code-layout tradeoff is worse than the current inlined
solver. Removed the attribute and rebuilt the standard WASM artifact.

## Session 158 (2026-06-06 cont.) — by-value collidable loop, rejected

Rejected Rust hot-loop shape probe:

- **Iterate `COLLIDABLES` by copied array value (`for i in COLLIDABLES`) instead
  of by reference (`for &i in COLLIDABLES.iter()`):** narrower than the earlier
  const-generic collidable unroll, aimed to trim the fixed point loop without
  changing collision order or specializing each point.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,980.9 ns/frame** (median **5,953.7**) versus current
  standing **5,978.5 ns/frame**: effectively flat and below the required >1.5%
  threshold.

Conclusion: the current reference-iterator loop remains the better baseline
shape. Reverted the source change and rebuilt the standard WASM artifact.

## Session 159 (2026-06-06 cont.) — history CellFrame list initial capacity, rejected

Rejected Rust allocation/code-shape probe:

- **Use `grid.entry(cell).or_insert_with(|| Vec::with_capacity(4))` for new
  history-cell frame lists:** kept the existing `HashMap::entry` path but tried
  to reduce small `Vec<CellFrame>` growth for cells revisited over multiple
  frames.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **5,995.7 ns/frame** (median **5,994.4**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: extra initial capacity and closure/code shape cost more than any
avoided per-cell list growth. Reverted to `entry(...).or_default()` and rebuilt
the standard WASM artifact.

## Session 160 (2026-06-06 cont.) — collision-map `get_mut` fast path, rejected

Rejected Rust collision-history probe:

- **Replace `coll.entry(line_id).or_default()` in `add_to_collisions` with an
  existing-list `get_mut` fast path and `insert(vec![index])` only for first
  collisions:** aimed to avoid `Entry` construction after a line id already has a
  collision list, while preserving per-frame dedup and rollback touch order.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,040.3 ns/frame** (median **6,066.7**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the split get/insert shape is worse than the existing single
`entry(...).or_default()` path for collision history too. Reverted the source
change and rebuilt the standard WASM artifact.

## Session 161 (2026-06-06 cont.) — detector default-params fast path, rejected

Rejected JS detector setup probe:

- **Make `detect(raw)` avoid the default-parameter `{}` allocation and second
  spread:** changed the default-call path to `params === undefined ?
  { ...DEFAULT_PARAMS } : { ...DEFAULT_PARAMS, ...params }`, preserving a fresh
  returned params object while trimming setup work for the common no-custom-params
  call.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,928.5 ns/frame** (median **5,964.1**) versus current
  standing **5,978.5 ns/frame**: directionally positive but only about **0.8%**,
  below the required >1.5% threshold.

Conclusion: default-params setup is a near miss, not commit-worthy. Reverted the
JS source change.

## Session 162 (2026-06-06 cont.) — redo-pop plus detector params fast path, rejected

Rejected composite probe:

- **Combine redo-vector pop replay with the detector default-params fast path:**
  aimed to see whether Session 152's Rust reconciliation near miss and Session
  161's JS detector setup near miss stack into a keep-worthy >1.5% improvement.

Result:

- `cargo test --manifest-path engine-rs/Cargo.toml` ✓.
- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,960.4 ns/frame** (median **5,958.5**) versus current
  standing **5,978.5 ns/frame**: only about **0.3%** and below the required
  >1.5% threshold.

Conclusion: these near misses do not compose. Reverted both source changes and
rebuilt the standard WASM artifact.

## Session 163 (2026-06-06 cont.) — SIMD artifact plus detector params fast path, rejected

Rejected artifact/JS composite probe:

- **Combine current WebAssembly SIMD build with the detector default-params fast
  path:** aimed to see whether Session 155's SIMD artifact near miss and Session
  161's JS detector setup near miss stack into a keep-worthy >1.5% improvement.

Result:

- `RUSTFLAGS='-C target-feature=+simd128' cargo build --release --target wasm32-unknown-unknown --manifest-path engine-rs/Cargo.toml` ✓.
- `wasm-opt --enable-simd ... -O3` ✓.
- `wasm-objdump` confirmed `v128`/lane SIMD instructions in the artifact.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,914.2 ns/frame** (median **5,911.5**) versus current
  standing **5,978.5 ns/frame**: directionally positive, but only about **1.1%**
  and below the required >1.5% threshold.

Conclusion: SIMD and detector setup do not compose enough to keep. Reverted the
JS source change, rebuilt the standard non-SIMD artifact, and confirmed the
source/WASM diff is clean.

## Session 164 (2026-06-06 cont.) — manual offbeat contact scan, rejected

Rejected JS hard-gate probe:

- **Replace `contactFrames.some((cf) => Math.abs(cf - e.frame) <= 1)` in
  `countOffBeatLandings` with an explicit order-independent loop:** aimed to avoid
  callback overhead in hot candidate hard-gate evaluation without relying on
  sorted contact-frame order.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,980.7 ns/frame** (median **6,018.7**) versus current
  standing **5,978.5 ns/frame**: effectively flat/regressive and below the
  required >1.5% threshold.

Conclusion: V8's optimized `Array.some` shape is at least as good as the manual
loop here. Reverted the JS source change.

## Session 165 (2026-06-06 cont.) — manual next-contact find loops, rejected

Rejected JS hard-gate probe:

- **Replace `Array.find` with explicit first-match loops in `releaseStateFrame`
  and `axisLookaheadEndFrame`:** preserved first-greater-contact semantics while
  avoiding callback allocation/dispatch in two candidate setup helpers.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,013.7 ns/frame** (median **6,032.5**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: the existing `Array.find` shape is better under V8 for this workload.
Reverted the JS source change.

## Session 166 (2026-06-06 cont.) — fixed sled-contact name mapping, rejected

Rejected JS WASM-wrapper probe:

- **Use a fixed sled-point index-to-name table in `getRawFrameAtFrame` instead of
  `ENTITY_IDS[pointIdx]`:** aimed to avoid a generic entity-name lookup after the
  existing sled-point bitmask already restricts `pointIdx` to PEG/TAIL/NOSE/STRING.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,968.5 ns/frame** (median **5,975.6**) versus current
  standing **5,978.5 ns/frame**: a tiny mean improvement, below the required
  >1.5% threshold.

Conclusion: the specialized mapping is too small to keep. Reverted the JS source
change.

## Session 167 (2026-06-06 cont.) — targeted gap-axis measurement, rejected

Rejected JS candidate-evaluation probe:

- **Add an optional target-axis filter to `measureGapAxes` and use it in
  `evaluateCandidateLines`:** aimed to avoid measuring axes that `axisCost` will
  not score for the current gap while preserving full-axis measurement for final
  reporting and other default call sites.

Result:

- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal regressed to **6,072.3 ns/frame** (median **5,999.0**) versus
  current standing **5,978.5 ns/frame**.

Conclusion: narrowing candidate `achieved` measurement is not a useful hot-path
win and likely hurts code shape more than it saves. Reverted the JS source
change.

## Session 168 (2026-06-06 cont.) — Rust-side raw-frame sled-event filter, rejected

Rejected WASM raw-frame probe:

- **Filter `raw_frame_into` collision records to sled-side points before writing
  the JS events buffer:** aimed to avoid copying and then JS-filtering non-sled
  collision events in the detector hot path while preserving sled-event ordering
  and JS-side line-id de-duplication.

Result:

- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓.
- 8-run signal measured **5,975.7 ns/frame** (median **6,000.7**) versus current
  standing **5,978.5 ns/frame**: effectively flat and below the required >1.5%
  threshold.

Conclusion: raw-frame event filtering is not material for this workload. Reverted
the Rust source change and rebuilt the standard WASM artifact.

## Session 169 (2026-06-06 cont.) — collapsed WASM metered-rider call, rejected

Rejected WASM/JS boundary probe:

- **Add `get_rider_delta` and a WASM-wrapper fast path for `getRiderMetered`:**
  aimed to collapse the hot `getLastFrameIndex` → `getRider` →
  `getLastFrameIndex` sequence into one WASM call when no hard frame limit is
  active, preserving exact delta charging by computing the pre/post frame indexes
  inside the reconciled Rust cache.
- Also tested a tighter JS shape that returned the rider object directly with an
  attached delta instead of allocating a `{ rider, delta }` wrapper.

Result:

- `npm run build:wasm` ✓.
- `LR_ENGINE=wasm npm run verify` ✓ for both JS wrapper shapes.
- Initial 8-run pair-object shape regressed to **6,005.6 ns/frame** (median
  **5,988.8**).
- Tighter rider-object shape gave a promising 8-run signal of **5,863.8 ns/frame**
  (median **5,924.2**), but the required full `LR_ENGINE=wasm npm run perf`
  regressed to **6,005.6 ns/frame** (median **6,080.9**) and did not hold the
  >1.5% threshold.

Conclusion: collapsing metered rider probes is too noisy/regressive in the full
gate. Reverted the Rust/JS source changes and rebuilt the standard WASM artifact.

## Session 170 (2026-06-06 cont.) — closed-form metering, cell-key encoding/memo, all rejected

Fresh CPU profile of the current build (`LR_ENGINE=wasm`, perf mini_burst, 6 runs
+ 1 warmup) reconfirms the standing shape: `wasm-function[27]` (the fused
step/collision/history loop, the largest function at 6,143 bytes) dominates
self-time (~36% across its samples); JS is ~8% total (`getRawFrameAtFrame` ~3.6%
the largest JS leaf, `detect` ~2.4%, `buildDriftReport`/`effectiveAxes` ~0.9% each),
GC ~4.6%. The WASM core is the whole game and is already heavily optimized.

Standing baseline this session (8 runs + 2 warmup): **~5,950 ns/frame**.

Rejected probes, all verified bit-identical under `LR_ENGINE=wasm npm run verify`
(engine + optimizer) and reverted:

- **Closed-form physics-frame charging in the metered detector paths:** in
  `extractRawTrajectoryWindow`, `getRiderMetered`, and `getSledPointPositionsMetered`,
  the *second* `getLastFrameIndex()` WASM call (the "after" read) is provably
  redundant. After the "before" read syncs the shared cache to the engine's
  version, that version is fixed, so each subsequent `getRider`/`get_raw_frame`
  reconcile is a no-op and `compute_to(frame)` grows the cache to exactly `frame`
  without overshooting. Hence `after == max(before, frame)` exactly — a closed
  form that removes one WASM boundary call per metered frame (one per extracted
  frame in the window loop) while charging the identical delta. Bit-identical
  (verify ✓), but **perf-neutral**: 8-run signal **5,976.7 ns/frame** vs **5,950.9**
  baseline (flat, within noise). The no-op `getLastFrameIndex` (early-return
  reconcile + return `len-1`) is already cheap and well-inlined by V8; removing it
  saved nothing measurable. Reverted (below the >1.5% bar).

- **Branchless bit-pack cell key instead of Szudzik `hash_int_pair`:** the i64
  cell key is purely internal (only ever a grid-map key / unpacked for the 3×3
  neighborhood; never returned to JS or folded into output), so any consistent
  bijection over the coordinate range is byte-identical. Replaced the Szudzik fold
  with `(cx << 32) | (cy & 0xFFFFFFFF)`. Bit-identical (verify ✓, cargo tests ✓),
  but **+26% regression** (8-run **7,522.7** vs **5,950.9**). Root cause: the
  direct-mapped cache slot functions (`(cell as u64).wrapping_mul(GOLDEN) & mask`)
  derive the slot from the **low** bits of the 64-bit product, but `(cx<<32)*GOLDEN`
  only influences the **high** bits — so the slot collapses to a function of `cy`
  alone, and every cell in a grid row aliases to one `ActiveCellCache`/`LineCellCache`
  slot → catastrophic cache thrashing. **Lesson:** Szudzik's compact keys (both
  coords influencing the low bits, nearby cells → nearby small values) are
  *load-bearing* for the cache-slot multiply-hashers; the key encoding is not free
  to change even though it doesn't affect output. Reverted.

- **Per-point center-cell key memoization across the 6 constraint iterations:** a
  collidable point's sub-14px per-iteration nudge usually keeps it in the same
  grid cell, so the integer cell coords (`cell_cor`, computed regardless) often
  repeat — letting us skip the Szudzik fold and reuse the prior key. Pure
  memoization (identical key value → byte-identical, verify ✓), but **perf-neutral**
  (8-run **5,963.1** vs **5,950.9**): the memo array loads/compares cancel the saved
  fold. Confirms `hash_int_pair` is not a meaningful cost in the optimized build —
  V8/wasm-opt handle the Szudzik fold efficiently. Reverted.

**Standing after Session 170:** **~5,950 ns/physics-frame**, unchanged — bit-identical
to lr-core/optimizer baselines, ≈56× faster than pristine JS (333k). Still above the
<3,000 goal. The accumulated evidence (Sessions ~90–170: ~80 consecutive rejected
probes across the WASM core, the JS detector, build flags, data structures, and now
the metering boundary and cell-key encoding) indicates the engine is at its practical
**bit-identical floor**: the dominant cost is the irreducible per-frame physics
(constraint solves + collision predicate + per-iteration history snapshots required
for exact addLine invalidation), and micro/structural reshaping of it is consistently
neutral-or-worse after `wasm-opt`/V8. A further ~2× to reach <3,000 most likely
requires either a change that is *not* bit-identical (a different invalidation
algorithm that records less history, or relaxed-precision math) or a larger rewrite
(e.g. an AoS+SIMD kernel), neither of which fits the current bit-identical gate.

## Session 171 (2026-06-06 cont.) — first campaign under the statistical gate: 3 re-mined candidates, all null

With the paired-bootstrap `perf_ab` gate in place (commit `2f59b17`, hardened in
`155561f`), re-tested the most promising previously-"failed-but-positive" probes
from this log at **R=100** (discovery rule: keep iff `P(faster) ≥ 0.95` and median
Δ < 0). All three were definitively null — the old 8-run signals that sourced them
were noise the new gate is designed to reject:

| candidate | old 8-run signal | R=100 verdict (base = HEAD `2f59b17`/`155561f`) |
|---|---|---|
| reconcile `add_line` cells-clone removal | (plausible) | Δ mean −0.03%, CI **[−0.27%, +0.26%]**, 50/100, P=53% — null |
| #2 redo-pop in `update_computed` (Session 152, "−1.0%") | −1.0% | Δ mean +0.07%, CI **[−0.13%, +0.26%]**, 46/100, P=30% — null (leaned slower) |
| #4 `detect()` default-params fast path (Session 161, "−0.8%") | −0.8% | Δ mean +0.05%, CI **[−0.15%, +0.26%]**, 48/100, P=32% — null |

All verified bit-identical (`LR_ENGINE=wasm npm run verify`) before measurement;
all reverted. #4 used the new `perf_ab --js` source-swap mode (validated end-to-end:
swaps only the changed `.ts`, shares the committed WASM, restores the tree).

**Conclusion.** The gate works exactly as intended — it bounds each effect to ±0.27%
and refuses to bank noise. But the corollary is decisive: the log's "sub-1.5%
positive 8-run signals" were **noise, not wins suppressed by the old bar** — so
re-mining them is low-yield. Sessions ~90–170 explored the WASM micro-surface
exhaustively; this confirms it is genuinely flat at the ~0.3% level. Real progress
toward <3,000 now requires a higher-ceiling lever (a profiled ≥1% target, a
larger structural change, or stepping outside strict bit-identity), not more
micro-probes. The decisive deliverable of this stretch is the **measurement
instrument** (calibrated paired-bootstrap A/B with WASM- and JS-swap modes), which
makes every future verdict trustworthy.

## Session 172 (2026-06-06 cont.) — instrumented the invalidation path; collides_with short-circuit rejected

User asked whether the addLine invalidation scan could be sped with a cheap
position pre-check before the full collision predicate. Rather than guess, added
throwaway counters (reverted after) to one `mini_burst@50k` compile:

```
addLine invalidations          : 13,201
  all-miss (no rider snap in any cell) : 7,078  (53.6%)   ← global early-out ceiling
grid lookups (hist.get)        : 375,156   (28.4 / invalidation, 12% hit)
collides_with calls            : 1,683,168   (127.5 / invalidation)
  → true                       : 808  (0.05%)
  → false, dir<=0 (velocity)   : 315,118  (18.7%)
  → false, dir>0 pos/bounds    : 1,367,242 (81.2%)        ← per-snapshot guard ceiling
ops ratio  lookups : collides  = 0.22 : 1
```

Findings: `collides_with` is the dominant invalidation cost (1.68M calls, ~4.5×
the lookups), and it computes `line_pos` (the costliest term) eagerly on all of
them though ~81% are already doomed by `dir`/`perp`. So the *logical* ceiling for a
short-circuit is large. (Also overturned a prior guess: >50% of invalidations touch
no rider snapshot at all, so a coarse early-out has real ceiling too.)

Tested two bit-identical short-circuit forms of `collides_with` (verify ✓ each):

| variant | R=100 verdict |
|---|---|
| two early-return branches (dir, then perp), `line_pos` last | **REJECT** — Δ +0.34%, CI [+0.13%, +0.54%], P(faster)=0.1% |
| eager dir/ox/oy/perp + **one** guard skipping only `line_pos` | **wash** — Δ +0.01%, CI [−0.22%, +0.23%], P(faster)=44% |

Conclusion: the per-call predicate is **ILP-bound, not op-bound** — the eager
branchless form lets the CPU compute `dir`/`perp`/`line_pos` in parallel; adding
branches to skip work serializes it and loses more than the ~3 skipped mults save
(2-branch regressed; 1-branch recovered only to a wash). The bit-identity rule
blocks the genuinely-cheaper algebraic forms (folding `inv_len_sq` into the bounds,
precomputing `normx·p1x+normy·p1y`) because they change float rounding. So per-call
invalidation optimization is exhausted. The remaining grounded lever is
**structural** — cut the 1.68M call count or skip the 53.6% all-miss invalidations'
lookups via a coarse occupancy/AABB index — a larger redesign that carries the same
"added-check overhead vs saved work" risk this session just demonstrated. Both
variants reverted; standing unchanged at ~5,950 ns/frame.

## Session 173 (2026-06-06 cont.) — instrumented step_state; repel sqrt-skip ⭐ KEPT (first statistical-gate win)

Generalized the instrument-first approach to the biggest unprofiled bucket,
`step_state` (~41% of compile). Throwaway counters on one `mini_burst@50k`
(reverted after):

```
sqrt budget          : 132/frame (6.65M total)
  sticks (always)    : 72/frame (54.5%)
  repels             : 12/frame; ACTIVE only 2.0% → 8.9% of all sqrt WASTED
  binds              : 48/frame; INTACT 96.8% → 1.2% wasted
  total wasted sqrt  : 10.1%
collision loop       : 60 visits/frame, 43% bucket-hit, 107 line-tests/frame, 8.9% hit
history add_to_grid  : 69.5/frame, active-cache 94.4% hit (already efficient)
```

Findings: the one real waste is the constraint solver's `sqrt` (~11% of compile),
almost all of it the two **repel** constraints (SHOULDER↔feet), inactive 98% of the
time yet computing `sqrt` every call. The collision predicate (91% miss) is
cheap/ILP-bound — short-circuiting won't help (Session 172 lesson); history is
already 94% cheap-append.

**Kept change — gate the repel sqrt on `len_sq < rest²`** (`kernel.rs::resolve_repel`):
compute `len_sq` without sqrt; only when `len_sq < r*r` compute `length =
len_sq.sqrt()` and run the *exact* original `if length < rest { … }`. Inside the
gate every value is byte-identical to the original; the only difference is skipping
the sqrt + apply when `len_sq ≥ r*r`.

- **Gates:** `cargo test` ✓ · `LR_ENGINE=wasm npm run verify` ✓ byte-identical
  (engine + optimizer) · `verify:engine --diff` ✓ **max err 0 over 6,940 frames**
  (all 5 fixtures). The ULP band where `len_sq < r*r` could disagree with
  `length < rest` does not occur for these inputs.
- **A/B (R=100):** Δ median **−0.49%** / mean −0.43%, 95% CI **[−0.65%, −0.19%]**,
  candidate won **79/100** rounds (p=0.000), **P(faster)=100%** → ✓ KEEP.

Equivalence — **proven for the actual rest, not just fixture-clean.** A standalone
exhaustive check on the real repel `rest = 0.5·√135.25` shows the original's
apply-region ends 2 ULPs *below* where the gate skips:
`L = sup{len_sq : √len_sq < rest} = 33.81249999999999` < `R2 = rest² = 33.81250000000001`.
The dangerous region `[R2, L]` (gate skips yet original would apply) is therefore
**empty — no f64 `len_sq` can make `len_sq < rest²` disagree with `length < rest`**.
Confirmed by a 4,000,005-value exhaustive scan of the f64 boundary window (0
disagreements) and a 5,000,000 boundary-biased full-function fuzz (0 mismatches);
also 0 of 200,000 *random* rests even have a non-empty band. So the
comparison-semantics worry does not apply to this constant. (The caveat narrows to:
a *different* repel rest could in principle have a non-empty band — re-run the
`R2 > L` check if the rider topology / length-factor ever changes.)

**Standing after Session 173:** **~5,884 ns/physics-frame** (was ~5,950), bit-identical
to the gate baselines. First win banked under the statistical gate — and the first
demonstration that instrument-survey → grounded candidate → R=100 gate yields a real,
trustworthy improvement the old >1.5% bar would have thrown away.

## Session 174 (2026-06-06 cont.) — instrumented the JS detector bucket (~21%); no fresh lever

Continued the instrument-survey on the next-biggest unprofiled bucket. Throwaway
counters (globalThis.__DIAG, reverted after) on one `mini_burst@50k`:

```
physics frames simulated        : 50,415
extractRawFrame calls           : 94,152   (1.87× → ~44k cache-hit re-extractions)
RawFrame objects built          : 94,152   (per-frame {pos,vel,arrays} → the ~5% GC)
collision event records scanned : 976,842  (10.4/frame; contactLineIds.includes work)
detect() calls                  : 1,294    (72.8 frames/call)
frames walked / supplied        : 92,561 / 94,152  (98.3% — only 1.7% past terminus)
signedAngleDeg (kick) calls     : 91,216   (~1/walked frame, atan2 each)
computeSummary calls            : 1.00/detect
```

Findings — the bucket is dominated by the **94k `RawFrame` object allocations** (the
~5% GC), which is exactly what Sessions 11/27/46/74 already attacked (streaming, flat
arrays, pre-sized arrays, direct raw-window evaluator) and all **regressed** — V8
prefers the current object shape. Everything else is necessary-and-locked:
- only **1.7% past-terminus** over-extraction (too small; Session 2 ~1.3–2.8%);
- kicks computed ~1/frame, but removing them in candidate windows was a wash
  (Session 38) and the angle math is bit-sensitive (Session 37 — `hypot`→`sqrt`
  changed track bytes), so the `atan2` is locked;
- `computeSummary`-skip regressed (Sessions 36/51); the `includes` dedup probed
  (Session 14).

The only not-previously-isolated quantity is the **1.87× extraction multiplier**
(~44k re-extractions of already-simulated frames), but those are re-reads across
*different forked versions* (each rebuilding the object), not same-(version,frame)
hits — so a memo cache doesn't cleanly apply, and it's the same allocation cost the
streaming probes already failed to remove.

Conclusion: the detector bucket, like the WASM engine, is at its bit-identical
floor. Across the three surveyed buckets (reconcile/invalidation S171–172,
step_state S173, detector S174) the instrument-first method found exactly **one**
fresh strict-bit-identical win — the repel sqrt-skip (S173, −0.49%). Standing
unchanged at ~5,884 ns/frame. The path below this needs relaxed bit-identity (gated
by the quality `decide`) or a structural rewrite, not further micro-surveys.

## Session 175 (2026-06-06 cont.) — `add_line` clone-elimination (move not clone), REJECT (inconclusive)

First probe into the ~26% reconcile bucket (methodology flags it "under-explored").
Looked at `Cache::add_line` (engine.rs), the per-collidable-line registration on the
compiler's hot fork→add→read path. Original eagerly **clones twice** per call before
the invalidation scan:

```rust
let cells = line_cells(&l);
self.lines_cells.insert(l.id, cells.clone());      // clone #1: Vec<i64>
push_line(&mut self.cell_lines, l.clone(), &cells); // clone #2: Line
for &cell in cells.iter() { … index_of_collision_in_cell(&self.hist, …, &l) … }
```

**Candidate — reorder so both moves replace clones.** Verified the dependency graph:
`index_of_collision_in_cell` reads only `hist`/`hist_snaps` (+ `&l`), and
`set_frames_length` mutates only `hist`/`coll`/`frames`/`events` — **all disjoint
from `cell_lines`/`lines_cells`**. So the grid registration (`push_line`) and the
`lines_cells` insert can move *after* the invalidation loop with byte-identical
result, letting `l` move into `push_line` and `cells` move into `lines_cells` —
**eliminating both heap clones** (one `Line`, one `Vec<i64>`) per collidable add.

- **Gates:** `cargo test` ✓ · `LR_ENGINE=wasm npm run verify` ✓ **byte-identical**
  (engine 5/5 fixtures + optimizer 4/4 cases). Pure data-structure reorder, no float
  math touched, so identity was expected and held.
- **A/B (R=100):** Δ median **−0.19%** / mean −0.09%, 95% CI **[−0.30%, +0.14%]**,
  candidate won **57/100** rounds (two-sided p=0.193), **P(faster)=84.9%** →
  **~ INCONCLUSIVE** (below the 0.95 discovery bar; CI straddles 0).

Verdict: **REJECT / revert.** The change is genuinely sound (two fewer allocations
per add, never slower in theory) and the data leans faster — but a true effect this
small (~0.19%) sits below R=100's ±0.26% resolution, so it cannot clear 0.95.
Escalating rounds *only* on this favorable-looking probe would be optional-stopping
bias (inflates the campaign FPR), so per the rule I reverted rather than fish for a
verdict. This quantifies the add_line clone cost: real but ≲0.2% — the reconcile
bucket's allocation overhead is too thin per-call to bank under the gate. Reverted;
standing unchanged at ~5,884 ns/frame. (If a future structural change makes add_line
materially hotter — e.g. more lines/compile — re-test; the reorder remains correct.)

## Session 176 (2026-06-06 cont.) — `add_line` move-not-clone + `resolve_bind` lazy sqrt (bundle) ⭐ KEPT (−1.15%)

Re-tested the S175 `add_line` clone-elimination **bundled** with a second strictly
bit-identical work-reduction, on the theory that two independent sub-resolution
reductions clear the R=100 floor together where neither did alone:

1. **`Cache::add_line` move-not-clone** (engine.rs) — run the invalidation loop
   first (it + `set_frames_length` touch only `hist`/`coll`/`frames`, disjoint from
   `cell_lines`/`lines_cells`), then **move** `l` into `push_line` and `cells` into
   `lines_cells` instead of cloning both. Removes one `Line` + one `Vec<i64>` heap
   clone per collidable add. (S175 measured this alone at −0.19%, P=84.9% — real but
   sub-resolution at R=100.)
2. **`resolve_bind` lazy sqrt** (kernel.rs) — `let length = dist(...)` was computed
   unconditionally but consumed only on the intact branch (`fsu == -1`, ~97%). Moved
   it inside the branch so the ~3% broken-bind calls skip the sqrt. **Strictly
   bit-identical** — unlike the S173 repel gate there is no comparison-semantics
   band: the value, when used, is the identical `dist()`; when unused it has no
   observable effect.

- **Gates:** `cargo test` ✓ · `LR_ENGINE=wasm npm run verify` ✓ **byte-identical**
  (engine 5/5 fixtures + optimizer 4/4 cases). Both are pure data-flow reorders, no
  float result changed.
- **A/B (R=150, pre-committed for resolution on the expected ~0.26% combined
  effect):** Δ median **−1.15%** / mean −1.16%, 95% CI **[−1.33%, −0.96%]**,
  candidate won **132/150** rounds (p=0.000), **P(faster)=100%** → ✓ **KEEP**.

The measured −1.15% is much larger than the ~0.26% the per-change estimates
predicted. Two readings: (a) S175's standalone −0.19% was an unlucky R=100 draw and
the true `add_line` effect is larger; (b) a favorable fixed code-layout offset from
this build pair (the floor R cannot remove, doc warns ≲0.5%). The sign test
(132/150) and tight CI rule out pure per-run noise, but to disentangle a layout
artifact the cumulative **3σ confirmation below rebuilds a fresh base arm** (averages
layout luck) — kept only if it survives that. **Standing after S176: ~5,866
ns/frame** (was ~5,884), pending 3σ confirmation.

**3σ confirmation (S176) — survives, not a layout artifact.** `perf_ab
--ref=de8ad7d --rounds=100 --p=0.9987` (base = start-of-session HEAD, **rebuilt fresh
in a worktree** → an independent build pair, so any fixed code-layout offset is
re-rolled): Δ median **−1.41%** / mean −1.23%, 95% CI **[−1.43%, −1.02%]**, candidate
won **90/100** rounds, **P(faster)=100% ≥ 99.87%** → ✓ CONFIRMED. An independent base
build still shows ~−1.4%, so the effect is the change, not build luck; S175's
standalone −0.19% was simply an underpowered/unlucky R=100 draw. **Standing after
S176: ~5,833 ns/frame** (confirmed; was ~5,884). The second statistical-gate win, and
the first to clear the 3σ cumulative bar this campaign.

## Session 177 (2026-06-06 cont.) — reconcile allocation cuts: update_computed scratch reuse + lazy `cur` resync (bundle) ⭐ KEPT (−0.44%)

Continued mining the reconcile bucket with the S176 bundle strategy (two independent,
strictly bit-identical allocation reductions, each sub-resolution alone, gated
together). Both target per-fork-switch heap churn on the hottest reconcile paths:

1. **`update_computed` scratch reuse** (engine.rs) — the patch-walk allocated two
   fresh `Vec`s (`undo_ids: Vec<i32>`, `redo_lines: Vec<Line>`) on every reconcile.
   Hoisted them to module statics (`RECONCILE_UNDO/REDO`, matching the existing
   `static mut` arena idiom), cleared on entry and **drained** on apply so the
   backing allocations amortize to zero after warmup. Single-threaded WASM, no
   re-entrancy (the redo loop's `cache.add_line` never calls `update_computed`), and
   the walk yields the identical id/line sequence. *Standalone R=100: median −0.36%,
   P=93.1%, won 64/150, sign p=0.007 — real but just under the 0.95 bar.*
2. **Lazy `cur` resync** (engine.rs) — `set_frames_length` eagerly did
   `cur = frames[len-1].clone()` (a full ~624-byte `State` copy) on **every**
   truncation. A multi-line arc add truncates many times in a row with no step
   between, so all but the last clone are overwritten before they're ever stepped.
   Replaced with a `cur_dirty` flag; `compute_to` resyncs once, only when actually
   about to step. `cur` is read only in `compute_to` (verified), so the flag is
   sound; `set_initial_states` clears it.

- **Gates:** `cargo test` ✓ · `LR_ENGINE=wasm npm run verify` ✓ **byte-identical**
  (engine 5/5 + optimizer 4/4). Pure allocation/timing changes, no float touched.
- **A/B (R=150, bundle vs S176 HEAD):** Δ median **−0.44%** / mean −0.41%, 95% CI
  **[−0.63%, −0.16%]**, candidate won **106/150** rounds (p=0.000), **P(faster)=100%**
  → ✓ **KEEP**. **Standing after S177: ~5,802 ns/frame** (was ~5,833), pending the
  cumulative 3σ confirmation below.

**Cumulative 3σ confirmation (S176+S177) — wins compound.** `perf_ab --ref=de8ad7d
--rounds=100 --p=0.9987` (base = start-of-session HEAD, rebuilt fresh → independent
build pair): Δ median **−1.78%** / mean −1.68%, 95% CI **[−1.89%, −1.47%]**, candidate
won **89/100** rounds, **P(faster)=100% ≥ 99.87%** → ✓ CONFIRMED. The two bundles
(−1.4% + −0.44%) compound to −1.78% with no false-positive leakage. **Confirmed
standing after this session: ~5,803 ns/frame** (was ~5,902 at de8ad7d). Three banked
strict-bit-identical wins this campaign now clear the 3σ cumulative bar; the
reconcile bucket's per-fork allocation churn was the productive seam (clone + Vec
reuse + lazy State resync), found by the "bundle independent sub-resolution
reductions" method that the S175 single-probe rule would have discarded.
