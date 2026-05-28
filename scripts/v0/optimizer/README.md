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
3. **Cheat-resistance.** Budget unit = `engine.addLine` calls. Can't
   be inflated without proportional wall-clock cost.
4. **Determinism.** Same `(spec, seed, budget)` ⇒ byte-identical Track
   on any machine.

## Pipeline

```
   sample.ts      (atomic ops: sample one candidate, evaluate it)
        ↓
   solver.ts      (single-gap K-candidate solver, sorted by cost)
        ↓
   greedy.ts      (multi-gap chainer, per-gap lowest-cost commit)
        ↓
   envelope.ts    (best-so-far across many explorers — load-bearing)
        ↓
   api.ts         (compile(spec, {seed, budget}) public surface)
```

The envelope is the structural answer to "more compute → ≥ quality".
It iterates explorers and never returns worse than the prior best.

## What this directory does NOT touch

- `scripts/lib/_lr_engine.ts` — physics engine, reused.
- `scripts/lib/detector.ts` — event detection, reused.
- `scripts/v0/score.ts` — axis_quality formula, reused as the
  single ranking source of truth.
- `scripts/v0/types.ts` — Spec, Gap, DriftReport, CompileStats —
  reused.
- `scripts/v0/compile.ts` — the legacy greedy compiler, untouched
  except for a small set of `export` annotations so we can wrap its
  atomic primitives (sampleArcParams, tryCandidate).

## How to read the per-step documentation

`docs/optimizer/NN_<step>.md` files explain each step's design,
contract, empirical findings, and any surprises. Read in order:

- `00_foundations.md` — types, scorer wrapper, frozen baselines.
- `04_greedy_v2_kSweep.md` — empirical demonstration of why the
  envelope is needed (greedy alone is non-monotonic in K).
- `06_explorers.md` — which explorers were added, why, and their
  per-(spec, seed) impact.
- `08_migration_comparison.md` — quality and runtime comparison
  vs. the legacy `greedy_v1` baseline.

## Frozen baselines

`baselines/greedy_v1.json` holds per-(spec, seed) results from the
existing `compile.ts`. Quality regressions in the new compiler are
detected by comparing against this snapshot. **Do not regenerate**
this file casually — it's the historical anchor.
