# Goal - low-budget handoff compiler

This file intentionally keeps its historical name because it has useful
campaign notes and is linked from past work. The active compiler is now
`compileHandoff` in `scripts/v0/optimizer/handoff.ts`.

## Campaign Metric

Use this command as the low-budget run of record:

```bash
npm run golden -- --jobs=60 --budget=50000 --compiler=handoff
```

`--compiler=handoff` is explicit but optional; handoff is the default compiler.
The explicit option remains so future compilers can be added without changing
the CLI shape.

Current baseline (20-spec golden suite, after child-prefix cache reuse):

- `goal_score 311.90`
- `valid 60/60` (20 specs × 3 seeds)
- `contract_pass_rate 100%`
- `evaluator_fingerprint e9f938701119`

Variant probe at the same 50k budget:

- `variant_report_score 303.42`
- `valid 120/120`

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
- `handoff_rescue_attempts`
- `handoff_rescue_successes`
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
npm run golden -- --jobs=60 --budget=50000 --compiler=handoff --variants
```

## Current Frontier

At 50k, all 60 base rows now pass the contract. The former base frontier:

- `opening_burst` now passes 3/3 after clean-prefix short-deadline rescue

`verse_chorus`, `drums_swell`, and `drums_breath` remain 3/3 at 50k. The
previous sustained-density row, `solo_run`, remains 3/3. The useful work has
shifted from base-suite contract recovery through variant contract recovery and
toward quality: reaching complete prefixes with lower speed saturation, and
doing so without letting rescue work starve the cheap common path.

The continuous-curve showcase is now 3/3 across the base suite. The visible
residual on several specs is still *speed* overshooting its target on the
dense/late back half (a physics-saturation effect, clear in the dashboard's
measured-vs-target view), but the overspeed dead-end rescue prevents that from
becoming a base-suite survival miss on the former `drums_swell`/`drums_breath`
frontier rows, and short-deadline rescue prevents the hot opening from turning a
rare zero-candidate 10-frame gap into a skipped contact. Trimming that
short-deadline rescue from 96 to 80 deterministic samples kept the base contract
clean while freeing enough work for the stretched hot opening variant to finish.
The extendable per-node candidate cache then removed duplicate normal-prefix
sampling when a node escalates from the cheap 16-sample batch to 32/80-sample
rescue. That preserved candidate order, held the base contract at 60/60, and
let `drums_pulse/time_stretch_102#0` reach a terminal prefix at 50k.
Tail completion now ranks its greedy suffix steps without a nested future
preview. The suffix walk itself is already the future feasibility check, so
skipping the extra one-contact preview removes redundant simulation and moves
more useful prefix outputs under the same deterministic 50k budget.
Future-contact previews now use the same per-node candidate cache as expansion,
and expansion carries the previewed child node forward. That avoids simulating
the first future-contact sample twice, preserves deterministic candidate order
when expansion later extends from preview `K=1` to the normal batch, and brings
the report-only 50k variants to 120/120 valid rows.
Start-state lookahead now carries its sampled root node into the real search, so
the first-contact feasibility probe extends from its cached 8-sample prefix to
the normal 16-sample batch instead of replaying those physics samples. Candidate
order is unchanged; the saved work lets the 50k variants reach a few additional
prefix evaluations and nudges the report score to 302.94.
Child-node extension is now memoized by `(parent, sampled candidate)`, and
candidate caches can answer smaller deterministic prefixes from a larger cached
sample set. That lets the second-contact portion of start lookahead seed the
same child nodes that later preview/expand, avoiding another duplicate physics
path while preserving exact K-prefix semantics. The 50k base score moves to
311.90 and the variants report to 303.42, still with every row valid.

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
