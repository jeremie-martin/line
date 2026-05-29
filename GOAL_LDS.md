# Goal — the standalone LDS compiler (current charter)

> Supersedes the preview-era `GOAL.md` (kept for reference). This is the "name of
> the game" for the **rebuilt v0 optimizer** in `scripts/v0/optimizer/`: what we
> optimize for, the invariants it must hold, and what is fair to change. For the
> full treatment of the four properties and their acceptance tests, see
> **`docs/compiler_goals.md`** (this doc references it rather than duplicating it).
> Day-to-day working discipline lives in **`docs/HOW_TO_WORK.md`**.

## What we're optimizing

The compiler turns a `Spec` into a Line Rider `Track` so the simulated rider lands
on the spec's contacts and exhibits its section character (air, speed, grain,
contact_style). The optimization signal is **`goal_score`** over the golden suite
(`specs/golden/`, fixed seeds `[0,1,2]`), at each spec's calibrated **compute
budget**. Engineering acceptance is the separate **`contract_pass_rate`** (fraction
of spec/seed runs meeting every hard-contract invariant). Aim: `contract_pass_rate
→ 1.0` for shippable runs; `goal_score` is the gradient we climb.

Crucially, the rebuild's value is not just the score but the **four properties**
that make the optimizer *debuggable* — these are the real contract
(`docs/compiler_goals.md`):

1. **Monotonicity-in-budget** — for the same `(spec, seed)`, more compute never
   yields worse contract-gated quality. Holds *by construction* (fixed,
   budget-independent leaf enumeration; budget = a prefix of it). This is what lets
   us tell a real improvement from noise.
2. **Wall-clock predictability** — per-budget-unit wall-clock is stable across
   specs/seeds (per-spec cv < 0.25). Wall-clock is a *property*, **not** a score
   term (the preview-era `time_multiplier` is retired).
3. **Cheat-resistance** — the budget unit is **simulated rider frames** (charged at
   the trajectory-extraction boundary as `getLastFrameIndex` deltas). Extra search
   work can't be hidden; it shows up as more frames.
4. **Determinism** — same `(spec, seed, budget)` → byte-identical `Track`.

A change that raises `goal_score` but breaks a property is **not** an improvement.

## The golden suite (13 specs, distinct failure modes)

`drums_signature` (contact_style swap @ high speed), `drums_pendulum` (air flips
±0.70), `drums_crescendo` (all axes grow) — 30 s, vs `beats/drums_0_30s_60_125.json`.
`dense_sprint` (hot-start 0.25 s burst), `syncopated_switchback` (syncopation +
axis reversals), `opening_burst` (immediate high-speed rhythm), `grain_staircase`
(grain as direct arc-size intent), `rhythm_ladder` (uneven phrasing, crossed axes),
`cold_start` (`preroll: 0`, cold initial conditions), `mini_burst` (~7 contacts,
small-spec budget floor), `tiny_dance` (4 contacts, runtime floor anchor), `solo_run`
(~80 contacts, contact-count slope), `verse_chorus` (8 sections, ~30 contacts,
section- vs contact-count). Each spec is weighted equally; seeds equally within it.
No down-weighting by size — the suite is about *coverage of failure modes*.

## Run & score

```
npm run golden                # per-spec + GOAL_SCORE + contract_pass_rate
npm run golden -- --details   # per-row diagnostics
npm run golden -- --json[-full]
npm run golden -- --seed=42
```

Each `(spec, seed)` is compiled at `budgetFor(spec)` **sim-frames**
(`scripts/v0/golden_suite.ts`). Per spec/seed the score is a product of smooth
quality factors in `[0,1]` (`scripts/v0/score.ts`, **no** time term on the LDS path):

```
axis_quality     = exp(-rms(|axis_error|) / AXIS_QUALITY_TOLERANCE)
drift_quality    = exp(-rms(max(0,|frame_error|-1)) over LANDED contacts / SYNC_TOLERANCE)
missing_quality  = exp(-missing_count / MISSING_CONTACT_TOLERANCE)
off_beat_quality = exp(-off_beat_count / OFF_BEAT_TOLERANCE)
survival_quality = 1 if terminus==endOfSpec else terminus.frame / total_frames
spec_seed_score  = 1000 * axis * drift * missing * off_beat * survival
spec_score = shiftedGeometricMean(spec_seed_score over seeds)
goal_score = shiftedGeometricMean(spec_score over specs)
```

Tolerances (`score.ts`): `AXIS_QUALITY_TOLERANCE=0.25`, `SYNC_TOLERANCE=1.0`,
`MISSING_CONTACT_TOLERANCE=1.0`, `OFF_BEAT_TOLERANCE=1.0`. Hard-contract violations
**degrade smoothly** (they don't zero the score) so the optimizer always has
gradient; `contract_pass_rate` (`drift==0 && missing==0 && off_beat==0 &&
terminus==endOfSpec`) reports shippability separately. The shifted-geomean is
**zero/near-zero-sensitive**: a single contract-failing spec drags `goal_score`
hard — so closing the suite gap *requires cracking the failing specs*, not just
polishing the rest.

Monotonicity/acceptance use the **contract-gated** form
(`passed ? axis_quality : 0`); `goal_score` itself is the smooth product above.

## The compiler under optimization (`scripts/v0/optimizer/`)

A **standalone** limited-discrepancy search — **no legacy floor / no fallback**:

- `buildBacktrackingLeaf` (`lds.ts`) — the **d=0 base path**: deterministic
  explicit-stack greedy descent with bounded cross-gap backtracking + skip
  fallback. Its own completion guarantee (replaced the legacy `compile()` floor).
- **Guided-repair leaves** — assembled-track misses/off-beats are repaired by
  forbidding the owning gap's committed candidate and re-running the backtracking
  descent, offered as ordinary deviation leaves (budget-subject, deterministic).
- **Base-rotated deviations** (`enumerateDeviations`) — discrepancy = edit-distance
  from the base path; low-d leaves explore completions *near* a completing track.
- Best-so-far **register** (`register.ts`) — strict-improvement-only under a
  deterministic comparator (contract_passed ≻ axis_quality ≻ on-beat tightness).

`compile.ts` (the preview greedy compiler) is **no longer invoked** — reused only
for held-constant geometry/detection primitives (`sampleArcParams`, `tryCandidate`,
residual/detection helpers) via `export` annotations.

## What you can change

- The optimizer itself: `scripts/v0/optimizer/*` (sampling, ranking, the search,
  the repair, the register comparator).
- **Optimizer knobs** — `CALIB.{K, BACKTRACK_DEPTH, FINAL_VALIDATION_RETRIES}` in
  `types.ts`, the optimizer's own `BASE_BACKTRACK_DEPTH` / `REPAIR_ROUNDS_CAP`, and
  candidate **ranking/targeting**. Adding new optimizer-side constants is fine;
  re-baseline any kept constant.
- **`budgetFor(spec)`** (`golden_suite.ts`) — per-spec compute calibration
  (contact-count / density-based, *generalizing*; never per-spec-name).
- **Most `CALIB.ARC` bounds** — angles + anchor offsets shape *where* the search
  looks; context-conditional derivations (per-section, per-gap, per-rider-state)
  are encouraged. Uniform widening breaks high-speed sections — condition on the
  gap's targets.

## Off-limits

- The **scorer** (`score.ts`, `golden.ts`) and **golden specs** (`specs/golden/*`)
  — only changeable when the goal is deliberately revised (this charter).
- **Semantic / physical constants** — `FPS`, `SPEED_CAP`, `LINE_LENGTH_CAP`,
  `SIGMA`, `CALIB.ARC.{LENGTH,SEGMENTS}_MIN/MAX`, `START_DEFAULT`/`PREROLL` framing.
  If a target is unreachable inside the physical envelope, that's information about
  the optimizer — don't widen the world to score points.

## Optimizer design discipline (see `docs/HOW_TO_WORK.md`)

- **No overfitting**: no spec-name/seed/branch-artifact detection. Every change must
  be explainable from local physical state + authored intent (gap duration, contact
  spacing, sampled targets, rider state, candidate survival, measured error).
  Density/contact-spacing heuristics that generalize are fine.
- **Smooth over thresholds**: continuous influence (interpolation, smoothstep,
  falloff) except at true contract boundaries / finite search budgets.
- **Every heuristic justified**: state the failure mode it addresses, the signal
  that activates it, why the scale, and how it avoids hurting other specs. "It
  improves this golden row" is not a justification.
- **One mechanism per step, measured, committed** — never break what works
  (other specs, the property tests, the four properties) at any step.

## Hard contract

1. **Determinism** — same `Spec`+`seed`(+budget) → byte-identical `Track`. No
   unseeded RNG, no wall-clock inputs.
2. **lr-core in the loop** — every geometric decision validated by `lr-core` +
   `detect`; approximate physics is never the source of truth.
3. **Beat sync is physical sync** — matched beats are detected landings at the
   requested contacts, not report-side accounting.
4. **No off-beat landings** — any landing not aligned with a Contact is a hard fail.
5. **Axis honesty** — measured section axes in `DriftReport` are tied to the
   finished track, not candidate-side intent.

## Open problems (the current frontier — what we have NOT solved)

These are the honest gaps the next work should target (not papered over):

- **Genuinely-hard specs**: `dense_sprint` and `drums_pendulum` fail the contract
  even at large budgets — `dense_sprint`'s miss is a base-path *skip* the repair
  can't recover; `drums_pendulum` a stuck off-beat. They need new *search
  capability* (better candidate generation / look-ahead), not more budget. Because
  of the geomean's zero-sensitivity, these two cap `goal_score` until cracked.
- **`drums_crescendo`'s expensive base floor** — its budget-exempt backtracking
  descent thrashes (~460k sim-frames) and still misses; it's budget-recoverable but
  the floor cost strains the meaningful-budget property. Understand *why* its base
  backtracks so much before leaning on budget to mask it.
- **Candidate-generation quality** — the optimizer samples `gap.targets` directly;
  residual/look-ahead targeting was tried and *refuted* (it traded contact-landing
  for axis-alignment, broke a passing spec). A better-aligned generator that lands
  more contacts *at the floor* (cheaply) remains the highest-leverage open lever.
