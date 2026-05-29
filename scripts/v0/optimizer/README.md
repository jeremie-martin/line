# scripts/v0/optimizer

A new v0 compiler built from first principles, alongside (not replacing)
`scripts/v0/compile.ts`. Each piece has a single clear contract and is
empirically verified before the next is added.

For the goals and acceptance criteria (the WHY), see
`docs/compiler_goals.md`. For the per-step rebuild plan (the HOW), see
the plan file at `~/.claude/plans/graceful-finding-pond.md` and the
per-step writeups in `docs/optimizer/`.

## The four properties (the contract)

1. **Monotonicity-in-budget.** Same `(spec, seed)`, larger budget ⇒
   axis_quality at least as high. **By construction**, via the
   best-so-far envelope.
2. **Wall-clock ↔ budget correlation.** Per-unit-of-budget wall-clock
   stable across specs and seeds (cv < 0.25).
3. **Cheat-resistance.** Budget unit = **simulated rider frames** (charged at
   the trajectory-extraction boundary, measured as `getLastFrameIndex` deltas).
   Can't be inflated without proportional wall-clock cost.
4. **Determinism.** Same `(spec, seed, budget)` ⇒ byte-identical Track
   on any machine.

## Pipeline

```
   sample.ts        (atomic ops: sample one candidate, evaluate it)
        ↓
   solver.ts        (single-gap K-candidate solver, sample-order)
        ↓
   sim_frames.ts    (work-unit counter at the extraction boundary)
        ↓
   lds.ts           (d=0 backtracking base path + guided-repair leaves +
                     limited-discrepancy deviation enumeration, fixed order)
        ↓
   register.ts      (best-so-far with deterministic comparator)
        ↓
   polish.ts        (polish ops as generate-and-test leaves)
        ↓
   api.ts           (compile(spec, {seed, budget}) public surface — standalone,
                     no legacy floor)
```

`greedy.ts` (`compileGreedy_v2`) is a NAIVE rank-0 chainer kept only as a
tests-only reference (the d=0-vs-greedy contrast). The shipping d=0 walk is
`buildBacktrackingLeaf` in `lds.ts`.

The structural answer to "more compute → ≥ quality" is **limited-
discrepancy search over a fixed total-ordered leaf enumeration**:

  - The leaf enumeration `E` is determined by `(spec, seed)`, independent
    of the budget. Discrepancy-0 = the **backtracking base path**
    (`buildBacktrackingLeaf`, the search's own completion floor — replaced the
    legacy compile() floor). Discrepancy-1 leaves deviate at exactly one gap.
    Discrepancy-d at d gaps. (Guided-repair leaves for assembled-track
    misses are interleaved as ordinary leaves; see lds.ts.)
  - The budget only controls how far into `E` we go (a cutoff index).
  - The best-so-far register keeps the strictly-best leaf seen under a
    deterministic comparator.
  - For any `B' > B`, `prefix(B') ⊇ prefix(B)`, so the best over a
    superset never decreases. Property 1 holds by construction.

The work unit is **simulated rider frames**, charged at the trajectory-
extraction boundary. Sim-frames satisfies Property 2 by construction
(lr-core uses spatial-grid collision; per-frame cost is O(local density)).

## What this directory does NOT touch

- `scripts/lib/_lr_engine.ts` — physics engine, reused.
- `scripts/lib/detector.ts` — event detection, reused.
- `scripts/v0/score.ts` — axis_quality formula, reused as the
  single ranking source of truth.
- `scripts/v0/types.ts` — Spec, Gap, DriftReport, CompileStats —
  reused.
- `scripts/v0/compile.ts` — the legacy greedy compiler. No longer invoked by
  the optimizer (the legacy floor seed was removed; `compileLDS` stands alone).
  Reused only for held-constant geometry/detection primitives via `export`
  annotations (sampleArcParams, tryCandidate, residual/detection helpers).

## How to read the per-stage documentation

`docs/optimizer/NN_<stage>.md` files explain each stage's design,
contract, empirical findings, and any surprises. Read in order:

- `00_foundations.md` — types, scorer wrapper, frozen baselines.
- `04_greedy_v2_kSweep.md` — empirical demonstration that greedy
  alone is non-monotonic in K, motivating the rebuild.
- `0b_sim_frames_r1.md` — confirms per-frame cost is stable in line
  count (validates sim_frames as the work unit).
- `01_lds.md` — LDS design, the prefix-superset property, comparator.
- `03a_polish_refactor.md` — scoping for the polish-helpers refactor.
- `04_migration_comparison.md` — quality and runtime comparison
  vs. the legacy `greedy_v1` baseline.
- `05_property3_audit.md` — cheat-resistance audit at cutover.
- `05_iteration_story.md` — concrete example of improved iteration
  discipline enabled by Property 1.

## Frozen baselines

`baselines/greedy_v1.json` holds per-(spec, seed) results from the
existing `compile.ts`. Quality regressions in the new compiler are
detected by comparing against this snapshot. **Do not regenerate**
this file casually — it's the historical anchor.
