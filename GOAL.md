# Goal — satisfy the v0 compiler contract quickly

Maximize `goal_score` over the reference specs in `specs/golden/`, averaged
across fixed seeds `[0, 1, 2]`:

- `drums_signature` — 3-act, `contact_style` swap at constant high speed.
- `drums_pendulum` — 6-act, only `air` flips ±0.70 every 5s.
- `drums_crescendo` — 3-act, all four axes grow monotonically.
- `dense_sprint` — hot-start, high-speed quarter-second beat burst.
- `syncopated_switchback` — hot-start syncopated rhythm with axis reversals.

The three `drums_*` specs are 30 s against
`beats/drums_0_30s_60_125.json`. The newer rhythm specs use explicit Contact
timelines so the suite also covers dense 0.25 s intervals, syncopation,
hot-start sections, and pre-roll-sensitive initial conditions. Together they
exercise axis-isolation contrast, single-axis oscillation, graduated
multi-axis coupling, dense timing, and non-uniform rhythm — distinct failure
modes the compiler must handle.

## Run

```
npm run golden              # human-readable: per-spec + GOAL_SCORE line
npm run golden -- --json    # same data, JSON, for scripted comparisons
npm run golden -- --seed=42 # debug one seed instead of default [0,1,2]
```

Runs all specs sequentially for each fixed seed, with a 45s hard cap per
spec/seed pair (worker-thread enforced; over-budget runs score 0).
Implementation in
`scripts/v0/golden.ts`; scoring shared with `scripts/v0/score.ts`.

## Score

Per spec/seed:

```
hard gates:
  all contacts hit within ±1 frame
  survived through endOfSpec
  off_beat_landings == 0
  elapsed_time <= 45s

sync_score = contacts_hit_within_1_frame / total_contacts
axis_score = clamp(1 - mean_axis_error / 0.25, 0, 1)

spec_seed_score = 0 if any hard gate fails
spec_seed_score = 1000 * sync_score * axis_score otherwise

goal_score = mean(spec_seed_score across all specs and fixed seeds)
```

Runtime is a gate, not an optimization term. A correct run gets no extra
credit for finishing faster than 45 s; an over-budget run is a timeout.

## Preroll

A spec may declare `preroll: N` seconds (capped at 10s; see `PREROLL.MAX_S`
in `types.ts`). Conceptually, this is free territory before the real spec
timeline where the compiler may prepare better initial conditions for
spec-frame 0: position, velocity, direction, contact history, or any other
engine state that makes the authored section easier to satisfy.

The current implementation is a proof of concept: `preroll` does not shift
the timeline or add synthetic beats. Instead, `compile.ts` treats it as
permission to optimize the rider's initial velocity, then compiles the real
spec unchanged. This keeps scoring simple: axis measurements, contact sync,
and off-beat checks apply only to user-declared sections and contacts.

Future pre-roll work should synthesize visible geometry that reaches the
chosen initial condition, ideally without changing the real spec's report
semantics. Treat it as a search affordance, not a fixed prelude.

## What You Can Change

High-leverage areas:

- `scripts/v0/compile.ts`
- `scripts/v0/arc.ts`
- **Optimizer knobs** in `scripts/v0/types.ts`'s `CALIB`: `K` (per-gap
  candidate budget), `BACKTRACK_DEPTH`, `OFF_BEAT_RETRIES` (final-track
  validation retries). Adding new optimizer-side constants is fine.
- **Most `CALIB.ARC` bounds** — angles (`START_ANGLE_MIN/MAX_DEG`,
  `END_ANGLE_MIN/MAX_DEG`) and anchor offsets (`ANCHOR_X_OFFSET_MIN/MAX`,
  `ANCHOR_Y_OFFSET_MIN/MAX`) shape *where* the search looks and are fair
  game. Replacing the static bounds with context-conditional derivations
  (per-section, per-gap, per-rider-state) is encouraged — the open finding
  is that uniform widening breaks high-speed sections, so conditioning on
  the gap's targets is the path forward.

## Optimizer Design Discipline

Do not overfit the compiler to the benchmark suite. Avoid logic that detects
specific specs, whole-spec narratives, seed quirks, branch artifacts, or named
golden scenarios. A compiler change should be explainable from local physical
state and authored intent: current gap duration, nearby Contact spacing,
sampled axis targets, rider state, candidate survival, measured axis error,
or other data that would make sense for unseen specs too.

Prefer smooth scoring and continuous influence over arbitrary threshold gates.
When a signal should matter more in one regime than another, use a simple
continuous shape such as linear interpolation, smoothstep, a Gaussian-like
falloff, or a normalized cost term. Hard thresholds are still appropriate for
true contract boundaries and finite search budgets, for example "must hit the
Contact within ±1 frame", "do not exceed the 45s cap", or "score only the top
N candidates for runtime". They should not be used as unexplained tuning
switches like "if this axis is above X, replace behavior with Y".

Every optimizer heuristic should have an explicit purpose. Before adding one,
state what failure mode it addresses, what physical or authoring signal
activates it, why the chosen scale is reasonable, and how it avoids making
unrelated specs worse. If the best explanation is "it improves this golden
row", the change is not ready.

Do **not** change semantic constants — anything that defines how the world
looks or behaves physically. The goal is to improve the optimizer, not to
change what good tracks look like. If a target is unreachable inside the
current physical envelope, that is information about the optimizer; don't
widen the envelope to score points. Off-limits (non-exhaustive):

- `FPS`, `SPEED_CAP`, `LINE_LENGTH_CAP`, `SIGMA` in `types.ts`
- `CALIB.ARC.LENGTH_MIN/MAX` and `CALIB.ARC.SEGMENTS_MIN/MAX` — these
  determine how each Arc *looks* on screen, not where it can sit
- any `START_DEFAULT`, `PREROLL`-style initial-condition or framing
  constants introduced later

Do not change the scorer (`scripts/v0/score.ts`, `scripts/v0/golden.ts`) or
the golden spec files (`specs/golden/*.ts`) to improve the score. Metric or
suite changes are allowed only when the goal itself is deliberately revised.

## Hard Contract

1. **Determinism**: same `Spec` + same `seed` must produce byte-identical
   `Track`. No unseeded `Math.random()`, no time-based inputs.
2. **lr-core in the loop**: every geometric decision must be validated by
   `lr-core` plus `detect`; approximate physics cannot be the source of truth.
3. **Beat sync is physical sync**: matched beats must be detected landings at
   the requested contacts, not camera edits or report-side accounting.
4. **No off-beat landings**: any landing not aligned with a Contact is a hard
   failure.
5. **Axis honesty**: measured section axes in `DriftReport` must stay tied to
   the finished track, not to candidate-side intent.
