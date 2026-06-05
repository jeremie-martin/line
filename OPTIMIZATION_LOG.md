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
  Holds above the 2% bar → **kept** (commit pending).
