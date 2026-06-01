# Goal - budget-curve handoff compiler

This file keeps its historical name because past work links here. The active
compiler is `compileHandoff` in `scripts/v0/optimizer/handoff.ts`.

## Campaign Metric

Use this command as the run of record:

```bash
npm run golden -- --jobs=60 --compiler=handoff
```

`npm run golden` evaluates the default budget grid:

```text
35000,40000,45000,50000,55000,60000,65000,70000,75000
```

The headline metric is `CURVE_SCORE`: the shifted geometric mean of the suite
score at each budget checkpoint. A targeted probe should still use that standard
budget grid:

```bash
npm run golden -- --specs=tiny_dance,opening_burst,drums_breath --seed=0 --verify-checkpoints --jobs=20
```

Use `CURVE_SCORE` as the campaign headline, not as a blind scalar. The curve
metric is meant to reward improvements that arrive earlier, preserve later
checkpoints, and avoid one-budget overfitting. The budget grid is therefore part
of the benchmark definition: changing `35k..75k` changes what the optimizer is
being asked to do. When judging a change, inspect the per-budget table too:
budget regressions, max-budget validity, and worst rows remain guardrails even
when the aggregate score rises.

Every golden run archives `golden.json` plus checkpoint track/report artifacts
under `generated/golden-runs/<run>/`, which is gitignored through `generated/`.
The JSON records the git commit and dirty state for commit-to-commit comparison.

Current baseline is intentionally pending until the next full curve run is
recorded with the new JSON schema.

## What To Optimize

The compiler turns a `Spec` into Line Rider `Track` checkpoints whose simulated
rider lands on authored contacts and expresses per-axis target curves (`air`,
`speed`, `grain`, and `contact_style`).

Two outcomes matter together:

- **Contract progress:** no drifted contacts, no missing contacts, no off-beat
  landings, and survival to end-of-spec.
- **Quality progress:** among contract-passing outputs, higher axis/contact
  quality matters, graded per gap against the curve value there.

The scorer and golden specs are the ruler. Do not move or edit them to improve
the number.

## Handoff Architecture

The search state is a partial prefix at a gap boundary. Each expansion commits
one candidate catch or skips a non-contact gap, then the register scores the
best complete-or-partial output seen so far.

Budget is measured in simulated rider frames and acts only as a checkpoint/stop
condition. Candidate policy must not read budget. A single run walks a
deterministic node sequence and snapshots the strict best-so-far register at
each requested budget. More budget can hold or improve the returned register key,
but must not regress it.

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
- `handoff_rescue_attempts`
- `handoff_rescue_successes`
- `handoff_skips`
- `handoff_tail_completion_attempts`
- `handoff_tail_completion_successes`

## Working Loop

1. Make one explainable compiler change.
2. Probe targeted rows first with `--specs`, `--seed`, and `--details`, leaving
   the standard budget grid in place.
3. Use `--verify-checkpoints` on small probes after changes to budget handling.
4. Run the default curve command before trusting a broad change.
5. Run `npx vitest run tests/optimizer_handoff.test.ts` after changes to search,
   candidate ordering, budget handling, or the register.
6. Check variants before declaring a broad win:

```bash
npm run golden -- --variants --compiler=handoff
```

## Current Frontier

The useful question is no longer "what wins at one budget?" It is the curve
shape:

- rows invalid across the grid are search-bound;
- rows that improve late are budget-bound;
- rows that plateau early are not converting extra budget into better tracks;
- rows that regress violate the budget-search contract and must be fixed before
  optimizing further.

Budget adaptation should stay progressive and empirical. Prefer one small
spec/search-state signal at a time, such as median contact cadence or whether a
contract-passing output already exists, before making the compiler broadly
budget-aware. The goal is an adaptive compiler, but the checkpoint contract still
requires one deterministic policy sequence whose candidate choices do not read
the requested budgets.

Promising levers:

- better handoff-state scoring for catchability and speed/air overshoot
- cheaper future-contact previews with more useful survivor signal
- reusable candidate patterns for periodic contact runs
- start-state search that improves the first few gaps without hidden prepasses
- polish variants that are cheap enough to be worth their metered frames
- cadence-aware speed-bleed / braking that holds a descending or flat speed curve

Hard rules:

- no spec-name or seed-specific branches
- no wall-clock inputs
- no unseeded randomness
- no scorer or golden-spec edits for score
- no budget-dependent candidate policy
