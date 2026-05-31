# Goal - low-budget handoff compiler

This file intentionally keeps its historical name because it has useful
campaign notes and is linked from past work. The active compiler is now
`compileHandoff` in `scripts/v0/optimizer/handoff.ts`.

## Campaign Metric

Use this command as the low-budget run of record:

```bash
npm run golden -- --jobs=4 --budget=50000 --compiler=handoff
```

`--compiler=handoff` is explicit but optional; handoff is the default compiler.
The explicit option remains so future compilers can be added without changing
the CLI shape.

Current baseline (20-spec golden suite):

- `goal_score 284.65`
- `valid 57/60` (20 specs × 3 seeds)
- `contract_pass_rate 95%`
- `evaluator_fingerprint e9f938701119`

> Axis quality is graded **per contact (per gap)**: the achieved value at each
> landing is compared to the axis curve's target there, combined as RMS. Older
> absolute scores are not comparable (the suite and metric have changed since);
> the `EVALUATOR_FINGERPRINT` marks the current ruler.

## What To Optimize

The compiler turns a `Spec` into a Line Rider `Track` whose simulated rider lands
on authored contacts and expresses per-axis target **curves** (`(t) => value`)
for `air`, `speed`, `grain`, and `contact_style`.

Two outcomes matter together:

- **Contract progress:** no drifted contacts, no missing contacts, no off-beat
  landings, and survival to end-of-spec.
- **Quality progress:** among contract-passing outputs, higher axis/contact
  quality matters — graded per gap against the curve's value there.

The score is still computed by `scripts/v0/score.ts`; do not move the scorer or
golden specs to improve the number.

## Handoff Architecture

The search state is a partial prefix at a gap boundary. Each expansion commits
one candidate catch or skips a non-contact gap, then the register scores the
best complete-or-partial output seen so far.

Budget is measured in simulated rider frames and acts only as a stop condition.
The candidate policy must not read the budget. This preserves determinism and
monotonicity: more budget visits a longer prefix of the same deterministic node
sequence, and the strict best-so-far register can only hold or improve.

Important diagnostics:

- `sim_frames`
- `leaves_considered`
- `search_nodes_expanded`
- `frontier_max_size`
- `handoff_partial_evaluations`
- `handoff_full_evaluations`
- `handoff_previews`
- `handoff_preview_contacts`
- `handoff_preview_survivors`
- `handoff_skips`
- `handoff_tail_completion_attempts`
- `handoff_tail_completion_successes`

## Working Loop

1. Make one explainable compiler change.
2. Probe targeted rows first with `--specs`, `--seed`, and `--details`.
3. Run the 50k campaign command before trusting the change.
4. Run `npx vitest run tests/optimizer_handoff.test.ts` after changes to search,
   candidate ordering, budget handling, or the register.
5. Check variants before declaring a broad win:

```bash
npm run golden -- --variants --compiler=handoff
```

## Current Frontier

At 50k, only 3 of 60 rows miss the contract — across 2 specs:

- `solo_run` 41.9 (2/3) — sustained ~80-contact density; the lowest scorer,
  budget-bound at this contact count
- `opening_burst` 168.0 (1/3) — hot dense opening; initial-state bound

Both are budget/density-bound: they improve at higher budgets, so the useful
work is reaching better completions sooner without reading the budget from
policy.

The 7 continuous-curve showcase specs are otherwise the *strongest* rows in the
suite (e.g. `drums_zigzag` 475.7, `drums_pulse` 461.9, `drums_crosscut` 452.9,
all 3/3) — the curve paradigm is not a stressor for contract pass. The visible
residual on several specs is *speed* overshooting its target on the dense/late
back half (a physics-saturation effect, clear in the dashboard's
measured-vs-target view); `air` and `grain` track faithfully. That caps axis
quality, not survival.

Promising levers:

- better handoff-state scoring for catchability and speed/air overshoot
- cheaper future-contact previews with more useful survivor signal
- reusable candidate patterns for periodic contact runs
- start-state search that improves the first few gaps without hidden prepasses
- polish variants that are cheap enough to be worth their metered frames
- speed-bleed / braking that holds a *descending or flat* speed curve on the
  back half (the curve specs make this gap explicit)

Hard rules:

- no spec-name or seed-specific branches
- no wall-clock inputs
- no unseeded randomness
- no scorer or golden-spec edits for score
