# Compiler Goals and Acceptance Criteria

This is the problem statement for the v0 compiler rebuild: what we want from
the compiler, why it matters, and what evidence is required before we call the
work accepted.

Implementation choices are intentionally kept out of this document. The search
design, work-unit choice, staged migration, and risks live in
`docs/optimizer/v0_anytime_lds.md`. This file defines the contract those
implementation choices must satisfy.

This file is not a status report. A property is not considered satisfied just
because it is described here. Current implementation status, evidence, and
remaining gaps are tracked in `docs/optimizer/v0_anytime_lds.md`.

## Context

Line Rider music-sync is a procedural track-generation project. Given a
structured musical/rhythm description, a `Spec`, the compiler produces a Line
Rider `TrackJson` whose simulated rider motion matches:

- Contact timing: landings at the requested contact frames.
- Section character: the authored section-level axes `air`, `speed`, `grain`,
  and `contact_style`.

The compiler sits between human-authored intent and physical playout. It places
lines, validates them through `lr-core`, runs event detection, and reports the
finished result as a `DriftReport`.

The golden suite is a small fixed set of hand-authored specs that exercises the
distinct failure modes the compiler must handle. Each spec is evaluated across
fixed seeds. Per-row quality, per-spec quality, overall `goal_score`, and hard
contract-pass rate are the evidence used to judge compiler changes.

## The Problem

The current compiler can produce reasonable tracks, but the process of
improving it is unreliable. Three structural issues block confident iteration.

1. **Quality is not predictable from compute spent.** Asking for more work can
   produce a worse track. This is not merely random noise; greedy commitments
   can cascade, so a locally plausible decision can erase a globally better
   earlier result.
2. **There is no external compute dial.** The compiler runs to whatever
   completion point its internal constants imply. A caller cannot ask for "the
   best result within budget B" in a deterministic way.
3. **Optimizer changes are hard to reason about.** When a compiler change
   shifts quality, it is hard to tell whether the change improved the search,
   changed noise, or hid a regression behind stateful search order.

Together, these mean the compiler is difficult to debug scientifically. A
future optimizer change should be evaluated by quality at matched compute, not
by hoping a noisy suite score moved in the right direction.

## Quality Definition

The accepted v0 quality definition is quality-only `scoreDriftReport`:

```text
hard gates:
  all contacts hit within +/- 1 frame
  survived through endOfSpec
  off_beat_landings == 0

axis_loss = mean(abs(axis_error)) / AXIS_QUALITY_TOLERANCE
axis_quality = exp(-axis_loss)

spec_seed_score = 0 if any hard gate fails
spec_seed_score = 1000 * axis_quality otherwise
```

Runtime is not part of quality. Runtime is reported and guarded by worker
timeouts, but it does not multiply or otherwise adjust `goal_score`.

For monotonicity tests, the quality value is **contract-gated axis quality**:

```text
quality = 0             if scoreDriftReport(report).passed is false
quality = axis_quality  otherwise
```

This preserves the hard sync contract while testing the continuous axis-quality
term directly. A track with better style but broken contacts is not a higher
quality answer.

Suite aggregation remains the shifted geometric mean by spec and seed used by
`scripts/v0/golden.ts`. The frozen legacy comparison baseline is
`baselines/greedy_v1.json`, generated under this quality-only scoring policy.

## The Four Properties

The new compiler must satisfy four properties. These are the contract; the
optimizer design is only a means to satisfy them.

### Property 1: Monotonicity in Compute

For the same `(spec, seed)` and budgets `B' > B`, the compiler must return a
track whose contract-gated quality at `B'` is at least as high as at `B`.

Strict improvement is not required. More compute may simply confirm the current
best answer. Regression is not allowed.

Why this matters: once monotonicity holds, any quality drop after a code change
is attributable to the code change, not to search noise from spending more
compute differently.

### Property 2: Wall-Clock Predictability

For each unit of compute budget spent, wall-clock cost should be approximately
constant across representative specs and seeds. The target coefficient of
variation for `wall_ms / work_units` is `< 0.25` on a stable measurement
machine.

Why this matters: the budget unit must be a meaningful currency. If one unit
takes 10 ms on one spec and 200 ms on another, user-facing compile budgets are
not predictable.

### Property 3: Cheat-Resistance

The budget unit must correspond to an externally observable engine operation
that the compiler cannot inflate. A future optimizer change that performs more
physical validation work must pay proportional work units and wall-clock cost.

Why this matters: the quality-vs-compute curve must stay honest as the
optimizer evolves. A change should not be able to hide more inner work behind
the same reported budget.

### Property 4: Determinism

The same `(spec, seed, budget)` must produce hash-identical `TrackJson` output
across repeated runs. The compiler must not use wall-clock time, unseeded
randomness, machine load, filesystem ordering, or any other nondeterministic
input in the search.

Why this matters: reproducibility is required for debugging, CI, baseline
comparisons, and monotonicity verification.

## Held Constant

The rebuild deliberately holds these surfaces constant:

- `lr-core` physics behavior.
- Event detection behavior.
- `Spec` format.
- `DriftReport` format.
- `TrackJson` output shape.
- Axis set: `air`, `speed`, `grain`, `contact_style`.
- Axis measurement and normalization.
- Hard contract gates: contacts within +/- 1 frame, no off-beat landings,
  survival to end-of-spec.
- Golden spec contents.
- Quality-only `scoreDriftReport` semantics as defined above.

The rebuild is only of the search/optimization process that maps
`Spec -> TrackJson`. If any held-constant surface changes, the frozen baseline
must be regenerated deliberately and the acceptance evidence must be treated as
a new comparison.

## Out of Scope

The rebuild does not aim to:

- Replace or modify the physics engine.
- Replace or modify event detection.
- Add new axes or change axis semantics.
- Add new contact semantics.
- Add new spec features.
- Change golden specs to improve scores.
- Change the quality formula to make the rebuild look better.
- Optimize for a specific absolute score such as 800+.
- Make the compiler faster at matched quality, except where required for the
  budget predictability property.

Speedups and quality improvements are welcome, but the migration bar is
property satisfaction and no meaningful regression versus the frozen legacy
baseline.

## Acceptance Criteria

Acceptance requires runnable evidence. Documentation, intuition, and local
spot-checks are not enough.

### Property 1: Monotonicity

Representative gate:

- Run at least three representative specs.
- Run at least three fixed seeds.
- Run at least three budget levels.
- Assert contract-gated quality is non-decreasing as budget increases.
- Use numerical tolerance below 1%.

The current acceptance runner uses:

```text
representative specs:
  drums_signature
  dense_sprint
  syncopated_switchback
  grain_staircase

representative seeds:
  [0, 1, 2]

representative budget factors:
  [0.35, 0.7, 1.0] * budgetFor(spec)
```

Full acceptance sweep:

```text
golden suite x seeds [0,1,2,3,4] x budget factors [0.25,0.5,1.0,1.5]
```

Every `(spec, seed)` row must be non-decreasing in contract-gated quality. Any
violation blocks acceptance until it is understood and fixed.

The acceptance runner also checks leaf-fingerprint prefix stability where the
compiler reports leaf fingerprints. This is a structural guard for the
best-over-prefix invariant behind monotonicity.

At or above the first-complete-leaf floor, the new compiler must report
non-empty scored-leaf fingerprints. Empty fingerprint logs are acceptable only
for smoke tests that do not claim structural acceptance evidence.

### Property 2: Wall-Clock Predictability

Representative and full sweeps report:

```text
wall_ms_per_work_unit = elapsed_ms / work_units_used
cv = stddev(wall_ms_per_work_unit) / mean(wall_ms_per_work_unit)
```

Acceptance target:

```text
cv < 0.25
```

This should be judged on a stable single machine. The check is about relative
consistency, not absolute speed. A developer laptop may produce noisy numbers;
the final acceptance number should be recorded with the machine and command
used.

### Property 3: Cheat-Resistance

Acceptance requires a written design audit confirming:

- Where `work_units_used` increments.
- Which engine operation the budget unit corresponds to.
- That all physical candidate validation flows through the metered operation.
- That future compiler work cannot improve physical search without paying
  proportional work units.
- That diagnostic counters such as line additions and sampled candidates do
  not replace the work budget.

This audit is one-time evidence for the structural unit choice. It is not a
recurring CI test.

### Property 4: Determinism

Representative gate:

- For representative specs and seeds, call the new compiler twice with the
  same `(spec, seed, budget)`.
- Hash canonical `TrackJson` output.
- Assert hashes are identical.

The acceptance runner performs this for default-budget LDS unless explicitly
skipped for a smoke run.

### Baseline Parity

Before legacy removal, default-budget LDS must satisfy both:

- `goal_score >= 0.95 * baselines/greedy_v1.json.goal_score`
- For every golden spec, LDS contract-pass count is at least the frozen legacy
  pass count for that spec.

The baseline is quality-only legacy, not runtime-adjusted legacy. If a held
constant surface changes, regenerate the baseline in a separate commit with the
command and reason recorded.

### Iteration-Story Evidence

By the time the rebuild ships, the project should be able to point to at least
one compiler change made during the rebuild and classify it empirically as an
improvement, regression, or no-op at matched compute.

This is the practical payoff of monotonicity. Before this rebuild, the project
could often observe that scores changed but could not reliably say why.

## Commands

Representative acceptance:

```bash
npm run accept:v0
```

Full acceptance sweep:

```bash
npm run accept:v0 -- --full
```

Golden comparison:

```bash
npm run golden -- --json --runtime-scale=3
npm run golden -- --json --runtime-scale=3 --lds
```

Focused supporting sweeps:

```bash
npm run sweep:v0:anytime -- --json
npm run sweep:v0:work -- --strategy=lds --json
npm run study:v0:budget -- --scope=full --concurrency=4
```

Smoke runs may use `--specs`, `--seeds`, `--factors`, and skip flags, but smoke
runs are not acceptance evidence.

Legacy removal requires all acceptance criteria above to be green and recorded.
Until then, legacy remains available as the compatibility fallback and frozen
comparison target.

## Why This Matters Beyond the Rebuild

Once these properties hold:

- Future optimizer changes can be evaluated at matched compute.
- A user-facing compile-budget knob becomes meaningful.
- CI can guard against silent quality regressions.
- Baselines can be compared scientifically.
- Production-style bounded compile workflows become plausible.

The goal is not only a better compiler. The goal is a compiler that can be
improved methodically.
