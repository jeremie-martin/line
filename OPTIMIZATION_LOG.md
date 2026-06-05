# Engine optimization log

Chronological record of the effort to make the compiler faster on everything
engine/computation-related, **while keeping behavior bit-identical**. One entry
per change attempt, with its verification result and its measured effect.

## Goal & method

- **Optimize only** `vendor/lr-core` (the vendored JS physics engine). The lever
  is per-frame **allocation count**, not the math.
- **Single metric:** `ns / physics-frame` from `npm run perf` (wall-clock ÷
  physics frames actually simulated; work-normalized, lower is better).
  Default config: `mini_burst` @ 50k budget, 10 timed runs + 2 warmup.
  Fast inner-loop signal: `npm run perf -- --reps=5 --budget=20000`.
- **Correctness gates** (must all hold for every kept change):
  1. `npm run verify` — per-frame oracle: non-scarf body state + `CollisionUpdate`
     records, byte-identical to recorded baseline over 5 fixtures.
  2. `npm run verify -- --diff` — numeric microscope: every non-scarf point
     position bit-identical (`max err 0`) over thousands of frames.
  3. **compile-hash ground truth** — `compile_hash.ts` hashes the actual
     compiled track **+ deterministic search stats**; must equal the pristine
     hash for each spec/seed. This is the end-to-end "behaviour unchanged" proof.
- **Commit rule:** only keep a change whose perf win **holds >2%** (the perf
  noise band is ~0.6% at the default config, so 2% is ~3σ).

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
These are larger, riskier changes than B1–B8 and are deferred pending a careful
design pass.
