# Anytime compute-budget design proposal

Investigation output for the question: "Can the v0 compiler take a compute
budget as input, deliver its best track within that budget, and replace
the current `time_multiplier` runtime penalty?"

This document is the **design proposal** that the implementation plan
will act on. Decision gate: review with user before any code change to
`compile.ts`.

## TL;DR

- **Yes, it's worth doing**, but the data exposes one structural problem
  in the current optimizer that needs addressing before "iteration count"
  can be a clean budget unit.
- **Recommended iteration unit:** `engine_addLine` calls (the atomic
  lr-core physics primitive). It's the most cheat-resistant of the
  available units. `candidates_sampled` is more granular but gameable —
  the K-sweep proved the cheat-vector is already active.
- **Recommended API:** `compile(spec, seed, { budget?: Budget })` where
  `Budget` is `{ work: number }` (iteration units) primarily, with
  `{ wall_ms: number }` as a documented secondary mode.
- **Determinism:** preserved for `work` budgets. Best-effort for `wall_ms`.
- **Migration:** golden suite switches from `time_multiplier` to
  budget-as-input. Score becomes pure quality. `contract_pass_rate` and
  `goal_score` become "what quality did you achieve at this budget?"

## Evidence base

5-seed, 13-spec instrumented sweep + 3-seed × 5-K-level quality sweep
(195 compiles total). Data files: `/tmp/phaseB.csv`, `/tmp/ksweep/*.json`.

### Per-iteration cost is reasonably stable
- Overall mean: **12.21 ms per candidate sample**, std 3.29 (cv 0.27).
- 11 of 13 specs cluster 9-12 ms/sample.
- Outliers: `cold_start` (20.7 ms — preroll=0 makes early candidates
  expensive), `drums_crescendo` (16.3 ms — crescendo dynamics).

### Candidate count explains most wall-clock variance
- Per-spec `cands ↔ elapsed` correlation: 0.83 – 0.99.
- Switching from elapsed-as-budget to candidates-as-budget reduces
  cross-seed variance by 26.5%.

### K saturation analysis (the load-bearing finding)
| K | goal_score | contract pass | total_cands | total_elapsed |
|---|---|---|---|---|
| 8 | 18 | 14/39 (36%) | 35k | 749s |
| 16 | 346 | 37/39 (95%) | 62k | 700s |
| 32 | 476 | 39/39 (100%) | 60k | 703s |
| 48 (current default) | 479 | 39/39 | 63k | 675s |
| 96 | **336** | 39/39 | 72k | 774s |

- **K=16 saturates quality for 11 of 13 specs.** K=48 is over-provisioned.
- **K=96 produces WORSE goal_score than K=48** (336 vs 479).
- Under `score_without_time` (pure quality, no runtime penalty), one
  spec degrades at K=96: `dense_sprint` 513 → 396. The runtime penalty
  amplifies this further on `opening_burst` (515 → 121 with penalty).

### The structural problem: sampling is not i.i.d. in `attempt`
`sampleArcParams(rng, refX, refY, gap.targets, targetState, attempt, gap)`
in `compile.ts:2971` takes the `attempt` number. So the candidate
*sequence* changes when K changes — K=96 explores a different parameter
subspace than K=48 from the *same* RNG state, and apparently lands on a
worse "best" candidate for some specs.

**Implication for anytime budgets:** as long as `attempt` shapes
sampling, "give the compiler more iterations" is not guaranteed to
produce a strictly-better-or-equal result. A clean anytime contract
requires: *for any budget B and B' > B, the result at B' must be at
least as good as the result at B.* Today's optimizer violates this.

This needs a fix before any production anytime API ships. The fix is
local: make `sampleArcParams` truly i.i.d. given `(rng, gap)`, with no
dependence on attempt count. The current `attempt`-dependent sampling
appears to be a deterministic-stratification trick — if so, it can be
replaced by RNG-only sampling (or by explicit stratification that is
invariant under K changes).

## Recommended iteration unit

**`engine_addLine` calls** — the atomic `lr-core` physics primitive
(`chained.addLine(...)` in `compile.ts:2359` and the closure
`engineUpTo` chain). Each call advances physics by one line.

| Criterion | candidates_sampled | engine_addLine | engine_rebuilds | gap_commits |
|---|---|---|---|---|
| Granularity | High (300-4200) | Very high (~10-100k est.) | **Useless (=1)** | Low (4-133) |
| Cheat-resistance | **LOW** (tryCandidate is unbounded inner work) | **High** (lr-core boundary, bounded primitive) | High but useless | Medium |
| Stability across seeds | cv 0.15 | not yet measured | n/a | not stable |
| Observability | Easy (one site) | Slightly harder (multiple sites; wrap at `engineLineFromTrackLine`) | Easy | Easy |

`candidates_sampled` is the natural granularity but it's the most
gameable. `engine_addLine` is one level deeper and corresponds to a
bounded physics primitive we don't control. Future optimizer changes
that "do more per candidate" still get charged proportionally because
the inner work eventually hits the engine.

A Phase B follow-up should add the `engine_addLine` counter and verify
its stability is comparable to `candidates_sampled`. If it is, it's the
recommended unit.

## Proposed API

```ts
type Budget =
  | { kind: "work"; units: number }       // iteration-count budget
  | { kind: "wall_ms"; ms: number };      // best-effort wall-clock budget

export type CompileOptions = {
  seed?: number;
  budget?: Budget;                         // unset = run to natural completion
};

export function compile(spec: Spec, opts?: CompileOptions): CompileResult;
```

Behavior:
- `budget` unset → today's behavior unchanged (run to completion).
- `budget.kind === "work"` → byte-identical Track for the same
  `(spec, seed, units)` on any machine, OS, or load.
- `budget.kind === "wall_ms"` → compile.ts checks `Date.now()` at gap
  boundaries; same seed + same machine + same load → same Track, but
  results may differ across machines. Documented as best-effort.

The `CompileResult` stays the same shape but with `stats.work_units_used`
and `stats.wall_ms_used` populated. If the compiler exited early due to
budget exhaustion, that's recorded in `stats.budget_exhausted: bool`
and the partial track is returned (always a valid Track — the per-gap
fit array provides one at every gap boundary).

## Per-gap budget allocation

Current model: every gap gets up to K=48 candidates, with short-gap
adaptive early-exit. Most gaps don't consume their K.

Proposed model under a `units` budget:
1. **Reserve**: 60% of the budget goes into a uniform per-gap reserve
   (`reserve_per_gap = 0.6 * total_units / num_gaps`).
2. **Pool**: the remaining 40% becomes a shared pool that hard gaps can
   draw from when they exhaust their reserve.
3. **Greedy**: process gaps in time order. Each gap samples until either
   (a) it finds enough survivors (current `SHORT_GAP_ADAPTIVE_SURVIVORS`
   logic), (b) it exhausts its reserve + pool allocation, or (c) the
   total budget is exhausted.
4. **Backtrack/validation/polish** draw from the same pool. When the
   pool is empty, those operations are skipped (partial track returned).

This preserves the existing early-exit behavior — easy gaps still
cost little — while letting hard gaps (opening_burst) consume more.

The 60/40 split is a starting point; calibrate from data. Phase B
showed gap_commits range 4-133 and backtracks 0-33, suggesting most
budget should be reserved per-gap with a small pool for hard-gap relief.

## Spending policy

What does compile.ts *do* with extra budget? Three choices, in order
of priority:

1. **More candidates per gap** (raise effective K). Highest-leverage
   for compute-bound specs (opening_burst, syncopated_switchback,
   solo_run — Phase B `cands ↔ score` > +0.7).
2. **Deeper backtrack** (raise `BACKTRACK_DEPTH` from 2). Helps specs
   that already exhausted candidates per gap.
3. **More validation retries** (raise `FINAL_VALIDATION_RETRIES` from 3).
   Currently fires 0-6 times per compile.

If the budget is small, default to (1). If medium, (1) then (2). If
large, all three. Concrete allocation policy waits until the
sampling-is-not-i.i.d. fix lands (otherwise (1) is broken).

## Migration story

### In `score.ts`
- Delete `runtimeMultiplier`, `RuntimeBudget`, `scoreTimedDriftReport`.
- `scoreDriftReport` returns the pure quality factors (no
  `time_multiplier`, no `score_without_time`).
- New `score = 1000 * axis * drift * missing * off_beat * survival`.

### In `golden_suite.ts`
- Delete the affine-in-contacts budget constants.
- Add a `budgetFor(spec)` helper that returns a `Budget` for the spec.
  Initial calibration: `{ kind: "work", units: 1500 + 50 * num_contacts }`,
  tuned against the K-sweep data so easy specs get enough and hard
  specs get plenty.

### In `golden.ts`
- Pass `budget` into `compile(spec, { seed, budget: budgetFor(spec) })`.
- Worker timeout becomes a thin safety net (e.g., `wall_ms_budget * 3`
  or absolute 180s cap, whichever is larger).
- Report `goal_score` (pure quality at fixed budget) and
  `contract_pass_rate` (engineering acceptance). The score story is
  much simpler: "this is the quality you get for the compute you paid
  for."

### What stays
- Determinism contract — actually *strengthened* (now explicit per
  budget mode).
- Hard contract gates as the engineering-acceptance boolean.
- Smooth multiplicative quality factors in `score.ts`.
- Shifted geometric mean aggregation.

## Open questions / risks

1. **The non-monotonicity bug must be fixed first.** Until
   `sampleArcParams` is `attempt`-independent, increasing budget can
   make results worse. This is a sampling bug, not a search bug —
   fix it locally and re-verify K-sweep monotonicity before any
   anytime API ships.

2. **`engine_addLine` not yet measured.** Need a follow-up Phase B'
   to verify its stability across seeds.

3. **Per-gap allocation policy untested.** The 60/40 reserve/pool split
   is a starting point; needs empirical tuning against the existing
   golden suite at multiple budget levels.

4. **Polish-pass interruptibility.** Polish passes run after the main
   loop. If they consume budget too, they need to be interruptible at
   per-pass granularity (cheap: each pass is independent; outer loop
   checks budget before starting the next).

5. **Backwards compatibility.** Existing callers of `compile(spec, seed)`
   should keep working — `budget` defaults to unset → run to completion.
   This preserves the current behavior for any non-golden caller.

## Recommended next steps

1. **Fix the `attempt`-dependent sampling first** (small, local change in
   `compile.ts:2971` — make `sampleArcParams` use only `rng` and `gap`
   state, not `attempt`).
2. Re-run the K-sweep, confirm quality is monotonic non-decreasing.
3. Add `engine_addLine` counter, re-run Phase B, verify stability.
4. Draft the implementation plan (compile.ts anytime + score.ts cleanup
   + golden.ts wiring).
5. Implement, verify against the existing 13-spec suite at multiple
   budget levels.

If any of (1)-(3) reveal blockers, return to design and iterate.
