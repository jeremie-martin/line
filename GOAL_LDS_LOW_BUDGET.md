# Goal - low-budget handoff compiler

This file intentionally keeps its historical name because it has useful
campaign notes and is linked from past work. The active compiler is now
`compileHandoff` in `scripts/v0/optimizer/handoff.ts`.

## Campaign Metric

Use this command as the low-budget run of record:

```bash
npm run golden -- --jobs=4 --budget=40000 --compiler=handoff
```

`--compiler=handoff` is explicit but optional; handoff is the default compiler.
The explicit option remains so future compilers can be added without changing
the CLI shape.

Current baseline before the housekeeping cleanup:

- `SCORE 354.55`
- `valid 36/39`
- `contract_pass_rate 92%`

## What To Optimize

The compiler turns a `Spec` into a Line Rider `Track` whose simulated rider lands
on authored contacts and expresses section axes: `air`, `speed`, `grain`, and
`contact_style`.

Two outcomes matter together:

- **Contract progress:** no drifted contacts, no missing contacts, no off-beat
  landings, and survival to end-of-spec.
- **Quality progress:** among contract-passing outputs, higher axis/contact
  quality matters.

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
3. Run the 40k campaign command before trusting the change.
4. Run `npx vitest run tests/optimizer_handoff.test.ts` after changes to search,
   candidate ordering, budget handling, or the register.
5. Check variants before declaring a broad win:

```bash
npm run golden -- --variants --compiler=handoff
```

## Current Frontier

At 40k, the hard rows are budget-bound around `solo_run` seed 0 and
`opening_burst` seeds 0/2. They already improve at higher budgets, so the useful
work is to make the fixed-budget prefix search reach better completions sooner
without reading the budget from policy.

Promising levers:

- better handoff-state scoring for catchability and speed/air overshoot
- cheaper future-contact previews with more useful survivor signal
- reusable candidate patterns for periodic contact runs
- start-state search that improves the first few gaps without hidden prepasses
- polish variants that are cheap enough to be worth their metered frames

Hard rules:

- no spec-name or seed-specific branches
- no wall-clock inputs
- no unseeded randomness
- no scorer or golden-spec edits for score
