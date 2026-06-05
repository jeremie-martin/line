# Engine optimization log

Chronological record of the effort to make the compiler faster on everything
engine/computation-related, **while keeping behavior bit-identical**. One entry
per change attempt, with its verification result and its measured effect.

## Goal & method

- **Optimize only** `vendor/lr-core` (the vendored JS physics engine). The lever
  is per-frame **allocation count**, not the math.
- **Single metric:** `ns / physics-frame` from `npm run perf` (wall-clock ÷
  physics frames actually simulated; work-normalized, lower is better).
  Default config: `mini_burst` @ 50k budget, 30 timed runs + 3 warmup.
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
