# Goal - low-budget standalone LDS compiler (operating charter)

> **This is an operating contract for an autonomous optimization agent - you.**
> You will be run in a loop: change the compiler, measure, keep or revert, repeat,
> until the stop condition holds. This document is the context you need to
> interpret the harness correctly for the low-budget LDS campaign.
>
> This file is intentionally close to `GOAL_LDS.md`. The core mission is still the
> same: improve the standalone LDS optimizer, preserve the four compiler
> properties from `docs/compiler_goals.md`, and produce the best tracks possible
> without moving the scorer or specs. The difference is the active diagnosis:
> current hard failures are not several unrelated hard specs. They are all
> budget-starved by the d=0 floor, so repair and discrepancy search never get to
> run. This campaign exists to fix that system problem.
>
> Deeper background lives in `docs/compiler_goals.md`; day-to-day working
> discipline in `docs/HOW_TO_WORK.md`.

---

## 0. The job, in one screen

- **What you change:** the compiler in `scripts/v0/optimizer/*` and optimizer-side
  primitives it already owns: search, sampling, ranking, repair, register behavior,
  diagnostics, and optimizer-side constants.
- **What you optimize:** full-suite quality and `contract_pass_rate` under a fixed
  low sim-frame budget, with special attention to whether the floor leaves budget
  for repair and `d>=1` deviation search.
- **Primary command for this campaign:**

```
npm run golden -- --jobs=4 --budget=40000
```

  This is deliberately **not** the canonical project `goal_score` run. The harness
  will label it non-canonical because `--budget` is explicit. Treat it as the
  low-budget campaign run of record.
- **Design pressure:** the optimizer should work decently, and improve over time,
  at `--budget=20000`; it should then improve or hold as budget rises to
  `--budget=40000`, `--budget=60000`, and the default calibrated budgets.
- **The active root cause:** every current failing row that has been probed is
  budget-starved by the floor. The budget-exempt d=0 descent consumes at least the
  entire row budget on its own, so `getSimFrames() >= budget` before repair starts.
  The result is `leaves_considered=1`, `repair_rounds=0`, and no `d>=1` sweep.
- **The coupled levers:** make the floor cheaper and make hard-gap candidates
  better. Better candidates land more contacts at the floor and reduce
  backtracking, so they attack both quality and floor cost.
- **The trap:** do not solve this by raising budgets until floor + repair fits. That
  masks the broken compute story. The point is to make a small budget meaningful.
- **The one hard rule:** determinism - same `(spec, seed, budget)` must produce a
  byte-identical `Track` for a given compiler build. Break it and no measurement is
  trustworthy.

---

## 1. What we optimize

The compiler turns a `Spec` into a Line Rider `Track` so the simulated rider lands on
the spec's contacts and exhibits the authored section character: air, speed, grain,
and contact_style.

For this low-budget campaign, the run of record is the full golden suite across
seeds `[0,1,2]` with an explicit fixed budget:

```
npm run golden -- --jobs=4 --budget=40000
```

Read the score using the same per-row and per-spec breakdown as `GOAL_LDS.md`, but
do not call this the canonical `GOAL_SCORE`. It is an indicative run in harness
terms and the campaign metric in this charter.

Two outcomes matter together:

- **Contract progress:** `drift==0 && missing==0 && off_beat==0 &&
  terminus==endOfSpec`. `contract_pass_rate` is still the shippability gate.
- **Quality progress:** among contract-passing outputs, higher axis/contact quality
  matters. The goal is not merely technically valid tracks; it is the best tracks
  the optimizer can find under honest bounded compute.

Per `(spec, seed)`, the scorer is unchanged (`scripts/v0/score.ts`):

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

The important metric behavior from `GOAL_LDS.md` still applies: the product and
shifted-geomean are zero-sensitive. One hard-failing row can bury the headline.
Therefore the useful gradient is in the breakdown: per-spec rows, per-seed rows,
`hits/contacts`, `missing`, `off_beat`, `survival_quality`, axis losses, worst
contacts, and `compile_stats`.

For this campaign, always read these structural fields too:

- `sim_frames` versus the explicit budget.
- `leaves_considered`.
- `repair_rounds`.
- `gap_commits` / skip ownership where available.
- backtracking counts or any local diagnostic added to explain floor cost.
- candidate-cache hits/misses if candidate generation is part of the change.

A row with `leaves_considered=1`, `repair_rounds=0`, and `sim_frames >= budget` is
not evidence that repair failed. It is evidence that repair never got budget.

---

## 2. The harness is your instrument

`scripts/v0/golden.ts` (`npm run golden`) is how you see. Treat it as an
instrument, not as a yes/no judge. It reports the breakdown needed to reason about
which part of the optimizer moved.

### Campaign vs. canonical

The canonical project score is still:

```
npm run golden
```

That run uses the suite's calibrated default budgets and is the official
`GOAL_SCORE` described by `GOAL_LDS.md`.

This campaign intentionally uses an explicit fixed budget:

```
npm run golden -- --jobs=4 --budget=40000
```

Because it has `--budget`, the harness correctly labels it non-canonical. That is
expected. Do not fight the label or edit the harness to rename it. In this charter,
the fixed-budget full-suite run is the operating signal because the failure being
attacked is that low budgets are currently consumed by the floor before the anytime
search begins.

### Commands

```
npm run golden -- --jobs=4 --budget=40000
  # Campaign run of record: full suite, seeds [0,1,2], fixed low budget.

npm run golden -- --jobs=4 --budget=20000
  # Stress run: forces the floor to become cheap and good.

npm run golden -- --jobs=4 --budget=60000
  # Curve check: more budget should help or hold, not expose budget-specific hacks.

npm run golden -- --jobs=4 --specs=drums_pendulum,drums_crescendo,solo_run --budget=40000 --details
  # Targeted current frontier.

npm run golden -- --jobs=4 --specs=solo_run --seed=1 --budget=20000 --details
  # Target one known starved row.

npm run golden -- --fast
  # Cheap smoke probe. Useful, but it does not cover the hard floor-starved rows.

npm run golden -- --variants
  # Generalization probe. Use before declaring victory.

npx vitest run tests/optimizer_*.test.ts
  # Property tests for determinism and anytime behavior.
```

Use `--json`, `--details`, or `--json-full` when you need machine-readable
diagnostics. The current floor problem is structural, so the important output is
often in `compile_stats`, not just score.

### How to read the report

Each row reports sync, axis quality, hard failures, and compile stats. For this
campaign, read every failing row in this order:

1. Did the floor alone consume the budget?
2. Did repair run (`repair_rounds > 0`)?
3. Did the deviation sweep run (`leaves_considered > 1`)?
4. If not, why did the floor cost so much: repeated backtracking, bad candidates,
   skipped contacts, or long hard gaps?
5. If repair did run, did it forbid the owning candidate and find a better path?

The desired shape is not "bigger budget hides the floor." The desired shape is:
the floor lands more contacts, costs fewer sim-frames, and leaves budget for
budget-subject repair/deviation leaves.

---

## 3. The four properties (the real contract)

The low-budget campaign does not replace the compiler goals. A change that improves
the 40k campaign run while breaking a compiler property is not an improvement.

1. **Determinism - the one hard rule.** Same `(spec, seed, budget)` must produce a
   byte-identical `Track` for a given build of the compiler. No unseeded RNG, no
   wall-clock inputs, no thread-order dependence.
2. **Monotonicity-in-budget.** For the same `(spec, seed)`, more compute must not
   produce a worse contract-gated result under the fixed comparator. The leaf
   sequence must remain a deterministic prefix-superset as budget grows.
3. **Cheat-resistance.** The budget unit is simulated rider frames charged at the
   trajectory-extraction boundary. Extra physical validation cannot be hidden.
4. **Wall-clock predictability.** Per-budget-unit wall-clock should stay stable
   enough that the budget remains a meaningful user-facing knob.

This campaign adds one practical interpretation:

5. **Low-budget meaningfulness.** The d=0 floor may be a completion floor, but it
   must not routinely consume the whole useful budget on hard rows. A compiler that
   needs hundreds of thousands of floor frames before any anytime search can run has
   not made the budget knob meaningful, even if monotonicity formally holds.

Run the optimizer property tests after any change to search/enumeration, candidate
ordering, repair, budget checks, or register comparison:

```
npx vitest run tests/optimizer_*.test.ts
```

Treat a red determinism or monotonicity test as a hard stop.

---

## 4. The loop and when to stop

1. **One mechanism per step.** Make a single explainable change. Do not bundle a
   candidate generator change, repair policy change, and budget calibration change
   unless the codebase forces them to be inseparable.
2. **Probe the failing rows first.** Use targeted `--specs/--seed/--budget` runs on
   the floor-starved rows before spending the full campaign run.
3. **Read structure before score.** For the current root cause, the primary question
   is whether floor cost dropped and whether repair/deviation search got to run.
4. **Keep or revert by judgment.** Keep a change if it improves the root cause or is
   a clear net-positive trade. Revert if it only shifts score noise or hides the
   issue behind more compute.
5. **Check the low-budget curve.** A good change should usually help at 20k/40k and
   hold or improve at 60k/default. If it helps 40k but hurts 60k or the canonical
   default, understand why before keeping it.
6. **Confirm before committing.** Run the 40k campaign command, the property tests,
   and a higher-budget or canonical sanity check. Use `--variants` before declaring
   a candidate-generation change robust.

Stop when these hold:

- The 40k campaign run has `contract_pass_rate == 1.0`.
- The 20k stress run is meaningfully usable: no current hard row is merely
  `leaves_considered=1` / `repair_rounds=0` because the floor consumed the budget.
- The 60k/default runs improve or hold relative to 40k as expected from the
  anytime contract.
- Property tests are green.
- The quality breakdown has plateaued after several accepted iterations.

Short of that, the highest-leverage work is whatever the breakdown says is still
floor-starved or candidate-starved.

---

## 5. What you may change / what's off-limits

**You may change**:

- `scripts/v0/optimizer/*`: search, sampling, ranking, repair, register behavior,
  enumeration order, telemetry, and optimizer-local helpers.
- Optimizer knobs such as `BASE_BACKTRACK_DEPTH`, `REPAIR_ROUNDS_CAP`,
  `CALIB.{K, BACKTRACK_DEPTH}` in `types.ts`, and candidate ranking/targeting.
- Optimizer-side constants when they are re-baselined and justified by a general
  failure mode.
- `budgetFor(spec)` in `golden_suite.ts` only as a general compute calibration
  mechanism, never as a per-spec-name workaround. For this campaign, do not use
  `budgetFor` to hide that `--budget=40000` or `--budget=20000` is failing.
- Most `CALIB.ARC` bounds when the change is physically motivated and
  context-conditional. Uniform widening is suspect; hard rows often need better
  targeting, not a bigger world.
- Diagnostics that expose floor cost, backtracking causes, skip ownership, or
  candidate quality, provided they do not affect determinism or scoring.

**Off-limits**:

- The scorer (`scripts/v0/score.ts`, golden scoring aggregation) and golden specs
  (`specs/golden/*`). These define the objective. Editing them is a charter
  revision, not optimizer work.
- Semantic / physical constants such as `FPS`, `SPEED_CAP`, `LINE_LENGTH_CAP`,
  `SIGMA`, `CALIB.ARC.{LENGTH,SEGMENTS}_MIN/MAX`, `START_DEFAULT`, and `PREROLL`.
- Spec-name or seed-specific behavior.
- Any change that makes the campaign command look better by weakening the contract,
  suppressing diagnostics, or moving work outside the sim-frame budget.

---

## 6. Design discipline

- **Do not overfit.** Every mechanism must be explainable from local physical state
  and authored intent: gap duration, contact spacing, sampled targets, rider state,
  candidate survival, measured error, skip ownership, and backtracking pressure.
- **Do not optimize only the counter.** Reducing `sim_frames` is useful only if the
  floor remains physically honest and quality improves or holds. A cheap bad floor
  is not success.
- **Do not lean on budget.** If a row needs 220k or 457k floor frames before repair
  can start, raising the budget is masking the issue this campaign is meant to fix.
- **Prefer better candidates over more blind search.** Better hard-gap candidates
  simultaneously reduce misses and reduce backtracking. They are the cleanest lever
  when candidate quality is the reason the floor thrashes.
- **Every heuristic needs a reason.** State the failure mode it addresses, the
  signal that activates it, the scale, and why it should generalize beyond one
  golden row.
- **Smooth over thresholds.** Prefer continuous influence except at true contract
  boundaries or finite search-budget boundaries.
- **Simplicity matters.** A smaller general mechanism that makes the budget curve
  more honest can be better than a larger mechanism that wins one row.

---

## 7. The compiler today (`scripts/v0/optimizer/`)

The current compiler is a standalone limited-discrepancy search:

- `buildBacktrackingLeaf` (`lds.ts`) is the d=0 base path: a deterministic
  explicit-stack greedy descent with bounded cross-gap backtracking and a
  skip-march fallback. It is the completion floor.
- Guided-repair leaves run after the assembled track misses or lands off-beat.
  They forbid the owning gap's committed candidate and re-run the backtracking
  descent. These leaves are budget-subject.
- Base-rotated deviations (`enumerateDeviations`) explore paths near the base path
  by increasing discrepancy. These are also budget-subject.
- The best-so-far register (`register.ts`) is the single source of truth for leaf
  selection under a deterministic comparator.

The crucial current weakness is that the d=0 floor is budget-exempt enough to
complete but expensive enough to starve everything after it. When the floor crosses
the budget alone, repair and `d>=1` search are not being evaluated. This explains
why repair-phase ideas can look inert even when they are directionally right.

Hard contract reminders:

1. Determinism is mandatory.
2. lr-core remains in the loop for physical validation.
3. Beat sync means detected physical contacts at the requested frames.
4. Off-beat landings are hard failures.
5. Axis measurements come from the finished track, not candidate-side intent.

---

## 8. Open problems (current frontier)

The current verified frontier is the floor-starvation problem.

Probed current failures:

- `drums_pendulum` seed 0.
- `drums_crescendo` all seeds.
- `solo_run` seed 1.

In every probed failing row, the budget-exempt base floor consumes at least the
entire per-spec budget on its own. Examples from the current diagnosis:

- `solo_run` seed 1: floor used about 220k sim-frames and 46 backtracks against a
  200k budget.
- `drums_crescendo` seed 0: floor used about 457k sim-frames.

The observed signature is:

```
getSimFrames() >= budget before repair
leaves_considered = 1
repair_rounds = 0
no d>=1 deviation sweep
```

Consequences:

- `solo_run` seed 1 misses are skip-owned and would be the kind of case repaired by
  forbid-skip / repair ownership work, but the repair phase never runs.
- `drums_pendulum` can land off-beat or drift because candidate quality is poor at
  hard gaps and the floor has already spent the budget by the time alternatives
  should be explored.
- `drums_crescendo` is not merely "needs more budget"; its floor backtracks so much
  that the anytime search is effectively disabled.
- Previous mechanisms such as base-relative discrepancy and forbid-skip repair can
  appear inert because they live after the floor. They cannot help a row where the
  floor alone exhausts the budget.

The work should therefore focus on two coupled levers:

1. **Cheaper floor.** Reduce unnecessary backtracking, avoid repeated doomed choices,
   expose why the floor thrashes, and make the base descent reach a reasonable
   completion within low budgets. A split-floor or deferred-floor architecture may
   be useful later, but first understand the actual backtracking cause.
2. **Better hard-gap candidates.** Improve candidate generation/ranking/targeting so
   hard contacts are landable earlier in the candidate order. This improves floor
   quality and lowers floor cost at the same time.

Do not treat the current failures as separate hard specs until this root cause is
removed. Once repair and `d>=1` search actually run under 20k/40k, the remaining
misses/off-beats can be diagnosed on their own merits.

