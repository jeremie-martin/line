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

- `goal_score 235.09`
- `valid 55/60` (20 specs × 3 seeds)
- `contract_pass_rate 92%`
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

At 50k, 5 of 60 rows miss the contract — across 4 specs:

- `opening_burst` 135.2 (1/3) — hot dense opening; still initial-state/search
  bound
- `verse_chorus` 58.6 (2/3) — one late survival miss after the anti-cliff policy
  cleanup
- `drums_swell` 59.5 (2/3) — late speed growth can still outrun the suffix
- `drums_breath` 43.9 (2/3) — late speed growth can still outrun the suffix

The previous sustained-density row, `solo_run`, now passes 3/3 at 50k. The useful
work remains reaching better complete prefixes sooner without reading the budget
from policy, especially where late speed saturation turns into survival misses.

The continuous-curve showcase is now mixed: `drums_tide`, `drums_dropout`,
`drums_pulse`, `drums_crosscut`, and `drums_zigzag` remain strong 3/3 rows, while
`drums_swell` and `drums_breath` are frontier rows. The visible residual on
several specs is still *speed* overshooting its target on the dense/late back
half (a physics-saturation effect, clear in the dashboard's measured-vs-target
view); on the frontier rows that can cap survival, not only axis quality.

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
