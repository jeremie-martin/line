# Compiler goals and acceptance criteria

A problem-statement document. What we want from the v0 compiler, why
it matters, and the empirical evidence we'll require to know we've
achieved it. **Implementation choices are deliberately not discussed
here** — those live in the per-step rebuild plan and the per-step
docs under `docs/optimizer/`.

## Context

Line Rider music-sync is a procedural track-generation project: given
a structured musical/rhythm description (a `Spec`), produce a Line
Rider track in which the rider's geometry-driven motion matches the
spec's contact timing and section-level character (air, speed, grain,
contact_style).

The compiler is the function that turns a `Spec` into a `Track`. It
sits between the human-authored intent (the Spec) and the physical
playout (the lr-core engine that simulates a rider over a set of
lines). The compiler decides where each line goes so that the
simulated rider lands on the specified contact frames and exhibits
the specified section character.

A small fixed suite of golden specs ("the golden suite") exercises
the distinct failure modes the compiler must handle. Each spec is
evaluated across multiple fixed seeds. Per-spec quality and overall
suite quality are reported as a single number `goal_score`, plus a
hard contract-pass rate.

## The problem we're solving

The compiler today produces tracks of reasonable quality on most
golden specs, but the **process of iterating on it is unreliable**.
Three structural issues block confident improvement:

1. **Quality is not predictable from compute spent.** Today, asking
   the compiler to do "more work" (e.g. by enlarging its candidate
   budget) sometimes produces a *worse* track. This is not a small
   regression — empirically, doubling the compute can halve quality
   on individual specs. The cause is structural, not noise.

2. **There is no way to dial how much compute to spend.** The
   compiler runs to whatever natural-completion-point its internal
   constants dictate. We can't say "give me your best for budget B"
   from outside.

3. **Optimizer changes are hard to reason about.** When a code
   change to the compiler shifts quality on some spec, we cannot
   easily tell whether the change was a true improvement, a noise
   fluctuation, or a regression hidden by cascading state. Every
   change is a bet, and there is no contract the compiler is
   measured against beyond "the suite score didn't drop too much".

Together these block iteration. A compiler we cannot reason about is
a compiler we cannot improve.

## What we want — the four properties

The new compiler must satisfy four properties. These are the
contract; everything else is a means to them.

### Property 1 — Monotonicity in compute

For the same `(spec, seed)` and any two compute budgets `B' > B`, the
compiler returns a track with quality (axis_quality) at least as high
at `B'` as at `B`. **No regression in quality when given more
compute, ever.**

Why this matters: this is the property that lets us reason about the
compiler. With it, any quality drop after a code change is
*necessarily* a code-change problem, not a search-noise problem. The
chess-engine analogy applies: more search depth never returns a
worse move, and that's why chess engines are debuggable.

### Property 2 — Wall-clock predictability

For each unit of compute budget spent, the wall-clock cost is
approximately constant across specs and seeds. The variation
(coefficient of variation, across the golden suite) is bounded
(target: cv < 0.25).

Why this matters: the budget unit needs to be a meaningful currency.
If "one unit" takes 10ms on one spec and 200ms on another, the
user-facing budget knob has unpredictable real-time consequences.

### Property 3 — Cheat-resistance

The budget unit corresponds to an atomic, externally-observable
operation that cannot be inflated by future compiler changes. A
future change that "does more inner work per unit" must show up as
proportionally more wall-clock — not as a budget unit that quietly
costs twice as much.

Why this matters: this is anti-Goodhart's-law. Without it, the
quality-vs-compute curve we publish could silently degrade as the
optimizer's per-unit-work grows. With it, the curve stays honest.

### Property 4 — Determinism

The same `(spec, seed, budget)` produces a byte-identical `Track` on
any machine, any OS, any load. This is the C1 hard contract from the
project's overall design and pre-dates this rework; the new compiler
must continue to honor it.

Why this matters: reproducibility for debugging, CI sanity, and the
scientific premise that the optimizer is a function of its inputs.
Determinism is also a prerequisite for Property 1's verifiability —
you cannot rigorously test monotonicity on a non-deterministic
system.

## Out of scope

The rebuild deliberately does not change:

- The lr-core physics engine.
- The event detector that finds landings, bounces, etc.
- The `Spec` and `DriftReport` data formats.
- The scoring formula that turns a `DriftReport` into a quality
  number (i.e. the definition of "good track" stays the same — we're
  changing how we *get to* a good track, not what counts as good).
- The list of axes (air, speed, grain, contact_style), their
  measurement, or their normalization.
- The hard contract on contacts (±1 frame), off-beat landings (must
  be zero), and survival to end-of-spec.
- The golden suite specs (their list may grow over time, but the
  spec format and the per-spec scoring stay the same).

The rebuild is **only** of the search/optimization process that maps
Spec → Track. Everything around it is held constant so the rebuild
can be empirically compared to the prior compiler.

## Acceptance criteria (how we know we've achieved the goals)

Each property is paired with a concrete empirical test. The tests
are not "we wrote a doc" or "we believe it works" — they are tests
that run, produce numbers, and either pass or fail.

### Acceptance for Property 1 (monotonicity)

A property-based test running in CI on every commit:

> For at least three representative specs, across at least three
> fixed seeds, across at least three budget levels (low, mid, high):
> `quality(spec, seed, B_high) ≥ quality(spec, seed, B_mid) ≥
> quality(spec, seed, B_low)`. Strict inequality is not required
> (sometimes more compute simply confirms the existing best); the
> requirement is non-decreasing, with a numerical tolerance under 1%.

Additionally, a one-off comprehensive sweep at acceptance time:

> Across the full golden suite × 5 seeds × the full budget range
> (e.g. {low, mid, high, max}), every (spec, seed) row's quality is
> non-decreasing in budget. Any violation halts acceptance until
> understood.

### Acceptance for Property 2 (wall-clock predictability)

A measurement test running in CI on a representative subset:

> Across the golden suite × multiple seeds × multiple budget levels,
> the per-budget-unit wall-clock cost (`wall_ms / work_units`) has a
> coefficient of variation under 0.25 (i.e., the slowest per-unit
> cost is at most ~50% higher than the fastest).

This may need to be measured on a stable single machine; the
acceptance check is not on absolute wall-clock numbers but on their
consistency.

### Acceptance for Property 3 (cheat-resistance)

A design audit at acceptance time:

> The budget unit corresponds to a discrete operation exposed by the
> physics engine (a primitive we don't control). Inflating the
> "work" the compiler does per budget unit would require either
> changing the engine (out of scope) or doing more inflation-only
> operations that themselves cost wall-clock proportionally.

This is a one-time review, not a recurring CI test. The structural
choice of unit is what enforces it.

### Acceptance for Property 4 (determinism)

A property-based test running in CI on every commit:

> For at least three representative specs, across at least three
> fixed seeds, the compiler called twice with identical inputs
> produces hash-identical Track objects. Already in place as
> `tests/v0_determinism.test.ts` for the legacy compiler; mirrored
> for the new one as it ships.

### Acceptance for "the new compiler is at least as good as the old one"

A frozen baseline comparison, asserted at the final migration step:

> The new compiler at its default budget produces a `goal_score`
> within 5% of the existing compiler's frozen baseline
> (`baselines/greedy_v1.json`), AND achieves equal-or-better
> contract-pass rate on every spec.

If quality at matched compute is *higher*, that's a bonus. The
acceptance bar is "no meaningful regression". Tightening it later
(e.g. requiring a strict improvement) is a separate decision.

### Acceptance for "the iteration story is improved"

A qualitative check, observed across the rebuild itself:

> By the time the rebuild ships, we should be able to point to at
> least one concrete change to the compiler that we made *during*
> the rebuild where we could tell — empirically, with evidence —
> whether it was an improvement, a regression, or a no-op. This was
> not possible before; this is the practical payoff of Property 1.

## Why this matters beyond the rebuild

The four properties are useful in their own right (better compiler,
real compute dial, predictable runtime, reproducible output). But
the real point is the *iteration discipline* they enable. Once these
properties hold by construction:

- A future optimizer change can be evaluated for "does it improve
  quality at matched compute" with confidence.
- A user-facing compile-budget knob becomes meaningful — pick the
  quality-vs-runtime tradeoff that fits the use case.
- CI can guard against silent quality regressions caused by
  unrelated code changes (e.g. detector tweaks, engine version
  bumps).
- The project can support production-style workflows (interactive
  authoring with bounded compile time) without ad-hoc workarounds.

These compound benefits are why this is worth doing carefully rather
than patching the existing compiler further.

## Non-goals (explicit)

The rebuild does **not** aim to:

- Make the compiler faster at matched quality (speedups are
  welcome, not required).
- Add new axes, new contact semantics, new spec features.
- Replace the physics engine, the detector, or the spec format.
- Eliminate the need for the golden suite (the suite is the
  evidence; we want it to grow over time, not shrink).
- Achieve specific absolute quality numbers (the bar is "match the
  baseline within 5%", not "score 800+").

If during the work it becomes clear that one of the four properties
cannot be reasonably satisfied, that finding itself is a deliverable
— surfacing the impossibility is better than papering over it.
